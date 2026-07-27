/**
 * protected-path-gate: forbiddenPathPatterns + selfProtectionPathPatterns への変更を
 * 承認するかどうかの唯一の判断ロジック。base/main側からのみ実行される信頼workflow
 * (.github/workflows/protected-path-gate.yml、pull_request_target/issue_comment)専用。
 *
 * PRのコードは一切checkout・実行しない。変更ファイル一覧・PRのissueコメント一覧は
 * すべてGitHub REST APIから読み取るだけで、判定に使うforbidden-paths.json自体も
 * このスクリプトと同じbase branchのcheckoutから読む(PR側で書き換えられたバージョンは
 * 一切見えない)。
 *
 * 承認は次の形式のissue commentのみを正式な記録として扱う(PR本文・commit message・
 * labelは一切参照しない — このモジュールのどの関数もそれらを入力に取らない):
 *   /approve-protected-paths <40桁フルSHA>
 *   /revoke-protected-paths <40桁フルSHA>
 * 条件:
 * - コメント本文は前後の空白を除き完全一致(前後に余計な文章がある場合は無効)
 * - コメント投稿者のauthor_associationが"OWNER"であること(外部コントリビューターは
 *   常に無効。個人所有リポジトリでは"OWNER"はリポジトリ所有者本人にしか付与されない
 *   ため、PR作成者自身であっても、他人のPRであっても同じ基準で判定できる)
 * - SHAは現在のPR head SHAと完全一致すること(古いSHAへの承認は無効。新しいpush後は
 *   再承認が必要)
 * - 同じSHAに複数の有効なapprove/revokeコメントがある場合、最終更新時刻
 *   (updated_at。編集されていなければcreated_atと同じ)が最も新しいものを採用する
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");

const APPROVE_RE = /^\/approve-protected-paths\s+([0-9a-f]{40})$/;
const REVOKE_RE = /^\/revoke-protected-paths\s+([0-9a-f]{40})$/;

export function loadProtectedPathConfig(repoRoot = REPO_ROOT) {
  return JSON.parse(readFileSync(resolve(repoRoot, "scripts/improvement/forbidden-paths.json"), "utf8"));
}

/** forbiddenPathPatterns・selfProtectionPathPatternsのどちらかに該当すればtrue。 */
export function isProtectedPath(path, config) {
  const forbidden = config.forbiddenPathPatterns ?? [];
  const selfProtection = config.selfProtectionPathPatterns ?? [];
  return [...forbidden, ...selfProtection].some((p) => path.includes(p));
}

export function findProtectedHits(changedFiles, config) {
  return (changedFiles ?? []).filter((f) => isProtectedPath(f, config));
}

/** コメント本文を承認/取消コマンドとして解析する。厳密一致しない場合はnullを返す。 */
export function parseApprovalCommand(body) {
  const trimmed = (body ?? "").trim();
  const approveMatch = trimmed.match(APPROVE_RE);
  if (approveMatch) return { action: "approve", sha: approveMatch[1] };
  const revokeMatch = trimmed.match(REVOKE_RE);
  if (revokeMatch) return { action: "revoke", sha: revokeMatch[1] };
  return null;
}

/**
 * @param {object} opts
 * @param {Array<{body: string, authorAssociation: string, updatedAt: string}>} opts.comments
 * @param {string} opts.headSha - 現在のPRのHEAD SHA(40桁フル)
 * @returns {{approved: boolean, reason: string}}
 */
export function computeApprovalState({ comments, headSha }) {
  const valid = [];
  for (const c of comments ?? []) {
    if (c.authorAssociation !== "OWNER") continue;
    const cmd = parseApprovalCommand(c.body);
    if (!cmd) continue;
    if (cmd.sha !== headSha) continue;
    valid.push({ ...cmd, updatedAt: c.updatedAt });
  }
  if (valid.length === 0) {
    return {
      approved: false,
      reason: `現在のHEAD(${headSha.slice(0, 7)})に対する有効なowner承認コメント(/approve-protected-paths ${headSha})が見つからない`,
    };
  }
  valid.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  const last = valid[valid.length - 1];
  if (last.action === "approve") {
    return {
      approved: true,
      reason: `ownerが現在のHEAD(${headSha.slice(0, 7)})を/approve-protected-pathsで承認済み`,
    };
  }
  return {
    approved: false,
    reason: `ownerが現在のHEAD(${headSha.slice(0, 7)})への承認を/revoke-protected-pathsで取り消し済み`,
  };
}

// ── GitHub API I/O(すべてfetchImplで差し替え可能。テストはpure関数側を中心に検証する) ──

async function fetchJson(url, token, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status} for ${url}`);
  return res.json();
}

export async function fetchPR({ repo, prNumber, token, fetchImpl = fetch }) {
  return fetchJson(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, token, fetchImpl);
}

const MAX_PAGES = 30; // 100件/pageで3000件相当。暴走防止の安全上限。

export async function fetchChangedFiles({ repo, prNumber, token, fetchImpl = fetch }) {
  const files = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchJson(
      `https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      token,
      fetchImpl,
    );
    files.push(...batch.map((f) => f.filename));
    if (batch.length < 100) break;
  }
  return files;
}

export async function fetchIssueComments({ repo, prNumber, token, fetchImpl = fetch }) {
  const comments = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchJson(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
      token,
      fetchImpl,
    );
    comments.push(...batch.map((c) => ({ body: c.body, authorAssociation: c.author_association, updatedAt: c.updated_at })));
    if (batch.length < 100) break;
  }
  return comments;
}

export async function setCommitStatus({ repo, sha, token, state, description, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/statuses/${sha}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state, context: "protected-path-gate", description: description.slice(0, 140) }),
  });
  if (!res.ok) throw new Error(`Failed to set commit status: ${res.status}`);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const token = process.env.GH_TOKEN;
  if (!repo || !prNumber || !token) {
    console.error("repo/prNumber/tokenが不足している(protected-path-gate.yml側の配線を確認)");
    process.exit(1);
  }

  let headShaForStatus;
  try {
    const pr = await fetchPR({ repo, prNumber, token });
    const headSha = pr.head.sha;
    headShaForStatus = headSha;

    const changedFiles = await fetchChangedFiles({ repo, prNumber, token });
    const config = loadProtectedPathConfig();
    const hits = findProtectedHits(changedFiles, config);

    if (hits.length === 0) {
      await setCommitStatus({ repo, sha: headSha, token, state: "success", description: "保護対象パスへの変更なし" });
      console.log(`✅ 保護対象パスへの変更なし(変更ファイル ${changedFiles.length}件)`);
      return;
    }

    const comments = await fetchIssueComments({ repo, prNumber, token });
    const approval = computeApprovalState({ comments, headSha });

    if (approval.approved) {
      await setCommitStatus({
        repo,
        sha: headSha,
        token,
        state: "success",
        description: `保護対象パス${hits.length}件・owner承認済み`,
      });
      console.log(`✅ ${approval.reason}(保護対象${hits.length}件)`);
    } else {
      await setCommitStatus({
        repo,
        sha: headSha,
        token,
        state: "failure",
        description: `保護対象パス${hits.length}件・承認待ちまたは取消済み`,
      });
      console.log(`❌ ${approval.reason}(保護対象${hits.length}件)`);
      process.exitCode = 1;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`protected-path-gate failed: ${message}`);
    // fail-closed: APIエラー時もHEAD SHAが分かっていればfailureステータスを残す
    if (headShaForStatus) {
      try {
        await setCommitStatus({
          repo,
          sha: headShaForStatus,
          token,
          state: "failure",
          description: "protected-path-gate: APIエラーのため判定不能(fail-closed)",
        });
      } catch {
        /* ステータス更新自体も失敗した場合は諦める(jobのexit 1で失敗は既に伝わる) */
      }
    }
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMainModule) {
  main();
}
