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
// 素のハイフン"-"は意図的にここへ含めない — "well-known"・"mother-in-law"のような
// 複合語の内部ハイフンと、"apple-りんご"のような単語/意味の区切りハイフンを区別できない
// ため、後述のBARE_HYPHEN_BEFORE_JAPANESEで「直後が日本語のときだけ」に限定して扱う
// (Codexレビュー指摘対応、PR #105、P1: 複合語のハイフンで先頭語が切り詰められる問題)。
const EXPLICIT_DELIMITERS = ["\t", "：", " : ", ":", " - ", ","];

// 素のハイフンは、直後が日本語(ひらがな・カタカナ・漢字)のときだけ区切りとみなす
// ("apple-りんご")。直後が英字の場合("well-known"の内部ハイフン等)は複合語の一部として
// 保持し、区切りとして扱わない。
const BARE_HYPHEN_BEFORE_JAPANESE = /-(?=[぀-ヿ一-鿿])/;

// 英字(ラテン文字)から日本語(ひらがな・カタカナ・漢字)への切り替わり位置を区切りとみなす
// フォールバック用の正規表現。"apple りんご" のように、区切り文字を一切使わず単語と
// 意味をスペースだけで並べた行(辞書帳の手書きメモに多い形式)に対応するため。
const LATIN_TO_JAPANESE_BOUNDARY = /[A-Za-z][ 　]*(?=[぀-ヿ一-鿿])/;

// 手打ちで区切ったリストだけでなく、既にCSV化されたテキスト("word","meaning" のような
// ダブルクォート包囲フィールド)がそのまま貼り付けられるケースにも対応する。包囲quoteが
// 両端に揃っている場合のみ剥がし、内部の""(doubled quote)は"へ戻す。片側だけにquoteが
// ある場合(意図的な引用符付き単語等)は誤って壊さないよう何もしない。
function unwrapCsvQuotes(field: string): string {
  if (field.length >= 2 && field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// 行がダブルクォートで始まる場合、その最初のフィールドを閉じる(doubled ""を
// エスケープとして読み飛ばす)実クォートの直後のインデックスを返す。クォートで
// 始まらない行、または閉じクォートが無い行(壊れたCSV)は0を返す — 区切り文字の
// 探索を先頭から行う従来どおりの挙動にフォールバックする。
//
// これが無いと、`"Hello, world","こんにちは世界"` のような1つ目のフィールド自体に
// カンマを含むquoted CSVで、区切り文字の探索がクォート内側のカンマを本来の
// フィールド区切りだと誤認識し、先頭語が途中で切り詰められる
// (Codexレビュー指摘対応、PR #105、P2)。
function quotedPrefixEnd(line: string): number {
  if (line[0] !== '"') return 0;
  let i = 1;
  while (i < line.length) {
    if (line[i] === '"') {
      if (line[i + 1] === '"') {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return 0;
}

/**
 * 1行を word/meaning のペアに分解する。区切り文字が全く見つからない行(意味を
 * 書き忘れている、単語だけの行等)は null を返す(呼び出し側でスキップ扱いにする)。
 */
export function parseWordListLine(rawLine: string): WordListEntry | null {
  const line = rawLine.trim();
  if (!line) return null;

  // 行が引用符付きCSVフィールドで始まる場合、その閉じクォートより前にある
  // 区切り文字候補(クォート内側の生カンマ等)は探索対象から除外する。
  const searchStart = quotedPrefixEnd(line);

  // 複数の明示的区切り文字が同じ行に現れうる(例: "apple: りんご, 林檎" のように
  // meaning側にもコロン/カンマが含まれる場合)ため、実際に見つかった位置が最も
  // 左側にあるものを優先する(EXPLICIT_DELIMITERSの配列順ではなく、出現位置基準)。
  let best: { index: number; length: number } | null = null;
  for (const delimiter of EXPLICIT_DELIMITERS) {
    const idx = line.indexOf(delimiter, searchStart);
    if (idx === -1) continue;
    if (!best || idx < best.index) best = { index: idx, length: delimiter.length };
  }
  {
    const searchArea = line.slice(searchStart);
    const m = BARE_HYPHEN_BEFORE_JAPANESE.exec(searchArea);
    if (m) {
      const idx = searchStart + m.index;
      if (!best || idx < best.index) best = { index: idx, length: 1 };
    }
  }

  let parts: [string, string] | null = null;
  if (best) {
    parts = [line.slice(0, best.index), line.slice(best.index + best.length)];
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
  const word = unwrapCsvQuotes(parts[0].trim());
  const meaning = unwrapCsvQuotes(parts[1].trim());
  if (!word || !meaning) return null;
  return { word, meaning };
}

// 既にCSV化された "word,meaning" (ヘッダ有り)がそのまま貼り付けられた場合、
// ヘッダ行自体を意味のあるペアとして誤って取り込まないようにする(Codexレビュー
// 指摘対応、PR #105、P2: ヘッダ行が word="word" というダミーエントリとして二重に
// 取り込まれる問題)。判定は入力全体の最初の非空行だけに限定する。
//
// CsvImportPanel.tsx のヘッダ検出は行全体に対する部分一致("password"のように
// "word"を含むだけの語も誤検出する)だが、ここでは実際に区切った結果のword/meaning
// フィールドそれぞれが既知のヘッダラベルと完全一致する場合のみヘッダとみなす
// (Codexレビュー指摘対応、PR #105、2巡目、P2: 部分一致では
// parseWordList("password: パスワード\napple: りんご")のpasswordが誤ってヘッダ扱いで
// サイレントに消え、スキップ行としても報告されない問題があった)。
const HEADER_WORD_LABELS = new Set(["word", "英単語", "単語", "english"]);
const HEADER_MEANING_LABELS = new Set(["meaning", "意味", "日本語", "japanese"]);

function isHeaderLine(line: string): boolean {
  const parsed = parseWordListLine(line);
  if (!parsed) return false;
  return HEADER_WORD_LABELS.has(parsed.word.toLowerCase()) && HEADER_MEANING_LABELS.has(parsed.meaning.toLowerCase());
}

/** テキストエリア全体を解析する。空行はスキップ(エラー扱いしない)。 */
export function parseWordList(text: string): WordListParseResult {
  const lines = text.split(/\r?\n/);
  const entries: WordListEntry[] = [];
  const skippedLineNumbers: number[] = [];
  let sawContentLine = false;
  lines.forEach((line, i) => {
    if (!line.trim()) return; // 空行は無視(スキップ扱いにしない)
    if (!sawContentLine) {
      sawContentLine = true;
      if (isHeaderLine(line)) return; // 貼り付けられたCSVのヘッダ行はエントリ化しない
    }
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

// CSV Injection(Formula Injection)対策: セル先頭が = + - @ だと、Excel等の
// 表計算ソフトで開いた際に数式として実行されてしまう(OWASPが挙げる代表的な4文字)。
// カンマ・引用符のCSVエスケープ(csvField)だけでは防げない(quoteされていても
// 数式解釈は行われるため)。対象セルの先頭に、数式として解釈されない ' を追加して
// 無害化する。
//
// この変換は「ダウンロード/コピーされるCSVの中身」にのみ適用し、画面のプレビュー表
// (parseWordListの結果、entries)は元の値のまま表示する。無断でユーザーの元データを
// 書き換えないよう、UI側は必ず「CSV出力時に対象セルの先頭に'を追加する」旨を明示し、
// 実際に何件変換したかをneutralizedCountとして返す(出力仕様と画面説明を一致させる)。
const FORMULA_INJECTION_LEAD_CHARS = ["=", "+", "-", "@"];

function neutralizeFormulaInjection(value: string): { value: string; neutralized: boolean } {
  if (FORMULA_INJECTION_LEAD_CHARS.some((c) => value.startsWith(c))) {
    return { value: `'${value}`, neutralized: true };
  }
  return { value, neutralized: false };
}

export type WordbookCsvResult = {
  csv: string;
  /** = + - @ で始まっていたため先頭に ' を追加(無害化)したセルの数。 */
  neutralizedCount: number;
};

/**
 * CsvImportPanel.tsx のヘッダ検出(word/meaning等)がそのまま機能する形式で出力する。
 * ヘッダ行を含めることで、貼り付け直後にヘッダなしCSVとして誤読されるリスクを避ける。
 */
export function toWordbookCsv(entries: WordListEntry[]): WordbookCsvResult {
  const lines = ["word,meaning"];
  let neutralizedCount = 0;
  for (const e of entries) {
    const word = neutralizeFormulaInjection(e.word);
    const meaning = neutralizeFormulaInjection(e.meaning);
    if (word.neutralized) neutralizedCount++;
    if (meaning.neutralized) neutralizedCount++;
    lines.push(`${csvField(word.value)},${csvField(meaning.value)}`);
  }
  return { csv: lines.join("\r\n"), neutralizedCount };
}

// ダウンロードファイルにのみ付与するUTF-8 BOM。BOM無しのUTF-8 CSVをExcel(特に
// 日本語Windows既定ロケール)で直接開くと、ANSI/Shift-JISとして誤認識され日本語が
// 文字化けする。BOMを付けることでUTF-8として正しく認識される。
// FileReader.readAsText(file, "utf-8")はBOMを自動的に読み飛ばす仕様のため、
// このBOM付きファイルをCsvImportPanel.tsxで再アップロードしても影響しない
// (「コピー」で渡すクリップボードのテキストはOS側で常にUnicodeとして扱われるため
// BOMは不要 = ダウンロードのBlobだけに適用する)。
const UTF8_BOM = "﻿";

export function csvWithBom(csv: string): string {
  return UTF8_BOM + csv;
}
