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
 *
 * pathの検証はstartsWith("/")の文字列パターンだけでなく、実際にnew URL()で解決した
 * 結果のoriginをbaseUrlのoriginと突き合わせて確認する(Codexレビュー指摘対応:
 * "/\evil.example/x" のような、先頭1文字は"/"だが2文字目がバックスラッシュのパスは、
 * WHATWG URLパーサがhttps等のspecialスキームでバックスラッシュを"/"と同等に扱うため
 * `new URL("/\\evil.example/x", "https://loop-vocabulary.app")` が
 * `https://evil.example/x` に解決されてしまい、文字列パターンチェックだけでは
 * すり抜ける。originを直接比較する方が、個々のバイパス手口を後追いで塞ぐより堅牢)。
 *
 * source/campaign/content/mediumは英数字・ハイフン・アンダースコアのみへ強制する
 * (Codexレビュー指摘対応): このスクリプトの目的はまさに「表記ゆれ(大文字小文字・
 * アンダースコア/ハイフン混在等)の防止」だが、値を無検証のまま素通ししていたため、
 * 例えば--source=Xと--source=xが別のsocialバケットとして扱われてしまう
 * (scripts/testing/social-acquisition-snapshot.mjsのclassifySocialBucket()は
 * 既知sourceを小文字の完全一致でしか認識せず、Xはother_socialへ丸められてしまう)、
 * またcampaign別レポートで大文字小文字違いの表記ゆれが別campaignとして分裂して
 * 集計される、という不具合が起き得た。空白等を含む値やアルファベット以外の文字は
 * 自動変換せず明示的に拒否する(自動小文字化だけだと、意図しない値をそのまま
 * 通してしまう余地が残るため)。
 */
import { pathToFileURL } from "node:url";

const SITE_URL = "https://loop-vocabulary.app";

// source/campaign/content/mediumの許容パターン(小文字英数字・ハイフン・
// アンダースコアのみ)。既に小文字化・trim済みの値に対して適用する。
const IDENTIFIER_PATTERN = /^[a-z0-9_-]+$/;

function normalizeIdentifier(paramName, rawValue) {
  // 大文字小文字はここで自動的に統一する(--source=Xと--source=xを同一視するため)。
  // それでもなお許容パターンに一致しない場合(空白・記号・非ASCII文字等)は、
  // 自動変換で表記ゆれを吸収できないため明示的に拒否する。
  const normalized = rawValue.trim().toLowerCase();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new Error(
      `--${paramName} は英数字・ハイフン・アンダースコアのみ使用できます(大文字小文字は自動で統一しますが、` +
        `空白・記号・非ASCII文字等は使用できません): ${rawValue}`,
    );
  }
  return normalized;
}

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

  const normalizedSource = normalizeIdentifier("source", source);
  const normalizedCampaign = normalizeIdentifier("campaign", campaign);
  const normalizedContent = normalizeIdentifier("content", content);
  const normalizedMedium = normalizeIdentifier("medium", medium);

  const url = new URL(path, baseUrl);
  const expectedOrigin = new URL(baseUrl).origin;
  if (url.origin !== expectedOrigin) {
    throw new Error(
      `--path の解決結果が想定外のoriginになりました(オープンリダイレクト対策で拒否): ` +
        `path=${path} -> resolved origin=${url.origin} (期待値: ${expectedOrigin})`,
    );
  }
  url.searchParams.set("utm_source", normalizedSource);
  url.searchParams.set("utm_medium", normalizedMedium);
  url.searchParams.set("utm_campaign", normalizedCampaign);
  url.searchParams.set("utm_content", normalizedContent);

  return {
    fullUrl: url.toString(),
    source: normalizedSource,
    medium: normalizedMedium,
    campaign: normalizedCampaign,
    content: normalizedContent,
    path,
  };
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
