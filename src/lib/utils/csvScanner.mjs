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
 * 「フィールド境界にいるか」は、`current`(それまでの累積文字列)全体に対して
 * 正規表現を都度re-scanするのではなく、1文字ごとにO(1)で更新する`atFieldBoundary`
 * フラグとして追跡する(Codexレビュー指摘対応、PR #105、round-17再監査P2:
 * delimiterでもクォートでもない単一の"を大量に含む巨大な1レコード(例:
 * "a\""を80,000回繰り返した約16万文字)では、都度current全体を正規表現で
 * re-scanする実装だとO(n^2)になり、ブラウザのメインスレッドを約13秒間
 * ブロックしていた)。
 *
 * @param {string} text
 * @param {string[]} delimiterChars このテキストで区切り文字として使われうる
 *   1文字ずつの候補一覧(例: [","] や ["\t", ","])。呼び出し時点でまだ
 *   実際の区切り文字が確定していない場合(wordListCleaner.tsの列モードのように、
 *   レコード分割の後で区切り文字を判定する設計)は、候補をすべて渡す。
 * @returns {string[]}
 */
export function splitCsvRecords(text, delimiterChars) {
  const delimiterSet = new Set(delimiterChars);
  const records = [];
  let current = "";
  let inQuotes = false;
  // レコード先頭は常にフィールド境界(旧実装の`current === ""`特例に相当)。
  let atFieldBoundary = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inQuotes && atFieldBoundary) {
      inQuotes = true;
      current += ch;
      atFieldBoundary = false;
      continue;
    }
    if (ch === '"' && inQuotes) {
      if (text[i + 1] === '"') { current += '""'; i++; continue; }
      inQuotes = false;
      current += ch;
      atFieldBoundary = false;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      records.push(current);
      current = "";
      atFieldBoundary = true;
      if (ch === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    if (!inQuotes) {
      if (delimiterSet.has(ch)) {
        atFieldBoundary = true;
      } else if (!(atFieldBoundary && /\s/.test(ch))) {
        // delimiter直後の空白が続く間だけatFieldBoundaryを維持する。
        atFieldBoundary = false;
      }
    }
    current += ch;
  }
  // フィールド境界で開いたクォートに、EOFまでに対応する閉じクォートが
  // 一度も見つからなかった場合(壊れたCSV/TSV、または単なる書き忘れ)。
  // このまま返すと、開いたクォート以降の改行がすべてレコード区切りとして
  // 扱われず、以降の全行が1レコードへ呑み込まれてしまう(Codexレビュー
  // 指摘対応、PR #105、round-17再監査P2: `inch, " symbol\napple,りんご`が
  // 2レコードに分かれず1レコードとして返され、apple行がinchのmeaningへ
  // 静かに混入していた)。閉じクォートが無いと確定した時点で、このテキスト
  // 全体をクォートを一切解釈しない素朴な改行分割にフォールバックする方が、
  // 後続の正当な行を1行も失わずに済む安全側の挙動になる。
  if (inQuotes) {
    return text.split(/\r\n|\r|\n/);
  }
  records.push(current);
  return records;
}

/**
 * 1レコード分の文字列を`delimiter`でフィールドに分割する。クォートは
 * フィールドの先頭(直前が区切り文字・行頭、またはそれらの直後の空白のみ)に
 * ある場合だけ「クォートされたフィールドの開始」とみなし、それ以外の位置に
 * 現れた単一の"はただの文字として保持する。クォート内部の""は先読みで
 * エスケープされた"1文字として扱う。
 *
 * フィールド先頭かどうかは、splitCsvRecords()と同じ理由でO(1)の
 * `atFieldStart`フラグとして追跡する(Codexレビュー指摘対応、PR #105、
 * round-17再監査P2)。区切り文字とクォートの間に空白がある入力
 * (例: `word,meaning\napple, "red, fruit"`)では、旧実装(`current === ""`
 * だけを見る判定)だと空白が既にcurrentへ積まれた時点でクォート開始と
 * 認識できず、内部のカンマを誤って区切り文字として分割してしまっていた
 * (splitCsvRecords側は元々`delimiter\s*"`を許容しており、両者で挙動が
 * 食い違っていた)。空白のみを飛ばしてクォート開始を認識し、その空白は
 * 破棄する(引用符直前の空白は値に含めない)。
 *
 * @param {string} row
 * @param {string} delimiter 1文字の区切り文字(例: "," または "\t")
 * @returns {string[]}
 */
export function splitCsvFields(row, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;
  // フィールド先頭(または先頭からの空白の連続)にいるかどうか。
  let atFieldStart = true;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' && !inQuotes && atFieldStart) {
      inQuotes = true;
      current = ""; // ここまでに積まれた先頭の空白は破棄する。
      continue;
    }
    if (char === '"' && inQuotes) {
      if (row[i + 1] === '"') { current += '"'; i++; continue; }
      inQuotes = false;
      atFieldStart = false;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      atFieldStart = true;
      continue;
    }
    if (!inQuotes) {
      atFieldStart = atFieldStart && /\s/.test(char);
    }
    current += char;
  }
  result.push(current);
  return result;
}
