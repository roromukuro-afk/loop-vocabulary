"use client";
// ============================================================
// リワード視聴 → Supabase reward_tickets へのチケット付与
// ------------------------------------------------------------
// 重要:
//   - 「広告を最後まで見たとき」だけチケット付与 (rewarded=true)
//   - 広告読み込み失敗時は付与しない
//   - 連打防止: モジュールスコープの実行中フラグ
//   - Android / iOS どちらでも DB スキーマは共通
// ============================================================

import { createClient } from "@/lib/supabase/client";
import { isNative } from "./platform";
import { showRewardedAd } from "./admob";

export type RewardKind =
  // ── 実働中のkind ──
  | "ai_generation" // AI例文・解説の利用上限バイパス。reward_tickets永続化・api/ai/*が消費
  | "extra_review"  // 復習/テストの即時再挑戦。2026-07-05以降reward_ticketsへ永続化しない
  // ── 予約済み・未実装 (reserved / not active) ──
  // 型定義のみで、付与コード・消費コードとも一切実装しておらず、
  // AppRewardedAdButton/useTicketBalanceの呼び出し箇所も存在しない
  // （2026-07-06「reward_tickets未実装kind整理」で確認、WORK_HISTORY.md参照）。
  // 実装するまでUI・Premium訴求のいずれにも出してはならない。
  | "pdf_export"
  | "weak_word_test"
  | "analysis_ticket";

/**
 * その場で消費し切られ、後から「貯めて使う」ことがない報酬kind。
 * `extra_review`(FlipCardRunner「もう一周チャレンジ」/ChoiceTestRunner
 * 「もう10問チャレンジ」)は、広告視聴の直後に呼び出し側のコールバック
 * (restart()/onRewardedExtra())がその場で復習・テストを再開するだけの設計で、
 * 消費のタイミング・消費先が最初から存在しない。そのため reward_tickets に
 * INSERTしても`used_amount`が永久に0のまま溜まり続けるだけになっていた
 * （2026-07-05調査で本番に9件蓄積を確認、削除はしていない）。
 * この一覧に含まれるkindは reward_tickets へ永続化せず、広告視聴の成否だけを
 * 返す（UI体験は変わらない）。`ai_generation`等、実際に残高を消費する仕組みが
 * ある既存kindはこれまで通りDBへ記録する。詳細はWORK_HISTORY.md参照。
 */
const INSTANT_USE_REWARD_KINDS: ReadonlySet<RewardKind> = new Set(["extra_review"]);

let busy = false;

export type GrantResult =
  | { ok: true; reason: "rewarded" }
  | { ok: false; reason: "busy" | "no_user" | "ad_failed" | "db_error" };

/**
 * リワード広告を再生 (Native) または再生をスキップ (Web/dev) し、
 * 成功時に reward_tickets にチケットを 1 枚付与する。
 * Web では本番でも「広告再生扱い」にせず、UI で 1 枚もらえる体験のみ提供。
 * ただし INSTANT_USE_REWARD_KINDS に該当するkindは、広告視聴の成否のみを返し
 * reward_tickets への書き込みは行わない（呼び出し側が結果を即座に使い切るため）。
 */
export async function watchRewardedAndGrant(kind: RewardKind): Promise<GrantResult> {
  if (busy) return { ok: false, reason: "busy" };
  busy = true;
  try {
    if (isNative()) {
      const r = await showRewardedAd();
      if (!r.rewarded) return { ok: false, reason: "ad_failed" };
    } else {
      // Web/PWA では擬似遅延 (実広告は流さない)
      await new Promise((res) => setTimeout(res, 600));
    }

    if (INSTANT_USE_REWARD_KINDS.has(kind)) {
      return { ok: true, reason: "rewarded" };
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "no_user" };

    const { error } = await supabase
      .from("reward_tickets")
      .insert({ user_id: user.id, kind, amount: 1 });
    if (error) {
      console.warn("[rewards] db insert failed", error);
      return { ok: false, reason: "db_error" };
    }
    return { ok: true, reason: "rewarded" };
  } finally {
    busy = false;
  }
}

/** 残りチケット数を取得 (amount - used_amount の合計、kind 単位) */
export async function ticketBalance(kind: RewardKind): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase
    .from("reward_tickets")
    .select("amount, used_amount")
    .eq("user_id", user.id)
    .eq("kind", kind);
  if (!data) return 0;
  return data.reduce((acc, r) => acc + Math.max(0, r.amount - r.used_amount), 0);
}
