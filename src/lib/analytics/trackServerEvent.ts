/**
 * Growth OS: サーバーサイド(API route)からイベントを発火するためのヘルパー。
 *
 * word_count のようにDBにしか存在しない状態を判定した直後(例: 単語一括インポート後)に、
 * クライアントの往復を挟まず直接 analytics_events に挿入する。/api/analytics/events と
 * 同じ allowlist・sanitizeProperties を通すため、無効なevent_name/propertiesは弾かれる。
 *
 * 呼び出し側の実際の処理(単語追加・テスト完了など)を絶対に壊さないよう、
 * 例外は握りつぶし console.error のみで済ませる(re-throwしない)。
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEventName, sanitizeProperties } from "./eventSchema";
import { normalizeServerEventAttribution } from "./serverEventAttribution";
import { computeIsTestEvent, isProductionEnvironment } from "./testEventClassification";

export async function trackServerEvent(
  eventName: string,
  opts: {
    userId?: string | null;
    anonymousSessionId?: string | null;
    properties?: Record<string, unknown>;
    /**
     * リクエストの `x-lv-e2e-test` ヘッダー値。Production Canary等、本番環境から
     * 意図的にtest eventとして送りたい場合にのみ呼び出し元が渡す。渡さない場合は
     * 環境(VERCEL_ENV)のみで判定する(Preview/ローカルdev/CIからの呼び出しは、この
     * 引数を渡さなくても自動的にis_test_event=trueになる)。
     */
    e2eHeaderValue?: string | null;
    /**
     * リクエストの `lv_audit` Cookie値(Codexレビュー指摘対応、Issue #136)。監査モードの
     * SPA遷移ではヘッダーが再送されずCookieのみが残るため、ヘッダーだけを見ると
     * SPA遷移後のサーバーイベント発火が実ユーザートラフィックとして誤って記録される。
     * 渡さない場合はヘッダーと環境のみで判定する(従来どおり)。
     */
    auditCookieValue?: string | null;
    /**
     * 呼び出し元がクライアント側で判定済みのsource/campaignをそのまま渡したい場合に
     * 使う(Codexレビュー指摘対応、16巡目、最重要: src/app/auth/callback/route.ts の
     * signup_oauth_completedがこれを使う。詳細はsrc/lib/analytics/track.tsの
     * buildOAuthAttributionQuery()コメント参照)。渡さない場合は従来どおりnullのまま
     * 保存される(=クライアント側の対応する行を突き合わせて後から解決するしかない)。
     */
    source?: string | null;
    campaign?: string | null;
  } = {},
): Promise<void> {
  try {
    if (!isAllowedEventName(eventName)) return;
    const admin = createAdminClient();
    // anonymous_session_id/source/campaignはいずれも/api/analytics/events(クライアント側
    // 送信経路)と同じ「未信用のまま100文字に切り詰めて保存」方針(rate limit以外の
    // 用途には使わないただの相関キーであり、認証やアクセス制御には使わない)。
    const anonymousSessionId =
      typeof opts.anonymousSessionId === "string" ? opts.anonymousSessionId.slice(0, 100) : null;
    const { source, campaign } = normalizeServerEventAttribution(opts.source, opts.campaign);
    const { error } = await admin.from("analytics_events").insert({
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      anonymous_session_id: anonymousSessionId,
      user_id: opts.userId ?? null,
      page_type: null,
      path: null,
      source,
      campaign,
      device_category: "unknown",
      properties: sanitizeProperties(eventName, opts.properties ?? {}),
      schema_version: 1,
      // クライアント側ingestion(/api/analytics/events)と同じ判定helperを使い、
      // Preview/ローカルdev/CIからのサーバー発火イベントを本番集計から除外する
      // (以前はこの列を設定しておらずDEFAULT falseのまま=本番イベントと区別不能だった)。
      is_test_event: computeIsTestEvent(opts.e2eHeaderValue, opts.auditCookieValue),
    });
    if (error) {
      console.error("[trackServerEvent] insert failed:", eventName, error.message);
    }
  } catch (e) {
    // 分析イベントの送信失敗は呼び出し元の実処理(単語追加・課金など)に一切影響させない
    console.error("[trackServerEvent] unexpected error:", eventName, e);
  }
}

export type OncePerUserMilestoneEventName = "return_next_day" | "return_day_7";

export type InsertOncePerUserMilestoneEventResult =
  | { status: "inserted" }
  | { status: "already_exists" }
  | { status: "failed"; error: string };

/**
 * return_next_day / return_day_7 のような「ユーザーごとに生涯1回だけ」発火すべき
 * イベント専用の、DB側で原子性を保証する挿入。
 *
 * trackServerEvent()は例外を握りつぶしvoidを返すため、呼び出し側は「実際に保存できたか」
 * を判定できない(挿入失敗を成功扱いしてしまうバグの原因になっていた)。この関数は
 * Postgres関数 insert_once_per_user_milestone_event()(部分ユニークインデックス
 * analytics_events_once_per_user_milestone_uniq 上の ON CONFLICT ... DO NOTHING を
 * 使う)を呼び出し、"inserted"(新規保存できた)・"already_exists"(DB側で重複と
 * 判定されatomicにskipされた = 冪等)・"failed"(それ以外の実際のエラー)を明確に
 * 区別して返す。呼び出し側(computeReturnEvents@rollup.ts)は"inserted"の場合のみ
 * 成功件数・alreadyFiredに加算すること。
 *
 * 同時実行されたcron同士の競合もこのDB側atomic insertで安全に処理される
 * (アプリケーション側のメモリ上Setによる事前チェックだけでは、2つのcronが同時に
 * 「まだ発火していない」と判定してしまう競合状態を防げないため)。
 *
 * 【本番以外(Preview/ローカルdev/CI)での挙動】
 * Postgres関数 insert_once_per_user_milestone_event() は is_test_event を受け取れず、
 * 今回のスキーマ変更(migration追加)は禁止されているため関数自体は変更しない。
 * 本番以外ではこのRPCを呼ばず、代わりに明示的に is_test_event=true で直接INSERTする。
 * 一意制約(analytics_events_once_per_user_milestone_uniq: event_name, user_idのみで
 * is_test_eventは区別しない)はこの直接INSERTにもそのまま適用されるため、重複時は
 * 23505(一意制約違反)がPostgres側から返り、RPCのON CONFLICT DO NOTHINGと同じ
 * "already_exists"として扱う(Postgresの一意制約違反はそれ自体がatomicなDB操作であり、
 * ON CONFLICT句を使わなくても同じ冪等性・競合安全性が保たれる)。これにより
 * growth-rollup-return-events.mjs 等のE2Eが検証している冪等性コントラクトを保ったまま、
 * Preview/ローカルdev実行が本番のD1/D7集計を汚染しない。本番の呼び出し経路・
 * atomicityは一切変更していない。
 *
 * 【重要: 本番以外の実行で「実ユーザー」を処理するケース】
 * computeReturnEvents()@rollup.tsは、Preview/ローカルdevで実行された場合でも
 * is_test_account=falseの実ユーザーに対してこの関数を呼び得る(rollup自体は
 * テストアカウントかどうかで対象ユーザーを絞っていない)。もしここで実ユーザーに対して
 * is_test_event=trueの行を直接INSERTしてしまうと、一意制約(event_name, user_idのみで
 * is_test_eventを区別しない)のせいで、後から実行される本番cronのRPC呼び出しが
 * このtest行と衝突し"already_exists"を返してしまう。本番集計はis_test_event=falseのみを
 * 見るため、その実ユーザーのD1/D7マイルストーンは本番指標から永久に欠落する
 * (今回はスキーマ変更禁止のためこの一意制約自体は直せない)。
 * これを防ぐため、本番以外での直接INSERT分岐に入る前に対象userIdが
 * profiles.is_test_account=trueかどうかを確認する。test accountであれば
 * (=このINSERT自体が意図した検証用途であり、本番の一意制約キーを実データ用に
 * 予約する心配がない)従来どおりis_test_event=trueで直接INSERTする。test accountで
 * なければ(=実ユーザー)、本番の一意制約キーを一切消費せず、何もINSERTせずに
 * "already_exists"を返す(=本番cronが後から安全にこのユーザーの行を作成できる状態を
 * 維持する。掲題どおり「本番以外の実行は本番の一意性キーを予約してはならない」)。
 *
 * opts.isTestAccountを渡さない場合、上記判定のためprofilesを毎回問い合わせる。
 * computeReturnEvents()@rollup.tsのように呼び出し側が既にnonTestProfilesとして
 * is_test_account=falseを確認済みの候補ユーザーをループ処理する場合、対象ユーザー数分だけ
 * この関数がprofilesへ問い合わせを繰り返すと(実ユーザーが増えるほど)非本番環境の
 * rollup実行やこのE2Eが遅くなる(Codexレビュー指摘対応)。呼び出し側が既に判定済みの
 * 場合はopts.isTestAccountで明示的に渡すことで、この冗長な問い合わせを省略できる。
 */
export async function insertOncePerUserMilestoneEvent(
  eventName: OncePerUserMilestoneEventName,
  userId: string,
  properties: Record<string, unknown> = {},
  opts: { isTestAccount?: boolean } = {},
): Promise<InsertOncePerUserMilestoneEventResult> {
  try {
    const admin = createAdminClient();
    const sanitized = sanitizeProperties(eventName, properties);

    if (!isProductionEnvironment()) {
      let isTestAccount = opts.isTestAccount;
      if (isTestAccount === undefined) {
        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("is_test_account")
          .eq("id", userId)
          .maybeSingle();
        if (profileError) {
          console.error("[insertOncePerUserMilestoneEvent] profile lookup failed:", eventName, userId, profileError.message);
          return { status: "failed", error: profileError.message };
        }
        isTestAccount = profile?.is_test_account ?? false;
      }
      if (!isTestAccount) {
        // 実ユーザー: 本番の一意制約キーを予約しないよう、何もINSERTしない。
        return { status: "already_exists" };
      }

      const { error } = await admin.from("analytics_events").insert({
        event_name: eventName,
        occurred_at: new Date().toISOString(),
        user_id: userId,
        properties: sanitized,
        schema_version: 1,
        device_category: "unknown",
        is_test_event: true,
      });
      if (error) {
        if (error.code === "23505") return { status: "already_exists" };
        console.error("[insertOncePerUserMilestoneEvent] non-production insert failed:", eventName, userId, error.message);
        return { status: "failed", error: error.message };
      }
      return { status: "inserted" };
    }

    const { data, error } = await admin.rpc("insert_once_per_user_milestone_event", {
      p_event_name: eventName,
      p_user_id: userId,
      p_properties: sanitized,
    });
    if (error) {
      console.error("[insertOncePerUserMilestoneEvent] rpc failed:", eventName, userId, error.message);
      return { status: "failed", error: error.message };
    }
    return { status: data === true ? "inserted" : "already_exists" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[insertOncePerUserMilestoneEvent] unexpected error:", eventName, userId, message);
    return { status: "failed", error: message };
  }
}

/**
 * 単語追加系API(教材インポート・CSV一括・AI提案一括追加など)で、
 * 追加の前後件数から five_words_added / ten_words_added の閾値越えを判定して発火する。
 * 1回のリクエストで一気に閾値を超えるケース(例: 0語→50語インポート)にも対応するため、
 * 「追加前件数 < 閾値 <= 追加後件数」で判定する(単純な差分カウントではない)。
 */
export async function trackWordCountMilestones(
  userId: string,
  countBefore: number,
  countAfter: number,
  e2eHeaderValue?: string | null,
  auditCookieValue?: string | null,
): Promise<void> {
  try {
    if (countBefore < 5 && countAfter >= 5) {
      await trackServerEvent("five_words_added", { userId, e2eHeaderValue, auditCookieValue });
    }
    if (countBefore < 10 && countAfter >= 10) {
      await trackServerEvent("ten_words_added", { userId, e2eHeaderValue, auditCookieValue });
    }
  } catch (e) {
    console.error("[trackWordCountMilestones] unexpected error:", e);
  }
}
