/**
 * ローカルスモークテスト: build成功 + 主要ページのHTTP健全性（ブラウザ不要）
 * 使い方: node scripts/testing/smoke.mjs
 */
import { loadEnv } from "./lib/env.mjs";
import { ensureServer, stopDevServer } from "./lib/devServer.mjs";
import { checkPublicPages, checkAuthRedirects, checkPostOnlyApis, printResults } from "./lib/httpChecks.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

async function main() {
  loadEnv();

  // ensureServer が未起動時に build + start する（build成功=必須チェック済み）
  const dev = await ensureServer(PORT);
  const baseUrl = dev.url;
  console.log(`\nserver: ${baseUrl} (production build)`);

  let allPass = true;
  try {
    const pub = await checkPublicPages(baseUrl, ["/", "/dictionary", "/materials", "/guide", "/grammar", "/faq", "/privacy", "/terms"]);
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
    ]);
    allPass = printResults("POST-only API routes via GET (expect 405)", apis) && allPass;
  } finally {
    stopDevServer(dev);
  }

  console.log(allPass ? "\n=== SMOKE: ALL CHECKS PASSED ===" : "\n=== SMOKE: FAILED ===");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
