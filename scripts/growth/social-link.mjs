/**
 * SNS投稿用のUTM付きリンクを生成する内部ヘルパー(Issue #97 Phase 3)。
 *
 * 人間が投稿のたびにUTMクエリを手入力すると、utm_source/medium/campaign/content の
 * 表記ゆれ(大文字小文字・アンダースコア/ハイフン混在等)が発生しやすい。このスクリプトは
 * URLを生成して表示するだけで、外部SNSへの自動投稿・DB書き込みは一切行わない。
 *
 * 使い方:
 *   npm run growth:social-link -- --source=x --campaign=vocab-test-maker --content=quiz-001 --path=/tools/vocab-test-maker
 *   npm run growth:social-link -- --source=instagram --campaign=vocab_test_maker_launch --content=ig_feed_launch --path=/tools/vocab-test-maker --medium=social
 *
 * --medium は省略可(デフォルト "social")。--path は "/" から始まる相対パスのみ受け付ける
 * (外部ドメインへのオープンリダイレクト生成を防ぐため、絶対URLは拒否する)。
 */
import { pathToFileURL } from "node:url";

const SITE_URL = "https://loop-vocabulary.app";

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * 純粋関数: 与えられたUTMパラメータからSNS投稿用の完成URLを組み立てる。
 * source/campaign/content/path は必須(欠けていれば分かりやすいエラーで例外を投げる)。
 * pathは"/"始まりの相対パスのみ許可(絶対URL・プロトコル相対URLは拒否)。
 */
export function buildSocialLink({ source, campaign, content, path, medium = "social", baseUrl = SITE_URL }) {
  const missing = ["source", "campaign", "content", "path"].filter(
    (k) => !{ source, campaign, content, path }[k],
  );
  if (missing.length > 0) {
    throw new Error(`必須パラメータが不足しています: ${missing.join(", ")}`);
  }
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`--path は "/" で始まる相対パスのみ指定できます(絶対URL・プロトコル相対URLは不可): ${path}`);
  }

  const url = new URL(path, baseUrl);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);

  return { fullUrl: url.toString(), source, medium, campaign, content, path };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  try {
    result = buildSocialLink(args);
  } catch (err) {
    console.error(`[growth:social-link] ${err.message}`);
    console.error(
      "使い方: npm run growth:social-link -- --source=<x/instagram/threads/...> --campaign=<name> --content=<id> --path=/tools/vocab-test-maker [--medium=social]",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`完成URL: ${result.fullUrl}`);
  console.log(`source: ${result.source}`);
  console.log(`medium: ${result.medium}`);
  console.log(`campaign: ${result.campaign}`);
  console.log(`content: ${result.content}`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) main();
