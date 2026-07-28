import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayStartJstISO } from "@/lib/utils/date";
import { SRS_V2, isSrsV2Enabled } from "@/lib/srs";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

// 一度に取得する上限行数。現状(2026-07時点)の総単語数は1,000件台のため
// JS側での集計で十分だが、将来この上限に達するほど増えた場合は
// SQL側の集計RPCへの切り替えを検討する（NEXT_IMPROVEMENTS.md参照）。
const FETCH_LIMIT = 50000;

// next_review_at が「異常に未来」とみなす閾値。
// SRS V2の設計上の最大間隔(SRS_V2.INTERVAL_MAX=180日)より十分大きい
// マージンを取り、正常な計算結果では絶対に到達しない範囲のみを異常として拾う。
const FUTURE_ANOMALY_DAYS = SRS_V2.INTERVAL_MAX + 30;

// is_weak の比率がこの割合を超えたら「多すぎる」として警告表示する。
const WEAK_RATIO_WARN = 0.5;

function StatBox({
  label,
  value,
  sub,
  color = "navy",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "navy" | "sky" | "emerald" | "amber" | "red";
}) {
  const textColor = {
    navy: "text-navy-900",
    sky: "text-sky-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4">
      <div className="text-xs text-navy-500 font-medium">{label}</div>
      <div className={`text-2xl font-black mt-1 ${textColor}`}>
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

export default async function AdminSrsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // words の集計に必要な列だけを取得する（本文・語義・ユーザーIDは含めない = 個別ユーザーの学習内容は見えない）。
  const [{ count: totalWordsCount }, { data: rows }] = await Promise.all([
    admin.from("words").select("*", { count: "exact", head: true }),
    admin
      .from("words")
      .select("ease_factor, interval_days, correct_count, wrong_count, is_weak, next_review_at, last_studied_at")
      .limit(FETCH_LIMIT),
  ]);

  const words = rows ?? [];
  const totalWords = totalWordsCount ?? words.length;
  const truncated = words.length < totalWords;

  const now = new Date();
  const todayStart = new Date(todayStartJstISO());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrowStart = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const futureAnomalyCutoff = new Date(now.getTime() + FUTURE_ANOMALY_DAYS * 24 * 60 * 60 * 1000);

  let easeSum = 0;
  let easeMin = Infinity;
  let easeMax = -Infinity;
  let easeCount = 0;
  let intervalSum = 0;
  let intervalMax = -Infinity;
  let intervalCount = 0;
  let correctSum = 0;
  let wrongSum = 0;
  let weakCount = 0;

  let reviewDueNow = 0; // next_review_at <= 現在（滞留分も含む復習キュー全体）
  let dueToday = 0; // 今日中(JST)に予定
  let dueTomorrow = 0; // 明日(JST)に予定
  let dueWithin7Days = 0; // 現在時刻から7日以内に予定（滞留分含む累積）
  let staleOver7Days = 0; // 7日以上前から復習待ちのまま滞留

  let easeAnomalyCount = 0; // ease_factor が設計上の範囲外
  let intervalAnomalyCount = 0; // interval_days が上限を超過
  let futureAnomalyCount = 0; // next_review_at が異常に未来
  let missingScheduleCount = 0; // 学習済みなのに next_review_at が null

  for (const w of words) {
    const ease = w.ease_factor as number | null;
    const interval = w.interval_days as number | null;
    const correct = (w.correct_count as number | null) ?? 0;
    const wrong = (w.wrong_count as number | null) ?? 0;
    const isWeak = w.is_weak as boolean | null;
    const nextReviewAtStr = w.next_review_at as string | null;
    const lastStudiedAtStr = w.last_studied_at as string | null;

    if (typeof ease === "number") {
      easeSum += ease;
      easeMin = Math.min(easeMin, ease);
      easeMax = Math.max(easeMax, ease);
      easeCount++;
      if (ease < SRS_V2.EASE_MIN || ease > SRS_V2.EASE_MAX) easeAnomalyCount++;
    }
    if (typeof interval === "number") {
      intervalSum += interval;
      intervalMax = Math.max(intervalMax, interval);
      intervalCount++;
      if (interval > SRS_V2.INTERVAL_MAX) intervalAnomalyCount++;
    }
    correctSum += correct;
    wrongSum += wrong;
    if (isWeak) weakCount++;

    if (nextReviewAtStr) {
      const d = new Date(nextReviewAtStr);
      if (d <= now) reviewDueNow++;
      if (d >= todayStart && d < tomorrowStart) dueToday++;
      if (d >= tomorrowStart && d < dayAfterTomorrowStart) dueTomorrow++;
      if (d <= sevenDaysFromNow) dueWithin7Days++;
      if (d < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) staleOver7Days++;
      if (d > futureAnomalyCutoff) futureAnomalyCount++;
    } else if (lastStudiedAtStr) {
      // 一度でも学習した単語は next_review_at が設定されているはず。null は異常。
      missingScheduleCount++;
    }
  }

  const easeAvg = easeCount ? easeSum / easeCount : null;
  const intervalAvg = intervalCount ? intervalSum / intervalCount : null;
  const weakRatio = totalWords ? weakCount / totalWords : 0;
  const correctWrongTotal = correctSum + wrongSum;
  const correctRatio = correctWrongTotal ? correctSum / correctWrongTotal : null;
  const isWeakAnomaly = weakRatio > WEAK_RATIO_WARN;

  return (
    <AppShell>
      <Link href="/admin" className="text-xs text-navy-500">
        ← 管理画面
      </Link>
      <div className="flex items-center justify-between mt-2 mb-1" data-testid="admin-srs-page">
        <h1 className="text-xl font-bold text-navy-800">SRS V2 モニタリング</h1>
        <span className="text-[10px] text-navy-400">更新: {new Date().toLocaleString("ja-JP")}</span>
      </div>
      <p className="text-xs text-navy-500">
        グローバルフラグ:{" "}
        <span className={`font-bold ${isSrsV2Enabled() ? "text-emerald-600" : "text-navy-400"}`}>
          {isSrsV2Enabled() ? "ON（全ユーザー適用中）" : "OFF"}
        </span>
        {" ／ "}読み取り専用（このページからデータは変更されません）
      </p>
      {truncated && (
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          総単語数（{totalWords.toLocaleString("ja-JP")}件）が取得上限（{FETCH_LIMIT.toLocaleString("ja-JP")}件）を超えたため、
          以下の集計は先頭 {words.length.toLocaleString("ja-JP")} 件のサンプルに基づく概算です。
        </p>
      )}

      {/* ── 単語数・復習予定 ── */}
      <section data-testid="admin-srs-metrics-section">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">単語数・復習予定</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBox label="総単語数" value={totalWords} sub="語" />
          <StatBox label="復習対象単語数" value={reviewDueNow} sub="現在復習待ち（滞留含む）" color="sky" />
          <StatBox label="今日復習予定" value={dueToday} sub="語（JST基準）" color="sky" />
          <StatBox label="明日復習予定" value={dueTomorrow} sub="語（JST基準）" color="sky" />
          <StatBox label="7日以内に予定" value={dueWithin7Days} sub="語（現在時刻起点・累積）" color="sky" />
          <StatBox
            label="苦手単語（is_weak）"
            value={weakCount}
            sub={`全体の ${(weakRatio * 100).toFixed(1)}%`}
            color={isWeakAnomaly ? "red" : "amber"}
          />
        </div>
      </section>

      {/* ── SRS V2 パラメータ ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">
          SRS V2 パラメータ（ease_factor / interval_days）
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="ease_factor 平均" value={easeAvg !== null ? easeAvg.toFixed(3) : "—"} sub={`正常範囲 ${SRS_V2.EASE_MIN}〜${SRS_V2.EASE_MAX}`} />
          <StatBox label="ease_factor 最小" value={easeCount ? easeMin.toFixed(2) : "—"} />
          <StatBox label="ease_factor 最大" value={easeCount ? easeMax.toFixed(2) : "—"} />
          <StatBox label="interval_days 平均" value={intervalAvg !== null ? intervalAvg.toFixed(1) : "—"} sub="日" />
          <StatBox label="interval_days 最大" value={intervalCount ? intervalMax : "—"} sub={`上限 ${SRS_V2.INTERVAL_MAX}日`} />
        </div>
      </section>

      {/* ── 正誤集計 ── */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">正誤集計（全ユーザー合計）</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="正解数合計" value={correctSum} sub="correct_count" color="emerald" />
          <StatBox label="不正解数合計" value={wrongSum} sub="wrong_count" color="red" />
          <StatBox label="正答率" value={correctRatio !== null ? `${(correctRatio * 100).toFixed(1)}%` : "—"} />
        </div>
      </section>

      {/* ── 異常値検知 ── */}
      <section data-testid="admin-srs-anomalies-section">
        <h2 className="text-xs font-black uppercase tracking-widest text-navy-400 mt-5 mb-2">異常値検知</h2>
        <Card>
          <ul className="space-y-3">
            <AnomalyRow
              label="ease_factor が範囲外"
              count={easeAnomalyCount}
              detail={`正常範囲 ${SRS_V2.EASE_MIN}〜${SRS_V2.EASE_MAX} の外側にある単語数（クランプ処理の不具合を疑う）`}
              isAnomaly={easeAnomalyCount > 0}
            />
            <AnomalyRow
              label="interval_days が上限超過"
              count={intervalAnomalyCount}
              detail={`設計上の上限 ${SRS_V2.INTERVAL_MAX}日を超えている単語数`}
              isAnomaly={intervalAnomalyCount > 0}
            />
            <AnomalyRow
              label="next_review_at が異常に未来"
              count={futureAnomalyCount}
              detail={`現在時刻から${FUTURE_ANOMALY_DAYS}日以上先に設定されている単語数（想定される最大間隔を大きく超える）`}
              isAnomaly={futureAnomalyCount > 0}
            />
            <AnomalyRow
              label="next_review_at が未設定の既学習単語"
              count={missingScheduleCount}
              detail="last_studied_at はあるのに next_review_at が null（保存処理の不具合を疑う）"
              isAnomaly={missingScheduleCount > 0}
            />
            <AnomalyRow
              label="7日以上滞留した復習待ち"
              count={staleOver7Days}
              detail="next_review_at が7日以上前のまま復習が実行されていない単語数"
              isAnomaly={staleOver7Days > 0}
            />
            <AnomalyRow
              label="is_weak 比率が高すぎる"
              count={weakCount}
              detail={`全単語に占める is_weak=true の割合が ${(WEAK_RATIO_WARN * 100).toFixed(0)}% を超えている場合に警告（現在 ${(weakRatio * 100).toFixed(1)}%）`}
              isAnomaly={isWeakAnomaly}
            />
          </ul>
        </Card>
        <p className="text-[10px] text-navy-400 mt-2">
          異常が続く場合は{" "}
          <a
            href="https://github.com/roromukuro-afk/loop-vocabulary/blob/main/PRODUCTION_MONITORING.md"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            PRODUCTION_MONITORING.md §3
          </a>{" "}
          のSQLで詳細を確認してください（このページでは個別の単語・ユーザーは表示しません）。
        </p>
      </section>
    </AppShell>
  );
}
