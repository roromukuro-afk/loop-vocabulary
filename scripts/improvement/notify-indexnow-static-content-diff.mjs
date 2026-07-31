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
 *   2. 既存ガイド記事(GUIDE_SLUGSに変更前後とも含まれるslug)のコンテンツ更新。
 *      2a. 専用ディレクトリ型(src/app/guide/<slug>/配下のファイル変更で検出)。
 *      2b. 動的ルート型(src/app/guide/[slug]/page.tsx内のARTICLESレコードをslug単位で
 *          before/after比較。ただし当該slugが専用ディレクトリを持つ、または
 *          DYNAMIC_ROUTE_EXCLUDED_SLUGSに含まれる場合は、実際に配信されるのは専用
 *          ディレクトリ側のためスキップする=2aの結果と二重に扱わない)。
 *   3. sitemapに掲載済みの非ガイド静的ページ(例: /about, /faq, /review-date-calculator)の
 *      src/app/**\/page.tsx変更(route group `(group)` は除去、dynamic segment
 *      `[x]`/`[...x]`/`[[...x]]` を含むファイルは対象外、ガイド配下は2で扱うため除外)。
 *      変更前後ともsitemapの静的パス集合に存在するURLのみをコンテンツ更新として扱う
 *      (新規・削除は1のexistence判定に任せる)。
 *   4. PILOT_WORDS(辞書語ページ)の isIndexEligible な語の追加・削除・内容更新。
 *   5. next.config.js の guideRedirects への新規追加(旧URL・新URLの両方を通知)。
 *
 * IndexNow APIへは相対パスではなく絶対URLを送信する(IndexNow仕様上、相対URLは無効)。
 * `NEXT_PUBLIC_SITE_URL`(既定 https://loop-vocabulary.app)を正規化した上で、検出した
 * すべてのroot-relative pathを絶対URLへ変換し、送信直前にhostが一致することを確認する
 * (toAbsoluteUrl参照)。ログでは検出用path(短く読みやすい)と実際に送信したabsolute URLを
 * 分けて出力する。
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
import { normalizeSiteUrl } from "../../src/lib/seo/siteUrl.ts";

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
 * src/app/guide/[slug]/page.tsx の `const ARTICLES: Record<string, Article> = {...}` から、
 * slugごとの生テキストブロックを抽出する(before/afterで文字列比較するだけの用途なので
 * パース結果はテキストのままでよい)。トップレベルのキー行は必ず`  "slug": {`
 * (半角スペース2つ)、閉じ行は必ず`  },`という、このファイル内で一貫したインデント規則
 * (BOOKS/ARTICLES双方で同一パターン)に従っているため、このシンプルな行走査で
 * 安全に切り出せる(scripts/testing/e2e/guide-route-collision.mjsのextractArticlesKeys()
 * が使っているのと同じ前提に基づく)。
 */
export function extractDynamicGuideArticles(pageSrc) {
  const articles = new Map();
  if (!pageSrc) return articles;
  const articlesMatch = pageSrc.match(/const ARTICLES: Record<string, Article> = \{([\s\S]*?)\n\};/);
  if (!articlesMatch) return articles;

  const lines = articlesMatch[1].split("\n");
  let currentSlug = null;
  let currentLines = [];
  for (const line of lines) {
    const keyMatch = /^ {2}"([a-z0-9-]+)": \{$/.exec(line);
    if (keyMatch) {
      currentSlug = keyMatch[1];
      currentLines = [line];
      continue;
    }
    if (currentSlug === null) continue;
    currentLines.push(line);
    if (line === "  },") {
      articles.set(currentSlug, currentLines.join("\n"));
      currentSlug = null;
      currentLines = [];
    }
  }
  return articles;
}

/**
 * src/app/guide/[slug]/page.tsx の `DYNAMIC_ROUTE_EXCLUDED_SLUGS` (専用ディレクトリ側と
 * ルーティングが衝突するため動的ルート側の静的生成対象から除外されているslug)を抽出する。
 * scripts/testing/e2e/guide-route-collision.mjs の extractExcludedSlugs() と同じロジック。
 */
export function extractDynamicRouteExcludedSlugs(pageSrc) {
  const slugs = new Set();
  if (!pageSrc) return slugs;
  const match = pageSrc.match(/const DYNAMIC_ROUTE_EXCLUDED_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
  if (!match) return slugs;
  for (const m of match[1].matchAll(/"([a-z0-9-]+)"/g)) {
    slugs.add(m[1]);
  }
  return slugs;
}

/**
 * 指定refのgit tree上で、専用ディレクトリ型ガイド(src/app/guide/<slug>/page.tsx)として
 * 実在するslugの集合を返す(`[slug]`自体は`[a-z0-9-]+`にマッチしないため自然に除外される)。
 * Next.js App Routerでは静的セグメント(専用ディレクトリ)が動的セグメント([slug])より
 * 常に優先されるため、たとえDYNAMIC_ROUTE_EXCLUDED_SLUGSへの登録が漏れていても、
 * 専用ディレクトリを持つslugのARTICLES内容は実際には配信されない。
 */
function listGuideDirectorySlugs(ref) {
  const slugs = new Set();
  let out = "";
  try {
    out = git(["ls-tree", "-r", "--name-only", ref, "--", "src/app/guide/"]);
  } catch {
    return slugs;
  }
  for (const line of out.split("\n")) {
    const m = line.match(/^src\/app\/guide\/([a-z0-9-]+)\/page\.tsx$/);
    if (m) slugs.add(m[1]);
  }
  return slugs;
}

/**
 * App Routerのファイルパス(例: "src/app/(marketing)/about/page.tsx")を公開URLへ変換する。
 * - route group `(xxx)` はURLから除去する。
 * - `src/app/page.tsx` は "/" になる。
 * - dynamic segment(`[slug]`・`[...slug]`・`[[...slug]]`等、角括弧を含むセグメント)を
 *   含むファイルは、この汎用変換の対象外としてnullを返す(専用ロジックが必要なため)。
 * - "src/app/.../page.tsx" 形式に一致しない入力はnullを返す。
 */
export function pageFilePathToUrl(filePath) {
  if (typeof filePath !== "string") return null;
  if (filePath === "src/app/page.tsx") return "/";
  const m = filePath.match(/^src\/app\/(.+)\/page\.tsx$/);
  if (!m) return null;
  const rawParts = m[1].split("/").filter(Boolean);
  const urlParts = [];
  for (const part of rawParts) {
    if (/^\(.+\)$/.test(part)) continue; // route group
    if (part.includes("[") || part.includes("]")) return null; // dynamic segment
    urlParts.push(part);
  }
  return urlParts.length === 0 ? "/" : `/${urlParts.join("/")}`;
}

/**
 * root-relative path(例: "/guide/foo")を、NEXT_PUBLIC_SITE_URLベースの絶対URLへ変換する。
 * IndexNow APIは相対URLを受け付けないため、送信直前に必ずこの変換を通す。
 *
 * - 既に絶対URL(http/https)の場合は二重連結せずそのまま検証だけ行う。
 * - 先頭に`/`が無いpathは補って解決する。
 * - 変換後のURLのorigin(スキーム+host)がsiteBaseのoriginと一致しない場合
 *   (外部origin混入・スキーム違い・不正なURL)はnullを返す。
 */
export function toAbsoluteUrl(path, siteBase) {
  if (typeof path !== "string" || path.length === 0) return null;
  let baseOrigin;
  try {
    baseOrigin = new URL(siteBase).origin;
  } catch {
    return null;
  }
  let url;
  try {
    if (/^https?:\/\//i.test(path)) {
      url = new URL(path);
    } else {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      url = new URL(normalizedPath, siteBase);
    }
  } catch {
    return null;
  }
  if (url.origin !== baseOrigin) return null;
  return url.toString();
}

/** paths(root-relative)を絶対URLへ変換し、変換できなかったものは分けて返す。 */
export function resolveAbsoluteUrls(paths, siteBase) {
  const absolute = [];
  const rejected = [];
  for (const p of paths) {
    const u = toAbsoluteUrl(p, siteBase);
    if (u) absolute.push(u);
    else rejected.push(p);
  }
  return { absolute, rejected };
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

/**
 * before..after間の変更を検出し、通知対象のroot-relative pathを
 * { existencePaths(bypassDedupe送信対象), contentPaths(通常デデュープ送信対象) } として返す。
 * IndexNow送信(submitUrlsToIndexNow呼び出し)自体は行わない、副作用のない差分計算のみの関数
 * (main()から分離しているのはテストで実際の送信を発生させずに検証するため)。
 */
export async function computeChangedPaths(before, after) {
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

  // 2a. 既存ガイド記事(専用ディレクトリ型、前後ともGUIDE_SLUGSに存在)のコンテンツ更新
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
  const touchedDedicatedSlugs = new Set();
  for (const f of changedGuideFiles) {
    const m = f.match(/^src\/app\/guide\/([a-z0-9-]+)\//);
    if (m && m[1] !== "[slug]") touchedDedicatedSlugs.add(m[1]);
  }
  for (const slug of touchedDedicatedSlugs) {
    const url = `/guide/${slug}`;
    // 前後ともGUIDE_SLUGSに存在する(=新規追加でも削除でもない、純粋な内容更新)場合のみ。
    // 新規追加・削除は上のexistenceChangeUrlsで既にカバー済みのため二重に扱わない。
    if (guideSlugsBefore.has(slug) && guideSlugsAfter.has(slug) && !existenceChangeUrls.has(url)) {
      contentUpdateUrls.add(url);
    }
  }
  console.log(`ガイド記事(専用ディレクトリ)コンテンツ更新: ${touchedDedicatedSlugs.size}件検出`);

  // 2b. 既存ガイド記事(動的[slug]ルート型)のコンテンツ更新
  const dynamicPageBefore = showFileAt(before, "src/app/guide/[slug]/page.tsx");
  const dynamicPageAfter = showFileAt(after, "src/app/guide/[slug]/page.tsx");
  const articlesBefore = extractDynamicGuideArticles(dynamicPageBefore);
  const articlesAfter = extractDynamicGuideArticles(dynamicPageAfter);
  const excludedAfter = extractDynamicRouteExcludedSlugs(dynamicPageAfter);
  const dirSlugsAfter = listGuideDirectorySlugs(after);
  let dynamicContentCount = 0;
  for (const [slug, block] of articlesAfter) {
    // 専用ディレクトリを持つ、またはDYNAMIC_ROUTE_EXCLUDED_SLUGSに登録済みのslugは、
    // 実際には専用ディレクトリ側が配信される(Next.jsのルーティング優先順位)ため、
    // ARTICLES側の内容変化を「実際に公開されている内容の変化」として扱わない。
    if (excludedAfter.has(slug) || dirSlugsAfter.has(slug)) continue;
    const url = `/guide/${slug}`;
    if (existenceChangeUrls.has(url)) continue; // 新規・削除は上のexistence判定に任せる
    const beforeBlock = articlesBefore.get(slug);
    if (beforeBlock !== undefined && beforeBlock !== block) {
      contentUpdateUrls.add(url);
      dynamicContentCount++;
    }
  }
  console.log(`ガイド記事(動的[slug]ルート)コンテンツ更新: ${dynamicContentCount}件検出`);

  // 3. 非ガイド静的ページ(sitemap掲載済み)のsrc/app/**/page.tsx内容更新
  let changedPageFiles = [];
  try {
    changedPageFiles = git(["diff", "--name-only", before, after, "--", "src/app/"])
      .split("\n")
      .filter((f) => f.endsWith("page.tsx"))
      // ガイド配下(専用ディレクトリ・動的[slug]とも)は2a/2bで扱うためここでは対象外。
      // src/app/guide/page.tsx(ガイド一覧のトップページ自体)は対象外にしない。
      .filter((f) => !/^src\/app\/guide\/[^/]+\//.test(f));
  } catch {
    changedPageFiles = [];
  }
  let staticPageContentCount = 0;
  for (const f of changedPageFiles) {
    const url = pageFilePathToUrl(f);
    if (!url) continue; // dynamic segmentを含む等、汎用変換の対象外
    if (existenceChangeUrls.has(url)) continue;
    // ルート("/")は常に存在し続けるため、sitemapの静的パス集合(意図的にルートを含まない)
    // には現れない。ルートだけは常時「sitemap掲載済み」として扱ってよい。
    const isSitemapEligible = url === "/" ? true : pathsBefore.has(url) && pathsAfter.has(url);
    if (isSitemapEligible) {
      contentUpdateUrls.add(url);
      staticPageContentCount++;
    }
  }
  console.log(`非ガイド静的ページのコンテンツ更新: ${staticPageContentCount}件検出`);

  // 4. PILOT_WORDS(辞書語ページ)の追加・削除・内容更新
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

  // 5. guideRedirectsへの新規追加(旧URL・新URLの両方を通知)
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

  return {
    existencePaths: [...existenceChangeUrls],
    contentPaths: [...contentUpdateUrls],
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const after = opts.after || "HEAD";
  const before = opts.before || git(["rev-parse", `${after}^`]).trim();
  console.log(`--- IndexNow静的コンテンツ差分検出: ${before}..${after} ---`);

  const { existencePaths, contentPaths } = await computeChangedPaths(before, after);

  console.log(`\n=== 検出結果(path) ===`);
  console.log(`可視性変化(公開/削除、bypassDedupe): ${existencePaths.length}件`, existencePaths);
  console.log(`内容更新(通常デデュープ): ${contentPaths.length}件`, contentPaths);

  if (existencePaths.length === 0 && contentPaths.length === 0) {
    console.log("\n通知対象のURLなし。終了。");
    return;
  }

  const siteBase = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

  if (existencePaths.length > 0) {
    const { absolute, rejected } = resolveAbsoluteUrls(existencePaths, siteBase);
    if (rejected.length > 0) {
      console.error(`[indexnow-static-diff] 可視性変化: 絶対URLへ変換できないpathを除外: ${JSON.stringify(rejected)}`);
    }
    console.log(`可視性変化 送信absolute URL: ${absolute.length}件`, absolute);
    if (absolute.length > 0) {
      const result = await submitUrlsToIndexNow(absolute, { bypassDedupe: true });
      console.log(`可視性変化の送信結果: ${JSON.stringify(result)}`);
    }
  }
  if (contentPaths.length > 0) {
    const { absolute, rejected } = resolveAbsoluteUrls(contentPaths, siteBase);
    if (rejected.length > 0) {
      console.error(`[indexnow-static-diff] 内容更新: 絶対URLへ変換できないpathを除外: ${JSON.stringify(rejected)}`);
    }
    console.log(`内容更新 送信absolute URL: ${absolute.length}件`, absolute);
    if (absolute.length > 0) {
      const result = await submitUrlsToIndexNow(absolute);
      console.log(`内容更新の送信結果: ${JSON.stringify(result)}`);
    }
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
