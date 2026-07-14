/**
 * Growth OS Phase 8: 収益ライフサイクル指標を「billing処理コードに一切触れず」に導出する。
 *
 * 制約: `src/app/api/stripe/webhook/route.ts`（Stripeイベント処理・課金ロジック本体）は
 * このラウンドの変更対象外。read-onlyでも編集は禁止。このファイルは同ファイルを
 * importしない・変更しない。使ってよいのは以下の read-only な情報源のみ:
 *
 *   1. `profiles` テーブル（read-only。書き込みは一切行わない）。
 *      webhookは Stripe イベントが来るたびに is_premium / stripe_customer_id /
 *      premium_expires_at / updated_at を書き換えるので、`updated_at` は
 *      「この行のbilling状態が最後に変わった日時」の代理指標として使える。
 *   2. Stripe API の read-only 呼び出し（`stripe.subscriptions.list` 等）。
 *      プラン種別（月額/年額）は `profiles` に列が無く、webhookのイベントハンドラを
 *      変更してその場で記録することもできないため、日次cronから直接Stripeに問い合わせて
 *      「今何のプランに入っているか」を確認する。
 *   3. `ai_usage_events`（メタデータのみのAI利用ログ、read-only）。
 *
 * ▼ new_subscriptions / cancellations / reactivations のヒューリスティック（重要・要注意）
 *
 * このアプリの `profiles` はStripeイベントの「今の状態」のスナップショットしか保持しない
 * （履歴テーブルが無い）。よって「今日 updated_at が変わった」という事実だけから
 * 「新規契約」「解約」「再契約」を100%正確に判別することはできない。次の代理指標を使う:
 *
 *   - new_subscriptions（新規契約 相当）:
 *     `is_premium = true` かつ `premium_expires_at IS NULL` かつ `updated_at` が対象日(JST)に
 *     含まれるプロフィール数。
 *     根拠: このアプリのwebhook実装は「解約予約中（期間終了まではアクセス可）」の状態でのみ
 *     `premium_expires_at` を設定し、通常のアクティブ課金中は NULL のままにする設計になっている
 *     （`src/app/api/stripe/webhook/route.ts` の呼び出し元である決済導線
 *     `src/app/api/stripe/checkout/route.ts` を含む既存実装から読み取れる規約）。
 *     そのため「is_premium=trueかつexpires_atがNULLの状態に切り替わった」ことは
 *     「新規に有効課金状態になった」ことの強いシグナルになる。
 *   - 既知の限界: 「新規契約」と「更新（renewal）による同フィールドへの再書き込み」を
 *     区別できない。もしwebhook側が毎回の請求成功（invoice.payment_succeeded）でも
 *     `profiles.updated_at` を更新する実装になっている場合、このヒューリスティックは
 *     新規契約数を過大に見積もる。true eventベース（`subscription_started`等）の計測に
 *     置き換えるまでは「アクティベーション件数の目安」として扱うこと。
 *   - cancellations（解約 相当）:
 *     `is_premium = false` かつ `stripe_customer_id IS NOT NULL`（＝元々Stripe顧客だった）
 *     かつ `updated_at` が対象日(JST)に含まれるプロフィール数。
 *     「解約予約」段階（is_premiumはまだtrueのまま）は含まない、期間終了で実際に
 *     アクセスを失った時点のみをカウントする。
 *   - reactivations（再契約 相当）:
 *     `profiles` のスナップショットだけでは「新規初契約」と「解約後の再契約」を
 *     区別する手段が無い（どちらも is_premium: false→true, premium_expires_at: NULL という
 *     同じ見え方になる）。誤ってnew_subscriptionsを過小評価しないよう、本実装では
 *     reactivationsは常に0として報告し、その旨をコメントで明示する
 *     （イベントベースの計測を追加するまでの既知の制約）。
 */

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

/**
 * このファイルは scripts/testing/test-revenue-metrics.mjs から直接importされてテストされる。
 * Node 24のネイティブTypeScript実行は.tsファイル間の相対import(拡張子省略)を解決できず、
 * かつtsconfig(`moduleResolution: bundler`)は明示的な.ts拡張子付きimportを許可しない(TS5097)ため、
 * `src/lib/utils/date.ts`のJST日次範囲変換ロジックをここに複製し、他ファイルへの依存を無くす
 * (`src/lib/growth/weekBoundary.ts`と同じ考え方)。
 */
function jstDayRangeISO(dateStr: string): { startISO: string; endISO: string } {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const startISO = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
  const endISO = new Date(new Date(startISO).getTime() + DAY_MS).toISOString();
  return { startISO, endISO };
}

// ─────────────────────────────────────────────────────────────
// 価格（src/app/premium/page.tsx 本文の「月額¥480」、
// src/app/premium/PremiumCheckout.tsx の「年間プラン ¥3,800/年」の表示価格と一致させること）
// ─────────────────────────────────────────────────────────────
export const MONTHLY_PRICE_JPY = 480;
export const YEARLY_PRICE_JPY = 3800;

// ─────────────────────────────────────────────────────────────
// AIコスト概算（プレースホルダー — 実際の請求額とは異なる目安値）
//
// ai_usage_events.input_size / output_size は「文字数」のメタデータのみ保存されている
// （プロンプト本文・生レスポンスは保存されない仕様）。日本語混じりの入出力を想定し、
// 「およそ2文字 ≒ 1トークン」というラフな換算＋ブレンド単価$0.002/1Kトークンで
// USD建てコストを概算し、固定レート換算でJPY化する。実際のモデル別料金・課金明細とは
// 一致しないことを明示するため、関数名・コメントに「estimate」であることを明記する。
// ─────────────────────────────────────────────────────────────
const CHARS_PER_TOKEN_ESTIMATE = 2; // 日本語混在テキストのラフな目安（英語なら本来4文字/token程度）
const USD_PER_1K_TOKENS_ESTIMATE = 0.002; // ブレンド単価のプレースホルダー（実際の請求とは異なる）
const JPY_PER_USD_ESTIMATE = 150; // 固定為替レートのプレースホルダー（実勢レートとは異なる）

export type ProfileBillingRow = {
  id: string;
  is_premium: boolean;
  is_test_account?: boolean | null;
  stripe_customer_id: string | null;
  premium_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionLifecycleCounts = {
  newSubscriptions: number;
  cancellations: number;
  /** 既知の限界によりprofilesスナップショットだけからは常に0（コメント参照）。 */
  reactivations: number;
};

/**
 * 指定したJST暦日について、`profiles.updated_at` を根拠にした新規契約・解約件数を数える。
 * DBに触れない純粋関数（テスト容易性のため）。`profiles` の取得自体は呼び出し側で行う。
 *
 * @param profiles is_test_account=true の行は呼び出し側で除外してから渡すこと。
 */
export function computeSubscriptionLifecycleCounts(
  profiles: ProfileBillingRow[],
  dateJST: string,
): SubscriptionLifecycleCounts {
  const { startISO, endISO } = jstDayRangeISO(dateJST);
  const isInDay = (iso: string) => iso >= startISO && iso < endISO;

  let newSubscriptions = 0;
  let cancellations = 0;
  for (const p of profiles) {
    if (!p.updated_at || !isInDay(p.updated_at)) continue;
    if (p.is_premium && p.premium_expires_at == null) {
      newSubscriptions++;
    } else if (!p.is_premium && p.stripe_customer_id) {
      cancellations++;
    }
  }
  return { newSubscriptions, cancellations, reactivations: 0 };
}

/** activeMonthly/activeYearly件数からMRR/ARRを計算する（表示価格を使う純粋関数）。 */
export function computeMrrArr(activeMonthly: number, activeYearly: number): { mrr: number; arr: number } {
  const mrr = activeMonthly * MONTHLY_PRICE_JPY + activeYearly * (YEARLY_PRICE_JPY / 12);
  const arr = mrr * 12;
  return { mrr: Math.round(mrr), arr: Math.round(arr) };
}

export type AiUsageSizeRow = { input_size: number | null; output_size: number | null };

/**
 * AIコストの概算（JPY）。実際の請求額の代わりにはならない粗い目安。
 * コメント冒頭の換算前提（CHARS_PER_TOKEN_ESTIMATE / USD_PER_1K_TOKENS_ESTIMATE /
 * JPY_PER_USD_ESTIMATE）を参照。
 */
export function estimateAiCostJpy(events: AiUsageSizeRow[]): number {
  let totalChars = 0;
  for (const e of events) {
    totalChars += (e.input_size ?? 0) + (e.output_size ?? 0);
  }
  const estimatedTokens = totalChars / CHARS_PER_TOKEN_ESTIMATE;
  const usd = (estimatedTokens / 1000) * USD_PER_1K_TOKENS_ESTIMATE;
  return Math.round(usd * JPY_PER_USD_ESTIMATE * 100) / 100;
}

export type PlanBucket = "monthly" | "yearly" | "unknown";

/**
 * Stripe APIを read-only で呼び出し、`stripe_customer_id` ごとに現在アクティブな
 * サブスクリプションの請求間隔（month/year）を判定する。checkout作成やStripeの状態変更は
 * 一切行わない（`stripe.subscriptions.list` のみ）。
 *
 * 呼び出し回数を抑えるため、日次cronから1日1回だけ・現在プレミアムのユーザー分だけ呼ぶ想定。
 */
export async function classifyPremiumUsersByPlan(
  stripe: Stripe,
  customerIds: string[],
): Promise<Map<string, PlanBucket>> {
  const result = new Map<string, PlanBucket>();
  // Stripeのレート制限に配慮し、直列実行に留める
  // （このアプリの現状の会員規模ではボトルネックにならない。将来的に規模が増える場合は
  //   小さな同時実行数のバッチ処理に変更すること）。
  for (const customerId of customerIds) {
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
      const sub = subs.data[0];
      const interval = sub?.items?.data?.[0]?.price?.recurring?.interval;
      if (interval === "month") result.set(customerId, "monthly");
      else if (interval === "year") result.set(customerId, "yearly");
      else result.set(customerId, "unknown");
    } catch (e) {
      console.error(`[revenueSnapshot] stripe.subscriptions.list failed for ${customerId}:`, e instanceof Error ? e.message : e);
      result.set(customerId, "unknown");
    }
  }
  return result;
}

export type RevenueSnapshotRow = {
  metric_date: string;
  mrr: number;
  arr: number;
  new_subscriptions: number;
  cancellations: number;
  reactivations: number;
  active_monthly: number;
  active_yearly: number;
  ai_cost_estimate: number;
};

/**
 * 指定したJST暦日1日分の `analytics_revenue_daily` 行を構築する（read-onlyクエリ + Stripe read-only APIのみ）。
 * `profiles` への書き込みは行わない。
 *
 * active_monthly/active_yearly/mrr/arr は「現在時点のprofiles.is_premiumスナップショット」を
 * 基準にする（`profiles` に履歴が無いため、過去日について正確な当時の値を再現することはできない。
 * `src/lib/analytics/rollup.ts` の既存実装と同じ制約・同じ方針）。
 */
export async function buildRevenueSnapshotForDay(
  admin: Admin,
  stripe: Stripe | null,
  dateJST: string,
): Promise<RevenueSnapshotRow> {
  const { data: testAccountRows } = await admin.from("profiles").select("id").eq("is_test_account", true);
  const testAccountIds = new Set((testAccountRows ?? []).map((r) => r.id as string));

  const { data: profileRows, error: profileErr } = await admin
    .from("profiles")
    .select("id, is_premium, stripe_customer_id, premium_expires_at, created_at, updated_at, is_test_account");
  if (profileErr) throw new Error(`profiles取得失敗: ${profileErr.message}`);

  const profiles = ((profileRows ?? []) as ProfileBillingRow[]).filter((p) => !testAccountIds.has(p.id));

  const { newSubscriptions, cancellations, reactivations } = computeSubscriptionLifecycleCounts(profiles, dateJST);

  const premiumWithCustomer = profiles.filter((p) => p.is_premium && p.stripe_customer_id);
  let activeMonthly = 0;
  let activeYearly = 0;
  if (stripe && premiumWithCustomer.length > 0) {
    const planMap = await classifyPremiumUsersByPlan(
      stripe,
      premiumWithCustomer.map((p) => p.stripe_customer_id as string),
    );
    for (const p of premiumWithCustomer) {
      const bucket = planMap.get(p.stripe_customer_id as string) ?? "unknown";
      if (bucket === "monthly") activeMonthly++;
      else if (bucket === "yearly") activeYearly++;
    }
  }

  const { mrr, arr } = computeMrrArr(activeMonthly, activeYearly);

  const { startISO, endISO } = jstDayRangeISO(dateJST);
  const { data: aiRows } = await admin
    .from("ai_usage_events")
    .select("input_size, output_size, user_id")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .limit(20000);
  const aiEvents = ((aiRows ?? []) as (AiUsageSizeRow & { user_id: string | null })[]).filter(
    (r) => !r.user_id || !testAccountIds.has(r.user_id),
  );
  const ai_cost_estimate = estimateAiCostJpy(aiEvents);

  return {
    metric_date: dateJST,
    mrr,
    arr,
    new_subscriptions: newSubscriptions,
    cancellations,
    reactivations,
    active_monthly: activeMonthly,
    active_yearly: activeYearly,
    ai_cost_estimate,
  };
}

/** `analytics_revenue_daily` へUPSERTする（onConflict: metric_date）。`profiles`へは一切書き込まない。 */
export async function upsertRevenueSnapshot(admin: Admin, row: RevenueSnapshotRow): Promise<void> {
  const { error } = await admin.from("analytics_revenue_daily").upsert(row, { onConflict: "metric_date" });
  if (error) throw new Error(`analytics_revenue_daily upsert失敗: ${error.message}`);
}
