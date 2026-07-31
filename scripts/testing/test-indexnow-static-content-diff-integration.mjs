/**
 * scripts/improvement/notify-indexnow-static-content-diff.mjs の
 * computeChangedPaths()(差分検出だけを行う副作用のない関数、実際のIndexNow送信は行わない)を、
 * このリポジトリに実在する過去コミット間で実行し、最終的な送信対象(通知path・絶対URL)まで
 * 検証する統合テスト。
 *
 * git実行を伴うため、ネットワークアクセスは一切発生しない(computeChangedPaths自体が
 * submitUrlsToIndexNowを呼ばない設計)。実行環境にINDEXNOW_KEYが設定されていても
 * いなくても、このテストの実行自体が外部IndexNow APIを呼び出すことは無い。
 *
 * 実コミットで検証できないケース(このリポジトリの実際の変更履歴に該当コミットが
 * 存在しないケース)は、正直に「検証できない」まま報告する(捏造しない)。該当箇所には
 * 同等のロジックをカバーする単体テスト(test-indexnow-static-content-diff-extraction.mjs)
 * への参照を明記している。
 *
 * 使い方: node scripts/testing/test-indexnow-static-content-diff-integration.mjs
 */
import { readFileSync } from "node:fs";
import { computeChangedPaths } from "../improvement/notify-indexnow-static-content-diff.mjs";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }

function assertIncludes(arr, item, label) {
  if (arr.includes(item)) ok(label);
  else fail(`${label} (実際の配列: ${JSON.stringify(arr)})`);
}
function assertNotIncludes(arr, item, label) {
  if (!arr.includes(item)) ok(label);
  else fail(`${label} (実際の配列に含まれていた: ${JSON.stringify(arr)})`);
}
function assertAllAbsolute(paths, siteBase, label) {
  const bad = paths.filter((p) => !p.startsWith(`${siteBase}/`) && p !== `${siteBase}/`);
  if (bad.length === 0) ok(label);
  else fail(`${label} (絶対URLでない要素: ${JSON.stringify(bad)})`);
}

const SITE_BASE = "https://loop-vocabulary.app";

// computeChangedPathsはpathを返す関数のため、絶対URL化はmain()側の責務
// (toAbsoluteUrl/resolveAbsoluteUrls、単体テストで別途検証済み)。ここでは
// 実際にmain()が呼ぶのと同じ変換を通した最終送信payloadまで確認する。
import { resolveAbsoluteUrls } from "../improvement/notify-indexnow-static-content-diff.mjs";

async function main() {
  // ---- ケース1: 新規ガイド記事(専用ディレクトリ型) ----
  // 9ff4dbc: "英単語の覚え方"パイラーページ(/guide/eitango-no-oboekata)を新規追加した実コミット。
  // 同時に全ガイド記事へパンくずUIを展開しているため、既存記事側の内容更新も同時に大量発生する
  // (現実のコミットはこのように複数の変更が混在するため、部分一致(includes)で検証する)。
  {
    const { existencePaths } = await computeChangedPaths("9ff4dbc^", "9ff4dbc");
    assertIncludes(existencePaths, "/guide/eitango-no-oboekata", "ケース1(新規ガイド記事・専用ディレクトリ型): 新規slugがexistencePathsに含まれる(9ff4dbc)");
  }

  // ---- ケース2: 既存専用ディレクトリ型ガイドの更新 ----
  // 3c51fe7: chugaku-eigo-tango記事のパンくず修正のみ(新規追加・削除ではない)。
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("3c51fe7^", "3c51fe7");
    assertIncludes(contentPaths, "/guide/chugaku-eigo-tango", "ケース2(既存専用ディレクトリ型ガイドの更新): contentPathsに含まれる(3c51fe7)");
    assertNotIncludes(existencePaths, "/guide/chugaku-eigo-tango", "ケース2: existencePathsには含まれない(新規/削除ではないため、3c51fe7)");
  }

  // ---- ケース3: 動的[slug]ガイドの更新 ----
  // fecf684: 動的ルート(ARTICLES)のみで管理されているfukikisoku-doushi-ichiran記事へ、
  // 専用ディレクトリを持たないままAAB型パターンを追加した実コミット。
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("fecf684^", "fecf684");
    assertIncludes(contentPaths, "/guide/fukikisoku-doushi-ichiran", "ケース3(動的[slug]ガイドの更新): contentPathsに含まれる(fecf684)");
    assertNotIncludes(existencePaths, "/guide/fukikisoku-doushi-ichiran", "ケース3: existencePathsには含まれない(fecf684)");
  }

  // ---- ケース4・5: 辞書語の新規追加・内容更新 ----
  // bb97cf8: 辞書24→50語拡張の実コミット(このPRより前のPart 2初回開発時にも検証済み)。
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("bb97cf8^", "bb97cf8");
    const newDictUrls = existencePaths.filter((p) => p.startsWith("/dictionary/"));
    const updatedDictUrls = contentPaths.filter((p) => p.startsWith("/dictionary/"));
    if (newDictUrls.length >= 20) ok(`ケース4(辞書語の新規追加): existencePathsに/dictionary/*が${newDictUrls.length}件含まれる(bb97cf8)`);
    else fail(`ケース4: 期待していたより少ない(${newDictUrls.length}件, bb97cf8)`);
    if (updatedDictUrls.length >= 5) ok(`ケース5(辞書語内容更新): contentPathsに/dictionary/*が${updatedDictUrls.length}件含まれる(bb97cf8)`);
    else fail(`ケース5: 期待していたより少ない(${updatedDictUrls.length}件, bb97cf8)`);
  }

  // ---- ケース6: 辞書語削除 ----
  // 正直な設計上の注記: このリポジトリの実際の変更履歴には辞書語を削除したコミットが
  // 存在しない(単調増加のみ)。ただし、bb97cf8を逆方向(before=bb97cf8, after=265ad34)で
  // 比較すれば、両者とも実在するコミットの実内容のまま「26語が存在しなくなった」という
  // 事実を正しく表現できるため、この向きでloadPilotWordsAt()の削除分岐を検証する
  // (架空のfixtureを作らず、実コミット2つの実際の差分のみを使っている)。
  {
    const { existencePaths } = await computeChangedPaths("bb97cf8", "265ad34");
    const removedDictUrls = existencePaths.filter((p) => p.startsWith("/dictionary/"));
    if (removedDictUrls.length >= 20) ok(`ケース6(辞書語削除): existencePathsに削除された/dictionary/*が${removedDictUrls.length}件含まれる(bb97cf8→265ad34)`);
    else fail(`ケース6: 期待していたより少ない(${removedDictUrls.length}件)`);
  }

  // ---- ケース7: 新規リダイレクト ----
  // 2146e0e: guideRedirects配列自体が初めて導入され、how-to-memorize-english-words→
  // eitango-oboeru-houhouへの308リダイレクトが新設された実コミット。
  {
    const { existencePaths } = await computeChangedPaths("2146e0e^", "2146e0e");
    assertIncludes(existencePaths, "/guide/how-to-memorize-english-words", "ケース7(新規リダイレクト): 旧URL(source)がexistencePathsに含まれる(2146e0e)");
    assertIncludes(existencePaths, "/guide/eitango-oboeru-houhou", "ケース7: 新URL(destination)もexistencePathsに含まれる(2146e0e)");
  }

  // ---- ケース8: 既存無料ツールの内容更新 ----
  // 正直な設計上の注記: review-date-calculator・exam-countdown-plannerはこのラウンドで
  // 新規追加されたばかりで、追加コミット以降まだ内容だけを更新した実コミットが存在しない
  // (追加コミット自体は「新規」であり「既存ページの内容更新」ケースの実例にならない)。
  // このため実コミットでの検証はできないが、変換ロジック自体は
  // test-indexnow-static-content-diff-extraction.mjsのpageFilePathToUrlテストで
  // (`src/app/exam-countdown-planner/page.tsx` → `/exam-countdown-planner` 等)直接検証済み。
  // ここでは「HEAD時点でこれらのURLがsitemapの静的パス集合に含まれる」(=ゲーティングを
  // 実際に通過できる)ことだけを確認する。
  {
    const sitemapSrc = readFileSync(new URL("../../src/app/sitemap.ts", import.meta.url), "utf8");
    const { extractStaticSitemapPaths } = await import("../improvement/notify-indexnow-static-content-diff.mjs");
    const currentPaths = extractStaticSitemapPaths(sitemapSrc);
    if (currentPaths.has("/review-date-calculator") && currentPaths.has("/exam-countdown-planner")) {
      ok("ケース8(既存無料ツールの内容更新、実コミットなしのため部分検証): HEAD時点で/review-date-calculator・/exam-countdown-plannerともsitemap静的パス集合に含まれ、内容更新検出のゲーティング条件を満たせることを確認(変換ロジック自体は単体テストで検証済み)");
    } else {
      fail("ケース8: /review-date-calculator・/exam-countdown-plannerがsitemap静的パス集合から見つからない");
    }
  }

  // ---- ケース9: /about・/faqの内容更新 ----
  // 341d481: faq/page.tsxの「AI解説無制限」表記を実際の上限表記へ修正した実コミット。
  // 同時に/guide一覧の再編成やlegal/content-policyの新設(既存判定と別カテゴリ)も含むため、
  // 部分一致で検証する。
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("341d481^", "341d481");
    assertIncludes(contentPaths, "/faq", "ケース9(/faqの内容更新): contentPathsに含まれる(341d481)");
    assertNotIncludes(existencePaths, "/faq", "ケース9: existencePathsには含まれない(/faq自体は新規/削除ではない、341d481)");
  }

  // ---- ケース10: 変更対象なし ----
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("96a563f", "96a563f");
    if (existencePaths.length === 0 && contentPaths.length === 0) {
      ok("ケース10(変更対象なし): 同一refを比較すると両方とも空配列になる(96a563f)");
    } else {
      fail(`ケース10: 空であるべきだが existencePaths=${JSON.stringify(existencePaths)}, contentPaths=${JSON.stringify(contentPaths)}`);
    }
  }

  // ---- ケース11: 最終送信payloadが絶対URL ----
  // ケース1(9ff4dbc、existence+content双方に十分な件数がある実コミット)の結果を
  // main()と同じresolveAbsoluteUrls()に通し、送信直前のpayloadが全件絶対URLであることを確認する。
  {
    const { existencePaths, contentPaths } = await computeChangedPaths("9ff4dbc^", "9ff4dbc");
    const { absolute: existenceAbsolute, rejected: existenceRejected } = resolveAbsoluteUrls(existencePaths, SITE_BASE);
    const { absolute: contentAbsolute, rejected: contentRejected } = resolveAbsoluteUrls(contentPaths, SITE_BASE);
    assertAllAbsolute(existenceAbsolute, SITE_BASE, "ケース11a: existence側の最終送信payloadが全件絶対URL(9ff4dbc)");
    assertAllAbsolute(contentAbsolute, SITE_BASE, "ケース11b: content側の最終送信payloadが全件絶対URL(9ff4dbc)");
    if (existenceRejected.length === 0 && contentRejected.length === 0) {
      ok("ケース11c: 通常の検出結果に絶対URL変換で拒否されるpathは含まれない(9ff4dbc)");
    } else {
      fail(`ケース11c: 想定外の変換失敗 existenceRejected=${JSON.stringify(existenceRejected)}, contentRejected=${JSON.stringify(contentRejected)}`);
    }
    // hostが一致することも確認(送信payloadのhostと各URLのhostname)
    const siteHost = new URL(SITE_BASE).host;
    const allHostsMatch = [...existenceAbsolute, ...contentAbsolute].every((u) => new URL(u).host === siteHost);
    if (allHostsMatch) ok("ケース11d: 送信payloadの全URLのhostがsiteBaseのhostと一致する(9ff4dbc)");
    else fail("ケース11d: hostが一致しないURLが含まれていた");
  }

  // ---- ケース12・13: existenceはbypassDedupe、content updateは通常dedupeで送信される ----
  // main()の実装(ソーステキスト)を直接検証する構造的インバリアントテスト。
  // computeChangedPaths()自体は送信を行わないため、実際にsubmitUrlsToIndexNowを呼び出す
  // main()側の配線が壊れていないことを、実際に呼び出さずに(=外部APIを叩かずに)確認する
  // (scripts/testing/test-admin-materials-words-import-notify-invariant.mjsと同じ手法)。
  {
    const scriptSrc = readFileSync(
      new URL("../improvement/notify-indexnow-static-content-diff.mjs", import.meta.url),
      "utf8",
    );
    const hasExistenceBypass = /submitUrlsToIndexNow\(absolute,\s*\{\s*bypassDedupe:\s*true\s*\}\)/.test(scriptSrc);
    // content側の呼び出しは、existence側の直後に出現する「bypassDedupeオプション無しの」
    // submitUrlsToIndexNow(absolute)呼び出し。全文中に2箇所しか無いことも合わせて確認する。
    const allCalls = [...scriptSrc.matchAll(/submitUrlsToIndexNow\(absolute(?:,\s*\{[^}]*\})?\)/g)].map((m) => m[0]);

    if (hasExistenceBypass) ok("ケース12(existenceはbypassDedupe): main()のソース中にsubmitUrlsToIndexNow(absolute, { bypassDedupe: true })呼び出しが存在する");
    else fail("ケース12: main()のソース中にbypassDedupe:true付きの呼び出しが見つからない");

    if (allCalls.length === 2 && allCalls.includes("submitUrlsToIndexNow(absolute)")) {
      ok("ケース13(content updateは通常dedupe): main()のソース中にbypassDedupe無しのsubmitUrlsToIndexNow(absolute)呼び出しが(existence用とは別に)存在し、送信呼び出しは合計2箇所のみ");
    } else {
      fail(`ケース13: 想定外の呼び出しパターン: ${JSON.stringify(allCalls)}`);
    }
  }

  console.log(
    failed
      ? `\n=== test:indexnow-static-content-diff-integration: ${failed}件失敗 ===`
      : "\n=== test:indexnow-static-content-diff-integration RESULT: all checks passed ===",
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test-indexnow-static-content-diff-integration crashed:", e);
  process.exit(1);
});
