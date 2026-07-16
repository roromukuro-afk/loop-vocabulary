/**
 * noindex HTMLページがrobots.txtでブロックされていないことの自律検証(HTTPのみ)。
 *
 * 背景(2026-07-15): /beta・/premium/success・/offline はHTMLに
 * `<meta name="robots" content="noindex, follow">` を持つにもかかわらず、
 * robots.txtのDisallowにも列挙されており、GooglebotがHTMLを読めず
 * 「インデックス登録済み(robots.txtにより除外されましたが)」という
 * Search Console警告の原因になっていた。Disallowを解除し、Googlebotが
 * クロールしてnoindexを直接読める状態にした。
 *
 * 検証項目:
 * 1. noindex対象3ページがrobots.txtでDisallowされていない(クロール可能)
 * 2. 3ページとも実際にnoindex metaタグを持つ(クロールしても最終的に非インデックスになる)
 * 3. 3ページともsitemap.xmlに含まれていない
 * 4. /api/・/admin・/dashboard等、本当に非HTML/認証必須のルートは引き続きDisallowのまま
 * 5. /auth/callback(HTML非生成のroute handler)はDisallow: /auth/の対象のまま(意図どおり)
 *
 * 使い方: node scripts/testing/e2e/noindex-crawlability.mjs
 */
import { loadEnv } from "../lib/env.mjs";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

const NOINDEX_PAGES_SHOULD_BE_CRAWLABLE = ["/beta", "/premium/success", "/offline"];
const MUST_STAY_DISALLOWED = ["/api/", "/admin", "/dashboard", "/review", "/wordbooks", "/settings", "/auth/"];

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function isDisallowed(robotsTxt, path) {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  return lines.some((l) => {
    const m = l.match(/^Disallow:\s*(\S+)/i);
    if (!m) return false;
    const rule = m[1];
    return path === rule || path.startsWith(rule);
  });
}

async function main() {
  loadEnv();
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    const robotsTxt = await (await fetch(`${baseUrl}/robots.txt`)).text();
    const sitemapXml = await (await fetch(`${baseUrl}/sitemap.xml`)).text();

    for (const path of NOINDEX_PAGES_SHOULD_BE_CRAWLABLE) {
      if (isDisallowed(robotsTxt, path)) bad(`${path} が依然robots.txtでDisallowされている`);
      else ok(`${path} はrobots.txtでDisallowされていない(クロール可能)`);

      const res = await fetch(`${baseUrl}${path}`);
      const html = await res.text();
      if (res.status !== 200) { bad(`${path} が200で取得できない (status=${res.status})`); continue; }
      if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) {
        ok(`${path} にnoindex metaタグがある(クロール可能かつ非インデックス化される)`);
      } else {
        bad(`${path} にnoindex metaタグが見つからない`);
      }

      if (sitemapXml.includes(path)) bad(`${path} がsitemap.xmlに含まれてしまっている`);
      else ok(`${path} はsitemap.xmlに含まれていない`);
    }

    for (const path of MUST_STAY_DISALLOWED) {
      if (isDisallowed(robotsTxt, path)) ok(`${path} は引き続きrobots.txtでDisallowされている(意図どおり)`);
      else bad(`${path} がrobots.txtから誤って除外されてしまった(認証必須ページの意図しない開放)`);
    }

    // /auth/callbackはHTML/noindexを生成しないroute handlerであり、
    // 意図的にDisallow: /auth/の対象のまま(実装確認: src/app/auth/callback/route.ts)
    const authCallback = await fetch(`${baseUrl}/auth/callback`, { redirect: "manual" });
    if (authCallback.status === 307 || authCallback.status === 302) {
      ok("/auth/callback はHTML非生成のredirect-onlyルートであることを確認(noindex対象ではない)");
    } else {
      bad(`/auth/callback の挙動が想定外 (status=${authCallback.status})、Disallow解除の要否を再検討する必要がある`);
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(fail ? `\n=== test:noindex-crawlability: ${fail}件失敗 (${pass}件成功) ===` : `\n=== test:noindex-crawlability RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
