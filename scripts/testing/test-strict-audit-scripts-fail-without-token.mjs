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
 * 対象範囲(2026-09-01、オーナー指摘対応で縮小): 監査モードの起動そのものだけを
 * 検証するE2Eスクリプト(ga4-webdriver-exclusion.mjs等)は、production secretへの
 * 依存を断ち切り、実行のたびに自分自身で使い捨てトークンを生成するよう再設計された
 * (scripts/testing/lib/ephemeralAuditToken.mjs参照)。これらはもはやLV_AUDIT_TOKEN
 * 環境変数の有無に一切依存しないため、この「未設定で確実に落ちる」契約の対象から
 * 外れる。実際のproduction環境(https://loop-vocabulary.app)へアクセスする
 * check-prod-srs-v2-global.mjsだけが、本物のLV_AUDIT_TOKENの事前設定を必要とする
 * 唯一のスクリプトとして残る。
 *
 * このテスト自身は、対象スクリプトをLV_AUDIT_TOKENだけ除いた環境変数で実際に
 * 起動する(spawnSync)。.env.localにはLV_AUDIT_TOKENを一切置かない方針
 * (オーナー指摘対応)のため、親プロセスのenvから取り除くだけで「未設定」を
 * 正しく再現できる(対象スクリプト自身のloadEnv()が.env.localから読み戻すことはない)。
 * 他のsecret([NEXT_PUBLIC_SUPABASE_URL等])は.env.localに委ねる。
 *
 * 使い方: node scripts/testing/test-strict-audit-scripts-fail-without-token.mjs
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { REPO_ROOT } from "./lib/env.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

// devサーバービルド(10秒〜数十秒)よりはるかに短い、「開始前に落ちた」とみなす閾値。
const FAIL_FAST_THRESHOLD_MS = 8000;
const SPAWN_TIMEOUT_MS = 15000;

// production secretの実際の値(LV_AUDIT_TOKEN)を必要とする、"strict"なスクリプトの
// 一覧。新しくこの依存を追加したスクリプトは必ずここへ追記すること(追記を忘れると、
// この repo-wide 保証が静かに素通りする)。監査モードの仕組み自体だけを検証する
// スクリプトは、production secretではなく使い捨てトークンを自分で生成するため、
// ここには含めない(上記コメント参照)。
export const STRICT_AUDIT_SCRIPTS = [
  { relPath: "scripts/testing/check-prod-srs-v2-global.mjs", extraArgs: [] },
];

function runWithoutToken(relPath) {
  const scriptPath = resolve(REPO_ROOT, relPath);
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

function main() {
  for (const { relPath } of STRICT_AUDIT_SCRIPTS) {
    console.log(`\n--- ${relPath} (LV_AUDIT_TOKEN未設定) ---`);
    const { result, elapsedMs } = runWithoutToken(relPath);

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
