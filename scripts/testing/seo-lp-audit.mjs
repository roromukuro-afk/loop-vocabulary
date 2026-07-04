/**
 * カテゴリLP（/materials/toeic・/materials/business）のSEO導線監査（HTTPのみ・ブラウザ不要）
 *
 * 1. /sitemap.xml に /materials/toeic・/materials/business・/materials・/dictionary・
 *    /guide・/grammar・/faq が含まれているか
 * 2. /robots.txt が上記パスをブロックしていないか
 * 3. /materials/toeic・/materials/business のcanonicalタグが自分自身のURLを指しているか
 *    （/materials/[id]と競合していないか）
 * 4. 両LPのJSON-LD（BreadcrumbList・ItemList）がそれぞれ1個ずつ・妥当なJSONとして
 *    パースできるか
 * 5. /materials/[id]（既存の動的教材詳細ページ）が引き続き200で表示されるか
 *
 * 使い方: node scripts/testing/seo-lp-audit.mjs [https://loop-vocabulary.app]
 */
const baseUrl = process.argv[2] || process.env.PROD_URL || "https://loop-vocabulary.app";
const TOEIC_BASIC_100_ID = "10000000-0000-0000-0000-000000000109";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function fetchText(path) {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, text: await res.text() };
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

async function main() {
  console.log(`Auditing SEO for category LPs: ${baseUrl}`);

  // ---- 1. sitemap.xml ----
  const { status: sitemapStatus, text: sitemapXml } = await fetchText("/sitemap.xml");
  if (sitemapStatus === 200) ok("/sitemap.xml が200で取得できる");
  else bad(`/sitemap.xml のステータスが200ではない (${sitemapStatus})`);

  const requiredInSitemap = [
    "/materials/toeic",
    "/materials/business",
    "/materials</loc>",
    "/dictionary</loc>",
    "/guide</loc>",
    "/grammar</loc>",
    "/faq</loc>",
  ];
  for (const path of requiredInSitemap) {
    if (sitemapXml.includes(path)) ok(`sitemap.xmlに ${path} が含まれる`);
    else bad(`sitemap.xmlに ${path} が含まれていない`);
  }

  // ---- 2. robots.txt ----
  const { status: robotsStatus, text: robotsTxt } = await fetchText("/robots.txt");
  if (robotsStatus === 200) ok("/robots.txt が200で取得できる");
  else bad(`/robots.txt のステータスが200ではない (${robotsStatus})`);

  const disallowLines = robotsTxt
    .split("\n")
    .filter((l) => l.trim().toLowerCase().startsWith("disallow:"))
    .map((l) => l.split(":")[1]?.trim());
  const targetPaths = ["/materials/toeic", "/materials/business", "/materials", "/dictionary"];
  const blocked = targetPaths.filter((p) => disallowLines.some((d) => d && p.startsWith(d)));
  if (blocked.length === 0) ok("robots.txtが対象パス（/materials/toeic・/materials/business・/materials・/dictionary）をブロックしていない");
  else bad(`robots.txtが以下のパスをブロックしている: ${blocked.join(", ")}`);

  // ---- 3. canonical確認 ----
  for (const [path, expectedCanonical] of [
    ["/materials/toeic", `${baseUrl}/materials/toeic`],
    ["/materials/business", `${baseUrl}/materials/business`],
  ]) {
    const { text } = await fetchText(path);
    const canonicalMatch = text.match(/<link rel="canonical" href="([^"]+)"/);
    if (canonicalMatch && canonicalMatch[1] === expectedCanonical) {
      ok(`${path} のcanonicalが自分自身のURL(${expectedCanonical})を指している`);
    } else {
      bad(`${path} のcanonicalが想定と異なる (実際: ${canonicalMatch?.[1] ?? "見つからない"})`);
    }
  }

  // ---- 4. JSON-LD確認 ----
  for (const path of ["/materials/toeic", "/materials/business"]) {
    const { text } = await fetchText(path);
    const blocks = extractJsonLdBlocks(text);
    if (blocks.length === 2) ok(`${path} にJSON-LDスクリプトが2個（Breadcrumb+ItemList）存在する`);
    else bad(`${path} のJSON-LDスクリプト数が想定(2個)と異なる (実際: ${blocks.length}個)`);

    let allValid = true;
    const types = [];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block);
        types.push(parsed["@type"]);
      } catch {
        allValid = false;
      }
    }
    if (allValid) ok(`${path} のJSON-LDはすべて妥当なJSONとしてパースできる (@type: ${types.join(", ")})`);
    else bad(`${path} のJSON-LDにパースできない不正なJSONが含まれている`);

    if (types.includes("BreadcrumbList") && types.includes("ItemList")) {
      ok(`${path} にBreadcrumbList・ItemListの両方が存在する`);
    } else {
      bad(`${path} のJSON-LDの@typeが想定と異なる (実際: ${types.join(", ")})`);
    }
  }

  // ---- 5. 既存の/materials/[id]への影響確認 ----
  const { status: detailStatus, text: detailText } = await fetchText(`/materials/${TOEIC_BASIC_100_ID}`);
  if (detailStatus === 200 && detailText.includes("TOEIC 基礎100")) {
    ok("既存の/materials/[id]が引き続き200で正しく表示される");
  } else {
    bad(`/materials/${TOEIC_BASIC_100_ID} の表示が想定と異なる (status: ${detailStatus})`);
  }

  console.log(`\n=== seo-lp-audit: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("seo-lp-audit crashed:", e);
  process.exit(1);
});
