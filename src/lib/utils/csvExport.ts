/**
 * サーバーサイドのCSVエクスポート(src/app/api/export/stats/route.ts)が使う
 * 純粋関数。テスト(scripts/testing/test-csv-export.mjs)から直接importして
 * 検証できるよう、next/server・supabaseクライアント等の依存を持たない
 * プレーンな.tsファイルに分離している。
 */

// CSV Injection(Formula Injection)対策: セル先頭が = + - @ だと、Excel等の
// 表計算ソフトで開いた際に数式として実行されてしまう(OWASPが挙げる代表的な4文字)。
// wordbooks.word/meaningはCsvImportPanel経由でユーザーが自由入力した値であり、
// /tools/word-list-cleanerが付与する無害化用の'は再インポート時に意図的に取り除かれる
// (csvImportParsing.ts の stripLeadingApostrophe())ため、そのままこの学習データ
// エクスポートへ流れると数式注入が復活する(Codexレビュー指摘対応、PR #105)。
// カンマ・引用符のCSVエスケープだけでは防げない(quoteされていても数式解釈は行われる
// ため)、対象セルの先頭に'を追加して無害化する。
const FORMULA_INJECTION_LEAD_CHARS = ["=", "+", "-", "@"];

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (FORMULA_INJECTION_LEAD_CHARS.some((c) => s.startsWith(c))) s = `'${s}`;
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
