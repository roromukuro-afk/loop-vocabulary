/**
 * SSR/SSGクローラー可読性監査
 *
 * Googleのクローラー(JavaScript実行なし、または実行に頼らない前提)でも
 * 主要な公開ページの本文がHTMLに直接含まれているかを、生fetch(JS実行なし)で確認する。
 * client-onlyコンポーネントで空のHTMLシェルだけが返るページが無いことを保証する。
 *
 * 確認項目:
 * 1. 各対象ページが200で取得できる
 * 2. HTMLタグを除去した本文テキストが最低文字数以上ある(空シェルでない)
 * 3. JSON-LD構造化データがHTML内に直接出力されている
 * 4. canonical/OGPタグが出力されている
 *
 * 使い方: node scripts/testing/e2e/crawler-readable-pages.mjs
 */
import { ensureDevServer, stopDevServer } from "../lib/devServer.mjs";

const PORT = Number(process.env.TEST_PORT || 3799);

// ページごとに求める最低本文文字数(タグ除去後)。
// /dictionary は検索UIがクライアント側で結果を出す性質上、シェル自体の
// 説明文・導線テキストのみで足りる基準にする。
const PAGES = [
  { path: "/", minText: 2000, needsJsonLd: true },
  { path: "/guide", minText: 3000, needsJsonLd: true },
  { path: "/guide/how-to-memorize-english-words", minText: 1500, needsJsonLd: true },
  { path: "/guide/eiken-vocabulary-study", minText: 1500, needsJsonLd: true },
  { path: "/materials", minText: 3000, needsJsonLd: true },
  { path: "/materials/highschool", minText: 1500, needsJsonLd: true },
  { path: "/materials/eiken", minText: 1500, needsJsonLd: true },
  { path: "/materials/university-exam", minText: 1500, needsJsonLd: true },
  { path: "/materials/school-test", minText: 1500, needsJsonLd: true },
  { path: "/dictionary", minText: 300, needsJsonLd: true },
  { path: "/about", minText: 1000, needsJsonLd: true },
  { path: "/press", minText: 800, needsJsonLd: false },
  { path: "/privacy", minText: 2000, needsJsonLd: false },
  { path: "/faq", minText: 1500, needsJsonLd: true },
  { path: "/contact", minText: 500, needsJsonLd: false },
];

function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const { url: baseUrl, proc } = await ensureDevServer(PORT);
  let failed = 0;

  try {
    for (const { path, minText, needsJsonLd } of PAGES) {
      const res = await fetch(`${baseUrl}${path}`);
      if (res.status !== 200) {
        console.log(`❌ ${path}: expected 200, got ${res.status}`);
        failed++;
        continue;
      }
      const html = await res.text();
      const text = stripToText(html);

      if (text.length < minText) {
        console.log(`❌ ${path}: 本文が${text.length}字しかない(最低${minText}字必要) — client-onlyの空シェルの可能性`);
        failed++;
      } else {
        console.log(`✅ ${path}: SSR本文 ${text.length}字を確認`);
      }

      const jsonLdCount = (html.match(/application\/ld\+json/g) || []).length;
      if (needsJsonLd && jsonLdCount === 0) {
        console.log(`❌ ${path}: JSON-LD構造化データがHTML内に見つからない`);
        failed++;
      } else if (needsJsonLd) {
        console.log(`✅ ${path}: JSON-LD ${jsonLdCount}個を確認`);
      }

      const hasCanonical = /<link rel="canonical"/.test(html);
      if (!hasCanonical) {
        console.log(`❌ ${path}: canonicalタグが見つからない`);
        failed++;
      }

      const hasOgTitle = /property="og:title"|name="og:title"/.test(html) || /<meta property="og:title"/.test(html);
      if (!hasOgTitle) {
        console.log(`ℹ️  ${path}: OGP og:title が見つからない(致命的ではないが要確認)`);
      }
    }

    if (failed > 0) {
      console.log(`\n=== crawler-readable-pages: ${failed}件失敗 ===`);
      process.exitCode = 1;
    } else {
      console.log("\n=== crawler-readable-pages: ALL CHECKS PASSED ===");
    }
  } finally {
    stopDevServer(proc);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
