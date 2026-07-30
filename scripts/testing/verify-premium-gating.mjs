/**
 * Premium判定バグ修正の回帰防止テスト。
 *
 * 2026-07-03、attackモードの単語帳スコープ対応の調査中に、複数箇所が存在しない
 * カラム profiles.plan を参照しており、実際のPremiumユーザーでも機能が使えない
 * バグを発見した（listeningページで先に見つかった同種バグと同じパターン）。
 * 修正対象は以下8箇所（全て profiles.is_premium を参照する形に統一）:
 *  - src/app/wordbooks/[id]/page.tsx（AiSuggestButtonのisPremium判定）
 *  - src/app/plan/page.tsx（AIパーソナル学習プラン）
 *  - src/app/extract/page.tsx（英文からの単語自動抽出）
 *  - src/app/weak/page.tsx（苦手単語のAI弱点分析）
 *  - src/app/api/ai/weakness-analysis/route.ts
 *  - src/app/api/ai/extract-words/route.ts
 *  - src/app/api/wordbook/[id]/ai-suggest/route.ts
 *  - src/app/api/wordbook/[id]/ai-suggest/add/route.ts（premium判定のみ、add自体は未検証）
 *
 * test+onboardingアカウントのis_premiumを一時的にtrue/falseへ切り替え、各ページの
 * 表示分岐とAPIのステータスコード分岐（403 vs 非403）を検証する。実際のAnthropic
 * API呼び出しが成功するかどうかは検証しない（premium判定を通過したかのみを見る）。
 *
 * 2026-07-29追記: /api/wordbook/[id]/ai-suggestのPremium状態チェックは、
 * 403にならないことに加え、このテストプロセス自身のANTHROPIC_API_KEYの有無
 * (=子プロセスとして起動するdevサーバーが継承する値と同じ)に応じて期待値を
 * 出し分ける: キーが設定されている環境(ローカルの.env.local等)ではstatus
 * !== 503(クライアント生成が正しく完了し実際の呼び出しに進む)を、キーが
 * 未設定の環境(premium-gating-canary.ymlは意図的にこのsecretを注入しない)
 * ではstatus === 503(グレースフルに503を返し、import時にSDKが例外を投げて
 * ルートの読み込み自体が失敗する旧不具合が再発していないこと)を検証する。
 *
 * このルートは以前モジュールスコープでAnthropicクライアントを生成しており、
 * ANTHROPIC_API_KEY未設定環境ではimport自体が失敗する不具合があった
 * (chatgpt-codex-connectorのP1指摘、修正はクライアント生成をキー確認後まで
 * 遅延)。2026-07-29の初回追記時、この期待値の出し分けを行わず単純に
 * status !== 503のみを検証したため、ANTHROPIC_API_KEYを意図的に注入しない
 * premium-gating-canary.yml上で(修正が正しく機能した結果としての)503を
 * false failureとして報告してしまっていた(実行履歴:
 * https://github.com/roromukuro-afk/loop-vocabulary/actions/runs/30504159174)。
 * キーの有無に応じた期待値の出し分けに修正し、どちらの環境でも意味のある
 * 検証になるようにした。
 *
 * さらに、chatgpt-codex-connectorのP2指摘への対応として、この期待値の出し分けは
 * `dev.startedByUs===true`(このテストプロセス自身がdevサーバーを起動した)場合のみ
 * 行う。ensureDevServer()は既に起動済みの別サーバーを再利用できる仕様であり
 * (`startedByUs===false`)、その場合サーバーが実際にどの環境変数で起動したかは
 * このプロセスのprocess.envから断定できない(.env.local変更後の再利用・別セッションが
 * 起動したサーバー等)。再利用時は500(未処理例外)でないことのみを確認し、
 * 503/非503の厳密な判定はスキップする。
 *
 * 使い方: node scripts/testing/verify-premium-gating.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { ensureDevServer, stopDevServer } from "./lib/devServer.mjs";
import { TEST_ACCOUNTS } from "./lib/testAccounts.mjs";
import { resetOnboardingUser, resolveUserId } from "./seed-test-data.mjs";
import { login, collectErrors } from "./e2e/lib/login.mjs";
import { gotoReady } from "./e2e/lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function setPremium(admin, userId, value) {
  await admin.from("profiles").update({ is_premium: value }).eq("id", userId);
}

async function main() {
  loadEnv();
  requireEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    TEST_ACCOUNTS.onboarding.passwordEnvKey,
  ]);
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, TEST_ACCOUNTS.onboarding.email);
  const email = TEST_ACCOUNTS.onboarding.email;
  const password = process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey];

  await resetOnboardingUser(admin, userId);
  const { data: originalProfile } = await admin.from("profiles").select("is_premium").eq("id", userId).maybeSingle();
  const originalIsPremium = originalProfile?.is_premium ?? false;

  // ai-suggest API検証用の単語帳を1件用意
  const { data: book, error: bookErr } = await admin
    .from("word_books")
    .insert({ user_id: userId, title: "TEST_Premium判定確認", source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !book) throw new Error(`テスト用単語帳の作成に失敗: ${bookErr?.message}`);
  await admin.from("words").insert([
    { user_id: userId, word_book_id: book.id, word: "premiumtestword1", meaning: "テスト単語1", pos: "noun" },
    { user_id: userId, word_book_id: book.id, word: "premiumtestword2", meaning: "テスト単語2", pos: "noun" },
  ]);

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await login(page, baseUrl, email, password);
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // ================= 非Premium状態 =================
    console.log("\n--- 非Premium状態 ---");
    await setPremium(admin, userId, false);

    {
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/wordbooks/${book.id}`);
      const lockedVisible = await page.locator('[data-testid="ai-suggest-locked"]').isVisible().catch(() => false);
      const unlockedVisible = await page.locator('[data-testid="ai-suggest-button"]').isVisible().catch(() => false);
      if (lockedVisible && !unlockedVisible) ok("/wordbooks/[id]: 非Premiumではロック表示（アップグレード誘導）になる");
      else bad(`/wordbooks/[id]: 非Premium時の表示が想定外 (locked=${lockedVisible}, unlocked=${unlockedVisible})`);
      if (errors.length) bad(`/wordbooks/[id]操作中にエラー:\n  ${errors.join("\n  ")}`);
    }
    {
      await gotoReady(page, `${baseUrl}/plan`);
      const text = await page.locator("body").innerText();
      if (text.includes("月額 ¥480〜 プレミアムを見る →")) ok("/plan: 非Premiumではプレミアム誘導が表示される");
      else bad("/plan: 非Premium時にプレミアム誘導が表示されない");
    }
    {
      await gotoReady(page, `${baseUrl}/extract`);
      const text = await page.locator("body").innerText();
      const textareaCount = await page.locator("textarea").count();
      if (text.includes("月額 ¥480〜 プレミアムを見る →") && textareaCount === 0) ok("/extract: 非Premiumでは抽出フォームが表示されずプレミアム誘導になる");
      else bad(`/extract: 非Premium時の表示が想定外 (誘導文言=${text.includes("月額 ¥480〜 プレミアムを見る →")}, textarea数=${textareaCount})`);
    }
    {
      await gotoReady(page, `${baseUrl}/weak`);
      const text = await page.locator("body").innerText();
      if (text.includes("月額 ¥480〜 プレミアムを見る →")) ok("/weak: 非PremiumではAI弱点分析がプレミアム誘導表示になる");
      else bad("/weak: 非Premium時にAI弱点分析のプレミアム誘導が表示されない");
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/weakness-analysis`, { method: "POST", headers: { Cookie: cookieHeader } });
      if (res.status === 403) ok(`/api/ai/weakness-analysis: 非Premiumでは403になる`);
      else bad(`/api/ai/weakness-analysis: 非Premium時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/extract-words`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "This is a sample sentence for testing." }),
      });
      if (res.status === 403) ok(`/api/ai/extract-words: 非Premiumでは403になる`);
      else bad(`/api/ai/extract-words: 非Premium時のステータスが想定外 (${res.status})`);
    }
    {
      const res = await fetch(`${baseUrl}/api/wordbook/${book.id}/ai-suggest`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });
      if (res.status === 403) ok(`/api/wordbook/[id]/ai-suggest: 非Premiumでは403になる`);
      else bad(`/api/wordbook/[id]/ai-suggest: 非Premium時のステータスが想定外 (${res.status})`);
    }
    {
      // 2026-07-06、study-planはサーバー側にPremium判定が一切なくUI経由を回避すれば
      // 非Premiumでも無制限にClaude APIを呼べていた穴を修正。回帰防止のため検証を追加。
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "2027-01-01", currentLevel: "中級", dailyMinutes: 30 }),
      });
      if (res.status === 403) ok(`/api/ai/study-plan: 非Premiumでは403になる（修正前は誰でも呼べていた）`);
      else bad(`/api/ai/study-plan: 非Premium時のステータスが想定外 (${res.status})`);
    }

    // ================= Premium状態 =================
    console.log("\n--- Premium状態 ---");
    await setPremium(admin, userId, true);

    {
      const errors = collectErrors(page);
      await gotoReady(page, `${baseUrl}/wordbooks/${book.id}`);
      const unlockedVisible = await page.locator('[data-testid="ai-suggest-button"]').isVisible().catch(() => false);
      const lockedVisible = await page.locator('[data-testid="ai-suggest-locked"]').isVisible().catch(() => false);
      if (unlockedVisible && !lockedVisible) ok("/wordbooks/[id]: Premiumでは「AIが関連単語を提案」ボタンが表示される（修正前は常にロック表示だった）");
      else bad(`/wordbooks/[id]: Premium時の表示が想定外 (locked=${lockedVisible}, unlocked=${unlockedVisible})`);
      if (errors.length) bad(`/wordbooks/[id]操作中にエラー:\n  ${errors.join("\n  ")}`);
    }
    {
      await gotoReady(page, `${baseUrl}/plan`);
      const selectCount = await page.locator("select").count();
      const text = await page.locator("body").innerText();
      if (selectCount > 0 && !text.includes("月額 ¥480〜 プレミアムを見る →")) ok("/plan: Premiumでは学習プラン作成フォームが表示される");
      else bad(`/plan: Premium時の表示が想定外 (select数=${selectCount})`);
    }
    {
      await gotoReady(page, `${baseUrl}/extract`);
      const textareaCount = await page.locator("textarea").count();
      if (textareaCount > 0) ok("/extract: Premiumでは抽出フォームが表示される（修正前は常にロック表示だった）");
      else bad("/extract: Premium時に抽出フォームが表示されない");
    }
    {
      await gotoReady(page, `${baseUrl}/weak`);
      const text = await page.locator("body").innerText();
      if (text.includes("AI弱点分析を実行")) ok("/weak: PremiumではAI弱点分析の実行ボタンが表示される（修正前は常にロック表示だった）");
      else bad("/weak: Premium時にAI弱点分析の実行ボタンが表示されない");
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/weakness-analysis`, { method: "POST", headers: { Cookie: cookieHeader } });
      if (res.status !== 403) ok(`/api/ai/weakness-analysis: Premiumではpremium判定を通過する (status=${res.status})`);
      else bad(`/api/ai/weakness-analysis: Premium時も403のまま（修正が効いていない）`);
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/extract-words`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "This is a sample sentence for testing." }),
      });
      if (res.status !== 403) ok(`/api/ai/extract-words: Premiumではpremium判定を通過する (status=${res.status})`);
      else bad(`/api/ai/extract-words: Premium時も403のまま（修正が効いていない）`);
    }
    {
      const res = await fetch(`${baseUrl}/api/wordbook/${book.id}/ai-suggest`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 }),
      });
      if (res.status !== 403) ok(`/api/wordbook/[id]/ai-suggest: Premiumではpremium判定を通過する (status=${res.status})`);
      else bad(`/api/wordbook/[id]/ai-suggest: Premium時も403のまま（修正が効いていない）`);

      // dev.startedByUs===falseの場合、このテストプロセスは既に起動済みの別サーバーを
      // 再利用しているため(ensureDevServer()の仕様上サポートされている挙動)、その
      // サーバーが実際にどの環境変数で起動したかはこのプロセスのprocess.envからは
      // 分からない(.env.local変更後の再利用・別セッションが起動したサーバー等)。
      // このプロセス自身のANTHROPIC_API_KEYの有無から期待値を断定できるのは、
      // このプロセス自身がサーバーを起動した場合(startedByUs===true)のみ。
      if (dev.startedByUs) {
        const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
        if (hasAnthropicKey) {
          if (res.status !== 503) ok(`/api/wordbook/[id]/ai-suggest: ANTHROPIC_API_KEY設定済み環境ではAnthropicクライアントの遅延生成が正しく機能し503にならない (status=${res.status})`);
          else bad(`/api/wordbook/[id]/ai-suggest: ANTHROPIC_API_KEY設定済みのはずなのに503が返った。クライアント生成順序の回帰を疑うこと`);
        } else {
          if (res.status === 503) ok(`/api/wordbook/[id]/ai-suggest: ANTHROPIC_API_KEY未設定環境では503を返す(モジュール読み込み自体は失敗しない) (status=${res.status})`);
          else bad(`/api/wordbook/[id]/ai-suggest: ANTHROPIC_API_KEY未設定なのに503以外(${res.status})が返った。想定外の経路`);
        }
      } else if (res.status === 500) {
        bad(`/api/wordbook/[id]/ai-suggest: 既存サーバーを再利用しておりANTHROPIC_API_KEYの有無は確認できないが、500(未処理例外)は常に失敗として扱う (status=${res.status})`);
      } else {
        ok(`/api/wordbook/[id]/ai-suggest: 既存サーバーを再利用しているため(startedByUs=false)、ANTHROPIC_API_KEYの有無に依存する厳密な期待値検証はスキップ(status=${res.status}、500ではないことのみ確認)`);
      }
    }
    {
      const res = await fetch(`${baseUrl}/api/ai/study-plan`, {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ exam: "英検2級", targetDate: "2027-01-01", currentLevel: "中級", dailyMinutes: 30 }),
      });
      if (res.status !== 403) ok(`/api/ai/study-plan: Premiumではpremium判定を通過する (status=${res.status})`);
      else bad(`/api/ai/study-plan: Premium時も403のまま（修正が効いていない）`);
    }

    // ================= 回帰確認: choice/input/typing/listening/attack =================
    console.log("\n--- 回帰確認: /test/choice・/test/input・/test/typing・/test/listening・/test/attack ---");
    const errorsReg = collectErrors(page);
    for (const path of ["/test/choice", "/test/input", "/test/typing", "/test/listening", "/test/attack"]) {
      await gotoReady(page, `${baseUrl}${path}`);
      if (page.url().includes(path) || page.url().includes("/wordbooks")) ok(`${path} に回帰なし`);
      else bad(`${path}への遷移に失敗: ${page.url()}`);
    }
    if (errorsReg.length) bad(`回帰確認中にエラー:\n  ${errorsReg.join("\n  ")}`);
    else ok("回帰確認中に console error / 5xx なし");

    await page.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
    await admin.from("words").delete().eq("word_book_id", book.id);
    await admin.from("word_books").delete().eq("id", book.id);
    await admin.from("profiles").update({ is_premium: originalIsPremium }).eq("id", userId);
    ok("テスト用単語帳・単語を削除し、is_premiumも元に戻してクリーンな状態に戻した（冪等性確保）");
  }

  console.log(`\n=== test:premium-gating RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("premium-gating verification crashed:", e);
  process.exit(1);
});
