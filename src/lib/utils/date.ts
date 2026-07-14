/**
 * 日付処理の共通ユーティリティ（日本時間 / Asia-Tokyo 基準）。
 *
 * このアプリのユーザーは日本語話者を前提とするため、「今日」「昨日」「曜日」等の
 * カレンダー日付は常に **日本時間 (UTC+9、夏時間なし)** で判定する。
 *
 * 従来 `new Date().toISOString().slice(0, 10)` が各所で使われていたが、これは
 * UTCの日付を返すため、日本時間の 0:00〜9:00 の間は「前日」を指してしまい、
 * daily_stats の日付キーがずれる・streak が不正に増減する・カレンダーの曜日と
 * 日付が一致しない、といったバグの原因になっていた。
 *
 * サーバー(Vercelは既定でUTCで動作)・ブラウザ(利用者のローカルTZ)のどちらで
 * 実行されても同じ結果になるよう、実行環境のローカルタイムゾーン設定には一切
 * 依存せず、UTCエポックからのオフセット計算のみで日本時間を求める。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 指定した Date（省略時は現在時刻）を日本時間の "YYYY-MM-DD" 文字列にする */
export function toJstDateString(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return jst.toISOString().slice(0, 10);
}

/** 日本時間における「今日」の日付文字列 */
export function todayJST(): string {
  return toJstDateString(new Date());
}

/**
 * 日本時間で `base`（省略時は現在時刻）から n 日前の日付文字列を返す。
 * n=0 は base 自身が属する日本時間の日付。
 */
export function daysAgoJST(n: number, base: Date = new Date()): string {
  return toJstDateString(new Date(base.getTime() - n * DAY_MS));
}

/**
 * "YYYY-MM-DD" 文字列（日本時間の暦日として解釈）から、日本時間での曜日 index を返す。
 * 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
 *
 * その日の JST 正午を基準に計算することで、日付境界付近の丸め誤差を避ける。
 */
export function jstWeekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  return d.getUTCDay();
}

/**
 * 直近 n 日分（today を含む）の日本時間の日付文字列を、古い→新しい順の配列で返す。
 * 例: n=7, base=今日 なら [6日前, 5日前, ..., 1日前, 今日]
 */
export function lastNDaysJST(n: number, base: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => daysAgoJST(n - 1 - i, base));
}

/** 日本時間での「時」（0〜23）。挨拶メッセージの出し分け等に使う。 */
export function jstHour(date: Date = new Date()): number {
  return new Date(date.getTime() + JST_OFFSET_MS).getUTCHours();
}

/** 日本時間での「日」（1〜31、月内の日）。日替わりコンテンツの選択等に使う。 */
export function jstDayOfMonth(date: Date = new Date()): number {
  return new Date(date.getTime() + JST_OFFSET_MS).getUTCDate();
}

/**
 * 日本時間における「今日の0時0分0秒」を表す ISO 文字列（UTC表記）を返す。
 *
 * TIMESTAMPTZ 列（例: created_at）に対して「日本時間の今日以降」を絞り込む際に使う。
 * 単純に `${todayJST()}T00:00:00Z` としてしまうと "Z"(UTC)扱いになり、
 * 日本時間の午前0時〜9時の間は「未来のタイムスタンプ」を指してしまい、
 * その時間帯は該当件数が常に0件になってしまう（新たなバグ）。
 * 必ずこの関数で明示的に +09:00 オフセット付きの時刻からUTCに変換すること。
 */
export function todayStartJstISO(): string {
  return new Date(`${todayJST()}T00:00:00+09:00`).toISOString();
}

/**
 * 任意の日本時間の暦日文字列("YYYY-MM-DD")について、その日の開始("startISO")と
 * 翌日の開始("endISO")をUTC ISO文字列で返す。TIMESTAMPTZ列に対して`gte(startISO).lt(endISO)`
 * のように「日本時間のその日」を絞り込む際に使う。`todayStartJstISO()`と同じ変換方式
 * （`${dateStr}T00:00:00+09:00`）を任意日付向けに一般化したもの。
 */
export function jstDayRangeISO(dateStr: string): { startISO: string; endISO: string } {
  const startISO = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + DAY_MS).toISOString();
  return { startISO, endISO };
}
