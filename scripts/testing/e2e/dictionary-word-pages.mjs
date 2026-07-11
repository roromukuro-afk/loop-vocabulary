/**
 * /dictionary/[word] 公開単語詳細ページ 自律E2E検証
 *
 * 1. 未ログインで単語ページが200で表示され、SSR本文（例文・ニュアンス・覚え方・語源）が出る
 * 2. canonicalが自己参照
 * 3. Article・BreadcrumbList・DefinedTermのJSON-LDが出力される
 * 4. index対象語はnoindexになっていない
 * 5. 未ログインでは「単語帳に追加」ボタンではなく無料登録導線が出る
 * 6. ログイン済みでは実際に単語帳へ追加できる
 * 7. 公開語数が50〜100語の上限内（大量生成防止のガード）
 * 8. 存在しない単語スラッグは404になる
 * 9. sitemap.xmlにindex対象語のみが含まれる
 * 10. /dictionaryから各単語ページへの内部リンクがある
 *
 * 使い方: node scripts/testing/e2e/dictionary-word-pages.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { TEST_ACCOUNTS } from "../lib/testAccounts.mjs";
import { login, collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";
import { PILOT_WORDS, PILOT_WORD_SLUGS } from "../../../src/lib/dictionaryWords/pilotWords.ts";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", TEST_ACCOUNTS.onboarding.passwordEnvKey]);

  // 大量生成防止のガード: 公開語数が50〜100語の上限内であること
  if (PILOT_WORD_SLUGS.length > 100) {
    fail(`公開単語数が${PILOT_WORD_SLUGS.length}語あり、100語の上限を超えている（大量生成の懸念）`);
  } else {
    ok(`公開単語数は${PILOT_WORD_SLUGS.length}語（50〜100語の上限内）`);
  }

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  const browser = await chromium.launch();

  try {
    // ---------- 1. 未ログイン: 単語ページの表示・構造確認 ----------
    const targetWord = PILOT_WORDS.find((w) => w.slug === "analyze") ?? PILOT_WORDS[0];
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = collectErrors(page);

    const res = await page.goto(`${baseUrl}/dictionary/${targetWord.slug}`, { waitUntil: "load" });
    if (res.status() !== 200) fail(`/dictionary/${targetWord.slug} が ${res.status()} を返した`);
    else ok(`/dictionary/${targetWord.slug} が未ログインで200表示される`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    const requiredSnippets = [targetWord.word, targetWord.exampleEn, targetWord.nuance.slice(0, 15), targetWord.mnemonic.slice(0, 15), targetWord.etymology.slice(0, 15)];
    const missing = requiredSnippets.filter((s) => !bodyText.includes(s));
    if (missing.length > 0) {
      fail(`単語ページの本文に想定コンテンツが含まれない: ${missing.join(" / ")}`);
    } else {
      ok("単語ページに例文・ニュアンス・覚え方・語源のSSR本文が出ている");
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical !== `https://loop-vocabulary.app/dictionary/${targetWord.slug}`) {
      fail(`canonicalが自己参照でない (${canonical})`);
    } else {
      ok(`canonicalが自己参照 (${canonical})`);
    }

    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    if (targetWord.isIndexEligible && robotsMeta?.includes("noindex")) {
      fail(`index対象語のはずがnoindexになっている (${robotsMeta})`);
    } else {
      ok("index対象語はnoindexになっていない");
    }

    const jsonLdTypes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((el) => { try { return JSON.parse(el.textContent || "{}")["@type"]; } catch { return null; } })
    );
    for (const t of ["BreadcrumbList", "Article", "DefinedTerm"]) {
      if (!jsonLdTypes.includes(t)) fail(`JSON-LDに${t}が出力されていない`);
      else ok(`JSON-LDに${t}が出力されている`);
    }

    // ---------- 2. 未ログイン: 単語帳追加はログイン導線のみ ----------
    const signupCta = await page.locator('[data-testid="word-page-signup-cta"]').count();
    const addBtn = await page.locator('[data-testid="word-page-add-button"]').count();
    if (addBtn > 0) {
      fail("未ログインなのに単語帳追加ボタンが表示されている");
    } else if (signupCta === 0) {
      fail("未ログインの単語ページに無料登録導線が無い");
    } else {
      ok("未ログインでは無料登録導線のみが表示される");
    }

    if (errors.length > 0) fail(`未ログイン操作中にconsole error/5xxが発生: ${errors.join(" | ")}`);
    else ok("未ログイン操作中にconsole error/5xxなし");
    await context.close();

    // ---------- 3. 存在しない単語は404 ----------
    // 意図的に404を発生させる検証のため、上のクリーンなエラー計測とは別コンテキストで行う
    // (404ページ自体の"Failed to load resource: 404"というブラウザ生成のconsoleログが
    //  誤って「未ログイン操作中のエラー」判定に混入するのを防ぐ)
    const notFoundContext = await browser.newContext();
    const notFoundPage = await notFoundContext.newPage();
    const notFoundRes = await notFoundPage.goto(`${baseUrl}/dictionary/thiswordxyznotexist`, { waitUntil: "load" });
    if (notFoundRes.status() !== 404) fail(`存在しない単語で ${notFoundRes.status()} が返った(404を期待)`);
    else ok("存在しない単語スラッグは404になる");
    await notFoundContext.close();

    // ---------- 4. /dictionary からの内部リンク確認 ----------
    const dictContext = await browser.newContext();
    const dictPage = await dictContext.newPage();
    await gotoReady(dictPage, `${baseUrl}/dictionary`);
    const popularLinks = await dictPage.locator('[data-testid="dictionary-popular-words"] a').count();
    if (popularLinks === 0) fail("/dictionaryに単語ページへの内部リンクが無い");
    else ok(`/dictionaryから単語ページへの内部リンクが${popularLinks}件ある`);
    await dictContext.close();

    // ---------- 5. sitemap確認 ----------
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const indexEligibleWords = PILOT_WORDS.filter((w) => w.isIndexEligible);
    const notInSitemap = indexEligibleWords.filter((w) => !sitemapXml.includes(`/dictionary/${w.slug}`));
    if (notInSitemap.length > 0) {
      fail(`sitemap.xmlにindex対象語が含まれていない: ${notInSitemap.map((w) => w.slug).join(", ")}`);
    } else {
      ok("sitemap.xmlにindex対象の単語ページがすべて含まれている");
    }
    const noindexWords = PILOT_WORDS.filter((w) => !w.isIndexEligible);
    const wronglyInSitemap = noindexWords.filter((w) => sitemapXml.includes(`/dictionary/${w.slug}`));
    if (wronglyInSitemap.length > 0) {
      fail(`sitemap.xmlにnoindex対象語が含まれている: ${wronglyInSitemap.map((w) => w.slug).join(", ")}`);
    } else {
      ok("sitemap.xmlにnoindex対象語は含まれていない");
    }

    // ---------- 6. ログイン済み: 実際に単語帳へ追加できる ----------
    const authContext = await browser.newContext();
    const authPage = await authContext.newPage();
    const authErrors = collectErrors(authPage);
    await login(authPage, baseUrl, TEST_ACCOUNTS.onboarding.email, process.env[TEST_ACCOUNTS.onboarding.passwordEnvKey]);
    await gotoReady(authPage, `${baseUrl}/dictionary/${targetWord.slug}`);

    const addButton = authPage.locator('[data-testid="word-page-add-button"]');
    if (await addButton.count() === 0) {
      fail("ログイン済みなのに単語帳追加ボタンが表示されない");
    } else {
      await addButton.click();
      const added = authPage.locator('[data-testid="word-page-added"]');
      try {
        await added.waitFor({ state: "visible", timeout: 8000 });
        ok("ログイン済みで実際に単語帳へ追加できる");
      } catch {
        fail("単語帳への追加後、成功表示が出なかった");
      }
    }
    if (authErrors.length > 0) fail(`ログイン済みでの操作中にconsole error/5xx: ${authErrors.join(" | ")}`);
    else ok("ログイン済みでの操作中にconsole error/5xxなし");
    await authContext.close();
  } finally {
    await browser.close();
    stopDevServer(dev.proc);
  }

  console.log(process.exitCode ? "\n=== test:dictionary-word-pages: FAILED ===" : "\n=== test:dictionary-word-pages RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
