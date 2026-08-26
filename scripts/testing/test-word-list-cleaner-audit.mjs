/**
 * /tools/word-list-cleaner の整形ロジック(src/lib/utils/wordListCleaner.ts)に対する
 * 体系的な先回り監査。test-word-list-cleaner-parser.mjs がCodexレビューで実際に
 * 指摘された個々のケースの回帰テストであるのに対し、こちらはCSV/TSVパーサ全体を
 * テーブル駆動で網羅的に確認する(改行コード・BOM・クォートエスケープ・閉じ忘れ
 * クォート・列数の過不足・formula injection・大量入力・fuzzテスト等)。
 *
 * 使い方: node scripts/testing/test-word-list-cleaner-audit.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWordListLine, parseWordList, toWordbookCsv, csvWithBom } from "../../src/lib/utils/wordListCleaner.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const __dir = dirname(fileURLToPath(import.meta.url));
const FUZZ_FAILURES_DIR = resolve(__dir, ".fuzz-failures");

function main() {
  // ==== 1. 改行コード: CRLF / LF / CR ====
  {
    const cases = [
      ["apple: りんご\r\nbanana: バナナ", "CRLF"],
      ["apple: りんご\nbanana: バナナ", "LF"],
      ["apple: りんご\rbanana: バナナ", "CR単独"],
    ];
    let allOk = true;
    for (const [input, label] of cases) {
      const r = parseWordList(input);
      if (r.entries.length !== 2 || r.entries[0].word !== "apple" || r.entries[1].word !== "banana") {
        allOk = false;
        bad(`改行コード(${label})の解析が想定外: ${JSON.stringify(r)}`);
      }
    }
    if (allOk) ok("改行コード CRLF/LF/CR単独のいずれでも2件を正しく解析する");
  }

  // ==== 2. UTF-8 BOM ====
  {
    const BOM = "﻿";
    const r = parseWordList(BOM + "apple: りんご\nbanana: バナナ");
    if (r.entries.length === 2 && r.entries[0].word === "apple") {
      ok("先頭のUTF-8 BOM(U+FEFF)があっても正しく2件解析される(1件目のwordにBOMが残らない)");
    } else {
      bad(`BOM付き入力の解析が想定外: ${JSON.stringify(r)}`);
    }
    // ヘッダ行にBOMが付いている場合も、ヘッダ判定・CSV列モード判定が壊れない
    const rHeader = parseWordList(BOM + "word,meaning,phonetic\nabandon,捨てる,/x/");
    if (rHeader.entries.length === 1 && rHeader.entries[0].word === "abandon") {
      ok("BOM付きの3列CSVヘッダでも列モードが正しく検出される");
    } else {
      bad(`BOM付き3列CSVヘッダの解析が想定外: ${JSON.stringify(rHeader)}`);
    }
  }

  // ==== 3. ダブルクォートエスケープ("") ====
  {
    const r = parseWordList('say ""hi"": こんにちはと言う');
    // 単一行ヒューリスティック経路。"" はダブルクォートエスケープとしてではなく、
    // 素の文字として扱われても(quoted-prefix経路に入らない先頭以外の位置のため)
    // 例外を投げず、何らかの形で解析されるかスキップされることを確認する。
    if (r.entries.length <= 1 && r.skippedLineNumbers.length + r.entries.length === 1) {
      ok('行頭以外の""(ダブルクォートエスケープ風の文字列)を含む行でも例外を投げず、1件として処理される');
    } else {
      bad(`""を含む行の処理が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    // toWordbookCsv → 再パースのround tripで""エスケープが正しく戻る
    const entries = [{ word: 'say "hi"', meaning: "こんにちはと言う" }];
    const { csv } = toWordbookCsv(entries);
    const r = parseWordList(csv);
    if (r.entries.length === 1 && r.entries[0].word === 'say "hi"') {
      ok('ダブルクォートを含む値がtoWordbookCsvで""エスケープされ、再パースで元の"に正しく復元される');
    } else {
      bad(`""エスケープのround tripが想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 4. クォート内のカンマ・タブ・改行を区切りとして誤認識しない ====
  {
    const r = parseWordList('word,meaning,phonetic\n"a,b",区切りを含む語,/x/');
    if (r.entries.length === 1 && r.entries[0].word === "a,b" && r.entries[0].meaning === "区切りを含む語") {
      ok("3列CSVモードで、クォート内のカンマが列区切りとして誤認識されない");
    } else {
      bad(`クォート内カンマの列モード解析が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    const r = parseWordList('word\tmeaning\tphonetic\n"a\tb"\t区切りを含む語\t/x/');
    if (r.entries.length === 1 && r.entries[0].word === "a\tb" && r.entries[0].meaning === "区切りを含む語") {
      ok("3列TSVモードで、クォート内のタブが列区切りとして誤認識されない");
    } else {
      bad(`クォート内タブの列モード解析が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    const entries = [{ word: "hello", meaning: "line one\nline two" }];
    const { csv } = toWordbookCsv(entries);
    const r = parseWordList(csv);
    if (r.entries.length === 1 && r.entries[0].meaning === "line one\nline two") {
      ok("クォート内の改行が列/レコード区切りとして誤認識されず、1件のmeaningとして復元される(既存回帰の再確認)");
    } else {
      bad(`クォート内改行の再確認が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 5. 閉じていないクォート(round-18: 「黙って正常入力として扱う」フォール
  // バックではなく、malformedCsvWarningsとして明示的に開示される。entries/
  // skippedLineNumbersのどちらにも紛れ込まず、「破損した値として取り込まれず
  // 除外された」ことが独立したカテゴリとして区別できる) ====
  {
    const r = parseWordList('word,meaning\n"unterminated,テスト');
    if (
      r.entries.length === 0 &&
      r.skippedLineNumbers.length === 0 &&
      r.malformedCsvWarnings.length === 1 &&
      r.malformedCsvWarnings[0].type === "unterminated_quote" &&
      r.malformedCsvWarnings[0].physicalLine === 2
    ) {
      ok("閉じていないクォートを含む行は、entries/skippedLineNumbersのどちらにも含まれず、malformedCsvWarningsとして正しい物理行番号(2行目)で明示される");
    } else {
      bad(`閉じクォート無し入力の処理が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    // 破損行の直後に正常な行がある場合、正常な行は破損行の影響を受けず回復される。
    const r = parseWordList('word,meaning\n"unterminated,テスト\napple,りんご');
    if (
      r.entries.length === 1 &&
      r.entries[0].word === "apple" &&
      r.entries[0].meaning === "りんご" &&
      r.malformedCsvWarnings.length === 1 &&
      r.malformedCsvWarnings[0].physicalLine === 2
    ) {
      ok("破損した行の直後にある正常な行(apple,りんご)は、破損行の影響を受けず正しく回復される");
    } else {
      bad(`破損行直後の正常行の回復が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    // 閉じクォートが無いまま行末(かつテキスト末尾)に達するケースが例外を投げないことを単体でも確認
    let threw = false;
    try { parseWordList('"unterminated all the way to EOF without any closing quote at all'); }
    catch { threw = true; }
    if (!threw) ok("閉じクォートがテキスト末尾まで一切無い入力でも例外を投げない");
    else bad("閉じクォート無し・EOFまで続く入力で例外が発生した");
  }
  {
    // Codexレビュー指摘対応、PR #105、round-21再監査フレッシュレビューP2:
    // 未終端クォートによる破損行が1,000件(MAX_MALFORMED_ROW_RECOVERY_ATTEMPTS)を
    // 超えて連続すると、csvScanner.mjsのsplitCsvRecords()は以降の1行ずつの
    // 精密な復旧を諦め、残り全体(その中にたまたま存在する正当な行を含む)を
    // 1件の集約警告(note付き)にまとめる。この集約が起きた場合、malformedCsvWarnings
    // に含まれる正当な行(この例のapple,りんご)は一切entriesに現れないことを
    // parseWordList()レベルで直接確認する(UI側の文言修正[WordListCleaner.tsx]の
    // 前提となるデータ挙動そのものの回帰確認)。
    const header = "word,meaning";
    const malformedLines = Array.from({ length: 1005 }, (_, i) => `bad${i}," unterminated${i}`);
    const text = [header, ...malformedLines, "apple,りんご"].join("\n");
    const r = parseWordList(text);
    const aggregateWarning = r.malformedCsvWarnings.find((w) => w.note);
    const appleRecovered = r.entries.some((e) => e.word === "apple" && e.meaning === "りんご");
    if (aggregateWarning && !appleRecovered && r.entries.length === 0) {
      ok("未終端クォートの破損行が1,000件を超えて連続すると集約警告(note付き)になり、その直後にある正当な行(apple,りんご)はentriesに一切現れない(=一切解析されていない)ことを確認");
    } else {
      bad(`集約警告時のapple行の扱いが想定外: aggregateWarning=${JSON.stringify(aggregateWarning)}, appleRecovered=${appleRecovered}, entries.length=${r.entries.length}`);
    }
  }

  // ==== 6. 空セル・空行・末尾区切り ====
  {
    const r = parseWordList("apple: りんご\n\n\nbanana: バナナ");
    if (r.entries.length === 2 && r.skippedLineNumbers.length === 0) {
      ok("連続する空行は無視され、スキップ扱いにもならない(既存仕様の再確認)");
    } else {
      bad(`連続空行の処理が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    const r = parseWordList("word,meaning,phonetic\nabandon,捨てる,\npersist,,/x/");
    // phonetic列が空でも word/meaning が揃っていれば採用され、meaning列が空なら
    // スキップされることを確認(空セルの扱い)。
    if (
      r.entries.length === 1 &&
      r.entries[0].word === "abandon" &&
      r.entries[0].meaning === "捨てる" &&
      r.skippedLineNumbers.length === 1
    ) {
      ok("3列CSVモードで、無視される列(phonetic)が空でも採用され、必須列(meaning)が空の行はスキップされる");
    } else {
      bad(`空セルを含む3列CSVの処理が想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    const r = parseWordList("word,meaning,phonetic\nabandon,捨てる,/x/,");
    // 末尾に余分な区切り(4フィールド目が空)があっても、word/meaning列のインデックスには影響しない。
    if (r.entries.length === 1 && r.entries[0].word === "abandon" && r.entries[0].meaning === "捨てる") {
      ok("行末の余分な区切り文字(空の4列目)があってもword/meaning列の抽出に影響しない");
    } else {
      bad(`末尾区切りを含む行の処理が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 7. 列数の過不足(2列・3列以上・列不足) ====
  {
    const r2col = parseWordList("word,meaning\napple,りんご");
    const r3col = parseWordList("word,meaning,phonetic\nabandon,捨てる,/x/");
    if (r2col.entries.length === 1 && r3col.entries.length === 1) {
      ok("2列CSVと3列以上CSVの両方が正しく解析される(モード切り替えの再確認)");
    } else {
      bad(`列数バリエーションの解析が想定外: 2col=${JSON.stringify(r2col)}, 3col=${JSON.stringify(r3col)}`);
    }
  }
  {
    // ヘッダは3列(word,meaning,phonetic)なのに、データ行が2列しかない(列不足)場合。
    const r = parseWordList("word,meaning,phonetic\nabandon,捨てる");
    if (r.entries.length === 1 && r.entries[0].word === "abandon" && r.entries[0].meaning === "捨てる") {
      ok("ヘッダより列数が少ない(phonetic列が無い)データ行でも、存在するword/meaning列は正しく取り出される");
    } else {
      bad(`列不足行の処理が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 8. quoted/unquotedの混在 ====
  {
    const r = parseWordList('word,meaning,phonetic\n"abandon",捨てる,"/əˈbændən/"\npersist,固執する,/pɚˈsɪst/');
    if (
      r.entries.length === 2 &&
      r.entries[0].word === "abandon" &&
      r.entries[1].word === "persist"
    ) {
      ok("同じCSV内でquotedフィールドとunquotedフィールドが混在していても正しく解析される");
    } else {
      bad(`quoted/unquoted混在の解析が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 9. カンマとタブの混在(1つの入力内で行ごとに区切りが異なるケース) ====
  {
    // ヘッダはタブ区切り3列 → タブが列モードの区切りとして採用される。
    // データ行にたまたまカンマが含まれていても、タブ区切りのフィールド抽出には影響しない。
    const r = parseWordList("word\tmeaning\tphonetic\nHello, world\tこんにちは、世界\t/x/");
    if (r.entries.length === 1 && r.entries[0].word === "Hello, world" && r.entries[0].meaning === "こんにちは、世界") {
      ok("タブ区切りヘッダで列モードが確定した後は、データ行中のカンマに影響されずタブだけで列分割される");
    } else {
      bad(`タブ/カンマ混在入力の解析が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 9b. TSVデータ行の値に「カンマ+リテラルの"」がたまたま含まれる場合、
  // カンマ候補のせいで未終端クォートと誤判定されない(Codexレビュー指摘対応、
  // PR #105、round-18再監査P2: ヘッダーからTSVと確定する前に両方の区切り文字
  // 候補をクォート境界判定へ渡していたため、TSV行の値中のカンマがフィールド
  // 境界だと誤認識され、その直後のリテラルな"が閉じクォートを持たない
  // 未終端クォートとして誤検出され、行ごと除外されていた) ====
  {
    const r = parseWordList('word\tmeaning\nquote\tUse comma, " literally\napple\tりんご');
    if (
      r.entries.length === 2 &&
      r.entries[0].word === "quote" &&
      r.entries[0].meaning === 'Use comma, " literally' &&
      r.entries[1].word === "apple" &&
      r.entries[1].meaning === "りんご" &&
      r.malformedCsvWarnings.length === 0
    ) {
      ok("TSVヘッダーで区切り文字がタブに確定した後は、データ行の値中のカンマ+リテラルの\"がカンマ候補のせいで未終端クォートと誤判定されない");
    } else {
      bad(`TSV行中のカンマ+リテラル\"の解析が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 9c. 先頭に空行がある入力でも、その直後の本物のTSVヘッダーから区切り
  // 文字を正しく確定できる(Codexレビュー指摘対応、PR #105、round-18再監査
  // フレッシュレビュー4巡目: 旧実装は単純に最初の改行までを「先頭行」として
  // 扱っていたため、先頭が空行の入力ではヘッダー検出自体を諦めて両方の区切り
  // 文字候補へフォールバックし、9bと同じ誤検出が再発していた) ====
  {
    const r = parseWordList('\nword\tmeaning\nquote\tUse comma, " literally\napple\tりんご');
    if (
      r.entries.length === 2 &&
      r.entries[0].word === "quote" &&
      r.entries[0].meaning === 'Use comma, " literally' &&
      r.entries[1].word === "apple" &&
      r.entries[1].meaning === "りんご" &&
      r.malformedCsvWarnings.length === 0
    ) {
      ok("先頭に空行がある入力でも、直後の本物のTSVヘッダーから区切り文字を正しく確定でき、9bと同じ誤検出が再発しない");
    } else {
      bad(`先頭空行付きTSV入力の解析が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 9d. ヘッダーが無く実際の区切り文字がコロン等の自由記述テキストでは、
  // カンマ/タブを投機的な区切り文字候補としてクォート対応の状態machineへ渡さない
  // (Codexレビュー指摘対応、PR #105、round-19再監査フレッシュレビューP2:
  // 9b/9cはヘッダーから区切り文字が確定した後の話だったが、こちらはそもそも
  // ヘッダーが存在せずword/meaning列を検出できないケース。実際の区切り文字は
  // コロンなのに、投機的なカンマ候補のせいでquote行の意味中のカンマがCSV境界と
  // 誤認識され、直後のリテラルな"が未終端クォートと誤判定されてquote行ごと
  // 静かに呑み込まれていた) ====
  {
    const r = parseWordList('quote: Use comma, " literally\napple: りんご');
    if (
      r.entries.length === 2 &&
      r.entries[0].word === "quote" &&
      r.entries[0].meaning === 'Use comma, " literally' &&
      r.entries[1].word === "apple" &&
      r.entries[1].meaning === "りんご" &&
      r.malformedCsvWarnings.length === 0
    ) {
      ok("ヘッダー無しの自由記述テキスト(実際の区切り文字はコロン)では、投機的なカンマ/タブ候補でクォート状態machineが誤って起動せず、quote行が未終端クォートとして呑み込まれない");
    } else {
      bad(`ヘッダー無し自由記述テキストへの投機的クォート判定混入が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 11. 括弧内カンマ go (went, gone) ====
  {
    const r = parseWordListLine("go (went, gone) 行く");
    if (r === null) {
      ok('"go (went, gone) 行く" は活用形の括弧を安全側でスキップし、誤ってwordを切り詰めない(null)');
    } else {
      bad(`括弧内カンマのケースが想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 12. ハイフン複合語を誤分割しない ====
  {
    const cases = ["state-of-the-art 最先端の", "well-known 有名な", "mother-in-law 姑"];
    let allOk = true;
    for (const input of cases) {
      const r = parseWordListLine(input);
      const expectedWord = input.split(" ")[0];
      if (!r || r.word !== expectedWord) { allOk = false; bad(`ハイフン複合語の解析が想定外: ${JSON.stringify(input)} → ${JSON.stringify(r)}`); }
    }
    if (allOk) ok("state-of-the-art / well-known / mother-in-law のようなハイフン複合語は誤分割されない");
  }

  // ==== 13. word - meaning 形式 ====
  {
    const r = parseWordListLine("banana - バナナ");
    if (r?.word === "banana" && r?.meaning === "バナナ") {
      ok('"word - meaning"形式(スペース+ハイフン+スペース)が正しく解析される');
    } else {
      bad(`"word - meaning"形式の解析が想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== 14. 日本語の長音記号「ー」・ダッシュ「―」がハイフンと誤認識されない ====
  {
    const cases = [
      ["コーヒー: 豆から淹れる飲み物", { word: "コーヒー", meaning: "豆から淹れる飲み物" }],
      ["データ: 情報のかたまり", { word: "データ", meaning: "情報のかたまり" }],
    ];
    let allOk = true;
    for (const [input, expected] of cases) {
      const r = parseWordListLine(input);
      if (r?.word !== expected.word || r?.meaning !== expected.meaning) {
        allOk = false;
        bad(`長音記号を含む語の解析が想定外: ${JSON.stringify(input)} → ${JSON.stringify(r)}(期待値: ${JSON.stringify(expected)})`);
      }
    }
    if (allOk) ok("日本語の長音記号「ー」を含む語(コーヒー・データ等)がハイフン区切りと誤認識されない");
  }
  {
    // 全角ダッシュ「―」もBARE_HYPHEN_BEFORE_JAPANESEの対象("-"限定)ではないため、
    // 区切りとして機能しない(単一スペース等、別の区切りが無ければnull)ことを確認。
    const r = parseWordListLine("emdash―これはダッシュ");
    if (r === null) {
      ok("全角ダッシュ「―」は素のハイフン区切りの対象外であり、他の区切りが無ければnullを返す(誤って区切りとして使われない)");
    } else {
      bad(`全角ダッシュのケースが想定外(区切りとして誤用されていないか要確認): ${JSON.stringify(r)}`);
    }
  }

  // ==== 15. formula injection 対象文字 (= + - @) の再確認 ====
  {
    const entries = [
      { word: "=SUM(A1)", meaning: "合計" },
      { word: "+81", meaning: "日本の国番号" },
      { word: "-1", meaning: "マイナス1" },
      { word: "@mention", meaning: "メンション" },
    ];
    const { csv, neutralizedCount } = toWordbookCsv(entries);
    if (neutralizedCount === 4 && csv.includes("'=SUM(A1)") && csv.includes("'+81") && csv.includes("'-1") && csv.includes("'@mention")) {
      ok("= + - @ で始まる全パターンが正しく無害化され、neutralizedCountが件数(4)と一致する");
    } else {
      bad(`formula injection全パターンの無害化が想定外: neutralizedCount=${neutralizedCount}, csv=${JSON.stringify(csv)}`);
    }
  }

  // ==== 16. 大量行・極端に長いセル ====
  {
    const bigInput = Array.from({ length: 10000 }, (_, i) => `word${i}: 意味${i}`).join("\n");
    const start = Date.now();
    const r = parseWordList(bigInput);
    const elapsed = Date.now() - start;
    if (r.entries.length === 10000 && elapsed < 5000) {
      ok(`10000行の入力を${elapsed}msで例外なく処理する(entries=${r.entries.length})`);
    } else {
      bad(`大量行の処理が想定外: entries=${r.entries.length}, elapsed=${elapsed}ms`);
    }
  }
  {
    const longCell = "x".repeat(200000);
    const start = Date.now();
    const r = parseWordList(`word: ${longCell}`);
    const elapsed = Date.now() - start;
    if (r.entries.length === 1 && r.entries[0].meaning.length === longCell.length && elapsed < 3000) {
      ok(`20万文字の極端に長いセルを${elapsed}msで例外なく処理する`);
    } else {
      bad(`極端に長いセルの処理が想定外: entries=${JSON.stringify(r.entries.map(e => e.meaning.length))}, elapsed=${elapsed}ms`);
    }
  }

  // ==== 18. CSV出力→再入力のround-trip(2列) ====
  // formula injection対象文字(= + - @)で始まる値はtoWordbookCsvが意図的に'を
  // 付与して無害化する。この'を取り除くのはCsvImportPanel側のstripLeadingApostrophe()
  // の役割であり(既存テストで別途確認済み)、parseWordList自身は意図的にこの'を
  // 取り除かない(自分が付与した無害化マーカーかユーザー本来のアポストロフィかを
  // 区別できないため)。よってこのround-tripでは無害化対象文字を含めない。
  {
    const entries = [
      { word: "abandon", meaning: "捨てる、放棄する" },
      { word: 'say "hi"', meaning: "line1\nline2" },
    ];
    const { csv } = toWordbookCsv(entries);
    const r = parseWordList(csv);
    const matches = r.entries.length === 2 &&
      r.entries[0].word === "abandon" && r.entries[0].meaning === "捨てる、放棄する" &&
      r.entries[1].word === 'say "hi"' && r.entries[1].meaning === "line1\nline2";
    if (matches) {
      ok("toWordbookCsvの出力(2列、クォート・改行を含む)を再度parseWordListに通すと、元のentriesと完全に一致する(round-trip)");
    } else {
      bad(`2列CSVのround-tripが想定外: ${JSON.stringify(r)}`);
    }
  }
  {
    // csvWithBom() の出力(BOM付き)も再パースできる
    const entries = [{ word: "apple", meaning: "りんご" }];
    const { csv } = toWordbookCsv(entries);
    const withBom = csvWithBom(csv);
    const r = parseWordList(withBom);
    if (r.entries.length === 1 && r.entries[0].word === "apple") {
      ok("csvWithBom()が付与したBOM付きCSVも再パースでき、BOMが値へ混入しない(round-trip)");
    } else {
      bad(`BOM付きCSVのround-tripが想定外: ${JSON.stringify(r)}`);
    }
  }

  // ==== fuzzテスト: ランダム入力で例外・無限ループ・データ混線が起きないこと ====
  {
    // 決定的な擬似乱数(Mulberry32)。CI再現性のためMath.randomは使わない。
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // --seed=<n> でCLIから上書きできるようにする(失敗を再現したい場合、後述の
    // 失敗保存ファイルに記録されたseedをそのまま渡せば同じ入力列を再生成できる)。
    const seedArg = process.argv.find((a) => a.startsWith("--seed="));
    const SEED = seedArg ? parseInt(seedArg.slice("--seed=".length), 10) : 20260822;
    const rand = mulberry32(SEED);
    const ALPHABET = ['"', ",", "\t", "\n", "\r", " ", "　", "a", "b", "-", "ー", "(", ")", "（", "）", "：", ":", "=", "+", "@", "あ", "漢", "﻿"];
    let crashed = 0;
    let tooSlow = 0;
    const ITERATIONS = 500;
    const failures = [];
    for (let n = 0; n < ITERATIONS; n++) {
      const len = Math.floor(rand() * 60);
      let s = "";
      for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
      try {
        const start = Date.now();
        const r = parseWordList(s);
        const elapsed = Date.now() - start;
        if (elapsed > 500) {
          tooSlow++;
          failures.push({ n, seed: SEED, input: s, reason: `too slow: ${elapsed}ms` });
        }
        // データ混線チェック: 返されたentries/skippedLineNumbersが基本的な型不変条件を満たすこと
        for (const e of r.entries) {
          if (typeof e.word !== "string" || typeof e.meaning !== "string" || e.word === "" || e.meaning === "") {
            crashed++; // 型不変条件違反も異常として扱う
            bad(`fuzz: 不正なentryを検出 (n=${n}, seed=${SEED}, input=${JSON.stringify(s)}): ${JSON.stringify(e)}`);
            failures.push({ n, seed: SEED, input: s, reason: `invalid entry: ${JSON.stringify(e)}` });
            break;
          }
        }
      } catch (e) {
        crashed++;
        bad(`fuzz: 例外が発生 (n=${n}, seed=${SEED}, input=${JSON.stringify(s)}): ${e.message}`);
        failures.push({ n, seed: SEED, input: s, reason: `threw: ${e.message}` });
      }
    }
    // 失敗があれば、seedと最小再現に必要な情報(件番号n・入力文字列)をJSONファイルへ
    // 保存する(Codexレビュー指摘対応、PR #105、17巡目)。--seed=<SEED>で同じ乱数列を
    // 再生成できるため、n件目までスキップして同じ入力を再現できる。
    if (failures.length > 0) {
      mkdirSync(FUZZ_FAILURES_DIR, { recursive: true });
      const outPath = resolve(FUZZ_FAILURES_DIR, `failure-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify({ seed: SEED, iterations: ITERATIONS, failures }, null, 2), "utf-8");
      console.error(`fuzz failures saved to: ${outPath} (rerun with --seed=${SEED} to reproduce the same input sequence)`);
    }
    if (crashed === 0 && tooSlow === 0) {
      ok(`fuzzテスト(seed=${SEED}): ランダム生成した${ITERATIONS}件の入力(クォート・区切り文字・BOM・全角文字混在)すべてで例外・型不変条件違反・極端な遅延なし`);
    } else {
      bad(`fuzzテスト(seed=${SEED}): crashed=${crashed}, tooSlow=${tooSlow} / ${ITERATIONS}`);
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:word-list-cleaner-audit RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
