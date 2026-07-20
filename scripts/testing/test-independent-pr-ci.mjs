/**
 * Loop Autonomous Improvement System: 独立PR CI(pr-quality-gate.yml)の配線を静的監査する。
 * 「Engineering Agent自身が実行したテストだけを信用しない」ための構成要件:
 * - pr-quality-gate.yml は pull_request トリガーで、secretsを一切env経由で渡していない
 * - pr-quality-gate.yml の permissions は contents:read のみ(write権限を持たない)
 * - pr-quality-gate.yml は scripts/improvement/pr-ci-checks.mjs を実行する
 * - pr-quality-gate-reflect.yml は workflow_run トリガー(信頼コンテキスト)でのみsecretsを持つ
 * - reflect側は CI失敗時に 'ready_for_review' へは絶対に進めない(reflect-pr-ci-result.mjsを検証)
 * - pr-quality-gate.yml は Playwright Chromiumを`npm ci`の後・`pr-ci-checks.mjs`実行前にインストールする
 *   (2026-07-20、PR #4の独立PR Quality Gate run #29729753115で、canonical-integrity e2eが
 *   ブラウザバイナリ未インストールでクラッシュしたことの回帰防止。scripts/testing/e2e/canonical-integrity.mjs
 *   が実際にPlaywrightでChromiumを起動するため)
 *
 * 使い方: node scripts/testing/test-independent-pr-ci.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

/**
 * `steps:` ブロックを個々のstep chunkの配列へ分解する。step名やインデント幅の具体的な値には
 * 依存しない: 最初に見つかった`- `始まりの行のインデント幅を「1step境界」として動的に検出し、
 * 以降は同じインデント幅で`- `が現れるたびに新しいstepとして区切るだけ。空行・
 * 複数行run(`run: |`)なども、次のstep境界が来るまでは同じchunkに含める。
 * 行末が CRLF (Windowsのcore.autocrlf=trueによるcheckout時変換) でも動作するよう正規化する。
 * 各chunkからはYAMLの行コメント(`#`始まりの行)を除去してから返す — でないと、コメント文中に
 * たまたま他stepの識別子(例: "pr-ci-checks.mjs"という語)が書かれているだけで誤マッチしうる。
 */
function extractSteps(workflowYml) {
  const normalized = workflowYml.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const stepsLineIdx = lines.findIndex((l) => /^\s*steps:\s*$/.test(l));
  if (stepsLineIdx === -1) throw new Error("steps: ブロックが見つからない");
  const stepsIndent = lines[stepsLineIdx].match(/^(\s*)/)[1].length;

  const chunks = [];
  let current = null;
  let itemIndent = null;
  for (let i = stepsLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      if (current) current.push(line);
      continue;
    }
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= stepsIndent) break; // steps:ブロックを抜けた(dedent)
    const isItemStart = indent === (itemIndent ?? indent) && /^\s*-\s/.test(line);
    if (isItemStart && itemIndent === null) itemIndent = indent;
    if (itemIndent !== null && indent === itemIndent && /^\s*-\s/.test(line)) {
      if (current) chunks.push(current.join("\n"));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) chunks.push(current.join("\n"));

  return chunks.map((chunk) =>
    chunk
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n"),
  );
}

function main() {
  // core.autocrlf=trueなWindows環境ではcheckout時にLF→CRLFへ変換されうるため、
  // 行末表現の違いでチェックが揺れないよう読み込み直後にLFへ正規化する。
  const gateYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate.yml"), "utf8").replace(/\r\n/g, "\n");
  const reflectYml = readFileSync(resolve(REPO_ROOT, ".github/workflows/pr-quality-gate-reflect.yml"), "utf8").replace(/\r\n/g, "\n");
  const reflectScript = readFileSync(resolve(REPO_ROOT, "scripts/improvement/reflect-pr-ci-result.mjs"), "utf8").replace(/\r\n/g, "\n");

  if (/^\s*pull_request:/m.test(gateYml)) ok("pr-quality-gate.ymlはpull_requestトリガーで動く");
  else fail("pr-quality-gate.ymlがpull_requestトリガーではない");

  if (!/secrets\./.test(gateYml)) ok("pr-quality-gate.ymlはsecretsを一切参照しない(fork PRでも安全)");
  else fail("pr-quality-gate.ymlがsecretsを参照している(fork PR経由での漏洩リスク)");

  const gatePermissionsMatch = gateYml.match(/^permissions:\n((?:\s+.+\n)+)/m);
  const gatePermissions = gatePermissionsMatch?.[1] ?? "";
  if (/contents:\s*read/.test(gatePermissions) && !/write/.test(gatePermissions)) {
    ok("pr-quality-gate.ymlのpermissionsはcontents:readのみ(write権限なし)");
  } else {
    fail(`pr-quality-gate.ymlのpermissionsが最小権限になっていない: ${gatePermissions}`);
  }

  if (/pr-ci-checks\.mjs/.test(gateYml)) ok("pr-quality-gate.ymlはscripts/improvement/pr-ci-checks.mjsを実行する");
  else fail("pr-quality-gate.ymlがpr-ci-checks.mjsを呼び出していない");

  // Playwright Chromiumインストールの配線(2026-07-20の回帰防止)。step名や具体的なインデント幅の
  // 文字列一致ではなく、実際のstep構造を分解してから内容(run:に何が書かれているか)と
  // 配列上の並び順で判定する — YAMLの空白調整やstep名のリネームでは崩れない。
  {
    const gateSteps = extractSteps(gateYml);
    const npmCiIdx = gateSteps.findIndex((s) => /run:\s*npm ci\b/.test(s));
    const playwrightIdx = gateSteps.findIndex(
      (s) => /playwright install/.test(s) && /--with-deps/.test(s) && /\bchromium\b/.test(s),
    );
    const prCiChecksIdx = gateSteps.findIndex((s) => /pr-ci-checks\.mjs/.test(s));

    if (npmCiIdx === -1) fail("pr-quality-gate.ymlに`npm ci`を実行するstepが見つからない");
    if (playwrightIdx === -1) {
      fail("pr-quality-gate.ymlにPlaywright Chromiumをインストールするstep(--with-deps chromium)が見つからない");
    } else {
      ok("pr-quality-gate.ymlはPlaywright Chromiumを`--with-deps`付きでインストールするstepを持つ");

      const playwrightStep = gateSteps[playwrightIdx];
      if (/\bfirefox\b/i.test(playwrightStep) || /\bwebkit\b/i.test(playwrightStep)) {
        fail("Playwrightインストールstepがchromium以外(firefox/webkit)も対象にしている(chromiumのみが要件)");
      } else {
        ok("Playwrightインストールstepはchromiumのみを対象にしている(firefox/webkitを含まない)");
      }

      if (/continue-on-error:\s*true/.test(playwrightStep)) {
        fail("Playwrightインストールstepにcontinue-on-error: trueが付いている(インストール失敗が握りつぶされ、後続のcanonical-integrityクラッシュの真因が分かりにくくなる)");
      } else {
        ok("Playwrightインストールstepはcontinue-on-errorで失敗を握りつぶしていない");
      }
    }
    if (prCiChecksIdx === -1) fail("pr-quality-gate.ymlにpr-ci-checks.mjsを実行するstepが見つからない");

    if (npmCiIdx !== -1 && playwrightIdx !== -1 && prCiChecksIdx !== -1) {
      if (npmCiIdx < playwrightIdx && playwrightIdx < prCiChecksIdx) {
        ok("step順序は npm ci → Playwright Chromiumインストール → pr-ci-checks.mjs実行、の正しい並びになっている");
      } else {
        fail(
          `step順序が想定外(npm ci=${npmCiIdx}, playwright install=${playwrightIdx}, pr-ci-checks.mjs=${prCiChecksIdx})。` +
            `npm ciの後・pr-ci-checks.mjsの前にPlaywrightインストールが必要`,
        );
      }
    }
  }

  // pr-ci-checks.mjsのinferCategoryTests()がcanonical-integrityを引き続き対象に含んでいること
  // (Playwrightインストールを追加した際に誤ってスキップ設定に変えていないことの確認)
  const prCiChecksScript = readFileSync(resolve(REPO_ROOT, "scripts/improvement/pr-ci-checks.mjs"), "utf8");
  if (/test:canonical-integrity/.test(prCiChecksScript)) {
    ok("pr-ci-checks.mjsは引き続きtest:canonical-integrityを実行対象に含んでいる(スキップされていない)");
  } else {
    fail("pr-ci-checks.mjsからtest:canonical-integrityが消えている(意図せぬスキップの疑い)");
  }

  // 最終的にcanonical-integrityを含む独立チェックが失敗した場合、jobそのものを失敗させる
  // ゲートstep(checks.outcomeを見てexit 1する)が引き続き存在すること
  {
    const gateSteps = extractSteps(gateYml);
    const finalGateIdx = gateSteps.findIndex((s) => /steps\.checks\.outcome/.test(s) && /exit 1/.test(s));
    if (finalGateIdx !== -1) {
      ok("独立チェック失敗時にjobを確実に失敗させる最終ゲートstep(steps.checks.outcomeベースのexit 1)が存在する");
    } else {
      fail("独立チェック失敗時にjobを失敗させる最終ゲートstepが見つからない(canonical-integrity失敗が握りつぶされる恐れ)");
    }
  }

  if (/^\s*workflow_run:/m.test(reflectYml)) ok("pr-quality-gate-reflect.ymlはworkflow_runトリガー(信頼コンテキスト)で動く");
  else fail("pr-quality-gate-reflect.ymlがworkflow_runトリガーではない");

  if (/secrets\.SUPABASE_SERVICE_ROLE_KEY/.test(reflectYml)) ok("Supabase secretはpr-quality-gate-reflect.yml(信頼コンテキスト)側のみに渡されている");
  else fail("pr-quality-gate-reflect.ymlにSupabase secretが渡されていない(結果をDBへ反映できない)");

  if (/status:\s*taskStatus\s*===\s*"ci_failed"|"ci_failed"/.test(reflectScript) && /ready_for_review/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsはci_failed/ready_for_reviewの両方の状態遷移を実装している");
  } else {
    fail("reflect-pr-ci-result.mjsにci_failed/ready_for_reviewの状態遷移が見つからない");
  }

  // CI失敗時に 'ready_for_review' へ進めてはならない、というロジックの核心部分を確認する:
  // ciPassed が false のときは newStatus が必ず 'ci_failed' になる分岐が存在すること
  if (/const\s+ciPassed\s*=.*workflowConclusion.*allPassed/.test(reflectScript) && /ciPassed\s*\?\s*"ready_for_review"\s*:\s*"ci_failed"/.test(reflectScript)) {
    ok("reflect-pr-ci-result.mjsは、独立CIのworkflow結論とpr-ci-checks.mjsのallPassedの両方がtrueのときのみ'ready_for_review'に進み、それ以外は'ci_failed'になる(CI失敗時にready_for_reviewへ格上げされない)");
  } else {
    fail("reflect-pr-ci-result.mjsのCI合否判定ロジックが想定した形になっていない");
  }

  console.log(failed ? `\n=== test:independent-pr-ci: ${failed}件失敗 ===` : "\n=== test:independent-pr-ci RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
