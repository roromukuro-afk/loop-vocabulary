/**
 * eiken-conversation 専用静的ページの検証。
 *
 * (2026-07-24) 動的ルート版(src/app/guide/[slug]/page.tsx の
 * ARTICLES["eiken-conversation"])との内容差・教材CTA差・英会話表現と製品
 * 機能説明の正確性を監査した上で、有用な内容(旅行英語の3分類:
 * 空港・交通/ホテル/レストラン)を静的フォルダ版(src/app/guide/
 * eiken-conversation/page.tsx)へ統合し、教材CTA(元々静的版になし)を
 * 動的版と同じ2件へ新規追加し、eiken-conversation を
 * DYNAMIC_ROUTE_EXCLUDED_SLUGS に登録して静的版を正式ルートとして固定した
 * (ルーティング競合を解消済み)。
 *
 * 監査の結果、次の修正も行った:
 * - 「日常フレーズ 約300語」「旅行英語 約150語」「学習期間目安 2〜3ヶ月」は
 *   ページ内容と一致しない数値だったため、ページから機械的に確認できる件数
 *   (4場面/場面別フレーズ20件/学習方法4つ)へ修正。
 * - 英会話表現の訳・ニュアンスを監査し修正: "I hear you."(単純な同意ではなく
 *   理解・共感)、"Would you mind...?"(doing/if Iで意味が異なるため
 *   構文を明確化)、"Fair enough."・"Absolutely."(文脈依存のニュアンス)、
 *   "My bad."(かなり口語的)、Could/Can(丁寧さ・文脈依存)。
 * - 音声読み上げ機能はブラウザ依存(Web Speech API)であることを明記し、
 *   「正しい発音を保証」「ネイティブの英語が聞き取れるようになる」といった
 *   断定表現を削除。
 * - AI解説機能は`/ai`ページ自身が「(現在はモック)」と開示しており出力精度を
 *   保証できないため、断定を避け「目安として活用」という表現へ修正。
 * - 関連ガイドの古いタイトル「ビジネス英語の必須単語300選と実践的な覚え方」を
 *   PR #15後の正式タイトルへ更新。
 *
 * 静的版のtitleから「英会話に効く」という動的版と共通していた表現を削除した
 * ため、title比較も判定に使えるが、仕様どおりtitleだけに頼らず、静的版に
 * しか存在しない複数の見出し・フレーズの存在と、動的版にしか存在しない
 * フレーズの不在を組み合わせて判定する。動的版が配信された場合は明確な
 * 回帰としてFAILする。
 *
 * 静的ビルド成果物(.html)を直接読むのではなく、実際のURLへのリクエストと
 * ブラウザ表示を検証する。
 *
 * 使い方: node scripts/testing/e2e/eiken-conversation-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "eiken-conversation";
const STATIC_TITLE = "英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】| Loop Vocabulary";
const DYNAMIC_TITLE_MARKER = "英会話に効く";

// 静的版にしか存在しない見出し・本文フレーズ(動的版のマークダウン本文には
// 出てこない表現を選んでいる)。
const STATIC_ONLY_HEADINGS = [
  "場面別 英会話フレーズ集",
  "旅行英語 必須語彙",
  "英会話フレーズを定着させる4つのコツ",
  "英会話力を上げる学習サイクル",
  "知っておきたい口語 vs 書き言葉",
];
const STATIC_ONLY_PHRASES = [
  "言いたいことは分かるよ", // "I hear you."の修正後訳(静的版の独自表現)
  "手伝っていただけますか", // "Would you mind helping me?"の構文明確化(静的版の独自表現)
  "対応するブラウザでは", // 音声読み上げのブラウザ依存性の明記(静的版の独自表現)
  "Canは日常的で直接的", // Could/Canの文脈依存説明(静的版の独自表現)
  "AI解説は使い方を確認する目安として活用できます", // AI解説の断定回避表現(静的版の独自表現)
];

// 動的版のマークダウン本文にしか存在しないフレーズ。これらが検出された場合は
// 動的版が配信されている(ルーティング競合の回帰)ことを意味する。
const DYNAMIC_ONLY_PHRASES = [
  DYNAMIC_TITLE_MARKER,
  "keep in touch", // 動的版のみのフレーズ登録例
  "忘却曲線で自動復習", // 動的版の学習サイクルの断定表現
  "実際の会話で使えるようになります", // 動的版のAI解説セクションの断定表現
];

// 監査前の静的版に存在していた、根拠が弱い断定表現・不正確な訳を回帰防止として
// チェックする。
const unverifiedClaimPhrases = [
  "日常フレーズ 約300語",
  "旅行英語 約150語",
  "学習期間目安 2〜3ヶ月",
  "場面別に完全解説",
  "最短ルート",
  "実際の会話でも即座に出てくる",
  "正しい発音を確認",
  "ネイティブの英語が聞き取りやすくなる",
  "出会った瞬間が記憶の第一歩",
  "出力練習が不可欠",
  "「知ってる」が「使える」に変わります",
  "おっしゃる通り", // "I hear you."の修正前訳(単純な同意と誤解させる表現)
  "Would you mind...?", // 構文が曖昧だった旧表現
  "Couldより Can が自然", // 文脈を無視した断定だった旧表現
  "ビジネス英語の必須単語300選と実践的な覚え方", // 関連ガイドの古いタイトル
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
      fail(`titleが想定と異なる(ルーティング競合の回帰の可能性): "${title}"`);
    }

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href").catch(() => null);
    if (canonical === `${SITE_URL}/guide/${SLUG}`) {
      ok(`canonicalが自己参照 (${canonical})`);
    } else {
      fail(`canonicalが想定と異なる: "${canonical}"`);
    }

    const h1 = await page.locator("h1").textContent().catch(() => "");
    if (h1?.includes("英会話でよく使う") && h1.includes("英単語の覚え方") && !h1.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`H1が修正後の内容と一致している: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる: "${h1}"`);
    }

    const bodyText = await page.locator("body").innerText();

    // ---- 3. 静的版にしか存在しない見出し・フレーズがすべて存在する ----
    const missingHeadings = STATIC_ONLY_HEADINGS.filter((h) => !bodyText.includes(h));
    if (missingHeadings.length === 0) {
      ok("静的版の主要見出し(場面別フレーズ集・旅行英語必須語彙・4つのコツ・学習サイクル・口語vs書き言葉)がすべて表示されている");
    } else {
      fail(`静的版の見出しが一部見つからない: ${missingHeadings.join(", ")}`);
    }

    const missingPhrases = STATIC_ONLY_PHRASES.filter((p) => !bodyText.includes(p));
    if (missingPhrases.length === 0) {
      ok("今回統合・修正した内容の静的版固有フレーズがすべて表示されている");
    } else {
      fail(`統合・修正したはずの内容の一部が見つからない: ${missingPhrases.join(", ")}`);
    }

    // ---- 4. 4つの場面がすべて表示されている ----
    const sceneTitles = ["日常会話・相づち", "感情・気持ちを表す", "旅行英語・必須語彙", "依頼・提案フレーズ"];
    const missingScenes = sceneTitles.filter((s) => !bodyText.includes(s));
    if (missingScenes.length === 0) {
      ok("場面別フレーズ集の4つの場面がすべて表示されている");
    } else {
      fail(`場面別フレーズ集の一部が見つからない: ${missingScenes.join(", ")}`);
    }

    // ---- 5. 旅行英語の3分類がすべて表示されている ----
    const travelCategories = ["空港・交通", "ホテル", "レストラン"];
    const missingTravel = travelCategories.filter((c) => !bodyText.includes(c));
    if (missingTravel.length === 0) {
      ok("旅行英語 必須語彙の3分類(空港・交通・ホテル・レストラン)がすべて表示されている");
    } else {
      fail(`旅行英語の分類の一部が見つからない: ${missingTravel.join(", ")}`);
    }

    // ---- 6. 動的版固有のフレーズが混入していない(ルーティング競合の回帰検知) ----
    const foundDynamicPhrases = DYNAMIC_ONLY_PHRASES.filter((p) => bodyText.includes(p));
    if (foundDynamicPhrases.length === 0) {
      ok("動的版固有のフレーズが混入していない(動的版が配信されていないことを確認)");
    } else {
      fail(`動的版固有のフレーズが検出された(ルーティング競合の回帰の可能性): ${foundDynamicPhrases.join(", ")}`);
    }

    // ---- 7. 監査前の不正確な訳・根拠のない断定表現・古い関連ガイドタイトルが
    //         残っていない ----
    const foundUnverifiedClaims = unverifiedClaimPhrases.filter((p) => bodyText.includes(p));
    if (foundUnverifiedClaims.length === 0) {
      ok("監査前の不正確な訳・根拠のない断定表現・古い関連ガイドタイトルが本文に含まれていない");
    } else {
      fail(`監査前の不正確な訳・断定表現が見つかった: ${foundUnverifiedClaims.join(", ")}`);
    }

    // ---- 8. GuideMaterialCTAが動的版と同じ2件になっている(静的版に新規追加) ----
    const materialTitles = ["日常英会話 基礎フレーズ", "loop学びなおし英単語①【日常生活】"];
    const missingMaterials = materialTitles.filter((m) => !bodyText.includes(m));
    if (missingMaterials.length === 0) {
      ok("GuideMaterialCTAが動的版と同じ2教材(日常英会話 基礎フレーズ・loop学びなおし英単語①)で新規追加されている");
    } else {
      fail(`教材CTAの一部が見つからない: ${missingMaterials.join(", ")}`);
    }
    const materialOccurrences = materialTitles.map((m) => (bodyText.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length);
    if (materialOccurrences.every((c) => c === 1)) {
      ok("教材CTAの各タイトルが重複せず1回ずつ表示されている");
    } else {
      fail(`教材CTAの表示回数が想定外(重複表示の可能性): ${materialTitles.map((m, i) => `${m}=${materialOccurrences[i]}`).join(", ")}`);
    }

    // ---- 9. /signup・/vocab-check・GuideEmailCaptureが維持されている ----
    const signupLink = page.locator('a[href="/signup"]');
    const vocabCheckLink = page.locator('a[href="/vocab-check"]');
    if ((await signupLink.count()) > 0) ok("/signup へのCTAが維持されている");
    else fail("/signup へのCTAが見つからない");
    if ((await vocabCheckLink.count()) > 0) ok("/vocab-check へのCTAが維持されている");
    else fail("/vocab-check へのCTAが見つからない");
    if (bodyText.includes("英単語学習ヒントをメールで受け取る")) {
      ok("GuideEmailCaptureが表示されている");
    } else {
      fail("GuideEmailCaptureが見つからない");
    }

    // ---- 10. JSON-LD (Article・BreadcrumbList・datePublished・dateModified) ----
    const html = await page.content();
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasDatePublished = html.includes('"datePublished":"2024-12-15"');
    const hasDateModified = html.includes('"dateModified":"2026-07-24"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
    }
    if (hasDatePublished) {
      ok("Article JSON-LDのdatePublished(2024-12-15、動的版とも一致・不変)が変更されていないことを確認");
    } else {
      fail("Article JSON-LDのdatePublished(2024-12-15)が見つからない(変更された可能性)");
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
    console.log("\n=== test:eiken-conversation-content: FAILED ===");
  } else {
    console.log("\n=== test:eiken-conversation-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("eiken-conversation-content e2e crashed:", e);
  process.exit(1);
});
