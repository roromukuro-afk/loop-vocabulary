/**
 * scripts/reporting/lib/reportVersioning.mjs(vocab_growth_organic向けレポートの
 * collectorVersion付与・ファイル名一意化・MANIFEST.json更新)の単体テスト。
 * 実プロジェクトのreports/ディレクトリには一切触れず、専用のtmpdirに対して
 * updateManifest()を直接呼び出すことで隔離する(feedback_isolate_integration_tests
 * 参照: CLIスクリプトを叩く統合テストは実プロジェクトのデータディレクトリに
 * 書き込まない)。
 *
 * getCollectorVersion()は実際にこのリポジトリのgit HEADを読むため、モックは
 * せず、テスト自身もgetCollectorVersion()を呼んで「現在の実際のHEAD」を取得し、
 * それを「新しいバージョン」として使う(架空のSHA文字列を仮定するのではなく、
 * 実行環境の実際の値に対してテストする)。「古いバージョン」側は、実際のHEADとは
 * 確実に異なる架空のSHAを使う。
 *
 * 使い方: node scripts/testing/test-report-versioning.mjs
 */
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { updateManifest, getCollectorVersion, REPO_ROOT } from "../reporting/lib/reportVersioning.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function writeFakeReport(dir, filename, { collectorVersion, generatedAt }) {
  writeFileSync(resolve(dir, filename), JSON.stringify({ generatedAt, collectorVersion }, null, 2), "utf8");
}

function main() {
  const currentVersion = getCollectorVersion(REPO_ROOT);
  const currentShort = currentVersion.slice(0, 7);
  // 実際のHEADとは確実に異なる、架空の「古いバージョン」。
  const oldVersion = currentVersion.startsWith("f") ? "e".repeat(40) : "f".repeat(40);
  const oldShort = oldVersion.slice(0, 7);

  const dir = mkdtempSync(resolve(tmpdir(), "report-versioning-test-"));
  try {
    // ---- シナリオ1: 同じlogicalIdについて、古いバージョン(バグ修正前の
    // collectorVersion)と新しいバージョン(現在のHEADと一致)が両方存在する
    // 場合、新しい方だけがcurrentとして選ばれ、古い方はsupersedesへ入る
    // (削除・上書きはされない) ----
    writeFakeReport(dir, `report-a.${oldShort}.json`, { collectorVersion: oldVersion, generatedAt: "2026-08-24T00:47:00.000Z" });
    writeFakeReport(dir, `report-a.${currentShort}.json`, { collectorVersion: currentVersion, generatedAt: "2026-08-24T10:04:00.000Z" });

    const manifest1 = updateManifest(dir, REPO_ROOT);
    const groupA = manifest1.reports["report-a"];
    if (
      groupA &&
      groupA.current === `report-a.${currentShort}.json` &&
      groupA.currentMatchesHeadCollectorVersion === true &&
      groupA.supersedes.length === 1 &&
      groupA.supersedes[0] === `report-a.${oldShort}.json`
    ) {
      ok("現在のHEADと一致する新しいバージョンのレポートがcurrentとして選ばれ、古いバージョンはsupersedesへ記録される(削除されない)");
    } else {
      bad(`シナリオ1が想定外: ${JSON.stringify(groupA)}`);
    }
    if (existsSync(resolve(dir, `report-a.${oldShort}.json`))) {
      ok("古いバージョンのレポートファイル自体は削除されず、監査用にそのまま残る");
    } else {
      bad("古いバージョンのレポートファイルが削除されてしまった");
    }

    // ---- シナリオ2: 現在のHEADと一致するバージョンが1件も無い場合(まだ現在の
    // コードで再生成されていない)、生成時刻が最も新しいものが暫定current扱いに
    // なりつつ、currentMatchesHeadCollectorVersion=falseで「まだ検証されて
    // いない」ことが明示される ----
    const otherOldVersion = "d".repeat(40);
    writeFakeReport(dir, `report-b.${oldShort}.json`, { collectorVersion: oldVersion, generatedAt: "2026-08-23T00:00:00.000Z" });
    writeFakeReport(dir, `report-b.${otherOldVersion.slice(0, 7)}.json`, { collectorVersion: otherOldVersion, generatedAt: "2026-08-24T00:00:00.000Z" });
    const manifest2 = updateManifest(dir, REPO_ROOT);
    const groupB = manifest2.reports["report-b"];
    if (
      groupB &&
      groupB.current === `report-b.${otherOldVersion.slice(0, 7)}.json` &&
      groupB.currentMatchesHeadCollectorVersion === false
    ) {
      ok("現在のHEADと一致するバージョンが無い場合、生成時刻最新のものが暫定currentになりつつ、未検証であることが明示される");
    } else {
      bad(`シナリオ2が想定外: ${JSON.stringify(groupB)}`);
    }

    // ---- シナリオ3: 壊れたJSON(パース不能)もmanifestから黙って除外せず、
    // 生成時刻不明のまま監査対象として残る ----
    writeFileSync(resolve(dir, "report-c.bad0000.json"), "{ this is not valid json", "utf8");
    const manifest3 = updateManifest(dir, REPO_ROOT);
    const groupC = manifest3.reports["report-c"];
    if (groupC && groupC.allVersions.length === 1 && groupC.allVersions[0].file === "report-c.bad0000.json" && groupC.allVersions[0].generatedAt === null) {
      ok("壊れたJSON(パース不能)のレポートも、manifestから除外されず生成時刻不明のまま監査対象として残る");
    } else {
      bad(`シナリオ3が想定外: ${JSON.stringify(groupC)}`);
    }

    // ---- シナリオ4: MANIFEST.json自身は次回のグルーピング対象に含まれない
    // (自己参照ループを起こさない) ----
    const manifest4 = updateManifest(dir, REPO_ROOT);
    if (!("MANIFEST" in manifest4.reports)) {
      ok("MANIFEST.json自身は次回のグルーピング対象に含まれない(自己参照しない)");
    } else {
      bad("MANIFEST.jsonが誤って自分自身をグルーピング対象に含めてしまった");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:report-versioning RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
