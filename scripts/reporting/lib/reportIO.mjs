/**
 * レポート出力先の共通ヘルパー。
 *
 * 注意: リポジトリ直下の reports/ は scripts/audit/ 等の既存監査スクリプトが出力する
 * 成果物置き場で、reports/*.json 等は意図的にgitへコミットされている(reports/自体は
 * gitignore対象ではない)。vocab_test_maker_launch等のSNS計測レポートは運用状況の
 * 生データでありコミット対象ではないため、専用のサブディレクトリ
 * reports/vocab-test-maker-launch/ に書き出す。このサブディレクトリだけを
 * .gitignore で明示的にignoreしている(reports/全体をignoreすると、既存の
 * 監査スクリプトが出力するコミット対象ファイルまで巻き込んでしまうため)。
 *
 * セキュリティ上の注意: ここに書き込むdataオブジェクトに環境変数値・APIキー等の
 * 秘密情報を絶対に含めないこと(呼び出し元は集計結果の数値のみを渡す)。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../../testing/lib/env.mjs";

export const REPORTS_DIR = resolve(REPO_ROOT, "reports", "vocab-test-maker-launch");

export function ensureReportsDir() {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  return REPORTS_DIR;
}

/**
 * baseName(拡張子なし)に対して `${baseName}.json`(構造化データ)と
 * `${baseName}.summary.txt`(人が読む要約)の2ファイルをreports/へ書き出す。
 */
export function writeReport(baseName, data, summaryText) {
  ensureReportsDir();
  const jsonPath = resolve(REPORTS_DIR, `${baseName}.json`);
  const summaryPath = resolve(REPORTS_DIR, `${baseName}.summary.txt`);
  writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  writeFileSync(summaryPath, summaryText, "utf8");
  return { jsonPath, summaryPath };
}
