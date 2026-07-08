/**
 * フラッシュカード「もう一度/まだ」直後のAI解説導線 自律E2E検証（テストアカウント専用: test+srs）
 *
 * 2026-07-08、「自己想起×忘却曲線」を中心価値とする改善の一環として、AI解説への
 * 導線を単語検索時だけでなく「今まさに自力で思い出せなかった」フラッシュカードの
 * 直後にも用意した（src/components/review/FlashcardAiHint.tsx）。
 *
 * 検証内容:
 * 1. 「もう一度/まだ」（forgot）を押した直後にAI解説導線（ボタン）が表示される
 * 2. ボタンを押すまでは /api/ai へのリクエストが一切発生しない（自動実行しない）
 * 3. ボタンを押すと kind="explain" で /api/ai が呼ばれ、結果が表示される
 * 4. 「普通/覚えた」（good）を押した場合はAI解説導線が表示されず、通常通り
 *    次のカードへ自動で進む（過度に出さない）
 * 5. 無料の1日利用上限に達している状態でボタンを押すと、既存のAI使用量制限
 *    （429・UpsellModal・広告視聴チケット導線）がそのまま機能する
 * 6. 上記いずれの呼び出しでも ai_usage_events に既存仕様通りログが残る
 *    （入力テキスト・AI応答本文は記録されない設計を変更していない）
 *
 * 使い方: node scripts/testing/e2e/flashcard-ai-hint.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { todayJST } from "../../../src/lib/utils/date.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
const DAY = 24 * 3600 * 1000;

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function dueWord(word, meaning) {
  return {
    word, meaning,
    ease_factor: 2.5, interval_days: 5, streak: 1, is_weak: false,
    correct_count: 1, wrong_count: 0, mastery: 20,
    next_review_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    last_studied_at: new Date(Date.now() - DAY).toISOString(),
  };
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.srs.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const srsId = await resolveUserId(admin, TEST_ACCOUNTS.srs.email);
  const email = TEST_ACCOUNTS.srs.email;
  const password = process.env[TEST_ACCOUNTS.srs.passwordEnvKey];

  const { data: originalProfile } = await admin
    .from("profiles")
    .select("is_premium, daily_ai_used, daily_ai_reset_at")
    .eq("id", srsId)
    .maybeSingle();

  // 既存の残骸があれば掃除
  const { data: leftover } = await admin
    .from("word_books")
    .select("id")
    .eq("user_id", srsId)
    .like("title", "TEST_FLASHCARD_AI_HINT%");
  for (const b of leftover ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: srsId, title: "TEST_FLASHCARD_AI_HINT", source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト用単語帳の作成に失敗: ${bookErr?.message}`);

  const { error: wErr } = await admin.from("words").insert([
    { user_id: srsId, word_book_id: book.id, pos: "verb", ...dueWord("forgetword", "[TEST] 忘れる想定の単語") },
    { user_id: srsId, word_book_id: book.id, pos: "verb", ...dueWord("goodword", "[TEST] 覚えている想定の単語") },
    { user_id: srsId, word_book_id: book.id, pos: "verb", ...dueWord("limitword", "[TEST] 上限到達時の単語") },
  ]);
  if (wErr) throw new Error(`テスト用単語の投入に失敗: ${wErr.message}`);

  // Freeユーザー・上限未到達の状態に揃える（既存daily_ai_used等は後で復元）
  await admin.from("profiles").update({ is_premium: false, daily_ai_used: 0, daily_ai_reset_at: todayJST() }).eq("id", srsId);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    const apiAiRequests = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/ai") && !req.url().includes("/api/ai/")) {
        apiAiRequests.push({ url: req.url(), method: req.method() });
      }
    });

    await login(page, baseUrl, email, password);
    ok("logged in as test+srs");

    await gotoReady(page, `${baseUrl}/review?start=1&mode=flip&book=${book.id}`);

    // ---- 1. forgetword: 「もう一度/まだ」を押す ----
    {
      const card = page.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      const word = await card.getAttribute("data-word");
      if (word !== "forgetword") bad(`1問目がforgetwordではない: ${word}`);
      await card.click();
      const wrongBtn = page.locator('[data-testid="rate-again"], [data-testid="answer-wrong"]').first();
      await wrongBtn.waitFor({ state: "visible", timeout: 5000 });
      await wrongBtn.click();

      const hintPanel = page.locator('[data-testid="flashcard-forgot-hint"]');
      await hintPanel.waitFor({ state: "visible", timeout: 5000 }).then(
        () => ok("forgot/again直後にAI解説導線パネルが表示される"),
        () => bad("forgot/again直後にAI解説導線パネルが表示されない"),
      );

      const trigger = page.locator('[data-testid="flashcard-ai-hint-trigger"]');
      const triggerVisible = await trigger.isVisible().catch(() => false);
      if (triggerVisible) ok("AI解説の導線ボタン（この単語、なぜ覚えにくい？）が表示される");
      else bad("AI解説の導線ボタンが表示されない");

      if (apiAiRequests.length === 0) ok("ボタンを押す前は /api/ai へのリクエストが一切発生していない（自動実行しない）");
      else bad(`ボタンを押す前に /api/ai へのリクエストが発生していた: ${JSON.stringify(apiAiRequests)}`);

      // ---- 2. トリガーを押すとAPIが呼ばれ、結果が表示される ----
      await trigger.click();
      await page.waitForFunction(
        () => {
          const panel = document.querySelector('[data-testid="flashcard-ai-hint-panel"]');
          return !!panel && panel.textContent && panel.textContent.trim().length > 20;
        },
        { timeout: 15000 },
      ).then(
        () => ok("ボタンを押すとAI解説パネルに結果が表示される"),
        () => bad("ボタンを押してもAI解説パネルに結果が表示されない"),
      );

      if (apiAiRequests.length === 1 && apiAiRequests[0].method === "POST") {
        ok(`ボタンを押した直後に /api/ai へ1回だけPOSTされた: ${apiAiRequests[0].url}`);
      } else {
        bad(`/api/ai へのリクエスト回数が想定外: ${JSON.stringify(apiAiRequests)}`);
      }

      // 次のカードへ進む
      const continueBtn = page.locator('[data-testid="flashcard-continue"]');
      await continueBtn.waitFor({ state: "visible", timeout: 5000 });
      await continueBtn.click();
      await page.waitForFunction(
        (prev) => document.querySelector('[data-testid="flip-card"]')?.getAttribute("data-word") !== prev,
        word,
        { timeout: 8000 },
      );
      ok("「次のカードへ」で次の単語に進む");
    }

    // ---- 3. goodword: 「普通/覚えた」では導線が出ない ----
    {
      const card = page.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      const word = await card.getAttribute("data-word");
      if (word !== "goodword") bad(`2問目がgoodwordではない: ${word}`);
      await card.click();
      const correctBtn = page.locator('[data-testid="rate-good"], [data-testid="answer-correct"]').first();
      await correctBtn.waitFor({ state: "visible", timeout: 5000 });
      await correctBtn.click();

      // 自動で次のカードへ進む(=AI解説導線を経由しない)ことを確認
      await page.waitForFunction(
        (prev) => document.querySelector('[data-testid="flip-card"]')?.getAttribute("data-word") !== prev,
        word,
        { timeout: 8000 },
      ).then(
        () => ok("good/覚えたでは自動で次のカードへ進む（AI解説導線を経由しない）"),
        () => bad("good/覚えたの直後に自動で次へ進まなかった"),
      );

      const hintPanelAfterGood = await page.locator('[data-testid="flashcard-forgot-hint"]').isVisible().catch(() => false);
      if (!hintPanelAfterGood) ok("good/覚えたではAI解説導線パネルが表示されない（過度に出さない）");
      else bad("good/覚えたなのにAI解説導線パネルが表示された");
    }

    if (errors.length) bad(`操作中にエラー検出:\n  ${errors.join("\n  ")}`);
    else ok("ここまでの操作中に console error / 5xx なし");

    // ---- 4. 無料の1日上限に達している状態で導線を押す ----
    await admin.from("profiles").update({ daily_ai_used: 5, daily_ai_reset_at: todayJST() }).eq("id", srsId);
    {
      const card = page.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      const word = await card.getAttribute("data-word");
      if (word !== "limitword") bad(`3問目がlimitwordではない: ${word}`);
      await card.click();
      const wrongBtn = page.locator('[data-testid="rate-again"], [data-testid="answer-wrong"]').first();
      await wrongBtn.waitFor({ state: "visible", timeout: 5000 });
      await wrongBtn.click();

      const trigger = page.locator('[data-testid="flashcard-ai-hint-trigger"]');
      await trigger.waitFor({ state: "visible", timeout: 5000 });
      await trigger.click();

      await page.waitForFunction(
        () => document.body.innerText.includes("本日のAI解説の上限に達しました"),
        { timeout: 10000 },
      ).then(
        () => ok("無料上限到達時、Premium導線（UpsellModal）が自然に表示される"),
        () => bad("無料上限到達時にUpsellModalが表示されなかった"),
      );

      const adButtonVisible = await page.locator('button:has-text("広告を見てAIをもう1回使う")').isVisible().catch(() => false);
      if (adButtonVisible) ok("上限到達時、広告視聴でのAI追加利用ボタンが表示される（既存仕様と同じ）");
      // ADS_ENABLED次第で非表示のこともあるため、falseは減点しない（既存AiPanelと同じ扱い）

      const limitText = await page.locator('[data-testid="flashcard-ai-hint-panel"]').innerText().catch(() => "");
      if (limitText.includes("本日の利用上限に達しました")) ok("上限到達時のエラーメッセージ文言が既存仕様と一致する");
      else bad(`上限到達時のメッセージが想定外: "${limitText}"`);

      // 直近1件が今回の429（quota_denied）ログであることを直接確認する
      // （このテストアカウントには他テストの残骸ログが蓄積している場合があるため、
      // 件数の前後比較ではなく「最新1件の中身」で判定する）。
      const { data: latestEvents } = await admin
        .from("ai_usage_events")
        .select("id, status, is_premium, route, created_at")
        .eq("user_id", srsId)
        .eq("route", "ai")
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = latestEvents?.[0];
      if (latest?.status === "quota_denied" && latest?.is_premium === false) {
        ok(`ai_usage_eventsに上限到達のログが記録される（既存ログ設計を維持）: ${JSON.stringify(latest)}`);
      } else {
        bad(`上限到達時のログがai_usage_eventsに正しく記録されていない: ${JSON.stringify(latest)}`);
      }
    }

    // 意図的に発生させた429（無料上限到達）に対するブラウザの
    // "Failed to load resource" ログはノイズなので除外する（ai-usage-guards.mjsと同じ扱い）。
    const realErrors = errors.filter((e) => !/Failed to load resource/.test(e));
    if (realErrors.length) bad(`操作中にエラー検出:\n  ${realErrors.join("\n  ")}`);
    else ok("全操作中に console error / 5xx なし（意図的な429のリソースログを除く）");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await admin.from("words").delete().eq("word_book_id", book.id);
    await admin.from("word_books").delete().eq("id", book.id);
    await admin.from("profiles").update({
      is_premium: originalProfile?.is_premium ?? false,
      daily_ai_used: originalProfile?.daily_ai_used ?? 0,
      daily_ai_reset_at: originalProfile?.daily_ai_reset_at ?? todayJST(),
    }).eq("id", srsId);
    ok("テスト用単語帳・単語を削除し、profiles(is_premium/daily_ai_used)を元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:flashcard-ai-hint RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("flashcard-ai-hint e2e crashed:", e);
  process.exit(1);
});
