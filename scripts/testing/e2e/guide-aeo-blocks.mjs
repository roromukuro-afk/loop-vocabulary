/**
 * guide記事のAEO強化(結論ブロック・H2直下回答・比較表table化) 自律E2E検証
 * （プログラマティックSEO/AEO拡張ラウンド Phase 4）
 *
 * 使い方: node scripts/testing/e2e/guide-aeo-blocks.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// 「結論:」ブロックを追加した10記事
const ENHANCED_SLUGS = [
  "eitango-oboeru-houhou",
  "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice",
  "eiken-vocabulary-study",
  "university-exam-vocabulary",
  "school-test-vocabulary",
  "listening-and-pronunciation-vocabulary",
  "ai-vocabulary-learning",
  "toeic-tango",
  "eiken-2kyu-tango",
];

function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exitCode = 1; }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  const dev = await ensureDevServer(PORT);
  const baseUrl = dev.url;

  try {
    for (const slug of ENHANCED_SLUGS) {
      const res = await fetch(`${baseUrl}/guide/${slug}`);
      if (res.status !== 200) { fail(`/guide/${slug} が200ではない (${res.status})`); continue; }
      const html = await res.text();
      const bodyText = html.replace(/<[^>]+>/g, " ");

      if (bodyText.includes("結論:") || bodyText.includes("結論：")) {
        ok(`/guide/${slug}: 冒頭の結論ブロックがある`);
      } else {
        fail(`/guide/${slug}: 結論ブロックが見つからない`);
      }
    }

    // 比較表table化(flashcards-vs-multiple-choice)
    const res = await fetch(`${baseUrl}/guide/flashcards-vs-multiple-choice`);
    const html = await res.text();
    if (html.includes("<table") && html.includes("<thead") && html.includes("<tbody")) {
      ok("/guide/flashcards-vs-multiple-choice: 比較表がtable要素で実装されている");
    } else {
      fail("/guide/flashcards-vs-multiple-choice: table要素が見つからない");
    }

    // FAQPage JSON-LDと可視本文の整合性(既存記事が壊れていないことの再確認)
    const faqCount = (html.match(/"@type":"FAQPage"/g) || []).length;
    if (faqCount === 1 && html.includes("よくある質問")) {
      ok("/guide/flashcards-vs-multiple-choice: FAQPage JSON-LDと可視本文が両方ある");
    } else {
      fail("/guide/flashcards-vs-multiple-choice: FAQPage JSON-LDまたは可視FAQが不足");
    }
  } finally {
    stopDevServer(dev);
  }

  console.log(process.exitCode ? "\n=== test:guide-aeo-blocks: FAILED ===" : "\n=== test:guide-aeo-blocks RESULT: all checks passed ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
