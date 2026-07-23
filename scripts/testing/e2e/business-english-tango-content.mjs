/**
 * business-english-tango 専用静的ページの検証。
 *
 * (2026-07-24) 動的ルート版(src/app/guide/[slug]/page.tsx の
 * ARTICLES["business-english-tango"])との内容差・教材CTA差・製品説明の
 * 正確性を監査した上で、有用な内容(KPI・財務語彙の使い分け、ビジネス
 * メールの動詞アップグレード表)を静的フォルダ版(src/app/guide/
 * business-english-tango/page.tsx)へ統合し、教材CTAを動的版と同じ2件
 * (TOEIC頻出基礎単語・TOEIC 頻出単語 2500)へ揃え、business-english-tango を
 * DYNAMIC_ROUTE_EXCLUDED_SLUGS に登録して静的版を正式ルートとして固定した
 * (ルーティング競合を解消済み)。
 *
 * 監査の結果、次の修正も行った:
 * - title/H1/Article headlineの「必須単語300選」は、実際にページ内に
 *   掲載している語句数(シーン別語彙・KPI語彙・動詞表を合わせても300に
 *   遠く及ばない)と一致しないため削除し、「ビジネス英語の必須単語・表現と
 *   実践的な覚え方」へ変更した。
 * - 「契約書・NDL・覚書」の"NDL"は"NDA"の誤記だったため修正。
 * - 「liab＝bind」という語源説明は信頼できる典拠で裏付けられないため削除。
 * - AI自動抽出・小テストPDF等の製品機能説明は実装を確認した上、
 *   Premium限定である旨・個人利用の範囲である旨・機密性のある実文書の
 *   貼り付けを積極的に推奨しない表現へ修正した。
 * - 「毎朝5分の復習だけで業務英語が定着」等の根拠のない断定表現を、
 *   個人差を明示する表現へ修正した。
 *
 * titleは静的版・動的版で現在異なる(静的版から「300選」を削除したため)ので
 * title比較も判定に使えるが、念のため静的版にしか存在しない複数の見出し・
 * フレーズの存在と、動的版にしか存在しないフレーズの不在を組み合わせて
 * 判定する。動的版が配信された場合は明確な回帰としてFAILする。
 *
 * 静的ビルド成果物(.html)を直接読むのではなく、実際のURLへのリクエストと
 * ブラウザ表示を検証する。
 *
 * 使い方: node scripts/testing/e2e/business-english-tango-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "business-english-tango";
const STATIC_TITLE = "ビジネス英語の必須単語・表現と実践的な覚え方 | Loop Vocabulary";
const DYNAMIC_TITLE_MARKER = "必須単語300選";

// 静的版にしか存在しない見出し・本文フレーズ(動的版のマークダウン本文には
// 出てこない表現を選んでいる)。
const STATIC_ONLY_HEADINGS = [
  "シーン別 頻出語彙リスト",
  "KPI・財務語彙の使い分け",
  "ビジネス英語を速く身につける4つのコツ",
  "Loop Vocabulary でビジネス英語を管理する",
];
const STATIC_ONLY_PHRASES = [
  "使い分けが一般的", // KPI語彙セクション(静的版の独自表現)
  "NDA・覚書に頻出", // 誤記修正後の表現(静的版の独自表現)
  "定着度は既習度・使用頻度・復習回数によって異なる", // 継続学習のヘッジ表現(静的版の独自表現)
  "自分の復習用に小テスト形式で確認できる", // PDF機能のヘッジ表現(静的版の独自表現)
];

// 動的版のマークダウン本文にしか存在しないフレーズ。これらが検出された場合は
// 動的版が配信されている(ルーティング競合の回帰)ことを意味する。
const DYNAMIC_ONLY_PHRASES = [
  DYNAMIC_TITLE_MARKER,
  "circle back", // 動的版のみの会議語彙
  "週1回「苦手単語」を集中復習して完全定着", // 動的版の継続学習の断定表現
  "用語集・対訳表を一括取り込み", // 動的版のCSV機能の説明
];

// 監査前の静的版に存在していた、根拠が弱い断定表現・誤記・未確認の製品機能
// 断定。統合作業でこれらを修正済みのため、回帰防止として不在を確認する。
const unverifiedClaimPhrases = [
  "契約書・NDL・覚書", // NDAの誤記
  "「liab」＝bind", // 信頼できる典拠のない語源説明
  "英語コミュニケーションの質が一段階上がります", // 過剰断定
  "実践でそのまま使える", // 過剰断定
  "実際に受け取ったビジネスメールや社内文書から知らない表現を抽出", // 機密性のある実文書の貼り付けを推奨する表現
  "英文メール・議事録を貼り付けてAI自動抽出", // 同上
  "ニュアンスが定着してから使うと安心", // AIの品質・効果を断定する表現
  "毎朝5分の復習だけで業務英語が定着", // 根拠のない断定表現
  "部署内の英語学習会にも活用可能", // 組織利用を示唆する未確認の製品機能説明
  "業務メールから単語帳を作れます", // 機密性のある実文書の貼り付けを推奨する表現
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

    // ---- 2. 修正後titleと完全一致し、動的版titleが混入していない ----
    const title = await page.title();
    if (title === STATIC_TITLE && !title.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`titleが修正後の静的版と完全一致している: "${title}"`);
    } else {
      fail(`titleが想定と異なる(ルーティング競合の回帰、または「300選」表現の再混入の可能性): "${title}"`);
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${SLUG}`) {
      ok(`canonicalが自己参照 (${canonical})`);
    } else {
      fail(`canonicalが想定と異なる: "${canonical}"`);
    }

    const h1 = await page.locator("h1").textContent().catch(() => "");
    if (h1?.includes("ビジネス英語") && h1.includes("必須単語・表現の覚え方") && !h1.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`H1が修正後の内容と一致している: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる: "${h1}"`);
    }

    const bodyText = await page.locator("body").innerText();

    // ---- 3. 静的版にしか存在しない見出し・フレーズがすべて存在する ----
    const missingHeadings = STATIC_ONLY_HEADINGS.filter((h) => !bodyText.includes(h));
    if (missingHeadings.length === 0) {
      ok("静的版の主要見出し(シーン別語彙・KPI財務語彙・4つのコツ・Loop Vocabulary活用)がすべて表示されている");
    } else {
      fail(`静的版の見出しが一部見つからない: ${missingHeadings.join(", ")}`);
    }

    const missingPhrases = STATIC_ONLY_PHRASES.filter((p) => !bodyText.includes(p));
    if (missingPhrases.length === 0) {
      ok("今回統合・修正した内容の静的版固有フレーズがすべて表示されている");
    } else {
      fail(`統合・修正したはずの内容の一部が見つからない: ${missingPhrases.join(", ")}`);
    }

    // ---- 4. 5シーンの語彙がすべて表示されている ----
    const sceneTitles = ["メール・文書", "会議・議論", "プレゼン・報告", "交渉・契約", "財務・経営"];
    const missingScenes = sceneTitles.filter((s) => !bodyText.includes(s));
    if (missingScenes.length === 0) {
      ok("シーン別語彙の5シーンがすべて表示されている");
    } else {
      fail(`シーン別語彙の一部が見つからない: ${missingScenes.join(", ")}`);
    }

    // ---- 5. 動的版固有のフレーズが混入していない(ルーティング競合の回帰検知) ----
    const foundDynamicPhrases = DYNAMIC_ONLY_PHRASES.filter((p) => bodyText.includes(p));
    if (foundDynamicPhrases.length === 0) {
      ok("動的版固有のフレーズが混入していない(動的版が配信されていないことを確認)");
    } else {
      fail(`動的版固有のフレーズが検出された(ルーティング競合の回帰の可能性): ${foundDynamicPhrases.join(", ")}`);
    }

    // ---- 6. 監査前の誤記・未確認の製品機能断定・過剰表現が残っていない ----
    const foundUnverifiedClaims = unverifiedClaimPhrases.filter((p) => bodyText.includes(p));
    if (foundUnverifiedClaims.length === 0) {
      ok("誤記(NDL)・未確認の語源説明(liab=bind)・過剰断定・組織利用を示唆する未確認機能説明が本文に含まれていない");
    } else {
      fail(`監修前の誤記・断定表現が見つかった: ${foundUnverifiedClaims.join(", ")}`);
    }

    // ---- 7. Premium CTAのリンク先が正しい ----
    const premiumLink = page.locator('a[href="/premium"]');
    if ((await premiumLink.count()) > 0) {
      ok("/premium へのPremium CTAリンクが維持されている");
    } else {
      fail("/premium へのCTAリンクが見つからない");
    }

    // ---- 8. GuideMaterialCTAが動的版と同じ2件になっている ----
    const materialTitles = ["TOEIC頻出基礎単語", "TOEIC 頻出単語 2500"];
    const missingMaterials = materialTitles.filter((m) => !bodyText.includes(m));
    if (missingMaterials.length === 0) {
      ok("GuideMaterialCTAが動的版と同じ2教材(TOEIC頻出基礎単語・TOEIC 頻出単語 2500)になっている");
    } else {
      fail(`教材CTAの一部が見つからない: ${missingMaterials.join(", ")}`);
    }
    // 重複表示がないことも確認(2件のはずが3件以上検出されたら重複の疑い)
    const materialOccurrences = materialTitles.map((m) => (bodyText.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length);
    if (materialOccurrences.every((c) => c === 1)) {
      ok("教材CTAの各タイトルが重複せず1回ずつ表示されている");
    } else {
      fail(`教材CTAの表示回数が想定外(重複表示の可能性): ${materialTitles.map((m, i) => `${m}=${materialOccurrences[i]}`).join(", ")}`);
    }

    // ---- 9. /signup・GuideEmailCapture が維持されている ----
    const signupLink = page.locator('a[href="/signup"]');
    if ((await signupLink.count()) > 0) ok("/signup へのCTAが維持されている");
    else fail("/signup へのCTAが見つからない");

    if (bodyText.includes("英単語学習ヒントをメールで受け取る")) {
      ok("GuideEmailCaptureが表示されている");
    } else {
      fail("GuideEmailCaptureが見つからない");
    }

    // ---- 10. JSON-LD (Article・BreadcrumbList・datePublished・dateModified) ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasDatePublished = html.includes('"datePublished":"2024-11-01"');
    const hasDateModified = html.includes('"dateModified":"2026-07-24"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
    }
    if (hasDatePublished) {
      ok("Article JSON-LDのdatePublished(2024-11-01、静的版の既存値を維持)が変更されていないことを確認");
    } else {
      fail("Article JSON-LDのdatePublished(2024-11-01)が見つからない(変更された可能性)");
    }
    if (hasDateModified) {
      ok("Article JSON-LDにdateModified(2026-07-24)が出力されている");
    } else {
      fail("Article JSON-LDにdateModified(2026-07-24)が見つからない");
    }

    // ---- 11. mobile幅で横スクロールが発生しない ----
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
    console.log("\n=== test:business-english-tango-content: FAILED ===");
  } else {
    console.log("\n=== test:business-english-tango-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("business-english-tango-content e2e crashed:", e);
  process.exit(1);
});
