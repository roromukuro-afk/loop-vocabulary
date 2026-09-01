/**
 * オーナー指摘対応: 監査モードの実際の起動(x-lv-e2e-testヘッダーがLV_AUDIT_TOKENと
 * 一致すること)を検証する「strict」なE2Eスクリプトが、LV_AUDIT_TOKEN未設定の場合に
 * devサーバー起動・ブラウザ起動・ページ遷移より前に確実に落ちることを、各スクリプトを
 * 実際に子プロセスとして起動し、経過時間で証明する。
 *
 * 「開始前にfailした」ことを経過時間で判定する理由: devサーバーのビルド
 * (ensureDevServer/ensureServer)は通常10秒〜数十秒かかる。LV_AUDIT_TOKENチェックが
 * devサーバー起動より前にあれば、プロセスは数秒以内(FAIL_FAST_THRESHOLD_MS)に
 * 終了するはずで、もしチェックの位置が(今回のCodexレビュー指摘のように)
 * devサーバー起動やページ遷移の後ろへ紛れ込んだ場合は、この閾値を超えて初めて
 * 気づける。stderrの文言(process.exitCode/exit(1) + "LV_AUDIT_TOKEN"を含む
 * メッセージ)も合わせて確認する。
 *
 * このテスト自身は、対象スクリプトをLV_AUDIT_TOKENだけ除いた環境変数で実際に
 * 起動する(spawnSync)。他のsecret([NEXT_PUBLIC_SUPABASE_URL等])は.env.localに
 * 委ねる(スクリプト自身のloadEnv()が読み込む)ため、このテスト自体はネットワーク・
 * DBアクセスを一切行わない(各対象スクリプトのrequireEnv()が最初の必須チェックで
 * 落ちるため、それ以降のコードには到達しない)。
 *
 * 使い方: node scripts/testing/test-strict-audit-scripts-fail-without-token.mjs
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { REPO_ROOT } from "./lib/env.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// devサーバービルド(10秒〜数十秒)よりはるかに短い、「開始前に落ちた」とみなす閾値。
const FAIL_FAST_THRESHOLD_MS = 8000;
const SPAWN_TIMEOUT_MS = 15000;

// LV_AUDIT_TOKENの実際の起動(監査モードの有効化そのもの)に依存する、"strict"な
// スクリプトの一覧。新しくこの依存を追加したスクリプトは必ずここへ追記すること
// (追記を忘れると、この repo-wide 保証が静かに素通りする)。
export const STRICT_AUDIT_SCRIPTS = [
  { relPath: "scripts/testing/e2e/ga4-webdriver-exclusion.mjs", extraArgs: [] },
  { relPath: "scripts/testing/e2e/middleware-supabase-audit-interaction.mjs", extraArgs: [] },
  { relPath: "scripts/testing/e2e/analytics-environment-isolation.mjs", extraArgs: [] },
  { relPath: "scripts/testing/e2e/analytics-production-ingestion.mjs", extraArgs: [] },
  { relPath: "scripts/testing/e2e/analytics-rejection-reasons.mjs", extraArgs: [] },
  { relPath: "scripts/testing/check-prod-srs-v2-global.mjs", extraArgs: [] },
];

function runWithoutToken(relPath) {
  const scriptPath = resolve(REPO_ROOT, relPath);
  // 対象スクリプトは自分自身でloadEnv()を呼び.env.localをファイルから直接読む
  // (scripts/testing/lib/env.mjs::loadEnv()は`process.env[key] === undefined`の
  // ときだけ.env.local由来の値を代入する)。そのため親プロセスのenvから
  // LV_AUDIT_TOKENを取り除いて渡すだけでは、子プロセス自身のloadEnv()が
  // .env.localから再度読み込んでしまい「未設定」を再現できない。実際に
  // .env.local自体からLV_AUDIT_TOKEN行を一時的に取り除いてから起動し、
  // 必ず(成功・失敗・例外を問わず)元に戻す。
  const env = { ...process.env };
  delete env.LV_AUDIT_TOKEN;

  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf-8",
    timeout: SPAWN_TIMEOUT_MS,
  });
  const elapsedMs = Date.now() - startedAt;
  return { result, elapsedMs };
}

const ENV_LOCAL_PATH = resolve(REPO_ROOT, ".env.local");

function withLvAuditTokenStripped(fn) {
  if (!existsSync(ENV_LOCAL_PATH)) {
    throw new Error(`${ENV_LOCAL_PATH} が見つからない(LV_AUDIT_TOKENが元々設定されていない環境ではこのテストは実行できない)`);
  }
  const original = readFileSync(ENV_LOCAL_PATH, "utf-8");
  if (!/^LV_AUDIT_TOKEN=/m.test(original)) {
    throw new Error(".env.local にLV_AUDIT_TOKEN行が見つからない(先にLV_AUDIT_TOKENを設定してからこのテストを実行すること)");
  }
  const stripped = original
    .split("\n")
    .filter((line) => !line.startsWith("LV_AUDIT_TOKEN="))
    .join("\n");
  writeFileSync(ENV_LOCAL_PATH, stripped, "utf-8");
  try {
    return fn();
  } finally {
    // 例外・タイムアウトを問わず必ず元の内容へ戻す。
    writeFileSync(ENV_LOCAL_PATH, original, "utf-8");
  }
}

function main() {
  for (const { relPath } of STRICT_AUDIT_SCRIPTS) {
    console.log(`\n--- ${relPath} (LV_AUDIT_TOKEN未設定) ---`);
    const { result, elapsedMs } = withLvAuditTokenStripped(() => runWithoutToken(relPath));

    const failedFast = elapsedMs < FAIL_FAST_THRESHOLD_MS;
    if (failedFast) {
      ok(`${relPath}: ${elapsedMs}ms で終了(devサーバー起動閾値${FAIL_FAST_THRESHOLD_MS}ms未満 = 開始前にfailした)`);
    } else {
      bad(`${relPath}: ${elapsedMs}ms かかった(devサーバー起動やページ遷移が始まってしまった疑い。LV_AUDIT_TOKENチェックの位置を確認すること)`);
    }

    const exitedWithError = result.status !== 0;
    if (exitedWithError) {
      ok(`${relPath}: 非ゼロ終了コード(${result.status})で終了した`);
    } else {
      bad(`${relPath}: 終了コード0(成功扱い)で終了した — LV_AUDIT_TOKEN未設定でも通ってしまっている`);
    }

    const mentionsToken = (result.stderr ?? "").includes("LV_AUDIT_TOKEN");
    if (mentionsToken) {
      ok(`${relPath}: エラーメッセージにLV_AUDIT_TOKENが含まれている(理由が明確)`);
    } else {
      bad(`${relPath}: エラーメッセージにLV_AUDIT_TOKENが含まれていない(実測stderr先頭200文字: ${(result.stderr ?? "").slice(0, 200)})`);
    }
  }

  console.log(fail
    ? `\n=== test:strict-audit-scripts-fail-without-token: ${fail}件失敗 (${pass}件成功) ===`
    : `\n=== test:strict-audit-scripts-fail-without-token RESULT: all ${pass} checks passed ===`);
  process.exit(fail ? 1 : 0);
}

main();
