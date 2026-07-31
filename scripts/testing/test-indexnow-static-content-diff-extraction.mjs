/**
 * scripts/improvement/notify-indexnow-static-content-diff.mjs の
 * ソース抽出関数(extractStaticSitemapPaths/extractGuideSlugSet/extractGuideRedirects)の
 * 単体テスト(ネットワーク・git実行不要、合成した小さなソース文字列で検証)。
 *
 * この3関数は、sitemap.ts/next.config.jsの実際のソースパターン
 * (scripts/testing/e2e/robots-sitemap-collision.mjsで既に実績のある正規表現を再利用)
 * から静的コンテンツの公開URL・リダイレクトを抽出する、静的コンテンツ即時通知機構の
 * 心臓部。mainの実行(git show・IndexNow送信)はこのテストでは検証しない
 * (実コミットでの動作確認は開発時に別途実施済み: PR#43[新規無料ツール]・
 * 3c51fe7[既存ガイド記事のコンテンツ更新]・bb97cf8[辞書24→50語拡張]の3つの
 * 実際の過去コミットに対して実行し、期待どおりの検出結果を確認した)。
 *
 * 使い方: node scripts/testing/test-indexnow-static-content-diff-extraction.mjs
 */
import {
  extractStaticSitemapPaths,
  extractGuideSlugSet,
  extractGuideRedirects,
  extractDynamicGuideArticles,
  extractDynamicRouteExcludedSlugs,
  pageFilePathToUrl,
  toAbsoluteUrl,
  resolveAbsoluteUrls,
} from "../improvement/notify-indexnow-static-content-diff.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function assertSetEqual(actual, expected, msg) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) === JSON.stringify(e)) ok(msg);
  else fail(`${msg} (期待値=${JSON.stringify(e)}, 実際=${JSON.stringify(a)})`);
}

function main() {
  // --- extractStaticSitemapPaths ---
  {
    const src = `
const GUIDE_SLUGS = [
  "eiken-1kyu-tango",
  "toeic-tango",
] as const;

export default async function sitemap() {
  return [
    { url: \`\${base}\`, changeFrequency: "weekly", priority: 1.0 },
    { url: \`\${base}/about\`, changeFrequency: "monthly", priority: 0.6 },
    { url: \`\${base}/materials/\${m.id}\`, changeFrequency: "monthly" },
    ...GUIDE_SLUGS.map((slug) => ({ url: \`\${base}/guide/\${slug}\` })),
  ];
}`;
    const paths = extractStaticSitemapPaths(src);
    // ルートページ(`${base}`単独、末尾に`/xxx`が続かない行)は意図的に対象外
    // (常に存在し続けるため差分検出の対象になり得ず、含める必要が無い。
    // scripts/testing/e2e/robots-sitemap-collision.mjsの同名関数とは異なり、
    // このスクリプトは「差分」だけに関心があるためルートを特別扱いしない)。
    assertSetEqual(
      paths,
      ["/about", "/guide/eiken-1kyu-tango", "/guide/toeic-tango"],
      "リテラル${base}/xxx行 + GUIDE_SLUGS由来の/guide/<slug>を抽出し、動的補間(${m.id}等)を含む行・ルート単独行は除外する",
    );
  }
  {
    const paths = extractStaticSitemapPaths(null);
    assertSetEqual(paths, [], "ソースがnull(そのrefにファイルが存在しない)場合は空集合を返す");
  }

  // --- extractGuideSlugSet ---
  {
    const src = `const GUIDE_SLUGS = [\n  "a-slug",\n  "b-slug",\n] as const;\n`;
    assertSetEqual(extractGuideSlugSet(src), ["a-slug", "b-slug"], "GUIDE_SLUGS配列からslug集合を抽出する");
  }
  {
    assertSetEqual(extractGuideSlugSet("no guide slugs here"), [], "GUIDE_SLUGSが存在しないソースでは空集合を返す");
  }

  // --- extractGuideRedirects ---
  {
    const src = `
    const guideRedirects = [
      {
        source: "/guide/old-slug",
        destination: "/guide/new-slug",
        permanent: true,
      },
      {
        source: "/guide/another-old",
        destination: "/guide/another-new",
        permanent: true,
      },
    ];
`;
    const redirects = extractGuideRedirects(src);
    if (
      redirects.length === 2 &&
      redirects[0].source === "/guide/old-slug" && redirects[0].destination === "/guide/new-slug" &&
      redirects[1].source === "/guide/another-old" && redirects[1].destination === "/guide/another-new"
    ) {
      ok("guideRedirects配列から複数のsource/destinationペアを、正しい組み合わせのまま抽出する(他のエントリのdestinationと混同しない)");
    } else {
      fail(`guideRedirectsの抽出結果が想定外: ${JSON.stringify(redirects)}`);
    }
  }
  {
    const redirects = extractGuideRedirects("const guideRedirects = [];\n");
    if (redirects.length === 0) ok("guideRedirectsが空配列の場合は空配列を返す");
    else fail(`空配列のはずが${redirects.length}件検出された`);
  }
  {
    const redirects = extractGuideRedirects(null);
    if (redirects.length === 0) ok("ソースがnullの場合は空配列を返す");
    else fail("nullソースで例外を投げずに空配列を返すべき");
  }

  // --- extractDynamicGuideArticles ---
  {
    const src = `
const ARTICLES: Record<string, Article> = {
  "alpha-slug": {
    title: "Alpha",
    description: "desc",
    tag: "tag",
    published: "2024-01-01",
    content: \`
## 見出し
本文中に "},"のような文字列が含まれていても惑わされないこと。
\`,
    faq: [
      { q: "Q1", a: "A1" },
    ],
  },
  "beta-slug": {
    title: "Beta",
    description: "desc2",
    tag: "tag2",
    published: "2024-02-01",
    content: \`本文2\`,
  },

};
`;
    const articles = extractDynamicGuideArticles(src);
    if (
      articles.size === 2 &&
      articles.has("alpha-slug") &&
      articles.has("beta-slug") &&
      articles.get("alpha-slug").includes("Alpha") &&
      !articles.get("alpha-slug").includes("Beta") &&
      articles.get("beta-slug").includes("Beta") &&
      !articles.get("beta-slug").includes("Alpha")
    ) {
      ok("ARTICLESオブジェクトからslugごとの生ブロックを、本文中の紛らわしい文字列に惑わされず正しい境界で抽出する");
    } else {
      fail(`extractDynamicGuideArticlesの抽出結果が想定外: size=${articles.size}`);
    }
  }
  {
    const articles = extractDynamicGuideArticles(null);
    if (articles.size === 0) ok("ソースがnullの場合は空Mapを返す(extractDynamicGuideArticles)");
    else fail("nullソースで例外を投げずに空Mapを返すべき(extractDynamicGuideArticles)");
  }
  {
    const articles = extractDynamicGuideArticles("no ARTICLES object here");
    if (articles.size === 0) ok("ARTICLESオブジェクトが存在しないソースでは空Mapを返す");
    else fail("ARTICLES非存在ソースで空Mapを返すべき");
  }

  // --- extractDynamicRouteExcludedSlugs ---
  {
    const src = `const DYNAMIC_ROUTE_EXCLUDED_SLUGS = new Set(["chugaku-eigo-tango", "toeic-tango"]);\n`;
    assertSetEqual(
      extractDynamicRouteExcludedSlugs(src),
      ["chugaku-eigo-tango", "toeic-tango"],
      "DYNAMIC_ROUTE_EXCLUDED_SLUGSからslug集合を抽出する",
    );
  }
  {
    const slugs = extractDynamicRouteExcludedSlugs(null);
    if (slugs.size === 0) ok("ソースがnullの場合は空集合を返す(extractDynamicRouteExcludedSlugs)");
    else fail("nullソースで例外を投げずに空集合を返すべき(extractDynamicRouteExcludedSlugs)");
  }

  // --- pageFilePathToUrl ---
  {
    const cases = [
      ["src/app/about/page.tsx", "/about"],
      ["src/app/faq/page.tsx", "/faq"],
      ["src/app/exam-countdown-planner/page.tsx", "/exam-countdown-planner"],
      ["src/app/page.tsx", "/"],
      ["src/app/(marketing)/about/page.tsx", "/about"],
      ["src/app/(marketing)/(nested)/about/page.tsx", "/about"],
      ["src/app/vocab-check/eiken/page.tsx", "/vocab-check/eiken"],
      ["src/app/materials/[id]/page.tsx", null],
      ["src/app/guide/[slug]/page.tsx", null],
      ["src/app/wordbooks/[id]/csv-import/page.tsx", null],
      ["src/app/x/[...slug]/page.tsx", null],
      ["src/app/x/[[...slug]]/page.tsx", null],
      ["src/app/about/layout.tsx", null],
      ["src/app/about/AboutClient.tsx", null],
    ];
    for (const [input, expected] of cases) {
      const actual = pageFilePathToUrl(input);
      if (actual === expected) ok(`pageFilePathToUrl(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`);
      else fail(`pageFilePathToUrl(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, 期待値=${JSON.stringify(expected)}`);
    }
  }

  // --- toAbsoluteUrl ---
  {
    const base = "https://loop-vocabulary.app";
    const cases = [
      ["/guide/foo", base, "https://loop-vocabulary.app/guide/foo"],
      ["/", base, "https://loop-vocabulary.app/"],
      ["about", base, "https://loop-vocabulary.app/about", "先頭に/が無いpathも解決する"],
      ["/about", "https://loop-vocabulary.app/", "https://loop-vocabulary.app/about", "siteBase末尾に/があっても二重スラッシュにならない"],
      ["https://loop-vocabulary.app/guide/foo", base, "https://loop-vocabulary.app/guide/foo", "既に絶対URLの場合は二重連結しない"],
    ];
    for (const [input, siteBase, expected, label] of cases) {
      const actual = toAbsoluteUrl(input, siteBase);
      if (actual === expected) ok(label || `toAbsoluteUrl(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`);
      else fail(`toAbsoluteUrl(${JSON.stringify(input)}, ${JSON.stringify(siteBase)}) = ${JSON.stringify(actual)}, 期待値=${JSON.stringify(expected)}`);
    }
  }
  {
    const base = "https://loop-vocabulary.app";
    const rejectedCases = [
      ["https://evil.example.com/x", "外部originは拒否してnullを返す"],
      ["http://loop-vocabulary.app/x", "同じホストでもスキームが異なる場合は拒否する(hostのみでなくoriginの安全性を意識する)"],
      ["", "空文字列はnullを返す"],
      [null, "nullはnullを返す"],
      [undefined, "undefinedはnullを返す"],
    ];
    for (const [input, label] of rejectedCases) {
      const actual = toAbsoluteUrl(input, base);
      if (actual === null) ok(label);
      else fail(`${label}: 実際には${JSON.stringify(actual)}を返した`);
    }
  }
  {
    const base = "https://loop-vocabulary.app";
    const url = toAbsoluteUrl("/guide/foo", base);
    if (url && new URL(url).host === new URL(base).host) {
      ok("変換後URLのhostがsiteBaseのhostと一致する");
    } else {
      fail(`host不一致: url=${url}`);
    }
  }

  // --- resolveAbsoluteUrls ---
  {
    const base = "https://loop-vocabulary.app";
    const { absolute, rejected } = resolveAbsoluteUrls(["/guide/foo", "https://evil.example.com/x", "/about"], base);
    if (
      absolute.length === 2 &&
      absolute.includes("https://loop-vocabulary.app/guide/foo") &&
      absolute.includes("https://loop-vocabulary.app/about") &&
      rejected.length === 1 &&
      rejected[0] === "https://evil.example.com/x"
    ) {
      ok("resolveAbsoluteUrlsは正当なpathをabsoluteへ、外部origin等の不正な値をrejectedへ分類する");
    } else {
      fail(`resolveAbsoluteUrlsの分類結果が想定外: absolute=${JSON.stringify(absolute)}, rejected=${JSON.stringify(rejected)}`);
    }
  }

  console.log(failed ? `\n=== test:indexnow-static-content-diff-extraction: ${failed}件失敗 ===` : "\n=== test:indexnow-static-content-diff-extraction RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
