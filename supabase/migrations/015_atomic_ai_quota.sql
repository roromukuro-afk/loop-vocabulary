-- ============================================================
-- 015_atomic_ai_quota.sql
-- AI日次利用カウンターのatomic化（2026-07-06、AI利用コスト・濫用対策の残課題対応）
-- ------------------------------------------------------------
-- 背景: 前ラウンドまでのAI日次上限判定はAPI側でのcheck-then-update方式
--   （select → JS側で判定 → update）だったため、同一ユーザーからの同時リクエスト
--   ではわずかな競合ウィンドウで上限を超えて通過する可能性があった。
--   AI APIは実コスト（Anthropic課金）に直結するため、DB側で単一トランザクション・
--   行ロックにより判定と更新をatomicに行うRPC関数を新設する。
--
-- 新しい列・テーブルは一切追加しない（既存の profiles.daily_ai_used /
-- profiles.daily_ai_reset_at / reward_tickets をそのまま使う、追加専用の変更）。
-- 既存RLS（profiles/reward_ticketsとも「本人のみ」）は変更しない。
-- 本関数は SECURITY DEFINER のため RLS を経由しないが、必ず auth.uid() を用いて
-- 「呼び出したログインユーザー自身の行」のみを対象にする（クライアントから
-- user_idやis_premiumを受け取らない・信用しない設計）。
--
-- 上限値は既存実装と完全に一致させる（本ラウンドでは変更しない）:
--   - 無料ユーザー: 5回/日   （src/app/api/ai/route.ts の DAILY_LIMIT と同じ値）
--   - Premiumユーザー: 300回/日（src/lib/ai/premiumDailyCap.ts の
--     PREMIUM_DAILY_AI_LIMIT と同じ値。過度な自動化利用のみを止める安全網）
-- この関数がAPIルート側の唯一の判定ロジックになるため、以後この2値を変更する
-- 場合は本関数の定数を書き換えるマイグレーションを追加すること
-- （TypeScript側の定数は表示・ドキュメント用途のみに縮退する）。
--
-- JST日付判定: (now() at time zone interval '9:00:00')::date
--   固定オフセット(+9時間、DSTなし)での変換。src/lib/utils/date.ts の
--   todayJST()（UTCエポック+9時間からUTC日付部分を取り出す）と同じ基準であり、
--   migration 014 で採用したインデックス式と同じ考え方（IMMUTABLE性はここでは
--   関数本体内なので制約対象外だが、計算基準は既存実装と揃えている）。
--
-- 同時実行耐性:
--   - `select ... for update` で対象ユーザーの profiles 行をロックしてから
--     判定・更新するため、同一ユーザーからの並行リクエストはこの関数呼び出し
--     単位で直列化される（PostgRESTの1 RPC呼び出し=1トランザクションのため、
--     ロックは関数の実行完了(コミット)まで保持される）。
--   - ai_generationチケットの消費も同じトランザクション内で対象チケット行を
--     `for update` ロックしてから消費するため、二重消費も同時に防止される
--     （調査の結果、旧JS実装ではチケット消費にも同時実行での二重消費の余地が
--     あったが、本関数で同時に解消した）。
--   - 他ユーザーの行には一切ロックが及ばないため、あるユーザーの連続リクエスト
--     が別ユーザーの応答を待たせることはない。
--
-- 既存仕様との整合・軽微な正しさの改善:
--   - 無料5回/日・Premium300回/日の値、ai_generationチケットのkind値・消費方法
--     (used_amountを+1)は完全に維持。
--   - 旧JS実装は `reward_tickets` を `.gt("amount", 0)` のみで絞り込み、
--     「amount > used_amount（未消費分が残っているか）」はJS側の後判定だった。
--     複数チケットが存在し先頭(granted_at昇順)のチケットが使い切られている場合、
--     後続の未消費チケットがあっても救済されない潜在バグが有り得た。
--     本関数では `where amount > used_amount` をSQLの絞り込み自体に含めており、
--     この潜在バグも合わせて解消している（通常運用はチケット1枚ずつの発行・
--     即時消費のため、現行の観測可能な挙動への影響はない）。
-- ============================================================

create or replace function public.try_consume_ai_quota()
returns table (
  allowed boolean,
  reason text,          -- 'ok' | 'ticket_consumed' | 'limit_reached' | 'premium_daily_limit_reached'
  is_premium boolean,
  remaining integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone interval '9:00:00')::date;
  v_free_limit constant integer := 5;
  v_premium_limit constant integer := 300;
  v_daily_ai_used integer;
  v_daily_ai_reset_at date;
  v_is_premium boolean;
  v_used integer;
  v_ticket_id uuid;
  v_ticket_amount integer;
  v_ticket_used integer;
begin
  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  -- 対象ユーザーのprofiles行をロックしてから読む（同時リクエストをここで直列化）。
  -- 列名を p. で修飾しているのは、RETURNS TABLE の出力列 is_premium と
  -- profiles.is_premium 列が同名でplpgsql変数として曖昧になる(42702)のを防ぐため。
  select p.daily_ai_used, p.daily_ai_reset_at, p.is_premium
    into v_daily_ai_used, v_daily_ai_reset_at, v_is_premium
    from public.profiles p
    where p.id = v_user_id
    for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if v_daily_ai_reset_at is distinct from v_today then
    v_used := 0;
  else
    v_used := v_daily_ai_used;
  end if;

  -- Premiumユーザー: 300回/日のソフト上限（過度な自動化利用の安全網のみ）
  if v_is_premium then
    if v_used >= v_premium_limit then
      return query select false, 'premium_daily_limit_reached'::text, true, 0;
      return;
    end if;

    update public.profiles
      set daily_ai_used = v_used + 1, daily_ai_reset_at = v_today
      where id = v_user_id;

    return query select true, 'ok'::text, true, (v_premium_limit - v_used - 1);
    return;
  end if;

  -- 無料ユーザー: 5回/日まで通常消費
  if v_used < v_free_limit then
    update public.profiles
      set daily_ai_used = v_used + 1, daily_ai_reset_at = v_today
      where id = v_user_id;

    return query select true, 'ok'::text, false, (v_free_limit - v_used - 1);
    return;
  end if;

  -- 上限到達 → ai_generationチケットで救済（同一トランザクションでチケット行もロック）
  select id, amount, used_amount
    into v_ticket_id, v_ticket_amount, v_ticket_used
    from public.reward_tickets
    where user_id = v_user_id
      and kind = 'ai_generation'
      and amount > used_amount
    order by granted_at asc
    limit 1
    for update;

  if v_ticket_id is null then
    return query select false, 'limit_reached'::text, false, 0;
    return;
  end if;

  update public.reward_tickets
    set used_amount = v_ticket_used + 1
    where id = v_ticket_id;

  return query select true, 'ticket_consumed'::text, false, 0;
end;
$$;

revoke all on function public.try_consume_ai_quota() from public, anon;
grant execute on function public.try_consume_ai_quota() to authenticated;
