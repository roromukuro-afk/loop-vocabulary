/**
 * robots.txt の意図しない prefix 衝突の再発防止テスト(サーバ起動不要、静的ファイル検証)。
 *
 * 背景(2026-07-28 Search Console調査で発見): `Disallow: /road` が単純な
 * prefix一致だったため、会員限定ページ /road だけでなく、sitemap.xmlに掲載されている
 * 公開コンテンツページ /roadmap まで意図せずクロールブロックしてしまっていた。
 *
 * 修正方法: `Disallow: /road` はそのまま維持し(/road配下を含めて引き続き
 * ブロックするため)、`Allow: /roadmap` を追加した。Googleは複数ルールが一致する
 * 場合、パターン文字列がより長く具体的なルールを優先するため、/roadmap配下では
 * `Allow: /roadmap`(8文字)が`Disallow: /road`(5文字)より優先され、許可される。
 *
 * (最初の修正案だった `Disallow: /road$` は誤りだった: Googleの "$" はクエリ文字列
 * を含むURL全体の終端を意味するため、`/road$` は `/road` のみをブロックし、
 * `/road?x=1` や `/road/lesson` はブロックできない。このテストの「2. $ の仕様」
 * セクションで、その誤りが再発しないことを明示的に検証する。)
 *
 * 検証内容:
 *   1. /road, /road?x=1, /road/, /road/lesson は引き続きブロックされる。
 *      /roadmap, /roadmap?query, /roadmap/配下 は許可される。
 *   2. Googleの "$" の仕様(クエリを含むURL全体の終端)を、実際のrobots.txtとは
 *      独立に検証する(`Disallow: /road$` 単独では /road のみblocked、
 *      /road?x=1 はallowedになることを明示)。
 *   3. /test, /api/ など既存の非公開ルールは維持されている(退行していない)。
 *   4. sitemap.ts に列挙されている静的な公開URL(materials/dictionary/grammarの
 *      DB・外部データ駆動分を除く)が、どのDisallowルールにも意図せず一致しない
 *      (「/road → /roadmap」と同種の衝突が他に潜んでいないかの広域チェック)。
 *   5. sitemap.ts のURL一覧(GUIDE_SLUGS等)が本PRで変更されていないことの確認。
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

// 本PRで変更していないことを確認するための、既知のGUIDE_SLUGS件数と代表slug。
const EXPECTED_GUIDE_SLUG_COUNT = 40;
const EXPECTED_SAMPLE_SLUGS = ["eigo-listening-renshu", "toeic-tango", "eiken-1kyu-tango"];

function main() {
  const robotsTxt = readFileSync(ROBOTS_PATH, "utf-8");
  const rules = parseRobotsTxt(robotsTxt);

  console.log("=== 1. /road はブロック、/roadmap は許可(今回の修正) ===");
  assertBlocked(rules, "/road", true, "会員限定ページ");
  assertBlocked(rules, "/road?x=1", true, "クエリ付き");
  assertBlocked(rules, "/road/", true, "末尾スラッシュ");
  assertBlocked(rules, "/road/lesson", true, "配下パス");

  assertBlocked(rules, "/roadmap", false, "公開ガイドページ");
  assertBlocked(rules, "/roadmap?utm_source=x", false, "クエリ付き");
  assertBlocked(rules, "/roadmap/", false, "末尾スラッシュ");
  assertBlocked(rules, "/roadmap/foo", false, "配下パス(将来追加された場合の保険)");

  console.log("\n=== 2. Googleの \"$\" 仕様の回帰確認(実際のrobots.txtとは独立) ===");
  console.log("(以前の修正案 `Disallow: /road$` は、クエリ付きURLをブロックできない誤りだった)");
  const dollarOnlyRules = parseRobotsTxt("User-agent: *\nDisallow: /road$\n");
  assertBlocked(dollarOnlyRules, "/road", true, "$アンカー単独: 完全一致");
  assertBlocked(dollarOnlyRules, "/road?x=1", false, "$アンカー単独: クエリ付きはブロックされない(Google仕様)");
  assertBlocked(dollarOnlyRules, "/roadmap", false, "$アンカー単独: 別パスはブロックされない");
  const wildcardDollarRules = parseRobotsTxt("User-agent: *\nDisallow: /*.php$\n");
  assertBlocked(wildcardDollarRules, "/file.php", true, "$+ワイルドカード: 拡張子完全一致");
  assertBlocked(wildcardDollarRules, "/file.php?id=1", false, "$+ワイルドカード: クエリ付きはブロックされない(Google仕様)");

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

  console.log("\n=== 5. sitemap.ts のURL一覧が本PRで変更されていないことの確認 ===");
  const guideSlugsMatch = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  const guideSlugCount = guideSlugsMatch ? [...guideSlugsMatch[1].matchAll(/"([a-z0-9-]+)"/g)].length : 0;
  if (guideSlugCount === EXPECTED_GUIDE_SLUG_COUNT) {
    ok(`GUIDE_SLUGSの件数が変更されていない (${guideSlugCount}件)`);
  } else {
    fail(`GUIDE_SLUGSの件数が想定外 (期待=${EXPECTED_GUIDE_SLUG_COUNT}, 実際=${guideSlugCount}) — sitemap.ts が本PRの範囲外で変更された可能性`);
  }
  for (const slug of EXPECTED_SAMPLE_SLUGS) {
    if (staticPaths.includes(`/guide/${slug}`)) {
      ok(`sitemap.ts に /guide/${slug} が引き続き存在する`);
    } else {
      fail(`sitemap.ts から /guide/${slug} が消えている`);
    }
  }

  if (failed) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log("\n=== 全チェック成功 ===");
  }
}

main();
