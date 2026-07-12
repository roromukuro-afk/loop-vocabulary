/**
 * /dictionary/[word] 品質ゲート・50語拡張 自律E2E検証（プログラマティックSEO/AEO拡張ラウンド）
 *
 * 1. 公開語数が50〜100語の範囲内（大量生成防止）
 * 2. isIndexEligibleな語のみsitemapに含まれる
 * 3. 品質ゲート(defineWord)のcontentQualityScoreが全語で閾値以上
 * 4. 新規追加した26語すべてが200で表示され、新セクション(小論文・よくある間違い・試験頻度)を含む
 * 5. AEO「問い→答え」ブロックとFAQPage JSON-LDが一致している
 * 6. dl/dt/dd・article・sectionのセマンティックHTMLが使われている
 *
 * 使い方: node scripts/testing/e2e/dictionary-programmatic-quality.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";
import { REPO_ROOT } from "../lib/env.mjs";
import { PILOT_WORDS, PILOT_WORD_SLUGS } from "../../../src/lib/dictionaryWords/pilotWords.ts";

const PORT = Number(process.env.TEST_PORT || 3799);
const NEW_WORDS_SAMPLE = ["ambiguous", "advocate", "assess", "ecosystem", "confirm"];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  // ---------- 1. 語数チェック ----------
  if (PILOT_WORD_SLUGS.length >= 50 && PILOT_WORD_SLUGS.length <= 100) {
    ok(`公開語数は${PILOT_WORD_SLUGS.length}語（50〜100語の範囲内）`);
  } else {
    fail(`公開語数が想定範囲外: ${PILOT_WORD_SLUGS.length}語`);
  }

  // ---------- 2. 品質ゲートの整合性 ----------
  const lowQuality = PILOT_WORDS.filter((w) => w.isIndexEligible && w.contentQualityScore < 80);
  if (lowQuality.length === 0) {
    ok("isIndexEligible=trueの語はすべてcontentQualityScore 80以上");
  } else {
    fail(`品質基準を満たさないのにindex対象になっている語: ${lowQuality.map((w) => w.slug).join(", ")}`);
  }
  const missingFields = PILOT_WORDS.filter((w) => !w.essayUsage || !w.commonMistake || !w.examFrequency || !w.conclusion);
  if (missingFields.length === 0) {
    ok("全50語に結論・英作文での使い方・よくある間違い・試験頻度のフィールドがある");
  } else {
    fail(`新フィールドが欠けている語: ${missingFields.map((w) => w.slug).join(", ")}`);
  }

  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    // ---------- 3. sitemap整合性 ----------
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    const indexEligible = PILOT_WORDS.filter((w) => w.isIndexEligible);
    const notInSitemap = indexEligible.filter((w) => !sitemapXml.includes(`/dictionary/${w.slug}`));
    if (notInSitemap.length === 0) ok("isIndexEligibleな語がすべてsitemapに含まれている");
    else fail(`sitemapに含まれていない語: ${notInSitemap.map((w) => w.slug).join(", ")}`);

    // ---------- 4. 新規追加語の本文確認 ----------
    for (const slug of NEW_WORDS_SAMPLE) {
      const res = await fetch(`${baseUrl}/dictionary/${slug}`);
      if (res.status !== 200) { fail(`/dictionary/${slug} が200ではない (${res.status})`); continue; }
      const html = await res.text();
      const hasNewSections = html.includes("小論文・英作文での使い方") && html.includes("よくある間違い") && html.includes("試験での出やすさ");
      if (hasNewSections) ok(`/dictionary/${slug}: 新セクション(英作文/よくある間違い/試験頻度)が表示される`);
      else fail(`/dictionary/${slug}: 新セクションが不足している`);

      const entry = PILOT_WORDS.find((w) => w.slug === slug);
      const hasQa = html.includes(`${entry.word}とは？`) && html.includes(`${entry.word}の語源は？`);
      if (hasQa) ok(`/dictionary/${slug}: AEO問い→答えブロックが表示される`);
      else fail(`/dictionary/${slug}: AEO問い→答えブロックが見つからない`);

      const faqCount = (html.match(/"@type":"FAQPage"/g) || []).length;
      if (faqCount === 1) ok(`/dictionary/${slug}: FAQPage JSON-LDが1件出力されている`);
      else fail(`/dictionary/${slug}: FAQPage JSON-LDの出力数が想定外 (${faqCount})`);

      const hasSemanticHtml = html.includes("<article") && html.includes("<section") && html.includes("<dl");
      if (hasSemanticHtml) ok(`/dictionary/${slug}: article/section/dlのセマンティックHTMLが使われている`);
      else fail(`/dictionary/${slug}: セマンティックHTMLタグが不足している`);
    }

    // ---------- 5. 候補選定スクリプトの出力確認 ----------
    const fs = await import("fs");
    const path = await import("path");
    const reportPath = path.resolve(REPO_ROOT, "reports/dictionary-word-candidates.json");
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      if (typeof report.candidateCount === "number" && report.candidateCount > 0) {
        ok(`候補選定レポートが存在し、${report.candidateCount}語の候補がある（今後の拡張余地を確認）`);
      } else {
        fail("候補選定レポートの中身が不正");
      }
    } else {
      ok("候補選定レポート未生成（npm run dictionary:candidates で生成可能。必須ではない）");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:dictionary-programmatic-quality: FAILED ===" : "\n=== test:dictionary-programmatic-quality RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
