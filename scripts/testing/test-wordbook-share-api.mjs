/**
 * Issue #81: src/app/api/wordbook/[id]/share/route.ts のエラーハンドリング契約を検証する。
 *
 * ## なぜソースコード確認方式なのか
 * このリポジトリのAPI route handlerはNext.jsのリクエストコンテキスト
 * (cookies()等)・実DBアクセスに依存する`createClient()`を使用しており、
 * プレーンなNodeスクリプトから直接import・実行することができない
 * (サーバー起動が必須)。これは既存の
 * scripts/testing/test-wordbook-import-rollback-invariant.mjsや
 * scripts/testing/test-ai-suggest-lazy-anthropic-init.mjsと同じ制約であり、
 * 同じ理由でソースコードのテキスト構造を直接検証する決定論的テストとする。
 * 実DBへの接続・DDL実行・DML実行・実HTTP呼び出しはいずれも一切発生しない。
 *
 * 使い方: node scripts/testing/test-wordbook-share-api.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(__dirname, "../../src/app/api/wordbook/[id]/share/route.ts");

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  const source = readFileSync(ROUTE_PATH, "utf8");
  const postMatch = source.match(/export async function POST[\s\S]*?(?=\nexport async function DELETE|\n$)/);
  const post = postMatch ? postMatch[0] : "";
  const deleteMatch = source.match(/export async function DELETE[\s\S]*$/);
  const del = deleteMatch ? deleteMatch[0] : "";

  if (!post) bad("POST handlerが見つからない");
  if (!del) bad("DELETE handlerが見つからない");

  // --- 1. POST: select errorを確認し、404ではなく500を返すこと(fetch_failed) ---
  const postSelectErrorNot404 = /const \{ data: book, error: fetchError \} = await supabase[\s\S]{0,200}if \(fetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "fetch_failed" \}, \{ status: 500 \}\);/.test(post);
  if (postSelectErrorNot404) {
    ok("POST: word_books取得のerrorを確認し、404ではなく500 fetch_failedを返す");
  } else {
    bad("POST: word_books取得のerrorチェックが想定した形で見つからない");
  }

  // --- 2. POST: dataが無い場合は404 not_foundを返すこと(fetchErrorとは別経路) ---
  const postNoDataIs404 = /if \(!book\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(post);
  if (postNoDataIs404) {
    ok("POST: クエリ成功+dataなしの場合のみ404 not_foundを返す(errorとは別経路)");
  } else {
    bad("POST: dataなし時の404分岐が想定した形で見つからない");
  }

  // --- 3. POST: source_type !== "custom" は403を返すこと ---
  const postNonCustomIs403 = /if \(book\.source_type !== "custom"\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{\s*\n\s*error: "non_custom_source",/.test(post);
  if (postNonCustomIs403) {
    ok("POST: source_type !== \"custom\"は403 non_custom_sourceを返す");
  } else {
    bad("POST: non-custom時の403分岐が想定した形で見つからない");
  }
  const post403StatusCode = /error: "non_custom_source"[\s\S]{0,300}\},\s*\{\s*status:\s*403\s*\}/.test(post);
  if (post403StatusCode) {
    ok("POST: non_custom_sourceのHTTPステータスは403");
  } else {
    bad("POST: non_custom_sourceのHTTPステータスが403になっていない");
  }

  // --- 4. POST: updateのerrorで生のerror.messageを返していないこと ---
  const postLeaksRawErrorMessage = /error\.message/i.test(post);
  if (!postLeaksRawErrorMessage) {
    ok("POST: 生のSupabase error.messageをレスポンスへ含めていない");
  } else {
    bad("POST: error.messageがそのまま返されている疑いがある(生DBエラーの漏洩)");
  }
  const postUpdateErrorSafe = (post.match(/error: "update_failed"/g) || []).length >= 2;
  if (postUpdateErrorSafe) {
    ok("POST: update失敗時は安全なupdate_failed codeを返す(既存code再利用時・新規生成時の両方)");
  } else {
    bad("POST: update_failed codeの使用箇所が想定より少ない");
  }

  // --- 5. POST: unique collision(23505)の場合だけ最大5回リトライすること ---
  const hasRetryLoop = /for \(let attempt = 0; attempt < 5; attempt\+\+\)/.test(post);
  if (hasRetryLoop) {
    ok("POST: 新規share_code生成は最大5回のリトライループを持つ");
  } else {
    bad("POST: リトライループ(最大5回)が見つからない");
  }
  const retriesOnlyOn23505 = /if \(updateError\.code !== "23505"\) \{\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);/.test(post);
  if (retriesOnlyOn23505) {
    ok("POST: リトライループ内でPostgres error code 23505以外は即座に確定的失敗として返す(23505以外はリトライしない)");
  } else {
    bad("POST: 23505以外を即時失敗させる分岐が見つからない");
  }
  const hasCodeGenerationFailedFallback = /return NextResponse\.json\(\{ error: "code_generation_failed" \}, \{ status: 500 \}\);/.test(post);
  if (hasCodeGenerationFailedFallback) {
    ok("POST: 5回リトライしても成功しない場合は安全なcode_generation_failedを返す");
  } else {
    bad("POST: リトライ上限到達時のcode_generation_failedフォールバックが見つからない");
  }
  // crypto由来の安全な生成であること(Math.randomではない)
  const usesCryptoRandomBytes = /randomBytes\(12\)\.toString\("base64url"\)/.test(source);
  const usesMathRandom = /Math\.random\(\)/.test(source);
  if (usesCryptoRandomBytes && !usesMathRandom) {
    ok("share code生成はnode:cryptoのrandomBytes(12).toString(\"base64url\")を使用し、Math.random()は使用していない");
  } else {
    bad(`share code生成方式が想定と異なる(cryptoRandomBytes=${usesCryptoRandomBytes}, mathRandom=${usesMathRandom})`);
  }

  // --- 6. POST: 所有権条件(user_id)がselect・updateの両方に含まれること ---
  const postOwnershipInSelect = /\.select\("id, share_code, is_shared, source_type"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)/.test(post);
  const postOwnershipInUpdateCount = (post.match(/\.eq\("user_id", user\.id\)/g) || []).length;
  if (postOwnershipInSelect) {
    ok("POST: word_books取得にuser_id所有権条件が含まれる");
  } else {
    bad("POST: word_books取得のuser_id条件が見つからない");
  }
  if (postOwnershipInUpdateCount >= 3) {
    ok(`POST: user_id所有権条件が計${postOwnershipInUpdateCount}箇所(select+update×2経路)に含まれる`);
  } else {
    bad(`POST: user_id所有権条件の使用回数が想定より少ない(${postOwnershipInUpdateCount}件)`);
  }

  // --- 7. DELETE: 存在確認を先に行い、無ければ404を返すこと(成功扱いしない) ---
  const deleteChecksExistenceFirst = /const \{ data: book, error: fetchError \} = await supabase[\s\S]{0,150}if \(fetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "fetch_failed" \}, \{ status: 500 \}\);\s*\n\s*\}\s*\n\s*if \(!book\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(del);
  if (deleteChecksExistenceFirst) {
    ok("DELETE: 存在・所有権を先に確認し、fetch error=500・データなし=404を区別して返す(存在しない/他人の単語帳を成功扱いしない)");
  } else {
    bad("DELETE: 存在確認+404分岐が想定した形で見つからない");
  }

  // --- 8. DELETE: updateのerrorを確認し、成功扱い({ok:true})にしないこと ---
  const deleteChecksUpdateError = /const \{ error: updateError \} = await supabase[\s\S]{0,150}if \(updateError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);/.test(del);
  if (deleteChecksUpdateError) {
    ok("DELETE: updateのerrorを確認し、失敗時は安全なupdate_failedを返す(黙って{ok:true}にしない)");
  } else {
    bad("DELETE: update errorチェックが想定した形で見つからない");
  }
  const deleteReturnsOkOnlyAfterCheck = /if \(updateError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);\s*\n\s*\}\s*\n\s*return NextResponse\.json\(\{ ok: true \}\);/.test(del);
  if (deleteReturnsOkOnlyAfterCheck) {
    ok("DELETE: {ok:true}はerrorチェックの後、エラーが無い場合にのみ返される");
  } else {
    bad("DELETE: {ok:true}がerrorチェックより前や無条件に返されている疑いがある");
  }

  // --- 9. DELETE: 所有権条件(user_id)がselect・updateの両方に含まれること ---
  const deleteOwnershipCount = (del.match(/\.eq\("user_id", user\.id\)/g) || []).length;
  if (deleteOwnershipCount >= 2) {
    ok(`DELETE: user_id所有権条件が計${deleteOwnershipCount}箇所(select+update)に含まれる`);
  } else {
    bad(`DELETE: user_id所有権条件の使用回数が想定より少ない(${deleteOwnershipCount}件)`);
  }

  // --- 10. DELETE: share_code自体を削除していないこと(再共有時に同じURLを再利用する方針) ---
  const deleteDoesNotClearShareCode = !/share_code:\s*null/.test(del);
  if (deleteDoesNotClearShareCode) {
    ok("DELETE: share_codeをnullへクリアしていない(再共有時に同じURLを再利用する)");
  } else {
    bad("DELETE: share_codeをクリアしている疑いがある(共有再開時にURLが変わってしまう)");
  }

  console.log(`\n=== test:wordbook-share-api RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
