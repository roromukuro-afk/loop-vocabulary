/**
 * Issue #81: src/app/api/wordbook/[id]/share/route.ts のエラーハンドリング・
 * 並行実行競合契約を検証する。
 *
 * ## 並行実行の競合契約(updated_at optimistic concurrency)
 * word_books.updated_atをoptimistic concurrencyのversion tokenとして使う
 * (word_booksにはtrg_touch_word_booksトリガーがあり、あらゆるUPDATEで
 * updated_atが自動的にnow()へ更新される)。POSTは初回read以降にrow version
 * が変わっていたら再有効化・新規割当のいずれも行わない。DELETEはversionを
 * 進める(CASを行わない、「共有を停止する」という最新のユーザー操作を
 * 無条件に反映させる)。よって「後から実行された共有停止」を古いPOSTが
 * 意図せず復活させることはない。
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

  // --- 3. POST: 初回selectがupdated_atを取得すること(version tokenとして
  //          後続のCAS判定に使うため) ---
  const selectsUpdatedAt = /\.select\("id, share_code, is_shared, source_type, updated_at"\)/.test(post);
  if (selectsUpdatedAt) {
    ok("POST: 初回selectがupdated_atを取得する(optimistic concurrencyのversion tokenとして使用)");
  } else {
    bad("POST: 初回selectにupdated_atが含まれていない");
  }

  // --- 4. POST: source_type !== "custom" は403を返すこと(初回・CAS miss再取得後の両方) ---
  const post403Count = (post.match(/error: "non_custom_source"/g) || []).length;
  if (post403Count >= 2) {
    ok(`POST: source_type !== "custom"の403 non_custom_source分岐が初回判定+CAS miss再取得後の計${post403Count}箇所にある`);
  } else {
    bad(`POST: non_custom_source分岐が想定より少ない(${post403Count}件、初回判定+CAS miss再取得後の計2箇所以上が必要)`);
  }

  // --- 5. POST: 生のerror.messageを返していないこと ---
  const postLeaksRawErrorMessage = /error\.message/i.test(post);
  if (!postLeaksRawErrorMessage) {
    ok("POST: 生のSupabase error.messageをレスポンスへ含めていない");
  } else {
    bad("POST: error.messageがそのまま返されている疑いがある(生DBエラーの漏洩)");
  }

  // --- 6. POST(Case A: already shared): is_shared=trueの場合はUPDATEせずに
  //          そのまま返すこと(古いPOSTによる、後から実行されたDELETEの
  //          意図しない復活を防ぐ中心経路) ---
  const alreadySharedBranchMatch = post.match(/if \(book\.share_code\) \{\s*\n\s*if \(book\.is_shared\) \{([\s\S]*?)\n\s*\}\s*\n\s*const result = await reactivateExistingShare/);
  const alreadySharedBranch = alreadySharedBranchMatch ? alreadySharedBranchMatch[1] : "";
  if (alreadySharedBranchMatch && !/\.update\(/.test(alreadySharedBranch) && /return NextResponse\.json\(\{ ok: true, share_code: book\.share_code \}\);/.test(alreadySharedBranch)) {
    ok("POST(Case A): is_shared=trueの場合はUPDATEを一切発行せずそのまま返す(既に共有中の単語帳への無条件write自体を発生させない)");
  } else {
    bad("POST(Case A): is_shared=true分岐がwrite無しでそのまま返す形になっていない");
  }

  // --- 7. POST(Case B/C/D): 既存share_codeの再有効化はreactivateExistingShareへ
  //          委譲し、初回readのupdated_atをexpected versionとして渡すこと ---
  const postUsesReactivateWithVersion = /const result = await reactivateExistingShare\(supabase, id, user\.id, book\.updated_at\);\s*\n\s*return reactivateResultToResponse\(result\);/.test(post);
  if (postUsesReactivateWithVersion) {
    ok("POST: 既存share_code再有効化はreactivateExistingShareへ委譲し、初回readのupdated_atをexpected versionとして渡す");
  } else {
    bad("POST: reactivateExistingShareの呼び出し(updated_at付き)が想定した形で見つからない");
  }

  // --- 8. reactivateExistingShare(Case B): CAS UPDATEにis_shared=falseと
  //          updated_at=expectedの両条件があること(古いversionを読んだ
  //          POSTのwriteが後発のmutationを上書きしない) ---
  const reactivateCasUpdate = /\.update\(\{ is_shared: true \}\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", userId\)\s*\n\s*\.eq\("is_shared", false\)\s*\n\s*\.eq\("updated_at", expectedUpdatedAt\)\s*\n\s*\.select\("share_code"\)\s*\n\s*\.maybeSingle\(\);/.test(reactivate);
  if (reactivateCasUpdate) {
    ok("reactivateExistingShare(Case B): CAS UPDATEにis_shared=false・updated_at=expectedの両条件がある");
  } else {
    bad("reactivateExistingShareのCAS UPDATE条件が想定した形で見つからない");
  }
  const reactivateReturnsDbCodeOnSuccess = /if \(data\) \{\s*\n\s*if \(!data\.share_code\) return \{ kind: "conflict" \};\s*\n\s*return \{ kind: "ok", shareCode: data\.share_code \};\s*\n\s*\}/.test(reactivate);
  if (reactivateReturnsDbCodeOnSuccess) {
    ok("reactivateExistingShare(Case B): CAS成功時はDB返却値(data.share_code)をsource of truthにする");
  } else {
    bad("reactivateExistingShareのCAS成功時レスポンスが想定した形で見つからない");
  }

  // --- 9. reactivateExistingShare(Case C/D): CAS miss時は所有権条件付きで
  //          再取得し、is_shared=trueなら成功(Case D)、is_shared=falseまたは
  //          share_code欠如ならconflict(Case C)を返すこと。無条件の再UPDATE
  //          は発生しないこと。 ---
  const reactivateRefetchesOnCasMiss = /const \{ data: current, error: refetchError \} = await supabase\s*\n\s*\.from\("word_books"\)\s*\n\s*\.select\("share_code, is_shared, source_type"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", userId\)\s*\n\s*\.maybeSingle\(\);/.test(reactivate);
  if (reactivateRefetchesOnCasMiss) {
    ok("reactivateExistingShare: CAS miss時、所有権条件(id+user_id)付きで現在の状態を再取得する");
  } else {
    bad("reactivateExistingShareのCAS miss時再取得クエリが想定した形で見つからない");
  }
  const reactivateCaseDReturnsDbCode = /if \(current\.share_code && current\.is_shared\) \{[\s\S]{0,120}return \{ kind: "ok", shareCode: current\.share_code \};/.test(reactivate);
  if (reactivateCaseDReturnsDbCode) {
    ok("reactivateExistingShare(Case D): 再取得でis_shared=trueなら(別のenableが先に勝っていた)DB codeで成功扱いにする");
  } else {
    bad("reactivateExistingShare(Case D)のis_shared=true分岐が想定した形で見つからない");
  }
  const reactivateCaseCReturnsConflict = /return \{ kind: "conflict" \};\s*\n\}/.test(reactivate);
  if (reactivateCaseCReturnsConflict) {
    ok("reactivateExistingShare(Case C): 再取得でis_shared=false(または想定外の状態)ならconflictを返し、再有効化しない");
  } else {
    bad("reactivateExistingShare(Case C)のconflict分岐が見つからない");
  }
  const reactivateNoSecondUpdateAttempt = (reactivate.match(/\.update\(/g) || []).length === 1;
  if (reactivateNoSecondUpdateAttempt) {
    ok("reactivateExistingShare: CAS miss後の再取得パスに2回目のUPDATE試行が存在しない(無限retryしない、conflictで即座に返す)");
  } else {
    bad("reactivateExistingShareに想定外の複数UPDATE呼び出しが検出された");
  }

  // --- 10. reactivateResultToResponse: 各kindが正しいHTTPステータスへ
  //           マッピングされること ---
  const mapsErrorTo500 = /case "error":\s*\n\s*return NextResponse\.json\(\{ error: "update_failed" \}, \{ status: 500 \}\);/.test(source);
  const mapsVerificationFailedTo500 = /case "verification_failed":\s*\n\s*return NextResponse\.json\(\{ error: "verification_failed" \}, \{ status: 500 \}\);/.test(source);
  const mapsNotFoundTo404 = /case "not_found":\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(source);
  const mapsNonCustomTo403 = /case "non_custom_source":\s*\n\s*return NextResponse\.json\(\{ error: "non_custom_source", message: NON_CUSTOM_SOURCE_MESSAGE \}, \{ status: 403 \}\);/.test(source);
  const mapsConflictTo409 = /case "conflict":\s*\n\s*return NextResponse\.json\(\{ error: "conflict" \}, \{ status: 409 \}\);/.test(source);
  const mapsOkTo200 = /case "ok":\s*\n\s*return NextResponse\.json\(\{ ok: true, share_code: result\.shareCode \}\);/.test(source);
  if (mapsErrorTo500 && mapsVerificationFailedTo500 && mapsNotFoundTo404 && mapsNonCustomTo403 && mapsConflictTo409 && mapsOkTo200) {
    ok("reactivateResultToResponse: error/verification_failed→500・not_found→404・non_custom_source→403・conflict→409・ok→200のすべてが正しくマッピングされる");
  } else {
    bad(`reactivateResultToResponseのマッピングに不足がある(error=${mapsErrorTo500}, verification_failed=${mapsVerificationFailedTo500}, not_found=${mapsNotFoundTo404}, non_custom=${mapsNonCustomTo403}, conflict=${mapsConflictTo409}, ok=${mapsOkTo200})`);
  }

  // --- 11. POST(Case E): 新規share_code割当UPDATEに.is("share_code", null)と
  //           .eq("updated_at", book.updated_at)の両方が必須で付いていること
  //           (初回read後の別mutationによるstale write防止) ---
  const casUpdateHasIsShareCodeNullAndVersion = /\.update\(\{ share_code: shareCode, is_shared: true \}\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)\s*\n\s*\.is\("share_code", null\)\s*\n\s*\.eq\("updated_at", book\.updated_at\)/.test(post);
  if (casUpdateHasIsShareCodeNullAndVersion) {
    ok("POST(Case E): 新規share_code割当UPDATEに.is(\"share_code\", null)と.eq(\"updated_at\", book.updated_at)の両方がある(compare-and-set+version CAS)");
  } else {
    bad("POST(Case E): 新規share_code割当UPDATEのcompare-and-set+version CAS条件が見つからない");
  }

  // --- 12. POST: 割当成功時、ローカル生成したshareCodeではなくUPDATE結果(DBが
  //           実際に書き込んだ値)をレスポンスのsource of truthにしていること ---
  const returnsDbValueOnAssignSuccess = /if \(updated\) \{\s*\n\s*return NextResponse\.json\(\{ ok: true, share_code: updated\.share_code \}\);/.test(post);
  if (returnsDbValueOnAssignSuccess) {
    ok("POST: 新規割当成功時はUPDATE結果(updated.share_code)をレスポンスのsource of truthにする(ローカル変数を無条件に返さない)");
  } else {
    bad("POST: 新規割当成功時のレスポンスがUPDATE結果由来になっていない疑いがある");
  }

  // --- 13. POST: unique collision(23505)の場合だけ最大5回リトライすること
  //           (同じbook.updated_atをexpected versionとして使い続ける。23505は
  //           UPDATE自体が成立していないためversionの問題ではない) ---
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
  const hasCodeGenerationFailedFallback = /return NextResponse\.json\(\{ error: "code_generation_failed" \}, \{ status: 500 \}\);/.test(post);
  if (hasCodeGenerationFailedFallback) {
    ok("POST: 5回リトライしても成功しない場合は安全なcode_generation_failedを返す");
  } else {
    bad("POST: リトライ上限到達時のcode_generation_failedフォールバックが見つからない");
  }
  const usesCryptoRandomBytes = /randomBytes\(12\)\.toString\("base64url"\)/.test(source);
  const usesMathRandom = /Math\.random\(\)/.test(source);
  if (usesCryptoRandomBytes && !usesMathRandom) {
    ok("share code生成はnode:cryptoのrandomBytes(12).toString(\"base64url\")を使用し、Math.random()は使用していない");
  } else {
    bad(`share code生成方式が想定と異なる(cryptoRandomBytes=${usesCryptoRandomBytes}, mathRandom=${usesMathRandom})`);
  }

  // --- 14. POST(Case E続き): CAS miss後、share_codeが依然nullの場合は
  //           500 update_failedではなく409 conflictを返すこと(stale mutationの
  //           可能性を考慮し、無限retryせず安全に失敗させる) ---
  const staleNullShareCodeIsConflict = /\/\/ share_codeが依然null[\s\S]{0,200}return NextResponse\.json\(\{ error: "conflict" \}, \{ status: 409 \}\);\s*\n\s*\}\s*\n\s*return NextResponse\.json\(\{ error: "code_generation_failed" \}/.test(post);
  if (staleNullShareCodeIsConflict) {
    ok("POST(Case E): CAS miss後もshare_codeが依然nullの場合、update_failedではなく409 conflictを返す(stale mutationの可能性、無限retryしない)");
  } else {
    bad("POST(Case E): share_code依然null時のconflict(409)分岐が見つからない");
  }

  // --- 15. POST: CAS miss再取得後、share_codeが既に確定していればis_sharedの
  //           真偽で分岐すること(true→そのまま返す、false→安全にconflict) ---
  const casMissShareCodeIsSharedTrueReturnsCurrent = /if \(current\.share_code\) \{[\s\S]{0,120}if \(current\.is_shared\) \{\s*\n\s*return NextResponse\.json\(\{ ok: true, share_code: current\.share_code \}\);/.test(post);
  if (casMissShareCodeIsSharedTrueReturnsCurrent) {
    ok("POST: CAS miss後、競合リクエストが既にis_shared=trueへ確定させていた場合はそのDB上のcodeをそのまま返す");
  } else {
    bad("POST: CAS miss後のis_shared=true分岐が想定した形で見つからない");
  }
  const noReactivateCallInCasMissBranch = (() => {
    const branchMatch = post.match(/if \(current\.share_code\) \{[\s\S]*?return NextResponse\.json\(\{ error: "conflict" \}, \{ status: 409 \}\);\s*\n\s*\}/);
    const branch = branchMatch ? branchMatch[0] : "";
    return branch.length > 0 && !/reactivateExistingShare\(/.test(branch);
  })();
  if (noReactivateCallInCasMissBranch) {
    ok("POST: CAS miss後のshare_code既存分岐内でreactivateExistingShareを呼んでいない(is_shared=falseを黙って再有効化しない)");
  } else {
    bad("POST: CAS miss後のshare_code既存分岐がreactivateExistingShareを呼んでいる疑いがある(意図しない再共有のリスク)");
  }

  // --- 16. POST: 所有権条件(user_id)が主要経路に含まれること ---
  const postOwnershipInSelect = /\.select\("id, share_code, is_shared, source_type, updated_at"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("user_id", user\.id\)/.test(post);
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
    ok("reactivateExistingShare: UPDATE・再取得の両方にuser_id所有権条件が含まれる");
  } else {
    bad("reactivateExistingShare: user_id所有権条件が見つからない");
  }

  // --- 17. DELETE(Case F): 存在確認を先に行い、無ければ404を返すこと(成功扱いしない) ---
  const deleteChecksExistenceFirst = /const \{ data: book, error: fetchError \} = await supabase[\s\S]{0,150}if \(fetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "fetch_failed" \}, \{ status: 500 \}\);\s*\n\s*\}\s*\n\s*if \(!book\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(del);
  if (deleteChecksExistenceFirst) {
    ok("DELETE: 存在・所有権を先に確認し、fetch error=500・データなし=404を区別して返す(存在しない/他人の単語帳を成功扱いしない)");
  } else {
    bad("DELETE: 存在確認+404分岐が想定した形で見つからない");
  }

  // --- 18. DELETE(Case F): version CASを行わず(updated_at条件を付けず)常に
  //           is_shared=falseへ更新すること。trg_touch_word_booksトリガーに
  //           よりversionは自動的に進む旨のコメントが記載されていること。 ---
  const deleteDoesNotUseVersionCas = !/\.update\(\{ is_shared: false \}\)[\s\S]{0,100}\.eq\("updated_at"/.test(del);
  if (deleteDoesNotUseVersionCas) {
    ok("DELETE(Case F): version CAS(updated_at条件)を行わず、常にis_shared=falseへ更新する(共有停止という最新操作を無条件に反映する)");
  } else {
    bad("DELETE: 想定外のupdated_at CAS条件が付いている(DELETEはversionを進める側であるべき)");
  }
  const deleteDocumentsVersionAdvancement = /trg_touch_word_books.*トリガー.*により.*updated_at.*自動的.*進む|トリガーにより.*このUPDATEでもupdated_atが自動的にnow/s.test(del);
  if (deleteDocumentsVersionAdvancement) {
    ok("DELETE: trg_touch_word_booksトリガーによりupdated_atが自動的に進み、古いPOSTのCASを失敗させる旨がコメントで明文化されている");
  } else {
    bad("DELETEのversion advancementに関する説明コメントが見つからない");
  }
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

  // --- 19. DELETE: 所有権条件(user_id)がselect・updateの両方に含まれること ---
  const deleteOwnershipCount = (del.match(/\.eq\("user_id", user\.id\)/g) || []).length;
  if (deleteOwnershipCount >= 2) {
    ok(`DELETE: user_id所有権条件が計${deleteOwnershipCount}箇所(select+update)に含まれる`);
  } else {
    bad(`DELETE: user_id所有権条件の使用回数が想定より少ない(${deleteOwnershipCount}件)`);
  }

  // --- 20. DELETE: share_code自体を削除していないこと(再共有時に同じURLを再利用する方針) ---
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
