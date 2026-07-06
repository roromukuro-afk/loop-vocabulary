import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayJST } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

// 無料5回/日・Premium300回/日は supabase/migrations/015_atomic_ai_quota.sql の
// try_consume_ai_quota() が唯一の判定基準（このページは表示のみ、判定ロジックは持たない）。
const FREE_DAILY_LIMIT = 5;
const PREMIUM_DAILY_LIMIT = 300;

// 「上限に近い」とみなす閾値。無料は残り1回、Premiumは残り50回を目安にした
// （Premiumはソフト上限が300と大きいため、1回単位ではなく余裕を持たせている）。
const FREE_NEAR_LIMIT_THRESHOLD = FREE_DAILY_LIMIT - 1; // 4以上
const PREMIUM_NEAR_LIMIT_THRESHOLD = PREMIUM_DAILY_LIMIT - 50; // 250以上

const FETCH_LIMIT = 20000;

function StatBox({
  label,
  value,
  sub,
  color = "navy",
  testId,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "navy" | "sky" | "emerald" | "amber" | "red";
  testId?: string;
}) {
  const textColor = {
    navy: "text-navy-900",
    sky: "text-sky-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4" data-testid={testId}>
      <div className="text-xs text-navy-500 font-medium">{label}</div>
      <div className={`text-2xl font-black mt-1 ${textColor}`} data-testid={testId ? `${testId}-value` : undefined}>
        {typeof value === "number" ? value.toLocaleString("ja-JP") : value}
      </div>
      {sub && <div className="text-[10px] text-navy-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AnomalyRow({
  label,
  count,
  detail,
  isAnomaly,
}: {
  label: string;
  count: number;
  detail: string;
  isAnomaly: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-0.5 shrink-0 font-black text-base ${isAnomaly ? "text-red-500" : "text-emerald-500"}`}>
        {isAnomaly ? "⚠" : "✓"}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-semibold ${isAnomaly ? "text-red-700" : "text-navy-800"}`}>{label}</span>
          <span className={`font-black ${isAnomaly ? "text-red-600" : "text-navy-500"}`}>
            {count.toLocaleString("ja-JP")}
          </span>
        </div>
        <div className="text-[10px] text-navy-400">{detail}</div>
      </div>
    </li>
  );
}

type ProfileRow = {
  id: string;
  daily_ai_used: number | null;
  daily_ai_reset_at: string | null;
  is_premium: boolean | null;
  is_test_account: boolean | null;
};

type TicketRow = {
  user_id: string;
  amount: number;
  used_amount: number;
};

export default async function AdminAiUsagePage() {
  await requireAdmin();
  const admin = createAdminClient();

  // profiles: 集計に必要な列だけ取得（メールアドレス・display_name・単語データ等は一切含めない）。
  // reward_tickets: ai_generation チケットの残高判定に必要な列のみ（他kindは対象外）。
  const [{ data: profileRows }, { data: ticketRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, daily_ai_used, daily_ai_reset_at, is_premium, is_test_account")
      .limit(FETCH_LIMIT),
    admin
      .from("reward_tickets")
      .select("user_id, amount, used_amount")
      .eq("kind", "ai_generation")
      .limit(FETCH_LIMIT),
  ]);

  const profiles = (profileRows ?? []) as ProfileRow[];
  const tickets = (ticketRows ?? []) as TicketRow[];
  const today = todayJST();

  const testAccountCount = profiles.filter((p) => p.is_test_account).length;
  // 以降の集計はE2E/検証で使うテストアカウント（is_test_account=true）を除外し、
  // 実ユーザーの利用実態のみを反映する（テスト実行のたびに数値がぶれるのを防ぐ）。
  const realProfiles = profiles.filter((p) => !p.is_test_account);

  // daily_ai_reset_at が「今日(JST)」のユーザーのみが本日の利用実績を持つ
  // （リセットされていない = 今日はまだAIを使っていない、を意味する）。
  const activeToday = realProfiles.filter(
    (p) => p.daily_ai_reset_at === today && (p.daily_ai_used ?? 0) > 0
  );

  const usersActiveToday = activeToday.length;
  const totalUsesToday = activeToday.reduce((s, p) => s + (p.daily_ai_used ?? 0), 0);
  const freeActiveToday = activeToday.filter((p) => !p.is_premium);
  const premiumActiveToday = activeToday.filter((p) => p.is_premium);
  const freeUsesToday = freeActiveToday.reduce((s, p) => s + (p.daily_ai_used ?? 0), 0);
  const premiumUsesToday = premiumActiveToday.reduce((s, p) => s + (p.daily_ai_used ?? 0), 0);

  // daily_ai_used 上位5件（個人情報保護のため、個々のユーザーを特定できる情報は一切出さず、
  // 「何位が何回か」という分布のみを表示する）。
  const topUsage = [...activeToday]
    .sort((a, b) => (b.daily_ai_used ?? 0) - (a.daily_ai_used ?? 0))
    .slice(0, 5)
    .map((p, i) => ({ rank: i + 1, count: p.daily_ai_used ?? 0, isPremium: !!p.is_premium }));

  const freeNearLimitCount = freeActiveToday.filter(
    (p) => (p.daily_ai_used ?? 0) >= FREE_NEAR_LIMIT_THRESHOLD
  ).length;
  const premiumNearLimitCount = premiumActiveToday.filter(
    (p) => (p.daily_ai_used ?? 0) >= PREMIUM_NEAR_LIMIT_THRESHOLD
  ).length;

  // ai_generationチケットの残高（amount > used_amount）があるユーザー数。
  // reward_ticketsにis_test_account列は無いため、profiles.idとuser_idを突合して
  // テストアカウントのチケットを除外する。
  const testAccountIds = new Set(profiles.filter((p) => p.is_test_account).map((p) => p.id));
  const nonTestTickets = tickets.filter((t) => !testAccountIds.has(t.user_id));
  const ticketBalanceUserCount = new Set(
    nonTestTickets.filter((t) => t.amount > t.used_amount).map((t) => t.user_id)
  ).size;

  // 構造的な異常（atomic RPC上は本来発生し得ない状態）のみを検知する。
  // 統計的な閾値ではなく、仕様上の理論値との矛盾を検知することで、
  // RPCの不具合やDBへの直接操作を早期に発見する。
  const freeOverLimitCount = activeToday.filter(
    (p) => !p.is_premium && (p.daily_ai_used ?? 0) > FREE_DAILY_LIMIT
  ).length;
  const premiumOverLimitCount = activeToday.filter(
    (p) => p.is_premium && (p.daily_ai_used ?? 0) > PREMIUM_DAILY_LIMIT
  ).length;
  const ticketOverconsumedCount = tickets.filter((t) => t.used_amount > t.amount).length;

  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">
        ← 管理画面
      </Link>
      <div className="flex items-center justify-between mt-2 mb-1" data-testid="admin-ai-page">
        <h1 className="text-xl font-bold text-navy-800">AI利用状況モニタリング</h1>
        <span className="text-[10px] text-navy-400">JST基準日: {today}</span>
      </div>
      <p className="text-xs text-navy-500">
        読み取り専用（このページからPremium状態・daily_ai_used・チケットは一切変更されません）。
        単語・英文・AIへの入力内容やメールアドレス等の個人情報は表示しません。
      </p>
      <p className="text-[10px] text-navy-400 mt-1">
        テストアカウント（is_test_account=true、{testAccountCount.toLocaleString("ja-JP")}件）は
        以下の集計からすべて除外しています。
      </p>

      {/* ── 本日の利用状況 ── */}
      <section data-testid="admin-ai-metrics-section">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">
          本日(JST)のAI利用状況
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBox label="今日AIを使ったユーザー数" value={usersActiveToday} sub="daily_ai_reset_at=今日 かつ daily_ai_used>0" color="sky" />
          <StatBox label="今日の利用回数合計" value={totalUsesToday} sub="全ユーザー合計" color="sky" />
          <StatBox label="無料ユーザーの利用回数合計" value={freeUsesToday} sub={`${freeActiveToday.length}人`} />
          <StatBox label="Premiumユーザーの利用回数合計" value={premiumUsesToday} sub={`${premiumActiveToday.length}人`} color="emerald" />
          <StatBox
            label="無料上限に近いユーザー"
            value={freeNearLimitCount}
            sub={`本日${FREE_NEAR_LIMIT_THRESHOLD}回以上（上限${FREE_DAILY_LIMIT}回）`}
            color={freeNearLimitCount > 0 ? "amber" : "navy"}
            testId="admin-ai-free-near-limit"
          />
          <StatBox
            label="Premiumソフト上限に近いユーザー"
            value={premiumNearLimitCount}
            sub={`本日${PREMIUM_NEAR_LIMIT_THRESHOLD}回以上（上限${PREMIUM_DAILY_LIMIT}回）`}
            color={premiumNearLimitCount > 0 ? "amber" : "navy"}
            testId="admin-ai-premium-near-limit"
          />
          <StatBox
            label="ai_generationチケット残高があるユーザー数"
            value={ticketBalanceUserCount}
            sub="amount > used_amount（無料上限超過時の救済に使える枚数を保有）"
            testId="admin-ai-ticket-balance"
          />
        </div>
      </section>

      {/* ── 分布（個人を特定できる情報は表示しない） ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">
          本日のdaily_ai_used 上位5件（順位と回数のみ、個人は特定できません）
        </h2>
        <Card>
          {topUsage.length === 0 ? (
            <p className="text-sm text-navy-500">本日はまだAIを利用したユーザーがいません。</p>
          ) : (
            <ol className="space-y-2">
              {topUsage.map((row) => (
                <li key={row.rank} className="flex items-center justify-between text-sm">
                  <span className="text-navy-500">{row.rank}位</span>
                  <span className={`font-bold ${row.isPremium ? "text-emerald-600" : "text-navy-700"}`}>
                    {row.isPremium ? "Premium" : "無料"}
                  </span>
                  <span className="font-black text-navy-800">{row.count.toLocaleString("ja-JP")}回</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      {/* ── 異常利用の簡易警告 ── */}
      <section data-testid="admin-ai-anomalies-section">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">異常利用の簡易警告</h2>
        <Card>
          <ul className="space-y-3">
            <AnomalyRow
              label="無料ユーザーで日次上限(5回)を超えて記録されている"
              count={freeOverLimitCount}
              detail="atomic RPC(try_consume_ai_quota)が正しく機能していれば発生しないはずの状態。DB直接操作やRPCの不具合を疑う"
              isAnomaly={freeOverLimitCount > 0}
            />
            <AnomalyRow
              label="Premiumユーザーでソフト上限(300回)を超えて記録されている"
              count={premiumOverLimitCount}
              detail="同上。到達直後は429で拒否されるため、記録上は300で頭打ちになるはず"
              isAnomaly={premiumOverLimitCount > 0}
            />
            <AnomalyRow
              label="ai_generationチケットの消費量が付与量を超えている"
              count={ticketOverconsumedCount}
              detail="reward_tickets.used_amount > amount のチケット行数。本来あり得ない不整合"
              isAnomaly={ticketOverconsumedCount > 0}
            />
          </ul>
        </Card>
        <p className="text-[10px] text-navy-400 mt-2">
          コスト急増時の追加調査・緊急停止手順は{" "}
          <a
            href="https://github.com/roromukuro-afk/loop-vocabulary/blob/main/PRODUCTION_MONITORING.md"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            PRODUCTION_MONITORING.md §13
          </a>{" "}
          を参照してください（このページでは個別ユーザーの特定・単語やAI入力内容の表示は行いません）。
        </p>
      </section>
    </AppShell>
  );
}
