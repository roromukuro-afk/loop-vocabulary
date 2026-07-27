/**
 * forbidden-paths(業務クリティカルパス: 決済/課金/広告/プライバシー/analytics schema等)への
 * 変更を、リポジトリownerによる監査可能な明示承認がある場合に限り通すための判定ロジック。
 *
 * 設計方針(すべて必須要件。forbidden-paths.jsonのパターン自体・pathIsForbidden()の判定は
 * 一切変更しない — ここは「検査を維持したまま、正規の承認があれば例外的に通す」ための
 * 追加レイヤーであり、検査を削除・無効化・対象外化するものではない):
 * - PR本文の自己申告や、外部コントリビューター自身によるラベル付与では通らない。
 *   GitHubのPull Request Reviews APIで実際に `state: "APPROVED"` になっているレビューのみを
 *   信用する(GitHubのUI上でしか作れず、PRの説明文やコミットメッセージからは偽装できない)。
 * - 承認者はCODEOWNERSに列挙されたGitHubユーザーに限る(このリポジトリでは実質@roromukuro-afkの
 *   みだが、将来CODEOWNERSに複数ownerが増えても動くよう、ハードコードせずファイルから読む)。
 * - 新しいpushがあった場合は再承認が必要: 承認レビューの`commit_id`が現在のPRのHEAD SHAと
 *   完全一致するものだけを有効とする(古いSHAへの承認を、その後のforbidden-paths変更へ
 *   使い回すことはできない)。
 * - ネットワーク取得部分は`fetchImpl`引数で差し替え可能にし、単体テストではネットワーク
 *   接続なしで全分岐を検証できるようにする。
 * - repo/prNumber/headSha/tokenが揃わない環境(ローカル実行等)では承認なしとして安全側に倒す
 *   (fail-closed。誤って常にpassするような実装にはしない)。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

export function loadCodeownersLogins(codeownersPath = resolve(__dir, "../../.github/CODEOWNERS")) {
  let text;
  try {
    text = readFileSync(codeownersPath, "utf8");
  } catch {
    return [];
  }
  const logins = new Set();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    for (const token of trimmed.split(/\s+/).slice(1)) {
      if (token.startsWith("@")) logins.add(token.slice(1).toLowerCase());
    }
  }
  return [...logins];
}

/**
 * @param {object} opts
 * @param {string} [opts.repo] - "owner/repo"(例: GITHUB_REPOSITORY)
 * @param {string|number} [opts.prNumber]
 * @param {string} [opts.headSha] - 現在のPRのHEAD SHA。これと一致するcommit_idの承認のみ有効。
 * @param {string} [opts.token] - GitHub Actionsが実行ごとに自動発行するGITHUB_TOKEN(読み取り専用、
 *   fork PRでも安全 — SUPABASE_SERVICE_ROLE_KEY等の真のリポジトリsecretとは別物)。
 * @param {string[]} [opts.ownerLogins] - 承認者として認めるGitHubログイン名。省略時はCODEOWNERSから読む。
 * @param {typeof fetch} [opts.fetchImpl] - テスト用に差し替え可能なfetch実装。
 * @returns {Promise<{approved: boolean, reason: string}>}
 */
export async function checkProtectedPathApproval({
  repo,
  prNumber,
  headSha,
  token,
  ownerLogins,
  fetchImpl = fetch,
} = {}) {
  const owners = (ownerLogins ?? loadCodeownersLogins()).map((l) => l.toLowerCase());
  if (owners.length === 0) {
    return { approved: false, reason: "CODEOWNERSに承認可能なownerが見つからない" };
  }
  if (!repo || !prNumber || !headSha || !token) {
    return { approved: false, reason: "承認確認に必要な情報(repo/prNumber/headSha/token)が不足している(ローカル実行等)" };
  }

  let reviews;
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return { approved: false, reason: `GitHub API error: ${res.status}` };
    reviews = await res.json();
  } catch (e) {
    return { approved: false, reason: `GitHub API取得失敗: ${e instanceof Error ? e.message : String(e)}` };
  }

  const validApproval = (Array.isArray(reviews) ? reviews : []).find(
    (r) => r?.state === "APPROVED" && r?.commit_id === headSha && owners.includes(String(r?.user?.login ?? "").toLowerCase()),
  );

  if (validApproval) {
    return { approved: true, reason: `${validApproval.user.login} が現在のHEAD(${headSha.slice(0, 7)})を明示承認済み` };
  }
  return {
    approved: false,
    reason: `CODEOWNERS(${owners.join(", ")})による現在のHEAD(${headSha.slice(0, 7)})への承認レビューが見つからない(PR本文の記載やラベル付与だけでは承認扱いにならない。新しいpush後は再承認が必要)`,
  };
}
