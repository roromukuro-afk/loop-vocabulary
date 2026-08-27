/**
 * toeic-tango 専用静的ページの検証。
 *
 * (2026-07-24) reports/exam-info-audit.md で発見済みだった静的フォルダ版
 * (src/app/guide/toeic-tango/page.tsx) と動的ルート版(src/app/guide/[slug]/
 * page.tsx の ARTICLES["toeic-tango"])のルーティング競合を根本解消した。
 * 同audit当時は「大規模な削除は安全性の観点でブロックされた」ため両バージョンの
 * 本文を個別に是正するに留めていたが、今回は静的版・動的版の内容差を監査し、
 * 有用な内容(他の英語試験との比較表)を静的版へ統合した上で、静的版を正式ルート
 * として固定した(toeic-tango を DYNAMIC_ROUTE_EXCLUDED_SLUGS に追加)。
 *
 * 監査の結果、次の修正も行った(EXAM_INFO_SOURCE_POLICY.md準拠):
 * - IIBC・ETSはスコア別必要語彙数を公式に発表していないことをWeb検索で確認した
 *   上で、「語彙力がスコアの30〜40%を左右」「最短ルート」「最短合格への道」
 *   「600点突破のために3,000語」「完全対策」等、断定的・保証的な表現をすべて
 *   削除・軟化した。
 * - (2026-07-24 再修正) スコア帯別の具体的な語彙数(600点→3,000語等の4件)は、
 *   「市販教材で広く言及されている目安」という注記付きであっても未裏付けの
 *   対応表であることに変わりないため、注記ごと削除した。SCORE_BANDSの`vocab`
 *   フィールド自体を`theme`(学習テーマ例)へ置き換え、概要カードもスコア帯別
 *   語彙学習例(学習テーマ例)の表示に変更。見出しも「スコア帯別 頻出単語」→
 *   「スコア帯を目安にした語彙学習例」、「頻出トピック」→「学習テーマ例」、
 *   「このレベルの頻出単語」→「語彙例」へ変更し、「以下は公式の出題区分では
 *   なく、学習内容を整理するための一例です」という注記を追加した。
 * - FAQの「600点までは日常業務の基本動詞、730点前後からは財務・人事...」という
 *   公式スコア区分を示唆する断定を、「ETS・IIBCによるスコア帯別の公式単語リスト
 *   は確認できない」旨の表現へ修正。同じくFAQの「スコアと実務力の両方に効果的
 *   です」も軟化。
 * - TIPSの「TOEICは言い換えで惑わす問題が多い」という断定を軟化。比較表の
 *   大学受験欄「頻出度ランクが明確」も、根拠が曖昧なため軟化。
 * - 結論ブロックを、実際の記事内容(スコア帯別の学習テーマ・SRS復習・言い換え
 *   学習)に即した非断定的な文言へ書き換えた。
 * - CTAの「確実に定着」、TIPSの「最も効率的」「正答率も上がる」等の保証表現も
 *   併せて軟化した。
 * - GuideMaterialCTAに動的版と同じ2教材(TOEIC頻出基礎単語・TOEIC 頻出単語
 *   2500)が揃うよう、欠けていた1件を追加した。
 * - (2026-07-25 再修正) 結論の「目標スコア帯に出やすい語彙」(スコアや受験者の
 *   能力によって出題語彙が変わるように読める)を「問題演習で出会った語句や
 *   現在の弱点に関係する語彙」へ修正。600〜730点カードの「語彙問題が増える」
 *   (スコア帯によってPart5の問題数・構成が変わるように読める)を「品詞の知識が
 *   選択肢の判断に役立つことがある」へ修正。「日常ビジネス動詞100語」という
 *   根拠のない数値を削除し「基本的なビジネス動詞」へ。見出し「英語ビジネス
 *   メールを読む習慣をつける」と本文「BBC Business...を週2〜3記事」の
 *   不一致(メール vs 記事、根拠のない固定頻度)を「英語のビジネス記事を読む
 *   習慣をつける」に統一し、媒体は例であることを明示・固定頻度を削除。
 *   ヒーロー説明「スコア帯別の頻出語彙から効率的な覚え方まで」(公式な頻出語彙が
 *   スコア帯ごとにあるように読める)とmetadata descriptionを、スコア帯を
 *   「目安」とする表現へ修正。title・H1・URL・canonicalは変更していない。
 *
 * 動的版のtitle「TOEICスコアアップの英単語学習法【600→800点】」は静的版に
 * 存在しない表現のため、titleでの判定に加え、静的版にしか存在しない複数の
 * 見出し・フレーズの存在と、動的版にしか存在しないフレーズの不在を組み合わせて
 * 判定する。動的版が配信された場合は明確な回帰としてFAILする。
 *
 * 静的ビルド成果物(.html)を直接読むのではなく、実際のURLへのリクエストと
 * ブラウザ表示を検証する。
 *
 * 使い方: node scripts/testing/e2e/toeic-tango-content.mjs
 */
import { chromium } from "playwright";
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { collectErrors } from "./lib/login.mjs";
import { gotoReady } from "./lib/nav.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "toeic-tango";
const STATIC_TITLE = "TOEIC頻出単語の覚え方【スコア帯別ガイド】| Loop Vocabulary";
const DYNAMIC_TITLE_MARKER = "600→800点";

// 静的版にしか存在しない見出し・本文フレーズ(動的版のマークダウン本文には
// 出てこない表現を選んでいる)。
const STATIC_ONLY_HEADINGS = [
  "TOEICと語彙の関係",
  "スコア帯を目安にした語彙学習例",
  "他の英語試験との違い",
  "よくある質問",
];
const STATIC_ONLY_PHRASES = [
  "語彙力はTOEICのスコアに影響する要素の一つです", // 30〜40%claim修正後の表現(静的版の独自表現)
  "特定のスコアと必要とされる語彙の数を直接対応づけません", // (2026-07-24) 具体的な語彙数を削除した後の出典注記(静的版の独自表現)
  "以下は公式の出題区分ではなく、学習内容を整理するための一例です", // (2026-07-24) スコア帯別セクションの必須注記(静的版の独自表現)
  "学習テーマ例", // (2026-07-24) 「頻出トピック」から変更したラベル(静的版の独自表現)
  "類義語のニュアンスを確認する", // 新規追加したTIPS(静的版の独自表現)
  "問題演習で出会った語句", // (2026-07-25) 結論の修正後表現(静的版の独自表現)
  "現在の弱点に関係する語彙", // (2026-07-25) 結論の修正後表現(静的版の独自表現)
  "基本的なビジネス動詞", // (2026-07-25) 「日常ビジネス動詞100語」から数値を削除した表現(静的版の独自表現)
  "英語のビジネス記事を読む習慣をつける", // (2026-07-25) 見出しと本文の不一致を解消した表現(静的版の独自表現)
  "スコア帯を目安に整理した語彙学習例と復習方法を紹介", // (2026-07-25) ヒーロー説明の修正後表現(静的版の独自表現)
];

// 動的版のマークダウン本文にしか存在しないフレーズ。これらが検出された場合は
// 動的版が配信されている(ルーティング競合の回帰)ことを意味する。
const DYNAMIC_ONLY_PHRASES = [
  DYNAMIC_TITLE_MARKER,
  "毎朝5分のフラッシュカード復習", // 動的版の継続システムセクション固有フレーズ
  "TOEICスコアアップの本質", // 動的版のまとめセクション固有フレーズ
];

// 監査前の静的版に存在していた、根拠のない断定表現・保証表現を回帰防止として
// チェックする。
const unverifiedClaimPhrases = [
  "語彙力がスコアの30〜40%を左右",
  "最短ルート",
  "最短合格への道",
  "完全対策",
  "600点突破のために3,000語",
  "必要語彙数：",
  "スコア別必須リスト",
  "確実に定着",
  "最も効率的",
  "正答率も上がる",
  // (2026-07-24 再修正) 具体的なスコア別語彙数と、その未裏付けな出典注記の再発防止
  "3,000語",
  "5,000語",
  "7,000語",
  "10,000語+",
  "市販教材や過去の学習法で広く言及",
  "必要語彙数",
  "語彙数の目安：",
  "600点までは日常業務の基本動詞",
  "730点前後からは財務・人事",
  "860点以降は法務・マーケティング",
  "頻出度ランクが明確",
  // (2026-07-25 再修正) 結論・スコアカード・見出し不一致の再発防止
  "目標スコア帯に出やすい語彙",
  "語彙問題が増える",
  "日常ビジネス動詞100語",
  "英語ビジネスメールを読む習慣をつける",
  "週2〜3記事",
  "スコア帯別の頻出語彙から",
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
    if (h1?.includes("TOEIC頻出単語") && h1.includes("スコア帯別ガイド") && !h1.includes(DYNAMIC_TITLE_MARKER)) {
      ok(`H1が修正後の内容と一致している: "${h1.trim()}"`);
    } else {
      fail(`H1が想定と異なる: "${h1}"`);
    }

    const bodyText = await page.locator("body").innerText();

    // ---- 3. 静的版にしか存在しない見出し・フレーズがすべて存在する ----
    const missingHeadings = STATIC_ONLY_HEADINGS.filter((h) => !bodyText.includes(h));
    if (missingHeadings.length === 0) {
      ok("静的版の主要見出し(TOEICと語彙の関係・スコア帯を目安にした語彙学習例・他の英語試験との違い・よくある質問)がすべて表示されている");
    } else {
      fail(`静的版の見出しが一部見つからない: ${missingHeadings.join(", ")}`);
    }

    const missingPhrases = STATIC_ONLY_PHRASES.filter((p) => !bodyText.includes(p));
    if (missingPhrases.length === 0) {
      ok("今回統合・修正した内容の静的版固有フレーズがすべて表示されている");
    } else {
      fail(`統合・修正したはずの内容の一部が見つからない: ${missingPhrases.join(", ")}`);
    }

    // ---- 4. 結論ブロックが実際の内容に即した文言になっている ----
    if (bodyText.includes("結論:") && bodyText.includes("問題演習で出会った語句や現在の弱点に関係する語彙を整理し") && bodyText.includes("必要な学習量は現在の実力や目標、学習状況によって異なる")) {
      ok("結論ブロックが軟化後の文言で表示されている");
    } else {
      fail("結論ブロックが想定の文言で見つからない");
    }

    // ---- 5. 他の英語試験との比較表(動的版から統合)が表示されている ----
    const comparisonTerms = ["英検2級", "IELTS", "大学受験"];
    const missingComparison = comparisonTerms.filter((c) => !bodyText.includes(c));
    if (missingComparison.length === 0) {
      ok("他の英語試験との比較表が統合されている");
    } else {
      fail(`他の英語試験との比較表の一部が見つからない: ${missingComparison.join(", ")}`);
    }

    // ---- 6. 動的版固有のフレーズが混入していない(ルーティング競合の回帰検知) ----
    const foundDynamicPhrases = DYNAMIC_ONLY_PHRASES.filter((p) => bodyText.includes(p));
    if (foundDynamicPhrases.length === 0) {
      ok("動的版固有のフレーズが混入していない(動的版が配信されていないことを確認)");
    } else {
      fail(`動的版固有のフレーズが検出された(ルーティング競合の回帰の可能性): ${foundDynamicPhrases.join(", ")}`);
    }

    // ---- 7. 監査前の不正確な断定表現・保証表現が残っていない ----
    const foundUnverifiedClaims = unverifiedClaimPhrases.filter((p) => bodyText.includes(p));
    if (foundUnverifiedClaims.length === 0) {
      ok("監査前の不正確な断定表現・スコア保証表現が本文に含まれていない");
    } else {
      fail(`監査前の断定・保証表現が見つかった: ${foundUnverifiedClaims.join(", ")}`);
    }

    // ---- 8. GuideMaterialCTAが動的版と同じ1件(実在する教材のみ)になっている ----
    // (Issue #127・本番リンク切れ監査で発見): 「TOEIC頻出基礎単語」
    // (96d6e5a2-c0f5-48b1-8eed-14a91424790f)は実データが投入されておらず
    // 常に404だったため、静的版・動的版([slug]/page.tsx)の両方から削除した。
    // 現在は実在する「TOEIC 頻出単語 2500」のみを案内する。
    const materialTitles = ["TOEIC 頻出単語 2500"];
    const removedMaterialTitle = "TOEIC頻出基礎単語";
    const missingMaterials = materialTitles.filter((m) => !bodyText.includes(m));
    if (missingMaterials.length === 0) {
      ok("GuideMaterialCTAが動的版と同じ1教材(TOEIC 頻出単語 2500)で表示されている");
    } else {
      fail(`教材CTAの一部が見つからない: ${missingMaterials.join(", ")}`);
    }
    if (!bodyText.includes(removedMaterialTitle)) {
      ok("リンク切れだった「TOEIC頻出基礎単語」への参照が残っていない");
    } else {
      fail("リンク切れの「TOEIC頻出基礎単語」への参照が残っている");
    }
    const materialOccurrences = materialTitles.map((m) => (bodyText.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length);
    if (materialOccurrences.every((c) => c === 1)) {
      ok("教材CTAの各タイトルが重複せず1回ずつ表示されている");
    } else {
      fail(`教材CTAの表示回数が想定外(重複表示の可能性): ${materialTitles.map((m, i) => `${m}=${materialOccurrences[i]}`).join(", ")}`);
    }

    // ---- 9. FAQPage JSON-LDと可視FAQ ----
    const html = await page.content();
    const faqLdCount = (html.match(/"@type":"FAQPage"/g) || []).length;
    if (faqLdCount === 1 && bodyText.includes("よくある質問")) {
      ok("FAQPage JSON-LDと可視FAQが両方存在する");
    } else {
      fail(`FAQPage JSON-LDまたは可視FAQが不足している(faqLdCount=${faqLdCount})`);
    }

    // ---- 10. Article・BreadcrumbList JSON-LD + datePublished/dateModified ----
    const hasArticleLd = html.includes('"@type":"Article"');
    const hasBreadcrumbLd = html.includes('"@type":"BreadcrumbList"');
    const hasDatePublished = html.includes('"datePublished":"2024-10-01"');
    const hasDateModified = html.includes('"dateModified":"2026-07-25"');
    if (hasArticleLd && hasBreadcrumbLd) {
      ok("Article・BreadcrumbList JSON-LDが出力されている");
    } else {
      fail(`JSON-LDが不足している (Article=${hasArticleLd}, Breadcrumb=${hasBreadcrumbLd})`);
    }
    if (hasDatePublished) {
      ok("Article JSON-LDのdatePublished(2024-10-01)が出力されている");
    } else {
      fail("Article JSON-LDのdatePublished(2024-10-01)が見つからない");
    }
    if (hasDateModified) {
      ok("Article JSON-LDにdateModified(2026-07-25)が出力されている");
    } else {
      fail("Article JSON-LDにdateModified(2026-07-25)が見つからない");
    }

    // ---- 11. ExamInfoDisclaimer(出典注記・最終確認日)が表示されている ----
    const disclaimer = page.locator('[data-testid="exam-info-disclaimer"]');
    const lastVerified = page.locator('[data-testid="exam-info-last-verified"]');
    if ((await disclaimer.count()) > 0 && (await lastVerified.count()) > 0) {
      ok("ExamInfoDisclaimer(出典注記・最終確認日)が表示されている");
    } else {
      fail("ExamInfoDisclaimerが見つからない");
    }

    // ---- 12. /signup へのCTAが維持されている ----
    const signupLink = page.locator('a[href="/signup"]');
    if ((await signupLink.count()) > 0) ok("/signup へのCTAが維持されている");
    else fail("/signup へのCTAが見つからない");

    // ---- 13. mobile幅で横スクロールが発生しない ----
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
    console.log("\n=== test:toeic-tango-content: FAILED ===");
  } else {
    console.log("\n=== test:toeic-tango-content RESULT: all checks passed ===");
  }
}

main().catch((e) => {
  console.error("toeic-tango-content e2e crashed:", e);
  process.exit(1);
});
