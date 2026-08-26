/**
 * scripts/reporting/lib/reportVersioning.mjs(vocab_growth_organic向けレポートの
 * collectorFingerprint付与・ファイル名一意化・MANIFEST.json更新・freshness
 * validator)の単体テスト。実プロジェクトのreports/ディレクトリには一切触れず、
 * 専用のtmpdirに対してupdateManifest()/writeVersionedReport()を直接呼び出す
 * ことで隔離する(feedback_isolate_integration_tests参照)。
 *
 * 使い方: node scripts/testing/test-report-versioning.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import {
  updateManifest,
  resolveCurrentReport,
  writeVersionedReport,
  getGitCommit,
  getCollectorFingerprint,
  REPO_ROOT,
  FINGERPRINT_SOURCE_FILES,
  REPORT_SCHEMA_VERSION,
} from "../reporting/lib/reportVersioning.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function writeFakeReport(dir, filename, fields) {
  writeFileSync(resolve(dir, filename), JSON.stringify(fields, null, 2), "utf8");
}

async function main() {
  const currentFingerprint = getCollectorFingerprint(REPO_ROOT);
  const oldFingerprint = currentFingerprint === "e".repeat(16) ? "f".repeat(16) : "e".repeat(16);

  const dir = mkdtempSync(resolve(tmpdir(), "report-versioning-test-"));
  try {
    // ---- シナリオ1: 同じlogicalIdについて、古いfingerprint(バグ修正前の
    // collector)と新しいfingerprint(現在のcollectorと一致)が両方存在する
    // 場合、新しい方だけがcurrentとして選ばれ、古い方はsupersedesへ入る
    // (削除・上書きはされない) ----
    writeFakeReport(dir, `report-a.${oldFingerprint}.json`, { collectorFingerprint: oldFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-24T00:47:00.000Z" });
    writeFakeReport(dir, `report-a.${currentFingerprint}.json`, { collectorFingerprint: currentFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-24T10:04:00.000Z" });

    const manifest1 = updateManifest(dir, REPO_ROOT);
    const groupA = manifest1.reports["report-a"];
    if (
      groupA &&
      groupA.current === `report-a.${currentFingerprint}.json` &&
      groupA.currentMatchesCollectorFingerprint === true &&
      groupA.supersedes.length === 1 &&
      groupA.supersedes[0] === `report-a.${oldFingerprint}.json`
    ) {
      ok("現在のcollectorFingerprintと一致する新しいバージョンのレポートがcurrentとして選ばれ、古いバージョンはsupersedesへ記録される(削除されない)");
    } else {
      bad(`シナリオ1が想定外: ${JSON.stringify(groupA)}`);
    }
    if (existsSync(resolve(dir, `report-a.${oldFingerprint}.json`))) {
      ok("古いバージョンのレポートファイル自体は削除されず、監査用にそのまま残る");
    } else {
      bad("古いバージョンのレポートファイルが削除されてしまった");
    }

    // ---- シナリオ2: 現在のfingerprintと一致するバージョンが1件も無い場合、
    // 生成時刻最新のものが暫定currentになりつつ、currentMatchesCollector
    // Fingerprint=falseで「まだ検証されていない」ことが明示される ----
    writeFakeReport(dir, `report-b.${oldFingerprint}.json`, { collectorFingerprint: oldFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-23T00:00:00.000Z" });
    const otherOldFingerprint = "d".repeat(16);
    writeFakeReport(dir, `report-b.${otherOldFingerprint}.json`, { collectorFingerprint: otherOldFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-24T00:00:00.000Z" });
    const manifest2 = updateManifest(dir, REPO_ROOT);
    const groupB = manifest2.reports["report-b"];
    if (
      groupB &&
      groupB.current === `report-b.${otherOldFingerprint}.json` &&
      groupB.currentMatchesCollectorFingerprint === false
    ) {
      ok("現在のfingerprintと一致するバージョンが無い場合、生成時刻最新のものが暫定currentになりつつ、未検証であることが明示される");
    } else {
      bad(`シナリオ2が想定外: ${JSON.stringify(groupB)}`);
    }

    // ---- シナリオ3: 壊れたJSON(パース不能)もmanifestから黙って除外せず、
    // メタデータ不明のまま監査対象として残る ----
    writeFileSync(resolve(dir, "report-c.bad0000000000000.json"), "{ this is not valid json", "utf8");
    const manifest3 = updateManifest(dir, REPO_ROOT);
    const groupC = manifest3.reports["report-c"];
    if (groupC && groupC.allVersions.length === 1 && groupC.allVersions[0].generatedAt === null) {
      ok("壊れたJSON(パース不能)のレポートも、manifestから除外されずメタデータ不明のまま監査対象として残る");
    } else {
      bad(`シナリオ3が想定外: ${JSON.stringify(groupC)}`);
    }

    // ---- シナリオ4: MANIFEST.json自身は次回のグルーピング対象に含まれない ----
    const manifest4 = updateManifest(dir, REPO_ROOT);
    if (!("MANIFEST" in manifest4.reports)) {
      ok("MANIFEST.json自身は次回のグルーピング対象に含まれない(自己参照しない)");
    } else {
      bad("MANIFEST.jsonが誤って自分自身をグルーピング対象に含めてしまった");
    }

    // ---- シナリオ5: reportSchemaVersionが現行のREPORT_SCHEMA_VERSIONより
    // 新しい(未来の)レポートは、fingerprintが一致していてもcurrent候補から
    // 除外される(このconsumerのバージョンではまだ理解できないスキーマの
    // レポートを誤って現行として扱わない) ----
    {
      const futureDir = mkdtempSync(resolve(tmpdir(), "report-versioning-schema-"));
      try {
        writeFakeReport(futureDir, `report-d.${currentFingerprint}.json`, { collectorFingerprint: currentFingerprint, reportSchemaVersion: REPORT_SCHEMA_VERSION + 1, generatedAt: "2026-08-24T12:00:00.000Z" });
        writeFakeReport(futureDir, `report-d.${oldFingerprint}.json`, { collectorFingerprint: oldFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-23T00:00:00.000Z" });
        const m = updateManifest(futureDir, REPO_ROOT);
        const groupD = m.reports["report-d"];
        // fingerprintは一致するがschemaVersionが未来のため、matchingプールから除外され、
        // fallback(生成時刻最新)がcurrentになる。
        if (groupD && groupD.current === `report-d.${currentFingerprint}.json` && groupD.currentMatchesCollectorFingerprint === false) {
          ok("reportSchemaVersionが現行より新しいレポートは、fingerprintが一致していてもcurrent候補(currentMatchesCollectorFingerprint=true)から除外される");
        } else {
          bad(`シナリオ5が想定外: ${JSON.stringify(groupD)}`);
        }
      } finally {
        rmSync(futureDir, { recursive: true, force: true });
      }
    }

    // ---- シナリオ6: resolveCurrentReport()は、MANIFEST.jsonのcurrentCollector
    // Fingerprintが「今この瞬間の」fingerprintと一致しない場合、キャッシュを
    // 信頼せずその場でupdateManifest()を再実行する(Codexレビュー指摘対応、
    // PR #125: 古いMANIFEST.jsonをそのまま信頼すると、まさにこのAPIが必要な
    // 瞬間に古いcollectorバージョンをcurrentだと誤って返してしまう) ----
    {
      const staleDir = mkdtempSync(resolve(tmpdir(), "report-versioning-stale-"));
      try {
        writeFakeReport(staleDir, `report-e.${oldFingerprint}.json`, { collectorFingerprint: oldFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-23T00:00:00.000Z" });
        // 意図的に「古いfingerprintがcurrentだった時点」のMANIFEST.jsonを直接
        // 手で書き、キャッシュが古いままの状態を再現する。
        writeFileSync(
          resolve(staleDir, "MANIFEST.json"),
          JSON.stringify({
            generatedAt: "2026-08-23T00:00:01.000Z",
            currentCollectorFingerprint: oldFingerprint,
            reportSchemaVersion: REPORT_SCHEMA_VERSION,
            reports: { "report-e": { current: `report-e.${oldFingerprint}.json`, currentMatchesCollectorFingerprint: true, supersedes: [], allVersions: [] } },
          }, null, 2),
          "utf8",
        );
        // 新しいfingerprintのレポートを追加(MANIFEST.jsonはまだ手書きのまま、
        // 意図的に更新していない)。
        writeFakeReport(staleDir, `report-e.${currentFingerprint}.json`, { collectorFingerprint: currentFingerprint, reportSchemaVersion: 1, generatedAt: "2026-08-24T00:00:00.000Z" });

        const entry = resolveCurrentReport(staleDir, "report-e", REPO_ROOT);
        if (entry && entry.current === `report-e.${currentFingerprint}.json` && entry.currentMatchesCollectorFingerprint === true) {
          ok("resolveCurrentReport()は、キャッシュされたMANIFEST.jsonのcurrentCollectorFingerprintが実際の現在値と食い違う場合、その場でupdateManifest()を再実行し古いcollectorバージョンを返さない");
        } else {
          bad(`シナリオ6(stale manifest revalidation)が想定外: ${JSON.stringify(entry)}`);
        }
      } finally {
        rmSync(staleDir, { recursive: true, force: true });
      }
    }

    // ---- シナリオ7: 無関係なファイルの変更(README等、FINGERPRINT_SOURCE_
    // FILESに含まれないファイル)ではcollectorFingerprintが変わらず、既存の
    // current判定が揺らがない(ユーザーからの直接要求)。実際にFINGERPRINT_
    // SOURCE_FILESと同じ相対パス構造を持つ一時repoRootを作り、(a) 対象ファイル
    // を変更すればfingerprintが変わること、(b) 対象外のファイルだけを変更
    // してもfingerprintが変わらないことの両方を確認する。 ----
    {
      const fakeRepoRoot = mkdtempSync(resolve(tmpdir(), "report-versioning-fingerprint-repo-"));
      try {
        for (const relPath of FINGERPRINT_SOURCE_FILES) {
          const dest = resolve(fakeRepoRoot, relPath);
          mkdirSync(dirname(dest), { recursive: true });
          cpSync(resolve(REPO_ROOT, relPath), dest);
        }
        const baseline = getCollectorFingerprint(fakeRepoRoot);

        // (b) 対象外のファイル(README.md、FINGERPRINT_SOURCE_FILESに含まれない)
        // を変更してもfingerprintは変わらない。
        writeFileSync(resolve(fakeRepoRoot, "README.md"), "unrelated change\n", "utf8");
        const afterUnrelatedChange = getCollectorFingerprint(fakeRepoRoot);
        if (afterUnrelatedChange === baseline) {
          ok("FINGERPRINT_SOURCE_FILESに含まれない無関係なファイル(README等)の変更では、collectorFingerprintが変わらない");
        } else {
          bad(`無関係な変更でfingerprintが変わってしまった: baseline=${baseline}, after=${afterUnrelatedChange}`);
        }

        // (a) 対象ファイル自体を変更すればfingerprintは変わる(検出できることの確認)。
        const targetPath = resolve(fakeRepoRoot, FINGERPRINT_SOURCE_FILES[0]);
        writeFileSync(targetPath, readFileSync(targetPath, "utf8") + "\n// test-only modification\n", "utf8");
        const afterTargetChange = getCollectorFingerprint(fakeRepoRoot);
        if (afterTargetChange !== baseline) {
          ok("FINGERPRINT_SOURCE_FILESに含まれる実測ロジックファイル自体の変更では、collectorFingerprintが正しく変わる");
        } else {
          bad("実測ロジックファイルの変更がfingerprintへ反映されなかった");
        }
      } finally {
        rmSync(fakeRepoRoot, { recursive: true, force: true });
      }
    }

    // ---- シナリオ8: 並行書き込み(複数プロセス相当)でもMANIFEST.jsonが
    // 破損せず、書き込まれた全レポートのエントリが失われない(ユーザーからの
    // 直接要求: atomic rename設計により、後勝ちで片方の更新が消えることが
    // 無いことを確認する) ----
    {
      const concurrentDir = mkdtempSync(resolve(tmpdir(), "report-versioning-concurrent-"));
      try {
        const N = 8;
        await Promise.all(
          Array.from({ length: N }, (_, i) =>
            Promise.resolve().then(() =>
              writeVersionedReport(
                concurrentDir,
                `concurrent-report-${i}`,
                { kind: "test", value: i },
                `summary ${i}\n`,
                { repoRoot: REPO_ROOT, generatedAt: new Date(2026, 7, 24, 0, 0, i).toISOString() },
              ),
            ),
          ),
        );
        const manifestPath = resolve(concurrentDir, "MANIFEST.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const loggedKeys = Object.keys(manifest.reports);
        const allPresent = Array.from({ length: N }, (_, i) => `concurrent-report-${i}`).every((k) => loggedKeys.includes(k));
        const tmpLeftovers = readdirSync(concurrentDir).filter((f) => f.startsWith(".tmp-"));
        if (allPresent && tmpLeftovers.length === 0) {
          ok(`${N}件の並行書き込み後もMANIFEST.jsonが有効なJSONのまま全レポートのエントリを保持し、一時ファイルが残らない(atomic renameの確認)`);
        } else {
          bad(`並行書き込みテストが想定外: loggedKeys=${JSON.stringify(loggedKeys)}, tmpLeftovers=${JSON.stringify(tmpLeftovers)}`);
        }
      } finally {
        rmSync(concurrentDir, { recursive: true, force: true });
      }
    }

    // ---- gitCommitは監査用フィールドとして引き続き取得できる(current判定には
    // 使わないが、値自体は取得可能であることの回帰確認) ----
    {
      const commit = getGitCommit(REPO_ROOT);
      if (typeof commit === "string" && (commit === "unknown" || /^[0-9a-f]{40}$/.test(commit))) {
        ok("getGitCommit()は監査用の完全SHA(または取得不能時はunknown)を返す");
      } else {
        bad(`getGitCommit()の戻り値が想定外: ${commit}`);
      }
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

await main();
