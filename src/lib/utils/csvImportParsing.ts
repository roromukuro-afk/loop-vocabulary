/**
 * src/components/wordbooks/CsvImportPanel.tsx が使うCSVパース処理。純粋関数のみを
 * 集めた非JSXファイルに分離しているのは、scripts/testing/test-word-list-cleaner-parser.mjs
 * のようなプレーンなNodeスクリプトから直接importして往復確認テストができるようにする
 * ため(Node組み込みのTypeScript剥がしは.tsxのJSX構文を解釈できず、コンポーネント本体を
 * 直接importできない)。
 */

export type ParsedWord = {
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
  example_ja?: string;
};

export function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
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
// 欠落する(Codexレビュー指摘対応、PR #105、11巡目、P2)。ここは常にRFC4180形式の
// CSVとして扱う前提のファイルのため(自由記述の見出し語混じりテキストは扱わない)、
// wordListCleaner.ts のsplitIntoRecords()と異なり、クォートの出現位置を
// レコード先頭/区切り文字の直後に限定する必要はない。
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      records.push(current);
      current = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    current += ch;
  }
  records.push(current);
  return records;
}

export function parseCsv(text: string): ParsedWord[] {
  const lines = splitCsvRecords(text.trim()).filter(l => l.trim());
  if (lines.length === 0) return [];

  const firstLower = lines[0].toLowerCase();
  const hasHeaders = firstLower.includes("word") || firstLower.includes("meaning") ||
    firstLower.includes("単語") || firstLower.includes("英単語");

  const headerMap: Record<string, number> = { word: 0, meaning: 1 };
  let startLine = 0;

  if (hasHeaders) {
    startLine = 1;
    const headers = parseLine(lines[0]);
    headers.forEach((h, i) => {
      const lh = h.toLowerCase().trim();
      if (["word", "英単語", "単語", "english"].includes(lh)) headerMap.word = i;
      else if (["meaning", "意味", "日本語", "japanese"].includes(lh)) headerMap.meaning = i;
      else if (["phonetic", "発音", "読み方", "pronunciation"].includes(lh)) headerMap.phonetic = i;
      else if (["example", "例文", "英語例文"].includes(lh)) headerMap.example = i;
      else if (["example_ja", "例文日本語", "日本語例文"].includes(lh)) headerMap.example_ja = i;
    });
  }

  return lines.slice(startLine).flatMap((line) => {
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
}
