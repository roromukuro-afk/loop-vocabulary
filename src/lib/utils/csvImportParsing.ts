/**
 * src/components/wordbooks/CsvImportPanel.tsx が使うCSVパース処理。純粋関数のみを
 * 集めた非JSXファイルに分離しているのは、scripts/testing/test-word-list-cleaner-parser.mjs
 * のようなプレーンなNodeスクリプトから直接importして往復確認テストができるようにする
 * ため(Node組み込みのTypeScript剥がしは.tsxのJSX構文を解釈できず、コンポーネント本体を
 * 直接importできない)。
 *
 * RFC CSV/TSVの構造解析(レコード分割・フィールド分割)は csvScanner.mjs に
 * 集約されており、wordListCleaner.ts(列モード)と共有している(Codexレビュー
 * 指摘対応、PR #105、17巡目: 同じクォート処理を2ファイル4関数へ個別に複製して
 * いたことが、11/12/15/16巡目で繰り返し指摘された同種の不具合の根本原因だった)。
 */
import { splitCsvRecords, splitCsvFields } from "./csvScanner.mjs";

export type ParsedWord = {
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
  example_ja?: string;
};

/**
 * csvScanner.mjsのsplitCsvRecords()が検出した、未終端クォート(閉じクォートが
 * 見つからないまま入力の終端に達した)のために除外された物理行の情報。
 * wordListCleaner.tsのMalformedCsvWarningと同じ形だが、TypeScriptの型は
 * 構造的(structural)であり、ロジックではなく型エイリアスの複製は同種の不具合の
 * リスクを持たないため、csvScanner.mjs側の実際の実装(唯一のロジック源)への
 * importで済ませ、ここでは独立に定義する。
 */
export type MalformedCsvWarning = {
  type: "unterminated_quote";
  /** クォートが開いた物理行番号(1始まり)。 */
  physicalLine: number;
  /** 除外された物理行の元テキスト(末尾の改行は含まない)。 */
  skippedLineText: string;
};

export type ParseCsvResult = {
  words: ParsedWord[];
  malformedCsvWarnings: MalformedCsvWarning[];
};

export function parseLine(line: string): string[] {
  return splitCsvFields(line, ",");
}

// /tools/word-list-cleanerがCSVインジェクション対策として=+-@で始まるセルの先頭に
// 付与する'だけを取り除く(Codexレビュー指摘対応、PR #105、4巡目)。先頭の'を無条件に
// 取り除くと、"'cause"(なぜならの口語表記)や"'Hello,' she said."のように、
// ユーザーが意図的にアポストロフィで始めた正当な値まで壊してしまう。word-list-cleaner
// 自身のneutralizeFormulaInjection()が実際に生成するパターン("'" + = + - @ のいずれか)
// と完全一致する場合だけ取り除くことで、この無害化と無関係なアポストロフィ始まりの
// 値には一切触れないようにする。
const NEUTRALIZED_FORMULA_PREFIX = /^'[=+\-@]/;

export function stripLeadingApostrophe(value: string): string {
  return NEUTRALIZED_FORMULA_PREFIX.test(value) ? value.slice(1) : value;
}

// レコード(1行分のCSV)の区切りとなる改行を、クォートの中/外を区別して判定する。
// text全体を単純にtext.split(/\r?\n/)すると、/tools/word-list-cleanerのtoWordbookCsv()
// (csvField()参照)が実際に出力しうる「meaningに改行を含む値をダブルクォートで囲んだCSV」を
// このインポーターへ貼り付け直した際、クォート内部の改行でレコードが分断され、後半が
// 欠落する(Codexレビュー指摘対応、PR #105、11巡目、P2)。このファイルは常にカンマ区切りの
// CSVとして扱うため、区切り文字候補は","だけを渡す。
function splitCsvRecordsLocal(text: string) {
  return splitCsvRecords(text, [","]);
}

const WORD_LABELS = ["word", "英単語", "単語", "english"];
const MEANING_LABELS = ["meaning", "意味", "日本語", "japanese"];

export function parseCsv(text: string): ParseCsvResult {
  const { records, warnings } = splitCsvRecordsLocal(text.trim());
  const malformedCsvWarnings: MalformedCsvWarning[] = warnings;
  const lines = records.filter(l => l.trim());
  if (lines.length === 0) return { words: [], malformedCsvWarnings };

  // 先頭レコードを実際にCSVフィールドとして分割してから、各フィールドの値が
  // 既知のヘッダラベルと完全一致するかで判定する(行全体に対する部分一致では
  // ないことに注意)。splitIntoRecords/splitCsvRecordsがクォート内の改行を
  // 正しく1レコードとして保持するようになったことで、"apple,\"line
  // one\nmeaning follows\""のような、meaningの値にたまたま"meaning"という
  // 文字列を含むヘッダなしデータ行が、行全体への部分一致では誤ってヘッダ行と
  // 判定され、本来の最初のデータ行(apple)が丸ごと消えてしまっていた
  // (Codexレビュー指摘対応、PR #105、14巡目、P2)。
  //
  // ただし「いずれか1フィールドでもラベルと一致すれば」という判定のままだと、
  // "japanese,日本語"(word="japanese", meaning="日本語"という実在の単語データ)
  // のように、両方の値がたまたま別カテゴリのラベルと一致するだけの本物のデータ行
  // まで誤ってヘッダ扱いしてしまう(Codexレビュー指摘対応、PR #105、16巡目、P2)。
  // word列に相当する位置にword系ラベル、meaning列に相当する位置にmeaning系ラベルが
  // 別々のフィールドとして両方そろって初めてヘッダとみなす。
  const firstFields = parseLine(lines[0]).map((f) => f.trim().toLowerCase());
  const wordLabelIndex = firstFields.findIndex((f) => WORD_LABELS.includes(f));
  const meaningLabelIndex = firstFields.findIndex((f) => MEANING_LABELS.includes(f));
  const hasHeaders = wordLabelIndex !== -1 && meaningLabelIndex !== -1 && wordLabelIndex !== meaningLabelIndex;

  const headerMap: Record<string, number> = { word: 0, meaning: 1 };
  let startLine = 0;

  if (hasHeaders) {
    startLine = 1;
    firstFields.forEach((lh, i) => {
      if (WORD_LABELS.includes(lh)) headerMap.word = i;
      else if (MEANING_LABELS.includes(lh)) headerMap.meaning = i;
      else if (["phonetic", "発音", "読み方", "pronunciation"].includes(lh)) headerMap.phonetic = i;
      else if (["example", "例文", "英語例文"].includes(lh)) headerMap.example = i;
      else if (["example_ja", "例文日本語", "日本語例文"].includes(lh)) headerMap.example_ja = i;
    });
  }

  const words = lines.slice(startLine).flatMap((line) => {
    const cols = parseLine(line);
    const word = stripLeadingApostrophe(cols[headerMap.word ?? 0]?.trim() ?? "");
    const meaning = stripLeadingApostrophe(cols[headerMap.meaning ?? 1]?.trim() ?? "");
    if (!word || !meaning) return [];
    const phoneticRaw = headerMap.phonetic !== undefined ? cols[headerMap.phonetic]?.trim() : undefined;
    const exampleRaw = headerMap.example !== undefined ? cols[headerMap.example]?.trim() : undefined;
    const exampleJaRaw = headerMap.example_ja !== undefined ? cols[headerMap.example_ja]?.trim() : undefined;
    return [{
      word,
      meaning,
      phonetic: phoneticRaw ? stripLeadingApostrophe(phoneticRaw) : undefined,
      example: exampleRaw ? stripLeadingApostrophe(exampleRaw) : undefined,
      example_ja: exampleJaRaw ? stripLeadingApostrophe(exampleJaRaw) : undefined,
    }];
  });
  return { words, malformedCsvWarnings };
}
