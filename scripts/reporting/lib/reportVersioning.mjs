/**
 * vocab_growth_organic向けレポート(vocab-growth-organic-24h-check.mjs /
 * vocab-growth-organic-campaign-report.mjs)が共有する、バージョン管理付きの
 * レポート書き出しヘルパー。以前は両ファイルにそれぞれ独立した
 * REPORTS_DIR/writeReport()が複製されていた(word-list-cleanerのCSVパーサ
 * 重複と同じ種類の問題)ため、この1か所に集約する。
 *
 * 背景(ユーザーからの直接要求): collector(social-acquisition-snapshot.mjs)に
 * バグ修正が入った後(例: FUNNEL_EVENTS/LANDING_EVENT_NAMESへのvocab_check系・
 * dictionary系イベント追加、7日ウィンドウのISO化)、修正前のコードで生成された古い
 * reportと、修正後のコードで生成された新しいreportが、同じ対象期間(同じ
 * content/同じ日付)について両方存在しうる。従来はどちらも同じファイル名
 * ({baseName}.json)で書き出していたため、後から生成した方が前のものを
 * 黙って上書きし、consumer(人間・将来のダッシュボード)がどちらを見ているか
 * 区別できなかった(実際に2026-08-24、organic_01の00:47生成のバグ入りレポートが
 * 10:04の修正後の再生成で上書きされ、監査目的での比較ができなくなった)。
 *
 * 対策:
 *   1. レポートJSON本体にcollectorVersion(生成時点のこのリポジトリのHEAD SHA)
 *      を埋め込む。
 *   2. ファイル名にも短縮SHAを埋め込み({baseName}.{shortSha}.json)、
 *      collectorのコードが変わった後の再生成が別ファイルになるようにする
 *      (同じコミットでの再実行は同じファイル名になり、意図的に上書きされる
 *      — 「同じバージョンでの最新データへの更新」であり、監査上の問題はない)。
 *   3. 書き出しのたびにMANIFEST.jsonを更新し、同じ対象期間の複数バージョンの
 *      中から「現在のHEADと同じcollectorVersionを持つ、生成時刻が最も新しい
 *      もの」をcurrentとして明示する(freshness validator)。古いレポートは
 *      削除・上書きせず、監査用にすべて残す。
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "../../testing/lib/env.mjs";

export { REPO_ROOT };
export const REPORTS_DIR = resolve(REPO_ROOT, "reports", "vocab-growth-organic");

export function ensureReportsDir(dir = REPORTS_DIR) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * このリポジトリの現在のHEAD SHA(このレポートを生成したコードの実際の
 * バージョン)を取得する。gitが使えない等の異常系ではレポート生成自体を
 * 失敗させず、"unknown"にフォールバックする。
 */
export function getCollectorVersion(repoRoot = REPO_ROOT) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function shortVersion(sha) {
  return sha === "unknown" ? "unknown" : sha.slice(0, 7);
}

const VERSION_SUFFIX_RE = /\.([0-9a-f]{7}|unknown)$/;

function stripVersionSuffix(baseNameNoExt) {
  return baseNameNoExt.replace(VERSION_SUFFIX_RE, "");
}

/**
 * baseName(拡張子なし、バージョン部分は含まない論理的な識別子)に対して
 * `${baseName}.${shortSha}.json`(構造化データ、collectorVersion付き)と
 * `${baseName}.${shortSha}.summary.txt`(人が読む要約)の2ファイルを
 * dirへ書き出し、書き出し後にMANIFEST.jsonを更新する。
 */
export function writeVersionedReport(dir, baseName, data, summaryText, repoRoot = REPO_ROOT) {
  ensureReportsDir(dir);
  const collectorVersion = getCollectorVersion(repoRoot);
  const versionedData = { ...data, collectorVersion };
  const suffixedBaseName = `${baseName}.${shortVersion(collectorVersion)}`;
  const jsonPath = resolve(dir, `${suffixedBaseName}.json`);
  const summaryPath = resolve(dir, `${suffixedBaseName}.summary.txt`);
  writeFileSync(jsonPath, JSON.stringify(versionedData, null, 2), "utf8");
  writeFileSync(summaryPath, summaryText, "utf8");
  updateManifest(dir, repoRoot);
  return { jsonPath, summaryPath, collectorVersion };
}

/**
 * dir内の全*.jsonレポート(MANIFEST.json自身を除く)を、ファイル名から
 * バージョン部分を取り除いた論理的な識別子(logicalId)ごとにグルーピングし、
 * 各グループの中で「現在のHEADと同じcollectorVersionを持つ、generatedAtが
 * 最も新しいもの」をcurrentとしてMANIFEST.jsonへ記録する(freshness
 * validatorの本体)。レポート自体は一切削除・上書きしない。
 *
 * collectorVersionの一致判定はHEAD SHAの完全一致(またはファイル名の短縮SHAとの
 * 一致)のみで、祖先関係の解決は行わない — このリポジトリの現在のチェック
 * アウト状態そのものを基準にした、単純で予測可能な「今のコードと同じか」判定
 * であり、レポートを書き出すたびに再評価されるため、無関係なコミットが
 * 増えるたびに全レポートが即座にstale扱いされても、次の書き出しで
 * 自己修復する。
 */
export function updateManifest(dir, repoRoot = REPO_ROOT) {
  const currentVersion = getCollectorVersion(repoRoot);
  const currentShort = shortVersion(currentVersion);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "MANIFEST.json") : [];

  const groups = new Map();
  for (const file of files) {
    const baseNoExt = file.replace(/\.json$/, "");
    const versionMatch = baseNoExt.match(VERSION_SUFFIX_RE);
    const fileVersion = versionMatch ? versionMatch[1] : "unknown";
    const logicalId = stripVersionSuffix(baseNoExt);

    let generatedAt = null;
    let collectorVersion = fileVersion;
    try {
      const data = JSON.parse(readFileSync(resolve(dir, file), "utf8"));
      generatedAt = typeof data.generatedAt === "string" ? data.generatedAt : null;
      if (typeof data.collectorVersion === "string") collectorVersion = data.collectorVersion;
    } catch {
      // 壊れたJSONも監査目的でグループには残すが、生成時刻不明のまま扱う
      // (manifestから黙って除外しない)。
    }
    if (!groups.has(logicalId)) groups.set(logicalId, []);
    groups.get(logicalId).push({ file, collectorVersion, generatedAt });
  }

  const reports = {};
  for (const [logicalId, entries] of groups) {
    const matching = entries.filter(
      (e) => e.collectorVersion === currentVersion || e.collectorVersion === currentShort,
    );
    // 現在のHEADと一致するバージョンが1件も無ければ(例: このディレクトリの
    // レポートが全て過去のコードで生成されたまま)、暫定的に生成時刻が最も
    // 新しいものをcurrentとしつつ、currentMatchesHeadCollectorVersion=falseで
    // 「まだ現在のコードで検証されていない」ことを明示する。
    const pool = matching.length > 0 ? matching : entries;
    const sorted = [...pool].sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""));
    const current = sorted[0];
    reports[logicalId] = {
      current: current.file,
      currentMatchesHeadCollectorVersion: matching.length > 0,
      supersedes: entries.filter((e) => e.file !== current.file).map((e) => e.file),
      allVersions: entries,
    };
  }

  const manifest = { generatedAt: new Date().toISOString(), currentCollectorVersion: currentVersion, reports };
  if (existsSync(dir)) writeFileSync(resolve(dir, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

/**
 * freshness validator: dir内のMANIFEST.jsonを読み、logicalIdに対応する
 * 「現在採用すべきレポート」のエントリを返す(無ければnull)。MANIFEST.jsonが
 * 存在しない場合はupdateManifest()をその場で実行してから読む。
 */
export function resolveCurrentReport(dir, logicalId, repoRoot = REPO_ROOT) {
  const manifestPath = resolve(dir, "MANIFEST.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : updateManifest(dir, repoRoot);
  return manifest.reports[logicalId] ?? null;
}
