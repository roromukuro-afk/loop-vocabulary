/**
 * src/lib/analytics/resolveAnalyticsRequestContext.ts の単体テスト（ブラウザ・サーバー不要）。
 *
 * 「実行環境が本番かどうか」の判定(testEventClassification.ts)と、E2Eヘッダー/
 * audit Cookieを踏まえたisTestEvent判定の一本化(resolveAnalyticsRequestContext.ts)を
 * 実際のRequestオブジェクトを渡して検証する(computeIsTestEvent()は
 * resolveAnalyticsRequestContext()への中央集約リファクタで撤去済み、Issue #136是正の
 * 再強化。旧テストが撤去済みexportを直接importしていたため壊れていた点をCodexレビュー指摘、
 * 805ac98で発見・修正)。process.env.VERCEL_ENV/LV_AUDIT_TOKENを直接書き換えて
 * 各ケースを再現する(このファイル内でのみ有効。他プロセス・他テストには影響しない)。
 *
 * resolveAnalyticsRequestContext()はCookie署名検証(Web Crypto API、
 * src/lib/analytics/auditModeServer.ts参照)のためasync化されている(Codexレビュー指摘、
 * 2026-09-01、2回にわたり発見)。
 * 1回目の指摘: 以前はCookie値が固定文字列"1"であることだけを見ており、production上の
 *   誰でもdocument.cookie経由で秘密トークンなしに監査モードを自称できてしまっていた
 *   → HMAC署名値へ変更(commit feeb0a0)。
 * 2回目の指摘: 署名値が固定メッセージへの署名だったため、監査ブラウザから一度Cookie値を
 *   取得すれば無期限に再利用できてしまっていた → iat(発行時刻)・exp(有効期限)・nonceを
 *   含むpayloadへの署名(期限付きproof、lv_audit_proof。httpOnly=true、client JSからは
 *   一切読めない)へ変更した(オーナー指摘、2026-09-01)。client側の広告抑制表示専用の
 *   lv_audit_ui(値は常に"1")は、server側のtest-event判定には一切使われないことも
 *   このテストで検証する。
 *
 * 使い方: node scripts/testing/test-analytics-environment-classification.mjs
 */
import { resolveAnalyticsRequestContext } from "../../src/lib/analytics/resolveAnalyticsRequestContext.ts";
import { isProductionEnvironment } from "../../src/lib/analytics/testEventClassification.ts";
import { AUDIT_MODE_HEADER, AUDIT_MODE_UI_COOKIE } from "../../src/lib/analytics/auditMode.ts";
import { AUDIT_PROOF_COOKIE } from "../../src/lib/analytics/auditModeServer.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function withEnvAsync(vars, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(vars)) {
    originals[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, original] of Object.entries(originals)) {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) ok(label);
  else bad(`${label} (期待値=${expected}, 実際=${actual})`);
}

/** headerValue/cookiesを実際のRequestオブジェクトへ組み立てる(呼び出し側の実挙動を再現)。 */
function makeRequest({ headerValue, cookies } = {}) {
  const headers = new Headers();
  if (headerValue !== undefined) headers.set(AUDIT_MODE_HEADER, headerValue);
  if (cookies !== undefined) {
    const cookieHeader = Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
    if (cookieHeader) headers.set("cookie", cookieHeader);
  }
  return new Request("http://localhost/api/analytics/events", { headers });
}

async function isTestEvent(opts) {
  return (await resolveAnalyticsRequestContext(makeRequest(opts))).isTestEvent;
}

/** テスト側でも、production側と全く同じ手順で署名付きproof文字列を組み立てるためのヘルパー。 */
async function hmacSha256Hex(key, message) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildProof(signingToken, payloadOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 600, nonce: "test-nonce-fixed", ...payloadOverrides };
  const payloadBase64 = btoa(JSON.stringify(payload));
  const signature = await hmacSha256Hex(signingToken, payloadBase64);
  return `${payloadBase64}.${signature}`;
}

const TOKEN = "a".repeat(32);
const OTHER_TOKEN = "b".repeat(32);

console.log("--- A. VERCEL_ENV=production, headerなし → false(実本番イベント) ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: undefined }, async () => {
  assertEqual(await isTestEvent({}), false, "A: isTestEvent(header無し) === false");
  assertEqual(isProductionEnvironment(), true, "A: isProductionEnvironment() === true");
});

console.log("\n--- B. VERCEL_ENV=preview → true ---");
await withEnvAsync({ VERCEL_ENV: "preview" }, async () => {
  assertEqual(await isTestEvent({}), true, "B: isTestEvent(header無し) === true");
  assertEqual(isProductionEnvironment(), false, "B: isProductionEnvironment() === false");
});

console.log("\n--- C. VERCEL_ENV=development → true ---");
await withEnvAsync({ VERCEL_ENV: "development" }, async () => {
  assertEqual(await isTestEvent({}), true, "C: isTestEvent(header無し) === true");
});

console.log("\n--- D. production + 正しい監査トークンのヘッダー → true(Production Canaryのオーバーライド) ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  assertEqual(await isTestEvent({ headerValue: TOKEN }), true, "D: 正しいトークン一致 in production === true");
});

console.log("\n--- E. preview + クライアント偽装(is_test_event=falseのつもりの値)を渡しても上書きされない ---");
// この関数自体はis_test_eventという名前の引数を受け取らない設計そのものが
// 「クライアント値を信用しない」ことを保証している。ヘッダーに"0"や"false"文字列
// (クライアントが偽装しようとして送ってきた値の類)を渡しても、設定済みトークンと
// 厳密一致しない限り単なる「不一致」として扱われ、判定は環境(preview)にfall backする
// だけであり、「falseを強制する」効果は一切持たない。
await withEnvAsync({ VERCEL_ENV: "preview", LV_AUDIT_TOKEN: TOKEN }, async () => {
  assertEqual(await isTestEvent({ headerValue: "false" }), true, 'E: isTestEvent(header="false") in preview === true(偽装値は無視され環境判定にfall backする)');
  assertEqual(await isTestEvent({ headerValue: "0" }), true, 'E: isTestEvent(header="0") in preview === true');
});

console.log("\n--- F. production, 通常visitor(headerなし) → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: undefined }, async () => {
  assertEqual(await isTestEvent({}), false, "F: isTestEvent(header無し) in production === false");
});

console.log("\n--- G. production + 期限内の正しいproofのみ(SPA遷移中でヘッダー再送なし) → true ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const proof = await buildProof(TOKEN);
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: proof } }), true, "G: isTestEvent(期限内の正しいproofのみ) in production === true(SPA遷移中の状態維持)");
});

console.log("\n--- H. production + 不一致トークンのヘッダー → false(サーバー側の秘密と一致しない) ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  assertEqual(await isTestEvent({ headerValue: OTHER_TOKEN }), false, "H: isTestEvent(不一致トークン) in production === false");
});

console.log("\n--- I. production + 旧仕様の固定文字列\"1\"(偽造)→ false(署名検証で拒否される) ---");
// Codexレビュー指摘の回帰防止(2026-09-01): 以前はCookie値が"1"であることだけを見ていたため、
// production上の誰でもdocument.cookie経由で秘密トークンなしに監査モードを自称できた。
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: "1" } }), false, 'I: isTestEvent(proof cookie値="1"、旧仕様の偽造値) in production === false(署名検証で拒否)');
});

console.log("\n--- J. production + UI marker(lv_audit_ui=1)のみ、proof Cookieなし → false ---");
// オーナー指摘対応(2026-09-01): client側の広告抑制表示専用のlv_audit_uiは、server側の
// test-event判定に一切影響してはならない。攻撃者がdocument.cookie経由でこの値を偽造できても、
// production analyticsのデータ品質には影響しないことを保証する。
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  assertEqual(await isTestEvent({ cookies: { [AUDIT_MODE_UI_COOKIE]: "1" } }), false, "J: isTestEvent(UI markerのみ) in production === false(server判定はproof Cookieだけを信頼する)");
});

console.log("\n--- K. production + payload改ざん(署名はそのまま) → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const proof = await buildProof(TOKEN);
  const [payloadBase64, signature] = proof.split(".");
  const tamperedPayload = JSON.parse(atob(payloadBase64));
  tamperedPayload.exp += 3600 * 24 * 365; // 有効期限を1年延長しようとする改ざん
  const tamperedProof = `${btoa(JSON.stringify(tamperedPayload))}.${signature}`;
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: tamperedProof } }), false, "K: isTestEvent(payload改ざん、署名不一致) in production === false");
});

console.log("\n--- L. production + signature改ざん(payloadはそのまま) → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const proof = await buildProof(TOKEN);
  const [payloadBase64, signature] = proof.split(".");
  const tamperedSignature = (signature[0] === "0" ? "1" : "0") + signature.slice(1);
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: `${payloadBase64}.${tamperedSignature}` } }), false, "L: isTestEvent(signature改ざん) in production === false");
});

console.log("\n--- M. production + 別tokenで署名されたproof → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const proofFromOtherToken = await buildProof(OTHER_TOKEN);
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: proofFromOtherToken } }), false, "M: isTestEvent(別tokenで作ったproof) in production === false");
});

console.log("\n--- N. production + 有効期限切れのproof → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const now = Math.floor(Date.now() / 1000);
  const expiredProof = await buildProof(TOKEN, { iat: now - 700, exp: now - 100 });
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: expiredProof } }), false, "N: isTestEvent(expiry経過後) in production === false");
});

console.log("\n--- O. production + 異常に未来のiatを持つproof → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const now = Math.floor(Date.now() / 1000);
  const futureIatProof = await buildProof(TOKEN, { iat: now + 3600, exp: now + 3600 + 600 });
  assertEqual(await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: futureIatProof } }), false, "O: isTestEvent(異常に未来のiat) in production === false");
});

console.log("\n--- P. production + 欠損・不正Base64・巨大payloadでも例外にならずfalseを返す ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: TOKEN }, async () => {
  const malformedCases = [
    { label: "区切り\".\"が無い", value: "not-a-valid-proof-format" },
    { label: "空文字列", value: "" },
    { label: "不正なBase64(デコード不能な文字を含む)", value: "!!!not-base64!!!.deadbeef" },
    { label: "巨大payload(512文字超)", value: `${"a".repeat(1000)}.deadbeef` },
    { label: "署名部分が空", value: `${btoa(JSON.stringify({ iat: 0, exp: 0, nonce: "x" }))}.` },
  ];
  for (const { label, value } of malformedCases) {
    try {
      const result = await isTestEvent({ cookies: { [AUDIT_PROOF_COOKIE]: value } });
      assertEqual(result, false, `P: isTestEvent(不正なproof: ${label}) は例外を投げずfalseを返す`);
    } catch (e) {
      bad(`P: isTestEvent(不正なproof: ${label}) が例外を投げた(${e.message})`);
    }
  }
});

console.log("\n--- 追加: VERCEL_ENV未設定(ローカルdev/CI相当) → true(fail-closed) ---");
await withEnvAsync({ VERCEL_ENV: undefined, LV_AUDIT_TOKEN: undefined }, async () => {
  assertEqual(await isTestEvent({}), true, "VERCEL_ENV未設定時はtest扱い(fail-closed)");
  assertEqual(isProductionEnvironment(), false, "VERCEL_ENV未設定時はisProductionEnvironment()===false");
});

console.log("\n--- 追加: NODE_ENVだけをproductionにしてもVERCEL_ENVがpreviewならtest扱い ---");
// Vercel PreviewビルドのNODE_ENVは"production"になりうるため、NODE_ENV単独で
// production/previewを区別してはいけない、という回帰ガード。
await withEnvAsync({ NODE_ENV: "production" }, async () => {
  await withEnvAsync({ VERCEL_ENV: "preview" }, async () => {
    assertEqual(await isTestEvent({}), true, "NODE_ENV=production でも VERCEL_ENV=preview なら test扱い");
  });
});

console.log(fail
  ? `\n=== test:analytics-environment-classification: ${fail}件失敗 (${pass}件成功) ===`
  : `\n=== test:analytics-environment-classification RESULT: all ${pass} checks passed ===`);
process.exit(fail ? 1 : 0);
