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

  console.log(failed ? `\n=== test:indexnow-static-content-diff-extraction: ${failed}件失敗 ===` : "\n=== test:indexnow-static-content-diff-extraction RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
