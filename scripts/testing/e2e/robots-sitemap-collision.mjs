/**
 * robots.txt の意図しない prefix 衝突の再発防止テスト(サーバ起動不要、静的ファイル検証)。
 *
 * 背景(2026-07-28 Search Console調査で発見): `Disallow: /road` が単純な
 * prefix一致だったため、会員限定ページ /road だけでなく、sitemap.xmlに掲載されている
 * 公開コンテンツページ /roadmap まで意図せずクロールブロックしてしまっていた。
 * `Disallow: /road$` (Google拡張の終端アンカー) へ変更して修正した。
 *
 * 検証内容:
 *   1. /road, /road?x=1 は引き続きブロックされる
 *   2. /roadmap, /roadmap/配下 はブロックされない
 *   3. /test, /api/ など既存の非公開ルールは維持されている(退行していない)
 *   4. sitemap.ts に列挙されている静的な公開URL(materials/dictionary/grammarの
 *      DB・外部データ駆動分を除く)が、どのDisallowルールにも一致しない
 *      (「/road → /roadmap」と同種の衝突が他に潜んでいないかの広域チェック)
 *
 * 使い方: node scripts/testing/e2e/robots-sitemap-collision.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { parseRobotsTxt, isPathBlocked } from "../lib/robotsMatch.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const ROBOTS_PATH = resolve(REPO_ROOT, "public/robots.txt");
const SITEMAP_SRC_PATH = resolve(REPO_ROOT, "src/app/sitemap.ts");

let failed = false;
function fail(msg) {
  failed = true;
  console.error(`\n❌ FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

function assertBlocked(rules, path, shouldBeBlocked, label) {
  const blocked = isPathBlocked(path, rules);
  if (blocked === shouldBeBlocked) {
    ok(`${label}: ${path} は${shouldBeBlocked ? "ブロックされる" : "ブロックされない"} (期待どおり)`);
  } else {
    fail(`${label}: ${path} の判定が想定外 (期待=${shouldBeBlocked ? "ブロック" : "許可"}, 実際=${blocked ? "ブロック" : "許可"})`);
  }
}

/**
 * sitemap.ts のソースから、DB/外部import非依存の静的パスだけを抽出する。
 * `${base}/xxx` の完全リテラル行(他の ${...} 補間を含まない行)と、
 * GUIDE_SLUGS配列から生成される /guide/<slug> を対象にする。
 */
function extractStaticSitemapPaths(sitemapSrc) {
  const paths = new Set(["/"]);

  // `${base}/literal/path` (他の${...}を含まない = 完全リテラル) を全行から抽出
  const literalRe = /\$\{base\}(\/[a-zA-Z0-9\-/]*)`/g;
  for (const m of sitemapSrc.matchAll(literalRe)) {
    paths.add(m[1]);
  }

  // GUIDE_SLUGS配列 -> /guide/<slug>
  const guideSlugsMatch = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  if (guideSlugsMatch) {
    for (const m of guideSlugsMatch[1].matchAll(/"([a-z0-9-]+)"/g)) {
      paths.add(`/guide/${m[1]}`);
    }
  }

  return [...paths].sort();
}

function main() {
  const robotsTxt = readFileSync(ROBOTS_PATH, "utf-8");
  const rules = parseRobotsTxt(robotsTxt);

  console.log("=== 1. /road は引き続きブロックされる ===");
  assertBlocked(rules, "/road", true, "会員限定ページ");
  assertBlocked(rules, "/road?x=1", true, "クエリ付き");

  console.log("\n=== 2. /roadmap はブロックされない(今回の修正対象) ===");
  assertBlocked(rules, "/roadmap", false, "公開ガイドページ");
  assertBlocked(rules, "/roadmap/", false, "末尾スラッシュ");
  assertBlocked(rules, "/roadmap/foo", false, "配下パス(将来追加された場合の保険)");
  assertBlocked(rules, "/roadmap?utm_source=x", false, "クエリ付き");

  console.log("\n=== 3. 既存の非公開ルールが退行していない ===");
  assertBlocked(rules, "/test", true, "テスト用ページ");
  assertBlocked(rules, "/api/", true, "APIルート");
  assertBlocked(rules, "/api/foo", true, "APIサブパス");
  assertBlocked(rules, "/dashboard", true, "会員ダッシュボード");
  assertBlocked(rules, "/extract", true, "認証必須機能ページ");

  console.log("\n=== 4. sitemap.xml 掲載の公開URLがどのDisallowルールとも衝突していない ===");
  const sitemapSrc = readFileSync(SITEMAP_SRC_PATH, "utf-8");
  const staticPaths = extractStaticSitemapPaths(sitemapSrc);
  if (!staticPaths.includes("/roadmap")) {
    fail("sitemap.ts から /roadmap を抽出できなかった(抽出ロジックかsitemap.tsの構造が変わった可能性 — このテスト自体が無意味になっていないか要確認)");
  } else {
    ok(`sitemap.ts から ${staticPaths.length} 件の静的公開URLを抽出(/roadmap を含む)`);
  }
  for (const path of staticPaths) {
    assertBlocked(rules, path, false, "sitemap公開URL");
  }

  if (failed) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log("\n=== 全チェック成功 ===");
  }
}

main();
