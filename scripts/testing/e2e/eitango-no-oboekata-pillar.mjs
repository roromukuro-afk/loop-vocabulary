/**
 * 「英単語の覚え方」ハブ/ピラーページ(/guide/eitango-no-oboekata)と、
 * サイト全体に新規追加した視覚的パンくずUI(Breadcrumb)の検証。
 *
 * 背景: これまでBreadcrumbList構造化データ(JSON-LD)はguide/materials/dictionary/tools等
 * 広く出力されていたが、対応する視覚的なパンくずUIがサイト全体に一つも存在しなかった
 * (GROWTH_SEO_MASTER_CHECKLIST.md P-02)。本テストは、新設したBreadcrumbコンポーネントの
 * 表示内容が、各ページが既に出力しているBreadcrumbList JSON-LDと一致していることを、
 * 「スキーマだけ・UIだけ」ではなく両方揃って一致している状態として検証する。
 *
 * 1. ピラーページが200を返し、canonical が設定され、noindexになっていない
 * 2. ピラーページ・ガイド一覧(/guide)の両方で、視覚的なパンくずnav(aria-label="breadcrumb")
 *    が正しいラベルで表示される
 * 3. ピラーページ内でリンクしているクラスタ記事URLがすべて実在する（404にならない）
 * 4. ピラーページのBreadcrumbList JSON-LDのitemListElement(name)と、
 *    可視パンくずのラベル・順序が完全一致する
 * 5. ガイド一覧(/guide)の「記憶法・忘却曲線（SRS）」カテゴリに、ピラーページへの
 *    リンクが表示されている
 *
 * 使い方: node scripts/testing/e2e/eitango-no-oboekata-pillar.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const PILLAR_PATH = "/guide/eitango-no-oboekata";

const CLUSTER_ARTICLE_SLUGS = [
  "eitango-oboeru-houhou",
  "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice",
  "eitango-oboerarenai",
  "eitango-ichinichi-nanko",
];

function fail(msg) {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

// <nav aria-label="breadcrumb">...</nav> の可視テキストラベルを、出現順の配列で返す。
// <li>...</li> ごとに1ラベルとして抽出する(区切りの "/" 等は無視)。
function extractVisibleBreadcrumbLabels(html) {
  const navMatch = html.match(/<nav aria-label="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return null;
  const navHtml = navMatch[1];
  const liMatches = [...navHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
  return liMatches.map((li) => {
    const text = li[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    // 区切り文字「/」だけの行は先頭に混ざらないよう除去(li内は "/ label" の場合がある)
    return text.replace(/^\/\s*/, "").trim();
  });
}

// 全<script type="application/ld+json">のうち、"@type":"BreadcrumbList" を含むものの
// itemListElementから name を出現順に抽出する。
function extractBreadcrumbLdNames(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  for (const s of scripts) {
    let json;
    try {
      json = JSON.parse(s[1]);
    } catch {
      continue;
    }
    if (json && json["@type"] === "BreadcrumbList" && Array.isArray(json.itemListElement)) {
      return json.itemListElement
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((it) => it.name);
    }
  }
  return null;
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  try {
    // ---- 1. ピラーページ: 200 / canonical / noindexでない ----
    const res = await fetch(`${baseUrl}${PILLAR_PATH}`);
    if (res.status !== 200) {
      fail(`${PILLAR_PATH} が200を返さない (${res.status})`);
      return;
    }
    ok(`${PILLAR_PATH} が200を返す`);
    const html = await res.text();

    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (canonicalMatch && canonicalMatch[1] === `${SITE_URL}${PILLAR_PATH}`) {
      ok(`canonicalが自己参照 (${canonicalMatch[1]})`);
    } else {
      fail(`canonicalが期待値と一致しない (実際: ${canonicalMatch?.[1] ?? "見つからない"})`);
    }

    if (/name="robots" content="[^"]*noindex/.test(html)) {
      fail(`${PILLAR_PATH} がnoindexになっている`);
    } else {
      ok(`${PILLAR_PATH} はnoindexになっていない`);
    }

    // ---- 2. 可視パンくずnav: ピラーページ ----
    const pillarLabels = extractVisibleBreadcrumbLabels(html);
    const expectedPillarLabels = ["ホーム", "学習ガイド", "英単語の覚え方"];
    if (arraysEqual(pillarLabels, expectedPillarLabels)) {
      ok(`ピラーページの可視パンくずが正しい (${pillarLabels?.join(" > ")})`);
    } else {
      fail(`ピラーページの可視パンくずが想定と異なる (実際: ${JSON.stringify(pillarLabels)})`);
    }

    // ---- 2b. 可視パンくずnav: ガイド一覧(/guide) ----
    const guideRes = await fetch(`${baseUrl}/guide`);
    if (guideRes.status !== 200) {
      fail(`/guide が200を返さない (${guideRes.status})`);
    } else {
      const guideHtml = await guideRes.text();
      const guideLabels = extractVisibleBreadcrumbLabels(guideHtml);
      const expectedGuideLabels = ["ホーム", "学習ガイド"];
      if (arraysEqual(guideLabels, expectedGuideLabels)) {
        ok(`/guide の可視パンくずが正しい (${guideLabels?.join(" > ")})`);
      } else {
        fail(`/guide の可視パンくずが想定と異なる (実際: ${JSON.stringify(guideLabels)})`);
      }

      // ---- 5. /guide の「記憶法・忘却曲線（SRS）」カテゴリにピラーへのリンクがある ----
      if (guideHtml.includes('data-testid="guide-category-pillar-link"') && guideHtml.includes(`href="${PILLAR_PATH}"`)) {
        ok(`/guide にピラーページへのカテゴリリンクが表示されている`);
      } else {
        fail(`/guide にピラーページへのカテゴリリンク(data-testid="guide-category-pillar-link")が見つからない`);
      }
    }

    // ---- 3. クラスタ記事リンクがすべて実在する(404にならない) ----
    for (const slug of CLUSTER_ARTICLE_SLUGS) {
      const href = `/guide/${slug}`;
      if (!html.includes(`href="${href}"`)) {
        fail(`ピラーページ内に ${href} へのリンクが見つからない`);
        continue;
      }
      const articleRes = await fetch(`${baseUrl}${href}`);
      if (articleRes.status === 200) {
        ok(`クラスタ記事 ${href} は200を返す`);
      } else {
        fail(`クラスタ記事 ${href} が200を返さない (${articleRes.status})`);
      }
    }

    // ---- 4. BreadcrumbList JSON-LDと可視パンくずの一致 ----
    const ldNames = extractBreadcrumbLdNames(html);
    if (arraysEqual(ldNames, expectedPillarLabels)) {
      ok(`BreadcrumbList JSON-LDと可視パンくずのラベル・順序が完全一致 (${ldNames?.join(" > ")})`);
    } else {
      fail(
        `BreadcrumbList JSON-LDと可視パンくずが一致しない (JSON-LD: ${JSON.stringify(ldNames)}, 可視: ${JSON.stringify(pillarLabels)})`,
      );
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(
    process.exitCode
      ? "\n=== test:eitango-no-oboekata-pillar: FAILED ==="
      : "\n=== test:eitango-no-oboekata-pillar RESULT: all checks passed ===",
  );
}

main().catch((e) => {
  console.error("eitango-no-oboekata-pillar test crashed:", e);
  process.exit(1);
});
