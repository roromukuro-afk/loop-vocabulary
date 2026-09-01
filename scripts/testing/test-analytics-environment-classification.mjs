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
 * 使い方: node scripts/testing/test-analytics-environment-classification.mjs
 */
import { resolveAnalyticsRequestContext } from "../../src/lib/analytics/resolveAnalyticsRequestContext.ts";
import { isProductionEnvironment } from "../../src/lib/analytics/testEventClassification.ts";
import { AUDIT_MODE_HEADER, AUDIT_MODE_COOKIE } from "../../src/lib/analytics/auditMode.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function withEnv(vars, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(vars)) {
    originals[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
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

function isTestEvent(opts) {
  return resolveAnalyticsRequestContext(makeRequest(opts)).isTestEvent;
}

console.log("--- A. VERCEL_ENV=production, headerなし → false(実本番イベント) ---");
withEnv({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: undefined }, () => {
  assertEqual(isTestEvent({}), false, "A: isTestEvent(header無し) === false");
  assertEqual(isProductionEnvironment(), true, "A: isProductionEnvironment() === true");
});

console.log("\n--- B. VERCEL_ENV=preview → true ---");
withEnv({ VERCEL_ENV: "preview" }, () => {
  assertEqual(isTestEvent({}), true, "B: isTestEvent(header無し) === true");
  assertEqual(isProductionEnvironment(), false, "B: isProductionEnvironment() === false");
});

console.log("\n--- C. VERCEL_ENV=development → true ---");
withEnv({ VERCEL_ENV: "development" }, () => {
  assertEqual(isTestEvent({}), true, "C: isTestEvent(header無し) === true");
});

console.log("\n--- D. production + 正しい監査トークンのヘッダー → true(Production Canaryのオーバーライド) ---");
withEnv({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, () => {
  assertEqual(isTestEvent({ headerValue: "a".repeat(32) }), true, "D: 正しいトークン一致 in production === true");
});

console.log("\n--- E. preview + クライアント偽装(is_test_event=falseのつもりの値)を渡しても上書きされない ---");
// この関数自体はis_test_eventという名前の引数を受け取らない設計そのものが
// 「クライアント値を信用しない」ことを保証している。ヘッダーに"0"や"false"文字列
// (クライアントが偽装しようとして送ってきた値の類)を渡しても、設定済みトークンと
// 厳密一致しない限り単なる「不一致」として扱われ、判定は環境(preview)にfall backする
// だけであり、「falseを強制する」効果は一切持たない。
withEnv({ VERCEL_ENV: "preview", LV_AUDIT_TOKEN: "a".repeat(32) }, () => {
  assertEqual(isTestEvent({ headerValue: "false" }), true, 'E: isTestEvent(header="false") in preview === true(偽装値は無視され環境判定にfall backする)');
  assertEqual(isTestEvent({ headerValue: "0" }), true, 'E: isTestEvent(header="0") in preview === true');
});

console.log("\n--- F. production, 通常visitor(headerなし) → false ---");
withEnv({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: undefined }, () => {
  assertEqual(isTestEvent({}), false, "F: isTestEvent(header無し) in production === false");
});

console.log("\n--- G. production + 監査Cookieのみ(SPA遷移中でヘッダー再送なし) → true ---");
withEnv({ VERCEL_ENV: "production" }, () => {
  assertEqual(isTestEvent({ cookieValue: "1" }), true, "G: isTestEvent(Cookieのみ) in production === true(SPA遷移中の状態維持)");
});

console.log("\n--- H. production + 不一致トークンのヘッダー → false(サーバー側の秘密と一致しない) ---");
withEnv({ VERCEL_ENV: "production", LV_AUDIT_TOKEN: "a".repeat(32) }, () => {
  assertEqual(isTestEvent({ headerValue: "b".repeat(32) }), false, "H: isTestEvent(不一致トークン) in production === false");
});

console.log("\n--- 追加: VERCEL_ENV未設定(ローカルdev/CI相当) → true(fail-closed) ---");
withEnv({ VERCEL_ENV: undefined, LV_AUDIT_TOKEN: undefined }, () => {
  assertEqual(isTestEvent({}), true, "VERCEL_ENV未設定時はtest扱い(fail-closed)");
  assertEqual(isProductionEnvironment(), false, "VERCEL_ENV未設定時はisProductionEnvironment()===false");
});

console.log("\n--- 追加: NODE_ENVだけをproductionにしてもVERCEL_ENVがpreviewならtest扱い ---");
// Vercel PreviewビルドのNODE_ENVは"production"になりうるため、NODE_ENV単独で
// production/previewを区別してはいけない、という回帰ガード。
withEnv({ NODE_ENV: "production" }, () => {
  withEnv({ VERCEL_ENV: "preview" }, () => {
    assertEqual(isTestEvent({}), true, "NODE_ENV=production でも VERCEL_ENV=preview なら test扱い");
  });
});

console.log(fail
  ? `\n=== test:analytics-environment-classification: ${fail}件失敗 (${pass}件成功) ===`
  : `\n=== test:analytics-environment-classification RESULT: all ${pass} checks passed ===`);
process.exit(fail ? 1 : 0);
