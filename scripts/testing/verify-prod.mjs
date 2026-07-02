/**
 * 本番デプロイ後の回帰確認（HTTPのみ、ブラウザ不要）
 * 使い方: node scripts/testing/verify-prod.mjs [https://loop-vocabulary.app]
 */
import { checkPublicPages, checkAuthRedirects, checkPostOnlyApis, printResults } from "./lib/httpChecks.mjs";

const baseUrl = process.argv[2] || process.env.PROD_URL || "https://loop-vocabulary.app";

async function main() {
  console.log(`Verifying production: ${baseUrl}`);
  let allPass = true;

  const pub = await checkPublicPages(baseUrl, [
    "/", "/dictionary", "/materials", "/guide", "/grammar", "/faq",
    "/privacy", "/terms", "/sitemap.xml", "/signup",
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
  ]);
  allPass = printResults("POST-only API routes via GET (expect 405)", apis) && allPass;

  console.log(allPass ? "\n=== verify:prod: ALL CHECKS PASSED ===" : "\n=== verify:prod: FAILED ===");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-prod crashed:", e);
  process.exit(1);
});
