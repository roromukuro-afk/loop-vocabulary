/**
 * SNS投稿用のUTM付きリンクを生成する内部ヘルパー(Issue #97 Phase 3)。
 *
 * 人間が投稿のたびにUTMクエリを手入力すると、utm_source/medium/campaign/content の
 * 表記ゆれ(大文字小文字・アンダースコア/ハイフン混在等)が発生しやすい。このスクリプトは
 * URLを生成して表示するだけで、外部SNSへの自動投稿・DB書き込みは一切行わない。
 *
 * 使い方:
 *   npm run growth:social-link -- --source=x --campaign=vocab_test_maker --content=quiz_001 --path=/tools/vocab-test-maker
 *   npm run growth:social-link -- --source=instagram --campaign=vocab_test_maker_launch --content=ig_feed_launch --path=/tools/vocab-test-maker
 *
 * utm_mediumは常に"social"に固定する(--medium指定は受け付けない。Codexレビュー
 * 指摘対応): このスクリプトはSNS投稿用リンクの生成専用であり、
 * scripts/testing/social-acquisition-snapshot.mjsのclassifySocialBucket()は
 * medium==="social"を厳密一致で要求する(Instagramストーリー等の区別はmediumではなく
 * utm_content側で行う設計、例: ig_feed_launch vs ig_story_launch)。--mediumを
 * 呼び出し側の自由入力にすると、"story"等のsocial以外の値を指定できてしまい、
 * 生成したリンク経由の流入が集計から丸ごと消えてしまっていた。
 *
 * --path は "/" から始まる相対パスのみ受け付ける
 * (外部ドメインへのオープンリダイレクトを防ぐため、絶対URLは拒否する)。
 *
 * pathの検証はstartsWith("/")の文字列パターンだけでなく、実際にnew URL()で解決した
 * 結果のoriginをbaseUrlのoriginと突き合わせて確認する(Codexレビュー指摘対応:
 * "/\evil.example/x" のような、先頭1文字は"/"だが2文字目がバックスラッシュのパスは、
 * WHATWG URLパーサがhttps等のspecialスキームでバックスラッシュを"/"と同等に扱うため
 * `new URL("/\\evil.example/x", "https://loop-vocabulary.app")` が
 * `https://evil.example/x` に解決されてしまい、文字列パターンチェックだけでは
 * すり抜ける。originを直接比較する方が、個々のバイパス手口を後追いで塞ぐより堅牢)。
 *
 * source/campaign/contentは英数字・アンダースコアのみへ強制する(Codexレビュー
 * 指摘対応、2巡目): このスクリプトの目的はまさに「表記ゆれ(大文字小文字・
 * アンダースコア/ハイフン混在等)の防止」だが、当初はハイフンとアンダースコアの
 * 両方をそのまま許容していたため、同じ論理的な識別子を"vocab_test_maker"と
 * "vocab-test-maker"のように別表記で入力すると、集計側では別のcampaign/content
 * として分裂してしまっていた。ハイフンはアンダースコアへ正規化した上で、
 * 英数字・アンダースコアのみへ強制する(大文字は自動で小文字化)。
 *
 * 正規化後の値が100文字を超える場合は拒否する(Codexレビュー指摘対応、3巡目):
 * src/lib/analytics/track.tsのdetectTrafficSource()がutm_source/campaign/content
 * をそれぞれ100文字で.slice()して記録するため、101文字目以降で初めて区別される
 * ような識別子を生成すると、実際に記録される値(切り詰め後)と生成したリンクの
 * 見た目上の値が食い違い、集計側で意図しない識別子どうしが同一視されてしまう。
 */
import { pathToFileURL } from "node:url";

const SITE_URL = "https://loop-vocabulary.app";
const FIXED_MEDIUM = "social";

// source/campaign/contentの許容パターン(小文字英数字・アンダースコアのみ)。
// 既に小文字化・ハイフン→アンダースコア正規化・trim済みの値に対して適用する。
const IDENTIFIER_PATTERN = /^[a-z0-9_]+$/;

// src/lib/analytics/track.tsのdetectTrafficSource()が実際に記録時に適用する
// 切り詰め長と一致させる(そちらを変更した場合はここも合わせて変更すること)。
const MAX_IDENTIFIER_LENGTH = 100;

function normalizeIdentifier(paramName, rawValue) {
  // 大文字小文字はここで自動的に統一し(--source=Xと--source=xを同一視)、
  // ハイフンもアンダースコアへ正規化する(vocab-test-makerとvocab_test_makerを
  // 同一視し、区切り文字違いによる集計分裂を防ぐ。Codexレビュー指摘対応、2巡目)。
  // それでもなお許容パターンに一致しない場合(空白・その他の記号・非ASCII文字等)は、
  // 自動変換で表記ゆれを吸収できないため明示的に拒否する。
  const normalized = rawValue.trim().toLowerCase().replace(/-/g, "_");
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new Error(
      `--${paramName} は英数字・アンダースコア(またはハイフン、自動でアンダースコアへ変換されます)のみ` +
        `使用できます(空白・その他の記号・非ASCII文字等は使用できません): ${rawValue}`,
    );
  }
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `--${paramName} は正規化後${MAX_IDENTIFIER_LENGTH}文字以内である必要があります(track.tsの記録時` +
        `切り詰めと不一致になるため): ${normalized.length}文字 "${normalized}"`,
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
export function buildSocialLink({ source, campaign, content, path, baseUrl = SITE_URL }) {
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

  const url = new URL(path, baseUrl);
  const expectedOrigin = new URL(baseUrl).origin;
  if (url.origin !== expectedOrigin) {
    throw new Error(
      `--path の解決結果が想定外のoriginになりました(オープンリダイレクト対策で拒否): ` +
        `path=${path} -> resolved origin=${url.origin} (期待値: ${expectedOrigin})`,
    );
  }
  url.searchParams.set("utm_source", normalizedSource);
  url.searchParams.set("utm_medium", FIXED_MEDIUM);
  url.searchParams.set("utm_campaign", normalizedCampaign);
  url.searchParams.set("utm_content", normalizedContent);

  return {
    fullUrl: url.toString(),
    source: normalizedSource,
    medium: FIXED_MEDIUM,
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
      "使い方: npm run growth:social-link -- --source=<x/instagram/threads/...> --campaign=<name> --content=<id> --path=/tools/vocab-test-maker",
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
