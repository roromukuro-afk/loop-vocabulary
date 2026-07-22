/**
 * chugaku-eigo-tango 専用静的ページの検証。
 *
 * (2026-07-22) 動的ルート版(src/app/guide/[slug]/page.tsx の
 * ARTICLES["chugaku-eigo-tango"])にのみ存在した月別学習スケジュールを、
 * 静的フォルダ版(src/app/guide/chugaku-eigo-tango/page.tsx)へ統合した上で、
 * chugaku-eigo-tango を DYNAMIC_ROUTE_EXCLUDED_SLUGS に登録し、静的版を
 * 正式ルートとして固定した(ルーティング競合を解消済み)。
 *
 * そのため本テストは、/guide/chugaku-eigo-tango が常に専用静的ページとして
 * 配信されることを必須条件として検証する。動的版が配信された場合は、
 * 既知の許容状態ではなく明確な回帰として扱いFAILする。
 *
 * 静的ビルド成果物(.html)を直接読むのではなく、実際のURLへのリクエストと
 * ブラウザ表示を検証する(禁止語の不在チェックのみに頼らない)。
 *
 * 使い方: node scripts/testing/e2e/chugaku-eigo-tango-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "chugaku-eigo-tango";
const STATIC_TITLE = "中学英語の単語を完璧に覚える方法【高校受験・英検3級対策】| Loop Vocabulary";
const DYNAMIC_TITLE_MARKER = "【基礎固め完全版】";

// 動的版から静的版へ移植する際に緩和すべき断定表現。統合後の本文に
// 残っていてはいけない(単純な禁止語チェックのみに頼らず、他の実挙動
// チェックと併用する)。
const UNHEDGED_CLAIM_PHRASES = [
  "3ヶ月で完全習得できます",
  "必ず覚えられる",
  "これが最も効果的",
  "全員に最適",
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

    // ---- 2. 常に専用静的ページのtitleと完全一致し、動的版titleが混入していない ----
    const title = await page.title();
    if (title === STATIC_TITLE && !title.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`titleが静的版と完全一致している: "${title}"`);
    } else {
      fail(`titleが静的版と一致しない(ルーティング競合の回帰の可能性): "${title}"`);
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${SLUG}`) {
      ok(`canonicalが自己参照 (${canonical})`);
    } else {
      fail(`canonicalが想定と異なる: "${canonical}"`);
    }

    const h1 = await page.locator("h1").textContent().catch(() => "");
    if (h1?.includes("中学英語の単語を") && h1.includes("完璧に覚える方法") && !h1.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`H1が静的版のまま: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる(ルーティング競合の回帰の可能性): "${h1}"`);
    }

    // ---- 3. 月別スケジュールセクションが表示される ----
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("3か月で進める中学英単語学習スケジュール")) {
      ok("月別スケジュールの見出しが表示されている");
    } else {
      fail("月別スケジュールの見出しが見つからない");
    }

    for (const month of ["1ヶ月目", "2ヶ月目", "3ヶ月目"]) {
      if (bodyText.includes(month)) ok(`${month}が表示されている`);
      else fail(`${month}が見つからない`);
    }

    // ---- 4. 動的版固有だった主要な数値・内容が静的版に保持されている ----
    const preservedFacts = ["400語", "800語", "1,200語", "15語", "10語", "復習"];
    const missingFacts = preservedFacts.filter((f) => !bodyText.includes(f));
    if (missingFacts.length === 0) {
      ok("動的版固有だった目標語数・1日の学習量が静的版に保持されている");
    } else {
      fail(`動的版固有の内容が一部欠落している: ${missingFacts.join(", ")}`);
    }

    // ---- 5. 月別の数値が「目安」として表示され、断定表現になっていない ----
    if (bodyText.includes("目安")) {
      ok("月別スケジュールの数値が「目安」として明示されている");
    } else {
      fail("「目安」である旨の明示が見つからない");
    }
    if (bodyText.includes("調整")) {
      ok("進み具合に応じて調整できる旨が明示されている");
    } else {
      fail("調整可能である旨の明示が見つからない");
    }

    const foundClaims = UNHEDGED_CLAIM_PHRASES.filter((p) => bodyText.includes(p));
    if (foundClaims.length === 0) {
      ok("動的版にあった根拠のない断定表現が残っていない");
    } else {
      fail(`断定表現が残っている: ${foundClaims.join(", ")}`);
    }

    // ---- 6. 既存の学習法セクション・本文が失われていない ----
    const preservedSections = [
      "中学英語の単語がなぜ重要か",
      "カテゴリ別 中学必須単語リスト",
      "中学単語を定着させる4つのコツ",
      "高校受験・英検3級との対応",
      "接続詞・前置詞", // 静的版にのみあった3つ目のカテゴリ(統合作業で失われていないか)
    ];
    const missingSections = preservedSections.filter((s) => !bodyText.includes(s));
    if (missingSections.length === 0) {
      ok("既存のセクション・本文が失われていない");
    } else {
      fail(`既存セクションが一部見つからない: ${missingSections.join(", ")}`);
    }

    // ---- 7. GuideMaterialCTAの既存3教材が維持されている ----
    const materialTitles = ["中学校英単語 基礎・標準", "loop受験英単語①【中学完成】", "loop受験英単語②【高校入試】"];
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

    // ---- 9. JSON-LD (Article・BreadcrumbList・dateModified) が正しく出力されている ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasDateModified = html.includes('"dateModified":"2026-07-22"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
    }
    if (hasDateModified) {
      ok("Article JSON-LDにdateModified(2026-07-22)が出力されている");
    } else {
      fail("Article JSON-LDにdateModified(2026-07-22)が見つからない");
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
    console.log("\n=== test:chugaku-eigo-tango-content: FAILED ===");
  } else {
    console.log("\n=== test:chugaku-eigo-tango-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("chugaku-eigo-tango-content e2e crashed:", e);
  process.exit(1);
});
