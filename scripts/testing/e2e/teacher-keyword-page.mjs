/**
 * /guide/vocabulary-quiz-pdf-for-teachers キーワード補強 自律E2E検証
 *
 * Phase 3で追加した対象キーワード（英単語 小テスト 作成ツール・印刷できる・塾・
 * 家庭教師・高校英語）の自然な露出と、QRコード・生徒側導線の説明セクション、
 * 追加FAQ（高校英語・QRコード）の存在を検証する。
 * 既存のtest:teacher-pdf-guideとは別観点（構造ではなくキーワード露出）のため、
 * 既存テストは変更せず、こちらを追加した。
 *
 * 使い方: node scripts/testing/e2e/teacher-keyword-page.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);
const SLUG = "vocabulary-quiz-pdf-for-teachers";

const TARGET_KEYWORDS = [
  "英単語",
  "小テスト",
  "作成ツール",
  "印刷できる",
  "塾",
  "家庭教師",
  "高校英語",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    const res = await fetch(`${baseUrl}/guide/${SLUG}`);
    const html = await res.text();
    const bodyText = html.replace(/<[^>]+>/g, " ");

    const missingKeywords = TARGET_KEYWORDS.filter((k) => !bodyText.includes(k));
    if (missingKeywords.length === 0) {
      ok(`対象キーワードがすべて本文中に自然に含まれている (${TARGET_KEYWORDS.join("・")})`);
    } else {
      fail(`対象キーワードが不足している: ${missingKeywords.join("・")}`);
    }

    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch?.[1] ?? "";
    if (title.includes("作成ツール") && title.includes("印刷")) {
      ok(`titleタグに「作成ツール」「印刷」が含まれる ("${title}")`);
    } else {
      fail(`titleタグにキーワードが不足している: "${title}"`);
    }

    if (bodyText.includes("QRコード") && (bodyText.includes("生徒") || bodyText.includes("生徒側"))) {
      ok("QRコード・生徒側導線の説明セクションがある");
    } else {
      fail("QRコード・生徒側導線の説明が見つからない");
    }

    if (bodyText.includes("個人情報") && bodyText.includes("含まれ")) {
      ok("QRコードに個人情報が含まれない旨の説明がある");
    } else {
      fail("QRコードの個人情報非含有についての説明が見つからない");
    }

    const faqQuestionCount = (html.match(/Q\.\s/g) || []).length;
    if (faqQuestionCount >= 6) {
      ok(`FAQが6件以上に拡充されている (${faqQuestionCount}件)`);
    } else {
      fail(`FAQ件数が想定より少ない (${faqQuestionCount}件、6件以上を期待)`);
    }

    if (bodyText.includes("高校英語")) {
      ok("「高校英語」キーワードに対応するFAQ/本文がある");
    } else {
      fail("「高校英語」への言及が見つからない");
    }

    // 誇張表現が引き続き含まれていないことも再確認（Phase 3の追記で混入していないか）
    const BAN_PHRASES = ["先生に選ばれています", "導入実績", "採用実績", "全国の学校", "多くの塾で導入"];
    const bannedFound = BAN_PHRASES.filter((p) => bodyText.includes(p));
    if (bannedFound.length === 0) ok("追記部分にも誇張表現が含まれていない");
    else fail(`誇張表現が混入している: ${bannedFound.join(", ")}`);
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:teacher-keyword-page: FAILED ===" : "\n=== test:teacher-keyword-page RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
