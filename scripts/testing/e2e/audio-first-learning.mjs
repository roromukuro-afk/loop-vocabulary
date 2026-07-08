/**
 * 音声ファーストUI（自動再生ON/OFFトグル）自律E2E検証（テストアカウント専用: test+srs）
 *
 * 2026-07-08、フラッシュカード・4択テストで単語表示時の自動読み上げをユーザーが
 * ON/OFFできるトグル（src/components/ui/AudioAutoplayToggle.tsx、
 * localStorage key: lv_audio_autoplay）を追加した。
 *
 * 検証内容:
 * 1. /review（フラッシュカード）にトグルが表示され、初期状態はON
 * 2. トグルをクリックするとOFFになり、localStorageに反映される
 * 3. OFFにしてもフラッシュカードの学習フロー（フリップ→評価→次のカード）は
 *    問題なく継続できる（音声が使えなくても学習継続できることの確認）
 * 4. OFFの状態でも、単語横の🔊手動再生ボタン（PronounceButton）は引き続き
 *    クリックでき、console errorを起こさない
 * 5. /test/choice（4択テスト、en2ja）にも同じトグルがあり、同じlocalStorage
 *    キーを共有する（一方でOFFにすると他方でも設定が引き継がれる）
 * 6. 既存のリスニングテスト（明示的な再生ボタン）はトグルの影響を受けず、
 *    OFFの状態でも問題なく再生・回答できる
 *
 * 使い方: node scripts/testing/e2e/audio-first-learning.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

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

function decoy(i) {
  const now = Date.now();
  return {
    word: `audiodecoy${i}`, meaning: `[TEST] 音声デコイ${i}`,
    ease_factor: 2.5, interval_days: 30, streak: 8, correct_count: 8, wrong_count: 0,
    is_weak: false, mastery: 90,
    next_review_at: new Date(now + 30 * DAY).toISOString(),
    last_studied_at: new Date(now - 5 * DAY).toISOString(),
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

  const { data: leftover } = await admin
    .from("word_books")
    .select("id")
    .eq("user_id", srsId)
    .like("title", "TEST_AUDIO_FIRST%");
  for (const b of leftover ?? []) {
    await admin.from("words").delete().eq("word_book_id", b.id);
    await admin.from("word_books").delete().eq("id", b.id);
  }

  const { data: flashBook, error: flashErr } = await admin
    .from("word_books")
    .insert({ user_id: srsId, title: "TEST_AUDIO_FIRST_FLASH", source_type: "custom" })
    .select("id")
    .single();
  if (flashErr || !flashBook) throw new Error(`テスト用単語帳の作成に失敗: ${flashErr?.message}`);
  await admin.from("words").insert([
    { user_id: srsId, word_book_id: flashBook.id, pos: "verb", ...dueWord("audioflashword", "[TEST] 音声フラッシュ単語") },
  ]);

  const { data: choiceBook, error: choiceErr } = await admin
    .from("word_books")
    .insert({ user_id: srsId, title: "TEST_AUDIO_FIRST_CHOICE", source_type: "custom" })
    .select("id")
    .single();
  if (choiceErr || !choiceBook) throw new Error(`テスト用単語帳の作成に失敗: ${choiceErr?.message}`);
  await admin.from("words").insert([
    { user_id: srsId, word_book_id: choiceBook.id, pos: "verb", ...dueWord("audiochoiceword", "[TEST] 音声4択単語") },
    { user_id: srsId, word_book_id: choiceBook.id, pos: "verb", ...decoy(1) },
    { user_id: srsId, word_book_id: choiceBook.id, pos: "verb", ...decoy(2) },
    { user_id: srsId, word_book_id: choiceBook.id, pos: "verb", ...decoy(3) },
  ]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  const bookIds = [flashBook.id, choiceBook.id];

  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, baseUrl, email, password);
    ok("logged in as test+srs");

    // ---- 1〜3. /review: トグルの初期状態・クリックでOFFへ・学習継続 ----
    await gotoReady(page, `${baseUrl}/review?start=1&mode=flip&book=${flashBook.id}`);
    {
      const toggle = page.locator('[data-testid="audio-autoplay-toggle"]');
      const initialText = await toggle.textContent();
      if (initialText?.includes("ON")) ok(`フラッシュカードの自動再生トグルは初期状態でON: "${initialText}"`);
      else bad(`初期状態が想定外: "${initialText}"`);

      await toggle.click();
      const afterClickText = await toggle.textContent();
      if (afterClickText?.includes("OFF")) ok(`トグルクリックでOFFに切り替わる: "${afterClickText}"`);
      else bad(`クリック後の表示が想定外: "${afterClickText}"`);

      const storedValue = await page.evaluate(() => localStorage.getItem("lv_audio_autoplay"));
      if (storedValue === "0") ok("localStorage(lv_audio_autoplay)に'0'が保存される");
      else bad(`localStorageの値が想定外: ${storedValue}`);

      // OFFのまま学習フローを最後まで進められることを確認
      const card = page.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });

      // 手動再生ボタン(PronounceButton)はトグルOFFでも押せる
      const pronounceBtn = page.locator('button[aria-label*="の発音"]').first();
      const pronounceVisible = await pronounceBtn.isVisible().catch(() => false);
      if (pronounceVisible) {
        await pronounceBtn.click();
        ok("自動再生OFFでも手動再生ボタン(🔊)はクリックできる");
      } else {
        bad("手動再生ボタンが見つからない");
      }

      await card.click();
      const rateBtn = page.locator('[data-testid="rate-good"], [data-testid="answer-correct"]').first();
      await rateBtn.waitFor({ state: "visible", timeout: 5000 });
      await rateBtn.click();
      await page.waitForTimeout(600);
      ok("自動再生OFFの状態でもフラッシュカードの評価操作が問題なく完了する");
    }

    // ---- 5. /test/choice: 同じlocalStorageキーを共有する ----
    await gotoReady(page, `${baseUrl}/test/choice?book=${choiceBook.id}`);
    {
      const toggle = page.locator('[data-testid="audio-autoplay-toggle"]');
      const text = await toggle.textContent();
      if (text?.includes("OFF")) {
        ok(`4択テストのトグルにも/reviewで設定したOFFが引き継がれる: "${text}"`);
      } else {
        bad(`4択テストのトグル初期状態が想定外（localStorage共有されていない可能性）: "${text}"`);
      }

      const prompt = page.locator('[data-testid="quiz-prompt"]');
      await prompt.waitFor({ state: "visible", timeout: 10000 });
      const answerBtn = page.locator('[data-testid="quiz-choice"][data-answer="true"]').first();
      await answerBtn.click();
      ok("自動再生OFFの状態でも4択テストの回答操作が問題なく完了する");
    }

    // ---- 6. リスニングテスト: トグルの影響を受けず明示的な再生ボタンが機能する ----
    const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", srsId).maybeSingle();
    await admin.from("profiles").update({ is_premium: true }).eq("id", srsId);
    try {
      const { data: listeningBook, error: lErr } = await admin
        .from("word_books")
        .insert({ user_id: srsId, title: "TEST_AUDIO_FIRST_LISTENING", source_type: "custom" })
        .select("id")
        .single();
      if (lErr || !listeningBook) throw new Error(`テスト用単語帳の作成に失敗: ${lErr?.message}`);
      bookIds.push(listeningBook.id);
      await admin.from("words").insert([
        { user_id: srsId, word_book_id: listeningBook.id, pos: "verb", ...dueWord("audiolistenword", "[TEST] 音声リスニング単語") },
      ]);

      await gotoReady(page, `${baseUrl}/test/listening?book=${listeningBook.id}&n=1`);
      const listenPrompt = page.locator('[data-testid="quiz-prompt"]');
      await listenPrompt.waitFor({ state: "visible", timeout: 10000 });
      await page.locator('[data-testid="quiz-play"]').click();
      await page.locator('[data-testid="quiz-input"]').fill("audiolistenword");
      await page.locator('[data-testid="quiz-submit"]').click();
      await page.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      ok("自動再生OFFの状態でも、リスニングテストの明示的な再生ボタンは影響を受けず正常に動作する");
    } finally {
      await admin.from("profiles").update({ is_premium: originalProfile?.is_premium ?? false }).eq("id", srsId);
    }

    if (errors.length) bad(`操作中にエラー検出:\n  ${errors.join("\n  ")}`);
    else ok("全操作中に console error / 5xx なし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    for (const bookId of bookIds) {
      await admin.from("words").delete().eq("word_book_id", bookId);
      await admin.from("word_books").delete().eq("id", bookId);
    }
    ok("テスト用単語帳・単語を削除してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:audio-first-learning RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("audio-first-learning e2e crashed:", e);
  process.exit(1);
});
