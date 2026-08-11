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
import { renderTestHtml, escape } from "../../src/lib/vocabTest/renderTestHtml.ts";

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

  console.log(`\n=== test:vocab-test-maker-parser RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
