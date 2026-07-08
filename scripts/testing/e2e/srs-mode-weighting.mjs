/**
 * SRS V2 学習モード別 間隔重み付け 自律E2E検証（テストアカウント専用: test+srs）
 *
 * 2026-07-07、「自己想起×忘却曲線」を中心価値とする改善の一環として、
 * SRS V2のinterval計算にモード別の重み付け（src/lib/srs/index.ts の
 * MODE_INTERVAL_MULTIPLIER）を追加した。4択(choice)は消去法・見覚えでも
 * 正解できるため、フラッシュカード(flashcard)での自己想起ほど強い記憶定着
 * シグナルではない、という考え方にもとづく。
 *
 * 検証内容:
 * 1. 同一の初期状態（ease=2.5, interval_days=10）から「正解」評価を行った場合、
 *    interval_daysの伸び幅が flashcard(1.0倍) > typing(0.9倍) > listening(0.85倍)
 *    > choice(0.65倍) の順になること（4択正解はflashcard正解よりintervalが
 *    伸びにくいこと・typing/listeningはchoiceより強くflashcard以下であること）
 * 2. 「もう一度/forgot」に相当する不正解評価は、モードによらず常に
 *    ease低下・interval=1（翌日）に短縮されること（choiceモードの0.65倍が
 *    適用されないことを確認する）
 * 3. 既存のsrs.mjs（flashcardのみ）が引き続き全項目PASSすること
 *    （このテストとは別に `npm run test:srs` で検証する）
 *
 * 注意: /test/choice, /test/typing は出題数がpool.length・最低出題数の
 * 制約でクランプされ、単語帳内の複数語が重み付き抽選で出題される
 * （出題順は確定的ではない）。そのため、対象語がどの順で出題されても
 * 確実に捕捉できるよう、quiz-prompt の data-word-id を見て対象語が
 * 出題されるまで他の問題を消化する「advance-until-target」方式を取る。
 *
 * 使い方: node scripts/testing/e2e/srs-mode-weighting.mjs
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

// 全モード共通の初期SRS状態: ease=2.5(既定), interval_days=10(既存間隔あり)。
// interval_days=0(初回)だとフォールバック値(1や3など固定値)になり、倍率の
// 違いが数値に現れないため、意図的に既存間隔ありの状態から検証する。
function baseWordFields() {
  const now = Date.now();
  return {
    ease_factor: 2.5,
    interval_days: 10,
    streak: 2,
    is_weak: false,
    correct_count: 2,
    wrong_count: 0,
    mastery: 40,
    next_review_at: new Date(now - 3600 * 1000).toISOString(), // 期限到来済み
    last_studied_at: new Date(now - DAY).toISOString(),
  };
}

// 出題プールを埋めるためのデコイ（mastered状態＝出題優先度が低い）
function decoyFields(i) {
  const now = Date.now();
  return {
    word: `decoy${i}`,
    meaning: `[TEST] デコイ${i}`,
    ease_factor: 2.5,
    interval_days: 30,
    streak: 8,
    correct_count: 8,
    wrong_count: 0,
    is_weak: false,
    mastery: 90,
    next_review_at: new Date(now + 30 * DAY).toISOString(),
    last_studied_at: new Date(now - 5 * DAY).toISOString(),
  };
}

async function makeBook(admin, userId, tag, wordRows) {
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: `TEST_MODE_WEIGHT_${tag}`, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト用単語帳の作成に失敗(${tag}): ${bookErr?.message}`);

  const rows = wordRows.map((w) => ({
    user_id: userId,
    word_book_id: book.id,
    pos: "verb",
    ...w,
  }));
  const { data: inserted, error: wErr } = await admin.from("words").insert(rows).select("id, word");
  if (wErr) throw new Error(`テスト用単語の投入に失敗(${tag}): ${wErr.message}`);
  return { bookId: book.id, words: inserted };
}

async function cleanupBook(admin, bookId) {
  await admin.from("words").delete().eq("word_book_id", bookId);
  await admin.from("word_books").delete().eq("id", bookId);
}

/**
 * /test/choice: 対象語(targetWordId)が出題されるまで、それ以外の問題は
 * 「正解」を選んで消化し、対象語が出てきたら finalAction ("correct"|"wrong") を
 * 実行して抜ける。出題順は重み付きランダムのため確定しない前提の設計。
 */
async function driveChoiceUntilTarget(page, targetWordId, finalAction) {
  for (let i = 0; i < 8; i++) {
    const prompt = page.locator('[data-testid="quiz-prompt"]');
    await prompt.waitFor({ state: "visible", timeout: 10000 });
    const wordId = await prompt.getAttribute("data-word-id");
    const correctBtn = page.locator('[data-testid="quiz-choice"][data-answer="true"]');
    if (wordId === targetWordId) {
      if (finalAction === "correct") {
        await correctBtn.click();
      } else {
        await page.locator('[data-testid="quiz-choice"]:not([data-answer="true"])').first().click();
      }
      await page.waitForTimeout(600);
      return;
    }
    await correctBtn.click();
    await page.waitForTimeout(250);
    const nextBtn = page.locator('[data-testid="quiz-next"]');
    await nextBtn.waitFor({ state: "visible", timeout: 5000 });
    await nextBtn.click();
    await page.waitForTimeout(250);
  }
  throw new Error(`choiceモード: 対象語(${targetWordId})が出題キュー内で見つからなかった`);
}

/**
 * /test/typing: pool.length>=3必須のためデコイを含む出題キューになる。
 * 対象語以外は「スキップ」で即座に消化し、対象語が出たら正しいスペルを
 * タイプして正解させる。
 */
async function driveTypingUntilTarget(page, targetWordId, targetWord) {
  for (let i = 0; i < 8; i++) {
    const prompt = page.locator('[data-testid="quiz-prompt"]');
    await prompt.waitFor({ state: "visible", timeout: 10000 });
    const wordId = await prompt.getAttribute("data-word-id");
    if (wordId === targetWordId) {
      await page.locator('[data-testid="quiz-input"]').fill(targetWord);
      await page.waitForTimeout(800);
      return;
    }
    const skipBtn = page.getByRole("button", { name: "スキップ →" });
    await skipBtn.click();
    await page.waitForTimeout(200);
  }
  throw new Error(`typingモード: 対象語(${targetWordId})が出題キュー内で見つからなかった`);
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

  // 後始末のための元の状態を保存
  const { data: originalProfile } = await admin.from("profiles").select("srs_v2, is_premium").eq("id", srsId).maybeSingle();
  const originalSrsV2 = originalProfile?.srs_v2 ?? false;
  const originalIsPremium = originalProfile?.is_premium ?? false;

  // SRS V2 + Premium(typing/listening利用のため)を直接有効化（トグルUI自体は既存test:srsで検証済み）
  await admin.from("profiles").update({ srs_v2: true, is_premium: true }).eq("id", srsId);

  // 既存の残骸があれば掃除
  const { data: leftover } = await admin
    .from("word_books")
    .select("id")
    .eq("user_id", srsId)
    .like("title", "TEST_MODE_WEIGHT_%");
  for (const b of leftover ?? []) await cleanupBook(admin, b.id);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  const createdBookIds = [];

  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await login(page, baseUrl, email, password);
    ok("logged in as test+srs");

    // ---- 1. flashcard: 「普通(good)」評価 ----
    const flash = await makeBook(admin, srsId, "FLASH", [
      { word: "flashgoodword", meaning: "[TEST] flashcard good", ...baseWordFields() },
    ]);
    createdBookIds.push(flash.bookId);
    await gotoReady(page, `${baseUrl}/review?start=1&mode=flip&book=${flash.bookId}`);
    {
      const card = page.locator('[data-testid="flip-card"]');
      await card.waitFor({ state: "visible", timeout: 10000 });
      await card.click();
      await page.locator('[data-testid="rate-good"]').click();
      await page.waitForTimeout(600);
    }

    // ---- 2. choice: 正解（4択の正解も内部的には"good"相当）----
    const choiceGood = await makeBook(admin, srsId, "CHOICE_GOOD", [
      { word: "choicegoodword", meaning: "[TEST] choice good", ...baseWordFields() },
      decoyFields(1), decoyFields(2), decoyFields(3),
    ]);
    createdBookIds.push(choiceGood.bookId);
    const choiceGoodTargetId = choiceGood.words.find((w) => w.word === "choicegoodword").id;
    await gotoReady(page, `${baseUrl}/test/choice?book=${choiceGood.bookId}`);
    await driveChoiceUntilTarget(page, choiceGoodTargetId, "correct");

    // ---- 3. choice: 不正解（「もう一度」相当。モードによらず短い間隔になることを確認）----
    const choiceBad = await makeBook(admin, srsId, "CHOICE_BAD", [
      { word: "choicebadword", meaning: "[TEST] choice bad", ...baseWordFields() },
      decoyFields(4), decoyFields(5), decoyFields(6),
    ]);
    createdBookIds.push(choiceBad.bookId);
    const choiceBadTargetId = choiceBad.words.find((w) => w.word === "choicebadword").id;
    await gotoReady(page, `${baseUrl}/test/choice?book=${choiceBad.bookId}`);
    await driveChoiceUntilTarget(page, choiceBadTargetId, "wrong");

    // ---- 4. typing: 正解（Premium限定。/test/typing は pool.length>=3 必須のためデコイを追加）----
    const typing = await makeBook(admin, srsId, "TYPING", [
      { word: "typinggoodword", meaning: "[TEST] typing good", ...baseWordFields() },
      { ...decoyFields(7), word: "typingdecoy7" },
      { ...decoyFields(8), word: "typingdecoy8" },
    ]);
    createdBookIds.push(typing.bookId);
    const typingTargetId = typing.words.find((w) => w.word === "typinggoodword").id;
    await gotoReady(page, `${baseUrl}/test/typing?book=${typing.bookId}`);
    await driveTypingUntilTarget(page, typingTargetId, "typinggoodword");

    // ---- 5. listening: 正解（Premium限定。pool=1でも動作するため対象語のみ）----
    const listening = await makeBook(admin, srsId, "LISTENING", [
      { word: "listeninggoodword", meaning: "[TEST] listening good", ...baseWordFields() },
    ]);
    createdBookIds.push(listening.bookId);
    await gotoReady(page, `${baseUrl}/test/listening?book=${listening.bookId}&n=1`);
    {
      const prompt = page.locator('[data-testid="quiz-prompt"]');
      await prompt.waitFor({ state: "visible", timeout: 10000 });
      await page.locator('[data-testid="quiz-play"]').click();
      await page.locator('[data-testid="quiz-input"]').fill("listeninggoodword");
      await page.locator('[data-testid="quiz-submit"]').click();
      await page.locator('[data-testid="quiz-next"]').waitFor({ state: "visible", timeout: 8000 });
      await page.waitForTimeout(800);
    }

    if (errors.length) bad(`操作中にエラー検出:\n  ${errors.join("\n  ")}`);
    else ok("操作中に console error / 5xx なし");

    await page.close();

    // ---- DB検証 ----
    const wordChecks = [
      { word: "flashgoodword", mode: "flashcard", expectedInterval: 25, expectedEase: 2.5 },
      { word: "choicegoodword", mode: "choice", expectedInterval: 16, expectedEase: 2.5 },
      { word: "typinggoodword", mode: "typing", expectedInterval: 23, expectedEase: 2.5 },
      { word: "listeninggoodword", mode: "listening", expectedInterval: 21, expectedEase: 2.5 },
      { word: "choicebadword", mode: "choice(again)", expectedInterval: 1, expectedEase: 2.3 },
    ];
    const results = {};
    for (const { word, mode, expectedInterval, expectedEase } of wordChecks) {
      const { data } = await admin.from("words").select("ease_factor, interval_days").eq("user_id", srsId).eq("word", word).maybeSingle();
      results[word] = data;
      if (!data) { bad(`${mode}: 単語がDBに見つからない (${word})`); continue; }
      if (data.interval_days === expectedInterval) ok(`${mode}: interval_days = ${data.interval_days}（期待値 ${expectedInterval}）`);
      else bad(`${mode}: interval_daysが想定外 (実際=${data.interval_days}, 期待値=${expectedInterval})`);
      if (Math.abs(data.ease_factor - expectedEase) < 0.01) ok(`${mode}: ease_factor = ${data.ease_factor}（期待値 ${expectedEase}）`);
      else bad(`${mode}: ease_factorが想定外 (実際=${data.ease_factor}, 期待値=${expectedEase})`);
    }

    // ---- 比較検証: choice正解 < listening正解 < typing正解 < flashcard正解 ----
    const c = results.choicegoodword?.interval_days;
    const l = results.listeninggoodword?.interval_days;
    const t = results.typinggoodword?.interval_days;
    const f = results.flashgoodword?.interval_days;
    if ([c, l, t, f].every((v) => typeof v === "number")) {
      if (c < l && l < t && t < f) {
        ok(`4択正解(${c}日)はflashcard正解(${f}日)よりintervalが伸びにくく、typing(${t}日)/listening(${l}日)はchoiceより強くflashcard以下になっている`);
      } else {
        bad(`モード間のinterval大小関係が想定外: choice=${c}, listening=${l}, typing=${t}, flashcard=${f}（choice < listening < typing < flashcard を期待）`);
      }
    } else {
      bad("モード間比較に必要なinterval_daysが一部取得できなかった");
    }

    // ---- again/forgotは4択でも短い間隔のまま（モード別重み付けの対象外）----
    if (results.choicebadword?.interval_days === 1) {
      ok("again/forgot相当（4択の不正解）はモードによらず翌日(interval=1)に短縮される（重み付けの対象外）");
    } else {
      bad(`again/forgot相当のinterval_daysが想定外: ${results.choicebadword?.interval_days}（期待値1）`);
    }
  } finally {
    await browser.close();
    stopDevServer(dev);
    for (const bookId of createdBookIds) await cleanupBook(admin, bookId);
    const { data: leftoverAfter } = await admin
      .from("word_books")
      .select("id")
      .eq("user_id", srsId)
      .like("title", "TEST_MODE_WEIGHT_%");
    for (const b of leftoverAfter ?? []) await cleanupBook(admin, b.id);
    await admin.from("profiles").update({ srs_v2: originalSrsV2, is_premium: originalIsPremium }).eq("id", srsId);
    await admin.from("study_results").delete().eq("user_id", srsId).is("session_id", null);
    ok("テスト用単語帳・単語を削除し、srs_v2/is_premiumも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:srs-mode-weighting RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("srs-mode-weighting e2e crashed:", e);
  process.exit(1);
});
