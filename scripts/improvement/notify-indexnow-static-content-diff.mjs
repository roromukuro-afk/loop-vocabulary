/**
 * 静的コンテンツ(ガイド記事・辞書語ページ・無料ツール等の静的ページ・リダイレクト)の
 * ページ個別IndexNow即時通知。
 *
 * 教材(materials)と異なり、これらは`GUIDE_SLUGS`/`PILOT_WORDS`/`guideRedirects`のような
 * 静的な配列・設定でsrc/app/sitemap.ts・src/lib/dictionaryWords/pilotWords.ts・
 * next.config.jsに定義されており、git commit + Vercelビルドによってのみ「公開/更新」
 * される。つまり実行時の書き込みイベント自体が存在しないため、教材のような
 * サーバールートへのフック方式は使えない。代わりに、mainへのpush(2つのgit ref間)を
 * 「公開/更新イベント」とみなし、変更前後のコミットで実際に生成される公開URL集合を
 * 比較することで、変更のあったURLだけを検出してIndexNowへ通知する。
 *
 * 検出対象:
 *   1. sitemap.ts のリテラル静的パス(`${base}/xxx`の完全リテラル行)+ GUIDE_SLUGS由来の
 *      /guide/<slug> の追加・削除(無料ツール・その他の静的ページも同じ機構でカバーされる。
 *      個別のカテゴリ分けはせず「新しく現れた/消えたURL」として一律に扱う)。
 *   2. 既存ガイド記事(GUIDE_SLUGSに変更前後とも含まれるslug)のコンテンツ更新
 *      (src/app/guide/<slug>/配下のファイル変更で検出)。
 *   3. PILOT_WORDS(辞書語ページ)の isIndexEligible な語の追加・削除・内容更新。
 *   4. next.config.js の guideRedirects への新規追加(旧URL・新URLの両方を通知)。
 *
 * 意図的に対象外(別ラウンドのスコープ、AI_SEARCH_AND_INDEXNOW_POLICY.md参照):
 *   - src/lib/grammar/lessons.ts(LESSONS、文法レッスン): 今回の指示範囲に含まれて
 *     いないため対象外。PILOT_WORDSと同型の構造(自己完結・importなし)のため、
 *     必要になれば同じ手法で低コストに追加できる。
 *
 * 使い方: node scripts/improvement/notify-indexnow-static-content-diff.mjs --before <SHA> --after <SHA>
 * (--beforeを省略した場合はafterの親コミットを使う)
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { submitUrlsToIndexNow } from "../../src/lib/indexnow/submit.ts";

function parseArgs(argv) {
  const opts = {};
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)=(.*)$/) || (a.startsWith("--") ? [null, a.slice(2)] : null);
    if (!m) continue;
    const idx = argv.indexOf(a);
    if (a.includes("=")) opts[m[1]] = m[2];
    else opts[m[1]] = argv[idx + 1];
  }
  return opts;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function showFileAt(ref, path) {
  try {
    return git(["show", `${ref}:${path}`]);
  } catch {
    return null; // そのrefにファイルが存在しない(新規追加/削除されたファイル)
  }
}

/**
 * sitemap.ts のソースから、DB/外部import非依存の静的パスだけを抽出する。
 * scripts/testing/e2e/robots-sitemap-collision.mjs の extractStaticSitemapPaths()
 * と同じロジック(実績のある既存パターンを再利用)。
 */
export function extractStaticSitemapPaths(sitemapSrc) {
  const paths = new Set();
  if (!sitemapSrc) return paths;

  const literalRe = /\$\{base\}(\/[a-zA-Z0-9\-/]*)`/g;
  for (const m of sitemapSrc.matchAll(literalRe)) {
    paths.add(m[1]);
  }

  const guideSlugsMatch = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  if (guideSlugsMatch) {
    for (const m of guideSlugsMatch[1].matchAll(/"([a-z0-9-]+)"/g)) {
      paths.add(`/guide/${m[1]}`);
    }
  }
  return paths;
}

export function extractGuideSlugSet(sitemapSrc) {
  const slugs = new Set();
  if (!sitemapSrc) return slugs;
  const guideSlugsMatch = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  if (guideSlugsMatch) {
    for (const m of guideSlugsMatch[1].matchAll(/"([a-z0-9-]+)"/g)) {
      slugs.add(m[1]);
    }
  }
  return slugs;
}

/** next.config.js の guideRedirects 配列から {source, destination} のペアを抽出する。 */
export function extractGuideRedirects(configSrc) {
  const redirects = [];
  if (!configSrc) return redirects;
  const blockMatch = configSrc.match(/const guideRedirects = (\[[\s\S]*?\]);/);
  if (!blockMatch) return redirects;
  const pairRe = /source:\s*"([^"]+)",\s*destination:\s*"([^"]+)"/g;
  for (const m of blockMatch[1].matchAll(pairRe)) {
    redirects.push({ source: m[1], destination: m[2] });
  }
  return redirects;
}

/**
 * PILOT_WORDSはimportが一切ない自己完結モジュールのため、指定refの内容をそのまま
 * 一時ファイルへ書き出してdynamic importすれば、そのref時点での実際の
 * isIndexEligible判定結果(defineWord()による自動算出)をそのまま取得できる
 * (正規表現でのテキスト抽出では、この計算結果を再現できない)。
 */
async function loadPilotWordsAt(ref, scratchDir, label) {
  const src = showFileAt(ref, "src/lib/dictionaryWords/pilotWords.ts");
  if (!src) return new Map();
  const tmpPath = join(scratchDir, `pilotWords.${label}.ts`);
  writeFileSync(tmpPath, src, "utf8");
  const mod = await import(pathToFileURL(tmpPath).href);
  const map = new Map();
  for (const w of mod.PILOT_WORDS ?? []) {
    if (w.isIndexEligible) map.set(w.slug, w);
  }
  return map;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const after = opts.after || "HEAD";
  const before = opts.before || git(["rev-parse", `${after}^`]).trim();
  console.log(`--- IndexNow静的コンテンツ差分検出: ${before}..${after} ---`);

  const existenceChangeUrls = new Set(); // bypassDedupe:true(公開/削除)
  const contentUpdateUrls = new Set(); // 通常デデュープ(内容更新)

  // 1. sitemap.tsのリテラル静的パス(GUIDE_SLUGS由来の/guide/<slug>含む)の追加・削除
  const sitemapBefore = showFileAt(before, "src/app/sitemap.ts");
  const sitemapAfter = showFileAt(after, "src/app/sitemap.ts");
  const pathsBefore = extractStaticSitemapPaths(sitemapBefore);
  const pathsAfter = extractStaticSitemapPaths(sitemapAfter);
  for (const p of pathsAfter) if (!pathsBefore.has(p)) existenceChangeUrls.add(p);
  for (const p of pathsBefore) if (!pathsAfter.has(p)) existenceChangeUrls.add(p);
  console.log(`sitemap静的パス: before=${pathsBefore.size}件, after=${pathsAfter.size}件`);

  // 2. 既存ガイド記事(前後ともGUIDE_SLUGSに存在)のコンテンツ更新
  const guideSlugsAfter = extractGuideSlugSet(sitemapAfter);
  const guideSlugsBefore = extractGuideSlugSet(sitemapBefore);
  let changedGuideFiles = [];
  try {
    changedGuideFiles = git(["diff", "--name-only", before, after, "--", "src/app/guide/"])
      .split("\n")
      .filter(Boolean);
  } catch {
    changedGuideFiles = [];
  }
  const touchedSlugs = new Set();
  for (const f of changedGuideFiles) {
    const m = f.match(/^src\/app\/guide\/([a-z0-9-]+)\//);
    if (m) touchedSlugs.add(m[1]);
  }
  for (const slug of touchedSlugs) {
    const url = `/guide/${slug}`;
    // 前後ともGUIDE_SLUGSに存在する(=新規追加でも削除でもない、純粋な内容更新)場合のみ。
    // 新規追加・削除は上のexistenceChangeUrlsで既にカバー済みのため二重に扱わない。
    if (guideSlugsBefore.has(slug) && guideSlugsAfter.has(slug) && !existenceChangeUrls.has(url)) {
      contentUpdateUrls.add(url);
    }
  }
  console.log(`ガイド記事コンテンツ更新(既存slugのファイル変更): ${touchedSlugs.size}件検出、うち${contentUpdateUrls.size}件が対象`);

  // 3. PILOT_WORDS(辞書語ページ)の追加・削除・内容更新
  const scratchDir = mkdtempSync(join(tmpdir(), "indexnow-static-diff-"));
  try {
    const wordsBefore = await loadPilotWordsAt(before, scratchDir, "before");
    const wordsAfter = await loadPilotWordsAt(after, scratchDir, "after");
    for (const [slug, word] of wordsAfter) {
      const url = `/dictionary/${slug}`;
      if (!wordsBefore.has(slug)) {
        existenceChangeUrls.add(url); // 新規追加(isIndexEligibleになった)
      } else if (JSON.stringify(wordsBefore.get(slug)) !== JSON.stringify(word)) {
        contentUpdateUrls.add(url); // 内容更新
      }
    }
    for (const [slug] of wordsBefore) {
      if (!wordsAfter.has(slug)) existenceChangeUrls.add(`/dictionary/${slug}`); // 削除(非公開化含む)
    }
    console.log(`辞書語ページ: before=${wordsBefore.size}件公開, after=${wordsAfter.size}件公開`);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }

  // 4. guideRedirectsへの新規追加(旧URL・新URLの両方を通知)
  const configBefore = showFileAt(before, "next.config.js");
  const configAfter = showFileAt(after, "next.config.js");
  const redirectsBefore = new Set(extractGuideRedirects(configBefore).map((r) => `${r.source}=>${r.destination}`));
  const redirectsAfter = extractGuideRedirects(configAfter);
  for (const r of redirectsAfter) {
    if (!redirectsBefore.has(`${r.source}=>${r.destination}`)) {
      existenceChangeUrls.add(r.source);
      existenceChangeUrls.add(r.destination);
    }
  }
  console.log(`guideRedirects: after=${redirectsAfter.length}件`);

  // contentUpdateUrlsとexistenceChangeUrlsが重複する場合はexistence側を優先(既に処理済み)
  for (const u of existenceChangeUrls) contentUpdateUrls.delete(u);

  console.log(`\n=== 検出結果 ===`);
  console.log(`可視性変化(公開/削除、bypassDedupe): ${existenceChangeUrls.size}件`, [...existenceChangeUrls]);
  console.log(`内容更新(通常デデュープ): ${contentUpdateUrls.size}件`, [...contentUpdateUrls]);

  if (existenceChangeUrls.size === 0 && contentUpdateUrls.size === 0) {
    console.log("\n通知対象のURLなし。終了。");
    return;
  }

  if (existenceChangeUrls.size > 0) {
    const result = await submitUrlsToIndexNow([...existenceChangeUrls], { bypassDedupe: true });
    console.log(`可視性変化の送信結果: ${JSON.stringify(result)}`);
  }
  if (contentUpdateUrls.size > 0) {
    const result = await submitUrlsToIndexNow([...contentUpdateUrls]);
    console.log(`内容更新の送信結果: ${JSON.stringify(result)}`);
  }
}

// テストから抽出関数だけをimportした際にmain()が意図せず実行される(git実行を伴う)のを
// 防ぐため、このファイルが直接実行された場合(node scripts/improvement/...)のみ起動する。
const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    // best-effort: このスクリプト自体の失敗が(post-deployの)ワークフローを
    // 致命的に見せることはあっても、本番のデプロイ・DB書き込みには一切影響しない。
    console.error("indexnow-static-content-diff crashed:", e);
    process.exit(1);
  });
}
