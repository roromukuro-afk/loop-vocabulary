/**
 * ガイドの静的フォルダルート(src/app/guide/<slug>/page.tsx)と、
 * 動的ルート(src/app/guide/[slug]/page.tsx)のgenerateStaticParams()が
 * 同一slugを重複して静的生成しようとしていないかを検証する
 * (2026-07-22 ルーティング競合修正の再発防止テスト)。
 *
 * 背景: 両方のルートが同じURLを静的生成しようとすると、ビルドのたびに
 * どちらの出力が実際に配信されるかが不安定になり、test:guide-aeo-blocksが
 * 断続的に失敗していた(eiken-2kyu-tango)。
 *
 * 使い方: node scripts/testing/e2e/guide-route-collision.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listStaticGuideFolderSlugs } from "../../../src/lib/guide/staticGuideFolderSlugs.ts";

const REPO_ROOT = process.cwd();
const GUIDE_DIR = join(REPO_ROOT, "src", "app", "guide");
const DYNAMIC_ROUTE_FILE = join(GUIDE_DIR, "[slug]", "page.tsx");

// 今回のPRで、動的ルート側の静的生成対象から除外したslug。
const FIXED_SLUGS = ["eiken-2kyu-tango"];

// 静的フォルダ・ARTICLES双方に存在することを確認済みだが、静的フォルダ側の
// 教材インポート導線(GuideMaterialCTA)欠落等の理由で、今回のPRでは意図的に
// 除外していないslug(オーナー判断待ちとしてPRで報告済み)。
const KNOWN_DEFERRED_COLLISIONS = [
  "business-english-tango",
  "chugaku-eigo-tango",
  "daigaku-juken-tango",
  "eiken-conversation",
  "eiken-jun1-tango",
  "ielts-tango",
  "toeic-tango",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

function extractArticlesKeys(source) {
  const match = source.match(/const ARTICLES: Record<string, Article> = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error("ARTICLESオブジェクトの境界を検出できなかった([slug]/page.tsxの構造が変わった可能性)");
  return [...match[1].matchAll(/^ {2}"([a-z0-9-]+)": \{/gm)].map((m) => m[1]);
}

function extractExcludedSlugs(source) {
  const match = source.match(/const DYNAMIC_ROUTE_EXCLUDED_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
  if (!match) throw new Error("DYNAMIC_ROUTE_EXCLUDED_SLUGSを検出できなかった([slug]/page.tsxの構造が変わった可能性)");
  return [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
}

async function main() {
  const source = readFileSync(DYNAMIC_ROUTE_FILE, "utf8");
  const articlesKeys = extractArticlesKeys(source);
  const excludedSlugs = extractExcludedSlugs(source);
  const staticFolderSlugs = new Set(listStaticGuideFolderSlugs(GUIDE_DIR));

  // generateStaticParams()が実際に返す(=静的生成しようとする)slug一覧
  const generatedSlugs = articlesKeys.filter((s) => !excludedSlugs.includes(s));

  // ---- 1. 修正対象slugが、実際に動的ルートの静的生成対象から除外されている ----
  for (const slug of FIXED_SLUGS) {
    if (!articlesKeys.includes(slug)) {
      fail(`${slug} がARTICLESに存在しない(前提が変わった可能性がある)`);
      continue;
    }
    if (!staticFolderSlugs.has(slug)) {
      fail(`${slug} の静的フォルダルートが見つからない (src/app/guide/${slug}/page.tsx)`);
      continue;
    }
    if (generatedSlugs.includes(slug)) {
      fail(`${slug} が動的ルートのgenerateStaticParams()からまだ除外されていない`);
    } else {
      ok(`${slug} は動的ルートの静的生成対象(generateStaticParams())から正しく除外されている`);
    }
  }

  // ---- 2. 既知の対応済み・保留中コリジョン以外に、新たな競合が発生していない ----
  const remainingCollisions = generatedSlugs.filter((s) => staticFolderSlugs.has(s));
  const unexpectedCollisions = remainingCollisions.filter((s) => !KNOWN_DEFERRED_COLLISIONS.includes(s));
  if (unexpectedCollisions.length === 0) {
    ok("既知の保留中コリジョン以外に、静的フォルダルートと動的ルートの新たな重複は検出されなかった");
  } else {
    fail(`未知の新規ルーティング競合を検出: ${unexpectedCollisions.join(", ")} (静的フォルダとARTICLES双方に存在し、除外済み・保留中いずれのリストにも含まれていない。generateStaticParams()から除外するか、意図的な保留として本テストのKNOWN_DEFERRED_COLLISIONSに追加してください)`);
  }

  // ---- 3. 既知の保留中コリジョンのリストが古くなっていない(ドリフト検知) ----
  for (const slug of KNOWN_DEFERRED_COLLISIONS) {
    const inArticles = articlesKeys.includes(slug);
    const inStaticFolder = staticFolderSlugs.has(slug);
    if (inArticles && inStaticFolder) {
      ok(`${slug}: 既知の保留中コリジョンとして現在も両方のルートに存在している(オーナー判断待ち、FAILではない)`);
    } else {
      fail(`${slug} はKNOWN_DEFERRED_COLLISIONSに記載されているが、実際の状態と一致しない (inArticles=${inArticles}, inStaticFolder=${inStaticFolder})。状況が変わった可能性があるため、本テストのリストを更新してください`);
    }
  }

  console.log(process.exitCode ? "\n=== test:guide-route-collision: FAILED ===" : "\n=== test:guide-route-collision RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("guide-route-collision test crashed:", e);
  process.exit(1);
});
