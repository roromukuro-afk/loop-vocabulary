/**
 * Issue #81: src/app/api/wordbook/[id]/import-shared/route.ts のエラーハンドリング・
 * 処理順序の契約を検証する。
 *
 * ## なぜソースコード確認方式なのか
 * このrouteはNext.jsのリクエストコンテキスト・実DBアクセスに依存する
 * createClient()/createAdminClient()を使用しており、プレーンなNodeスクリプト
 * から直接import・実行することができない(サーバー起動が必須)。既存の
 * scripts/testing/test-wordbook-import-rollback-invariant.mjsと同じ理由で、
 * ソースコードのテキスト構造・位置関係を直接検証する決定論的テストとする。
 * 実DBへの接続・DDL実行・DML実行・実HTTP呼び出しはいずれも一切発生しない。
 * wordbook_created発火順序・cleanup契約自体は既存の
 * test-wordbook-import-rollback-invariant.mjsが引き続き検証する(本テストは
 * それに追加して、共有元取得の順序・source_type条件・エラーコードを検証する)。
 *
 * 使い方: node scripts/testing/test-wordbook-import-shared-api.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_PATH = resolve(__dirname, "../../src/app/api/wordbook/[id]/import-shared/route.ts");
const HELPER_PATH = resolve(__dirname, "../../src/lib/wordbooks/buildImportedWordRows.ts");

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  // CRLF/LF環境差(Windows checkout時のcore.autocrlf変換等)に依存しないよう、
  // 改行コードを正規化してから検証する。
  const source = readFileSync(ROUTE_PATH, "utf8").replace(/\r\n/g, "\n");
  const helperSource = readFileSync(HELPER_PATH, "utf8").replace(/\r\n/g, "\n");

  // --- 1. 共有元book取得はis_shared=trueかつsource_type="custom"を条件にすること
  //         (公開ページと同じ多層防御。市販教材が誤ってsharedになっていても
  //         source_type条件でここでも拒否される) ---
  const bookFetchHasSourceTypeCondition = /\.from\("word_books"\)\s*\n\s*\.select\("id, title, description, level, exam_type"\)\s*\n\s*\.eq\("id", id\)\s*\n\s*\.eq\("is_shared", true\)\s*\n\s*\.eq\("source_type", "custom"\)/.test(source);
  if (bookFetchHasSourceTypeCondition) {
    ok("共有元word_books取得はis_shared=trueとsource_type=\"custom\"の両方を条件にする");
  } else {
    bad("共有元word_books取得の条件(is_shared+source_type)が想定した形で見つからない");
  }

  // --- 2. 共有元book取得のerrorを確認し、safe 500(source_book_fetch_failed)を返すこと ---
  const bookFetchErrorChecked = /if \(bookFetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "source_book_fetch_failed" \}, \{ status: 500 \}\);/.test(source);
  if (bookFetchErrorChecked) {
    ok("共有元book取得のerrorを確認し、safe 500 source_book_fetch_failedを返す");
  } else {
    bad("共有元book取得のerrorチェックが想定した形で見つからない");
  }

  // --- 3. book不存在(未共有・非custom含む)は404 not_foundを返すこと ---
  const notFoundIs404 = /if \(!book\) \{\s*\n\s*return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(source);
  if (notFoundIs404) {
    ok("book不存在(未共有・source_type不一致いずれも含む)は404 not_foundを返す");
  } else {
    bad("book不存在時の404分岐が想定した形で見つからない");
  }

  // --- 4. 共有元words取得のerrorを確認し、safe 500(source_words_fetch_failed)を返すこと ---
  const wordsFetchErrorChecked = /if \(wordsFetchError\) \{\s*\n\s*return NextResponse\.json\(\{ error: "source_words_fetch_failed" \}, \{ status: 500 \}\);/.test(source);
  if (wordsFetchErrorChecked) {
    ok("共有元words取得のerrorを確認し、safe 500 source_words_fetch_failedを返す");
  } else {
    bad("共有元words取得のerrorチェックが想定した形で見つからない");
  }

  // --- 5. 処理順序: 共有元words取得(select)が新規word_books作成(insert)より前にあること
  //         (新規wordbookを作る前に共有元wordsの取得成功を確認する設計) ---
  const sourceWordsSelectIdx = source.indexOf('.from("words")\n    .select("word, meaning, pos, phonetic, importance")');
  const newBookInsertIdx = source.indexOf('.from("word_books").insert({');
  if (sourceWordsSelectIdx > 0 && newBookInsertIdx > 0 && sourceWordsSelectIdx < newBookInsertIdx) {
    ok("共有元wordsのselectが新規word_books insertより前のコード位置にある(取得失敗時に空コピーを作らない設計)");
  } else {
    bad(`共有元wordsのselectと新規word_books insertの位置関係が想定と異なる(words select=${sourceWordsSelectIdx}, book insert=${newBookInsertIdx})`);
  }

  // --- 6. 新規word_books insertのerrorを確認し、safe 500(import_book_create_failed)を返すこと ---
  const bookInsertErrorChecked = /if \(bookErr \|\| !newBook\) \{\s*\n\s*return NextResponse\.json\(\{ error: "import_book_create_failed" \}, \{ status: 500 \}\);/.test(source);
  if (bookInsertErrorChecked) {
    ok("新規word_books insertのerrorを確認し、safe 500 import_book_create_failedを返す");
  } else {
    bad("新規word_books insertのerrorチェックが想定した形で見つからない");
  }

  // --- 7. words insert失敗時、cleanup(word_books削除)のerrorも確認すること ---
  const cleanupErrorChecked = /const \{ error: cleanupError \} = await supabase\.from\("word_books"\)\.delete\(\)\.eq\("id", newBook\.id\);\s*\n\s*if \(cleanupError\) \{/.test(source);
  if (cleanupErrorChecked) {
    ok("words insert失敗後のcleanup(word_books削除)自体のerrorも確認する");
  } else {
    bad("cleanupのerrorチェックが想定した形で見つからない");
  }
  const cleanupFailureSafeResponse = /return NextResponse\.json\(\{ error: "import_cleanup_failed" \}, \{ status: 500 \}\);/.test(source);
  if (cleanupFailureSafeResponse) {
    ok("cleanup自体が失敗した場合も安全なimport_cleanup_failed codeを返す(テストで検出可能)");
  } else {
    bad("cleanup失敗時の安全なレスポンスが見つからない");
  }
  const wordsInsertFailureSafeResponse = /return NextResponse\.json\(\{ error: "import_words_create_failed" \}, \{ status: 500 \}\);/.test(source);
  if (wordsInsertFailureSafeResponse) {
    ok("words insert失敗(cleanup成功時)は安全なimport_words_create_failedを返す");
  } else {
    bad("words insert失敗時の安全なレスポンスが見つからない");
  }

  // --- 8. cleanup失敗時、DB詳細・email・request bodyをログへ出していないこと ---
  const cleanupLogLine = source.match(/console\.error\("import-shared:[^)]*\)/)?.[0] ?? "";
  const cleanupLogLeaksDetails = /email|password|token|req\.body|request body/i.test(cleanupLogLine);
  if (cleanupLogLine && !cleanupLogLeaksDetails) {
    ok("cleanup失敗ログにemail・token・request body等の機微情報を含めていない(codeのみ)");
  } else if (!cleanupLogLine) {
    bad("cleanup失敗時のログ出力が見つからない");
  } else {
    bad("cleanup失敗ログに機微情報が含まれている疑いがある");
  }

  // --- 9. 生のerror.messageをレスポンスへ含めていないこと ---
  const leaksRawErrorMessage = /error:\s*(bookFetchError|wordsFetchError|bookErr|wordsErr|cleanupError)\?\.message|error:\s*(bookFetchError|wordsFetchError|bookErr|wordsErr|cleanupError)\.message/.test(source);
  if (!leaksRawErrorMessage) {
    ok("生のSupabase error.messageをレスポンスへ含めていない");
  } else {
    bad("error.messageがそのままレスポンスへ含まれている疑いがある(生DBエラーの漏洩)");
  }

  // --- 10. analyticsはすべての永続化成功後にのみ発火すること(既存の
  //          test-wordbook-import-rollback-invariant.mjsが発火順序・cleanup契約自体を
  //          検証済みのため、ここではtrackServerEvent呼び出しの存在だけ再確認する) ---
  const hasTrackServerEvent = /trackServerEvent\("wordbook_created"/.test(source);
  if (hasTrackServerEvent) {
    ok("trackServerEvent(\"wordbook_created\", ...)の呼び出しが存在する(発火順序自体はtest-wordbook-import-rollback-invariant.mjsで検証済み)");
  } else {
    bad("trackServerEvent呼び出しが見つからない");
  }

  // --- 11. Issue #81 production acceptance失敗の再発防止: routeがwords insert
  //           payloadの構築を専用helper(buildImportedWordRows)へ委譲していること
  //           (route内で直接`.map()`しない) ---
  const routeDelegatesToHelper = /import \{ buildImportedWordRows \} from "@\/lib\/wordbooks\/buildImportedWordRows";/.test(source)
    && /buildImportedWordRows\(words, user\.id, newBook\.id\)/.test(source);
  if (routeDelegatesToHelper) {
    ok("words insert payloadの構築を専用helper buildImportedWordRowsへ委譲している(route内で直接.map()しない)");
  } else {
    bad("routeがbuildImportedWordRowsへ委譲していない(想定した形で見つからない)");
  }

  // --- 12. route・helperのいずれにも`id: undefined`/`id: null`が存在しないこと
  //           (本番で実際にwords.id NOT NULL違反を起こした原因そのもの。
  //           bulk array insertではSupabase JS clientが`undefined`を明示的な
  //           `null`としてシリアライズするため、単一object insertでは問題化
  //           しない差異が見逃されやすい) ---
  const routeHasIdUndefinedOrNull = /id:\s*undefined/.test(source) || /id:\s*null/.test(source);
  const helperHasIdUndefinedOrNull = /id:\s*undefined/.test(helperSource) || /id:\s*null/.test(helperSource);
  if (!routeHasIdUndefinedOrNull && !helperHasIdUndefinedOrNull) {
    ok("route・helperのいずれにも`id: undefined`/`id: null`が存在しない(本番500の原因を再導入していない)");
  } else {
    bad("route/helperに`id: undefined`または`id: null`が検出された(本番で実際に発生したbug再発の疑い)");
  }

  // --- 13. helperの出力objectがid propertyを一切含まない設計であることを
  //           ソース上でも確認する(スプレッドで`w`のみを展開し、`id`という
  //           キーを明示的に追加していないこと) ---
  const helperOmitsIdEntirely = /return words\.map\(\(w\) => \(\{\s*\n\s*word: w\.word,\s*\n\s*meaning: w\.meaning,\s*\n\s*pos: w\.pos,\s*\n\s*phonetic: w\.phonetic,\s*\n\s*importance: w\.importance,\s*\n\s*user_id: userId,\s*\n\s*word_book_id: wordBookId,\s*\n\s*\}\)\);/.test(helperSource);
  if (helperOmitsIdEntirely) {
    ok("buildImportedWordRowsの出力objectは明示的なfieldのみで構成され、idキーを一切含まない");
  } else {
    bad("buildImportedWordRowsの出力object構成が想定した形で見つからない");
  }

  // --- 14. 共有元words selectが従来どおりidを含まない契約と整合していること
  //           (helper移行後もこの前提が崩れていないことの再確認) ---
  const sourceSelectStillExcludesId = /\.select\("word, meaning, pos, phonetic, importance"\)/.test(source)
    && !/\.select\("id, word, meaning, pos, phonetic, importance"\)/.test(source);
  if (sourceSelectStillExcludesId) {
    ok("共有元words selectは引き続きidを含まない(word, meaning, pos, phonetic, importanceのみ)");
  } else {
    bad("共有元words selectの列構成が想定と異なる(idを含んでしまっている可能性)");
  }

  console.log(`\n=== test:wordbook-import-shared-api RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
