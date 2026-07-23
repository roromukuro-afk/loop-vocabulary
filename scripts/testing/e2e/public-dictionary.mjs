/**
 * 未ログインでの辞書検索 自律E2E検証
 *
 * トップページの「辞書だけ試す（登録不要）」の実挙動を検証する。
 * 未ログインで /dictionary を開いてもログインページへリダイレクトされず、
 * 実際に検索・結果表示ができ、単語帳への追加操作だけがログイン導線になることを確認する。
 *
 * 1. 未ログインで /dictionary が200で表示され、/loginへリダイレクトされない
 * 2. 「ログイン不要で英単語を検索できます」の案内が表示される
 * 3. 未ログインで検索フォームから実際に検索でき、結果に単語・意味が表示される
 * 4. 未ログインの検索結果には「単語帳に追加」ボタンは出ず、「無料登録で単語帳に追加」の
 *    ログイン導線リンクが出る
 * 5. /dictionaryがnoindexでない・canonicalが自己参照
 * 6. ログイン済みの既存フロー（onboarding-dictionary.mjs）に影響がないことは別テストで担保
 *
 * 使い方: node scripts/testing/e2e/public-dictionary.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();
  try {
    // 未ログイン状態のcontext(cookieなし)
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);

    const res = await page.goto(`${baseUrl}/dictionary`, { waitUntil: "load" });
    const url = page.url();
    if (!url.includes("/dictionary") || url.includes("/login")) {
      fail(`未ログインで/dictionaryを開くと ${url} にリダイレクトされた（登録不要のはずが実際にはログイン要求されている）`);
    } else if (res.status() >= 400) {
      fail(`/dictionary が ${res.status()} を返した`);
    } else {
      ok(`未ログインで/dictionaryが200で表示され、/loginへリダイレクトされない (${url})`);
    }
    await page.waitForLoadState("networkidle");

    const guideText = await page.locator("text=ログイン不要で英単語を検索できます").count();
    if (guideText === 0) fail("「ログイン不要で英単語を検索できます」の案内が表示されない");
    else ok("未ログイン向けの案内文が表示される");

    const searchInput = page.locator('[data-testid="dictionary-search-input"]');
    await searchInput.fill("persist");
    await page.locator('[data-testid="dictionary-search-submit"]').click();

    const hits = page.locator('[data-testid="dictionary-hit"]');
    let hitCount = 0;
    try {
      await hits.first().waitFor({ state: "visible", timeout: 8000 });
      hitCount = await hits.count();
    } catch {
      hitCount = 0;
    }
    if (hitCount === 0) {
      fail("未ログインで検索しても結果が1件も表示されない（material_wordsへの匿名読み取りがRLSでブロックされている可能性）");
    } else {
      ok(`未ログインの検索で${hitCount}件の結果が表示される`);
    }

    if (hitCount > 0) {
      const addToBookBtn = await hits.first().locator('[data-testid="add-to-wordbook"]').count();
      const loginCta = await hits.first().locator('a[href*="/signup"]').count();
      if (addToBookBtn > 0) {
        fail("未ログインなのに「単語帳に追加」ボタン（ログイン専用操作）が表示されている");
      } else if (loginCta === 0) {
        fail("未ログインの検索結果に無料登録への導線リンクが無い");
      } else {
        ok("未ログインの検索結果は「無料登録で単語帳に追加」の導線のみが表示される");
      }
    }

    // プレースホルダーが「日本語の意味で検索できる」ように見える表現になっていないか
    // （かつて "例: increase / 重要" となっており、重要のようなJP意味語での検索は
    // 常に0件になる。これがユーザーから「よくある英単語で検索しても出ない」と
    // 報告された実際の原因だった）。
    // 「英単語を入力」等の日本語の説明文自体は問題ないため、「例:」の後に続く
    // サンプル語だけを取り出して、日本語（ひらがな・カタカナ・漢字）が
    // 含まれていないかを確認する（英単語のサンプルのみであるべき）。
    const placeholder = await searchInput.getAttribute("placeholder");
    const exampleMatch = placeholder?.match(/例[:：]\s*([^)）]*)/);
    const exampleText = exampleMatch?.[1] ?? "";
    if (placeholder && /[ぁ-んァ-ヶ一-龠]/.test(exampleText)) {
      fail(`検索欄のプレースホルダーの検索例に日本語が含まれており、日本語で検索できるかのような誤解を招く可能性がある ("${placeholder}")`);
    } else {
      ok(`検索欄のプレースホルダーが英単語の例のみになっている ("${placeholder}")`);
    }

    // よくある英単語（"increase"）で確実に結果が出ることを確認
    await searchInput.fill("increase");
    await page.locator('[data-testid="dictionary-search-submit"]').click();
    let increaseHitCount = 0;
    try {
      await hits.first().waitFor({ state: "visible", timeout: 8000 });
      increaseHitCount = await hits.count();
    } catch {
      increaseHitCount = 0;
    }
    if (increaseHitCount === 0) {
      fail('よくある英単語"increase"で検索しても結果が1件も表示されない');
    } else {
      ok(`"increase"検索で${increaseHitCount}件の結果が表示される`);
    }

    // 日本語の意味語（"重要"）は仕様上0件になるが、その際に分かりやすい案内が出ることを確認
    // （英単語のつづり検索であることと、代替の検索例を示す）
    await searchInput.fill("重要");
    await page.locator('[data-testid="dictionary-search-submit"]').click();
    await page.waitForTimeout(1500);
    const jpHitCount = await hits.count();
    const emptyStateText = await page.locator("text=日本語の意味からの検索には対応していません").count();
    if (jpHitCount > 0) {
      ok(`"重要"（日本語）でも${jpHitCount}件ヒットした（意味検索に対応している場合はOK）`);
    } else if (emptyStateText > 0) {
      ok('"重要"（日本語）は仕様上0件だが、英単語での検索例を示す案内が表示される');
    } else {
      fail('"重要"（日本語）が0件のときに、検索方法を案内するメッセージが表示されない（ユーザーが「検索が壊れている」と誤解する原因になる）');
    }

    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    if (robotsMeta && robotsMeta.includes("noindex")) {
      fail(`/dictionary がnoindexになっている (${robotsMeta})`);
    } else {
      ok("/dictionary はnoindexになっていない");
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical !== `${baseUrl.replace(/:\d+$/, "")}/dictionary` && !canonical?.endsWith("/dictionary")) {
      fail(`/dictionary のcanonicalが自己参照でない (${canonical})`);
    } else {
      ok(`/dictionary のcanonicalが自己参照 (${canonical})`);
    }

    if (errors.length > 0) {
      fail(`操作中にconsole error/5xxが発生: ${errors.join(" | ")}`);
    } else {
      ok("操作中にconsole error/5xxなし");
    }

    await context.close();
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:public-dictionary: FAILED ===" : "\n=== test:public-dictionary RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
