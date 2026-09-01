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
 * src/lib/analytics/auditModeServer.ts参照)のためasync化されている
 * (Codexレビュー指摘、2026-09-01。以前はCookie値が固定文字列"1"であることだけを
 * 見ており、production上の誰でもdocument.cookie経由で秘密トークンなしに監査モードを
 * 自称できてしまっていた)。このテストも実際の署名値を計算して渡すことで、
 * 正しいCookie署名だけが受理され、単なる固定値"1"は拒否されることを検証する。
 *
 * 使い方: node scripts/testing/test-analytics-environment-classification.mjs
 */
import { resolveAnalyticsRequestContext } from "../../src/lib/analytics/resolveAnalyticsRequestContext.ts";
import { isProductionEnvironment } from "../../src/lib/analytics/testEventClassification.ts";
import { AUDIT_MODE_HEADER, AUDIT_MODE_COOKIE } from "../../src/lib/analytics/auditMode.ts";

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

/** headerValue/cookieValueを実際のRequestオブジェクトへ組み立てる(呼び出し側の実挙動を再現)。 */
function makeRequest({ headerValue, cookieValue } = {}) {
  const headers = new Headers();
  if (headerValue !== undefined) headers.set(AUDIT_MODE_HEADER, headerValue);
  if (cookieValue !== undefined) headers.set("cookie", `${AUDIT_MODE_COOKIE}=${cookieValue}`);
  return new Request("http://localhost/api/analytics/events", { headers });
}

async function isTestEvent(opts) {
  return (await resolveAnalyticsRequestContext(makeRequest(opts))).isTestEvent;
}

/** 現在のprocess.env.LV_AUDIT_TOKENから、実際にmiddleware.tsが計算するのと同じHMAC署名値を求める。 */
async function computeValidCookieSignature() {
  const token = process.env.LV_AUDIT_TOKEN;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(AUDIT_MODE_COOKIE));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, async () => {
  assertEqual(await isTestEvent({ headerValue: "a".repeat(32) }), true, "D: 正しいトークン一致 in production === true");
});

console.log("\n--- E. preview + クライアント偽装(is_test_event=falseのつもりの値)を渡しても上書きされない ---");
// この関数自体はis_test_eventという名前の引数を受け取らない設計そのものが
// 「クライアント値を信用しない」ことを保証している。ヘッダーに"0"や"false"文字列
// (クライアントが偽装しようとして送ってきた値の類)を渡しても、設定済みトークンと
// 厳密一致しない限り単なる「不一致」として扱われ、判定は環境(preview)にfall backする
// だけであり、「falseを強制する」効果は一切持たない。
await withEnvAsync({ VERCEL_ENV: "preview", LV_AUDIT_TOKEN: "a".repeat(32) }, async () => {
  assertEqual(await isTestEvent({ headerValue: "false" }), true, 'E: isTestEvent(header="false") in preview === true(偽装値は無視され環境判定にfall backする)');
  assertEqual(await isTestEvent({ headerValue: "0" }), true, 'E: isTestEvent(header="0") in preview === true');
});

console.log("\n--- F. production, 通常visitor(headerなし) → false ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: undefined }, async () => {
  assertEqual(await isTestEvent({}), false, "F: isTestEvent(header無し) in production === false");
});

console.log("\n--- G. production + 正しい署名のCookieのみ(SPA遷移中でヘッダー再送なし) → true ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, async () => {
  const validSignature = await computeValidCookieSignature();
  assertEqual(await isTestEvent({ cookieValue: validSignature }), true, "G: isTestEvent(正しい署名のCookieのみ) in production === true(SPA遷移中の状態維持)");
});

console.log("\n--- H. production + 不一致トークンのヘッダー → false(サーバー側の秘密と一致しない) ---");
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, async () => {
  assertEqual(await isTestEvent({ headerValue: "b".repeat(32) }), false, "H: isTestEvent(不一致トークン) in production === false");
});

console.log("\n--- I. production + Cookie値が固定文字列\"1\"(旧仕様・偽造)→ false(署名検証で拒否される) ---");
// Codexレビュー指摘の回帰防止(2026-09-01): 以前はCookie値が"1"であることだけを見ていたため、
// production上の誰でもdocument.cookie経由で秘密トークンなしに監査モードを自称できた。
// 署名検証導入後は、固定文字列"1"のような秘密トークンから導出されていない値は
// 拒否されなければならない。
await withEnvAsync({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, async () => {
  assertEqual(await isTestEvent({ cookieValue: "1" }), false, 'I: isTestEvent(Cookie値="1"、旧仕様の偽造値) in production === false(署名検証で拒否)');
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
