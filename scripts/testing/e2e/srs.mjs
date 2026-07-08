/**
 * SRS V2 自律E2E検証（テストアカウント専用・実ユーザー無関係）
 *
 * 1. test+srs テストユーザーのデータをリセット・再シード（8語・全て復習期限切れ）
 * 2. /settings で「動的復習アルゴリズムβ」をON（実UI操作、PATCH 200を確認）
 * 3. DBで profiles.srs_v2 が実際に true になったこと（正解源）を確認
 * 4. /review で4段階評価ボタンが表示されることを確認、4語に対して
 *    again / hard / good / easy を順にクリック
 * 5. DBで ease_factor / interval_days / next_review_at / streak / is_weak /
 *    correct_count / wrong_count が評価どおりに変化したかを検証
 * 6. /settings でOFFに戻し、DBで srs_v2 が false に戻ったこと（ロールバック）を確認
 * 7. コンソールエラー・5xxが無いことを確認
 *
 * 注記: 本スクリプトは「トグル操作 → 反映確認」を**DB直読み**で判定する。
 * 理由: このアプリの settings ページは PATCH 後に router.refresh() を呼んでおらず、
 * 同一プロセス内で /settings を再訪問すると Next.js 側のキャッシュにより
 * SSR結果が更新されない既存の不具合を確認した（hard reload・新規タブ・
 * キャッシュバスター付きURLのいずれでも解消せず、next dev/next start 両方で再現）。
 * これはSRS V2固有の問題ではなくアプリ側の別課題として切り出し済み（spawn_task）。
 * 回避策として、/settings タブは開いたまま（再訪問せず）別タブで /review を操作し、
 * OFFに戻す操作は最初に開いた /settings タブのローカル状態（クリック直後の正しい状態）
 * に対して行う。トグル操作が実際にDBへ反映されるかはDB直読みで確実に検証する。
 *
 * 使い方: node scripts/testing/e2e/srs.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { getAdminClient } from "../lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { seedSrsUser, resolveUserId } from "../seed-test-data.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
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

  console.log("Resetting/reseeding test+srs data (8 due words, ease=2.5, interval=0)...");
  await seedSrsUser(admin, srsId);

  const { data: before } = await admin
    .from("words")
    .select("word, ease_factor, interval_days, next_review_at, streak, is_weak, correct_count, wrong_count")
    .eq("user_id", srsId);
  const beforeByWord = Object.fromEntries((before ?? []).map((w) => [w.word, w]));

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const settingsPage = await context.newPage(); // /settings は一度だけ訪問し、開いたまま使い回す
  const reviewPage = await context.newPage();   // /review は別タブで操作する
  const settingsErrors = collectErrors(settingsPage);
  const reviewErrors = collectErrors(reviewPage);
  const ratedWords = []; // { word, rating }

  try {
    await login(settingsPage, baseUrl, TEST_ACCOUNTS.srs.email, process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
    // reviewPage は settingsPage と同じ context(同じcookie/セッション)なので再ログイン不要
    ok("logged in as test+srs, redirected to /dashboard");

    // ---- 1) /settings で SRS V2 を ON（クリックの即時UI状態 + PATCH 200 + DB直読みで確認）----
    await gotoReady(settingsPage, `${baseUrl}/settings`);
    const toggle = settingsPage.locator('[data-testid="srs-v2-toggle"]');
    const pressedInitial = await toggle.getAttribute("aria-pressed");
    if (pressedInitial !== "true") {
      const [resp] = await Promise.all([
        settingsPage.waitForResponse((r) => r.url().includes("/api/settings/srs"), { timeout: 10000 }),
        toggle.click(),
      ]);
      if (!resp.ok()) fail(`toggle ON request failed: ${resp.status()}`);
      const pressedAfterClick = await toggle.getAttribute("aria-pressed");
      if (pressedAfterClick === "true") ok("/settings: clicking the toggle immediately shows ON (optimistic UI)");
      else fail(`toggle UI did not switch to ON after click (aria-pressed=${pressedAfterClick})`);
    } else {
      ok("/settings: toggle was already ON");
    }
    const { data: profAfterOn } = await admin.from("profiles").select("srs_v2").eq("id", srsId).maybeSingle();
    if (profAfterOn?.srs_v2 === true) ok("DB confirms profiles.srs_v2 = true after turning ON");
    else fail(`DB does not show srs_v2=true after turning ON (got ${profAfterOn?.srs_v2})`);

    // ---- 2) 別タブの /review で4ボタンUIを確認し、4語を評価 ----
    // (settingsPage は /settings から動かさない。同一URL再訪問時のSSRキャッシュ課題を回避するため)
    await gotoReady(reviewPage, `${baseUrl}/review?start=1&mode=flip`);
    const ratings = ["again", "hard", "good", "easy"];
    // pool は8語あるため、4回評価しても常に「次のカード」が存在する。
    // クリック直後に毎回「次のカードへ切り替わる(=保存完了)」まで待ってから次に進むことで、
    // 最後の評価（4件目）の保存が完了する前にタブを離れてしまう競合を防ぐ。
    for (const rating of ratings) {
      const card = reviewPage.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      const word = await card.getAttribute("data-word");
      await card.click(); // タップして裏面表示
      const btn = reviewPage.locator(`[data-testid="rate-${rating}"]`);
      await btn.waitFor({ state: "visible", timeout: 5000 });
      await btn.click();
      ratedWords.push({ word, rating });
      if (rating === "again") {
        // 「もう一度」= 自力で思い出せなかった直後は、AI解説導線を挟んで自動では
        // 進まない仕様（Phase 3）。「次のカードへ」を明示的にクリックして進める。
        const continueBtn = reviewPage.locator('[data-testid="flashcard-continue"]');
        await continueBtn.waitFor({ state: "visible", timeout: 5000 });
        await continueBtn.click();
      }
      // 保存完了(=次のカードに切り替わる)まで待つ(setTimeout 350ms+DB往復の猶予)
      await reviewPage.waitForFunction(
        (prev) => document.querySelector('[data-testid="flip-card"]')?.getAttribute("data-word") !== prev,
        word,
        { timeout: 8000 },
      );
    }
    const uniqueWords = new Set(ratedWords.map((r) => r.word)).size;
    if (uniqueWords === 4) ok(`clicked 4 ratings on 4 distinct words: ${ratedWords.map((r) => `${r.word}=${r.rating}`).join(", ")}`);
    else fail(`expected 4 distinct words rated, got ${uniqueWords}: ${ratedWords.map((r) => `${r.word}=${r.rating}`).join(", ")}`);

    // ---- 3) OFF に戻す（ロールバック確認）----
    // settingsPage は最初に開いてから一度も再訪問していないため、ローカルReact状態は
    // クリック直後の正しい"ON"のまま。ここでそのままクリックしてOFFに戻す。
    const [offResp] = await Promise.all([
      settingsPage.waitForResponse((r) => r.url().includes("/api/settings/srs"), { timeout: 10000 }),
      toggle.click(),
    ]);
    if (!offResp.ok()) fail(`toggle OFF request failed: ${offResp.status()}`);
    const pressedAfterOffClick = await toggle.getAttribute("aria-pressed");
    if (pressedAfterOffClick === "false") ok("/settings: clicking the toggle immediately shows OFF (optimistic UI)");
    else fail(`toggle UI did not switch to OFF after click (aria-pressed=${pressedAfterOffClick})`);

    const { data: profAfterOff } = await admin.from("profiles").select("srs_v2").eq("id", srsId).maybeSingle();
    if (profAfterOff?.srs_v2 === false) ok("DB confirms profiles.srs_v2 = false after turning OFF (rollback persisted)");
    else fail(`DB still shows srs_v2=${profAfterOff?.srs_v2} after turning OFF`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  const errors = [...settingsErrors, ...reviewErrors];
  if (errors.length) {
    fail(`console/page errors detected:\n  ${errors.join("\n  ")}`);
  } else {
    ok("no console errors, page errors, or 5xx responses during the flow");
  }
  const warnings = [...(settingsErrors.warnings ?? []), ...(reviewErrors.warnings ?? [])];
  if (warnings.length) {
    console.log(`⚠️  known non-fatal warnings (pre-existing, unrelated to SRS V2):\n  ${warnings.join("\n  ")}`);
  }

  // ---- 4) DB検証: 評価どおりに ease_factor / interval_days / streak / is_weak / correct/wrong が変化したか ----
  const { data: after } = await admin
    .from("words")
    .select("word, ease_factor, interval_days, next_review_at, streak, is_weak, correct_count, wrong_count")
    .eq("user_id", srsId);
  const afterByWord = Object.fromEntries((after ?? []).map((w) => [w.word, w]));

  console.log("\n--- DB verification (before -> after, expected) ---");
  for (const { word, rating } of ratedWords) {
    const b = beforeByWord[word];
    const a = afterByWord[word];
    if (!b || !a) { fail(`word not found in DB: ${word}`); continue; }

    const expected = {
      again: { ease: 2.3,  interval: 1, streak: 0,          weak: true,                              wrongDelta: 1, correctDelta: 0 },
      hard:  { ease: 2.35, interval: 1, streak: b.streak+1, weak: b.is_weak && b.streak+1 < 3,        wrongDelta: 0, correctDelta: 1 },
      good:  { ease: 2.5,  interval: 1, streak: b.streak+1, weak: false,                              wrongDelta: 0, correctDelta: 1 },
      easy:  { ease: 2.65, interval: 3, streak: b.streak+1, weak: false,                              wrongDelta: 0, correctDelta: 1 },
    }[rating];

    const checks = [
      ["ease_factor",   Math.abs(a.ease_factor - expected.ease) < 0.01, `${b.ease_factor} -> ${a.ease_factor} (expect ${expected.ease})`],
      ["interval_days",  a.interval_days === expected.interval,          `${b.interval_days} -> ${a.interval_days} (expect ${expected.interval})`],
      ["streak",         a.streak === expected.streak,                  `${b.streak} -> ${a.streak} (expect ${expected.streak})`],
      ["is_weak",        a.is_weak === expected.weak,                   `${b.is_weak} -> ${a.is_weak} (expect ${expected.weak})`],
      ["correct_count",  a.correct_count === b.correct_count + expected.correctDelta, `${b.correct_count} -> ${a.correct_count}`],
      ["wrong_count",    a.wrong_count === b.wrong_count + expected.wrongDelta,       `${b.wrong_count} -> ${a.wrong_count}`],
    ];
    const daysAhead = (new Date(a.next_review_at) - Date.now()) / (24 * 3600 * 1000);
    checks.push(["next_review_at", Math.abs(daysAhead - expected.interval) < 0.05, `~${daysAhead.toFixed(2)}d ahead (expect ~${expected.interval}d)`]);

    console.log(`\n[${word}] rating=${rating}`);
    for (const [field, pass, detail] of checks) {
      if (pass) ok(`  ${field}: ${detail}`);
      else fail(`  ${field}: ${detail}`);
    }
  }

  if (process.exitCode) {
    console.log("\n=== SRS V2 E2E: FAILED (see ❌ above) ===");
  } else {
    console.log("\n=== SRS V2 E2E: ALL CHECKS PASSED ===");
  }
}

main().catch((e) => {
  console.error("srs e2e crashed:", e);
  process.exit(1);
});
