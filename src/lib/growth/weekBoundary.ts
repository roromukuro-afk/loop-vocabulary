/**
 * JST週(月曜始まり)の境界計算。意図的に他ファイルへのimportを持たない自己完結モジュール。
 *
 * 理由: このファイルは `weeklyReport.ts`(Next.js経由)と `scripts/testing/*.mjs`
 * (Node直接実行)の両方からimportされる。Node 24のネイティブTypeScript実行は、
 * 相対import("../utils/date"のような拡張子省略パス)をTypeScriptファイル間で
 * 解決できない一方、tsconfigの"moduleResolution":"bundler"は明示的な.ts拡張子付き
 * importを許可しない(TS5097)。この2つを同時に満たす唯一の方法は「他の.tsファイルを
 * importしない自己完結モジュールにする」ことなので、日付計算をここに複製する
 * (`src/lib/utils/date.ts`のJST変換ロジックと同じ考え方)。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toJstDateString(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return jst.toISOString().slice(0, 10);
}

function daysAgoJST(n: number, base: Date): string {
  return toJstDateString(new Date(base.getTime() - n * DAY_MS));
}

function jstWeekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return d.getUTCDay();
}

function jstMondayOfWeek(dateStr: string): string {
  const weekdayIdx = jstWeekdayIndex(dateStr); // 0=日,1=月,...,6=土
  const daysSinceMonday = (weekdayIdx + 6) % 7; // 月=0,火=1,...,日=6
  return daysAgoJST(daysSinceMonday, new Date(`${dateStr}T12:00:00+09:00`));
}

function jstDatePlusDays(dateStr: string, offset: number): string {
  return daysAgoJST(-offset, new Date(`${dateStr}T12:00:00+09:00`));
}

/** 直近の「完了した」JST週(月曜始まり)を返す。今週が進行中の場合は先週を対象にする。 */
export function resolveLastCompletedWeek(today: string): { weekStart: string; weekEnd: string } {
  const thisWeekMonday = jstMondayOfWeek(today);
  const lastWeekMonday = daysAgoJST(7, new Date(`${thisWeekMonday}T12:00:00+09:00`));
  const lastWeekSunday = jstDatePlusDays(lastWeekMonday, 6);
  return { weekStart: lastWeekMonday, weekEnd: lastWeekSunday };
}

export function jstDayRangeISO(dateStr: string): { startISO: string; endISO: string } {
  const startISO = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + DAY_MS).toISOString();
  return { startISO, endISO };
}
