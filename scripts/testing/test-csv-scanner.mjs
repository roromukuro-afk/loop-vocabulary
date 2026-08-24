/**
 * src/lib/utils/csvScanner.mjs(wordListCleaner.tsとcsvImportParsing.tsが共有する
 * RFC CSV/TSV構造スキャナー)単体の直接テスト。両ファイル経由の統合テストは
 * test-word-list-cleaner-parser.mjs / test-word-list-cleaner-csv-differential.mjs
 * 側でカバーしているが、こちらは共有スキャナーの生の入出力契約(bare quote、
 * escaped ""、quoted newline、CRLF、delimiter内包、末尾空セル)を関数単位で
 * 直接固定する。
 *
 * 使い方: node scripts/testing/test-csv-scanner.mjs
 */
import { splitCsvRecords, splitCsvFields } from "../../src/lib/utils/csvScanner.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) ok(msg);
  else bad(`${msg}: actual=${a}, expected=${e}`);
}

function main() {
  // ---- splitCsvFields: 基本のカンマ分割 ----
  eq(splitCsvFields("a,b,c", ","), ["a", "b", "c"], "基本のカンマ区切り3フィールド");
  eq(splitCsvFields("a\tb\tc", "\t"), ["a", "b", "c"], "基本のタブ区切り3フィールド");

  // ---- bare quote(フィールド途中の単一"、区切り文字でも何でもない記号) ----
  eq(splitCsvFields('5" unit', ","), ['5" unit'], "フィールド途中の単一\"(インチ記号)は文字として保持される");
  eq(splitCsvFields('a,5" unit,c', ","), ["a", '5" unit', "c"], "2つ目のフィールド途中の単一\"も保持される");

  // ---- クォートされたフィールド(先頭がクォート) ----
  eq(splitCsvFields('"a,b",c', ","), ["a,b", "c"], "クォートされたフィールド内のカンマは区切りとして扱われない");
  eq(splitCsvFields('"a\tb"\tc', "\t"), ["a\tb", "c"], "タブ区切りでもクォートされたフィールド内のタブは区切りとして扱われない");

  // ---- escaped ""(doubled quote) ----
  eq(splitCsvFields('"say ""hi""",b', ","), ['say "hi"', "b"], 'エスケープされた""は1つの"として復元される');

  // ---- 末尾の空セル ----
  eq(splitCsvFields("a,b,", ","), ["a", "b", ""], "末尾の空セルが保持される(3フィールド目は空文字列)");
  eq(splitCsvFields(",,", ","), ["", "", ""], "全て空セルの行でも3フィールドとして分割される");

  // ---- splitCsvRecords: 基本の改行分割 ----
  eq(splitCsvRecords("a\nb", [","]), ["a", "b"], "LFで2レコードに分割される");
  eq(splitCsvRecords("a\r\nb", [","]), ["a", "b"], "CRLFで2レコードに分割される(CRは吸収される)");
  eq(splitCsvRecords("a\rb", [","]), ["a", "b"], "CR単独でも2レコードに分割される");

  // ---- クォート内の改行(レコードが分断されない) ----
  eq(splitCsvRecords('a,"line1\nline2"\nb', [","]), ['a,"line1\nline2"', "b"], "クォート内の改行はレコード境界として扱われず、1レコードとして保持される");

  // ---- bare quote(レコード分割側。区切り文字でも何でもない記号としての単一") ----
  eq(
    splitCsvRecords('quote: 「"」という記号\napple: りんご', ["\t", ","]),
    ['quote: 「"」という記号', "apple: りんご"],
    "見出し語内のただの記号としての単一\"は、次のレコードを誤って呑み込まない",
  );

  // ---- escaped ""の直後に改行(レコード側) ----
  eq(
    splitCsvRecords('hello,"say ""hi""\nnext line"', [","]),
    ['hello,"say ""hi""\nnext line"'],
    'エスケープされた""の直後に改行があっても、閉じクォートと誤認識せず1レコードのまま',
  );

  // ---- 複数の区切り文字候補(delimiter未確定時のレコード分割、wordListCleaner.tsの
  // 列モード相当) ----
  eq(
    splitCsvRecords('word\tmeaning\tphonetic\nabandon\t捨てる\t/x/', ["\t", ","]),
    ["word\tmeaning\tphonetic", "abandon\t捨てる\t/x/"],
    "タブが区切り文字候補に含まれていれば、タブ区切り行でも正しく2レコードに分割される",
  );

  // ---- 例外を投げないこと(閉じクォートが無い壊れた入力) ----
  try {
    const r1 = splitCsvFields('"unterminated', ",");
    const r2 = splitCsvRecords('"unterminated all the way to EOF', [","]);
    if (Array.isArray(r1) && Array.isArray(r2)) ok("閉じクォートが無い壊れた入力でも例外を投げず配列を返す");
    else bad(`閉じクォート無し入力の戻り値が想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}`);
  } catch (e) {
    bad(`閉じクォート無し入力で例外が発生: ${e.message}`);
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:csv-scanner RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
