/**
 * IndexNow (https://www.indexnow.org/documentation) のバッチ送信エンドポイントへ
 * URLリストをPOSTする。Bing/Yandex等、IndexNowに参加している検索エンジンへ
 * 「このURLが追加/更新/削除された」ことを即時通知するための薄いラッパー。
 *
 * 呼び出し元(cronルート・管理画面の手動トリガー)のリクエスト/ビルドを絶対に壊さないよう、
 * 設定不備・ネットワーク失敗のいずれもthrowせず、常に {ok, status?, error?} を返す。
 */

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const REQUEST_TIMEOUT_MS = 10 * 1000; // 接続は成立したが応答が返らないケースに備えた上限

// 同一URLを短時間に繰り返し送信しない簡易デデュープ/レートリミット。
//
// 正直な注記: Vercelのサーバーレス関数はリクエストごとに別インスタンス・別コールドスタートで
// 実行されうるため、このモジュールレベルのMapはインスタンス間で共有されない。
// 「同一インスタンスが温かい間の重複送信を減らす」程度の効果しかなく、
// 複数インスタンスにまたがる呼び出しやコールドスタートをまたぐ呼び出しの重複は防げない。
// 本当に堅牢な重複排除が必要になった場合は、Supabase等の外部ストアに送信履歴を
// 持たせる実装に差し替えること。
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10分
const lastSubmittedAt = new Map<string, number>();

// src/lib/seo/siteUrl.ts の normalizeSiteUrl と同等のロジックをあえてここに複製している。
// このファイルはNode(scripts/testing/test-indexnow-submit.mjs)からtsconfigのpathエイリアス
// ("@/...")解決なしに直接importされるテスト対象であり、外部依存を持たない自己完結モジュールに
// しておくことで、テストの実行環境をNext.js/webpackのモジュール解決に依存させないようにしている。
function normalizeSiteUrl(value?: string | null): string {
  const base = value || "https://loop-vocabulary.app";
  return base.replace(/\/+$/, "");
}

export type SubmitIndexNowResult = {
  ok: boolean;
  status?: number;
  error?: string;
  submittedCount?: number;
  skippedCount?: number;
};

function getHost(): string {
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  try {
    return new URL(base).host;
  } catch {
    return "loop-vocabulary.app";
  }
}

function filterRecentlySubmitted(
  urls: string[],
  now: number,
  bypassDedupe: boolean,
): { toSubmit: string[]; skipped: number } {
  if (bypassDedupe) return { toSubmit: urls, skipped: 0 };
  const toSubmit: string[] = [];
  let skipped = 0;
  for (const url of urls) {
    const last = lastSubmittedAt.get(url);
    if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
      skipped++;
      continue;
    }
    toSubmit.push(url);
  }
  return { toSubmit, skipped };
}

export type SubmitIndexNowOptions = {
  /**
   * trueの場合、直近10分以内デデュープを無視し必ず送信を試みる(送信成功後は通常どおり
   * lastSubmittedAtを更新するため、その後の"通常"呼び出しは改めてデデュープ対象になる)。
   *
   * 公開⇄非公開・削除のような可視性の反転は、たとえ直前に同じURLを送信済みでも、
   * IndexNowへ届けなければならない重要な事実の変化である。例えば「公開→(9分後)非公開」
   * のように短時間で反転すると、通常のデデュープでは2回目(消えたことの通知)がスキップ
   * されてしまい、外部の検索エンジン側に古い"公開されている"という結果が
   * 次のクロール・週次resyncまで残り続ける。このオプションは、そのような
   * "内容の変化ではなく状態そのものが変わった"通知にのみ使うこと
   * (通常の同一内容の更新連投には使わない = デフォルトはfalseのまま)。
   */
  bypassDedupe?: boolean;
};

/**
 * URLリストをIndexNowへバッチ送信する。
 *
 * - `INDEXNOW_KEY` が未設定の場合は何もせず {ok: false, error: "not configured"} を返す
 *   (throwしない。cron/管理画面のどちらから呼んでもリクエスト自体は継続できる)。
 * - 直近10分以内に送信済みのURLは(同一インスタンス内に限り)スキップする
 *   (`opts.bypassDedupe: true` で無視できる。可視性反転・削除通知専用)。
 * - ネットワーク失敗・非2xxレスポンスもthrowせず、ステータスコードとレスポンス本文を
 *   console.errorへ出力したうえで {ok: false, ...} を返す。
 */
export async function submitUrlsToIndexNow(urls: string[], opts: SubmitIndexNowOptions = {}): Promise<SubmitIndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log("[indexnow] INDEXNOW_KEY is not set; skipping submission (not configured)");
    return { ok: false, error: "not configured" };
  }

  const cleanUrls = [...new Set(urls.filter((u) => typeof u === "string" && u.length > 0))];
  if (cleanUrls.length === 0) {
    return { ok: false, error: "no urls to submit" };
  }

  const now = Date.now();
  const { toSubmit, skipped } = filterRecentlySubmitted(cleanUrls, now, opts.bypassDedupe === true);
  if (toSubmit.length === 0) {
    console.log(`[indexnow] all ${cleanUrls.length} url(s) were submitted within the last ${RATE_LIMIT_WINDOW_MS / 60000} minutes; skipping`);
    return { ok: false, error: "all urls recently submitted", submittedCount: 0, skippedCount: skipped };
  }

  const host = getHost();
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const keyLocation = `${base}/${key}.txt`;

  const payload = {
    host,
    key,
    keyLocation,
    urlList: toSubmit,
  };

  // 接続自体は成立したが応答が返ってこない("stall")ケースに備え、AbortSignal.timeout()で
  // 上限を設ける。これが無いと、cronルート/管理画面からの手動トリガーがプラットフォームの
  // 関数タイムアウトまでハングし続け、約束している{ok:false}の即時返却ができなくなる。
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: timeoutSignal,
    });

    // 成功(仕様上は200または202)のURLのみ「送信済み」として記録する。
    if (res.ok) {
      for (const url of toSubmit) lastSubmittedAt.set(url, now);
      return { ok: true, status: res.status, submittedCount: toSubmit.length, skippedCount: skipped };
    }

    let body = "";
    try {
      body = await res.text();
    } catch {
      // レスポンス本文が読めなくても致命的ではない
    }
    console.error(`[indexnow] submission failed: status=${res.status} body=${body.slice(0, 500)}`);
    return { ok: false, status: res.status, error: `indexnow responded with status ${res.status}`, submittedCount: 0, skippedCount: skipped };
  } catch (err) {
    // AbortSignal.timeout()による中断はDOMException("TimeoutError")として現れる。
    // 通常のネットワーク失敗と区別できるよう、メッセージにその旨を明示する。
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const message = isTimeout
      ? `request timed out after ${REQUEST_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : String(err);
    console.error(`[indexnow] submission ${isTimeout ? "timed out" : "threw a network error"}: ${message}`);
    return { ok: false, error: message, submittedCount: 0, skippedCount: skipped };
  }
}
