/**
 * /tools ハブページの自律E2E検証（AdSense審査前監査 Phase 7）。
 *
 * 1. /tools が200で表示され、SSR本文・JSON-LDが出力されている
 * 2. 既存の生きている機能(語彙力診断・辞書・教材・小テストPDF)への内部リンクがある
 * 3. 各リンク先が実際に200で開ける(存在しないURLへのリンクがない)
 * 4. 準備中ツールは「準備中」ラベル付きで表示され、リンク化されていない
 * 5. sitemap.xmlに/toolsが含まれる
 * 6. 「選び方」比較表のリンクもToolCardLink経由でtool_viewイベントを発火する
 *
 * 使い方: node scripts/testing/e2e/tools-hub.mjs
 */
import { chromium } from "playwright";
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

    // AdSense是正(Issue #127): 薄いハブページ判定への対応として、各ツールの対象者・
    // 利用例と「選び方」比較表を追加した。強化前は約1150字だったため、大幅増加を
    // 実質的な閾値(2000字)で確認する。
    if (text.length > 2000) ok(`/tools: SSR本文 ${text.length}字を確認(対象者・利用例・選び方表を含め強化済み)`);
    else fail(`/tools: 本文が強化前の薄い状態のまま (${text.length}字、2000字超が必要)`);

    if (text.includes("ツールの選び方")) ok("/tools: 「ツールの選び方」比較表セクションがある");
    else fail("/tools: 「ツールの選び方」比較表セクションが見つからない");

    // Codex指摘: 部分文字列の存在チェックだけでは「どこか1箇所にあれば良い」判定になり、
    // 8枚中1枚から対象者/利用例が抜けても検知できない。LIVE_TOOLSは8件固定のため、
    // 出現回数がちょうど8であることを数えて全カード分揃っていることを確認する。
    const audienceCount = (text.match(/対象:/g) || []).length;
    const useCaseCount = (text.match(/例:/g) || []).length;
    if (audienceCount === 8) ok(`/tools: 対象者の説明(「対象:」)が8枚全カード分ある`);
    else fail(`/tools: 対象者の説明(「対象:」)が8件ではない(実際: ${audienceCount}件、1枚以上で抜けている可能性)`);
    if (useCaseCount === 8) ok(`/tools: 利用例の説明(「例:」)が8枚全カード分ある`);
    else fail(`/tools: 利用例の説明(「例:」)が8件ではない(実際: ${useCaseCount}件、1枚以上で抜けている可能性)`);

    if ((html.match(/application\/ld\+json/g) || []).length > 0) ok("/tools: JSON-LDを確認");
    else fail("/tools: JSON-LDが見つからない");

    if (/<link rel="canonical" href="[^"]*\/tools"/.test(html)) ok("/tools: canonicalが自己参照");
    else fail("/tools: canonicalが正しくない");

    const liveLinks = [
      "/vocab-check",
      "/dictionary",
      "/materials",
      "/guide/vocabulary-quiz-pdf-for-teachers",
      "/tools/word-list-cleaner",
    ];
    for (const link of liveLinks) {
      if (html.includes(`href="${link}"`)) ok(`/tools: ${link} への導線がある`);
      else fail(`/tools: ${link} への導線が見つからない`);

      const linkRes = await fetch(`${baseUrl}${link}`);
      if (linkRes.status === 200) ok(`${link}: 実際に200で開ける`);
      else fail(`${link}: ${linkRes.status} (リンク切れの可能性)`);
    }

    // 「準備中」ラベルは、実際に未実装のツールがPLANNED_TOOLSにある間だけ表示される
    // 設計(0件ならセクションごと非表示)。現時点(word-list-cleaner実装後)は
    // PLANNED_TOOLSが空のため、ラベルが無いことの方が正しい状態 — 存在してもしなくても
    // 失敗にはしない情報ログのみとし、次に何か「準備中」ツールが追加された時点で
    // 再びラベルが現れることを妨げない。
    if (/準備中/.test(html)) console.log("(info) /tools: 準備中ツールのラベルが表示されている(PLANNED_TOOLSが1件以上ある状態)");
    else console.log("(info) /tools: 準備中ツールのラベルは無い(PLANNED_TOOLSが0件の状態、現在は正しい)");

    // 未実装のツールが実在しないURL(/tools/exam-countdown-study-plan等)へリンクして
    // いないことを確認(exam-countdown-planner/word-list-cleanerは両方とも実装済み・
    // 正しいURLで上のliveLinksに含まれているため、ここでは架空のURLのみを対象にする)。
    const plannedUrls = ["/tools/exam-countdown-study-plan"];
    const leakedLinks = plannedUrls.filter((u) => html.includes(`href="${u}"`));
    if (leakedLinks.length === 0) ok("/tools: 未実装ページへの内部リンクが張られていない");
    else fail(`/tools: 未実装ページへリンクが張られている(クロールエラーの原因): ${leakedLinks.join(", ")}`);

    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    // NEXT_PUBLIC_SITE_URL がローカル検証環境ではlocalhostになりうるため、
    // ドメイン部分は問わず「/tools」で終わる<loc>があるかで判定する。
    if (/<loc>[^<]*\/tools<\/loc>/.test(sitemapXml)) ok("sitemap.xmlに/toolsが含まれる");
    else fail("sitemap.xmlに/toolsが含まれていない");

    // Codex指摘: 「選び方」比較表のリンクが素の<Link>のままだと、ここ経由の遷移が
    // tool_view(tool_key付き)を発火せずcomputeContentPerformanceの集計から漏れる。
    // ToolCardLink化した後、実際にクリックしてイベントが送られることをブラウザで確認する。
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const captured = [];
      await page.route("**/api/analytics/events", async (route) => {
        try {
          const body = route.request().postDataJSON();
          captured.push(...(Array.isArray(body) ? body : [body]));
        } catch {
          /* ignore malformed body */
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accepted: 1 }) });
      });
      await page.goto(`${baseUrl}/tools`, { waitUntil: "networkidle" });

      const chooserLink = page.locator('table a[href="/vocab-check"], table [href="/vocab-check"]').first();
      await chooserLink.click();
      await page.waitForTimeout(500);

      const toolViewFromChooser = captured.find((e) => e.event_name === "tool_view" && e.properties?.tool_key === "vocab-check");
      if (toolViewFromChooser) ok("/tools: 「選び方」比較表のリンククリックでtool_view(tool_key=vocab-check)が送信される");
      else fail(`/tools: 「選び方」比較表のリンククリックでtool_viewが送信されない(捕捉イベント: ${JSON.stringify(captured)})`);
    } finally {
      await browser.close();
    }

    console.log(process.exitCode ? "\n=== test:tools-hub: FAILED ===" : "\n=== test:tools-hub RESULT: all checks passed ===");
  } finally {
    stopDevServer(dev);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
