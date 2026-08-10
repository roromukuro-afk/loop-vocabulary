/**
 * 語彙力チェック(/vocab-check, /vocab-check/eiken, /vocab-check/toeic)の
 * オーガニック発見性強化(growth/vocab-check-acquisition-foundation)の回帰テスト。
 *
 * 1. 3ページとも canonical が自己参照(自ページのURL)になっている
 * 2. 3ページとも BreadcrumbList JSON-LD が正しい階層・URLで出力されている
 * 3. 3ページとも noindex になっていない
 * 4. 3ページとも sitemap.xml に絶対URLで含まれている
 * 5. robots.txt で /vocab-check がブロックされていない
 * 6. 今回追加・変更したguide→vocab-check内部リンクのサンプルが、期待通りのhrefで
 *    実際にレンダリングされている(静的ルート・[slug]動的ルートの両方をサンプル)
 * 7. 3ページの結果画面それぞれから、他variant・辞書への導線が実在する
 * 8. 3ページとも vocab_check_page_viewed / vocab_check_started が正しい variant
 *    プロパティ付きで Growth OS (/api/analytics/events) へ実際に送信されている
 *
 * 使い方: node scripts/testing/e2e/vocab-check-acquisition-discoverability.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";

const VOCAB_CHECK_PAGES = [
  {
    path: "/vocab-check",
    breadcrumbNames: ["ホーム", "ツール一覧", "語彙力チェック"],
    variant: "general",
  },
  {
    path: "/vocab-check/eiken",
    breadcrumbNames: ["ホーム", "ツール一覧", "語彙力チェック", "英検語彙力チェック"],
    variant: "eiken",
  },
  {
    path: "/vocab-check/toeic",
    breadcrumbNames: ["ホーム", "ツール一覧", "語彙力チェック", "TOEICスコア語彙力チェック"],
    variant: "toeic",
  },
];

// guide→vocab-check内部リンクのサンプル(静的ルート・upgrade・[slug]動的ルートを横断)
const GUIDE_LINK_SAMPLES = [
  { path: "/guide/eiken-vocabulary-study", expectedHref: "/vocab-check/eiken", note: "新規追加・静的ルート" },
  { path: "/guide/toeic-tango", expectedHref: "/vocab-check/toeic", note: "既存リンクのvariant昇格・静的ルート" },
  { path: "/guide/eiken-conversation", expectedHref: "/vocab-check/eiken", note: "既存リンクのvariant昇格・静的ルート" },
  { path: "/guide/business-english-tango", expectedHref: "/vocab-check/toeic", note: "新規追加・静的ルート" },
  { path: "/guide/flashcards-vs-multiple-choice", expectedHref: "/vocab-check", note: "新規追加・一般variant" },
  { path: "/guide/eiken-2kyu-tango-nanko", expectedHref: "/vocab-check/eiken", note: "新規追加・[slug]動的ルート" },
  { path: "/guide/eitango-cho-hikaku", expectedHref: "/vocab-check", note: "新規追加・[slug]動的ルート・一般variant" },
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function completeQuiz(page) {
  // 正解/不正解を問わず20問クリックし切って結果画面へ到達させる(決定論性の確認が目的で、
  // スコア自体は検証対象ではない)。
  for (let i = 0; i < 20; i++) {
    const firstChoice = page.locator("ul li button").first();
    await firstChoice.click();
    await page.waitForTimeout(80);
    const nextButton = page.getByRole("button", { name: /次の問題|結果を見る/ });
    await nextButton.click();
    await page.waitForTimeout(80);
  }
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1〜4. canonical / BreadcrumbList / noindex ----
    for (const { path, breadcrumbNames } of VOCAB_CHECK_PAGES) {
      const res = await page.goto(`${baseUrl}${path}`, { waitUntil: "load" });
      if (!res || res.status() !== 200) {
        fail(`${path} のステータスが200ではない (${res?.status()})`);
        continue;
      }
      ok(`${path}: HTTP 200`);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
      const expectedCanonical = `${SITE_URL}${path}`;
      if (canonical === expectedCanonical) ok(`${path}: canonicalが自己参照 (${canonical})`);
      else fail(`${path}: canonical不一致 (期待値=${expectedCanonical}, 実際=${canonical})`);

      const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
      if (robotsMeta && /noindex/i.test(robotsMeta)) fail(`${path}: noindexが設定されている`);
      else ok(`${path}: noindexになっていない`);

      const ldJson = await page.evaluate(() => {
        const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
        return scripts.map((s) => { try { return JSON.parse(s.textContent || "null"); } catch { return null; } });
      });
      const breadcrumb = ldJson.find((d) => d && d["@type"] === "BreadcrumbList");
      if (!breadcrumb) {
        fail(`${path}: BreadcrumbList JSON-LDが出力されていない`);
      } else {
        const names = (breadcrumb.itemListElement || []).map((it) => it.name);
        const positions = (breadcrumb.itemListElement || []).map((it) => it.position);
        const isSequential = positions.every((p, i) => p === i + 1);
        const namesMatch = JSON.stringify(names) === JSON.stringify(breadcrumbNames);
        const lastItem = breadcrumb.itemListElement?.[breadcrumb.itemListElement.length - 1];
        if (namesMatch && isSequential && lastItem?.item === expectedCanonical) {
          ok(`${path}: BreadcrumbList JSON-LDが正しい (${names.join(" > ")})`);
        } else {
          fail(`${path}: BreadcrumbList不正 (names=${JSON.stringify(names)}, positions=${JSON.stringify(positions)}, lastItem=${lastItem?.item})`);
        }
      }
    }

    // ---- 4. sitemap.xml 収録確認 ----
    const sitemapRes = await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: "load" });
    const sitemapBody = await sitemapRes.text();
    const firstLoc = sitemapBody.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    const sitemapBase = firstLoc.replace(/\/$/, "");
    const missing = VOCAB_CHECK_PAGES.filter(({ path }) => !sitemapBody.includes(`${sitemapBase}${path}<`));
    if (missing.length === 0) ok("sitemap.xml に3ページとも絶対URLで含まれている");
    else fail(`sitemap.xml に含まれていないページがある: ${missing.map((m) => m.path).join(", ")}`);

    // ---- 5. robots.txt でブロックされていない ----
    // `User-agent: *` セクションのみを対象にする(GPTBot/ClaudeBot/Google-Extended等の
    // 個別ボット向けセクションは意図的に `Disallow: /` を持つため、ファイル全体を
    // 素朴にスキャンすると誤検知する)。
    const robotsRes = await page.goto(`${baseUrl}/robots.txt`, { waitUntil: "load" });
    const robotsBody = await robotsRes.text();
    const lines = robotsBody.split("\n").map((l) => l.trim());
    const wildcardStart = lines.findIndex((l) => l === "User-agent: *");
    const nextUserAgentOffset = lines.slice(wildcardStart + 1).findIndex((l) => /^User-agent:/.test(l));
    const wildcardEnd = nextUserAgentOffset === -1 ? lines.length : wildcardStart + 1 + nextUserAgentOffset;
    const wildcardSection = lines.slice(wildcardStart, wildcardEnd);
    const blockingRule = wildcardSection.find(
      (line) => /^Disallow:/.test(line) && line !== "Disallow:" && "/vocab-check".startsWith(line.replace(/^Disallow:\s*/, "").replace(/\*+$/, "")),
    );
    if (wildcardStart === -1) fail("robots.txtに `User-agent: *` セクションが見つからない");
    else if (!blockingRule) ok("robots.txtの `User-agent: *` セクションで/vocab-checkがブロックされていない");
    else fail(`robots.txtの \`User-agent: *\` セクションで/vocab-checkをブロックしうるルールがある: ${blockingRule}`);

    // ---- 6. guide内部リンクのサンプル確認 ----
    for (const { path, expectedHref, note } of GUIDE_LINK_SAMPLES) {
      await gotoReady(page, `${baseUrl}${path}`);
      const hasLink = await page.locator(`a[href="${expectedHref}"]`).count();
      if (hasLink > 0) ok(`${path} (${note}): ${expectedHref} へのリンクが存在する`);
      else fail(`${path} (${note}): ${expectedHref} へのリンクが見つからない`);
    }

    // ---- 7 & 8. 結果画面の相互導線 + Growth OS計測 ----
    for (const { path, variant } of VOCAB_CHECK_PAGES) {
      const analyticsPayloads = [];
      const onRequest = (req) => {
        if (req.url().includes("/api/analytics/events") && req.method() === "POST") {
          try {
            const body = JSON.parse(req.postData() || "[]");
            const arr = Array.isArray(body) ? body : [body];
            analyticsPayloads.push(...arr);
          } catch { /* noop */ }
        }
      };
      page.on("request", onRequest);

      await gotoReady(page, `${baseUrl}${path}`);
      await completeQuiz(page);
      await page.waitForTimeout(300);

      page.off("request", onRequest);

      const pageViewed = analyticsPayloads.find((p) => p.event_name === "vocab_check_page_viewed" && p.properties?.variant === variant);
      const started = analyticsPayloads.find((p) => p.event_name === "vocab_check_started" && p.properties?.variant === variant);
      const completed = analyticsPayloads.find((p) => p.event_name === "vocab_check_completed" && p.properties?.variant === variant);
      if (pageViewed) ok(`${path}: vocab_check_page_viewed (variant=${variant}) を送信`);
      else fail(`${path}: vocab_check_page_viewed (variant=${variant}) が送信されていない`);
      if (started) ok(`${path}: vocab_check_started (variant=${variant}) を送信`);
      else fail(`${path}: vocab_check_started (variant=${variant}) が送信されていない`);
      if (completed) ok(`${path}: vocab_check_completed (variant=${variant}) を送信`);
      else fail(`${path}: vocab_check_completed (variant=${variant}) が送信されていない`);

      // 結果画面の相互導線
      const expectedResultLinks = {
        general: ["/vocab-check/eiken", "/vocab-check/toeic", "/dictionary"],
        eiken: ["/vocab-check", "/vocab-check/toeic", "/dictionary"],
        toeic: ["/vocab-check", "/vocab-check/eiken", "/dictionary"],
      }[variant];
      for (const href of expectedResultLinks) {
        const count = await page.locator(`a[href="${href}"]`).count();
        if (count > 0) ok(`${path} 結果画面: ${href} への導線が存在する`);
        else fail(`${path} 結果画面: ${href} への導線が見つからない`);
      }
    }

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:vocab-check-acquisition-discoverability RESULT: FAILED ===");
  } else {
    console.log("\n=== test:vocab-check-acquisition-discoverability RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("vocab-check-acquisition-discoverability e2e crashed:", e);
  process.exit(1);
});
