/**
 * RFC4180ライクなCSV/TSVの構造解析(レコード分割+フィールド分割)を1か所に
 * 集約した共有スキャナー。wordListCleaner.ts(列モード)とcsvImportParsing.ts
 * (実際のwordbook CSVインポーター)の両方がこれを利用する。
 *
 * これまでこの2ファイルにそれぞれ独立したクォート状態machineが4つ存在し
 * (wordListCleaner.tsのsplitIntoRecords/splitDelimitedRow、csvImportParsing.ts
 * のsplitCsvRecords/parseLine)、Codexレビューが同じ種類の不具合(bare quote・
 * escaped ""・quoted内改行の扱い)を一方の関数だけ修正して他方に同じ修正が
 * 反映されていない、という形で繰り返し検出していた(PR #105、11/12/15/16巡目)。
 * この共有実装に一本化することで、同じ不具合を将来また4か所別々に踏むリスクを
 * 構造的に無くす。
 *
 * 意図的にRFC CSV/TSVの構造解析だけをここへ集約し、word-list-cleanerの
 * "word meaning"・コロン・ハイフン等のplain-text heuristics(parseWordListLine
 * 本体、quotedPrefixEnd、LATIN_TO_JAPANESE_BOUNDARY等)は対象外のまま
 * wordListCleaner.ts側に残す。あちらは「区切り文字が不統一な自由記述」を
 * 扱うための別種のアルゴリズムであり、RFC構造解析とは別物のため。
 *
 * .mjs(.tsではない)である理由: wordListCleaner.ts/csvImportParsing.tsは
 * どちらも、scripts/testing/*.mjsからNode組み込みのTypeScript剥がし機能で
 * 直接importされ、往復テストされる設計になっている(JSXを含む.tsxコンポーネント
 * 本体を直接importできないため)。もしこのファイルが.tsで、かつ呼び出し側が
 * 拡張子なしの相対import("./csvScanner")を使うと、tsc/Next.jsのbundler解決
 * では正しく動く一方、Nodeのネイティブ実行では拡張子解決ができず
 * テストスクリプトが動かなくなる(過去に同じ理由でwordListCleaner.tsから
 * csvImportParsing.tsへのimportを見送った経緯と同じ制約)。プレーンな.mjsを
 * 明示的な拡張子付きでimportする形であれば、tsc(拡張子付きの実在パスとして
 * そのまま解決)・Node実行(そのまま解決)のどちらでも同じ相対pathで解決できる。
 */

/**
 * `text`をレコード(1行分のCSV/TSV)に分割する。クォートで囲まれたフィールドの
 * 中に、レコード区切りとなる改行(\n または \r\n)が文字どおり含まれていても、
 * 正しく1レコードとして保持する。
 *
 * クォートは、レコードの先頭、または`delimiterChars`のいずれか1文字+
 * 任意の空白の直後にある場合だけ「クォートされたフィールドの開始」とみなす。
 * それ以外の位置(見出し語やインチ記号等、値の途中)に現れた単一の"は、
 * 状態をトグルしないただの文字として扱う。クォート内部の""(doubled quote)は
 * エスケープされた"1文字を表すRFC4180の規則であり、閉じクォートとしては
 * 扱わない(先読みで判定し、ペアごと消費する)。
 *
 * @param {string} text
 * @param {string[]} delimiterChars このテキストで区切り文字として使われうる
 *   1文字ずつの候補一覧(例: [","] や ["\t", ","])。呼び出し時点でまだ
 *   実際の区切り文字が確定していない場合(wordListCleaner.tsの列モードのように、
 *   レコード分割の後で区切り文字を判定する設計)は、候補をすべて渡す。
 * @returns {string[]}
 */
export function splitCsvRecords(text, delimiterChars) {
  const contextPattern = new RegExp(`[${delimiterChars.map(escapeForCharClass).join("")}]\\s*$`);
  const records = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inQuotes && (current === "" || contextPattern.test(current))) {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === '"' && inQuotes) {
      if (text[i + 1] === '"') { current += '""'; i++; continue; }
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

/**
 * 1レコード分の文字列を`delimiter`でフィールドに分割する。クォートは
 * フィールドの先頭(直前が区切り文字または行頭)にある場合だけ「クォートされた
 * フィールドの開始」とみなし、それ以外の位置に現れた単一の"はただの文字として
 * 保持する。クォート内部の""は先読みでエスケープされた"1文字として扱う。
 *
 * @param {string} row
 * @param {string} delimiter 1文字の区切り文字(例: "," または "\t")
 * @returns {string[]}
 */
export function splitCsvFields(row, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' && !inQuotes && current === "") {
      inQuotes = true;
      continue;
    }
    if (char === '"' && inQuotes) {
      if (row[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = false;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function escapeForCharClass(ch) {
  // 文字クラス([...])の中で特別な意味を持ちうる文字だけをエスケープする。
  return ch.replace(/[\]\\^-]/g, "\\$&");
}
