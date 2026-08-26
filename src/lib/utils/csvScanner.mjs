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

// 候補の閉じクォート(text[idxAfterQuote - 1]の"")の直後が、実際に
// フィールド/レコードの終端として妥当な文脈(空白列の後にdelimiter・改行・
// EOFのいずれか)かどうかを判定する。これが無いと、本来閉じられるべきで
// はない未終端クォートの中に、たまたま別の(無関係な)クォートが後から
// 現れただけで、そちらが誤って「閉じクォート」として食いつかれてしまう
// (例: `a, "bad1\ngood1,x\nb, "bad2\ngood2,y`のように、1つ目の壊れた
// クォートが2つ目の壊れたクォートの"を誤って自分の閉じクォートとして
// 消費してしまい、間の正常な行good1,xごと1つの巨大な壊れたレコードへ
// 呑み込んでしまっていた)。文脈が妥当でない場合は、このクォートを
// トグルしないただの文字として扱い、開いたクォートを維持したまま
// 先へ進む。
function isValidQuoteCloseFollow(text, delimiterSet, idxAfterQuote) {
  let j = idxAfterQuote;
  // delimiterがタブのように空白文字そのものである場合、それ自体をスキップ
  // 対象の空白と誤認識して読み飛ばしてしまわないよう、delimiter自身では
  // ループを止める(Codexレビュー指摘対応ではなく、実装時の自己監査で発見:
  // delimiterChars=["\t"]のとき、正しく閉じたクォートの直後のタブを
  // 「スキップしてよい空白」とみなして通り過ぎてしまい、次の非空白文字が
  // delimiter/改行/EOFのいずれでもないという理由で、正しい閉じクォートまで
  // 誤って未終端と判定していた)。
  while (j < text.length && text[j] !== "\n" && text[j] !== "\r" && !delimiterSet.has(text[j]) && /\s/.test(text[j])) j++;
  if (j >= text.length) return true;
  const ch = text[j];
  return ch === "\n" || ch === "\r" || delimiterSet.has(ch);
}

// beforeOffset(壊れたクォートの開始位置)を含む物理行の先頭位置を、CRLF/LF/
// CR単独のいずれの改行コードでも正しく求める(Codexレビュー指摘対応、PR #105、
// round-18再監査フレッシュレビュー4巡目: \nだけを探すlastIndexOf/indexOfでは
// CR単独の改行コードで行境界を1つも見つけられなかった)。
function findLineStartBefore(text, beforeOffset) {
  let i = beforeOffset - 1;
  while (i >= 0 && text[i] !== "\n" && text[i] !== "\r") i--;
  return i + 1;
}

// fromOffset以降で最初の改行(CRLF/LF/CR単独のいずれか)の直後の位置を返す
// (見つからなければtext.length)。
function findNextLineStart(text, fromOffset) {
  let i = fromOffset;
  while (i < text.length && text[i] !== "\n" && text[i] !== "\r") i++;
  if (i >= text.length) return text.length;
  if (text[i] === "\r" && text[i + 1] === "\n") return i + 2;
  return i + 1;
}

// splitCsvRecords()の中核となる1回分の走査。textのstartOffset位置から、
// 閉じクォートが見つからないまま行き詰まる(inQuotesのままEOFに達する)か、
// テキスト末尾まで正常に完了するかのどちらかで終わる。呼び出し元
// (splitCsvRecords)がこれを繰り返し呼び出し、行き詰まった箇所ごとに
// 「その物理行だけ」を切り離して再開することで、EOFまで閉じられない
// クォート1つのために後続の正当な行(クォート内の正しい複数行フィールドを
// 含む)を丸ごと壊さないようにする。
function scanOnePass(text, startOffset, delimiterSet, startLine) {
  const records = [];
  const recordStartLines = [];
  let current = "";
  let currentStartLine = startLine;
  let inQuotes = false;
  // レコード先頭は常にフィールド境界(旧実装の`current === ""`特例に相当)。
  let atFieldBoundary = true;
  let physicalLine = startLine;
  let quoteOpenOffset = null;
  let quoteOpenLine = null;

  for (let i = startOffset; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inQuotes && atFieldBoundary) {
      inQuotes = true;
      current += ch;
      atFieldBoundary = false;
      quoteOpenOffset = i;
      quoteOpenLine = physicalLine;
      continue;
    }
    if (ch === '"' && inQuotes) {
      if (text[i + 1] === '"') { current += '""'; i++; continue; }
      if (isValidQuoteCloseFollow(text, delimiterSet, i + 1)) {
        inQuotes = false;
        current += ch;
        atFieldBoundary = false;
        quoteOpenOffset = null;
        continue;
      }
      // 直後の文脈がフィールド/レコード終端として妥当でないため、閉じ
      // クォートとして扱わず、ただの文字として飲み込んで開いたままにする。
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      records.push(current);
      recordStartLines.push(currentStartLine);
      current = "";
      atFieldBoundary = true;
      physicalLine++;
      currentStartLine = physicalLine;
      if (ch === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    if (inQuotes && (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n"))) {
      // クォート内部の改行(正当な複数行フィールド)でも、物理行番号自体は
      // 引き続き数える(warningsのphysicalLineを正確にするため)。
      // 意図的に行数上限を設けない: 正当な複数行クォートフィールドの長さに
      // 上限を課すと、100行を超える正当なクォートフィールドが誤って未終端と
      // 判定されてしまう(Codexレビュー指摘対応、PR #105、round-18再監査
      // フレッシュレビュー5巡目: 直前に試みたMAX_LINES_SEARCHING_FOR_QUOTE_
      // CLOSEによる行数上限は、性能問題を解消する代わりにこの正しさの回帰を
      // 引き起こしていた)。準二次性能問題への対策は、代わりに呼び出し元
      // splitCsvRecords()側で「再同期の試行回数」自体に上限を設ける形で行う
      // (1回1回の探索の深さではなく、壊れた行を何回まで個別に復旧しようと
      // 試みるかを制限する — 正当なフィールドの長さには一切影響しない)。
      physicalLine++;
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

  if (inQuotes) {
    return { records, recordStartLines, brokenAtOffset: quoteOpenOffset, brokenAtLine: quoteOpenLine };
  }
  records.push(current);
  recordStartLines.push(currentStartLine);
  return { records, recordStartLines, brokenAtOffset: null, brokenAtLine: null };
}

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
 * フィールド境界で開いたクォートにEOFまで対応する閉じクォートが見つからない
 * 場合(壊れたCSV/TSV、単なる書き忘れ)、クォートが開いた「物理行」だけを
 * 破損した行として除外し、その次の物理行からクォート解釈を再開する
 * (Codexレビュー指摘対応、PR #105、round-17再監査フレッシュレビューP2:
 * `inch, " symbol\napple,りんご`が2レコードに分かれず1レコードとして
 * 返され、apple行がinchのmeaningへ静かに混入していた)。テキスト全体を
 * 素朴な改行分割へ丸ごとフォールバックすると、この壊れた箇所より後にある
 * 正当な複数行クォートフィールドまで巻き添えで壊れてしまうため、
 * 「壊れた1行だけ除外→残りは通常どおりクォート解釈を続行」という
 * 再同期(resync)方式を採る。
 *
 * 閉じクォート候補(直前が"で、doubled ""ではない)は、その直後(空白列を
 * 挟んでよい)がdelimiter・改行・EOFのいずれかである場合だけ実際に「閉じる」
 * とみなす(isValidQuoteCloseFollow())。これが無いと、"a, "bad1\ngood1,x\n
 * b, "bad2\ngood2,y"のように壊れたクォートが複数バラバラに現れる入力で、
 * 1つ目の壊れたクォートが2つ目の(無関係な)壊れたクォートの"を誤って
 * 自分の閉じクォートとして食いつき、間の正常な行(good1,x)ごと1つの巨大な
 * レコードへ呑み込んでしまう。
 *
 * それでも解決できない既知の限界が1つ残る: 壊れたクォートの後に、正しく
 * 閉じられた(≒直後の文脈が妥当な)複数行クォートフィールドが存在する場合、
 * そのフィールド自身の正当な閉じクォートが、直前の壊れたクォートの閉じ
 * クォートとして誤って食いつかれてしまう(両者を区別する情報がテキスト自体
 * に無いため)。これはフォワード1パスのストリーミングパーサ(PapaParse等)
 * 全般に共通する既知の限界であり、このスキャナー固有の問題ではない。
 * 保証できるのは「壊れたクォートより前にある複数行クォートフィールドは
 * 必ず正しく処理される」(1パス処理の性質上、後方の壊れたクォートが前方の
 * 内容へ影響することはあり得ない)ことと、「壊れた行の直後にある、それ自体が
 * クォートを一切含まない通常の行は必ず回復される」ことの2点。
 *
 * @param {string} text
 * @param {string[]} delimiterChars このテキストで区切り文字として使われうる
 *   1文字ずつの候補一覧(例: [","] や ["\t", ","])。呼び出し時点でまだ
 *   実際の区切り文字が確定していない場合(wordListCleaner.tsの列モードのように、
 *   レコード分割の後で区切り文字を判定する設計)は、候補をすべて渡す。
 * @returns {{
 *   records: string[],
 *   recordStartLines: number[],
 *   warnings: Array<{type: "unterminated_quote", physicalLine: number, skippedLineText: string, note?: string}>,
 * }} recordsとrecordStartLinesは同じ長さ・同じ順序で対応する(records[i]は
 *   元テキストのrecordStartLines[i]行目から始まる)。破損して除外された行は
 *   recordsに含まれず、その行の情報はwarningsにのみ記録される。
 */
// 個別に復旧を試みる破損行の最大件数。これを超えたら、以降は1行ずつの
// 精密な復旧を諦め、残り全体を1件の集約警告として報告する(Codexレビュー
// 指摘対応、PR #105、round-18再監査フレッシュレビュー4/5巡目: 正当な複数行
// クォートフィールドの長さには一切上限を課さない代わりに[前述のコメント
// 参照]、閉じクォートを持たない行が非常に多数[例: 5,000行]連続する病的な
// 入力では、1行スキップして再開するたびに残りテキスト全体をEOFまで
// 再スキャンすることになり準二次的に遅くなる。個々の探索の深さではなく
// 「壊れた行を何回まで個別に復旧しようと試みるか」を制限することで、
// 正当なフィールドの長さに影響を与えずに最悪ケースの総コストを
// O(この上限 × 入力長)に抑える)。
const MAX_MALFORMED_ROW_RECOVERY_ATTEMPTS = 1000;

export function splitCsvRecords(text, delimiterChars) {
  const delimiterSet = new Set(delimiterChars);
  const records = [];
  const recordStartLines = [];
  // 明示的に型注釈する: pushする2種類のwarningオブジェクト形状(note有り/無し)
  // をTypeScriptが個別のpush呼び出しから推論すると、typeフィールドがリテラル型
  // "unterminated_quote"から広い string 型へ広がってしまい、csvImportParsing.ts/
  // wordListCleaner.ts側のMalformedCsvWarning[]への代入で型エラーになる。
  /** @type {Array<{type: "unterminated_quote", physicalLine: number, skippedLineText: string, note?: string}>} */
  const warnings = [];
  let scanFrom = 0;
  let lineBase = 1;
  let recoveryAttempts = 0;

  while (scanFrom <= text.length) {
    const pass = scanOnePass(text, scanFrom, delimiterSet, lineBase);
    records.push(...pass.records);
    recordStartLines.push(...pass.recordStartLines);
    if (pass.brokenAtOffset === null) break;

    if (++recoveryAttempts > MAX_MALFORMED_ROW_RECOVERY_ATTEMPTS) {
      // 個別復旧の試行回数が上限を超えた。これ以上1行ずつ精密に復旧しようと
      // せず、壊れたクォートが開いた地点から先の残り全体を1件の集約警告に
      // まとめる(内容は破棄せず、監査用にskippedLineTextへ丸ごと残す)。
      warnings.push({
        type: "unterminated_quote",
        physicalLine: pass.brokenAtLine,
        skippedLineText: text.slice(findLineStartBefore(text, pass.brokenAtOffset)),
        note: `未終端クォートによる破損行が${MAX_MALFORMED_ROW_RECOVERY_ATTEMPTS}件を超えたため、これ以降は個別の行単位での復旧を行わず、残り全体をまとめて破損扱いにしました。`,
      });
      break;
    }

    // 壊れたクォートが開いた物理行の範囲[lineStart, nextLineStart)を特定し、
    // その1行だけを破損行として除外する。次のパスはnextLineStartから、
    // クォート解釈を最初からやり直す形で再開する。CRLF/LF/CR単独のいずれの
    // 改行コードでも正しく行境界を判定する(Codexレビュー指摘対応、PR #105、
    // round-18再監査フレッシュレビュー4巡目: 旧実装は\nだけを探しており、
    // CR単独(古いMac形式)の改行では行境界を1つも見つけられず、入力全体が
    // 1つの破損行として警告に丸ごと取り込まれ、後続の正当な行も巻き添えで
    // 失われていた)。
    const lineStart = findLineStartBefore(text, pass.brokenAtOffset);
    const nextLineStart = findNextLineStart(text, pass.brokenAtOffset);
    const skippedLineText = text.slice(lineStart, nextLineStart).replace(/\r\n$|\r$|\n$/, "");

    warnings.push({
      type: "unterminated_quote",
      physicalLine: pass.brokenAtLine,
      skippedLineText,
    });

    scanFrom = nextLineStart;
    lineBase = pass.brokenAtLine + 1;
    if (nextLineStart >= text.length) break;
  }

  return { records, recordStartLines, warnings };
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
