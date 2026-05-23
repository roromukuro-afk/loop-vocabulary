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
  | "ai_generation"
  | "pdf_export"
  | "extra_review"
  | "weak_word_test"
  | "analysis_ticket";

let busy = false;

export type GrantResult =
  | { ok: true; reason: "rewarded" }
  | { ok: false; reason: "busy" | "no_user" | "ad_failed" | "db_error" };

/**
 * リワード広告を再生 (Native) または再生をスキップ (Web/dev) し、
 * 成功時に reward_tickets にチケットを 1 枚付与する。
 * Web では本番でも「広告再生扱い」にせず、UI で 1 枚もらえる体験のみ提供。
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
