/**
 * /tools/word-list-cleaner の整形ロジック(src/lib/utils/wordListCleaner.ts)の
 * regression test。
 *
 * 使い方: node scripts/testing/test-word-list-cleaner-parser.mjs
 */
import { parseWordListLine, parseWordList, toWordbookCsv } from "../../src/lib/utils/wordListCleaner.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  // ---- parseWordListLine: 各種区切り文字 ----
  const DELIMITER_CASES = [
    ["apple\tりんご", { word: "apple", meaning: "りんご" }],
    ["apple: りんご", { word: "apple", meaning: "りんご" }],
    ["apple：りんご", { word: "apple", meaning: "りんご" }],
    ["apple - りんご", { word: "apple", meaning: "りんご" }],
    ["apple-りんご", { word: "apple", meaning: "りんご" }],
    ["apple,りんご", { word: "apple", meaning: "りんご" }],
    ["apple  りんご", { word: "apple", meaning: "りんご" }],
    ["apple りんご", { word: "apple", meaning: "りんご" }], // 単一スペース(ラテン→日本語境界)
  ];
  for (const [input, expected] of DELIMITER_CASES) {
    const result = parseWordListLine(input);
    if (result && result.word === expected.word && result.meaning === expected.meaning) {
      ok(`区切り文字を正しく解析: ${JSON.stringify(input)} → ${JSON.stringify(result)}`);
    } else {
      bad(`区切り文字の解析が想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
    }
  }

  // ---- 複数区切り文字が同じ行にある場合、最も左側の出現を優先する ----
  {
    // "run: 走る, 経営する" は最初のコロンで分割されるべき(カンマはmeaning側)
    const result = parseWordListLine("run: 走る, 経営する");
    if (result?.word === "run" && result?.meaning === "走る, 経営する") {
      ok("複数区切り文字が同じ行にある場合、最も左側の出現(コロン)を優先する");
    } else {
      bad(`最左優先の解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- 区切り文字が全く無い行 -> null(スキップ扱い) ----
  {
    const result = parseWordListLine("apple");
    if (result === null) ok("区切り文字が無い行(単語のみ)はnullを返す");
    else bad(`区切り文字が無い行がnullにならなかった: ${JSON.stringify(result)}`);
  }

  // ---- word/meaning のどちらかが空になる行 -> null ----
  {
    const r1 = parseWordListLine("apple:");
    const r2 = parseWordListLine(": りんご");
    if (r1 === null && r2 === null) ok("wordまたはmeaningが空になる行はnullを返す");
    else bad(`空フィールドの行が想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}`);
  }

  // ---- parseWordList: 複数行、空行スキップ、スキップ行番号の記録 ----
  {
    const text = "apple: りんご\n\nbanana: バナナ\nこれは解析できない行\ncherry: さくらんぼ";
    const result = parseWordList(text);
    if (
      result.entries.length === 3 &&
      result.entries[0].word === "apple" &&
      result.entries[1].word === "banana" &&
      result.entries[2].word === "cherry" &&
      result.skippedLineNumbers.length === 1 &&
      result.skippedLineNumbers[0] === 4
    ) {
      ok("複数行の解析: 空行はスキップ扱いにせず無視し、解析不能行のみ行番号を記録する(4行目)");
    } else {
      bad(`複数行の解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- parseWordList: 空文字列 -> 0件 ----
  {
    const result = parseWordList("");
    if (result.entries.length === 0 && result.skippedLineNumbers.length === 0) {
      ok("空文字列の入力は0件・スキップ0件を返す(エラーにしない)");
    } else {
      bad(`空文字列の解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- toWordbookCsv: ヘッダ行 + 基本行 ----
  {
    const csv = toWordbookCsv([{ word: "apple", meaning: "りんご" }, { word: "banana", meaning: "バナナ" }]);
    const expected = "word,meaning\r\napple,りんご\r\nbanana,バナナ";
    if (csv === expected) ok("toWordbookCsv: ヘッダ行+基本行を正しく出力する");
    else bad(`toWordbookCsv基本ケースが想定外: ${JSON.stringify(csv)}`);
  }

  // ---- toWordbookCsv: カンマ・ダブルクォート・改行を含む値は正しくクォートされる ----
  {
    const csv = toWordbookCsv([{ word: "run", meaning: '走る, "急ぐ"' }]);
    const expected = 'word,meaning\r\nrun,"走る, ""急ぐ"""';
    if (csv === expected) ok('toWordbookCsv: カンマ・ダブルクォートを含む値がRFC4180準拠でクォート/エスケープされる');
    else bad(`toWordbookCsvのクォート処理が想定外: ${JSON.stringify(csv)}(期待値: ${JSON.stringify(expected)})`);
  }

  // ---- 往復確認: toWordbookCsv の出力を CsvImportPanel.tsx と同じロジックで
  // パースし直しても word/meaning が復元されることを確認する(このツールの
  // 存在意義そのものの検証: 出力が実際にwordbookインポート機能で使える形式か)。
  {
    // CsvImportPanel.tsx の parseLine/parseCsv を独立に再実装せず、ここでは
    // ヘッダ行の存在とクォート往復性のみを直接検証する(実際のparseCsvの
    // ヘッダ検出ロジック自体は既存のCsvImportPanel.tsx側でテスト済み)。
    const entries = [{ word: "don't", meaning: '"ない" という意味' }];
    const csv = toWordbookCsv(entries);
    const dataLine = csv.split("\r\n")[1];
    // 素朴なCSV分割(ダブルクォートの中のカンマは無視する)で復元できるか確認
    const m = /^([^,]*),"(.*)"$/.exec(dataLine) ?? /^([^,]*),(.*)$/.exec(dataLine);
    const restoredWord = m?.[1];
    const restoredMeaning = m?.[2]?.replace(/""/g, '"');
    if (restoredWord === entries[0].word && restoredMeaning === entries[0].meaning) {
      ok("往復確認: クォートされた値も元のword/meaningへ復元できる");
    } else {
      bad(`往復確認が想定外: word=${JSON.stringify(restoredWord)}, meaning=${JSON.stringify(restoredMeaning)}`);
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:word-list-cleaner-parser RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
