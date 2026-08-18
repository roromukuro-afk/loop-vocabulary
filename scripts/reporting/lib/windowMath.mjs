/**
 * vocab_test_maker_launch キャンペーンのレポートスクリプト(24h check / 7day check)が
 * 共有する、DBアクセスを一切伴わない純粋な日時計算ロジック。
 * scripts/testing/test-vocab-test-maker-report-window-math.mjs から直接importして
 * 決定論的にテストする。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 投稿の発行時刻(publishedAtISO)から24時間後までの範囲を返す。 */
export const CHECK_DELAY_MS = 24 * 60 * 60 * 1000;

export function compute24hWindow(publishedAtISO) {
  const startMs = Date.parse(publishedAtISO);
  if (Number.isNaN(startMs)) {
    throw new Error(`invalid ISO8601 timestamp for publishedAtISO: ${publishedAtISO}`);
  }
  return {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(startMs + CHECK_DELAY_MS).toISOString(),
  };
}

function parseDateOnly(dateStr) {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`invalid date string (expected YYYY-MM-DD): ${dateStr}`);
  }
  return ms;
}

function formatDateOnly(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" 文字列に対して、日付だけの単純な足し算(負数も可)を行う。 */
export function addDaysToDateStr(dateStr, days) {
  return formatDateOnly(parseDateOnly(dateStr) + days * DAY_MS);
}

export const REPORT_WINDOW_DAYS = 7;

/**
 * anchorDateStr(JST暦日、例: "2026-08-25")を起点に、windowDays(既定7日)ごとの
 * 完全なウィンドウ([anchor, anchor+windowDays)、[anchor+windowDays, anchor+2*windowDays)、
 * ...)を区切り、todayDateStr(JST暦日、通常は todayJST() の戻り値)時点で
 * 「終了日が既に過ぎている」直近の完全なウィンドウ(current)と、その直前の完全な
 * ウィンドウ(prior、無ければnull)を返す。
 *
 * 「完全」の定義: そのウィンドウの最終日(endDateStrInclusive)が todayDateStr より
 * 前であること(=todayDateStr自身はまだ終わっていない進行中の日として一切含めない、
 * 既存のacquisition-snapshot.mjs/social-acquisition-snapshot.mjsと同じ「当日を含まず
 * 昨日までの完全な日のみ」という設計方針をそのまま7日間ウィンドウへ拡張したもの)。
 * まだ1つも完全なウィンドウが無い場合は hasCompleteWindow=false を返し、呼び出し側は
 * 何もレポートしてはならない(進行中のウィンドウを断定的に報告しない、というこの
 * タスクの必須要件)。
 */
export function computeReportWindows(anchorDateStr, todayDateStr, windowDays = REPORT_WINDOW_DAYS) {
  const anchorMs = parseDateOnly(anchorDateStr);
  const todayMs = parseDateOnly(todayDateStr);
  if (todayMs < anchorMs) {
    return { hasCompleteWindow: false, current: null, prior: null };
  }
  const daysSinceAnchor = Math.floor((todayMs - anchorMs) / DAY_MS);
  const completedWindows = Math.floor(daysSinceAnchor / windowDays);
  if (completedWindows < 1) {
    return { hasCompleteWindow: false, current: null, prior: null };
  }
  const currentIndex = completedWindows - 1;

  function windowByIndex(idx) {
    if (idx < 0) return null;
    return {
      index: idx,
      startDateStr: addDaysToDateStr(anchorDateStr, idx * windowDays),
      endDateStrInclusive: addDaysToDateStr(anchorDateStr, idx * windowDays + windowDays - 1),
    };
  }

  return {
    hasCompleteWindow: true,
    current: windowByIndex(currentIndex),
    prior: windowByIndex(currentIndex - 1),
  };
}

/**
 * サンプルサイズ不足時に誤解を招くパーセンテージを絶対に出さないための最小分母。
 *
 * 閾値の根拠(このタスクの設計判断): このキャンペーンは個人運営アプリの立ち上げ
 * 施策で、母数は数十〜数百件程度になる見込み。分母が10未満だと、たった1件の
 * コンバージョンの有無で表示される率が10ポイント以上動いてしまい、施策の当落を
 * 判断する材料として機能しない。10は統計的な有意性を保証するものではなく、
 * 「1件の増減で読み方が変わってしまうほど小さい数字を percentage として出さない」
 * ための実務上の最低ラインとして選んだ。10以上でもサンプルは依然として少ないため、
 * 出力される率は厳密な値ではなく方向感(direction)として扱うこと。
 */
export const MIN_SAMPLE_SIZE_FOR_RATE = 10;

/**
 * numerator/denominator の比率を計算する。denominatorがminSample未満の場合は
 * insufficientData=trueを立て、rateはnullを返す(誤解を招く%を絶対に出力しない)。
 */
export function computeRate(numerator, denominator, minSample = MIN_SAMPLE_SIZE_FOR_RATE) {
  if (!Number.isFinite(denominator) || denominator < 0) {
    throw new Error(`denominator must be a non-negative finite number: ${denominator}`);
  }
  if (!Number.isFinite(numerator) || numerator < 0) {
    throw new Error(`numerator must be a non-negative finite number: ${numerator}`);
  }
  if (denominator < minSample) {
    return { rate: null, insufficientData: true, numerator, denominator, minSample };
  }
  return {
    rate: denominator === 0 ? null : numerator / denominator,
    insufficientData: false,
    numerator,
    denominator,
    minSample,
  };
}
