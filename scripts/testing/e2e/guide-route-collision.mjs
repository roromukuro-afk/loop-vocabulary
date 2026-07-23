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
 * 単純な文字列検索(「DYNAMIC_ROUTE_EXCLUDED_SLUGSという名前がファイル内に
 * ある」等)だけでは、Setを宣言しただけでgenerateStaticParams()側の
 * .filter()が将来削除されてもPASSしてしまう。そのため、
 * generateStaticParams()の関数本体を抽出し、実際にそのSetを参照した
 * .filter()を.map()より前に適用しているかを構造的に検証する。
 *
 * 使い方: node scripts/testing/e2e/guide-route-collision.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listStaticGuideFolderSlugs } from "../lib/staticGuideFolderSlugs.mjs";

const REPO_ROOT = process.cwd();
const GUIDE_DIR = join(REPO_ROOT, "src", "app", "guide");
const DYNAMIC_ROUTE_FILE = join(GUIDE_DIR, "[slug]", "page.tsx");

// これまでのPRで、動的ルート側の静的生成対象から除外したslug。
const FIXED_SLUGS = ["eiken-2kyu-tango", "chugaku-eigo-tango", "daigaku-juken-tango", "business-english-tango"];

// 静的フォルダ・ARTICLES双方に存在することを確認済みだが、静的フォルダ側の
// 教材インポート導線(GuideMaterialCTA)欠落等の理由で、今回のPRでは意図的に
// 除外していないslug(オーナー判断待ちとしてPRで報告済み)。
const KNOWN_DEFERRED_COLLISIONS = [
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

// generateStaticParams()の関数本体だけを抽出する(ファイル全体ではなく、
// この関数が実際に何をしているかを構造的に検証するため)。
function extractGenerateStaticParamsBody(source) {
  const match = source.match(/export async function generateStaticParams\(\) \{([\s\S]*?)\n\}/);
  if (!match) throw new Error("generateStaticParams()を検出できなかった([slug]/page.tsxの構造が変わった可能性)");
  return match[1];
}

async function main() {
  const source = readFileSync(DYNAMIC_ROUTE_FILE, "utf8");
  const articlesKeys = extractArticlesKeys(source);
  const excludedSlugs = extractExcludedSlugs(source);
  const staticFolderSlugs = new Set(listStaticGuideFolderSlugs(GUIDE_DIR));
  const gspBody = extractGenerateStaticParamsBody(source);

  // generateStaticParams()が実際に返す(=静的生成しようとする)slug一覧。
  // (この行はDYNAMIC_ROUTE_EXCLUDED_SLUGSの中身をJS側で再計算しているだけで、
  //  generateStaticParams()の実装が本当にそのSetを使っているかは検証しない。
  //  その検証は次のセクションで、関数本体を直接調べて行う)
  const generatedSlugs = articlesKeys.filter((s) => !excludedSlugs.includes(s));

  // ---- 0. generateStaticParams()が、DYNAMIC_ROUTE_EXCLUDED_SLUGSを実際に
  //         参照するfilterをmapより前に適用していることを、関数本体から
  //         直接検証する(Setを宣言しただけで未使用のケースを検出するため) ----
  const referencesExcludedSet = gspBody.includes("DYNAMIC_ROUTE_EXCLUDED_SLUGS");
  const hasFilterUsingSet = /\.filter\(\s*\([^)]*\)\s*=>[^;]*DYNAMIC_ROUTE_EXCLUDED_SLUGS\.has\(/.test(gspBody);
  const filterIndex = gspBody.indexOf(".filter(");
  const mapIndex = gspBody.indexOf(".map(");
  const filterAppliedBeforeMap = filterIndex !== -1 && mapIndex !== -1 && filterIndex < mapIndex;
  if (referencesExcludedSet && hasFilterUsingSet && filterAppliedBeforeMap) {
    ok("generateStaticParams()がDYNAMIC_ROUTE_EXCLUDED_SLUGS.has()を使うfilterを、mapより前に実際に適用していることを確認");
  } else {
    fail(
      `generateStaticParams()の実装がDYNAMIC_ROUTE_EXCLUDED_SLUGSを実際に使用していない可能性がある ` +
        `(Setを宣言しただけで未使用のケースを検出): referencesSet=${referencesExcludedSet}, ` +
        `filterはSet.has()を呼んでいるか=${hasFilterUsingSet}, filterはmapより前か=${filterAppliedBeforeMap}`
    );
  }

  // ---- 1. 修正対象slugが、DYNAMIC_ROUTE_EXCLUDED_SLUGSに明示的に登録され、
  //         実際に動的ルートの静的生成対象から除外されている ----
  for (const slug of FIXED_SLUGS) {
    if (!articlesKeys.includes(slug)) {
      fail(`${slug} がARTICLESに存在しない(前提が変わった可能性がある)`);
      continue;
    }
    if (!staticFolderSlugs.has(slug)) {
      fail(`${slug} の静的フォルダルートが見つからない (src/app/guide/${slug}/page.tsx)`);
      continue;
    }
    if (!excludedSlugs.includes(slug)) {
      fail(`${slug} がDYNAMIC_ROUTE_EXCLUDED_SLUGSに明示的に登録されていない`);
      continue;
    }
    if (generatedSlugs.includes(slug)) {
      fail(`${slug} が動的ルートのgenerateStaticParams()からまだ除外されていない`);
    } else {
      ok(`${slug} はDYNAMIC_ROUTE_EXCLUDED_SLUGSに登録され、動的ルートの静的生成対象(generateStaticParams())から正しく除外されている`);
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
  // 「保留中の実際のcollision」と判定する条件は次の4つすべてを満たす場合のみ:
  //   (a) ARTICLESに存在する
  //   (b) 静的フォルダが存在する
  //   (c) DYNAMIC_ROUTE_EXCLUDED_SLUGSに入っていない(まだ除外されていない)
  //   (d) generatedSlugsに残っている(=今も実際に動的ルートで静的生成されている)
  // 将来いずれかのslugがDYNAMIC_ROUTE_EXCLUDED_SLUGSへ追加され競合が解消された
  // 場合は、このリストが古くなったことを示すためあえてFAILさせ、
  // KNOWN_DEFERRED_COLLISIONSから削除してFIXED_SLUGS(または対応済み管理)へ
  // 移すよう促す。
  for (const slug of KNOWN_DEFERRED_COLLISIONS) {
    const inArticles = articlesKeys.includes(slug);
    const inStaticFolder = staticFolderSlugs.has(slug);
    const inExcludedSet = excludedSlugs.includes(slug);
    const stillGenerated = generatedSlugs.includes(slug);

    if (inArticles && inStaticFolder && !inExcludedSet && stillGenerated) {
      ok(`${slug}: 既知の保留中コリジョンとして現在も両方のルートに存在し、まだ除外されていない(オーナー判断待ち、FAILではない)`);
    } else if (inArticles && inStaticFolder && inExcludedSet && !stillGenerated) {
      fail(
        `${slug} はKNOWN_DEFERRED_COLLISIONSに記載されているが、DYNAMIC_ROUTE_EXCLUDED_SLUGSへ追加され競合が` +
          `既に解消されている。KNOWN_DEFERRED_COLLISIONSから削除し、FIXED_SLUGS(または対応済み管理)へ移してください`
      );
    } else {
      fail(
        `${slug} はKNOWN_DEFERRED_COLLISIONSに記載されているが、実際の状態と一致しない ` +
          `(inArticles=${inArticles}, inStaticFolder=${inStaticFolder}, inExcludedSet=${inExcludedSet}, stillGenerated=${stillGenerated})。` +
          `状況が変わった可能性があるため、本テストのリストを更新してください`
      );
    }
  }

  console.log(process.exitCode ? "\n=== test:guide-route-collision: FAILED ===" : "\n=== test:guide-route-collision RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error("guide-route-collision test crashed:", e);
  process.exit(1);
});
