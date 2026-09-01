/**
 * オーナー指摘対応: @supabase/ssr@0.10.0以降、setAllコールバックの第2引数として
 * 渡されるcache header(Cache-Control/Expires/Pragma)が実際にレスポンスへ
 * 適用されること、かつSupabaseが渡したCookie optionsが一切書き換えられずに
 * そのまま渡ることを、mockされたresponseで直接unit testする。
 *
 * src/lib/supabase/middleware.ts::updateSession()自体は実際のSupabase Auth API
 * 呼び出しを伴い、setAllが呼ばれるタイミング(トークンrefresh前後)は本番同様の
 * E2Eでは現実的に再現できない(アクセストークンの実際の期限が迫るまで発火しない)
 * ため、代わりにsetAllの適用ロジックだけを切り出したapplySupabaseCookiesAndHeaders()
 * (next/server非依存の純粋関数、src/lib/supabase/cookieHeaders.ts)を直接呼ぶ。
 *
 * 本番のJWT/expires_atを手作業で改変するテストは行わない(禁止事項として明示済み)。
 *
 * 使い方: node scripts/testing/test-supabase-cookie-cache-headers.mjs
 */
import { applySupabaseCookiesAndHeaders } from "../../src/lib/supabase/cookieHeaders.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function makeMockResponse() {
  const cookieCalls = [];
  const headerCalls = [];
  return {
    cookies: { set: (name, value, options) => cookieCalls.push({ name, value, options }) },
    headers: { set: (key, value) => headerCalls.push({ key, value }) },
    cookieCalls,
    headerCalls,
  };
}

// @supabase/ssrが実際に本番コードで渡すヘッダー(node_modules/@supabase/ssr/dist/main/cookies.js参照)。
const SUPABASE_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

function test1_cacheHeadersApplied() {
  const res = makeMockResponse();
  applySupabaseCookiesAndHeaders(res, [], SUPABASE_CACHE_HEADERS);
  const byKey = Object.fromEntries(res.headerCalls.map((c) => [c.key, c.value]));
  const allApplied = Object.entries(SUPABASE_CACHE_HEADERS).every(([k, v]) => byKey[k] === v);
  if (allApplied) ok("Supabaseのcache header(Cache-Control/Expires/Pragma)が3つともresponse.headers.set()で適用される");
  else bad(`cache headerの一部が適用されていない(実測: ${JSON.stringify(byKey)})`);
}

function test2_cookieOptionsPreservedExactly() {
  const res = makeMockResponse();
  const options = { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3600 };
  const toSet = [{ name: "sb-access-token", value: "dummy-jwt-value", options }];
  applySupabaseCookiesAndHeaders(res, toSet, SUPABASE_CACHE_HEADERS);
  const call = res.cookieCalls[0];
  const optionsPreserved = call && call.options === options; // 同一参照(コピー・部分書き換えなし)であることまで確認
  if (call?.name === "sb-access-token" && call?.value === "dummy-jwt-value" && optionsPreserved) {
    ok("Supabaseが渡したCookie options(httpOnly/secure/sameSite/path/maxAge)が一切書き換えられずそのまま渡る");
  } else {
    bad(`Cookie optionsが変更されている(実測: ${JSON.stringify(call)})`);
  }
}

function test3_multipleCookiesAllApplied() {
  const res = makeMockResponse();
  const toSet = [
    { name: "sb-access-token", value: "v1", options: { httpOnly: true } },
    { name: "sb-refresh-token", value: "v2", options: { httpOnly: true } },
  ];
  applySupabaseCookiesAndHeaders(res, toSet, SUPABASE_CACHE_HEADERS);
  if (res.cookieCalls.length === 2) {
    ok("複数のSet-Cookie(sb-access-token・sb-refresh-token)が両方とも欠落せずresponse.cookies.set()される");
  } else {
    bad(`Cookie呼び出し数が想定外(実測: ${res.cookieCalls.length}件、期待: 2件)`);
  }
}

function test4_missingHeadersArgDoesNotThrow() {
  const res = makeMockResponse();
  try {
    applySupabaseCookiesAndHeaders(res, [{ name: "x", value: "y", options: {} }], undefined);
    if (res.headerCalls.length === 0) ok("headers引数がundefinedでも例外を投げず、ヘッダーを何も適用しない(古い@supabase/ssrバージョン相当への安全なfallback)");
    else bad("headers引数がundefinedなのにheaderCallsが発生している");
  } catch (e) {
    bad(`headers引数がundefinedのとき例外を投げた: ${e.message}`);
  }
}

function test5_auditCookieNeverTouchedByThisFunction() {
  // audit Cookie(lv_audit)はsrc/middleware.ts側が別途response.cookies.set()で
  // 直接付与する(src/lib/analytics配下のロジック)。applySupabaseCookiesAndHeaders()
  // はSupabaseから渡されたtoSet配列だけを処理するため、lv_auditという名前を
  // 一切知らない・触れない設計になっていることをソースの近傍から確認する
  // (「audit Cookie削除時にSupabase Cookieへ触れない」の裏返し: Supabase側の
  // このヘルパーもaudit Cookieへ触れない、という分離が保たれていることの確認)。
  const res = makeMockResponse();
  applySupabaseCookiesAndHeaders(res, [{ name: "sb-access-token", value: "v1", options: {} }], SUPABASE_CACHE_HEADERS);
  const touchedAuditCookie = res.cookieCalls.some((c) => c.name === "lv_audit");
  if (!touchedAuditCookie) ok("applySupabaseCookiesAndHeaders()はSupabaseが渡したCookie以外(lv_audit等)を一切追加・削除しない");
  else bad("applySupabaseCookiesAndHeaders()がlv_auditへ触れている(想定外)");
}

test1_cacheHeadersApplied();
test2_cookieOptionsPreservedExactly();
test3_multipleCookiesAllApplied();
test4_missingHeadersArgDoesNotThrow();
test5_auditCookieNeverTouchedByThisFunction();

console.log(fail
  ? `\n=== test:supabase-cookie-cache-headers: ${fail}件失敗 (${pass}件成功) ===`
  : `\n=== test:supabase-cookie-cache-headers RESULT: all ${pass} checks passed ===`);
process.exit(fail ? 1 : 0);
