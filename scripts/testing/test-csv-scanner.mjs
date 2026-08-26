/**
 * src/lib/utils/csvScanner.mjs(wordListCleaner.tsとcsvImportParsing.tsが共有する
 * RFC CSV/TSV構造スキャナー)単体の直接テスト。両ファイル経由の統合テストは
 * test-word-list-cleaner-parser.mjs / test-word-list-cleaner-csv-differential.mjs
 * 側でカバーしているが、こちらは共有スキャナーの生の入出力契約(bare quote、
 * escaped ""、quoted newline、CRLF、delimiter内包、末尾空セル、未終端クォートの
 * 復旧)を関数単位で直接固定する。
 *
 * 使い方: node scripts/testing/test-csv-scanner.mjs
 */
import { splitCsvRecords, splitCsvFields } from "../../src/lib/utils/csvScanner.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) ok(msg);
  else bad(`${msg}: actual=${a}, expected=${e}`);
}

// splitCsvRecords()はround-18で{records, recordStartLines, warnings}を返す
// ようになった(単なるstring[]ではない)。records部分だけを見たい既存の
// 単純なテストのための薄いヘルパー。
function records(text, delimiterChars) {
  return splitCsvRecords(text, delimiterChars).records;
}

function main() {
  // ---- splitCsvFields: 基本のカンマ分割 ----
  eq(splitCsvFields("a,b,c", ","), ["a", "b", "c"], "基本のカンマ区切り3フィールド");
  eq(splitCsvFields("a\tb\tc", "\t"), ["a", "b", "c"], "基本のタブ区切り3フィールド");

  // ---- bare quote(フィールド途中の単一"、区切り文字でも何でもない記号) ----
  eq(splitCsvFields('5" unit', ","), ['5" unit'], "フィールド途中の単一\"(インチ記号)は文字として保持される");
  eq(splitCsvFields('a,5" unit,c', ","), ["a", '5" unit', "c"], "2つ目のフィールド途中の単一\"も保持される");

  // ---- クォートされたフィールド(先頭がクォート) ----
  eq(splitCsvFields('"a,b",c', ","), ["a,b", "c"], "クォートされたフィールド内のカンマは区切りとして扱われない");
  eq(splitCsvFields('"a\tb"\tc', "\t"), ["a\tb", "c"], "タブ区切りでもクォートされたフィールド内のタブは区切りとして扱われない");

  // ---- escaped ""(doubled quote) ----
  eq(splitCsvFields('"say ""hi""",b', ","), ['say "hi"', "b"], 'エスケープされた""は1つの"として復元される');

  // ---- 末尾の空セル ----
  eq(splitCsvFields("a,b,", ","), ["a", "b", ""], "末尾の空セルが保持される(3フィールド目は空文字列)");
  eq(splitCsvFields(",,", ","), ["", "", ""], "全て空セルの行でも3フィールドとして分割される");

  // ---- splitCsvRecords: 基本の改行分割 ----
  eq(records("a\nb", [","]), ["a", "b"], "LFで2レコードに分割される");
  eq(records("a\r\nb", [","]), ["a", "b"], "CRLFで2レコードに分割される(CRは吸収される)");
  eq(records("a\rb", [","]), ["a", "b"], "CR単独でも2レコードに分割される");

  // ---- クォート内の改行(レコードが分断されない) ----
  eq(records('a,"line1\nline2"\nb', [","]), ['a,"line1\nline2"', "b"], "クォート内の改行はレコード境界として扱われず、1レコードとして保持される");

  // ---- bare quote(レコード分割側。区切り文字でも何でもない記号としての単一") ----
  eq(
    records('quote: 「"」という記号\napple: りんご', ["\t", ","]),
    ['quote: 「"」という記号', "apple: りんご"],
    "見出し語内のただの記号としての単一\"は、次のレコードを誤って呑み込まない",
  );

  // ---- escaped ""の直後に改行(レコード側) ----
  eq(
    records('hello,"say ""hi""\nnext line"', [","]),
    ['hello,"say ""hi""\nnext line"'],
    'エスケープされた""の直後に改行があっても、閉じクォートと誤認識せず1レコードのまま',
  );

  // ---- 複数の区切り文字候補(delimiter未確定時のレコード分割、wordListCleaner.tsの
  // 列モード相当) ----
  eq(
    records('word\tmeaning\tphonetic\nabandon\t捨てる\t/x/', ["\t", ","]),
    ["word\tmeaning\tphonetic", "abandon\t捨てる\t/x/"],
    "タブが区切り文字候補に含まれていれば、タブ区切り行でも正しく2レコードに分割される",
  );

  // ---- 例外を投げないこと(閉じクォートが無い壊れた入力) ----
  try {
    const r1 = splitCsvFields('"unterminated', ",");
    const r2 = splitCsvRecords('"unterminated all the way to EOF', [","]);
    if (Array.isArray(r1) && Array.isArray(r2.records)) ok("閉じクォートが無い壊れた入力でも例外を投げず配列を返す");
    else bad(`閉じクォート無し入力の戻り値が想定外: r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)}`);
  } catch (e) {
    bad(`閉じクォート無し入力で例外が発生: ${e.message}`);
  }

  // ---- 区切り文字とクォートの間に空白があるフィールド(Codexレビュー指摘対応、
  // PR #105、round-17再監査P2)。旧実装は`current === ""`だけを見ていたため、
  // 空白が積まれた時点でクォート開始を認識できず、内部のカンマを誤って区切り文字
  // として分割していた。splitCsvRecords側は元々`delimiter\s*"`を許容していたため、
  // 両者で挙動が食い違っていた。 ----
  eq(
    splitCsvFields('apple, "red, fruit"', ","),
    ["apple", "red, fruit"],
    "区切り文字の直後に空白があっても、その後のクォートされたフィールドは正しく認識され、内部のカンマで誤分割されない(空白自体は破棄される)",
  );
  eq(
    splitCsvFields('  "leading spaces"', ","),
    ["leading spaces"],
    "フィールド先頭の空白(複数)の後のクォートも同様に認識され、空白は破棄される",
  );

  // ---- 性能: delimiterでもクォートでもない単一の"を大量に含む巨大な1レコード/
  // 1フィールドでも、線形時間で処理できること(Codexレビュー指摘対応、PR #105、
  // round-17再監査P2)。旧実装はcurrent全体を都度正規表現でre-scanしており、
  // 160,000文字規模の入力でO(n^2)となり約13秒かかっていた。 ----
  {
    const pathological = "a\"".repeat(80000); // 約160,000文字、区切り文字を含まない単一レコード/フィールド
    const t0 = Date.now();
    const recResult = splitCsvRecords(pathological, [","]);
    const fieldResult = splitCsvFields(pathological, ",");
    const elapsedMs = Date.now() - t0;
    if (Array.isArray(recResult.records) && Array.isArray(fieldResult) && elapsedMs < 1000) {
      ok(`delimiterでもクォートでもない単一の"を80,000個含む約16万文字の入力を${elapsedMs}msで例外なく処理する(旧実装はO(n^2)で約13秒かかっていた)`);
    } else {
      bad(`巨大な入力の処理が想定より遅い、または失敗: elapsedMs=${elapsedMs}`);
    }
  }

  // ==== 未終端クォートの開示設計(Codexレビュー指摘対応、PR #105、round-17
  // 再監査フレッシュレビューP2、およびユーザーによる追加要求)。単に素朴な
  // 改行分割へ丸ごとフォールバックするのではなく、壊れた「その1行」だけを
  // 除外し、後続の正当な行(正しい複数行クォートフィールドを含む)は通常どおり
  // 復元する。 ====

  // ---- 末尾(最後)の未終端クォート: 最後の1行だけが破損行として除外される ----
  {
    const r = splitCsvRecords('apple,りんご\nbanana, "unterminated', [","]);
    eq(r.records, ["apple,りんご"], "末尾の未終端クォート: 正常な先行行は保持され、破損した最後の行は除外される");
    eq(r.recordStartLines, [1], "recordStartLinesは保持された行数と一致する(除外された行は含まれない)");
    if (r.warnings.length === 1 && r.warnings[0].type === "unterminated_quote" && r.warnings[0].physicalLine === 2) {
      ok("末尾の未終端クォート: warningsに1件、正しい物理行番号(2行目)で記録される");
    } else {
      bad(`末尾の未終端クォートのwarningsが想定外: ${JSON.stringify(r.warnings)}`);
    }
  }

  // ---- 途中(中間)の未終端クォート: 前後の正常行がどちらも回復される ----
  {
    const r = splitCsvRecords('apple,りんご\ninch, " symbol\nbanana,バナナ', [","]);
    eq(r.records, ["apple,りんご", "banana,バナナ"], "途中の未終端クォート: 前後の正常行が両方とも回復される(破損した中間行だけ除外)");
    eq(r.recordStartLines, [1, 3], "recordStartLinesが正しい物理行番号(1行目・3行目)を指す(2行目はスキップ)");
    if (r.warnings.length === 1 && r.warnings[0].physicalLine === 2 && r.warnings[0].skippedLineText === 'inch, " symbol') {
      ok("途中の未終端クォート: warningsに破損した物理行番号(2)と該当テキストが記録される");
    } else {
      bad(`途中の未終端クォートのwarningsが想定外: ${JSON.stringify(r.warnings)}`);
    }
  }

  // ---- 元のCodex指摘の再現ケース: 破損行の直後の正常行が回復される ----
  eq(
    splitCsvRecords('inch, " symbol\napple,りんご', [","]).records,
    ["apple,りんご"],
    "破損した1行目は除外され、2行目(apple,りんご)は正しく回復される",
  );

  // ---- 複数の未終端クォートが同じテキスト中に別々に現れる場合、それぞれ
  // 個別に検出・除外され、間の正常行は保持される ----
  {
    const r = splitCsvRecords('a, "bad1\ngood1,x\nb, "bad2\ngood2,y', [","]);
    eq(r.records, ["good1,x", "good2,y"], "複数の未終端クォートがそれぞれ独立して検出され、間の正常行はすべて回復される");
    if (r.warnings.length === 2 && r.warnings[0].physicalLine === 1 && r.warnings[1].physicalLine === 3) {
      ok("複数の未終端クォート: warningsに2件、それぞれ正しい物理行番号で記録される");
    } else {
      bad(`複数の未終端クォートのwarningsが想定外: ${JSON.stringify(r.warnings)}`);
    }
  }

  // ---- 破損したクォートより前にある正当な複数行クォートフィールドは、後方の
  // 破損の影響を一切受けず、通常どおり1レコードとして正しく保持される
  // (1パス処理の性質上、証明可能に安全なケース。テキスト全体を素朴な改行
  // 分割に丸ごとフォールバックする設計ではないことの直接確認) ----
  {
    const r = splitCsvRecords('good,"first\nmultiline"\nbad, " unterminated with no other quotes anywhere', [","]);
    eq(r.records, ['good,"first\nmultiline"'], "破損したクォートより前にある正当な複数行クォートフィールドは、後方の破損の影響を受けず正しく1レコードとして保持される");
    eq(r.recordStartLines, [1], "recordStartLinesも正しく1行目を指す");
    if (r.warnings.length === 1 && r.warnings[0].physicalLine === 3) {
      ok("後方の破損したクォートは、前方の正当な複数行フィールドに影響を与えず、正しく3行目(複数行フィールドが1〜2行目を占めた後)の破損として個別に検出される");
    } else {
      bad(`後方の破損検出が想定外: ${JSON.stringify(r.warnings)}`);
    }
  }

  // ---- 既知の限界(コード側のコメントで明示): 破損したクォートの直後に、
  // それ自体は正しく閉じられる複数行クォートフィールドがある場合、その正当な
  // 閉じクォートが、直前の破損したクォートの閉じクォートとして誤って
  // 食いつかれてしまうことがある(両者を区別する情報がテキスト自体に無い、
  // フォワード1パスパーサ全般に共通する限界)。この既知の挙動を固定するテスト
  // (「正しい」出力ではなく、実際に安全に予測できる出力を記録する)。 ----
  eq(
    splitCsvRecords('bad, " unterminated\nc,"valid\nmultiline"\nlast,row', [","]).records,
    ['bad, " unterminated\nc,"valid\nmultiline"', "last,row"],
    "既知の限界: 破損クォート直後の正当な複数行フィールドの閉じクォートが誤って食いつかれ、1つのレコードへ結合されることがある(回帰確認、この挙動を意図的に固定する)",
  );

  // ---- 正しく閉じられたクォートを含む正常な入力では、warningsが一切発生しない
  // (回帰確認) ----
  {
    const r = splitCsvRecords('a,"properly closed"\nb,c', [","]);
    eq(r.records, ['a,"properly closed"', "b,c"], "正しく閉じられたクォートを含む正常な入力は従来どおりクォート認識で分割される(回帰確認)");
    eq(r.warnings, [], "正常な入力ではwarningsが空になる(回帰確認)");
  }

  // ==== CR単独(古いMac形式)の改行コードでも、未終端クォートの復旧が正しく
  // 行われる(Codexレビュー指摘対応、PR #105、round-18再監査フレッシュレビュー
  // 4巡目: 旧実装は\nだけを行境界の探索対象にしており、CR単独の改行では行境界を
  // 1つも見つけられず、入力全体が1つの破損行として警告に丸ごと取り込まれ、
  // 後続の正当な行(apple)も巻き添えで失われていた) ====
  {
    const r = splitCsvRecords('good,ok\rinch," bad\rapple,りんご', [","]);
    eq(r.records, ["good,ok", "apple,りんご"], "CR単独の改行コードでも、未終端クォートの破損行だけが除外され、前後の正常な行(good,ok / apple,りんご)は両方とも回復される");
    if (r.warnings.length === 1 && r.warnings[0].skippedLineText === 'inch," bad') {
      ok("CR単独の改行コードでも、破損した物理行のテキストが正しく特定される");
    } else {
      bad(`CR単独改行での破損行特定が想定外: ${JSON.stringify(r.warnings)}`);
    }
  }

  // ==== 性能: 多数の独立した未終端クォート行(それぞれ閉じクォートを一切
  // 持たない)を含む入力でも、無制限に遅くならず一定時間内に処理を終える
  // (Codexレビュー指摘対応、PR #105、round-18再監査フレッシュレビュー4巡目:
  // 旧実装は壊れた行を1行スキップして再開するたびに残りテキスト全体を毎回
  // EOFまで再スキャンしており、5,000行の未終端クォートで約2.4秒かかって
  // いた)。個別復旧の試行回数上限(MAX_MALFORMED_ROW_RECOVERY_ATTEMPTS=1000)
  // を超えた時点で、以降は1行ずつの精密な復旧を諦め、残り全体を1件の集約
  // 警告にまとめることで最悪ケースの総コストを抑える(正当なフィールドの
  // 長さには一切上限を課さない、round-18再監査フレッシュレビュー5巡目の
  // 指摘に対応した設計。次のテストで直接確認する) ====
  {
    const N = 5000;
    const lines = [];
    for (let i = 0; i < N; i++) lines.push(`bad${i}, " unterminated${i}`);
    const pathological = lines.join("\n");
    const t0 = Date.now();
    const r = splitCsvRecords(pathological, [","]);
    const elapsedMs = Date.now() - t0;
    const hasAggregateWarning = r.warnings.some((w) => w.note);
    if (r.records.length === 0 && r.warnings.length === 1001 && hasAggregateWarning && elapsedMs < 5000) {
      ok(`${N}行の独立した未終端クォート行(閉じクォート無し)を${elapsedMs}msで処理し、1000件を超えた時点で残り全体を1件の集約警告にまとめる(旧実装は準二次的で約2.4秒かかっていた)`);
    } else {
      bad(`多数の独立した未終端クォート行の処理が想定外: records.length=${r.records.length}, warnings.length=${r.warnings.length}, elapsedMs=${elapsedMs}`);
    }
  }

  // ---- 正当な複数行クォートフィールドの長さには一切上限を課さない
  // (Codexレビュー指摘対応、PR #105、round-18再監査フレッシュレビュー5巡目:
  // 前回試みた行数上限[MAX_LINES_SEARCHING_FOR_QUOTE_CLOSE]による性能対策は、
  // 100行を超える正当なクォートフィールドを誤って未終端と判定してしまう
  // 回帰を引き起こしていた。50行・150行のどちらも正しく1レコードとして
  // 保持されることを確認する) ----
  for (const lineCount of [50, 150]) {
    const meaningLines = Array.from({ length: lineCount }, (_, i) => `line${i}`).join("\n");
    const text = `word,"${meaningLines}"\nnext,ok`;
    const r = splitCsvRecords(text, [","]);
    if (r.records.length === 2 && r.records[0] === `word,"${meaningLines}"` && r.records[1] === "next,ok" && r.warnings.length === 0) {
      ok(`${lineCount}行にまたがる正当な複数行クォートフィールドは、行数に関わらず正しく1レコードとして保持される(性能対策による行数上限の回帰が無いことの確認)`);
    } else {
      bad(`${lineCount}行の複数行フィールドの処理が想定外: records=${JSON.stringify(r.records.map((x) => x.length))}, warnings=${JSON.stringify(r.warnings)}`);
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:csv-scanner RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
