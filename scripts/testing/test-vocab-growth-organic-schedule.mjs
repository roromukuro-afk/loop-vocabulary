/**
 * vocab-growth-organic-schedule.mjs(selectFunnelStageKeys)、
 * vocab-growth-organic-24h-check.mjs(buildReportBaseName)、
 * vocab-growth-organic-campaign-report.mjs(campaignTotals/formatJstDateTime)の
 * 単体テスト。DBアクセス無しの純粋関数のみを対象にする。
 *
 * 使い方: node scripts/testing/test-vocab-growth-organic-schedule.mjs
 */
import { selectFunnelStageKeys, UNTRACKED_DESTINATION_CONTENT_KEYS } from "../reporting/vocab-growth-organic-schedule.mjs";
import { buildFunnelRates } from "../reporting/lib/funnelRates.mjs";
import { buildReportBaseName } from "../reporting/vocab-growth-organic-24h-check.mjs";
import { campaignTotals, formatJstDateTime } from "../reporting/vocab-growth-organic-campaign-report.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) ok(msg);
  else bad(`${msg}: actual=${a}, expected=${e}`);
}

function main() {
  // ---- selectFunnelStageKeys: dictionary destination(organic_06)は
  // Codexレビュー指摘対応(PR #125)により、dictionary_word_addedをctaKeysへ
  // 渡さず、skipCtaStage:trueを返す(サインアップ前に発火する真のCTAイベントが
  // 実装されていないため) ----
  {
    const stageKeys = selectFunnelStageKeys("organic_06", { dictionary_view: ["a", "b"], dictionary_word_added: ["a"] });
    if (stageKeys.skipCtaStage === true && stageKeys.ctaKeys.length === 0 && stageKeys.pageViewedKeys.length === 2) {
      ok("dictionary destination(organic_06)はskipCtaStage:trueを返し、dictionary_word_addedをctaKeysへ混入させない");
    } else {
      bad(`dictionary destinationのstageKeysが想定外: ${JSON.stringify(stageKeys)}`);
    }
  }

  // ---- buildFunnelRates: skipCtaStage:trueのとき、cta件数が閾値以上あっても
  // ctaRate/signupRateは実測値ではなくnotApplicableマーカーになる(回帰確認:
  // 「有効な数値」が実際には計測できない指標として誤って報告されない) ----
  {
    const manyKeys = Array.from({ length: 20 }, (_, i) => `v${i}`);
    const rates = buildFunnelRates({
      landingKeys: manyKeys,
      pageViewedKeys: manyKeys,
      skipGeneratedStage: true,
      ctaKeys: manyKeys, // skipCtaStageがtrueならこれが渡っても無視されるべき
      skipCtaStage: true,
      savedKeys: [],
      skipSavedStage: true,
      signupKeys: manyKeys,
    });
    if (rates.ctaRate.notApplicable === true && rates.signupRate.notApplicable === true) {
      ok("skipCtaStage:trueのとき、ctaKeysに十分なデータがあってもctaRate/signupRateはnotApplicableマーカーになる");
    } else {
      bad(`skipCtaStage:trueでのrate計算が想定外: ctaRate=${JSON.stringify(rates.ctaRate)}, signupRate=${JSON.stringify(rates.signupRate)}`);
    }
  }

  // ---- vocab_check/guide destinationは引き続きskipCtaStageを立てない(回帰確認) ----
  {
    const vocabCheckKeys = selectFunnelStageKeys("organic_01", { vocab_check_page_viewed: ["a"], vocab_check_signup_clicked: ["a"] });
    const guideKeys = selectFunnelStageKeys("organic_02", { guide_view: ["a"], guide_cta_click: ["a"] });
    if (!vocabCheckKeys.skipCtaStage && !guideKeys.skipCtaStage) {
      ok("vocab_check/guide destinationはskipCtaStageを立てず、従来どおりctaKeysをそのまま使う(回帰確認)");
    } else {
      bad(`vocab_check/guide destinationのskipCtaStageが想定外: ${vocabCheckKeys.skipCtaStage}, ${guideKeys.skipCtaStage}`);
    }
  }

  // ---- buildReportBaseName: 生成日を引数に取らず、同じ測定対象(content/
  // source/campaign/startISO)であれば常に同じ論理IDを返す(Codexレビュー
  // 指摘対応、PR #125: 生成日がbaseNameに含まれていると、collector修正後の
  // 再生成が別の論理IDになり、新旧の比較・supersede判定が成立しなかった) ----
  {
    const a = buildReportBaseName("organic_01", "x", "vocab_growth_organic", "2026-08-22T14:47:39.000Z");
    const b = buildReportBaseName("organic_01", "x", "vocab_growth_organic", "2026-08-22T14:47:39.000Z");
    if (a === b && !a.includes("2026-08-24") && !a.includes("2026-08-26")) {
      ok("buildReportBaseName()は生成日に依存せず、同じ測定対象なら常に同じ論理IDを返す");
    } else {
      bad(`buildReportBaseNameの日付非依存性が想定外: a=${a}, b=${b}`);
    }
  }

  // ---- campaignTotals: untrackedなcontent(organic_05)のlanding/funnelは
  // 合計(socialLandingIdentities等)から除外され、excludedUntrackedContentKeys
  // に記録される(Codexレビュー指摘対応、PR #125: 「実測0」と「計測ギャップ」
  // を混同して合算すると、campaign全体の合計が実際より少なく見える)。
  // ただしsignupは除外せず引き続き合算する(Codexレビュー指摘対応、PR #125
  // フレッシュレビュー: signupはtraffic_source_detected visit起点で着地
  // ページのイベントに依存せず計測できるため、untrackedを理由に除外すると
  // 実際に発生したacquisitionの成果を過小報告してしまう) ----
  {
    const untrackedKey = UNTRACKED_DESTINATION_CONTENT_KEYS[0]; // "organic_05"
    const byContent = { organic_01: 10, [untrackedKey]: 0, organic_02: 5 };
    const funnelCountsByContent = {};
    // untrackedKey自身にも実際にsignupが発生したケースを含める(landingが
    // 計測できないことと、signupが計測できないことは別の話であることを
    // 直接確認するため)。
    const signupCountByContent = { organic_01: 2, organic_02: 1, [untrackedKey]: 4 };
    const totals = campaignTotals(byContent, funnelCountsByContent, signupCountByContent, ["organic_01", untrackedKey, "organic_02"]);
    if (
      totals.socialLandingIdentities === 15 &&
      totals.socialSignupCount === 7 &&
      totals.excludedUntrackedContentKeys.length === 1 &&
      totals.excludedUntrackedContentKeys[0] === untrackedKey
    ) {
      ok(`campaignTotals()はuntrackedなcontent(${untrackedKey})のlanding/funnelだけを合計から除外してexcludedUntrackedContentKeysに記録しつつ、signup(4件)は他のcontentと同様に合算する`);
    } else {
      bad(`campaignTotalsのuntracked除外が想定外: ${JSON.stringify(totals)}`);
    }
  }

  // ---- formatJstDateTime: ISO文字列を暦日近似ではなく実際の時刻付きJST表記へ
  // 正しく変換する(Codexレビュー指摘対応、PR #125: organic_07公開の21:00 JSTの
  // 7日後が「9月4日」ではなく正しく「9月5日 21:00 JST」と表示される) ----
  {
    // organic_07公開(2026-08-29T12:00:00.000Z = 2026-08-29 21:00 JST)の
    // 7日後ちょうど(2026-09-05T12:00:00.000Z = 2026-09-05 21:00 JST)。
    const endISO = new Date(new Date("2026-08-29T12:00:00.000Z").getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const display = formatJstDateTime(endISO);
    if (display === "2026-09-05 21:00 JST") {
      ok("formatJstDateTime()はorganic_07の7日後ちょうど(9月5日21:00 JST)を暦日近似ではなく正確な時刻付きで表示する");
    } else {
      bad(`formatJstDateTimeの出力が想定外: ${display}(期待値: 2026-09-05 21:00 JST)`);
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:vocab-growth-organic-schedule RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main();
