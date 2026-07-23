/**
 * daigaku-juken-tango 専用静的ページの検証。
 *
 * (2026-07-23) 動的ルート版(src/app/guide/[slug]/page.tsx の
 * ARTICLES["daigaku-juken-tango"])に固有だった内容のうち、製品機能として
 * 裏付けが取れた範囲(CSVインポート機能・AI解説機能・ストリーク/正答率グラフ/
 * 苦手リスト/バッジ進捗)に限定して静的フォルダ版(src/app/guide/
 * daigaku-juken-tango/page.tsx)へ統合した上で、daigaku-juken-tango を
 * DYNAMIC_ROUTE_EXCLUDED_SLUGS に登録し、静的版を正式ルートとして固定した
 * (ルーティング競合を解消済み)。
 *
 * 静的版・動的版のtitleは偶然どちらも同一文字列("大学受験英単語の効率的な
 * 覚え方【共通テスト〜難関大対応】")であり、H1のtextContentも実質同じに
 * なるため、title/H1だけでは静的版が配信されているかを判定できない。
 * そのため本テストは、静的版にしか存在しない複数の見出し・本文フレーズの
 * 存在と、動的版にしか存在しないフレーズの不在を組み合わせて判定する。
 * 動的版が配信された場合は、既知の許容状態ではなく明確な回帰としてFAILする。
 *
 * 静的ビルド成果物(.html)を直接読むのではなく、実際のURLへのリクエストと
 * ブラウザ表示を検証する。
 *
 * 使い方: node scripts/testing/e2e/daigaku-juken-tango-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "daigaku-juken-tango";
const STATIC_TITLE = "大学受験英単語の効率的な覚え方【共通テスト〜難関大対応】| Loop Vocabulary";

// 静的版にしか存在しない見出し・本文フレーズ(動的版のマークダウン本文には
// 出てこない表現を選んでいる)。
const STATIC_ONLY_HEADINGS = [
  "大学受験に必要な英単語数",
  "受験生がよくやる単語学習の失敗4選",
  "英単語を深く理解する方法",
  "単語帳の選び方",
  "継続するためのコツ",
];
const STATIC_ONLY_PHRASES = [
  "ミニマルフレーズ", // システム英単語の説明(静的版の独自表現)
  "ストーリー仕立て", // DUO 3.0の説明(静的版の独自表現)
  "つまずいた語", // CSV機能の一般化した説明(静的版の独自表現)
  "最初から高い目標を設定せず", // 継続のコツ(静的版の独自表現)
];

// 動的版のマークダウン本文にしか存在しないフレーズ。これらが検出された場合は
// 動的版が配信されている(ルーティング競合の回帰)ことを意味する。
const DYNAMIC_ONLY_PHRASES = [
  "大学受験に必要な英単語数は？", // 動的版の見出し(静的版は「？」なしの別見出し)
  "市販の単語帳の単語リストや先生が作ったプリントの単語をそのまま取り込んで", // 動的版のCSV機能の説明
  "ゲーミフィケーションで学習を継続しやすくしています", // 動的版の継続のコツ本文
  "AI で語源・ニュアンスを深く理解する", // 動的版の見出し
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;
  console.log(`Dev server: ${baseUrl} (startedByUs=${dev.startedByUs})`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = collectErrors(page);

    // ---- 1. 主ページが200で表示される ----
    const res = await page.goto(`${baseUrl}/guide/${SLUG}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    if (res && res.status() === 200) ok(`/guide/${SLUG} が200で表示される`);
    else fail(`/guide/${SLUG} のステータスが200ではない (${res?.status()})`);

    // ---- 2. title・canonical・H1が既存のまま ----
    const title = await page.title();
    if (title === STATIC_TITLE) ok(`titleが既存のまま: "${title}"`);
    else fail(`titleが想定と異なる: "${title}"`);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${SLUG}`) {
      ok(`canonicalが自己参照 (${canonical})`);
    } else {
      fail(`canonicalが想定と異なる: "${canonical}"`);
    }

    const h1 = await page.locator("h1").textContent().catch(() => "");
    if (h1?.includes("大学受験英単語の") && h1.includes("効率的な覚え方")) {
      ok(`H1が既存のまま: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる: "${h1}"`);
    }

    const bodyText = await page.locator("body").innerText();

    // ---- 3. 静的版にしか存在しない見出し・フレーズがすべて存在する ----
    const missingHeadings = STATIC_ONLY_HEADINGS.filter((h) => !bodyText.includes(h));
    if (missingHeadings.length === 0) {
      ok("静的版の主要見出し(大学受験に必要な英単語数・失敗4選・単語を深く理解する方法・単語帳の選び方・継続するためのコツ)がすべて表示されている");
    } else {
      fail(`静的版の見出しが一部見つからない: ${missingHeadings.join(", ")}`);
    }

    const missingPhrases = STATIC_ONLY_PHRASES.filter((p) => !bodyText.includes(p));
    if (missingPhrases.length === 0) {
      ok("今回統合した内容(単語帳の選び方・深く理解する方法・継続のコツ)の静的版固有フレーズがすべて表示されている");
    } else {
      fail(`統合したはずの内容の一部が見つからない: ${missingPhrases.join(", ")}`);
    }

    // ---- 4. 動的版固有のフレーズが混入していない(ルーティング競合の回帰検知) ----
    const foundDynamicPhrases = DYNAMIC_ONLY_PHRASES.filter((p) => bodyText.includes(p));
    if (foundDynamicPhrases.length === 0) {
      ok("動的版固有のフレーズが混入していない(動的版が配信されていないことを確認)");
    } else {
      fail(`動的版固有のフレーズが検出された(ルーティング競合の回帰の可能性): ${foundDynamicPhrases.join(", ")}`);
    }

    // ---- 5. ExamInfoDisclaimer(静的版固有のコンポーネント)が表示されている ----
    const disclaimerCount = await page.locator('[data-testid="exam-info-disclaimer"]').count();
    if (disclaimerCount > 0) {
      ok("ExamInfoDisclaimer(試験情報の注意書き)が表示されている");
    } else {
      fail("ExamInfoDisclaimer(試験情報の注意書き)が見つからない");
    }

    // ---- 6. 未確認の製品機能を断定する旧文言が存在しない ----
    const unverifiedClaimPhrases = [
      "市販の単語帳の単語リストや先生が作ったプリントの単語をそのまま取り込んで",
      "最短で合格できる",
      "これだけで完全習得できる",
      "必ず定着する",
      "最小の復習回数で最大の定着率",
    ];
    const foundUnverifiedClaims = unverifiedClaimPhrases.filter((p) => bodyText.includes(p));
    if (foundUnverifiedClaims.length === 0) {
      ok("未確認・根拠の弱い断定表現が本文に含まれていない");
    } else {
      fail(`未確認・根拠の弱い断定表現が見つかった: ${foundUnverifiedClaims.join(", ")}`);
    }

    // ---- 7. GuideMaterialCTAの既存3教材が維持されている ----
    const materialTitles = ["大学入試頻出英単語 2000+", "loop受験英単語⑤【難関大】", "loop受験英単語⑥【超難関大】"];
    const missingMaterials = materialTitles.filter((m) => !bodyText.includes(m));
    if (missingMaterials.length === 0) {
      ok("GuideMaterialCTAの既存3教材がすべて維持されている");
    } else {
      fail(`教材CTAの一部が見つからない: ${missingMaterials.join(", ")}`);
    }

    // ---- 8. /signup・/vocab-check のCTAが維持されている ----
    const signupLink = page.locator('a[href="/signup"]');
    const vocabCheckLink = page.locator('a[href="/vocab-check"]');
    if ((await signupLink.count()) > 0) ok("/signup へのCTAが維持されている");
    else fail("/signup へのCTAが見つからない");
    if ((await vocabCheckLink.count()) > 0) ok("/vocab-check へのCTAが維持されている");
    else fail("/vocab-check へのCTAが見つからない");

    // ---- 9. JSON-LD (Article・BreadcrumbList・datePublished・dateModified) ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasDatePublished = html.includes('"datePublished":"2024-09-01"');
    const hasDateModified = html.includes('"dateModified":"2026-07-23"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
    }
    if (hasDatePublished) {
      ok("Article JSON-LDのdatePublished(2024-09-01)が変更されていないことを確認");
    } else {
      fail("Article JSON-LDのdatePublished(2024-09-01)が見つからない(変更された可能性)");
    }
    if (hasDateModified) {
      ok("Article JSON-LDにdateModified(2026-07-23)が出力されている");
    } else {
      fail("Article JSON-LDにdateModified(2026-07-23)が見つからない");
    }

    // ---- 10. mobile幅で横スクロールが発生しない ----
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoReady(page, `${baseUrl}/guide/${SLUG}`);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (!hasOverflow) ok("mobile幅(375px)で横スクロールが発生していない");
    else fail("mobile幅(375px)で横スクロールが発生している");
    await page.setViewportSize({ width: 1280, height: 800 });

    if (errors.length === 0) ok("操作中に console error / 5xx なし");
    else fail(`操作中にエラー検出: ${errors.join(" | ")}`);
  } catch (e) {
    fail(`予期しない例外: ${e.message}`);
  } finally {
    await browser.close();
    stopDevServer(dev);
  }

  if (process.exitCode) {
    console.log("\n=== test:daigaku-juken-tango-content: FAILED ===");
  } else {
    console.log("\n=== test:daigaku-juken-tango-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("daigaku-juken-tango-content e2e crashed:", e);
  process.exit(1);
});
