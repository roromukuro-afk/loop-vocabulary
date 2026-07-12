/**
 * 広告プレースホルダー安全確認 自律E2E検証（グロース計測ラウンド Phase 7）
 *
 * test:adsense-readinessは/dashboard・/wordbooks・/review・/terms・/privacy・/login・
 * /signup・/faq・/dictionaryを検証済みだが、今回オーナーが明示的に「広告を避けるべき」と
 * 指定した場所のうち、まだテストされていないもの（診断・4種のテスト画面・PDF生成画面・
 * /premium・/contact）を追加で検証する。
 *
 * 使い方: node scripts/testing/e2e/adsense-safe-placements.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// 認証必須ページ(/test/*, /pdf)は307でログインへリダイレクトされるため、
// リダイレクト先ではなく初回レスポンス自体にadsenseスクリプトが含まれないことを見る
const NO_AD_PATHS = [
  "/vocab-check",
  "/vocab-check/eiken",
  "/vocab-check/toeic",
  "/test/choice",
  "/test/typing",
  "/test/attack",
  "/test/listening",
  "/pdf",
  "/premium",
  "/contact",
  "/reports",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    for (const path of NO_AD_PATHS) {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      const html = await res.text();
      const hasAdsenseScript = html.includes("pagead2.googlesyndication.com") || html.includes("adsbygoogle.js");
      if (!hasAdsenseScript) {
        ok(`${path}: AdSenseスクリプトが読み込まれない (status=${res.status})`);
      } else {
        fail(`${path}: AdSenseスクリプトが読み込まれている（広告を避けるべき場所）`);
      }
    }

    // adRoutePolicy.ts のロジック自体も直接確認する（実際にpolicy側の許可/非許可を確定させる）
    const { isAdsAllowedPath } = await import("../../../src/lib/ads/adRoutePolicy.ts");
    const shouldBeBlocked = [
      "/vocab-check", "/vocab-check/eiken", "/vocab-check/toeic",
      "/test/choice", "/test/typing", "/test/attack", "/test/listening",
      "/pdf", "/premium", "/contact", "/login", "/signup",
      "/dashboard", "/wordbooks", "/review", "/settings", "/teacher",
    ];
    const wronglyAllowed = shouldBeBlocked.filter((p) => isAdsAllowedPath(p));
    if (wronglyAllowed.length === 0) {
      ok("adRoutePolicy: 学習操作・診断・決済関連ルートがすべて広告非許可になっている");
    } else {
      fail(`adRoutePolicy: 広告が誤って許可されているルート: ${wronglyAllowed.join(", ")}`);
    }

    const shouldBeAllowed = ["/", "/materials", "/materials/toeic", "/guide", "/guide/how-to-memorize-english-words", "/dictionary/analyze"];
    const wronglyBlocked = shouldBeAllowed.filter((p) => !isAdsAllowedPath(p));
    if (wronglyBlocked.length === 0) {
      ok("adRoutePolicy: 許可対象ルート（/, /materials, /guide, /dictionary/[word]）は引き続き許可されている");
    } else {
      fail(`adRoutePolicy: 許可されるべきルートが非許可になっている: ${wronglyBlocked.join(", ")}`);
    }

    // /dictionary本体（検索UIのみ）は引き続き非許可であることの確認（サブパスのみ許可の境界確認）
    if (!isAdsAllowedPath("/dictionary")) {
      ok("adRoutePolicy: /dictionary本体（検索UI）は引き続き広告非許可");
    } else {
      fail("adRoutePolicy: /dictionary本体が誤って広告許可されている");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:adsense-safe-placements: FAILED ===" : "\n=== test:adsense-safe-placements RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
