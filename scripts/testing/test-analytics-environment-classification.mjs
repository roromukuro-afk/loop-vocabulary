/**
 * src/lib/analytics/testEventClassification.ts の単体テスト（ブラウザ・サーバー不要）。
 *
 * client ingestion(/api/analytics/events)とserver event(trackServerEvent等)の
 * 両方が使う共通環境判定helperの契約を検証する。process.env.VERCEL_ENVを直接書き換えて
 * 各ケースを再現する(このファイル内でのみ有効。他プロセス・他テストには影響しない)。
 *
 * 使い方: node scripts/testing/test-analytics-environment-classification.mjs
 */
import { computeIsTestEvent, isProductionEnvironment } from "../../src/lib/analytics/testEventClassification.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function withVercelEnv(value, fn) {
  const original = process.env.VERCEL_ENV;
  if (value === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) ok(label);
  else bad(`${label} (期待値=${expected}, 実際=${actual})`);
}

console.log("--- A. VERCEL_ENV=production, headerなし → false(実本番イベント) ---");
withVercelEnv("production", () => {
  assertEqual(computeIsTestEvent(null), false, "A: computeIsTestEvent(null) === false");
  assertEqual(isProductionEnvironment(), true, "A: isProductionEnvironment() === true");
});

console.log("\n--- B. VERCEL_ENV=preview → true ---");
withVercelEnv("preview", () => {
  assertEqual(computeIsTestEvent(null), true, "B: computeIsTestEvent(null) === true");
  assertEqual(isProductionEnvironment(), false, "B: isProductionEnvironment() === false");
});

console.log("\n--- C. VERCEL_ENV=development → true ---");
withVercelEnv("development", () => {
  assertEqual(computeIsTestEvent(null), true, "C: computeIsTestEvent(null) === true");
});

console.log("\n--- D. production + E2Eヘッダー → true(Production Canaryのオーバーライド) ---");
withVercelEnv("production", () => {
  assertEqual(computeIsTestEvent("1"), true, 'D: computeIsTestEvent("1") in production === true');
});

console.log("\n--- E. preview + クライアント偽装(is_test_event=falseのつもりの値)を渡しても上書きされない ---");
// この関数自体はis_test_eventという名前の引数を受け取らない設計そのものが
// 「クライアント値を信用しない」ことを保証している。e2eHeaderValueに"0"や"false"文字列
// (クライアントが偽装しようとして送ってきた値の類)を渡しても、"1"と厳密一致しない限り
// 単なる「ヘッダーなし」として扱われ、判定は環境(preview)にfall backするだけであり、
// 「falseを強制する」効果は一切持たない。
withVercelEnv("preview", () => {
  assertEqual(computeIsTestEvent("false"), true, 'E: computeIsTestEvent("false") in preview === true(偽装値は無視され環境判定にfall backする)');
  assertEqual(computeIsTestEvent("0"), true, 'E: computeIsTestEvent("0") in preview === true');
});

console.log("\n--- F. production, 通常visitor(headerなし) → false ---");
withVercelEnv("production", () => {
  assertEqual(computeIsTestEvent(undefined), false, "F: computeIsTestEvent(undefined) in production === false");
});

console.log("\n--- 追加: VERCEL_ENV未設定(ローカルdev/CI相当) → true(fail-closed) ---");
withVercelEnv(undefined, () => {
  assertEqual(computeIsTestEvent(null), true, "VERCEL_ENV未設定時はtest扱い(fail-closed)");
  assertEqual(isProductionEnvironment(), false, "VERCEL_ENV未設定時はisProductionEnvironment()===false");
});

console.log("\n--- 追加: NODE_ENVだけをproductionにしてもVERCEL_ENVがpreviewならtest扱い ---");
// Vercel PreviewビルドのNODE_ENVは"production"になりうるため、NODE_ENV単独で
// production/previewを区別してはいけない、という回帰ガード。
{
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    withVercelEnv("preview", () => {
      assertEqual(computeIsTestEvent(null), true, "NODE_ENV=production でも VERCEL_ENV=preview なら test扱い");
    });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}

console.log(fail
  ? `\n=== test:analytics-environment-classification: ${fail}件失敗 (${pass}件成功) ===`
  : `\n=== test:analytics-environment-classification RESULT: all ${pass} checks passed ===`);
process.exit(fail ? 1 : 0);
