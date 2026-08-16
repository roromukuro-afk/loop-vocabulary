/**
 * Growth OS Phase 3: 日次ロールアップの集計ロジック。
 *
 * `analytics_events`(生イベント)・`words`/`daily_stats`/`study_results`/`profiles`等の
 * 既存テーブルから、`analytics_daily_metrics` / `analytics_daily_funnels` /
 * `analytics_content_performance` / `analytics_revenue_daily` / `analytics_retention_cohorts`
 * を計算する。呼び出し元(`src/app/api/cron/growth-rollup/route.ts`)がカテゴリ単位で
 * try/catchするため、ここでは例外を投げてよい(1カテゴリの失敗が他を巻き込まないのは
 * route側の責務)。
 *
 * 全指標について `profiles.is_test_account = true` のユーザーを除外する。
 *
 * 日付はすべて `src/lib/utils/date.ts` のJSTユーティリティを再利用する(独自の日付計算を
 * 増やさない)。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { daysAgoJST, jstDayRangeISO, jstWeekdayIndex, todayJST, toJstDateString } from "@/lib/utils/date";
import {
  classifyPremiumUsersByPlan,
  computeMrrArr,
  computeSubscriptionLifecycleCounts,
  estimateAiCostJpy,
  type ProfileBillingRow,
  type RevenueSnapshotRow,
} from "@/lib/growth/revenueSnapshot";
import { insertOncePerUserMilestoneEvent } from "./trackServerEvent";

type Admin = SupabaseClient;

// 大量データでもPostgRESTのデフォルト行数上限(1000件)に引っかからないようにする上限値。
// このアプリの現状の規模(words 4000件台等)では十分な余裕を持たせている。
const BULK_FETCH_LIMIT = 20000;

export type CategoryResult = {
  ok: boolean;
  detail: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────
// 共通: テストアカウント除外セット
// ─────────────────────────────────────────────────────────────

export async function fetchTestAccountIds(admin: Admin): Promise<Set<string>> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("is_test_account", true)
    .limit(BULK_FETCH_LIMIT);
  if (error) throw new Error(`profiles(is_test_account)取得失敗: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id as string));
}

// ─────────────────────────────────────────────────────────────
// 共通: ユーザーごとの「初回単語追加日」「初回テスト完了日」「初回復習完了日(近似)」
//
// 複数の指標(North Star・ファネル)で同じ定義を使うため一度だけ計算する。
// METRIC_DICTIONARY.mdの定義に沿い、専用イベントが無くても既存テーブルから近似できる
// ようにしている:
//   - 初回単語追加日 = words.created_at(JST日付)の最小値
//   - 初回テスト完了日 = study_results.answered_at(JST日付)の最小値
//     (METRIC_DICTIONARY.md: 「`first_test_completed`イベント、または`study_results`に
//      該当ユーザーの行が存在」という定義に合わせ、テーブル存在を正とする)
//   - 初回復習完了日(近似) = 初回単語追加日より後(JST日付ベース)の最初の
//     study_results.answered_at日。真の「別セッションでの復習」判定ではないが、
//     `first_review_completed`イベントが未配線でも0にならない近似値として使う。
// ─────────────────────────────────────────────────────────────

export type UserActivationProxies = {
  firstWordDate: Map<string, string>; // user_id -> "YYYY-MM-DD" (JST)
  wordsCreatedDates: Map<string, string[]>; // user_id -> sorted "YYYY-MM-DD"[] (累計語数計算用)
  firstTestDate: Map<string, string>;
  firstReviewDate: Map<string, string>;
};

export async function computeUserActivationProxies(
  admin: Admin,
  testAccountIds: Set<string>,
): Promise<UserActivationProxies> {
  const [{ data: wordsRows, error: wordsErr }, { data: studyRows, error: studyErr }] = await Promise.all([
    admin.from("words").select("user_id, created_at").limit(BULK_FETCH_LIMIT),
    admin.from("study_results").select("user_id, answered_at").limit(BULK_FETCH_LIMIT),
  ]);
  if (wordsErr) throw new Error(`words取得失敗: ${wordsErr.message}`);
  if (studyErr) throw new Error(`study_results取得失敗: ${studyErr.message}`);

  const wordsCreatedDates = new Map<string, string[]>();
  for (const row of wordsRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    const d = toJstDateString(new Date(row.created_at as string));
    const arr = wordsCreatedDates.get(uid) ?? [];
    arr.push(d);
    wordsCreatedDates.set(uid, arr);
  }
  for (const arr of wordsCreatedDates.values()) arr.sort();

  const firstWordDate = new Map<string, string>();
  for (const [uid, dates] of wordsCreatedDates) firstWordDate.set(uid, dates[0]);

  const studyDatesByUser = new Map<string, string[]>();
  for (const row of studyRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    const d = toJstDateString(new Date(row.answered_at as string));
    const arr = studyDatesByUser.get(uid) ?? [];
    arr.push(d);
    studyDatesByUser.set(uid, arr);
  }
  for (const arr of studyDatesByUser.values()) arr.sort();

  const firstTestDate = new Map<string, string>();
  const firstReviewDate = new Map<string, string>();
  for (const [uid, dates] of studyDatesByUser) {
    firstTestDate.set(uid, dates[0]);
    const firstWord = firstWordDate.get(uid);
    if (firstWord) {
      const laterDate = dates.find((d) => d > firstWord);
      if (laterDate) firstReviewDate.set(uid, laterDate);
    }
  }

  return { firstWordDate, wordsCreatedDates, firstTestDate, firstReviewDate };
}

// ─────────────────────────────────────────────────────────────
// analytics_daily_metrics: dau / new_signups / weekly_activated_learners ほか
// ─────────────────────────────────────────────────────────────

export async function computeDailyMetrics(
  admin: Admin,
  days: string[],
  testAccountIds: Set<string>,
  proxies: UserActivationProxies,
): Promise<CategoryResult> {
  const rows: { metric_date: string; metric_name: string; dimension: string; value: number }[] = [];

  // daily_statsは複数日にまたがって必要(dau・週間アクティベーション両方)なので
  // 対象期間+ローリング7日窓の分だけ広めに1回だけ取得する。
  const widestStart = daysAgoJST(6, new Date(`${days[0]}T12:00:00+09:00`));
  const { data: dsRows, error: dsErr } = await admin
    .from("daily_stats")
    .select("user_id, day, studied_count")
    .gte("day", widestStart)
    .lte("day", days[days.length - 1])
    .limit(BULK_FETCH_LIMIT);
  if (dsErr) throw new Error(`daily_stats取得失敗: ${dsErr.message}`);
  const activeByDay = new Map<string, Set<string>>(); // day -> set of user_id with studied_count>0
  for (const row of dsRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    if ((row.studied_count as number) <= 0) continue;
    const day = row.day as string;
    const set = activeByDay.get(day) ?? new Set<string>();
    set.add(uid);
    activeByDay.set(day, set);
  }

  const { data: profilesRows, error: profErr } = await admin
    .from("profiles")
    .select("id, created_at, is_test_account")
    .limit(BULK_FETCH_LIMIT);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  const nonTestProfiles = (profilesRows ?? []).filter((p) => !p.is_test_account);

  for (const day of days) {
    const { startISO, endISO } = jstDayRangeISO(day);

    // dau: daily_stats(studied_count>0) と analytics_events(user_idあり)の合算distinct
    const dauSet = new Set<string>(activeByDay.get(day) ?? []);
    const { data: eventUserRows, error: euErr } = await admin
      .from("analytics_events")
      .select("user_id")
      .gte("occurred_at", startISO)
      .lt("occurred_at", endISO)
      .not("user_id", "is", null)
      .eq("is_test_event", false)
      .limit(BULK_FETCH_LIMIT);
    if (euErr) throw new Error(`analytics_events(dau用)取得失敗(${day}): ${euErr.message}`);
    for (const r of eventUserRows ?? []) {
      const uid = r.user_id as string;
      if (!testAccountIds.has(uid)) dauSet.add(uid);
    }
    rows.push({ metric_date: day, metric_name: "dau", dimension: "", value: dauSet.size });

    // new_signups
    const newSignups = nonTestProfiles.filter((p) => {
      const created = p.created_at as string;
      return created >= startISO && created < endISO;
    }).length;
    rows.push({ metric_date: day, metric_name: "new_signups", dimension: "", value: newSignups });

    // weekly_activated_learners: North Star。METRIC_DICTIONARY.mdは「JST月曜始まりの対象週」を
    // 単位に定義しているが、このcronは日次で「その日を最終日とするローリング7日窓」を
    // 疑似的な対象週として使い、毎日値を更新できるようにしている(厳密な暦週境界が必要な
    // 場合は月曜日の行だけを見れば暦週集計に一致する)。
    const weekStart = daysAgoJST(6, new Date(`${day}T12:00:00+09:00`));
    const weekDates = new Set<string>();
    for (let i = 0; i < 7; i++) weekDates.add(daysAgoJST(6 - i, new Date(`${day}T12:00:00+09:00`)));

    let activatedCount = 0;
    for (const p of nonTestProfiles) {
      const uid = p.id as string;
      const createdDates = proxies.wordsCreatedDates.get(uid);
      if (!createdDates) continue;
      // 条件1: 累計10語以上(day時点)
      const cumulativeCount = createdDates.filter((d) => d <= day).length;
      if (cumulativeCount < 10) continue;
      // 条件2: 初回テスト完了(day時点までに)
      const firstTest = proxies.firstTestDate.get(uid);
      if (!firstTest || firstTest > day) continue;
      // 条件3: 初回とは別セッションでの復習完了(近似, day時点までに)
      const firstReview = proxies.firstReviewDate.get(uid);
      if (!firstReview || firstReview > day) continue;
      // 条件4: 対象週(ローリング7日窓)内に学習アクティビティがある
      let hasWeekActivity = false;
      for (const wd of weekDates) {
        if (activeByDay.get(wd)?.has(uid)) {
          hasWeekActivity = true;
          break;
        }
      }
      if (!hasWeekActivity) continue;
      activatedCount++;
    }
    rows.push({
      metric_date: day,
      metric_name: "weekly_activated_learners",
      dimension: "",
      value: activatedCount,
    });

    // 補助指標: AI解説利用数(events由来。未配線ならevent_countは0のまま)
    // 【2026-07-14 修正】以前はテストアカウント/テストイベントを除外していなかった
    // (count専用クエリはuser_idを取得できずフィルタ不可能だった)。user_idを取得して
    // からフィルタする方式に変更した。
    const { data: aiEventRows, error: aiErr } = await admin
      .from("analytics_events")
      .select("user_id")
      .eq("event_name", "ai_explanation_used")
      .eq("is_test_event", false)
      .gte("occurred_at", startISO)
      .lt("occurred_at", endISO)
      .limit(BULK_FETCH_LIMIT);
    if (aiErr) throw new Error(`ai_explanation_used集計失敗(${day}): ${aiErr.message}`);
    const aiCount = (aiEventRows ?? []).filter((r) => {
      const uid = r.user_id as string | null;
      return !uid || !testAccountIds.has(uid);
    }).length;
    rows.push({
      metric_date: day,
      metric_name: "ai_explanation_used_count",
      dimension: "",
      value: aiCount,
    });
  }

  const { error: upsertErr } = await admin
    .from("analytics_daily_metrics")
    .upsert(rows, { onConflict: "metric_date,metric_name,dimension" });
  if (upsertErr) throw new Error(`analytics_daily_metrics upsert失敗: ${upsertErr.message}`);

  return { ok: true, detail: { rows: rows.length, metrics: ["dau", "new_signups", "weekly_activated_learners", "ai_explanation_used_count"] } };
}

// ─────────────────────────────────────────────────────────────
// analytics_daily_funnels: 12ステップの主要ファネル(funnel_key='main')
// ─────────────────────────────────────────────────────────────

type FunnelStepDef =
  | { key: string; order: number; kind: "events"; eventNames: string[] }
  | { key: string; order: number; kind: "signup_completed_union" }
  | { key: string; order: number; kind: "first_word_added" }
  | { key: string; order: number; kind: "first_test_completed" }
  | { key: string; order: number; kind: "first_review_completed" }
  | { key: string; order: number; kind: "day7_retained" };

const FUNNEL_STEPS: FunnelStepDef[] = [
  { key: "lp_article_dictionary_reached", order: 1, kind: "events", eventNames: ["landing_view", "guide_view", "material_view", "dictionary_view", "word_page_view"] },
  { key: "tool_started", order: 2, kind: "events", eventNames: ["vocab_check_started"] },
  { key: "tool_completed", order: 3, kind: "events", eventNames: ["vocab_check_completed"] },
  { key: "signup_cta_clicked", order: 4, kind: "events", eventNames: ["vocab_check_signup_clicked"] },
  // signup_completed: 単純にsignup_completedイベントだけを数えるのではなく、
  // signup_oauth_completed(/loginページのGoogle OAuth経由の新規signup。callback側から
  // サーバー発火する)も合わせて数える(Codexレビュー指摘対応、19巡目、最重要:
  // 「Include callback-only signups in the main funnel」。/loginでGoogle OAuth経由の
  // 新規signupが完了した場合、signup_completedは一切発火せずsignup_oauth_completedのみが
  // 発火するため、以前はこのメインファネルから完全に抜け落ちていた)。両者をそのまま
  // countDistinctSessionOrUser()でuser_id優先dedupeすると、/signupのGoogle OAuth経路
  // (client側のsignup_completedはOAuthリダイレクト前=未認証でuser_id=null、server側の
  // signup_oauth_completedは認証後でuser_id有り。両者は同一anonymous_session_idを共有する)
  // で同じ1件のsignupが2件として二重計上されてしまうため、専用のkind
  // (signup_completed_union)でanonymous_session_id優先のdedupeを行う。
  { key: "signup_completed", order: 5, kind: "signup_completed_union" },
  { key: "first_word_added", order: 6, kind: "first_word_added" },
  { key: "first_test_completed", order: 7, kind: "first_test_completed" },
  { key: "first_review_completed", order: 8, kind: "first_review_completed" },
  { key: "day7_retained", order: 9, kind: "day7_retained" },
  { key: "premium_page_viewed", order: 10, kind: "events", eventNames: ["premium_page_viewed"] },
  { key: "checkout_started", order: 11, kind: "events", eventNames: ["checkout_started"] },
  { key: "contract_completed", order: 12, kind: "events", eventNames: ["checkout_completed"] },
];

async function countDistinctSessionOrUser(
  admin: Admin,
  eventNames: string[],
  startISO: string,
  endISO: string,
  testAccountIds: Set<string>,
): Promise<number> {
  const { data, error } = await admin
    .from("analytics_events")
    .select("user_id, anonymous_session_id")
    .in("event_name", eventNames)
    .eq("is_test_event", false)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO)
    .limit(BULK_FETCH_LIMIT);
  if (error) throw new Error(`analytics_events(${eventNames.join(",")})取得失敗: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const uid = row.user_id as string | null;
    if (uid) {
      if (testAccountIds.has(uid)) continue;
      set.add(uid);
      continue;
    }
    const sid = row.anonymous_session_id as string | null;
    if (sid) set.add(sid);
  }
  return set.size;
}

// signup_completedステップ専用のカウント(Codexレビュー指摘対応、19巡目・20巡目、
// 最重要)。signup_completed(クライアント側、/signupのOAuthリダイレクト直前に発火する
// 「開始した」だけの楽観的マーカー)とsignup_oauth_completed(サーバー側、
// /auth/callbackから実際の認証完了後にのみ発火する検証済みの完了イベント)の両方を
// 1つのsignup完了として数える必要がある(/loginのGoogle OAuth新規signupはこちらしか
// 発火しない)。ただしGoogle経路については、signup_completed(method=google)を
// そのまま数に含めると2つの問題が生じる:
//  (1) 同一日内の二重計上: 同一anonymous_session_idで、signup_completedはOAuth
//      リダイレクト前=未認証でuser_id無し、signup_oauth_completedは認証後で
//      user_id有りの2行が発生し、user_id優先dedupeだと別人として扱われてしまう
//      (Codexレビュー指摘対応、19巡目)。
//  (2) 日付境界をまたぐ二重計上: このカウント自体が日ごとに独立したクエリとして
//      呼ばれるため、OAuth開始(signup_completed)がJST日付境界の直前、callback完了
//      (signup_oauth_completed)が直後に発生した場合、同一sidが「前日の1件」と
//      「翌日の1件」として別々の日次クエリでそれぞれ1件ずつカウントされ、
//      複数日ファネル合計では2件に水増しされてしまう(Codexレビュー指摘対応、
//      20巡目、最重要:「Deduplicate OAuth completion across daily boundaries」)。
// (1)(2)いずれも、signup_completed(method=google)を「開始した」という未検証の
// シグナルとして完全に除外し、Google経由の完了は必ずsignup_oauth_completed
// (常にただ1つの原子的なイベントであり、日付をまたいで分裂しない)だけを唯一の
// 正とすることで同時に解消できる(Codexレビュー指摘20巡目の提案どおり)。
// signup_completed(method=email等、google以外)は対応するoauth_completedイベントが
// 存在しないため引き続きそのまま数える。
async function countDistinctSignupCompletions(
  admin: Admin,
  startISO: string,
  endISO: string,
  testAccountIds: Set<string>,
): Promise<number> {
  const { data, error } = await admin
    .from("analytics_events")
    .select("event_name, user_id, anonymous_session_id, properties")
    .in("event_name", ["signup_completed", "signup_oauth_completed"])
    .eq("is_test_event", false)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO)
    .limit(BULK_FETCH_LIMIT);
  if (error) throw new Error(`analytics_events(signup_completed,signup_oauth_completed)取得失敗: ${error.message}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const uid = row.user_id as string | null;
    if (uid && testAccountIds.has(uid)) continue;
    if (row.event_name === "signup_completed") {
      const props = (row.properties ?? {}) as Record<string, unknown>;
      if (props.method === "google") continue;
    }
    const sid = row.anonymous_session_id as string | null;
    if (sid) {
      set.add(sid);
    } else if (uid) {
      set.add(uid);
    }
  }
  return set.size;
}

export async function computeFunnels(
  admin: Admin,
  days: string[],
  testAccountIds: Set<string>,
  proxies: UserActivationProxies,
): Promise<CategoryResult> {
  const rows: { metric_date: string; funnel_key: string; step_key: string; step_order: number; count: number }[] = [];
  const skipped: string[] = [];

  const { data: profilesRows, error: profErr } = await admin
    .from("profiles")
    .select("id, created_at, is_test_account")
    .limit(BULK_FETCH_LIMIT);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  const nonTestProfiles = (profilesRows ?? []).filter((p) => !p.is_test_account);

  const { data: dsRows, error: dsErr } = await admin
    .from("daily_stats")
    .select("user_id, day, studied_count")
    .gte("day", days[0])
    .lte("day", days[days.length - 1])
    .gt("studied_count", 0)
    .limit(BULK_FETCH_LIMIT);
  if (dsErr) throw new Error(`daily_stats取得失敗: ${dsErr.message}`);
  const activeByDay = new Map<string, Set<string>>();
  for (const row of dsRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    const day = row.day as string;
    const set = activeByDay.get(day) ?? new Set<string>();
    set.add(uid);
    activeByDay.set(day, set);
  }

  for (const day of days) {
    const { startISO, endISO } = jstDayRangeISO(day);
    for (const step of FUNNEL_STEPS) {
      let count = 0;
      try {
        if (step.kind === "events") {
          count = await countDistinctSessionOrUser(admin, step.eventNames, startISO, endISO, testAccountIds);
        } else if (step.kind === "signup_completed_union") {
          count = await countDistinctSignupCompletions(admin, startISO, endISO, testAccountIds);
        } else if (step.kind === "first_word_added") {
          count = [...proxies.firstWordDate.entries()].filter(([, d]) => d === day).length;
        } else if (step.kind === "first_test_completed") {
          count = [...proxies.firstTestDate.entries()].filter(([, d]) => d === day).length;
        } else if (step.kind === "first_review_completed") {
          count = [...proxies.firstReviewDate.entries()].filter(([, d]) => d === day).length;
        } else if (step.kind === "day7_retained") {
          const signupDay = daysAgoJST(7, new Date(`${day}T12:00:00+09:00`));
          const activeToday = activeByDay.get(day) ?? new Set<string>();
          count = nonTestProfiles.filter((p) => {
            const createdJst = toJstDateString(new Date(p.created_at as string));
            return createdJst === signupDay && activeToday.has(p.id as string);
          }).length;
        }
      } catch (e) {
        skipped.push(`${day}/${step.key}: ${e instanceof Error ? e.message : String(e)}`);
        count = 0;
      }
      rows.push({ metric_date: day, funnel_key: "main", step_key: step.key, step_order: step.order, count });
    }
  }

  const { error: upsertErr } = await admin
    .from("analytics_daily_funnels")
    .upsert(rows, { onConflict: "metric_date,funnel_key,step_key" });
  if (upsertErr) throw new Error(`analytics_daily_funnels upsert失敗: ${upsertErr.message}`);

  return { ok: true, detail: { rows: rows.length, steps: FUNNEL_STEPS.map((s) => s.key), skipped } };
}

// ─────────────────────────────────────────────────────────────
// analytics_content_performance: guide/material/dictionary/tool のview→conversion
// ─────────────────────────────────────────────────────────────

export async function computeContentPerformance(
  admin: Admin,
  days: string[],
  testAccountIds: Set<string>,
): Promise<CategoryResult> {
  const rows: { metric_date: string; content_type: string; content_key: string; views: number; conversions: number }[] = [];
  const notes: string[] = [
    "guide: guide_view(views) + guide_cta_click(properties.guide_slug, conversions)。conversionsは記事内リンク(vocab_check/dictionary/premium/materials/tools/other_guide)のクリック件数であり、遷移先での完了(signup等)そのものではないクリックスルー指標(Codexレビュー指摘対応、19巡目: 以前はguide_cta_clickが許可リスト未登録のためconversionsが常に0だった)。",
    "tool: tool_view(views)。conversionsはvocab_check_completedのproperties.variantをtool_keyと同一視するベストエフォート対応(値の命名が一致しない場合は0になる)。",
  ];

  for (const day of days) {
    const { startISO, endISO } = jstDayRangeISO(day);

    // guide: guide_view(views) + guide_cta_click(properties.guide_slug, conversions)
    const guideViews = await groupCountByProperty(admin, "guide_view", "guide_slug", startISO, endISO, testAccountIds);
    const guideConversions = await groupCountByProperty(admin, "guide_cta_click", "guide_slug", startISO, endISO, testAccountIds);
    const guideKeys = new Set([...guideViews.keys(), ...guideConversions.keys()]);
    for (const key of guideKeys) {
      rows.push({
        metric_date: day,
        content_type: "guide",
        content_key: key,
        views: guideViews.get(key) ?? 0,
        conversions: guideConversions.get(key) ?? 0,
      });
    }

    // material: material_view(views) + words.material_id(その日に追加された語数, conversions)
    const materialViews = await groupCountByProperty(admin, "material_view", "material_id", startISO, endISO, testAccountIds);
    const materialConversions = await countWordsByMaterialId(admin, startISO, endISO, testAccountIds);
    const materialKeys = new Set([...materialViews.keys(), ...materialConversions.keys()]);
    for (const key of materialKeys) {
      rows.push({
        metric_date: day,
        content_type: "material",
        content_key: key,
        views: materialViews.get(key) ?? 0,
        conversions: materialConversions.get(key) ?? 0,
      });
    }

    // dictionary: word_page_view(views) + dictionary_word_added(conversions), word_slugで対応
    const dictViews = await groupCountByProperty(admin, "word_page_view", "word_slug", startISO, endISO, testAccountIds);
    const dictConversions = await groupCountByProperty(admin, "dictionary_word_added", "word_slug", startISO, endISO, testAccountIds);
    const dictKeys = new Set([...dictViews.keys(), ...dictConversions.keys()]);
    for (const key of dictKeys) {
      rows.push({
        metric_date: day,
        content_type: "dictionary",
        content_key: key,
        views: dictViews.get(key) ?? 0,
        conversions: dictConversions.get(key) ?? 0,
      });
    }

    // tool: tool_view(views) + vocab_check_completed(properties.variant, conversions)
    const toolViews = await groupCountByProperty(admin, "tool_view", "tool_key", startISO, endISO, testAccountIds);
    const toolConversions = await groupCountByProperty(admin, "vocab_check_completed", "variant", startISO, endISO, testAccountIds);
    const toolKeys = new Set([...toolViews.keys(), ...toolConversions.keys()]);
    for (const key of toolKeys) {
      rows.push({
        metric_date: day,
        content_type: "tool",
        content_key: key,
        views: toolViews.get(key) ?? 0,
        conversions: toolConversions.get(key) ?? 0,
      });
    }
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await admin
      .from("analytics_content_performance")
      .upsert(rows, { onConflict: "metric_date,content_type,content_key" });
    if (upsertErr) throw new Error(`analytics_content_performance upsert失敗: ${upsertErr.message}`);
  }

  return { ok: true, detail: { rows: rows.length, notes } };
}

async function groupCountByProperty(
  admin: Admin,
  eventName: string,
  propKey: string,
  startISO: string,
  endISO: string,
  testAccountIds: Set<string>,
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("analytics_events")
    .select("user_id, properties")
    .eq("event_name", eventName)
    .eq("is_test_event", false)
    .gte("occurred_at", startISO)
    .lt("occurred_at", endISO)
    .limit(BULK_FETCH_LIMIT);
  if (error) throw new Error(`analytics_events(${eventName})取得失敗: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const uid = row.user_id as string | null;
    if (uid && testAccountIds.has(uid)) continue;
    const props = (row.properties ?? {}) as Record<string, unknown>;
    const key = props[propKey];
    if (typeof key !== "string" || key.length === 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function countWordsByMaterialId(
  admin: Admin,
  startISO: string,
  endISO: string,
  testAccountIds: Set<string>,
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("words")
    .select("user_id, material_id, created_at")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .not("material_id", "is", null)
    .limit(BULK_FETCH_LIMIT);
  if (error) throw new Error(`words(material_id)取得失敗: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    const key = row.material_id as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────
// analytics_revenue_daily
// ─────────────────────────────────────────────────────────────

export async function computeRevenue(
  admin: Admin,
  days: string[],
  testAccountIds: Set<string>,
): Promise<CategoryResult> {
  // Phase 8で refine: プラン種別(月額/年額)は `subscription_started` イベントの
  // properties.plan に依存していたが、そのイベントはチェックアウト/webhook側の変更
  // (このラウンドでは対象外)なしには発火しないため、実運用では永久にunknownバケットへ
  // 落ちてしまう。代わりに Stripe API を read-only で直接叩いてプランを判定する
  // (`src/lib/growth/revenueSnapshot.ts` 参照。billing処理コード自体には一切触れない)。
  // new_subscriptions/cancellations も同様に、存在しないイベントへの依存をやめ、
  // `profiles.updated_at` を根拠にしたヒューリスティックに置き換えた
  // (ヒューリスティックの前提・既知の限界は revenueSnapshot.ts のコメントを参照)。
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeKey ? new Stripe(stripeKey) : null;

  const { data: profileRows, error: profErr } = await admin
    .from("profiles")
    .select("id, is_premium, is_test_account, stripe_customer_id, premium_expires_at, created_at, updated_at")
    .limit(BULK_FETCH_LIMIT);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  const profiles = ((profileRows ?? []) as ProfileBillingRow[]).filter((p) => !testAccountIds.has(p.id));

  const premiumWithCustomer = profiles.filter((p) => p.is_premium && p.stripe_customer_id);
  let activeMonthly = 0;
  let activeYearly = 0;
  let activeUnknown = 0;
  if (stripe && premiumWithCustomer.length > 0) {
    const planMap = await classifyPremiumUsersByPlan(
      stripe,
      premiumWithCustomer.map((p) => p.stripe_customer_id as string),
    );
    for (const p of premiumWithCustomer) {
      const bucket = planMap.get(p.stripe_customer_id as string) ?? "unknown";
      if (bucket === "monthly") activeMonthly++;
      else if (bucket === "yearly") activeYearly++;
      else activeUnknown++; // 推測せずunknownとして計上する(analytics_daily_metricsに別途記録)
    }
  } else {
    // STRIPE_SECRET_KEY未設定時はStripeに問い合わせず、全員unknownバケットに計上する
    // (mrr/arrを実態より過大計上しないためのフェイルセーフ)。
    activeUnknown = premiumWithCustomer.length;
  }

  const { mrr, arr } = computeMrrArr(activeMonthly, activeYearly);

  const revenueRows: RevenueSnapshotRow[] = [];
  const unknownPlanMetricRows: { metric_date: string; metric_name: string; dimension: string; value: number }[] = [];

  for (const day of days) {
    const { newSubscriptions, cancellations, reactivations } = computeSubscriptionLifecycleCounts(profiles, day);

    const { startISO, endISO } = jstDayRangeISO(day);
    const { data: aiRows, error: aiErr } = await admin
      .from("ai_usage_events")
      .select("input_size, output_size, user_id")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .limit(BULK_FETCH_LIMIT);
    if (aiErr) throw new Error(`ai_usage_events取得失敗: ${aiErr.message}`);
    const aiEvents = (aiRows ?? []).filter((r) => !r.user_id || !testAccountIds.has(r.user_id as string));
    const ai_cost_estimate = estimateAiCostJpy(aiEvents);

    // active_monthly/active_yearly/mrr/arrは「現在時点のprofiles.is_premiumスナップショット」を
    // 過去7日分すべてに同じ値でスタンプする(profiles側に履歴が無いため、日別の過去値を正確に
    // 再現することはできない。指示書の「profiles.is_premium counts」方針に沿った仕様)。
    revenueRows.push({
      metric_date: day,
      mrr,
      arr,
      new_subscriptions: newSubscriptions,
      cancellations,
      reactivations,
      active_monthly: activeMonthly,
      active_yearly: activeYearly,
      ai_cost_estimate,
    });
    unknownPlanMetricRows.push({
      metric_date: day,
      metric_name: "active_premium_unknown_plan",
      dimension: "",
      value: activeUnknown,
    });
  }

  const { error: upsertErr } = await admin
    .from("analytics_revenue_daily")
    .upsert(revenueRows, { onConflict: "metric_date" });
  if (upsertErr) throw new Error(`analytics_revenue_daily upsert失敗: ${upsertErr.message}`);

  const { error: metricsUpsertErr } = await admin
    .from("analytics_daily_metrics")
    .upsert(unknownPlanMetricRows, { onConflict: "metric_date,metric_name,dimension" });
  if (metricsUpsertErr) throw new Error(`active_premium_unknown_plan upsert失敗: ${metricsUpsertErr.message}`);

  return {
    ok: true,
    detail: { rows: revenueRows.length, activeMonthly, activeYearly, activeUnknown, mrr, arr },
  };
}

// ─────────────────────────────────────────────────────────────
// analytics_retention_cohorts: 登録週(JST月曜始まり)でグルーピングして表示するが、
// D{offset}の判定自体は各ユーザー本人の登録日(profiles.created_at, JST日付)を起点に行う。
//
// 【2026-07-14 修正】旧実装は cohort_week(コホートの月曜日)を起点に offset を足していたため、
// 週の途中(火〜日)に登録したユーザーは実際の経過日数とズレたラベルで判定されていた
// (例: 日曜登録のユーザーの「本当のD1」が、月曜起点では「D6」やそれ以前としてしか
// 現れず、D1/D3/D7のセルは登録前の日付を指してしまい常に0になっていた)。
// これは daily_stats の実活動と矛盾する結果を生んでいた既知の不具合で、今回
// 各ユーザーの実際の登録日を起点に判定するよう修正した。「未到達ユーザーは分母に
// 入れない」の原則も、コホート単位ではなくユーザー単位に厳密化した
// (同じ週内でも登録日が数日ずれれば「到達済みか」も数日ずれるため)。
// ─────────────────────────────────────────────────────────────

const RETENTION_OFFSETS = [1, 3, 7, 14, 30] as const;

/** 指定したJST日付文字列が属する週の月曜日(JST)を返す。既存のdate.jsユーティリティ
 * (jstWeekdayIndex/daysAgoJST)を組み合わせて求める(独自の日付計算は増やさない)。
 * 現在はcohort_weekの表示ラベル(グルーピング)としてのみ使う。D{offset}判定には使わない。 */
export function jstMondayOfWeek(dateStr: string): string {
  const weekdayIdx = jstWeekdayIndex(dateStr); // 0=日,1=月,...,6=土
  const daysSinceMonday = (weekdayIdx + 6) % 7; // 月=0, 火=1, ..., 日=6
  return daysAgoJST(daysSinceMonday, new Date(`${dateStr}T12:00:00+09:00`));
}

/** dateStr(JST日付文字列)からoffset日後のJST日付文字列。daysAgoJSTに負数を渡すことで
 * 「n日後」を表現する(daysAgoJST自体の定義は変えず、既存関数の合成のみで実現)。 */
export function jstDatePlusDays(dateStr: string, offset: number): string {
  return daysAgoJST(-offset, new Date(`${dateStr}T12:00:00+09:00`));
}

export async function computeRetentionCohorts(
  admin: Admin,
  testAccountIds: Set<string>,
): Promise<CategoryResult> {
  const { data: profilesRows, error: profErr } = await admin
    .from("profiles")
    .select("id, created_at, is_test_account")
    .limit(BULK_FETCH_LIMIT);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  const nonTestProfiles = (profilesRows ?? []).filter((p) => !p.is_test_account);

  // user_id -> { signupDate(JST), cohortWeek(表示用の登録週月曜ラベル) }
  const userSignup = new Map<string, { signupDate: string; cohortWeek: string }>();
  for (const p of nonTestProfiles) {
    const signupDate = toJstDateString(new Date(p.created_at as string));
    userSignup.set(p.id as string, { signupDate, cohortWeek: jstMondayOfWeek(signupDate) });
  }

  const { data: dsRows, error: dsErr } = await admin
    .from("daily_stats")
    .select("user_id, day, studied_count")
    .gt("studied_count", 0)
    .limit(BULK_FETCH_LIMIT);
  if (dsErr) throw new Error(`daily_stats取得失敗: ${dsErr.message}`);
  const activeUserDaySet = new Set<string>();
  for (const row of dsRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    activeUserDaySet.add(`${uid}|${row.day as string}`);
  }

  const today = todayJST();
  // (cohort_week, day_offset) -> { cohortSize(到達済みユーザー数), retainedCount }
  const agg = new Map<string, { cohortSize: number; retainedCount: number }>();
  let notYetReachedCount = 0;

  for (const [uid, { signupDate, cohortWeek }] of userSignup) {
    for (const offset of RETENTION_OFFSETS) {
      const targetDate = jstDatePlusDays(signupDate, offset);
      if (targetDate > today) {
        notYetReachedCount++;
        continue; // このユーザーはまだこのoffsetに到達していない → 分母に入れない
      }
      const key = `${cohortWeek}|${offset}`;
      const entry = agg.get(key) ?? { cohortSize: 0, retainedCount: 0 };
      entry.cohortSize += 1;
      if (activeUserDaySet.has(`${uid}|${targetDate}`)) entry.retainedCount += 1;
      agg.set(key, entry);
    }
  }

  const rows: { cohort_week: string; day_offset: number; cohort_size: number; retained_count: number }[] = [];
  for (const [key, { cohortSize, retainedCount }] of agg) {
    const [cohort_week, offsetStr] = key.split("|");
    rows.push({ cohort_week, day_offset: Number(offsetStr), cohort_size: cohortSize, retained_count: retainedCount });
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await admin
      .from("analytics_retention_cohorts")
      .upsert(rows, { onConflict: "cohort_week,day_offset" });
    if (upsertErr) throw new Error(`analytics_retention_cohorts upsert失敗: ${upsertErr.message}`);
  }

  return { ok: true, detail: { users: userSignup.size, rowsWritten: rows.length, notYetReachedCount } };
}

// ─────────────────────────────────────────────────────────────
// return_next_day / return_day_7: サーバー計算のリテンションイベント。
//
// 定義はcomputeRetentionCohorts(D1/D7)と完全に同じ: 非テストユーザーについて
// targetDate = signupDate(JST, profiles.created_at) + offset日 を求め、
// targetDate <= today(JST) かつ その日の daily_stats.studied_count > 0 の行があれば
// 「返ってきた」とみなす(jstDatePlusDays等の既存日付ヘルパーのみを使い、独自の日付計算は
// 増やさない)。
//
// このcronは直近7日を毎回再計算するcomputeDailyMetrics等と違い、日次ローリング窓ではなく
// 「一度でも条件を満たしたら生涯そのユーザーについて1回だけ」発火する必要がある。
//
// 【重複防止の方式】以前は「発火前にanalytics_eventsから既存のreturn_next_day/
// return_day_7 の user_id 集合を1回のBULK_FETCH_LIMITで取得し、メモリ上のSetで
// 判定する」方式だったが、これには2つの問題があった:
//   1. 既存イベントがBULK_FETCH_LIMIT(20,000件)を超えると、超過分が「未発火」と
//      誤判定され重複発火する。
//   2. insertOncePerUserMilestoneEvent()呼び出し(旧trackServerEvent())が実際に
//      失敗しても、呼び出し側はそれを検知せずalreadyFired/成功件数に加算していた
//      (DB挿入失敗を成功扱いする不具合)。
// 現在は、候補ユーザー全員に対して insertOncePerUserMilestoneEvent() を呼び、
// 実際に新規挿入できた場合("inserted")のみ成功件数に加算する。重複判定自体は
// DB側の部分ユニークインデックス(analytics_events_once_per_user_milestone_uniq)
// + Postgres関数内のON CONFLICT ... DO NOTHINGが原子的に行うため、既存イベント数に
// 依存せず正しく動作し、同時実行されたcron同士の競合も安全に処理される。
// ─────────────────────────────────────────────────────────────

const RETURN_EVENT_DEFS = [
  { offset: 1, eventName: "return_next_day" as const },
  { offset: 7, eventName: "return_day_7" as const },
];

export async function computeReturnEvents(
  admin: Admin,
  testAccountIds: Set<string>,
): Promise<CategoryResult> {
  const [{ data: profilesRows, error: profErr }, { data: dsRows, error: dsErr }] = await Promise.all([
    admin.from("profiles").select("id, created_at, is_test_account").limit(BULK_FETCH_LIMIT),
    admin.from("daily_stats").select("user_id, day, studied_count").gt("studied_count", 0).limit(BULK_FETCH_LIMIT),
  ]);
  if (profErr) throw new Error(`profiles取得失敗: ${profErr.message}`);
  if (dsErr) throw new Error(`daily_stats取得失敗: ${dsErr.message}`);

  const nonTestProfiles = (profilesRows ?? []).filter((p) => !p.is_test_account && !testAccountIds.has(p.id as string));
  const activeUserDaySet = new Set<string>();
  for (const row of dsRows ?? []) {
    const uid = row.user_id as string;
    if (testAccountIds.has(uid)) continue;
    activeUserDaySet.add(`${uid}|${row.day as string}`);
  }

  const today = todayJST();

  const firedCounts: Record<string, number> = { return_next_day: 0, return_day_7: 0 };
  const failedCounts: Record<string, number> = { return_next_day: 0, return_day_7: 0 };
  const failures: { eventName: string; userId: string; error: string }[] = [];

  for (const { offset, eventName } of RETURN_EVENT_DEFS) {
    for (const p of nonTestProfiles) {
      const uid = p.id as string;
      const signupDate = toJstDateString(new Date(p.created_at as string));
      const targetDate = jstDatePlusDays(signupDate, offset);
      if (targetDate > today) continue; // まだこのoffsetに到達していない
      if (!activeUserDaySet.has(`${uid}|${targetDate}`)) continue; // 未到達(条件を満たしていない)

      // nonTestProfilesは既に!p.is_test_account && !testAccountIds.has(uid)で
      // 絞り込み済みのため、insertOncePerUserMilestoneEvent()側でprofilesを
      // 再問い合わせしないよう判定済みの値を明示的に渡す(Codexレビュー指摘対応:
      // 候補ユーザー数分の冗長なDB往復を避ける)。
      const result = await insertOncePerUserMilestoneEvent(eventName, uid, {}, { isTestAccount: false });
      if (result.status === "inserted") {
        firedCounts[eventName] += 1;
      } else if (result.status === "failed") {
        // 挿入が実際に失敗した場合は成功扱いにしない。次回cron実行時に再試行される
        // (DB側の部分ユニークインデックスがある限り、再試行しても重複挿入にはならない)。
        failedCounts[eventName] += 1;
        failures.push({ eventName, userId: uid, error: result.error });
      }
      // status === "already_exists" は正常な冪等スキップであり、カウントしない
      // (前回のcron実行で既に発火済み、または本ラウンド内の後続イテレーションでの
      // 再訪問 — RETURN_EVENT_DEFSの各offsetは同一ユーザーを高々1回しか処理しないため
      // 後者は起こらないが、念のためDB側でも安全に無視される)。
    }
  }

  return {
    ok: failedCounts.return_next_day === 0 && failedCounts.return_day_7 === 0,
    detail: {
      return_next_day_fired: firedCounts.return_next_day,
      return_day_7_fired: firedCounts.return_day_7,
      return_next_day_failed: failedCounts.return_next_day,
      return_day_7_failed: failedCounts.return_day_7,
      // 失敗理由は先頭10件のみ記録(cron結果ログが肥大化しないよう)
      failures: failures.slice(0, 10),
    },
  };
}
