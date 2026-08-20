/**
 * src/lib/utils/csvExport.ts の toCsv() 単体テスト。
 *
 * Codexレビュー指摘対応(PR #105、P1): /tools/word-list-cleanerが数式注入対策として
 * 付与する先頭の'は、CsvImportPanel.tsxのstripLeadingApostrophe()で再インポート時に
 * 意図的に取り除かれる。そのため、学習データエクスポート(/api/export/stats)がその
 * 値をCSVへ再出力する際にも同じ無害化(先頭 = + - @ に'を追加)を行わないと、
 * インポート→エクスポートの往復で数式注入が復活してしまう。この単体テストは、
 * next/server・supabase等のNext.js依存を一切持たない純粋関数としてtoCsv()を
 * 直接importし、実際のHTTPリクエスト・DB接続無しに検証する。
 *
 * 使い方: node scripts/testing/test-csv-export.mjs
 */
import { toCsv } from "../../src/lib/utils/csvExport.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  // ---- 先頭が = + - @ の値は ' を付与して無害化される(クォート不要な単純な値で確認) ----
  for (const lead of ["=", "+", "-", "@"]) {
    const value = `${lead}cmd|'/C calc'!A1`;
    const csv = toCsv(["word", "meaning"], [[value, "普通の意味"]]);
    const firstDataLine = csv.split("\n")[1];
    if (firstDataLine.startsWith(`'${lead}`)) {
      ok(`先頭が"${lead}"の値はCSVエクスポート時に'を付与して無害化される`);
    } else {
      bad(`先頭が"${lead}"の値が無害化されていない: ${firstDataLine}`);
    }
  }

  // ---- 無害化用の'付与と、別セルのカンマ・引用符によるCSVクォートが両方正しく適用される
  // (無害化された値自体はカンマ・引用符・改行を含まないため、'付与のみで元々クォート不要) ----
  {
    const csv = toCsv(["word", "meaning"], [["=SUM(A1:A2)", 'カンマ,を含む"引用符"付き'] ]);
    const firstDataLine = csv.split("\n")[1];
    if (firstDataLine === `'=SUM(A1:A2),"カンマ,を含む""引用符""付き"`) {
      ok("無害化(')の付与とCSVクォート(カンマ・引用符)が両方正しく適用される");
    } else {
      bad(`無害化+クォートの組み合わせが想定外: ${firstDataLine}`);
    }
  }

  // ---- 通常の値(=+-@で始まらない)は変更されない(既存挙動の維持、回帰防止) ----
  {
    const csv = toCsv(["word", "meaning"], [["apple", "りんご"]]);
    const firstDataLine = csv.split("\n")[1];
    if (firstDataLine === "apple,りんご") {
      ok("通常の値(数式注入対象でない)はそのままエクスポートされる(回帰なし)");
    } else {
      bad(`通常値の出力が想定外: ${firstDataLine}`);
    }
  }

  // ---- null/undefinedは空文字列として扱われ、クラッシュしない(既存挙動の維持) ----
  {
    const csv = toCsv(["a", "b"], [[null, undefined]]);
    const firstDataLine = csv.split("\n")[1];
    if (firstDataLine === ",") {
      ok("null/undefinedは空文字列として扱われる(回帰なし)");
    } else {
      bad(`null/undefinedの出力が想定外: ${firstDataLine}`);
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:csv-export RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
