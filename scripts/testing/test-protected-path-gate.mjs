/**
 * scripts/improvement/protectedPathGate.mjs の単体テスト(ネットワーク不要)。
 *
 * この承認フローの核心要件を検証する:
 * - 承認はGitHub Issue Commentの厳密一致だけを見る(PR本文・label・commit messageは
 *   そもそもこのモジュールのどの関数にも入力として渡らない)
 * - 承認者はauthor_association === "OWNER" のときだけ有効(個人所有リポジトリでは
 *   PR作成者が誰であっても関係なく、コメント投稿者がOWNERかどうかだけを見るため、
 *   「PR作成者自身のPR」でも正しく承認できる)
 * - SHAは現在のPR head SHAと完全一致が必要(古いSHA・pushによる再承認要求)
 * - 同一SHAに複数の有効コマンドがある場合は時系列で最後のものが勝つ
 * - forbiddenPathPatternsとselfProtectionPathPatterns(.github/workflows/含む)の
 *   両方を保護対象として扱う
 * - GitHub API呼び出し(ページネーション・エラー時のfail-closed)
 *
 * 使い方: node scripts/testing/test-protected-path-gate.mjs
 */
import {
  parseApprovalCommand,
  computeApprovalState,
  isProtectedPath,
  findProtectedHits,
  loadProtectedPathConfig,
  fetchChangedFiles,
  fetchIssueComments,
} from "../improvement/protectedPathGate.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function comment({ body, authorAssociation = "OWNER", updatedAt }) {
  return { body, authorAssociation, updatedAt };
}

// ── parseApprovalCommand ──────────────────────────────────────
{
  const approve = parseApprovalCommand(`/approve-protected-paths ${SHA}`);
  if (approve?.action === "approve" && approve.sha === SHA) ok("parseApprovalCommand: 正しい形式のapproveコマンドを解析できる");
  else bad(`approveコマンドの解析結果が想定通りでない: ${JSON.stringify(approve)}`);

  const revoke = parseApprovalCommand(`/revoke-protected-paths ${SHA}`);
  if (revoke?.action === "revoke" && revoke.sha === SHA) ok("parseApprovalCommand: 正しい形式のrevokeコマンドを解析できる");
  else bad(`revokeコマンドの解析結果が想定通りでない: ${JSON.stringify(revoke)}`);

  // 前後に空白があるだけ(実質完全一致)は許容する
  const withWhitespace = parseApprovalCommand(`  /approve-protected-paths ${SHA}  \n`);
  if (withWhitespace?.action === "approve") ok("parseApprovalCommand: 前後の空白は許容される");
  else bad("前後の空白だけのコマンドが解析できなかった");

  // 本文中に紛れているだけ(完全一致でない)は無効
  const embedded = parseApprovalCommand(`LGTM! /approve-protected-paths ${SHA}`);
  if (embedded === null) ok("parseApprovalCommand: コメント本文の完全一致でない場合(前後に文章がある)は無効");
  else bad("完全一致でないコメントが承認コマンドとして解析されてしまった");

  // 短縮SHA(40桁未満)は無効
  const shortSha = parseApprovalCommand(`/approve-protected-paths ${SHA.slice(0, 7)}`);
  if (shortSha === null) ok("parseApprovalCommand: 短縮SHA(40桁未満)は無効");
  else bad("短縮SHAが承認コマンドとして解析されてしまった");

  // PR本文・labelはそもそもこの関数の入力仕様に無い(構造的に承認できない)
  const prBodyLike = parseApprovalCommand(`## Summary\n承認: /approve-protected-paths ${SHA}\n続きの本文...`);
  if (prBodyLike === null) ok("parseApprovalCommand: PR本文のような複数行・前後に文章がある内容では承認コマンドとして解析されない");
  else bad("PR本文のような内容が承認コマンドとして解析されてしまった");
}

// ── computeApprovalState ──────────────────────────────────────
{
  const approved = computeApprovalState({
    comments: [comment({ body: `/approve-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-01T00:00:00Z" })],
    headSha: SHA,
  });
  if (approved.approved) ok("computeApprovalState: OWNERによる現在HEADへのapproveは承認される(PR作成者自身のPRでも、コメント投稿者がOWNERであれば同じ基準で承認できる)");
  else bad(`承認されるべきケースが承認されなかった: ${approved.reason}`);
}

for (const assoc of ["COLLABORATOR", "MEMBER", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "NONE"]) {
  const result = computeApprovalState({
    comments: [comment({ body: `/approve-protected-paths ${SHA}`, authorAssociation: assoc, updatedAt: "2026-01-01T00:00:00Z" })],
    headSha: SHA,
  });
  if (!result.approved) ok(`computeApprovalState: author_association="${assoc}"(OWNER以外)による承認は無効`);
  else bad(`author_association="${assoc}"の承認が通ってしまった(外部コントリビューター/非ownerの自己承認を防止できていない)`);
}

{
  // 古いSHAへの承認は無効(新しいpush後は再承認が必要)
  const result = computeApprovalState({
    comments: [comment({ body: `/approve-protected-paths ${OTHER_SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-01T00:00:00Z" })],
    headSha: SHA,
  });
  if (!result.approved) ok("computeApprovalState: 古いSHAへの承認は無効(push後は再承認が必要)");
  else bad("古いSHAへの承認が現在のHEADにも使い回せてしまった");
}

{
  // approve後にrevoke → 失敗
  const result = computeApprovalState({
    comments: [
      comment({ body: `/approve-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-01T00:00:00Z" }),
      comment({ body: `/revoke-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-02T00:00:00Z" }),
    ],
    headSha: SHA,
  });
  if (!result.approved) ok("computeApprovalState: approve後にrevokeした場合は失敗になる(時系列で最後が勝つ)");
  else bad("approve後のrevokeが反映されず、承認扱いのままになってしまった");
}

{
  // revoke後にapprove → 成功
  const result = computeApprovalState({
    comments: [
      comment({ body: `/revoke-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-01T00:00:00Z" }),
      comment({ body: `/approve-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-02T00:00:00Z" }),
    ],
    headSha: SHA,
  });
  if (result.approved) ok("computeApprovalState: revoke後にapproveした場合は成功になる(時系列で最後が勝つ)");
  else bad(`revoke後のapproveが反映されなかった: ${result.reason}`);
}

{
  // 編集で更新されたコメント(updatedAtが後)が正しく最新扱いされる
  const result = computeApprovalState({
    comments: [
      comment({ body: `/approve-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-05T00:00:00Z" }),
      comment({ body: `/revoke-protected-paths ${SHA}`, authorAssociation: "OWNER", updatedAt: "2026-01-01T00:00:00Z" }),
    ],
    headSha: SHA,
  });
  if (result.approved) ok("computeApprovalState: updated_atの順序で判定する(投稿順ではなく、実際の更新時刻が新しい方が勝つ)");
  else bad("updated_atベースの時系列判定が機能していない");
}

{
  // コメントが1件も無い場合はfail-closed
  const result = computeApprovalState({ comments: [], headSha: SHA });
  if (!result.approved) ok("computeApprovalState: コメントが無い場合はfail-closed(未承認扱い)");
  else bad("コメントが無いのに承認扱いになってしまった");
}

// ── isProtectedPath / findProtectedHits: forbidden + selfProtection 両方を保護対象にする ──
{
  const config = loadProtectedPathConfig();

  if (isProtectedPath("src/lib/analytics/eventSchema.ts", config)) {
    ok("isProtectedPath: forbiddenPathPatterns(analytics schema)は保護対象");
  } else {
    bad("forbiddenPathPatternsのファイルが保護対象と判定されなかった");
  }

  if (isProtectedPath(".github/workflows/pr-quality-gate.yml", config)) {
    ok("isProtectedPath: .github/workflows/ 配下の変更も保護対象(selfProtectionPathPatterns)");
  } else {
    bad(".github/workflows/ 配下の変更が保護対象と判定されなかった");
  }

  if (isProtectedPath("scripts/improvement/protectedPathGate.mjs", config)) {
    ok("isProtectedPath: scripts/improvement/ 配下(承認判定コード自身を含む)も保護対象");
  } else {
    bad("scripts/improvement/ 配下の変更が保護対象と判定されなかった");
  }

  if (!isProtectedPath("src/app/guide/toeic-tango/page.tsx", config)) {
    ok("isProtectedPath: 無関係なファイルは保護対象にならない(過剰検知しない)");
  } else {
    bad("無関係なファイルが誤って保護対象と判定された");
  }

  const hits = findProtectedHits(
    ["src/app/page.tsx", ".github/workflows/protected-path-gate.yml", "src/lib/analytics/eventSchema.ts"],
    config,
  );
  if (hits.length === 2 && hits.includes(".github/workflows/protected-path-gate.yml") && hits.includes("src/lib/analytics/eventSchema.ts")) {
    ok("findProtectedHits: forbidden/selfProtection両方のヒットを正しく抽出する");
  } else {
    bad(`findProtectedHitsの結果が想定通りでない: ${JSON.stringify(hits)}`);
  }
}

// ── GitHub API I/O: ページネーション・エラー時のfail-closed ──────
async function main() {
  {
    // 100件ちょうど→2ページ目へ、2ページ目が100件未満→そこで終了
    const page1 = Array.from({ length: 100 }, (_, i) => ({ filename: `file-${i}.ts` }));
    const page2 = [{ filename: "last-file.ts" }];
    let calls = 0;
    const fetchImpl = async (url) => {
      calls++;
      const isPage2 = /page=2/.test(url);
      return { ok: true, json: async () => (isPage2 ? page2 : page1) };
    };
    const files = await fetchChangedFiles({ repo: "org/repo", prNumber: 1, token: "t", fetchImpl });
    if (files.length === 101 && calls === 2) ok("fetchChangedFiles: ページネーションを正しく処理する(100件ちょうどのページの次も取得し、100件未満で停止する)");
    else bad(`ページネーション処理が想定通りでない: files=${files.length}, calls=${calls}`);
  }

  {
    // issueコメントのページネーションも同様に処理できる
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      body: `comment-${i}`,
      author_association: "NONE",
      updated_at: "2026-01-01T00:00:00Z",
    }));
    const page2 = [{ body: `/approve-protected-paths ${SHA}`, author_association: "OWNER", updated_at: "2026-01-02T00:00:00Z" }];
    const fetchImpl = async (url) => {
      const isPage2 = /page=2/.test(url);
      return { ok: true, json: async () => (isPage2 ? page2 : page1) };
    };
    const comments = await fetchIssueComments({ repo: "org/repo", prNumber: 1, token: "t", fetchImpl });
    if (comments.length === 101) {
      ok("fetchIssueComments: ページネーションを正しく処理する");
      const state = computeApprovalState({ comments, headSha: SHA });
      if (state.approved) ok("fetchIssueComments経由で取得した2ページ目のOWNER承認が正しく認識される");
      else bad("2ページ目にある有効な承認が見逃された");
    } else {
      bad(`issueコメントのページネーション処理が想定通りでない: ${comments.length}`);
    }
  }

  {
    // GitHub APIエラー時はfail-closed(例外を投げる。呼び出し側main()がcatchしてfailureにする)
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
    let threw = false;
    try {
      await fetchChangedFiles({ repo: "org/repo", prNumber: 1, token: "t", fetchImpl });
    } catch {
      threw = true;
    }
    if (threw) ok("fetchChangedFiles: GitHub APIエラー時は例外を投げる(fail-closed。承認済みとして扱われることはない)");
    else bad("GitHub APIエラー時に例外が投げられなかった");
  }

  console.log(fail === 0 ? "\n=== test:protected-path-gate: ALL CHECKS PASSED ===" : "\n=== test:protected-path-gate: FAILED ===");
  process.exit(fail === 0 ? 0 : 1);
}

main();
