/**
 * /tools/word-list-cleaner の整形ロジック(src/lib/utils/wordListCleaner.ts)の
 * regression test。
 *
 * 使い方: node scripts/testing/test-word-list-cleaner-parser.mjs
 */
import { parseWordListLine, parseWordList, toWordbookCsv, csvWithBom } from "../../src/lib/utils/wordListCleaner.ts";
import { parseCsv } from "../../src/lib/utils/csvImportParsing.ts";

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

  // ---- 単一スペース + 意味が品詞注記(丸括弧)から始まる場合も正しく分割できる
  // (Codexレビュー指摘対応、PR #105、6巡目、P1: 意味が日本語文字ではなく注記の丸括弧
  // から始まる行は境界が一切マッチせずスキップされていた) ----
  const ANNOTATION_CASES = [
    ["apple （名）りんご", { word: "apple", meaning: "（名）りんご" }], // 全角括弧の品詞注記
    ["run (動) 走る", { word: "run", meaning: "(動) 走る" }], // 半角括弧+閉じ括弧後にも空白
  ];
  for (const [input, expected] of ANNOTATION_CASES) {
    const result = parseWordListLine(input);
    if (result && result.word === expected.word && result.meaning === expected.meaning) {
      ok(`品詞注記付きの単一スペース区切りを正しく解析: ${JSON.stringify(input)} → ${JSON.stringify(result)}`);
    } else {
      bad(`品詞注記付きの単一スペース区切りの解析が想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
    }
  }

  // ---- 品詞注記付きの意味に後続のASCIIカンマがあっても、そのカンマではなく
  // ラテン→日本語境界(注記の前)が優先される(Codexレビュー指摘対応、PR #105、6巡目、P1:
  // 修正前はこの境界がマッチせず、後方のカンマが誤って区切りとして採用され
  // wordが"run (動) 走る"のように注記ごと切り詰められていた) ----
  {
    const result = parseWordListLine("run (動) 走る, 経営する");
    if (result?.word === "run" && result?.meaning === "(動) 走る, 経営する") {
      ok("品詞注記付きの意味中の後続カンマに惑わされず、注記直前の境界を優先する");
    } else {
      bad(`品詞注記+後続カンマのケースが想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- 既知の品詞注記ラベル以外の括弧(不規則動詞の活用形等)は、意味側の注記として
  // 誤って扱われず、括弧の中身がwordから静かに失われない(Codexレビュー指摘対応、
  // PR #105、7巡目、P2: 修正前は"(went, gone)"のような活用形の括弧まで品詞注記
  // ショートカットの対象になり、wordが"go"に切り詰められ活用形が意味側へ静かに
  // 移動していた) ----
  {
    const result = parseWordListLine("go (irregular verb) 行く");
    if (result === null) {
      ok("既知の品詞注記ラベルではない括弧は注記ショートカットの対象にならず、内容を書き換えない(null)");
    } else {
      bad(`未知の括弧注記が誤って品詞注記として扱われた: ${JSON.stringify(result)}`);
    }
  }

  // ---- 括弧の中にEXPLICIT_DELIMITERSの文字(カンマ等)が含まれる場合、それを
  // 単語/意味の区切りとして誤検出しない(Codexレビュー指摘対応、PR #105、8巡目、
  // P2: 上の品詞注記ショートカット対象外の修正だけでは、"go (went, gone) 行く"の
  // 括弧内カンマがEXPLICIT_DELIMITERSとして依然検出され、word="go (went"、
  // meaning="gone) 行く"に静かに破損していた。安全側に倒し、活用形の括弧を含む
  // 行は書き換えずnullとしてskippedLineNumbersに委ねる) ----
  {
    const result = parseWordListLine("go (went, gone) 行く");
    if (result === null) {
      ok("活用形の括弧内カンマは区切りとして誤検出されず、内容を書き換えない(null)");
    } else {
      bad(`括弧内カンマが誤って区切りとして使われた: ${JSON.stringify(result)}`);
    }
  }

  // ---- 括弧の外にあるカンマは、これまでどおり正しく区切りとして機能する(回帰確認) ----
  {
    const result = parseWordListLine("run (動) 走る, 経営する");
    if (result?.word === "run" && result?.meaning === "(動) 走る, 経営する") {
      ok("括弧の外のカンマは引き続き正しく無視され、品詞注記直前の境界が優先される(回帰確認)");
    } else {
      bad(`括弧外カンマの回帰確認が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- 日本語文字が最終的に続かない注記付き英語行は、従来どおりマッチしない
  // (誤検出防止の回帰確認) ----
  {
    const result = parseWordListLine("Q&A (note)");
    if (result === null) {
      ok("日本語が続かない注記付き英語行は誤って分割されない(null)");
    } else {
      bad(`日本語が続かない注記付き英語行が誤って分割された: ${JSON.stringify(result)}`);
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
    const { csv, neutralizedCount } = toWordbookCsv([{ word: "apple", meaning: "りんご" }, { word: "banana", meaning: "バナナ" }]);
    const expected = "word,meaning\r\napple,りんご\r\nbanana,バナナ";
    if (csv === expected && neutralizedCount === 0) ok("toWordbookCsv: ヘッダ行+基本行を正しく出力する");
    else bad(`toWordbookCsv基本ケースが想定外: ${JSON.stringify(csv)}, neutralizedCount=${neutralizedCount}`);
  }

  // ---- toWordbookCsv: カンマ・ダブルクォート・改行を含む値は正しくクォートされる ----
  {
    const { csv } = toWordbookCsv([{ word: "run", meaning: '走る, "急ぐ"' }]);
    const expected = 'word,meaning\r\nrun,"走る, ""急ぐ"""';
    if (csv === expected) ok('toWordbookCsv: カンマ・ダブルクォートを含む値がRFC4180準拠でクォート/エスケープされる');
    else bad(`toWordbookCsvのクォート処理が想定外: ${JSON.stringify(csv)}(期待値: ${JSON.stringify(expected)})`);
  }

  // ---- toWordbookCsv: 改行を含む値もCRLF出力の中で正しくクォートされる(CRLF/LF両対応) ----
  {
    const { csv } = toWordbookCsv([{ word: "note", meaning: "1行目\n2行目" }]);
    const expected = 'word,meaning\r\nnote,"1行目\n2行目"';
    if (csv === expected) ok("toWordbookCsv: meaning内の改行(LF)を含む値もクォートされ、出力全体はCRLF区切りを維持する");
    else bad(`改行を含む値の処理が想定外: ${JSON.stringify(csv)}`);
  }

  // ---- CSV Formula Injection対策: = + - @ で始まるセルの先頭に ' が追加される ----
  {
    const cases = [
      { word: "=cmd|'/c calc'!A1", meaning: "危険な数式" },
      { word: "+1", meaning: "プラス記号で始まる語" },
      { word: "-tion", meaning: "接尾辞(名詞化)" },
      { word: "@mention", meaning: "メンション記号" },
    ];
    const { csv, neutralizedCount } = toWordbookCsv(cases);
    const lines = csv.split("\r\n").slice(1);
    const allPrefixed = lines.every((l) => l.startsWith("'"));
    if (allPrefixed && neutralizedCount === 4) {
      ok("formula injection対策: = + - @ で始まる単語の先頭に ' が追加され、neutralizedCountが正しく報告される");
    } else {
      bad(`formula injection対策が想定外: csv=${JSON.stringify(csv)}, neutralizedCount=${neutralizedCount}(期待値: 4件とも'付き、neutralizedCount=4)`);
    }
  }

  // ---- CSV Formula Injection対策: meaning側が該当文字で始まる場合も同様に無害化される ----
  {
    const { csv, neutralizedCount } = toWordbookCsv([{ word: "total", meaning: "=SUM(A1:A10)" }]);
    const expected = "word,meaning\r\ntotal,'=SUM(A1:A10)";
    if (csv === expected && neutralizedCount === 1) {
      ok("formula injection対策: meaning側が=で始まる場合も無害化される(word側は対象外なのでneutralizedCount=1)");
    } else {
      bad(`meaning側のformula injection対策が想定外: ${JSON.stringify(csv)}, neutralizedCount=${neutralizedCount}`);
    }
  }

  // ---- CSV Formula Injection対策: 通常の単語(該当しない)はneutralizedCount=0のまま ----
  {
    const { neutralizedCount } = toWordbookCsv([{ word: "apple", meaning: "りんご" }, { word: "well-being", meaning: "幸福(ハイフンは先頭ではない)" }]);
    if (neutralizedCount === 0) ok("formula injection対策: 先頭以外にハイフン等を含む通常の単語は無害化対象にならない");
    else bad(`通常の単語が誤って無害化対象になった: neutralizedCount=${neutralizedCount}`);
  }

  // ---- csvWithBom: UTF-8 BOM(U+FEFF)がCSV本文の先頭に付与される ----
  {
    const withBom = csvWithBom("word,meaning\r\napple,りんご");
    if (withBom.codePointAt(0) === 0xfeff && withBom.slice(1) === "word,meaning\r\napple,りんご") {
      ok("csvWithBom: ダウンロード用にUTF-8 BOM(U+FEFF)がCSV本文の先頭に付与される");
    } else {
      bad(`csvWithBomの出力が想定外: codePoint=${withBom.codePointAt(0)?.toString(16)}`);
    }
  }

  // ---- parseWordListLine: 既にCSV化された "word","meaning" 形式の貼り付けにも対応する ----
  {
    const result = parseWordListLine('"apple","りんご"');
    if (result?.word === "apple" && result?.meaning === "りんご") {
      ok('quoted CSV: "word","meaning" 形式で貼り付けても、ダブルクォートを剥がして正しく解析する');
    } else {
      bad(`quoted CSVの解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- parseWordListLine: quoted CSVのmeaning側にカンマが含まれていても正しく解析する ----
  {
    const result = parseWordListLine('apple,"an edible fruit, red or green"');
    if (result?.word === "apple" && result?.meaning === "an edible fruit, red or green") {
      ok("quoted CSV: meaning側がダブルクォートで囲まれ内部にカンマを含む場合も正しく分割・復元される");
    } else {
      bad(`quoted CSV(内部カンマ)の解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- parseWordListLine: 絵文字を含む行でも例外を投げず、安全に処理する ----
  {
    const r1 = parseWordListLine("🍎apple: りんご🍎");
    const r2 = parseWordListLine("🍎🍏🍊"); // 区切り文字が無い絵文字だけの行
    const noException = r1 !== undefined && r2 === null;
    if (noException && r1?.word === "🍎apple" && r1?.meaning === "りんご🍎") {
      ok("絵文字を含む行でも例外を投げず、通常の区切り文字判定がそのまま機能する");
    } else {
      bad(`絵文字を含む行の処理が想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}`);
    }
  }

  // ---- parseWordListLine: 意味だけの行(区切り文字が行頭にある) -> null ----
  {
    const r1 = parseWordListLine(",りんご");
    const r2 = parseWordListLine("\tりんご");
    if (r1 === null && r2 === null) ok("意味だけの行(区切り文字が行頭にありwordが空になる)はnullを返す");
    else bad(`意味だけの行の処理が想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}`);
  }

  // ---- parseWordList: 前後の空白は行全体・word・meaningのそれぞれでtrimされる ----
  {
    const result = parseWordList("   apple  :   りんご   ");
    if (result.entries.length === 1 && result.entries[0].word === "apple" && result.entries[0].meaning === "りんご") {
      ok("前後の空白(行全体・word・meaningそれぞれ)が正しくtrimされる");
    } else {
      bad(`空白trimの処理が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- parseWordList: 重複行はそのまま両方とも整形結果に含まれる(意図的な仕様。
  // 「整形ツール」であり「重複排除ツール」ではないため、同じ単語を意図的に複数回
  // 書いたリストを黙って間引かない) ----
  {
    const result = parseWordList("apple: りんご\napple: りんご");
    if (result.entries.length === 2 && result.entries[0].word === "apple" && result.entries[1].word === "apple") {
      ok("重複行は削除せずそのまま両方とも整形結果に含まれる(意図的な仕様)");
    } else {
      bad(`重複行の処理が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- parseWordList: 非常に長い入力(5000行)でも例外を投げず、全行を正しく処理する ----
  {
    const lines = [];
    // "word"を含む語を先頭行に使うとヘッダ判定に誤検出されるため("word0"は
    // isHeaderLineの"word"部分一致に該当する)、あえて衝突しないprefixを使う。
    for (let i = 0; i < 5000; i++) lines.push(`item${i}: 項目${i}`);
    const start = Date.now();
    const result = parseWordList(lines.join("\n"));
    const elapsedMs = Date.now() - start;
    if (result.entries.length === 5000 && result.skippedLineNumbers.length === 0 && elapsedMs < 5000) {
      ok(`非常に長い入力(5000行)でも例外を投げず全行を正しく処理する(${elapsedMs}ms)`);
    } else {
      bad(`長い入力の処理が想定外: entries=${result.entries.length}, skipped=${result.skippedLineNumbers.length}, elapsedMs=${elapsedMs}`);
    }
  }

  // ---- 往復確認: toWordbookCsv の出力を CsvImportPanel.tsx と同じロジックで
  // パースし直しても word/meaning が復元されることを確認する(このツールの
  // 存在意義そのものの検証: 出力が実際にwordbookインポート機能で使える形式か)。
  {
    // CsvImportPanel.tsx の parseLine/parseCsv を独立に再実装せず、ここでは
    // ヘッダ行の存在とクォート往復性のみを直接検証する(実際のparseCsvの
    // ヘッダ検出ロジック自体は既存のCsvImportPanel.tsx側でテスト済み)。
    const entries = [{ word: "don't", meaning: '"ない" という意味' }];
    const { csv } = toWordbookCsv(entries);
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

  // ---- Codexレビュー指摘対応(PR #105、P1): 複合語内部のハイフンを区切り文字として
  // 誤認識せず、直後が日本語のときだけハイフンを区切りとみなす ----
  {
    const cases = [
      ["well-known: 有名な", { word: "well-known", meaning: "有名な" }],
      ["mother-in-law: 義母", { word: "mother-in-law", meaning: "義母" }],
      ["re-enter,再入場する", { word: "re-enter", meaning: "再入場する" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const result = parseWordListLine(input);
      if (result?.word !== expected.word || result?.meaning !== expected.meaning) {
        allOk = false;
        bad(`複合語のハイフンが区切りとして誤認識された: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok("複合語内部のハイフン(well-known/mother-in-law/re-enter)は区切りとして誤認識されず、単語全体が保持される");
  }

  // ---- Codexレビュー指摘対応(PR #105、P2): 1つ目のフィールド自体にカンマを含む
  // quoted CSVで、クォート内側のカンマを区切り文字と誤認識しない ----
  {
    const result = parseWordListLine('"Hello, world","こんにちは世界"');
    if (result?.word === "Hello, world" && result?.meaning === "こんにちは世界") {
      ok("quoted CSV: 1つ目のフィールド自体にカンマを含む場合も、クォート内側のカンマを区切りと誤認識しない");
    } else {
      bad(`クォート内側カンマの誤認識防止が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、P2): 貼り付けられたCSVのヘッダ行
  // (word,meaning / "word","meaning")はダミーエントリとして取り込まれない ----
  {
    const r1 = parseWordList("word,meaning\napple,りんご");
    const r2 = parseWordList('"word","meaning"\napple,りんご');
    const r3 = parseWordList("英単語,意味\napple,りんご");
    const allSingleEntry =
      r1.entries.length === 1 && r1.entries[0].word === "apple" &&
      r2.entries.length === 1 && r2.entries[0].word === "apple" &&
      r3.entries.length === 1 && r3.entries[0].word === "apple";
    if (allSingleEntry) {
      ok("貼り付けられたCSVのヘッダ行(word,meaning / クォート付き / 英単語,意味)はダミーエントリとして取り込まれない");
    } else {
      bad(`ヘッダ行スキップが想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}, r3=${JSON.stringify(r3)}`);
    }
  }

  // ---- ヘッダ判定は入力全体の最初の非空行だけに限定される(2行目以降に"word"を
  // 含む語があっても誤ってスキップしない) ----
  {
    const result = parseWordList("apple: りんご\nkeyword: キーワード");
    if (result.entries.length === 2 && result.entries[0].word === "apple" && result.entries[1].word === "keyword") {
      ok("ヘッダ判定は最初の非空行のみに限定され、2行目以降の偶然の部分一致では誤ってスキップしない");
    } else {
      bad(`ヘッダ判定の範囲限定が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、2巡目、P2): ヘッダ判定はword/meaning
  // フィールドの完全一致のみで行われ、"password"のように"word"を部分的に含むだけの
  // 1行目は正しく通常のエントリとして取り込まれる(サイレントに消えない) ----
  {
    const result = parseWordList("password: パスワード\napple: りんご");
    if (
      result.entries.length === 2 &&
      result.entries[0].word === "password" &&
      result.entries[0].meaning === "パスワード" &&
      result.entries[1].word === "apple"
    ) {
      ok('ヘッダ判定はword/meaningフィールドの完全一致のみで行われ、"password"(wordを部分的に含むだけ)は誤ってヘッダ扱いされない');
    } else {
      bad(`ヘッダ完全一致判定が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- 同様にmeaning側の部分一致(例: "reasoning"が"meaning"を部分的に含む)でも
  // 誤検出しない ----
  {
    const result = parseWordList("logic: reasoning\napple: りんご");
    if (result.entries.length === 2 && result.entries[0].word === "logic" && result.entries[0].meaning === "reasoning") {
      ok('meaning側の部分一致("reasoning"が"meaning"を含む)でもヘッダとして誤検出しない');
    } else {
      bad(`meaning側の部分一致誤検出防止が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、3巡目、P2): meaning側にカンマを含む
  // 空白区切りの行で、ラテン→日本語境界がカンマより右側にあると誤ってカンマが
  // 優先されていた問題(word/meaningの本来の境界より後ろの区切り文字が勝つと、
  // "run 走る"がwordとして切り詰められる) ----
  {
    const result = parseWordListLine("run 走る, 経営する");
    if (result?.word === "run" && result?.meaning === "走る, 経営する") {
      ok('ラテン→日本語境界が、より右側にある明示的区切り文字(カンマ)より優先される("run 走る, 経営する")');
    } else {
      bad(`ラテン→日本語境界の優先順位が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、5巡目、P2): 単語が英字以外(数字・記号)で
  // 終わる場合も、スペース区切りのラテン→日本語境界として認識される
  // (UI上は単一スペースも区切り文字として案内しているため) ----
  {
    const cases = [
      ["COVID-19 新型コロナ", { word: "COVID-19", meaning: "新型コロナ" }],
      ["B2 中級", { word: "B2", meaning: "中級" }],
      ["24/7 常時", { word: "24/7", meaning: "常時" }],
      ["C++ シープラスプラス", { word: "C++", meaning: "シープラスプラス" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const result = parseWordListLine(input);
      if (result?.word !== expected.word || result?.meaning !== expected.meaning) {
        allOk = false;
        bad(`数字/記号で終わる語のスペース区切りが想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok("数字・記号(+ # . /)で終わる語(COVID-19/B2/24/7/C++)も単一スペース区切りとして正しく認識される");
  }

  // ---- Codexレビュー指摘対応(PR #105、3巡目、P2): formula injection対策で
  // 先頭に'を付与したCSVを、実際のインポート先(CsvImportPanel.tsx)で読み直しても
  // 元の値どおりに復元できる(先頭の'が単語の一部として永続的に残らない) ----
  {
    const entries = [
      { word: "-ing", meaning: "〜している(現在分詞)" },
      { word: "sum", meaning: "+44の国番号のように使う" },
    ];
    const { csv } = toWordbookCsv(entries);
    const reimported = parseCsv(csv);
    if (
      reimported.length === 2 &&
      reimported[0].word === "-ing" &&
      reimported[0].meaning === "〜している(現在分詞)" &&
      reimported[1].word === "sum" &&
      reimported[1].meaning === "+44の国番号のように使う"
    ) {
      ok("formula injection対策で先頭に'が付与された値も、CsvImportPanel.parseCsv()で読み直すと元の値どおりに復元される(往復確認)");
    } else {
      bad(`無害化された値の往復確認が想定外: ${JSON.stringify(reimported)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、4巡目、P2): word-list-cleanerの無害化と
  // 無関係な、ユーザーが意図的にアポストロフィで始めた正当な値は取り除かれない
  // ("'cause"・"'Hello,' she said."のような、=+-@のいずれも直後に続かないケース) ----
  {
    const reimported = parseCsv("word,meaning\n'cause,なぜなら(口語)\nquote,\"'Hello,' she said.\"");
    if (
      reimported.length === 2 &&
      reimported[0].word === "'cause" &&
      reimported[0].meaning === "なぜなら(口語)" &&
      reimported[1].word === "quote" &&
      reimported[1].meaning === "'Hello,' she said."
    ) {
      ok('word-list-cleanerの無害化と無関係な、意図的なアポストロフィ始まりの値("\'cause"・"\'Hello,\' she said.")は取り除かれない');
    } else {
      bad(`意図的なアポストロフィの保持が想定外: ${JSON.stringify(reimported)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、9巡目、P2): 意味側にたまたま含まれる
  // punctuation(カンマ等)より、行内に見つかったタブを常に優先する ----
  {
    const cases = [
      ["Hello, world\tこんにちは", { word: "Hello, world", meaning: "こんにちは" }],
      ["8:30\t午前八時半", { word: "8:30", meaning: "午前八時半" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const result = parseWordListLine(input);
      if (result?.word !== expected.word || result?.meaning !== expected.meaning) {
        allOk = false;
        bad(`タブ優先の判定が想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok("行内にタブがあれば、意味側のカンマ・コロン等の位置に関わらずタブを区切りとして優先する");
  }

  // ---- Codexレビュー指摘対応(PR #105、9巡目、P2): 素のハイフンの直後に空白を
  // 挟んだ非対称な区切り("apple- りんご")も認識する ----
  {
    const result = parseWordListLine("apple- りんご");
    if (result?.word === "apple" && result?.meaning === "りんご") {
      ok("素のハイフンの直後に空白を挟んだ区切り(apple- りんご)も正しく認識される");
    } else {
      bad(`ハイフン+空白区切りの解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、9巡目、P2): 3列以上の本物のCSV
  // (word,meaning,phonetic)がそのまま貼り付けられた場合、phonetic列がmeaning側に
  // 畳み込まれず、word/meaning列だけが正しく取り出される ----
  {
    const text = "word,meaning,phonetic\nabandon,捨てる,/əˈbændən/\npersist,固執する,/pɚˈsɪst/";
    const result = parseWordList(text);
    if (
      result.entries.length === 2 &&
      result.entries[0].word === "abandon" &&
      result.entries[0].meaning === "捨てる" &&
      result.entries[1].word === "persist" &&
      result.entries[1].meaning === "固執する" &&
      result.skippedLineNumbers.length === 0
    ) {
      ok("3列以上の本物のCSV(word,meaning,phonetic)はphonetic列を無視し、word/meaning列だけを正しく取り出す");
    } else {
      bad(`3列CSVの解析が想定外: ${JSON.stringify(result)}`);
    }
  }
  // 2列だけのword,meaning CSVも、3列以上と同じ構造的な列モードで正しく解析される
  // (Codexレビュー指摘対応、PR #105、13巡目、P2: 以前は2列をCSV列モードの対象外に
  // していたため、値自体に区切り文字候補を含む本物のCSVが1行ずつのヒューリスティックへ
  // 誤って渡っていた)。
  {
    const result = parseWordList("word,meaning\napple,りんご");
    if (result.entries.length === 1 && result.entries[0].word === "apple" && result.entries[0].meaning === "りんご") {
      ok("2列だけのword,meaning CSVも列モードで正しく解析される");
    } else {
      bad(`2列CSVの回帰確認が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、10巡目、P2): 3列以上のタブ区切り
  // (スプレッドシートからのコピペ)も、CSVと同じ列選択ロジックでphonetic列を無視し、
  // word/meaning列だけを正しく取り出す ----
  {
    const text = "word\tmeaning\tphonetic\nabandon\t捨てる\t/əˈbændən/\npersist\t固執する\t/pɚˈsɪst/";
    const result = parseWordList(text);
    if (
      result.entries.length === 2 &&
      result.entries[0].word === "abandon" &&
      result.entries[0].meaning === "捨てる" &&
      result.entries[1].word === "persist" &&
      result.entries[1].meaning === "固執する" &&
      result.skippedLineNumbers.length === 0
    ) {
      ok("3列以上のタブ区切り(word\\tmeaning\\tphonetic)もphonetic列を無視し、word/meaning列だけを正しく取り出す");
    } else {
      bad(`3列TSVの解析が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、10巡目、P2): ダブルクォートで囲まれた
  // meaningに改行を含む値(toWordbookCsv/csvFieldが実際に出力しうる形式)を貼り直しても、
  // クォート内の改行でレコードが分断されず、正しく1件として復元される(往復確認) ----
  {
    const entries = [{ word: "hello", meaning: "line one\nline two" }];
    const { csv } = toWordbookCsv(entries);
    const result = parseWordList(csv);
    if (
      result.entries.length === 1 &&
      result.entries[0].word === "hello" &&
      result.entries[0].meaning === "line one\nline two" &&
      result.skippedLineNumbers.length === 0
    ) {
      ok("ダブルクォートで囲まれたmeaning内の改行を含むCSVを貼り直しても、クォート内の改行でレコードが分断されず正しく復元される(往復確認)");
    } else {
      bad(`クォート内改行を含むCSVの往復確認が想定外: ${JSON.stringify(result)}`);
    }
  }
  // 通常の(クォートを含まない)複数行入力では、スキップ行番号が引き続き正しい
  // 物理行番号を指す(クォート対応化による回帰確認)。
  {
    const result = parseWordList("apple: りんご\nこの行は解析できない\nbanana: バナナ");
    if (result.entries.length === 2 && result.skippedLineNumbers.length === 1 && result.skippedLineNumbers[0] === 2) {
      ok("クォートを含まない複数行入力でも、スキップ行番号は引き続き正しい物理行番号(2行目)を指す(回帰確認)");
    } else {
      bad(`スキップ行番号の回帰確認が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、11巡目、P2): 見出し語の内部にたまたま
  // カンマ/コロンが含まれる行で、空白による日本語境界がそれより右にある場合、
  // 境界を優先し見出し語を切り詰めない ----
  {
    const cases = [
      ["Hello, world こんにちは世界", { word: "Hello, world", meaning: "こんにちは世界" }],
      ["8:30 午前八時半", { word: "8:30", meaning: "午前八時半" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const result = parseWordListLine(input);
      if (result?.word !== expected.word || result?.meaning !== expected.meaning) {
        allOk = false;
        bad(`空白境界優先の判定が想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok("見出し語内部のカンマ・コロンより、空白による日本語境界を優先する(Hello, world / 8:30)");
  }

  // ---- Codexレビュー指摘対応(PR #105、11巡目、P2): 区切り文字でも何でもない
  // ただの記号としての単一の"が行に含まれても、以降の改行までcrquoteの中とみなして
  // 次の行を呑み込まない ----
  {
    const result = parseWordList('quote: 「"」という記号\napple: りんご');
    if (
      result.entries.length === 2 &&
      result.entries[0].word === "quote" &&
      result.entries[1].word === "apple" &&
      result.entries[1].meaning === "りんご"
    ) {
      ok('区切り文字でもクォートでもない単一の"を含む行が、次の行を誤って呑み込まない');
    } else {
      bad(`単一"を含む行の処理が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、11巡目、P2): word-list-cleanerが生成した
  // (meaningに改行を含む値をダブルクォートで囲んだ)CSVを、実際のインポート先である
  // CsvImportPanel.tsx側のparseCsv()に貼り付け直しても、クォート内の改行でレコードが
  // 分断されず完全な値が復元される(クリーナー単体の往復確認だけでなく、実際の
  // インポーターまで含めた完全なround-trip) ----
  {
    const entries = [{ word: "hello", meaning: "line one\nline two" }];
    const { csv } = toWordbookCsv(entries);
    const imported = parseCsv(csv);
    if (imported.length === 1 && imported[0].word === "hello" && imported[0].meaning === "line one\nline two") {
      ok("word-list-cleanerが生成したクォート内改行付きCSVを、実際のCsvImportPanel.parseCsv()に貼り直しても完全に復元される(実インポーターまでの完全round-trip)");
    } else {
      bad(`実インポーターでのクォート内改行round-tripが想定外: ${JSON.stringify(imported)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、12巡目、P2): コロンの直後に空白があり
  // (word: meaning形式)、意味側の英語がさらに続いてから日本語へ切り替わる場合、
  // ラテン→日本語境界より「word:」というコロン区切りを優先する ----
  {
    const cases = [
      ["apple: red りんご", { word: "apple", meaning: "red りんご" }],
      ["apple: red, blue りんご", { word: "apple", meaning: "red, blue りんご" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const result = parseWordListLine(input);
      if (result?.word !== expected.word || result?.meaning !== expected.meaning) {
        allOk = false;
        bad(`コロン直後に空白があるケースの解析が想定外: ${JSON.stringify(input)} → ${JSON.stringify(result)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok('コロンの直後に空白がある場合("apple: red りんご")、意味側に続く英語に惑わされずコロン区切りを優先する');
  }
  {
    // コロンの直後に空白が無い場合(8:30のような時刻表記)は、この優先付けの対象外で
    // 引き続きラテン→日本語境界に委ねる(回帰確認)。
    const result = parseWordListLine("8:30 午前八時半");
    if (result?.word === "8:30" && result?.meaning === "午前八時半") {
      ok('コロンの直後に空白が無い場合(8:30)は優先付けの対象外のまま、ラテン→日本語境界が正しく機能する(回帰確認)');
    } else {
      bad(`8:30の回帰確認が想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、12巡目、P2): クォートで開いたフィールド
  // 内部の""(doubled quote、エスケープされた"1文字)の直後に改行が続いても、
  // その""をフィールドの閉じクォートと誤認識してレコードを分断しない ----
  {
    const entries = [{ word: "hello", meaning: 'say "hi"\nnext line' }];
    const { csv } = toWordbookCsv(entries);
    const result = parseWordList(csv);
    if (
      result.entries.length === 1 &&
      result.entries[0].word === "hello" &&
      result.entries[0].meaning === 'say "hi"\nnext line' &&
      result.skippedLineNumbers.length === 0
    ) {
      ok('エスケープされた""(doubled quote)を含むmeaning内の改行を含む値をtoWordbookCsvで生成し貼り直しても、""を閉じクォートと誤認識せず正しく復元される(往復確認)');
    } else {
      bad(`エスケープされた""を含む改行付き値のround-tripが想定外: ${JSON.stringify(result)}`);
    }
  }

  // ---- Codexレビュー指摘対応(PR #105、13巡目、P2): 2列CSVでも、値自体に
  // 区切り文字候補の文字(コロン等)を含む本物のword("8:30"等)が、1行ずつの
  // ヒューリスティックへ誤って渡って切り詰められない。toWordbookCsvが自分自身で
  // 生成しうる2列CSVの完全round-tripとして確認する ----
  {
    const entries = [{ word: "8:30", meaning: "午前八時半" }];
    const { csv } = toWordbookCsv(entries);
    const result = parseWordList(csv);
    if (result.entries.length === 1 && result.entries[0].word === "8:30" && result.entries[0].meaning === "午前八時半") {
      ok('2列CSVでも、コロンを含むword("8:30")が列モードで正しく保持される(toWordbookCsv round-trip)');
    } else {
      bad(`2列CSVでのコロン含有wordのround-tripが想定外: ${JSON.stringify(result)}`);
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
