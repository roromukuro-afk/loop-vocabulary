/**
 * Codexレビュー指摘(P2, PR #86): "Allow crawlers to observe the noindex directive"
 * の修正を検証する。
 *
 * SHARED_WORDBOOKS_DESIGN.md 5章の方針どおり、共有ページ(/share/[code])を
 * noindex,nofollow化しつつ、robots.txtの`Disallow: /share/`は外す(noindexタグを
 * クローラーに読ませるにはクロール自体を許可する必要があるため)。この2つは
 * セットで初めて機能する契約であり、片方だけの変更・消し忘れを検出する。
 *
 * ## なぜソースコード確認方式なのか
 * page.tsxのmetadata・robots.txtはいずれも静的ファイルであり、実DB・実HTTPに
 * 依存せず直接テキスト検証できる。migration/API系のテストと契約が異なるため、
 * 混在させず専用ファイルとして分離する。
 *
 * 使い方: node scripts/testing/test-shared-wordbook-indexing.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = resolve(__dirname, "../../src/app/share/[code]/page.tsx");
const ROBOTS_PATH = resolve(__dirname, "../../public/robots.txt");

let pass = 0;
let fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

function main() {
  const pageSource = readFileSync(PAGE_PATH, "utf8");
  const robotsSource = readFileSync(ROBOTS_PATH, "utf8");

  // --- 1. page.tsxのmetadataがindex: false・follow: falseの両方を持つこと ---
  const hasNoindexNofollow = /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(pageSource);
  if (hasNoindexNofollow) {
    ok("/share/[code]のmetadataがrobots: { index: false, follow: false }を持つ(SHARED_WORDBOOKS_DESIGN.md 5章の推奨契約と一致)");
  } else {
    bad("/share/[code]のmetadataがindex: false, follow: falseの形で見つからない");
  }

  // --- 2. index: trueを受理しないこと(誤ってindex許可へ戻されていないか) ---
  const hasIndexTrue = /index:\s*true/.test(pageSource);
  if (!hasIndexTrue) {
    ok("/share/[code]のmetadataにindex: trueが存在しない");
  } else {
    bad("/share/[code]のmetadataにindex: trueが検出された(noindex契約に反する)");
  }

  // --- 3. robots.txt全体でDisallow: /share/が0件であること
  //         (User-agent: * / OAI-SearchBot / PerplexityBotの3ブロックいずれの
  //         消し忘れもここでまとめて検出する) ---
  const shareDisallowCount = (robotsSource.match(/Disallow:\s*\/share\//g) ?? []).length;
  if (shareDisallowCount === 0) {
    ok("robots.txt全体でDisallow: /share/が0件(noindexタグをクローラーに読ませるためクロールを許可している)");
  } else {
    bad(`robots.txtにDisallow: /share/が${shareDisallowCount}件残っている(noindexタグがクローラーに読まれない)`);
  }

  // --- 4. training crawler policy(GPTBot/ClaudeBot/Google-Extended)の
  //         Disallow: /は維持されていること(今回の変更対象ではない) ---
  const trainingBots = ["GPTBot", "ClaudeBot", "Google-Extended"];
  for (const bot of trainingBots) {
    const blockMatch = robotsSource.match(new RegExp(`User-agent:\\s*${bot}\\s*\\n\\s*Disallow:\\s*/\\s*(?:\\n|$)`));
    if (blockMatch) {
      ok(`robots.txtの${bot}ブロックがDisallow: /を維持している(training crawler policyは今回変更しない)`);
    } else {
      bad(`robots.txtの${bot}ブロック(Disallow: /)が見つからない(training crawler policyが意図せず変更された可能性)`);
    }
  }

  // --- 5. Disallow: /share/を外した3ブロック(*・OAI-SearchBot・
  //         PerplexityBot)のUser-agent行自体は引き続き存在すること
  //         (bot policy blockそのものを誤って削除していないことの確認) ---
  const searchBots = ["\\*", "OAI-SearchBot", "PerplexityBot"];
  const searchBotLabels = ["*", "OAI-SearchBot", "PerplexityBot"];
  searchBots.forEach((botPattern, i) => {
    const hasBlock = new RegExp(`User-agent:\\s*${botPattern}\\s*\\n`).test(robotsSource);
    if (hasBlock) {
      ok(`robots.txtのUser-agent: ${searchBotLabels[i]}ブロックが引き続き存在する(block自体を誤って削除していない)`);
    } else {
      bad(`robots.txtのUser-agent: ${searchBotLabels[i]}ブロックが見つからない(block自体が誤って削除された可能性)`);
    }
  });

  console.log(`\n=== test:shared-wordbook-indexing RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
