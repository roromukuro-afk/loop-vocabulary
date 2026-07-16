/**
 * ads.txt が本番で正しく配信されていることの自律検証(HTTPのみ、実際の本番ドメインに直接アクセス)。
 * 使い方: node scripts/testing/ads-txt-live.mjs [https://loop-vocabulary.app]
 */
const baseUrl = process.argv[2] || process.env.PROD_URL || "https://loop-vocabulary.app";
const EXPECTED_LINE = "google.com, pub-5148247638505100, DIRECT, f08c47fec0942fa0";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  console.log(`Verifying ads.txt on: ${baseUrl}`);

  const res = await fetch(`${baseUrl}/ads.txt`, { redirect: "manual" });
  if (res.status === 200) ok("200 OKで取得できる");
  else bad(`200ではない (status=${res.status})`);

  const contentType = res.headers.get("content-type") ?? "";
  if (/^text\/plain/i.test(contentType)) ok(`Content-Typeがtext/plain (${contentType})`);
  else bad(`Content-Typeがtext/plainではない (${contentType})`);

  const buf = new Uint8Array(await res.arrayBuffer());
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  if (hasBom) bad("BOM(UTF-8 byte order mark)が付与されている(パース阻害の懸念)");
  else ok("BOMが付与されていない");

  const text = new TextDecoder("utf-8").decode(buf);
  if (/<html/i.test(text) || /<!doctype/i.test(text)) bad("HTMLが返されている(ads.txtとして機能しない)");
  else ok("HTMLではなくプレーンテキストが返されている");

  const trimmedLines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (trimmedLines.length === 1 && trimmedLines[0] === EXPECTED_LINE) {
    ok(`内容が完全一致1行 ("${EXPECTED_LINE}")`);
  } else {
    bad(`内容が想定と異なる: ${JSON.stringify(trimmedLines)}`);
  }

  const robotsRes = await fetch(`${baseUrl}/robots.txt`);
  const robotsTxt = await robotsRes.text();
  const disallowsAds = robotsTxt
    .split("\n")
    .map((l) => l.trim())
    .some((l) => {
      const m = l.match(/^Disallow:\s*(\S+)/i);
      return m && "/ads.txt".startsWith(m[1]);
    });
  if (disallowsAds) bad("robots.txtでads.txtがブロックされている");
  else ok("robots.txtでads.txtはブロックされていない");

  // Publisher ID自体はads.txtに記載のIDそのものを検証しているため重複だが、
  // 「変更禁止: ads.txtに記載するID」の意図を明示的に固定化する目的で単独assertする
  if (text.includes("pub-5148247638505100")) ok("Publisher ID(pub-5148247638505100)が正しく含まれている");
  else bad("Publisher IDが一致しない");

  // vercel.app系ドメインのads.txtもカスタムドメインへ最終的にリダイレクトされること
  const vercelAdsRes = await fetch("https://loop-vocabulary.vercel.app/ads.txt", { redirect: "manual" });
  if (vercelAdsRes.status === 308 || vercelAdsRes.status === 301) {
    const loc = vercelAdsRes.headers.get("location");
    if (loc === `${baseUrl}/ads.txt`) ok(`loop-vocabulary.vercel.app/ads.txt はカスタムドメインへリダイレクトされる (${loc})`);
    else bad(`loop-vocabulary.vercel.app/ads.txt のリダイレクト先が不正: ${loc}`);
  } else {
    bad(`loop-vocabulary.vercel.app/ads.txt がリダイレクトされない (status=${vercelAdsRes.status})`);
  }

  console.log(fail ? `\n=== ads-txt-live: ${fail}件失敗 (${pass}件成功) ===` : `\n=== ads-txt-live RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
