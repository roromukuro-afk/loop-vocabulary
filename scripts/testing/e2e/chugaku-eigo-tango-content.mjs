/**
 * chugaku-eigo-tango 静的ガイドページへの月別スケジュール統合の検証
 * (2026-07-22: 動的ルート版(src/app/guide/[slug]/page.tsx の
 * ARTICLES["chugaku-eigo-tango"])にのみ存在した月別学習スケジュールを、
 * 静的フォルダ版(src/app/guide/chugaku-eigo-tango/page.tsx)へ統合した)。
 *
 * 禁止語の不在チェックだけに頼らず、実際のSSR/ブラウザ表示を検証する。
 *
 * 重要な注意: chugaku-eigo-tango は、静的フォルダルートと動的ルート
 * (src/app/guide/[slug]/page.tsx の generateStaticParams())の両方が
 * 同一URLを静的生成しようとする、既知の未解決ルーティング競合が残っている
 * (KNOWN_DEFERRED_COLLISIONS、別PRで意図的に保留)。このため `npm run build`
 * のたびに、どちらの版の出力が実際に配信されるかが非決定的である
 * (複数回のクリーンビルドで実際に確認済み: 4回中3回は動的版が勝つ観測もあった)。
 * 本テストはこの状態を「無理に成功扱いにしない」ため、動的版が配信された
 * ビルドを検出した場合は、静的版のコンテンツ確認をスキップし、その旨を
 * 明確にログした上で失敗として扱う(ルーティング競合の修正自体は別スコープ)。
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
function warn(msg) { console.log(`⚠️  ${msg}`); }

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

    const title = await page.title();

    // ---- 0. 既知のルーティング競合により、このビルドで動的版が配信されていないか判定 ----
    // (chugaku-eigo-tango は KNOWN_DEFERRED_COLLISIONS に残っており、本PRのスコープ外。
    //  無理に成功扱いにせず、その旨を明確にログした上でFAILとして報告する)
    if (title.includes(DYNAMIC_TITLE_MARKER)) {
      warn(
        `このビルドでは既知のルーティング競合(chugaku-eigo-tangoはKNOWN_DEFERRED_COLLISIONSに残存、` +
          `本PRのスコープ外)により動的ルート版が配信されたため、静的版へ統合した内容を確認できません。` +
          `title="${title}"`
      );
      fail(
        "既知のルーティング競合により動的版が配信されたため、本テストで静的版の内容確認ができなかった " +
          "(静的ページのソース自体は別途確認済み。再実行するか、ルーティング競合修正後に再確認してください)"
      );
      console.log("\n=== test:chugaku-eigo-tango-content: FAILED (ルーティング競合により静的版を確認できず) ===");
      return;
    }

    // ---- 2. title・canonical・H1が変更されていない ----
    if (title === STATIC_TITLE) {
      ok(`titleが変更されていない: "${title}"`);
    } else {
      fail(`titleが想定と異なる（変更されている可能性）: "${title}"`);
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${SLUG}`) {
      ok(`canonicalが自己参照で変更されていない (${canonical})`);
    } else {
      fail(`canonicalが想定と異なる: "${canonical}"`);
    }

    const h1 = await page.locator("h1").textContent().catch(() => "");
    if (h1?.includes("中学英語の単語を") && h1.includes("完璧に覚える方法") && !h1.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`H1が変更されていない: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる（変更されている可能性）: "${h1}"`);
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
      "接続詞・前置詞", // Aにのみあった3つ目のカテゴリ(統合作業で失われていないか)
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

    // ---- 9. JSON-LD (Article・BreadcrumbList) が出力されている ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
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
