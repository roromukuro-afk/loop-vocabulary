/**
 * 本番デプロイ後の回帰確認（HTTPのみ、ブラウザ不要。Stripeスキーマ確認のみ読み取り専用でSupabaseに接続）
 * 使い方: node scripts/testing/verify-prod.mjs [https://loop-vocabulary.app]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  checkPublicPages, checkAuthRedirects, checkPostOnlyApis, checkPostRoutesExpectStatus, printResults,
} from "./lib/httpChecks.mjs";
import { loadEnv, requireEnv, REPO_ROOT } from "./lib/env.mjs";
import { getAdminClient } from "./lib/supabaseAdmin.mjs";

const baseUrl = process.argv[2] || process.env.PROD_URL || "https://loop-vocabulary.app";

// 2026-07-05に発覚した「profiles.stripe_customer_id/premium_expires_at列が本番に
// 存在せずStripe連携が壊れていた」重大不具合（WORK_HISTORY.md参照）の再発を早期検知する。
async function checkStripeSchema() {
  loadEnv();
  requireEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const admin = getAdminClient();
  // PostgRESTはinformation_schemaを公開しないため、対象カラムを1行select(limit 0)して
  // PostgRESTのエラー(42703: カラム不存在)が起きないことでカラムの存在を判定する。
  const found = new Set();
  for (const col of ["is_premium", "stripe_customer_id", "premium_expires_at"]) {
    const { error } = await admin.from("profiles").select(col).limit(1);
    if (!error) found.add(col);
  }
  return [
    { path: "profiles.is_premium", status: found.has("is_premium") ? "exists" : "MISSING", pass: found.has("is_premium") },
    { path: "profiles.stripe_customer_id", status: found.has("stripe_customer_id") ? "exists" : "MISSING", pass: found.has("stripe_customer_id") },
    { path: "profiles.premium_expires_at", status: found.has("premium_expires_at") ? "exists" : "MISSING", pass: found.has("premium_expires_at") },
  ];
}

// dashboardのBannerAdPlaceholderがisPremiumでガードされていること（ソースコード確認、
// 2026-07-05のPremium導線監査で発見・修正した「Premiumにも広告が出る」不具合の再発防止）。
function checkPremiumAdGuardSource() {
  const src = readFileSync(resolve(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");
  const bannerIdx = src.indexOf("<BannerAdPlaceholder");
  const guardIdx = src.lastIndexOf("{!isPremium && (", bannerIdx);
  const pass = bannerIdx > -1 && guardIdx > -1 && bannerIdx - guardIdx < 200;
  return [{ path: "dashboard/page.tsx: BannerAdPlaceholder is !isPremium-guarded", status: pass ? "ok" : "NOT GUARDED", pass }];
}

async function main() {
  console.log(`Verifying production: ${baseUrl}`);
  let allPass = true;

  const pub = await checkPublicPages(baseUrl, [
    "/", "/dictionary", "/materials", "/materials/toeic", "/materials/business", "/materials/news",
    "/guide", "/grammar", "/faq", "/privacy", "/terms", "/sitemap.xml", "/signup", "/premium",
  ]);
  allPass = printResults("Public pages (expect 200)", pub) && allPass;

  const auth = await checkAuthRedirects(baseUrl, ["/dashboard", "/review", "/settings", "/teacher", "/pdf"]);
  allPass = printResults("Auth-required pages, not logged in (expect 307/302 -> /login)", auth) && allPass;

  const apis = await checkPostOnlyApis(baseUrl, [
    "/api/wordbook/ensure-default",
    "/api/settings/srs",
    "/api/teacher/promote",
    "/api/teacher/classes",
    "/api/teacher/join",
    "/api/teacher/membership",
    "/api/teacher/invite-code",
    "/api/gamification/claim-daily-ticket",
  ]);
  allPass = printResults("POST-only API routes via GET (expect 405)", apis) && allPass;

  // Stripe checkout/webhookルートの存在確認（404ではなく、想定される認証/署名エラーが返ることを確認）
  const stripeRoutes = await checkPostRoutesExpectStatus(baseUrl, [
    { path: "/api/stripe/checkout", expect: [401, 503] }, // 未ログイン401、または未設定503（実装は存在する）
    { path: "/api/stripe/webhook", expect: 400, headers: { "stripe-signature": "t=1,v1=invalid" } },
  ]);
  allPass = printResults("Stripe routes exist (expect non-404 guard response)", stripeRoutes) && allPass;

  const stripeSchema = await checkStripeSchema();
  allPass = printResults("Stripe/Premium schema columns (profiles, read-only)", stripeSchema) && allPass;

  const adGuard = checkPremiumAdGuardSource();
  allPass = printResults("Premium ad-hide guard (source check)", adGuard) && allPass;

  console.log(allPass ? "\n=== verify:prod: ALL CHECKS PASSED ===" : "\n=== verify:prod: FAILED ===");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-prod crashed:", e);
  process.exit(1);
});
