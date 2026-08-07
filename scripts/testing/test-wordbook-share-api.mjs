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
  const reactivateMatch = source.match(/async function reactivateExistingShare[\s\S]*?\n\}/);
  const reactivate = reactivateMatch ? reactivateMatch[0] : "";
  const postMatch = source.match(/export async function POST[\s\S]*?(?=\nexport async function DELETE|\n$)/);
  const post = postMatch ? postMatch[0] : "";
  const deleteMatch = source.match(/export async function DELETE[\s\S]*$/);
  const del = deleteMatch ? deleteMatch[0] : "";

  if (!post) bad("POST handlerが見つからない");
  if (!del) bad("DELETE handlerが見つからない");
  if (!reactivate) bad("reactivateExistingShareヘルパーが見つからない");

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

  // --- 3. POST: source_type !== "custom" は403を返すこと(初回・CAS miss再取得後の両方) ---
  const post403Count = (post.match(/error: "non_custom_source"/g) || []).length;
  if (post403Count >= 2) {
    ok(`POST: source_type !== "custom"の403 non_custom_source分岐が初回判定+CAS miss再取得後の計${post403Count}箇所にある`);
  } else {
    bad(`POST: non_custom_source分岐が想定より少ない(${post403Count}件、初回判定+CAS miss再取得後の計2箇所が必要)`);
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

  // --- 5. POST: unique collision(23505)の場合だけ最大5回リトライすること ---
  const hasRetryLoop = /for \(let attempt = 0; attempt < 5; attempt\+\+\)/.test(post);
  if (hasRetryLoop) {
    ok("POST: 新規share_code生成は最大5回のリトライループを持つ");
  } else {
    bad("POST: リトライループ(最大5回)が見つからない");
  }
  const retriesOnlyOn23505 = /if \(updateError\.code === "23505"\) continue;/.test(post);
  if (retriesOnlyOn23505) {
    ok("POST: リトライループ内でPostgres error code 23505の場合のみcontinueで再試行する(23505以外はリトライしない)");
  } else {
    bad("POST: 23505限定のcontinue分岐が見つからない");
  }
  const nonCollisionErrorIsUpdateFailed = /if \(updateError\.code === "23505"\) continue;\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);/.test(post);
  if (nonCollisionErrorIsUpdateFailed) {
    ok("POST: 23505以外のupdateErrorは即座に確定的失敗(update_failed)として返す");
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

  // --- 6. POST: 新規share_code割当UPDATEはcompare-and-set(.is("share_code", null))
  //          であること。別タブ・別端末からの同時割当リクエストが、後勝ちのUPDATEで
  //          先に確定したcodeを上書きしてしまうことを防ぐ。 ---
  const casUpdateHasIsShareCodeNull = /\.update\(\{ share_code: shareCode, is_shared: true \}\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)\s*\n\s*\.is\("share_code", null\)/.test(post);
  if (casUpdateHasIsShareCodeNull) {
    ok("POST: 新規share_code割当UPDATEに.is(\"share_code\", null)のcompare-and-set条件がある(同時割当リクエストによる上書きを防ぐ)");
  } else {
    bad("POST: 新規share_code割当UPDATEにcompare-and-set条件(.is(\"share_code\", null))が見つからない");
  }

  // --- 7. POST: 割当成功時、ローカル生成したshareCodeではなくUPDATE結果(DBが
  //          実際に書き込んだ値)をレスポンスのsource of truthにしていること ---
  const returnsDbValueOnAssignSuccess = /if \(updated\) \{\s*\n\s*return NextResponse\.json\(\{ ok: true, share_code: updated\.share_code \}\);/.test(post);
  if (returnsDbValueOnAssignSuccess) {
    ok("POST: 新規割当成功時はUPDATE結果(updated.share_code)をレスポンスのsource of truthにする(ローカル変数を無条件に返さない)");
  } else {
    bad("POST: 新規割当成功時のレスポンスがUPDATE結果由来になっていない疑いがある");
  }

  // --- 8. POST: CAS miss(0行更新)時、ローカル生成codeを即成功として返さず、
  //          所有権条件付きで現在の状態を再取得すること ---
  const refetchesOnCasMiss = /\/\/ CAS miss[\s\S]{0,400}const \{ data: current, error: refetchError \} = await supabase\s*\n\s*\.from\("word_books"\)\s*\n\s*\.select\("id, share_code, source_type, is_shared"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)\s*\n\s*\.maybeSingle\(\);/.test(post);
  if (refetchesOnCasMiss) {
    ok("POST: CAS miss時、所有権条件(id+user_id)付きで現在の状態を再取得する");
  } else {
    bad("POST: CAS miss時の再取得クエリが想定した形で見つからない");
  }
  const refetchErrorIsSafe500 = /if \(refetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "verification_failed" \}, \{ status: 500 \}\);/.test(post);
  if (refetchErrorIsSafe500) {
    ok("POST: CAS miss後の再取得でerrorが発生した場合、安全なverification_failedを返す");
  } else {
    bad("POST: 再取得エラー時の安全な500分岐が見つからない");
  }
  const refetchNoDataIs404 = /if \(refetchError\)[\s\S]{0,120}if \(!current\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(post);
  if (refetchNoDataIs404) {
    ok("POST: CAS miss後の再取得でdataが無い場合(行削除等)は404 not_foundを返す");
  } else {
    bad("POST: 再取得でdata無しの404分岐が見つからない");
  }

  // --- 9. POST: CAS miss再取得後、share_codeが既に確定していればis_sharedの
  //          真偽で分岐すること(true→そのまま返す、false→再有効化してから返す) ---
  const casMissShareCodeIsSharedTrueReturnsCurrent = /if \(current\.share_code\) \{[\s\S]{0,120}if \(current\.is_shared\) \{\s*\n\s*return NextResponse\.json\(\{ ok: true, share_code: current\.share_code \}\);/.test(post);
  if (casMissShareCodeIsSharedTrueReturnsCurrent) {
    ok("POST: CAS miss後、競合リクエストが既にis_shared=trueへ確定させていた場合はそのDB上のcodeをそのまま返す");
  } else {
    bad("POST: CAS miss後のis_shared=true分岐が想定した形で見つからない");
  }
  const casMissShareCodeIsSharedFalseReactivates = /if \(current\.is_shared\) \{[\s\S]{0,150}\}\s*\n\s*const result = await reactivateExistingShare\(supabase, id, user\.id\);/.test(post);
  if (casMissShareCodeIsSharedFalseReactivates) {
    ok("POST: CAS miss後、share_codeはあるがis_shared=falseの場合は再有効化処理(reactivateExistingShare)へ移行する");
  } else {
    bad("POST: CAS miss後のis_shared=false再有効化分岐が見つからない");
  }

  // --- 10. POST: CAS miss再取得後もshare_codeが依然nullの場合、無限retryせず
  //           安全にupdate_failedへフォールバックすること ---
  const casMissStillNullIsSafeFailure = /\/\/ share_codeが依然null[\s\S]{0,80}return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);\s*\n\s*\}\s*\n\s*return NextResponse\.json\(\{ error: "code_generation_failed" \}/.test(post);
  if (casMissStillNullIsSafeFailure) {
    ok("POST: CAS miss再取得後もshare_codeが依然nullの場合、無限retryせず安全なupdate_failedを返す");
  } else {
    bad("POST: CAS miss再取得後もshare_code=nullのケースの安全なフォールバックが見つからない");
  }

  // --- 11. reactivateExistingShareヘルパー: is_shared=trueへのUPDATE結果
  //           (実際に更新された行のshare_code)を確認し、事前のselectだけを
  //           根拠に成功とみなさないこと ---
  const reactivateSelectsUpdatedRow = /\.update\(\{ is_shared: true \}\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", userId\)\s*\n\s*\.select\("share_code"\)\s*\n\s*\.maybeSingle\(\);/.test(reactivate);
  if (reactivateSelectsUpdatedRow) {
    ok("reactivateExistingShare: is_shared=trueへのUPDATE結果(share_code)を.select().maybeSingle()で確認する(0行更新を成功扱いしない)");
  } else {
    bad("reactivateExistingShare: UPDATE結果を確認する.select().maybeSingle()が見つからない");
  }
  const reactivateHandlesNoRow = /if \(!data \|\| !data\.share_code\) return \{ kind: "not_found" \};/.test(reactivate);
  if (reactivateHandlesNoRow) {
    ok("reactivateExistingShare: 対象行が更新されなかった場合はnot_foundを返す(select〜UPDATE間の行消失を検出)");
  } else {
    bad("reactivateExistingShare: 0行更新時のnot_found分岐が見つからない");
  }
  const reactivateHandlesError = /if \(error\) return \{ kind: "error" \};/.test(reactivate);
  if (reactivateHandlesError) {
    ok("reactivateExistingShare: UPDATE自体のerrorをkind:\"error\"として呼び出し元へ伝える");
  } else {
    bad("reactivateExistingShare: UPDATE errorのハンドリングが見つからない");
  }
  const postUsesReactivateForInitialShareCode = /if \(book\.share_code\) \{\s*\n\s*const result = await reactivateExistingShare\(supabase, id, user\.id\);/.test(post);
  if (postUsesReactivateForInitialShareCode) {
    ok("POST: 初回判定で既にshare_codeを持つ場合もreactivateExistingShareを使い、UPDATE結果を確認する(事前selectだけで成功扱いしない)");
  } else {
    bad("POST: 初回のshare_code既存分岐がreactivateExistingShareを使っていない疑いがある");
  }

  // --- 12. POST: 所有権条件(user_id)が主要経路に含まれること ---
  const postOwnershipInSelect = /\.select\("id, share_code, is_shared, source_type"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)/.test(post);
  if (postOwnershipInSelect) {
    ok("POST: word_books取得にuser_id所有権条件が含まれる");
  } else {
    bad("POST: word_books取得のuser_id条件が見つからない");
  }
  const postOwnershipInUpdateCount = (post.match(/\.eq\("user_id", user\.id\)/g) || []).length;
  if (postOwnershipInUpdateCount >= 3) {
    ok(`POST: user_id所有権条件が計${postOwnershipInUpdateCount}箇所(初回select+CAS UPDATE+再取得select等)に含まれる`);
  } else {
    bad(`POST: user_id所有権条件の使用回数が想定より少ない(${postOwnershipInUpdateCount}件)`);
  }
  const reactivateOwnership = /\.eq\("user_id", userId\)/.test(reactivate);
  if (reactivateOwnership) {
    ok("reactivateExistingShare: UPDATEにuser_id所有権条件が含まれる");
  } else {
    bad("reactivateExistingShare: user_id所有権条件が見つからない");
  }

  // --- 13. DELETE: 存在確認を先に行い、無ければ404を返すこと(成功扱いしない) ---
  const deleteChecksExistenceFirst = /const \{ data: book, error: fetchError \} = await supabase[\s\S]{0,150}if \(fetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "fetch_failed" \}, \{ status: 500 \}\);\s*\n\s*\}\s*\n\s*if \(!book\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(del);
  if (deleteChecksExistenceFirst) {
    ok("DELETE: 存在・所有権を先に確認し、fetch error=500・データなし=404を区別して返す(存在しない/他人の単語帳を成功扱いしない)");
  } else {
    bad("DELETE: 存在確認+404分岐が想定した形で見つからない");
  }

  // --- 14. DELETE: UPDATE結果(実際に更新された行の有無)を確認すること。
  //           事前のselectだけを根拠に成功とみなさない(select〜UPDATE間に
  //           行が消えた場合、0行更新を成功扱いしない)。 ---
  const deleteUpdateSelectsUpdatedRow = /\.update\(\{ is_shared: false \}\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)\s*\n\s*\.select\("id"\)\s*\n\s*\.maybeSingle\(\);/.test(del);
  if (deleteUpdateSelectsUpdatedRow) {
    ok("DELETE: is_shared=falseへのUPDATE結果を.select(\"id\").maybeSingle()で確認する(0行更新を検出可能にする)");
  } else {
    bad("DELETE: UPDATE結果を確認する.select().maybeSingle()が見つからない");
  }
  const deleteChecksUpdateError = /if \(updateError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);/.test(del);
  if (deleteChecksUpdateError) {
    ok("DELETE: updateのerrorを確認し、失敗時は安全なupdate_failedを返す(黙って{ok:true}にしない)");
  } else {
    bad("DELETE: update errorチェックが想定した形で見つからない");
  }
  const deleteZeroRowUpdateIs404 = /if \(updateError\) \{[\s\S]{0,80}\}\s*\n\s*if \(!updated\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(del);
  if (deleteZeroRowUpdateIs404) {
    ok("DELETE: UPDATEが0行だった場合(select〜UPDATE間の行消失)は404 not_foundを返す(成功扱いしない)");
  } else {
    bad("DELETE: 0行更新時の404分岐が見つからない");
  }
  const deleteReturnsOkOnlyAfterCheck = /if \(!updated\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);\s*\n\s*\}\s*\n\s*return NextResponse\.json\(\{ ok: true \}\);/.test(del);
  if (deleteReturnsOkOnlyAfterCheck) {
    ok("DELETE: {ok:true}はerror・0行更新の両チェックの後、実際に更新された場合にのみ返される");
  } else {
    bad("DELETE: {ok:true}がerror/0行チェックより前や無条件に返されている疑いがある");
  }

  // --- 15. DELETE: 所有権条件(user_id)がselect・updateの両方に含まれること ---
  const deleteOwnershipCount = (del.match(/\.eq\("user_id", user\.id\)/g) || []).length;
  if (deleteOwnershipCount >= 2) {
    ok(`DELETE: user_id所有権条件が計${deleteOwnershipCount}箇所(select+update)に含まれる`);
  } else {
    bad(`DELETE: user_id所有権条件の使用回数が想定より少ない(${deleteOwnershipCount}件)`);
  }

  // --- 16. DELETE: share_code自体を削除していないこと(再共有時に同じURLを再利用する方針) ---
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
