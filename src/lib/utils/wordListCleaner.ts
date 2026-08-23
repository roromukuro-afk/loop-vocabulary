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

// タブは表計算ソフトからのコピペ由来で最も構造化されている区切り文字であり、行内に
// (括弧の外で)1つでも見つかれば、他のどの区切り文字候補よりも常に優先する
// (Codexレビュー指摘対応、PR #105、9巡目、P2: "Hello, world\tこんにちは"のような
// タブ区切り行で、意味側にたまたま含まれるカンマの位置がタブより左にあるという
// だけの理由で誤って優先され、先頭語が切り詰められていた)。
const TAB_DELIMITER = "\t";

// タブ以外の明示的な区切り文字。行内でどれか複数一致する場合、この配列の並び順では
// なく「最も左側で最初に一致したもの」を採用する(全角/半角コロンやハイフンは辞書
// 形式の慣習に合わせて優先度をつけている)。
// 素のハイフン"-"は意図的にここへ含めない — "well-known"・"mother-in-law"のような
// 複合語の内部ハイフンと、"apple-りんご"のような単語/意味の区切りハイフンを区別できない
// ため、後述のBARE_HYPHEN_BEFORE_JAPANESEで「直後が日本語のときだけ」に限定して扱う
// (Codexレビュー指摘対応、PR #105、P1: 複合語のハイフンで先頭語が切り詰められる問題)。
const PUNCTUATION_DELIMITERS = ["：", " : ", ":", " - ", ","];

// 素のハイフンは、直後が(間に半角/全角スペースを挟んでもよい)日本語(ひらがな・
// カタカナ・漢字)のときだけ区切りとみなす("apple-りんご"・"apple- りんご")。
// 直後が英字の場合("well-known"の内部ハイフン等)は複合語の一部として保持し、区切りと
// して扱わない。ハイフン直後の空白を許容していなかったため、"apple- りんご"のような
// 非対称なハイフン区切り(UIが対応区切り文字としてハイフンを案内しているにもかかわらず)
// が一切マッチせずスキップされていた(Codexレビュー指摘対応、PR #105、9巡目、P2)。
const BARE_HYPHEN_BEFORE_JAPANESE = /-[ 　]*(?=[぀-ヿ一-鿿])/;

// 英字・数字・(英数字を含む用語でよく使われる記号)から日本語(ひらがな・カタカナ・漢字)
// への切り替わり位置を区切りとみなすフォールバック用の正規表現。"apple りんご" のように、
// 区切り文字を一切使わず単語と意味をスペースだけで並べた行(辞書帳の手書きメモに多い形式)
// に対応するため。境界直前の1文字だけを英字[A-Za-z]に限定していたため、"COVID-19 新型
// コロナ"・"B2 中級"・"24/7 常時"・"C++ シープラスプラス"のように数字や記号で終わる語が
// 一切マッチせず、スキップ扱いになっていた(Codexレビュー指摘対応、PR #105、5巡目、P2)。
// 境界直前の1文字を英数字と用語でよく使う記号(+ # . /)まで広げる。単語全体
// ("COVID-19"等)は、このマッチ位置より前の全文字がline.slice(0, index)で
// そのまま含まれるため、ここで広げるのは「境界直前の1文字」の判定基準だけでよい。
//
// 意味が日本語文字ではなく品詞注記の丸括弧("apple （名）りんご"・"run (動) 走る")から
// 始まる場合、直後に日本語文字が続かないためこの境界が一切マッチせず、行全体が
// スキップされていた(Codexレビュー指摘対応、PR #105、6巡目、P1)。境界直後に丸括弧の
// 注記を許容してから日本語文字を要求するオプショナル部分を追加する。日本語文字が
// 最終的に続かない行("Q&A (note)"のような注記のみの英語行)には従来どおりマッチしない。
//
// 括弧の中身を任意の文字列(最大12文字)まで許容していたため、"go (went, gone) 行く"の
// ような不規則動詞の活用形を単語側に含めたい括弧まで意味側の品詞注記として誤って
// 扱い、活用形がwordから静かに失われていた(Codexレビュー指摘対応、PR #105、7巡目、P2)。
// 既知の品詞注記ラベルのみに限定し、それ以外の括弧(活用形・補足説明等)は従来どおり
// このショートカットの対象外とする(該当行はEXPLICIT_DELIMITERS等の他の判定に委ねるか、
// 解析不能としてskippedLineNumbersに記録される — 誤って中身を書き換えるより安全)。
const POS_ANNOTATION_LABELS = [
  "名詞", "動詞", "形容詞", "形容動詞", "副詞", "代名詞", "前置詞", "接続詞", "感嘆詞", "助動詞", "冠詞", "間投詞",
  "自動詞", "他動詞", "自動", "他動",
  "名", "動", "形", "副", "代", "前", "接", "感", "助", "冠",
];
// 代替候補は最長一致を優先する順(例: "動詞"が"動"より先に試される)ようソートする。
const POS_ANNOTATION_ALTERNATION = [...POS_ANNOTATION_LABELS]
  .sort((a, b) => b.length - a.length)
  .join("|");
const LATIN_TO_JAPANESE_BOUNDARY = new RegExp(
  `[A-Za-z0-9+#./][ 　]*(?=(?:[（(](?:${POS_ANNOTATION_ALTERNATION})[）)][ 　]*)?[぀-ヿ一-鿿])`,
);

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

// 丸括弧(半角()・全角（）)の中にある位置ではtrueを返す判定関数を、行1本ぶん
// 前計算する。"go (went, gone) 行く"のように、活用形等の丸括弧注記の中に
// EXPLICIT_DELIMITERSの文字(カンマ等)が現れる場合、それを単語/意味の区切りとして
// 誤検出しないようにするため(Codexレビュー指摘対応、PR #105、8巡目、P2)。
// 閉じ括弧が無い壊れた入力では、以降すべて「括弧の中」とみなし安全側に倒す。
function buildInsideParenMask(line: string): boolean[] {
  const mask = new Array<boolean>(line.length).fill(false);
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(" || ch === "（") depth++;
    mask[i] = depth > 0;
    if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
  }
  return mask;
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

  // "go (went, gone) 行く"のように、活用形等の丸括弧注記の中にEXPLICIT_DELIMITERSの
  // 文字(カンマ等)が現れる場合、それを区切りとして誤検出しないための位置マスク。
  const insideParen = buildInsideParenMask(line);

  // タブが(括弧の外で)行内に見つかれば、他のどの候補よりも常に優先し、以降の
  // punctuation/ハイフン/ラテン文字境界の判定は一切行わない
  // (Codexレビュー指摘対応、PR #105、9巡目、P2)。
  let best: { index: number; length: number } | null = null;
  {
    let idx = line.indexOf(TAB_DELIMITER, searchStart);
    while (idx !== -1 && insideParen[idx]) {
      idx = line.indexOf(TAB_DELIMITER, idx + 1);
    }
    if (idx !== -1) best = { index: idx, length: 1 };
  }

  // 半角/全角コロンの直後に空白がある場合("apple: red りんご"のように、コロンの
  // 後にさらに英語の語句が続いてから日本語へ切り替わる場合)は、"word: meaning"
  // というこのツールが案内する最も典型的な辞書形式の区切りとみなし、下記の
  // ラテン→日本語境界より優先する。優先しないと、"red"の直後の空白が
  // ラテン→日本語境界としてマッチしてしまい、"apple: red"が丸ごとwordに
  // 取り込まれてしまう(Codexレビュー指摘対応、PR #105、12巡目、P2)。
  // コロンの直後に空白が無い場合("8:30"のような時刻表記等、コロンが1つの語の
  // 内部にある場合)はこの優先扱いの対象外とし、下記のラテン→日本語境界に
  // 判定を委ねる(このケースを区別しないと、この優先付けが"8:30 午前八時半"の
  // ような既存のケースを壊してしまう)。
  if (!best) {
    for (const colon of ["：", ":"]) {
      let idx = line.indexOf(colon, searchStart);
      while (idx !== -1) {
        const nextChar = line[idx + colon.length];
        if (!insideParen[idx] && (nextChar === " " || nextChar === "　")) {
          if (!best || idx < best.index) best = { index: idx, length: colon.length };
          break;
        }
        idx = line.indexOf(colon, idx + 1);
      }
    }
  }

  // ラテン文字→日本語境界(空白ベース)も、タブと同様に見つかれば常に優先し、
  // 以降のpunctuation/ハイフンの判定は行わない(Codexレビュー指摘対応、PR #105、
  // 11巡目、P2)。以前はこの境界をpunctuationと同じ「最も左側」比較に含めて
  // いたため、"Hello, world こんにちは世界"のように、見出し語の内部にたまたま
  // カンマが含まれる行で、そのカンマの位置がこの空白境界より左にあるという
  // だけの理由で誤って優先され、"Hello"だけがwordとして切り詰められていた
  // ("8:30 午前八時半"のコロンも同様)。空白で日本語へ切り替わる境界が見つかった
  // 場合、それより前にあるpunctuationは見出し語の一部とみなし、区切りとして
  // 使わない。
  if (!best) {
    const searchArea = line.slice(searchStart);
    const m = LATIN_TO_JAPANESE_BOUNDARY.exec(searchArea);
    if (m) {
      // 元のフォールバック実装([0, m.index+1] / [m.index+m[0].length, ])と同じ
      // 分割位置になるよう、マッチしたラテン文字自体はword側に残し、その後の
      // 空白だけを区切りとして消費する形に変換する。
      const idx = searchStart + m.index + 1;
      const length = m[0].length - 1;
      if (!insideParen[idx]) best = { index: idx, length };
    }
  }

  if (!best) {
    // 複数の明示的区切り文字が同じ行に現れうる(例: "apple: りんご, 林檎" のように
    // meaning側にもコロン/カンマが含まれる場合)ため、実際に見つかった位置が最も
    // 左側にあるものを優先する(PUNCTUATION_DELIMITERSの配列順ではなく、出現位置基準)。
    // 括弧の中で見つかった位置は候補から除外し、括弧の外にある次の出現を探す
    // (Codexレビュー指摘対応、PR #105、8巡目、P2)。
    for (const delimiter of PUNCTUATION_DELIMITERS) {
      let idx = line.indexOf(delimiter, searchStart);
      while (idx !== -1 && insideParen[idx]) {
        idx = line.indexOf(delimiter, idx + 1);
      }
      if (idx === -1) continue;
      if (!best || idx < best.index) best = { index: idx, length: delimiter.length };
    }
    {
      const searchArea = line.slice(searchStart);
      const re = new RegExp(BARE_HYPHEN_BEFORE_JAPANESE, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(searchArea))) {
        const idx = searchStart + m.index;
        if (!insideParen[idx]) {
          if (!best || idx < best.index) best = { index: idx, length: m[0].length };
          break;
        }
      }
    }
  }

  let parts: [string, string] | null = null;
  if (best) {
    parts = [line.slice(0, best.index), line.slice(best.index + best.length)];
  } else {
    // 複数の連続スペース(全角スペース含む)を最後の手段の区切りとみなす。
    const spaceMatch = /[ 　]{2,}/.exec(line);
    if (spaceMatch) {
      parts = [line.slice(0, spaceMatch.index), line.slice(spaceMatch.index + spaceMatch[0].length)];
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

// CsvImportPanel.tsx / csvImportParsing.ts が実際に認識する列名(word/meaning/
// phonetic/example/example_ja)と同じラベル集合。word,meaning,phonetic のような
// 3列以上の本物のCSVがそのまま貼り付けられた場合、既存の「最も左側のカンマで
// 2分割する」1行ずつのヒューリスティックでは phonetic 等の後続列が meaning 側へ
// 丸ごと畳み込まれてしまう(Codexレビュー指摘対応、PR #105、9巡目、P2)。
const CSV_COLUMN_LABELS: Record<"word" | "meaning", string[]> = {
  word: ["word", "英単語", "単語", "english"],
  meaning: ["meaning", "意味", "日本語", "japanese"],
};

/**
 * 先頭行が「本物のCSV/TSVヘッダ」かどうかを判定する。word/meaning列の両方を含む
 * 2列以上の行であればCSV列モードとみなし、以降の各行を構造的なCSV/TSVフィールド
 * として解析する(Codexレビュー指摘対応、PR #105、13巡目、P2: 2列だけの
 * word,meaning CSVを対象外にしていたため、値自体に区切り文字候補の文字(コロン等)を
 * 含む本物のCSVが1行ずつのヒューリスティックへ誤って渡り、壊れていた)。
 */
// csvImportParsing.ts の parseLine() と同じロジック(クォート対応のCSVフィールド
// 分割)をここへ複製している。他ファイルからimportしていないのは意図的 —
// csvImportParsing.ts自身のdocstringが述べているとおり、この種の純粋関数ファイルは
// scripts/testing/*.mjsからNodeのネイティブTS実行で直接importして往復テストできる
// よう、ファイル単体で完結させる方針のため(このファイル→他ファイルへの相対import
// を追加すると、tsc/Next.jsのbundler解決では正しく動く拡張子なし指定が、Nodeの
// ネイティブTS実行では解決できずテストスクリプトが動かなくなる)。
// delimiterを引数化しているのは、コピペされたスプレッドシート由来のタブ区切り
// 複数列("word\tmeaning\tphonetic")も、CSV由来のカンマ区切り複数列と同じロジックで
// 列選択できるようにするため(Codexレビュー指摘対応、PR #105、10巡目、P2)。
function splitDelimitedRow(row: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// レコード(1件分のword/meaning行)の区切りとなる改行を、クォートの中/外を区別して
// 判定する。text全体を単純にtext.split(/\r?\n/)すると、toWordbookCsv()自身が
// 出力しうる(csvField()参照)「意味に改行を含む値をダブルクォートで囲んだCSV」を
// 貼り直した際、クォート内部の改行でレコードが分断され、後半が別の壊れた行として
// 誤ってスキップされてしまう(Codexレビュー指摘対応、PR #105、10巡目、P2)。
//
// クォートを「行内のどこにあっても常に状態をトグルする記号」として扱うと、
// "quote: 「\"」という記号\napple: りんご" のように、区切り文字でも何でもない
// ただの記号としての単一の"が現れただけの行(見出し語自体にたまたま含まれる
// クォート文字)で、以降の改行までもがすべて「クォートの中」とみなされ、
// 次の行(apple: りんご)が誤って同じレコードへ呑み込まれてしまっていた
// (Codexレビュー指摘対応、PR #105、11巡目、P2)。CSVの本物のクォートフィールドは
// 必ず「レコードの先頭」または「区切り文字の直後」で始まる、というRFC4180の
// 構造的な制約を使い、それ以外の位置に現れた単一の"は状態をトグルしない
// ただの文字として扱う。
const RECORD_START_QUOTE_CONTEXT = /[,\t：:]\s*$/;

function splitIntoRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inQuotes && (current === "" || RECORD_START_QUOTE_CONTEXT.test(current))) {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === '"' && inQuotes) {
      // クォートで開いたフィールドの内部にある""(doubled quote)は、csvField()が
      // 実際に出力しうるエスケープされた"1文字を表すRFC4180の規則であり、
      // フィールドを閉じるものではない。これを閉じクォートとして扱うと、
      // "say ""hi""\nnext line"のような値で最初の""の片方だけを閉じクォートと
      // 誤認識し、以降を「クォートの外」とみなしてしまうため、直後の改行で
      // 誤ってレコードが分断されていた(Codexレビュー指摘対応、PR #105、12巡目、P2)。
      if (text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = false;
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

// タブ区切りの複数列ヘッダも、カンマ区切りと同じ列選択ロジックで扱う
// (Codexレビュー指摘対応、PR #105、10巡目、P2)。タブの方が構造的に曖昧さが
// 少ないため先に判定する。
const COLUMN_MODE_DELIMITERS = ["\t", ","];

// 2列だけのword,meaning CSVも、3列以上と同じ構造的な列選択(splitDelimitedRow)で
// 扱う。以前は「誤検出リスクを避けるため」2列を対象外とし、1行ずつの
// ヒューリスティックへ委ねていたが、そのヒューリスティックはCSV/TSVのクォート・
// エスケープ規則を認識しないため、"word,meaning\n8:30,午前八時半"のような
// 値自体にコロンを含む本物の2列CSV(toWordbookCsvが自分自身で生成しうる形式でも
// ある)で、区切り文字候補の中では出現位置が最も左側というだけの理由でコロンが
// 誤って区切りとして選ばれ、"8:30"というwordが"8"に切り詰められていた
// (Codexレビュー指摘対応、PR #105、13巡目、P2)。
function detectColumnMode(headerLine: string): { delimiter: string; wordIndex: number; meaningIndex: number } | null {
  for (const delimiter of COLUMN_MODE_DELIMITERS) {
    const fields = splitDelimitedRow(headerLine, delimiter);
    if (fields.length < 2) continue;
    let wordIndex = -1;
    let meaningIndex = -1;
    fields.forEach((raw, i) => {
      const label = raw.trim().toLowerCase();
      if (wordIndex === -1 && CSV_COLUMN_LABELS.word.includes(label)) wordIndex = i;
      if (meaningIndex === -1 && CSV_COLUMN_LABELS.meaning.includes(label)) meaningIndex = i;
    });
    if (wordIndex !== -1 && meaningIndex !== -1) return { delimiter, wordIndex, meaningIndex };
  }
  return null;
}

/** テキストエリア全体を解析する。空行はスキップ(エラー扱いしない)。 */
export function parseWordList(text: string): WordListParseResult {
  const records = splitIntoRecords(text);
  const entries: WordListEntry[] = [];
  const skippedLineNumbers: number[] = [];

  // 各レコードの開始行番号(1始まり)。クォート内部に改行を含むレコードでも、
  // スキップ行番号が実際の開始位置を正しく指すよう、直前レコードまでの改行数を
  // 累計して求める(splitIntoRecords自体が既にクォート内の改行を保持したまま
  // レコードへ含めているため、そのままカウントできる)。
  let lineCursor = 1;
  const lineNumbers = records.map((r) => {
    const start = lineCursor;
    lineCursor += (r.match(/\r\n|\r|\n/g)?.length ?? 0) + 1;
    return start;
  });

  const firstContentIndex = records.findIndex((r) => r.trim());
  const columnMode = firstContentIndex === -1 ? null : detectColumnMode(records[firstContentIndex]);

  if (columnMode) {
    // 3列以上の本物のCSV/TSV: 各レコードを区切り文字でCSV/TSVフィールドとして
    // 解釈し、word/meaning列だけを取り出す(phonetic等の他の列は無視し、meaning側へ
    // 畳み込まない)。
    records.forEach((record, i) => {
      if (!record.trim()) return;
      if (i === firstContentIndex) return; // ヘッダ行自体はエントリ化しない
      const fields = splitDelimitedRow(record, columnMode.delimiter);
      const word = (fields[columnMode.wordIndex] ?? "").trim();
      const meaning = (fields[columnMode.meaningIndex] ?? "").trim();
      if (word && meaning) entries.push({ word, meaning });
      else skippedLineNumbers.push(lineNumbers[i]);
    });
    return { entries, skippedLineNumbers };
  }

  let sawContentLine = false;
  records.forEach((line, i) => {
    if (!line.trim()) return; // 空行は無視(スキップ扱いにしない)
    if (!sawContentLine) {
      sawContentLine = true;
      if (isHeaderLine(line)) return; // 貼り付けられたCSVのヘッダ行はエントリ化しない
    }
    const parsed = parseWordListLine(line);
    if (parsed) entries.push(parsed);
    else skippedLineNumbers.push(lineNumbers[i]);
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
