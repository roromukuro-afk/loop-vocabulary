/**
 * 一時確認スクリプト: SRS V2 グローバルenvフラグが本番で有効かを、
 * test+srs アカウント自身の profiles.srs_v2 を false に固定した状態で
 * 本番 /review にアクセスし、4ボタンUI(V2)が出るか観察する（クリックはしない）。
 * 使い方: node scripts/testing/check-prod-srs-v2-global.mjs
 */
import { chromium } from "playwright";
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";
import { TEST_ACCOUNTS } from "./lib/testAccounts.mjs";
import { getAuditToken } from "./lib/auditToken.mjs";
import { allowFirstPartyOrigin } from "./e2e/lib/firstPartyAuditMode.mjs";
import { guardAdNetworkRequests } from "./e2e/lib/adNetworkGuard.mjs";

loadEnv();
requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", TEST_ACCOUNTS.srs.passwordEnvKey]);
// このスクリプトは実ブラウザ(chromium.launch())で本番URLへ遷移するため、
// クライアント側GA4タグ・first-party analytics_eventsが実際に発火する
// (verify-prod.mjs/ads-txt-live.mjsは素のfetch()のみでブラウザJSを実行しない
// ため対象外)。オーナー指摘の repo-wide 監査で発見: 監査モード用ヘッダーを
// 一切送っていなかったため、これまでの実行はすべて本番の意思決定用集計を
// 汚す実ユーザートラフィックとして記録されていた。production監査script同様、
// LV_AUDIT_TOKEN未設定なら開始前に落とす(getAuditToken()、strict)。
//
// このスクリプトは実際のproduction(PROD_URL)を検証する唯一のE2Eスクリプトであり、
// 本物のLV_AUDIT_TOKEN(GitHub Environment secret「autonomous-improvement」/
// Vercel Production)と一致する値が必要(オーナー指摘対応、2026-09-01: 他の
// 監査モードE2Eテストはscripts/testing/lib/ephemeralAuditToken.mjs経由の
// 使い捨てトークンへ移行済み)。.env.localへは絶対に保存しないこと — 実行時に
// このプロセスの環境変数としてだけ渡す(例:
// `LV_AUDIT_TOKEN=<値> node scripts/testing/check-prod-srs-v2-global.mjs`、
// シェル履歴に残したくない場合は履歴に残らない入力手段を使う)。
const auditToken = getAuditToken();

const PROD_URL = "https://loop-vocabulary.app";
const admin = getAdminClient();

// 前提確認: この時点で個人フラグが false であること
const { data: prof } = await admin.from("profiles").select("srs_v2").eq("email", TEST_ACCOUNTS.srs.email).maybeSingle();
console.log("test+srs profiles.srs_v2 (個人フラグ) =", prof?.srs_v2, "(false であることが前提)");
if (prof?.srs_v2 !== false) {
  console.error("前提が崩れています。個人フラグをfalseにしてから再実行してください。");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
// オーナー指摘対応(Codexレビュー、セキュリティ、緊急): page.setExtraHTTPHeaders()は
// page全体(第三者origin含む)へ適用されるため使わない。PROD_URL originへの最初の
// navigationにだけ限定してヘッダーを送る(scripts/testing/e2e/lib/
// firstPartyAuditMode.mjs参照)。監査モードが正しく機能していればGA4/AdSense等の
// 実通信自体が発生しないはずだが、念のためguardAdNetworkRequests()も併用し、
// 万一のガード漏れがあっても実際の外部通信はabortする。
await guardAdNetworkRequests(page);
// strict:true(オーナー指摘対応、2026-09-01、P1): このスクリプトはproductionへの
// 実アクセスを前提に、監査モードが実際に起動していること(=実ユーザートラフィックを
// 生成していないこと)へ依存する。LV_AUDIT_TOKENがproductionの値と一致しない場合
// (人間が誤った/古い値を渡した場合等)、ステータスコードだけでは検知できない
// (middleware.tsは通常ページを200で返すため)。X-LV-Audit-Active: 1(トークン検証
// 成功専用のresponse header、オーナー指摘対応2026-09-01: X-Robots-Tag: noindexは
// 監査と無関係な理由でも付与されうるため証拠として使わない)の有無で実際の認証成否を
// 確認し、失敗していれば例外で即座に停止する(scripts/testing/e2e/lib/firstPartyAuditMode.mjs参照)。
await allowFirstPartyOrigin(page, PROD_URL, auditToken, { strict: true });

await page.goto(`${PROD_URL}/login`, { waitUntil: "load" });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(500);
await page.locator('[data-testid="login-email"]').fill(TEST_ACCOUNTS.srs.email);
await page.locator('[data-testid="login-password"]').fill(process.env[TEST_ACCOUNTS.srs.passwordEnvKey]);
await Promise.all([
  page.waitForURL(/\/dashboard/, { timeout: 15000 }),
  page.locator('[data-testid="login-submit"]').click(),
]);
console.log("本番へログイン成功:", page.url());

await page.goto(`${PROD_URL}/review?start=1&mode=flip`, { waitUntil: "load" });
await page.waitForLoadState("networkidle");

const card = page.locator('[data-testid="flip-card"]');
const hasCard = await card.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);

if (!hasCard) {
  console.log("復習カードが表示されませんでした（復習待ちの単語が無い可能性）。");
} else {
  await card.click(); // 裏面表示（評価はしない）
  const v2 = await page.locator('[data-testid="srs-v2-rating-buttons"]').isVisible().catch(() => false);
  const v1 = await page.locator('[data-testid="srs-v1-answer-buttons"]').isVisible().catch(() => false);
  console.log("V2(4段階評価)ボタン表示:", v2);
  console.log("V1(2値)ボタン表示:", v1);
  if (v2) console.log("\n✅ 個人フラグ=false でもV2 UIが表示 → グローバルenvフラグが本番で有効に効いている");
  else if (v1) console.log("\n❌ V1 UIのまま → グローバルenvフラグが本番に反映されていない可能性");
}

await browser.close();
