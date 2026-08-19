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

// スプレッドシートソフトの「セルの先頭に'を付けると数式として実行されず文字列として
// 扱われる」という業界標準の慣習(Excel自身も、そのようなセルを再エクスポートする際は
// 表示上の先頭'を取り除く)に合わせる。/tools/word-list-cleaner がCSVインジェクション
// 対策として=+-@で始まるセルの先頭に付与する'を、このCSVインポート機能でも同じ規約で
// 取り除くことで、元の値どおりにインポートできるようにする(Codexレビュー指摘対応、
// PR #105、3巡目: 対策なしでは"-ing"のような正当な語が"'-ing"として永続的に
// インポートされ、プレビュー・元の入力と異なる単語になってしまっていた)。
export function stripLeadingApostrophe(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value;
}

export function parseCsv(text: string): ParsedWord[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
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
