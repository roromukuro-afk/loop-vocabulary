/**
 * /tools/vocab-test-maker(public no-loginツール)のparser・XSS対策のregression test。
 *
 * public inputを扱うため、以下をfail-closedで検証する:
 * - parsePastedWords(): comma/tab区切り・空行無視・欠落行skip・重複除去・100語上限・
 *   各フィールド200文字上限
 * - sanitizeRows(): サーバー側再検証(クライアントのパース結果を信用しない)が
 *   同じ制約を独立して適用すること
 * - renderTestHtml()のescape(): <script>・<img onerror>等のペイロードが
 *   実行可能HTMLとしてではなく、文字列としてのみ出力に含まれること
 *
 * 使い方: node scripts/testing/test-vocab-test-maker-parser.mjs
 */
import { parsePastedWords, sanitizeRows, MAX_WORDS, MAX_FIELD_LENGTH } from "../../src/lib/vocabTest/parsePastedWords.ts";
import { renderTestHtml, escape, MIN_CHOICE_ROWS, countUniqueAnswers } from "../../src/lib/vocabTest/renderTestHtml.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  // ---- comma区切り ----
  {
    const { rows } = parsePastedWords("apple,りんご\nbeautiful,美しい");
    if (rows.length === 2 && rows[0].word === "apple" && rows[0].meaning === "りんご") ok("comma区切りを正しく解析する");
    else bad(`comma区切りの解析結果が想定外: ${JSON.stringify(rows)}`);
  }

  // ---- tab区切り(意味側にカンマが含まれても壊れない) ----
  {
    const { rows } = parsePastedWords("run\tto move fast, quickly");
    if (rows.length === 1 && rows[0].word === "run" && rows[0].meaning === "to move fast, quickly") {
      ok("tab区切りを優先し、意味側のカンマで誤分割しない");
    } else bad(`tab区切りの解析結果が想定外: ${JSON.stringify(rows)}`);
  }

  // ---- 空行は無視 ----
  {
    const { rows, totalNonBlankLines } = parsePastedWords("apple,りんご\n\n\nbeautiful,美しい\n   \n");
    if (rows.length === 2 && totalNonBlankLines === 2) ok("空行(空白のみの行含む)は無視される");
    else bad(`空行処理の結果が想定外: rows=${rows.length}, totalNonBlankLines=${totalNonBlankLines}`);
  }

  // ---- word/meaning欠落行はskip ----
  {
    const { rows, warnings } = parsePastedWords("apple,りんご\nnodelimiterhere\napple2,\n,りんご3");
    if (rows.length === 1 && warnings.filter(w => w.type === "missing_field").length === 3) {
      ok("欠落・区切り文字なしの行はすべてskipされ、warningとして記録される");
    } else bad(`欠落行処理が想定外: rows=${JSON.stringify(rows)}, warnings=${JSON.stringify(warnings)}`);
  }

  // ---- 完全重複は除去 ----
  {
    const { rows, warnings } = parsePastedWords("apple,りんご\napple,りんご\napple,別の意味");
    if (rows.length === 2 && warnings.some(w => w.type === "duplicate")) {
      ok("word+meaningが完全一致する重複行のみ除去され、意味が異なる行は残る");
    } else bad(`重複除去が想定外: ${JSON.stringify(rows)}`);
  }

  // ---- 100語上限 ----
  {
    const lines = Array.from({ length: MAX_WORDS + 10 }, (_, i) => `word${i},意味${i}`).join("\n");
    const { rows, warnings } = parsePastedWords(lines);
    if (rows.length === MAX_WORDS && warnings.filter(w => w.type === "over_limit").length === 10) {
      ok(`${MAX_WORDS}語上限を超えた分はskipされる(超過10行を確認)`);
    } else bad(`上限処理が想定外: rows=${rows.length}, over_limit警告=${warnings.filter(w => w.type === "over_limit").length}`);
  }

  // ---- 各フィールド200文字上限 ----
  {
    const longWord = "a".repeat(MAX_FIELD_LENGTH + 1);
    const { rows, warnings } = parsePastedWords(`${longWord},りんご\napple,りんご`);
    if (rows.length === 1 && warnings.some(w => w.type === "overlength")) {
      ok(`${MAX_FIELD_LENGTH}文字を超える行はskipされる`);
    } else bad(`文字数上限処理が想定外: ${JSON.stringify(rows)}`);
  }

  // ---- 全行invalidなら生成不可(rows.length===0で呼び出し側が判定できる) ----
  {
    const { rows, totalNonBlankLines } = parsePastedWords("invalidline1\ninvalidline2");
    if (rows.length === 0 && totalNonBlankLines === 2) ok("全行invalidな場合、rowsは空配列になる(生成不可を呼び出し側が判定可能)");
    else bad("全行invalid時の空配列判定が想定外");
  }

  // ---- sanitizeRows(): サーバー側再検証も同じ制約を独立して適用する ----
  {
    const longWord = "b".repeat(MAX_FIELD_LENGTH + 1);
    const input = [
      { word: "apple", meaning: "りんご" },
      { word: "apple", meaning: "りんご" }, // 重複
      { word: "", meaning: "空word" },      // 欠落
      { word: longWord, meaning: "長すぎ" }, // 超過
      { word: 123, meaning: "型不正" },       // 不正な型(文字列でない)
      null,                                    // 不正な要素
    ];
    const rows = sanitizeRows(input);
    if (rows.length === 1 && rows[0].word === "apple") {
      ok("sanitizeRows()は不正な型・欠落・重複・超過をすべて独立して除去する");
    } else bad(`sanitizeRows()の結果が想定外: ${JSON.stringify(rows)}`);
  }
  {
    const many = Array.from({ length: MAX_WORDS + 20 }, (_, i) => ({ word: `w${i}`, meaning: `m${i}` }));
    const rows = sanitizeRows(many);
    if (rows.length === MAX_WORDS) ok("sanitizeRows()も100語上限を独立して適用する");
    else bad(`sanitizeRows()の上限処理が想定外: ${rows.length}`);
  }
  {
    const rows = sanitizeRows("not an array");
    if (rows.length === 0) ok("sanitizeRows()は配列以外の入力に対して安全に空配列を返す");
    else bad("sanitizeRows()が配列以外の入力を誤って処理した");
  }

  // ---- 重複除去キー衝突regression(Codexレビュー指摘P2対応) ----
  // word/meaningの境界を跨いで衝突しうるペア: ("a b","c") と ("a","b c")。
  // 空白結合キーだと両方とも同一とみなされ、後者が誤ってduplicate除去される。
  {
    const rows = sanitizeRows([{ word: "a b", meaning: "c" }, { word: "a", meaning: "b c" }]);
    const hasAB = rows.some((r) => r.word === "a b" && r.meaning === "c");
    const hasA = rows.some((r) => r.word === "a" && r.meaning === "b c");
    if (rows.length === 2 && hasAB && hasA) {
      ok('sanitizeRows(): word/meaning境界を跨いで衝突しうるペア("a b"/"c" と "a"/"b c")は両方とも保持される');
    } else {
      bad(`sanitizeRows(): 境界衝突ペアが誤って除去された: ${JSON.stringify(rows)}`);
    }
  }
  {
    const { rows } = parsePastedWords("a b,c\na,b c");
    const hasAB = rows.some((r) => r.word === "a b" && r.meaning === "c");
    const hasA = rows.some((r) => r.word === "a" && r.meaning === "b c");
    if (rows.length === 2 && hasAB && hasA) {
      ok('parsePastedWords(): word/meaning境界を跨いで衝突しうるペアは両方とも保持される');
    } else {
      bad(`parsePastedWords(): 境界衝突ペアが誤って除去された: ${JSON.stringify(rows)}`);
    }
  }
  // 完全一致の重複は引き続き1件に除去される(sanitizeRows側)
  {
    const rows = sanitizeRows([{ word: "apple", meaning: "りんご" }, { word: "apple", meaning: "りんご" }]);
    if (rows.length === 1) ok("sanitizeRows(): word+meaningが完全一致する重複は引き続き1件に除去される");
    else bad(`sanitizeRows(): 完全重複の除去が想定外: ${JSON.stringify(rows)}`);
  }
  // trim後に一致する重複も除去される(前後空白の差異は無視される)
  {
    const rows = sanitizeRows([{ word: "apple", meaning: "りんご" }, { word: "  apple  ", meaning: "  りんご  " }]);
    if (rows.length === 1) ok("sanitizeRows(): 前後空白のみが異なる重複(trim後に一致)も1件に除去される");
    else bad(`sanitizeRows(): trim後重複の除去が想定外: ${JSON.stringify(rows)}`);
  }
  // parser側とsanitizeRows側で同一入力に対する重複判定結果が一致する(client/server不整合防止)
  {
    const pairs = [
      ["a b", "c"], ["a", "b c"], ["apple", "りんご"], ["apple", "りんご"], ["  x  ", "  y  "], ["x", "y"],
    ];
    const pasted = pairs.map(([w, m]) => `${w},${m}`).join("\n");
    const parserResult = parsePastedWords(pasted).rows.map((r) => `${r.word}${r.meaning}`).sort();
    const sanitizeResult = sanitizeRows(pairs.map(([w, m]) => ({ word: w, meaning: m })))
      .map((r) => `${r.word}${r.meaning}`).sort();
    if (JSON.stringify(parserResult) === JSON.stringify(sanitizeResult)) {
      ok("parsePastedWords()とsanitizeRows()は同一入力に対して同じ重複除去結果を返す(client/server整合)");
    } else {
      bad(`parser/sanitizeRowsの重複除去結果が不一致: parser=${JSON.stringify(parserResult)}, sanitize=${JSON.stringify(sanitizeResult)}`);
    }
  }

  // ---- escape(): XSSペイロードが実行可能HTMLにならない ----
  const xssPayloads = [
    "<script>alert(1)</script>",
    '<img src=x onerror=alert(1)>',
    "&",
    '"',
    "<",
    ">",
    "<svg onload=alert(1)>",
  ];
  for (const payload of xssPayloads) {
    const escaped = escape(payload);
    if (!escaped.includes("<script>") && !escaped.includes("<img") && !escaped.includes("<svg") && !escaped.includes('"')) {
      ok(`escape()がペイロードを無害化する: ${JSON.stringify(payload)} → ${JSON.stringify(escaped)}`);
    } else {
      bad(`escape()がペイロードを無害化できていない: ${JSON.stringify(payload)} → ${JSON.stringify(escaped)}`);
    }
  }

  // ---- renderTestHtml()経由でも同様にXSSペイロードが無害化される ----
  {
    const html = renderTestHtml({
      rows: [
        { word: "<script>alert(1)</script>", meaning: '<img src=x onerror=alert(1)>' },
        { word: "normal", meaning: "普通の単語" },
      ],
      direction: "en2ja",
      format: "write",
      columns: 1,
      answerMode: "separate",
      title: "テスト",
      attribution: null,
      qrDataUrl: null,
    });
    const hasRawScript = /<script>alert\(1\)<\/script>/.test(html.replace(/&lt;script&gt;.*?&lt;\/script&gt;/g, ""));
    const hasRawImgOnerror = /<img src=x onerror=alert\(1\)>/.test(html);
    if (!hasRawScript && !hasRawImgOnerror && html.includes("&lt;script&gt;")) {
      ok("renderTestHtml()の出力にXSSペイロードが実行可能HTMLとして含まれない(エスケープ済み文字列としてのみ出現)");
    } else {
      bad(`renderTestHtml()の出力にエスケープされていないHTMLが含まれている可能性: hasRawScript=${hasRawScript}, hasRawImgOnerror=${hasRawImgOnerror}`);
    }

    // 4択のダミー選択肢生成でも同じdatasetを使うため、format:"choice"でも確認
    const htmlChoice = renderTestHtml({
      rows: [
        { word: "<script>alert(2)</script>", meaning: "意味1" },
        { word: "w2", meaning: "意味2" },
        { word: "w3", meaning: "意味3" },
        { word: "w4", meaning: "意味4" },
      ],
      direction: "en2ja",
      format: "choice",
      columns: 1,
      answerMode: "none",
      title: "テスト",
      attribution: null,
      qrDataUrl: null,
    });
    if (!/<script>alert\(2\)<\/script>/.test(htmlChoice)) {
      ok("4択形式(choice)の出力でもXSSペイロードがエスケープされる");
    } else {
      bad("4択形式(choice)の出力でXSSペイロードがエスケープされていない");
    }
  }

  // ---- 4択(choice)は最低MIN_CHOICE_ROWS語(重複除く)必要(fail-closed) ----
  const makeRows = (n) => Array.from({ length: n }, (_, i) => ({ word: `w${i}`, meaning: `m${i}` }));
  const baseArgs = { direction: "en2ja", columns: 1, answerMode: "none", title: "テスト", attribution: null, qrDataUrl: null };

  for (const n of [1, 2, 3]) {
    let threw = false;
    try {
      renderTestHtml({ rows: makeRows(n), format: "choice", ...baseArgs });
    } catch {
      threw = true;
    }
    if (threw) ok(`4択形式: ${n}語(<${MIN_CHOICE_ROWS})では生成が拒否される(fail-closed)`);
    else bad(`4択形式: ${n}語でも生成できてしまっている(壊れた選択肢が生成されるリスク)`);
  }

  // 記述式(write)は1語以上で引き続き利用可能
  {
    let threw = false;
    try {
      renderTestHtml({ rows: makeRows(1), format: "write", ...baseArgs });
    } catch {
      threw = true;
    }
    if (!threw) ok("記述式(write)は1語でも引き続き生成できる(4択のみの制限であることの確認)");
    else bad("記述式(write)が1語で拒否されてしまっている(制限範囲が広すぎる)");
  }

  // ちょうどMIN_CHOICE_ROWS語: 生成でき、各問exactly 4選択肢
  {
    const html4 = renderTestHtml({ rows: makeRows(MIN_CHOICE_ROWS), format: "choice", ...baseArgs });
    const choiceBlocks = [...html4.matchAll(/<div class="choices">(.*?)<\/div>/g)];
    const allExactly4 = choiceBlocks.length === MIN_CHOICE_ROWS &&
      choiceBlocks.every((m) => (m[1].match(/<span>/g) || []).length === 4);
    if (allExactly4) ok(`4択形式: ちょうど${MIN_CHOICE_ROWS}語で生成でき、${MIN_CHOICE_ROWS}問とも選択肢exactly4件`);
    else bad(`4択形式: ${MIN_CHOICE_ROWS}語での選択肢数が想定外: ${choiceBlocks.map((m) => (m[1].match(/<span>/g) || []).length)}`);
  }

  // 5語以上: 各問exactly 4選択肢
  {
    const html7 = renderTestHtml({ rows: makeRows(7), format: "choice", ...baseArgs });
    const choiceBlocks = [...html7.matchAll(/<div class="choices">(.*?)<\/div>/g)];
    const allExactly4 = choiceBlocks.length === 7 && choiceBlocks.every((m) => (m[1].match(/<span>/g) || []).length === 4);
    if (allExactly4) ok("4択形式: 7語(5語以上)でも各問とも選択肢exactly4件");
    else bad(`4択形式: 7語での選択肢数が想定外: ${choiceBlocks.map((m) => (m[1].match(/<span>/g) || []).length)}`);
  }

  // 重複除去後にMIN_CHOICE_ROWS未満になるケースも拒否される
  {
    const dupRows = [
      { word: "a", meaning: "1" }, { word: "a", meaning: "1" }, // 重複
      { word: "b", meaning: "2" }, { word: "c", meaning: "3" },
    ]; // unique = 3語 < MIN_CHOICE_ROWS
    let threw = false;
    try {
      renderTestHtml({ rows: dupRows, format: "choice", ...baseArgs });
    } catch {
      threw = true;
    }
    if (threw) ok("4択形式: 重複除去後に3語になるケースも拒否される(呼び出し側の重複除去に頼らない)");
    else bad("4択形式: 重複除去後3語のケースが生成できてしまっている");
  }

  // ---- 4択の選択肢はrow数ではなく「答え側のdistinctな値」で判定・抽出する(Codexレビュー指摘対応) ----
  // 異なる4つの英単語がすべて同じ意味を持つ場合、word+meaningのペアとしては4件distinctでも、
  // 答え側(meaning)の値としては1種類しかなく、正しい4択問題を作れない。
  {
    const sameAnswerRows = [
      { word: "apple", meaning: "果物" },
      { word: "orange", meaning: "果物" },
      { word: "banana", meaning: "果物" },
      { word: "grape", meaning: "果物" },
    ];
    if (countUniqueAnswers(sameAnswerRows, "en2ja") === 1) {
      ok("countUniqueAnswers(): 答えの値が全行同じ場合、distinct数は1と正しく判定される");
    } else {
      bad(`countUniqueAnswers(): 判定が想定外: ${countUniqueAnswers(sameAnswerRows, "en2ja")}`);
    }
    let threw = false;
    try {
      renderTestHtml({ rows: sameAnswerRows, format: "choice", ...baseArgs });
    } catch {
      threw = true;
    }
    if (threw) ok("4択形式: row数は4件でも答えの値が1種類しかない場合は生成が拒否される(fail-closed)");
    else bad("4択形式: 答えの値が1種類しかないのに生成できてしまっている(壊れた/重複した選択肢のリスク)");
  }
  // 答えの値が4種類ちょうどある場合(一部の行は答えを共有)は生成でき、各問の選択肢がdistinctになる
  {
    const mixedRows = [
      { word: "apple", meaning: "果物" },
      { word: "orange", meaning: "果物" }, // appleと答えを共有
      { word: "dog", meaning: "犬" },
      { word: "cat", meaning: "猫" },
      { word: "car", meaning: "車" },
    ]; // 答え側のdistinct値: 果物・犬・猫・車 の4種類
    if (countUniqueAnswers(mixedRows, "en2ja") === 4) {
      ok("countUniqueAnswers(): 一部行が答えを共有していてもdistinct数を正しく数える(4種類)");
    } else {
      bad(`countUniqueAnswers(): 判定が想定外: ${countUniqueAnswers(mixedRows, "en2ja")}`);
    }
    const html = renderTestHtml({ rows: mixedRows, format: "choice", ...baseArgs });
    const choiceBlocks = [...html.matchAll(/<div class="choices">(.*?)<\/div>/g)];
    const allDistinctAndExactly4 = choiceBlocks.length === mixedRows.length && choiceBlocks.every((m) => {
      const labels = [...m[1].matchAll(/<span>[^.]+\.\s([^<]*)<\/span>/g)].map((mm) => mm[1]);
      return labels.length === 4 && new Set(labels).size === 4;
    });
    if (allDistinctAndExactly4) {
      ok("4択形式: 答えを共有する行があっても、各問の選択肢は4件ともdistinctな値になる(重複表示なし)");
    } else {
      bad("4択形式: 一部の問いで選択肢が重複している、または4件になっていない");
    }
  }

  console.log(`\n=== test:vocab-test-maker-parser RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
