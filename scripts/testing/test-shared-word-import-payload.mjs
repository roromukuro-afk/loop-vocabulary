/**
 * Issue #81 production acceptance failure: buildImportedWordRows() の実行時
 * regression test。
 *
 * 背景: 旧実装は`words.map((w) => ({ ...w, id: undefined, ... }))`としていたが、
 * `w`はそもそも`select("word, meaning, pos, phonetic, importance")`の結果であり
 * `id`を持たない。`id: undefined`を明示的に追加すると、単一object insertでは
 * JSON.stringifyでキーごと消えるため問題化しないが、bulk array insert(Supabase
 * JS clientが配列の各objectを揃った列集合として送信する際の挙動)では`id`が
 * 明示的な`null`としてシリアライズされ、words.id(NOT NULL)制約違反で本番の
 * `POST /api/wordbook/[id]/import-shared`が(1語のみの場合ですら)常に500で
 * 失敗していた(実測: Issue #81 production acceptance参照)。
 *
 * このテストは実際にhelperを実行し、出力objectに`id`というown propertyが
 * 存在しないこと(値がnull/undefinedではなく、キー自体が無いこと)を検証する。
 * ソーステキストの静的検証だけでは、この種の「JSON化時の挙動差」は検出できない。
 *
 * 使い方: node scripts/testing/test-shared-word-import-payload.mjs
 */
import { buildImportedWordRows } from "../../src/lib/wordbooks/buildImportedWordRows.ts";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  const USER_ID = "11111111-1111-1111-1111-111111111111";
  const BOOK_ID = "22222222-2222-2222-2222-222222222222";

  // --- Case A: 1 word ---
  const singleSource = [
    { word: "apple", meaning: "りんご", pos: "noun", phonetic: "ˈæpəl", importance: 1 },
  ];
  const singleSourceSnapshot = JSON.parse(JSON.stringify(singleSource));
  const singleRows = buildImportedWordRows(singleSource, USER_ID, BOOK_ID);

  if (singleRows.length === 1) ok("Case A: 1語入力に対し1行出力される");
  else bad(`Case A: 出力行数が想定外(${singleRows.length})`);

  if (!Object.hasOwn(singleRows[0], "id")) ok("Case A: 出力objectに`id`というown propertyが存在しない");
  else bad("Case A: 出力objectに`id`プロパティが存在してしまっている(null/undefinedを問わず不可)");

  if (singleRows[0].user_id === USER_ID) ok("Case A: user_idがdestination ownerに設定される");
  else bad(`Case A: user_idが想定外(${singleRows[0].user_id})`);

  if (singleRows[0].word_book_id === BOOK_ID) ok("Case A: word_book_idがdestination bookに設定される");
  else bad(`Case A: word_book_idが想定外(${singleRows[0].word_book_id})`);

  if (
    singleRows[0].word === "apple" &&
    singleRows[0].meaning === "りんご" &&
    singleRows[0].pos === "noun" &&
    singleRows[0].phonetic === "ˈæpəl" &&
    singleRows[0].importance === 1
  ) {
    ok("Case A: word/meaning/pos/phonetic/importanceがsourceと一致する");
  } else {
    bad(`Case A: source fieldsが一致しない: ${JSON.stringify(singleRows[0])}`);
  }

  // --- Case B: 3 words (本番で実際に壊れたbulk arrayケース) ---
  const multiSource = [
    { word: "apple", meaning: "りんご", pos: "noun", phonetic: "ˈæpəl", importance: 1 },
    { word: "run", meaning: "走る", pos: "verb", phonetic: null, importance: 2 },
    { word: "quickly", meaning: "素早く", pos: "adverb", phonetic: null, importance: 3 },
  ];
  const multiRows = buildImportedWordRows(multiSource, USER_ID, BOOK_ID);

  if (multiRows.length === 3) ok("Case B: 3語入力に対し3行出力される");
  else bad(`Case B: 出力行数が想定外(${multiRows.length})`);

  const allNoIdProp = multiRows.every((row) => !Object.hasOwn(row, "id"));
  if (allNoIdProp) ok("Case B: 3行すべてに`id`というown propertyが存在しない(本番で実際に壊れたbulk arrayケース)");
  else bad("Case B: いずれかの行に`id`プロパティが存在してしまっている");

  const allOwnershipCorrect = multiRows.every((row) => row.user_id === USER_ID && row.word_book_id === BOOK_ID);
  if (allOwnershipCorrect) ok("Case B: 3行すべてでuser_id/word_book_idが正しく設定されている");
  else bad("Case B: user_id/word_book_idが一部の行で想定外");

  // --- Case C: JSON serialization(Supabase JS clientが実際に送るペイロード相当) ---
  const serialized = JSON.stringify(multiRows);
  if (!serialized.includes('"id":null')) {
    ok('Case C: JSON serialization結果に"id":nullが含まれない');
  } else {
    bad('Case C: JSON serialization結果に"id":nullが含まれてしまっている(本番で実際に発生した不具合そのもの)');
  }
  if (!/"id"\s*:/.test(serialized)) {
    ok('Case C: JSON serialization結果に"id"プロパティ自体が一切含まれない');
  } else {
    bad('Case C: JSON serialization結果に"id"プロパティが含まれてしまっている');
  }

  // --- Case D: source immutable(helper実行前後でsource inputが変更されない) ---
  if (JSON.stringify(singleSource) === JSON.stringify(singleSourceSnapshot)) {
    ok("Case D: helper実行後もsource inputが変更されていない(mutationしない)");
  } else {
    bad("Case D: helper実行によりsource inputが変更されてしまっている");
  }

  console.log(`\n=== test:shared-word-import-payload RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
