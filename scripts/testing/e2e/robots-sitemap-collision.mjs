/**
 * robots.txt の意図しない prefix 衝突の再発防止テスト(サーバ起動不要、静的ファイル検証)。
 *
 * 背景(2026-07-28 Search Console調査で発見): `Disallow: /road` が単純な
 * prefix一致だったため、会員限定ページ /road だけでなく、sitemap.xmlに掲載されている
 * 公開コンテンツページ /roadmap まで意図せずクロールブロックしてしまっていた。
 *
 * 修正方法: `Disallow: /road` はそのまま維持し(/road配下を含めて引き続き
 * ブロックするため)、`Allow: /roadmap` を追加した。Googleは複数ルールが一致する
 * 場合、パターン文字列がより長く具体的なルールを優先するため、/roadmap配下では
 * `Allow: /roadmap`(8文字)が`Disallow: /road`(5文字)より優先され、許可される。
 *
 * (最初の修正案だった `Disallow: /road$` は誤りだった: Googleの "$" はクエリ文字列
 * を含むURL全体の終端を意味するため、`/road$` は `/road` のみをブロックし、
 * `/road?x=1` や `/road/lesson` はブロックできない。このテストの「2. $ の仕様」
 * セクションで、その誤りが再発しないことを明示的に検証する。)
 *
 * 同種の衝突その2(2026-08-11発見): `Disallow: /review`(ログイン必須のSRS復習画面
 * /review をブロックする意図)が、同じくprefix一致により、sitemap.xmlに掲載されている
 * 公開ツールページ /review-date-calculator も意図せずブロックしていた。`Disallow: /road`
 * + `Allow: /roadmap` と同じ手法で `Disallow: /review` + `Allow: /review-date-calculator`
 * を `User-agent: *` / `OAI-SearchBot` / `PerplexityBot` の3ブロックすべてに適用して修正。
 *
 * 検証内容:
 *   1. /road, /road?x=1, /road/, /road/lesson は引き続きブロックされる。
 *      /roadmap, /roadmap?query, /roadmap/配下 は許可される。
 *      /review, /review/history は引き続きブロックされる。
 *      /review-date-calculator, /review-date-calculator?query, /review-date-calculator/配下 は許可される。
 *   2. Googleの "$" の仕様(クエリを含むURL全体の終端)を、実際のrobots.txtとは
 *      独立に検証する(`Disallow: /road$` 単独では /road のみblocked、
 *      /road?x=1 はallowedになることを明示)。
 *   3. /test, /api/ など既存の非公開ルールは維持されている(退行していない)。
 *   4. sitemap.ts に列挙されている静的な公開URL(materials/dictionary/grammarの
 *      DB・外部データ駆動分を除く)が、どのDisallowルールにも意図せず一致しない
 *      (「/road → /roadmap」「/review → /review-date-calculator」と同種の衝突が
 *      他に潜んでいないかの広域チェック)。
 *   5. sitemap.ts のURL一覧(GUIDE_SLUGS等)が抽出ロジックの想定どおりの構造を保っており、
 *      既知の代表slugが失われていない(削除退行)ことの確認。
 *
 * 使い方: node scripts/testing/e2e/robots-sitemap-collision.mjs
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { parseRobotsTxt, isPathBlocked } from "../lib/robotsMatch.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../../..");
const ROBOTS_PATH = resolve(REPO_ROOT, "public/robots.txt");
const SITEMAP_SRC_PATH = resolve(REPO_ROOT, "src/app/sitemap.ts");

let failed = false;
function fail(msg) {
  failed = true;
  console.error(`\n❌ FAIL: ${msg}`);
}
function ok(msg) {
  console.log(`✅ ${msg}`);
}

function assertBlocked(rules, path, shouldBeBlocked, label) {
  const blocked = isPathBlocked(path, rules);
  if (blocked === shouldBeBlocked) {
    ok(`${label}: ${path} は${shouldBeBlocked ? "ブロックされる" : "ブロックされない"} (期待どおり)`);
  } else {
    fail(`${label}: ${path} の判定が想定外 (期待=${shouldBeBlocked ? "ブロック" : "許可"}, 実際=${blocked ? "ブロック" : "許可"})`);
  }
}

/**
 * sitemap.ts のソースから、DB/外部import非依存の静的パスだけを抽出する。
 * `${base}/xxx` の完全リテラル行(他の ${...} 補間を含まない行)と、
 * GUIDE_SLUGS配列から生成される /guide/<slug> を対象にする。
 */
function extractStaticSitemapPaths(sitemapSrc) {
  const paths = new Set(["/"]);

  // `${base}/literal/path` (他の${...}を含まない = 完全リテラル) を全行から抽出
  const literalRe = /\$\{base\}(\/[a-zA-Z0-9\-/]*)`/g;
  for (const m of sitemapSrc.matchAll(literalRe)) {
    paths.add(m[1]);
  }

  // GUIDE_SLUGS配列 -> /guide/<slug>
  const guideSlugsMatch = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  if (guideSlugsMatch) {
    for (const m of guideSlugsMatch[1].matchAll(/"([a-z0-9-]+)"/g)) {
      paths.add(`/guide/${m[1]}`);
    }
  }

  return [...paths].sort();
}

// GUIDE_SLUGSは記事追加のたびに正当に増え続けるため、厳密一致(===)や単純な
// 最小件数チェック(>=)だけでは不十分。さらに、単発の静的baseline配列(このファイル
// にハードコードした既知slug一覧)だけでは、このPR以降に新たに追加されたslugが
// 後で削除される回帰を検知できない(baselineを手動更新し忘れると検知漏れになる。
// Codexレビュー指摘、PR #89、2巡目)。
//
// そこで、baselineを「origin/mainの現在のsitemap.ts」から動的に取得する。これにより
// baselineは各PRのbase更新のたびに自動的に最新へ追従し、手動メンテナンスなしで
// 「このPRで新たに追加したslug以外は、mainに存在するものが全て残っている」ことを
// 常に検証できる(originが参照できない環境向けに、既知の43件への静的フォールバックも
// 用意する。2026-08-26: english-vocabulary-quiz-makerをprintable-english-vocabulary-test
// へ統合したため44件から43件に更新)。
const FALLBACK_BASELINE_GUIDE_SLUGS = [
  "vocabulary-quiz-pdf-for-teachers", "printable-english-vocabulary-test",
  "juku-vocabulary-test", "high-school-english-vocabulary-test", "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice", "eiken-vocabulary-study", "university-exam-vocabulary",
  "school-test-vocabulary", "listening-and-pronunciation-vocabulary", "ai-vocabulary-learning",
  "daigaku-juken-tango", "eiken-2kyu-tango", "eiken-jun1-tango", "eiken-1kyu-tango",
  "chugaku-eigo-tango", "eiken-conversation", "ielts-tango", "toeic-tango",
  "business-english-tango", "eitango-oboeru-houhou", "eitango-no-oboekata", "eiken-3kyu-tango",
  "eiken-jun2-tango", "eigo-hatsuon-renshu", "koukou-eigo-tango", "toeic-900ten",
  "eigo-listening-renshu", "eibunpo-kiso", "eigo-dokkai-houhou", "eitango-oboerarenai",
  "eitango-ichinichi-nanko", "genzaikanryo-kakokei-chigai", "fukikisoku-doushi-ichiran",
  "affect-vs-effect", "apply-for-vs-apply-to", "eiken-2kyu-tango-nanko", "tangocho-erabikata",
  "system-eitango", "target-1900", "systan-vs-target-1900", "leap-eitango", "eitango-cho-hikaku",
];

function extractGuideSlugs(sitemapSrc) {
  const m = sitemapSrc.match(/const GUIDE_SLUGS = \[([\s\S]*?)\] as const;/);
  if (!m) return null;
  return [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
}

/**
 * baselineを取得する。まず `git show origin/main:src/app/sitemap.ts` を試み、成功すれば
 * そこから抽出したGUIDE_SLUGSをbaselineとして使う(自動追従、メンテナンス不要)。
 * originが参照できない・抽出できない等の環境では、既知の静的フォールバックを使い、
 * その旨をコンソールへ明示する(検知漏れの可能性を静かに握りつぶさない)。
 */
// getBaselineGuideSlugs()はorigin/mainから動的取得したbaseline(isFallback=false)と、
// originを参照できない環境向けの静的フォールバック(isFallback=true)の2種類を返しうる。
// この2つは意味が異なる: 前者は「このPRのマージ前時点のmainの実際の状態」だが、後者は
// 手動更新される既知のリストで、意図的な削除(KNOWN_INTENTIONAL_REMOVALS)を反映済みの
// ことがある(実際、2026-08-26のenglish-vocabulary-quiz-maker統合時、フォールバック
// リスト自体を43件の更新後の状態へ書き換えた)。KNOWN_INTENTIONAL_REMOVALSの
// ドリフト検知(「baselineに既に存在しないなら、このエントリはもう不要」)は、
// origin/mainの実際のpre-merge状態を見ている場合にしか成立しない。フォールバック中に
// 同じロジックを適用すると、フォールバックリスト自身が更新済みであることを「本PRの
// マージでdriftした」と誤検知し、shallow clone等の環境で常に失敗してしまう
// (Codexレビュー指摘対応)。
function getBaselineGuideSlugs() {
  let mainSitemapSrc;
  try {
    mainSitemapSrc = execFileSync("git", ["show", "origin/main:src/app/sitemap.ts"], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    });
  } catch (e) {
    console.warn(
      `⚠ origin/main:src/app/sitemap.ts を取得できませんでした(${e.message})。` +
        `既知の${FALLBACK_BASELINE_GUIDE_SLUGS.length}件の静的baselineへフォールバックします` +
        `(このフォールバック中はPR単位の新規追加分の削除退行を検知できません)。`,
    );
    return { slugs: FALLBACK_BASELINE_GUIDE_SLUGS, isFallback: true };
  }
  const slugs = extractGuideSlugs(mainSitemapSrc);
  if (!slugs) {
    console.warn(
      `⚠ origin/main:src/app/sitemap.ts からGUIDE_SLUGSを抽出できませんでした。` +
        `既知の${FALLBACK_BASELINE_GUIDE_SLUGS.length}件の静的baselineへフォールバックします。`,
    );
    return { slugs: FALLBACK_BASELINE_GUIDE_SLUGS, isFallback: true };
  }
  return { slugs, isFallback: false };
}

const EXPECTED_SAMPLE_SLUGS = ["eigo-listening-renshu", "toeic-tango", "eiken-1kyu-tango"];

// PR単位で意図的に統合・削除したslug。baselineはorigin/main(このPRのマージ前時点の
// mainブランチ)から動的取得されるため、このPRで意図的に削除したslugは、マージされる
// までの間「baselineには存在するが現在は存在しない」という差分として検出されてしまう。
// ここに追加する場合は、next.config.jsのguideRedirects(308)・GUIDES一覧・関連ページからの
// 内部リンク更新を必ずセットで行うこと。
// 2026-08-26(Issue #127): english-vocabulary-quiz-makerは内容がほぼ全面的に重複していた
// printable-english-vocabulary-testへ統合し、308リダイレクトを設定した。
const KNOWN_INTENTIONAL_REMOVALS = ["english-vocabulary-quiz-maker"];

function main() {
  const robotsTxt = readFileSync(ROBOTS_PATH, "utf-8");
  const rules = parseRobotsTxt(robotsTxt);

  console.log("=== 1. /road はブロック、/roadmap は許可(今回の修正) ===");
  assertBlocked(rules, "/road", true, "会員限定ページ");
  assertBlocked(rules, "/road?x=1", true, "クエリ付き");
  assertBlocked(rules, "/road/", true, "末尾スラッシュ");
  assertBlocked(rules, "/road/lesson", true, "配下パス");

  assertBlocked(rules, "/roadmap", false, "公開ガイドページ");
  assertBlocked(rules, "/roadmap?utm_source=x", false, "クエリ付き");
  assertBlocked(rules, "/roadmap/", false, "末尾スラッシュ");
  assertBlocked(rules, "/roadmap/foo", false, "配下パス(将来追加された場合の保険)");

  console.log("\n=== 1b. /review はブロック、/review-date-calculator は許可(本PRの修正) ===");
  assertBlocked(rules, "/review", true, "ログイン必須のSRS復習画面");
  assertBlocked(rules, "/review?x=1", true, "クエリ付き");
  assertBlocked(rules, "/review/", true, "末尾スラッシュ");
  assertBlocked(rules, "/review/history", true, "配下パス");

  assertBlocked(rules, "/review-date-calculator", false, "公開ツールページ");
  assertBlocked(rules, "/review-date-calculator?utm_source=x", false, "クエリ付き");
  assertBlocked(rules, "/review-date-calculator/", false, "末尾スラッシュ");
  assertBlocked(rules, "/review-date-calculator/foo", false, "配下パス(将来追加された場合の保険)");

  console.log("\n=== 2. Googleの \"$\" 仕様の回帰確認(実際のrobots.txtとは独立) ===");
  console.log("(以前の修正案 `Disallow: /road$` は、クエリ付きURLをブロックできない誤りだった)");
  const dollarOnlyRules = parseRobotsTxt("User-agent: *\nDisallow: /road$\n");
  assertBlocked(dollarOnlyRules, "/road", true, "$アンカー単独: 完全一致");
  assertBlocked(dollarOnlyRules, "/road?x=1", false, "$アンカー単独: クエリ付きはブロックされない(Google仕様)");
  assertBlocked(dollarOnlyRules, "/roadmap", false, "$アンカー単独: 別パスはブロックされない");
  const wildcardDollarRules = parseRobotsTxt("User-agent: *\nDisallow: /*.php$\n");
  assertBlocked(wildcardDollarRules, "/file.php", true, "$+ワイルドカード: 拡張子完全一致");
  assertBlocked(wildcardDollarRules, "/file.php?id=1", false, "$+ワイルドカード: クエリ付きはブロックされない(Google仕様)");

  console.log("\n=== 3. 既存の非公開ルールが退行していない ===");
  assertBlocked(rules, "/test", true, "テスト用ページ");
  assertBlocked(rules, "/api/", true, "APIルート");
  assertBlocked(rules, "/api/foo", true, "APIサブパス");
  assertBlocked(rules, "/dashboard", true, "会員ダッシュボード");
  assertBlocked(rules, "/extract", true, "認証必須機能ページ");

  console.log("\n=== 4. sitemap.xml 掲載の公開URLがどのDisallowルールとも衝突していない ===");
  const sitemapSrc = readFileSync(SITEMAP_SRC_PATH, "utf-8");
  const staticPaths = extractStaticSitemapPaths(sitemapSrc);
  if (!staticPaths.includes("/roadmap")) {
    fail("sitemap.ts から /roadmap を抽出できなかった(抽出ロジックかsitemap.tsの構造が変わった可能性 — このテスト自体が無意味になっていないか要確認)");
  } else {
    ok(`sitemap.ts から ${staticPaths.length} 件の静的公開URLを抽出(/roadmap を含む)`);
  }
  for (const path of staticPaths) {
    assertBlocked(rules, path, false, "sitemap公開URL");
  }

  console.log("\n=== 5. sitemap.ts のGUIDE_SLUGSが退行していないことの確認 ===");
  const currentGuideSlugs = new Set(extractGuideSlugs(sitemapSrc) ?? []);
  const { slugs: baselineGuideSlugs, isFallback: baselineIsFallback } = getBaselineGuideSlugs();
  // 件数(>=)だけでなく、baseline(=origin/mainの現在のsitemap.ts、フォールバック時は
  // 既知の静的リスト)の全slugが現在も個別に存在するかを見る。これにより「追加でN件
  // 増えた後、その一部が誤って削除されて合計だけ元の件数に戻る」ようなケースも検知
  // できる(件数閾値だけでは見逃す。Codexレビュー指摘、PR #89)。baselineをorigin/main
  // から動的取得することで、このPR以降に追加されたslugについても、次のPRの時点で
  // baselineへ自動的に組み込まれ、手動更新なしで削除退行を検知し続けられる
  // (Codexレビュー指摘、PR #89、2巡目: 静的ハードコードのみだと追加分は永遠に
  // 未保護のままだった)。
  const missingBaselineSlugs = baselineGuideSlugs.filter((slug) => !currentGuideSlugs.has(slug));
  const unexpectedMissingSlugs = missingBaselineSlugs.filter((slug) => !KNOWN_INTENTIONAL_REMOVALS.includes(slug));
  if (unexpectedMissingSlugs.length === 0) {
    const intentional = missingBaselineSlugs.filter((slug) => KNOWN_INTENTIONAL_REMOVALS.includes(slug));
    if (intentional.length > 0) {
      ok(
        `baselineのGUIDE_SLUGS ${baselineGuideSlugs.length}件のうち、既知の意図的な統合による削除` +
          `(${intentional.join(", ")})を除き全て現在も存在する(現在の総数: ${currentGuideSlugs.size}件)`,
      );
    } else {
      ok(`baselineのGUIDE_SLUGS ${baselineGuideSlugs.length}件が全て現在も存在する(現在の総数: ${currentGuideSlugs.size}件)`);
    }
  } else {
    fail(
      `sitemap.ts から既知のガイド記事が消えている: ${unexpectedMissingSlugs.join(", ")} ` +
        `(baseline${baselineGuideSlugs.length}件中${unexpectedMissingSlugs.length}件が想定外に消失、現在の総数: ${currentGuideSlugs.size}件)`,
    );
  }
  // KNOWN_INTENTIONAL_REMOVALSのドリフト検知: このPRがマージされ、origin/mainのbaseline
  // 自体からも当該slugが既に消えている場合、このリストのエントリはもう不要(むしろ以後は
  // 本来の「本当の削除退行」を隠してしまう)ため、削除するよう促す。ただしこれは
  // origin/mainから実際に取得したbaseline(pre-merge状態)に対してのみ意味を持つ
  // 検知であり、静的フォールバック使用時(baselineIsFallback=true)はフォールバック
  // リスト自体が既に更新済みのことがあるため、この検知はスキップする
  // (Codexレビュー指摘対応: shallow clone等でorigin/mainを参照できない環境で
  // 常に失敗していた)。
  if (baselineIsFallback) {
    console.log(
      "\n(フォールバックbaseline使用中のため、KNOWN_INTENTIONAL_REMOVALSのドリフト検知はスキップします)",
    );
  } else {
    for (const slug of KNOWN_INTENTIONAL_REMOVALS) {
      if (!baselineGuideSlugs.includes(slug)) {
        fail(
          `KNOWN_INTENTIONAL_REMOVALSの "${slug}" はbaseline(origin/main)に既に存在しない ` +
            `(マージ済みで役目を終えたと考えられる)。このリストから削除してください`,
        );
      }
    }
  }
  for (const slug of EXPECTED_SAMPLE_SLUGS) {
    if (staticPaths.includes(`/guide/${slug}`)) {
      ok(`sitemap.ts に /guide/${slug} が引き続き存在する`);
    } else {
      fail(`sitemap.ts から /guide/${slug} が消えている`);
    }
  }

  if (failed) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log("\n=== 全チェック成功 ===");
  }
}

main();
