/**
 * Issue #98: SNSリファラ分類(src/lib/analytics/socialReferrer.ts)のregression test。
 *
 * classifySocialHost()は純粋関数のため、ブラウザ/サーバー起動なしで直接importして
 * 検証できる。既知ドメイン・偽陽性(substring誤爆)防止・pinterestの複数TLD対応を
 * カバーする。UTM優先順位・sessionStorageキャッシュの回帰確認は既存の
 * scripts/testing/e2e/campaign-funnel-tracking.mjs(実ブラウザE2E)が担当する。
 *
 * 使い方: node scripts/testing/test-social-referrer-classification.mjs
 */
import { classifySocialHost } from "../../src/lib/analytics/socialReferrer.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  // ---- 既知ドメイン: 完全一致 ----
  const knownExact = [
    ["x.com", "x"],
    ["twitter.com", "x"],
    ["t.co", "x"], // XのURL短縮ドメイン
    ["instagram.com", "instagram"],
    ["threads.com", "threads"],
    ["threads.net", "threads"], // legacy互換
    ["tiktok.com", "tiktok"],
    ["youtube.com", "youtube"],
    ["youtu.be", "youtube"],
    ["facebook.com", "facebook"],
    ["line.me", "line"],
  ];
  for (const [host, expected] of knownExact) {
    const result = classifySocialHost(host);
    if (result === expected) ok(`classifySocialHost("${host}") === "${expected}"`);
    else bad(`classifySocialHost("${host}") 想定外: ${JSON.stringify(result)} (期待値: "${expected}")`);
  }

  // ---- 既知ドメイン: サブドメイン(m.facebook.com等) ----
  const knownSubdomains = [
    ["m.facebook.com", "facebook"],
    ["www.instagram.com", "instagram"],
    ["l.facebook.com", "facebook"],
    ["www.threads.com", "threads"],
  ];
  for (const [host, expected] of knownSubdomains) {
    const result = classifySocialHost(host);
    if (result === expected) ok(`classifySocialHost("${host}") === "${expected}"(サブドメイン)`);
    else bad(`classifySocialHost("${host}") 想定外: ${JSON.stringify(result)} (期待値: "${expected}")`);
  }

  // ---- 大文字小文字を無視する ----
  {
    const result = classifySocialHost("X.COM");
    if (result === "x") ok('classifySocialHost("X.COM") === "x"(大文字小文字を無視)');
    else bad(`classifySocialHost("X.COM") 想定外: ${JSON.stringify(result)}`);
  }

  // ---- Pinterest: 明示的に許可した既知ドメインのみ ----
  const pinterestHosts = ["pinterest.com", "pinterest.jp", "www.pinterest.com", "pinterest.co.uk", "pinterest.de", "pin.it"];
  for (const host of pinterestHosts) {
    const result = classifySocialHost(host);
    if (result === "pinterest") ok(`classifySocialHost("${host}") === "pinterest"`);
    else bad(`classifySocialHost("${host}") 想定外: ${JSON.stringify(result)} (期待値: "pinterest")`);
  }

  // ---- 偽陽性防止: substring誤爆が起きないこと ----
  const falsePositives = [
    "notx.com",
    "fakeinstagram.com",
    "youtube.example.com",
    "notthreads.com",
    "faketiktok.com",
    "notfacebook.com",
    "notpinterest.com",
    "pinterestfake.com",
    "myline.me.evil.com",
    // Pinterestが実際には所有していない任意のTLDを取得した偽装ドメイン
    // (Codexレビュー指摘対応、11巡目、最重要)。修正前は正規表現が「pinterestという
    // 1ラベルの直後に構文上妥当なTLDが続く」ことだけを見ていたため、これらの攻撃者
    // 取得可能なドメインまでpinterest referralとして誤分類していた。
    "pinterest.site",
    "pinterest.evil",
    "foo.pinterest.site",
    "pinterest.xyz",
  ];
  for (const host of falsePositives) {
    const result = classifySocialHost(host);
    if (result === null) ok(`classifySocialHost("${host}") === null(偽陽性なし)`);
    else bad(`classifySocialHost("${host}") が誤ってSNSと分類された: ${JSON.stringify(result)}`);
  }

  // ---- 無関係なホストはnull ----
  const unrelated = ["google.com", "example.com", "bing.com", "chatgpt.com"];
  for (const host of unrelated) {
    const result = classifySocialHost(host);
    if (result === null) ok(`classifySocialHost("${host}") === null(無関係なホスト)`);
    else bad(`classifySocialHost("${host}") 想定外にSNSと分類された: ${JSON.stringify(result)}`);
  }

  console.log(`\n=== test:social-referrer-classification RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
