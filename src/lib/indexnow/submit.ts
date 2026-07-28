/**
 * IndexNow (https://www.indexnow.org/documentation) のバッチ送信エンドポイントへ
 * URLリストをPOSTする。Bing/Yandex等、IndexNowに参加している検索エンジンへ
 * 「このURLが追加/更新/削除された」ことを即時通知するための薄いラッパー。
 *
 * 呼び出し元(cronルート・管理画面の手動トリガー)のリクエスト/ビルドを絶対に壊さないよう、
 * 設定不備・ネットワーク失敗のいずれもthrowせず、常に {ok, status?, error?} を返す。
 */

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

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

function filterRecentlySubmitted(urls: string[], now: number): { toSubmit: string[]; skipped: number } {
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

/**
 * URLリストをIndexNowへバッチ送信する。
 *
 * - `INDEXNOW_KEY` が未設定の場合は何もせず {ok: false, error: "not configured"} を返す
 *   (throwしない。cron/管理画面のどちらから呼んでもリクエスト自体は継続できる)。
 * - 直近10分以内に送信済みのURLは(同一インスタンス内に限り)スキップする。
 * - ネットワーク失敗・非2xxレスポンスもthrowせず、ステータスコードとレスポンス本文を
 *   console.errorへ出力したうえで {ok: false, ...} を返す。
 */
export async function submitUrlsToIndexNow(urls: string[]): Promise<SubmitIndexNowResult> {
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
  const { toSubmit, skipped } = filterRecentlySubmitted(cleanUrls, now);
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

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[indexnow] submission threw a network error: ${message}`);
    return { ok: false, error: message, submittedCount: 0, skippedCount: skipped };
  }
}
