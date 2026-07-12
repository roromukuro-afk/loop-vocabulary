/**
 * /tools ハブページの自律E2E検証（AdSense審査前監査 Phase 7）。
 *
 * 1. /tools が200で表示され、SSR本文・JSON-LDが出力されている
 * 2. 既存の生きている機能(語彙力診断・辞書・教材・小テストPDF)への内部リンクがある
 * 3. 各リンク先が実際に200で開ける(存在しないURLへのリンクがない)
 * 4. 準備中ツールは「準備中」ラベル付きで表示され、リンク化されていない
 * 5. sitemap.xmlに/toolsが含まれる
 *
 * 使い方: node scripts/testing/e2e/tools-hub.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    const res = await fetch(`${baseUrl}/tools`);
    if (res.status !== 200) {
      fail(`/tools が200で取得できない (status=${res.status})`);
      return;
    }
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    if (text.length > 500) ok(`/tools: SSR本文 ${text.length}字を確認`);
    else fail(`/tools: 本文が短すぎる (${text.length}字)`);

    if ((html.match(/application\/ld\+json/g) || []).length > 0) ok("/tools: JSON-LDを確認");
    else fail("/tools: JSON-LDが見つからない");

    if (/<link rel="canonical" href="[^"]*\/tools"/.test(html)) ok("/tools: canonicalが自己参照");
    else fail("/tools: canonicalが正しくない");

    const liveLinks = ["/vocab-check", "/dictionary", "/materials", "/guide/vocabulary-quiz-pdf-for-teachers"];
    for (const link of liveLinks) {
      if (html.includes(`href="${link}"`)) ok(`/tools: ${link} への導線がある`);
      else fail(`/tools: ${link} への導線が見つからない`);

      const linkRes = await fetch(`${baseUrl}${link}`);
      if (linkRes.status === 200) ok(`${link}: 実際に200で開ける`);
      else fail(`${link}: ${linkRes.status} (リンク切れの可能性)`);
    }

    if (/準備中/.test(html)) ok("/tools: 準備中ツールのラベルがある");
    else fail("/tools: 準備中ラベルが見つからない");

    // 準備中ツールが実在しないURL(/tools/exam-countdown-study-plan等)へリンクしていないことを確認
    const plannedUrls = ["/tools/exam-countdown-study-plan", "/tools/word-list-cleaner"];
    const leakedLinks = plannedUrls.filter((u) => html.includes(`href="${u}"`));
    if (leakedLinks.length === 0) ok("/tools: 未実装ページへの内部リンクが張られていない");
    else fail(`/tools: 未実装ページへリンクが張られている(クロールエラーの原因): ${leakedLinks.join(", ")}`);

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    // NEXT_PUBLIC_SITE_URL がローカル検証環境ではlocalhostになりうるため、
    // ドメイン部分は問わず「/tools」で終わる<loc>があるかで判定する。
    if (/<loc>[^<]*\/tools<\/loc>/.test(sitemapXml)) ok("sitemap.xmlに/toolsが含まれる");
    else fail("sitemap.xmlに/toolsが含まれていない");

    console.log(process.exitCode ? "\n=== test:tools-hub: FAILED ===" : "\n=== test:tools-hub RESULT: all checks passed ===");
  } finally {
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
