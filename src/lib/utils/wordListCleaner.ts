/**
 * /tools/word-list-cleaner の整形ロジック。
 *
 * 目的: ユーザーが貼り付けた「英単語 + 意味」のリスト(区切り文字が不統一)を、
 * src/components/wordbooks/CsvImportPanel.tsx が実際にパースする形式
 * (word,meaning ヘッダ行 + RFC4180ライクなクォート対応CSV)へクライアントサイドで
 * 整形するだけの純粋関数群。サーバー保存・DB書き込みは一切行わない。
 *
 * 意味の自動生成・辞書引きはスコープ外(ユーザーが既に意味を書いている前提)。
 */

export type WordListEntry = { word: string; meaning: string };

export type WordListParseResult = {
  entries: WordListEntry[];
  /** 空行以外で word/meaning のペアとして解釈できなかった行(1始まりの行番号)。 */
  skippedLineNumbers: number[];
};

// 明示的な区切り文字。行内でどれか複数一致する場合、この配列の並び順を優先度として
// 「最も左側で最初に一致したもの」を採用する(タブ区切りのコピペが最も構造化されている
// ため最優先、全角/半角コロンやハイフンは辞書形式の慣習に合わせて次点)。
const EXPLICIT_DELIMITERS = ["\t", "：", " : ", ":", " - ", "-", ","];

// 英字(ラテン文字)から日本語(ひらがな・カタカナ・漢字)への切り替わり位置を区切りとみなす
// フォールバック用の正規表現。"apple りんご" のように、区切り文字を一切使わず単語と
// 意味をスペースだけで並べた行(辞書帳の手書きメモに多い形式)に対応するため。
const LATIN_TO_JAPANESE_BOUNDARY = /[A-Za-z][ 　]*(?=[぀-ヿ一-鿿])/;

function splitOnFirstMatch(line: string, delimiter: string): [string, string] | null {
  const idx = line.indexOf(delimiter);
  if (idx === -1) return null;
  return [line.slice(0, idx), line.slice(idx + delimiter.length)];
}

/**
 * 1行を word/meaning のペアに分解する。区切り文字が全く見つからない行(意味を
 * 書き忘れている、単語だけの行等)は null を返す(呼び出し側でスキップ扱いにする)。
 */
export function parseWordListLine(rawLine: string): WordListEntry | null {
  const line = rawLine.trim();
  if (!line) return null;

  // 複数の明示的区切り文字が同じ行に現れうる(例: "apple: りんご, 林檎" のように
  // meaning側にもコロン/カンマが含まれる場合)ため、実際に見つかった位置が最も
  // 左側にあるものを優先する(EXPLICIT_DELIMITERSの配列順ではなく、出現位置基準)。
  let best: { delimiter: string; index: number } | null = null;
  for (const delimiter of EXPLICIT_DELIMITERS) {
    const idx = line.indexOf(delimiter);
    if (idx === -1) continue;
    if (!best || idx < best.index) best = { delimiter, index: idx };
  }

  let parts: [string, string] | null = null;
  if (best) {
    parts = splitOnFirstMatch(line, best.delimiter);
  } else {
    const m = LATIN_TO_JAPANESE_BOUNDARY.exec(line);
    if (m) {
      parts = [line.slice(0, m.index + 1), line.slice(m.index + m[0].length)];
    } else {
      // 複数の連続スペース(全角スペース含む)を最後の手段の区切りとみなす。
      const spaceMatch = /[ 　]{2,}/.exec(line);
      if (spaceMatch) {
        parts = [line.slice(0, spaceMatch.index), line.slice(spaceMatch.index + spaceMatch[0].length)];
      }
    }
  }

  if (!parts) return null;
  const word = parts[0].trim();
  const meaning = parts[1].trim();
  if (!word || !meaning) return null;
  return { word, meaning };
}

/** テキストエリア全体を解析する。空行はスキップ(エラー扱いしない)。 */
export function parseWordList(text: string): WordListParseResult {
  const lines = text.split(/\r?\n/);
  const entries: WordListEntry[] = [];
  const skippedLineNumbers: number[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return; // 空行は無視(スキップ扱いにしない)
    const parsed = parseWordListLine(line);
    if (parsed) entries.push(parsed);
    else skippedLineNumbers.push(i + 1);
  });
  return { entries, skippedLineNumbers };
}

/** RFC4180ライクなCSVフィールドのクォート(カンマ・ダブルクォート・改行を含む場合のみ)。 */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CsvImportPanel.tsx のヘッダ検出(word/meaning等)がそのまま機能する形式で出力する。
 * ヘッダ行を含めることで、貼り付け直後にヘッダなしCSVとして誤読されるリスクを避ける。
 */
export function toWordbookCsv(entries: WordListEntry[]): string {
  const lines = ["word,meaning"];
  for (const e of entries) {
    lines.push(`${csvField(e.word)},${csvField(e.meaning)}`);
  }
  return lines.join("\r\n");
}
