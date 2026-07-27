/**
 * scripts/improvement/protectedPathApproval.mjs の単体テスト(ネットワーク不要)。
 *
 * 検証すること:
 * - PR本文の自己申告やラベルではなく、実際のGitHub Review APIの`APPROVED`状態だけを見る
 * - 承認者はCODEOWNERS上のownerに限る(外部コントリビューターの自己承認は通らない)
 * - 承認は現在のHEAD SHAに紐づいたものだけが有効(新しいpush後は再承認が必要 = 古いSHAへの
 *   承認は使い回せない)
 * - repo/prNumber/headSha/tokenが揃わない場合は承認なし扱い(fail-closed)
 *
 * 使い方: node scripts/testing/test-protected-path-approval.mjs
 */
import { checkProtectedPathApproval, loadCodeownersLogins } from "../improvement/protectedPathApproval.mjs";

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function fakeFetch(reviews, { status = 200 } = {}) {
  return async () => ({
    ok: status < 400,
    status,
    json: async () => reviews,
  });
}

const HEAD_SHA = "abc1234deadbeef";
const OTHER_SHA = "0000000stale111";

async function main() {
  // 1. repo/prNumber/headSha/tokenが揃わない場合は承認なし(ローカル実行等でも安全側に倒す)
  {
    const result = await checkProtectedPathApproval({});
    if (!result.approved) ok("必要な情報が無い場合は承認なし扱いになる(fail-closed)");
    else bad("情報不足でも承認扱いになってしまった");
  }

  // 2. ownerLoginsが空(CODEOWNERSが読めない等)の場合は承認なし
  {
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 1,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: [],
      fetchImpl: fakeFetch([]),
    });
    if (!result.approved) ok("承認可能なownerが居ない場合は承認なし扱いになる");
    else bad("owner不在でも承認扱いになってしまった");
  }

  // 3. CODEOWNERSオーナーが現在のHEAD SHAへAPPROVEDレビュー → 承認される
  {
    const reviews = [{ state: "APPROVED", commit_id: HEAD_SHA, user: { login: "roromukuro-afk" } }];
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 18,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: ["roromukuro-afk"],
      fetchImpl: fakeFetch(reviews),
    });
    if (result.approved) ok("CODEOWNERSオーナーによる現在HEADへのAPPROVEDレビューは承認される");
    else bad(`承認されるべきケースが承認されなかった: ${result.reason}`);
  }

  // 4. 外部コントリビューター(CODEOWNERS外)によるAPPROVEDレビューは無効(自己承認防止)
  {
    const reviews = [{ state: "APPROVED", commit_id: HEAD_SHA, user: { login: "random-external-contributor" } }];
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 18,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: ["roromukuro-afk"],
      fetchImpl: fakeFetch(reviews),
    });
    if (!result.approved) ok("CODEOWNERS外のユーザーによる承認は無効(外部コントリビューターの自己承認を防止)");
    else bad("CODEOWNERS外のユーザーの承認が通ってしまった");
  }

  // 5. 古いSHAへの承認(新しいpush後に再承認していない)は無効
  {
    const reviews = [{ state: "APPROVED", commit_id: OTHER_SHA, user: { login: "roromukuro-afk" } }];
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 18,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: ["roromukuro-afk"],
      fetchImpl: fakeFetch(reviews),
    });
    if (!result.approved) ok("古いSHAへの承認は無効(新しいpush後は再承認が必要)");
    else bad("古いSHAへの承認が使い回せてしまった");
  }

  // 6. APPROVEDでもCOMMENTED/CHANGES_REQUESTEDの他レビューが混ざっていても、有効な承認があれば通る
  {
    const reviews = [
      { state: "COMMENTED", commit_id: HEAD_SHA, user: { login: "roromukuro-afk" } },
      { state: "CHANGES_REQUESTED", commit_id: OTHER_SHA, user: { login: "roromukuro-afk" } },
      { state: "APPROVED", commit_id: HEAD_SHA, user: { login: "roromukuro-afk" } },
    ];
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 18,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: ["roromukuro-afk"],
      fetchImpl: fakeFetch(reviews),
    });
    if (result.approved) ok("他の状態のレビューが混在していても、有効なAPPROVEDが1件あれば承認される");
    else bad(`混在レビュー中の有効な承認が見逃された: ${result.reason}`);
  }

  // 7. GitHub APIがエラーを返す場合は承認なし扱い(フェイルクローズ)
  {
    const result = await checkProtectedPathApproval({
      repo: "org/repo",
      prNumber: 18,
      headSha: HEAD_SHA,
      token: "t",
      ownerLogins: ["roromukuro-afk"],
      fetchImpl: fakeFetch(null, { status: 404 }),
    });
    if (!result.approved) ok("GitHub APIエラー時は承認なし扱いになる(fail-closed)");
    else bad("APIエラー時に承認扱いになってしまった");
  }

  // 8. 実際の.github/CODEOWNERSからownerを読める(統合サニティチェック、ネットワーク不要)
  {
    const logins = loadCodeownersLogins();
    if (logins.includes("roromukuro-afk")) ok("loadCodeownersLogins()が実際の.github/CODEOWNERSからroromukuro-afkを読み取れる");
    else bad(`CODEOWNERSからownerを読み取れなかった: ${JSON.stringify(logins)}`);
  }

  console.log(fail === 0 ? "\n=== test:protected-path-approval: ALL CHECKS PASSED ===" : "\n=== test:protected-path-approval: FAILED ===");
  process.exit(fail === 0 ? 0 : 1);
}

main();
