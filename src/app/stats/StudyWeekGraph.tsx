"use client";

type DayStat = { day: string; studied_count: number; correct_count: number; wrong_count: number };

export function StudyWeekGraph({ days }: { days: DayStat[] }) {
  const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];

  // 直近7日分を生成
  const today = new Date();
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    const stat = days.find(s => s.day === key);
    return {
      key,
      label: DAYS_JP[d.getDay()],
      isToday: i === 6,
      studied: stat?.studied_count ?? 0,
      correct: stat?.correct_count ?? 0,
      wrong: stat?.wrong_count ?? 0,
    };
  });

  const maxStudied = Math.max(...cells.map(c => c.studied), 1);

  return (
    <div>
      {/* 棒グラフ */}
      <div className="flex items-end gap-1.5 h-24">
        {cells.map((c) => {
          const pct = Math.round((c.studied / maxStudied) * 100);
          const acc = c.correct + c.wrong > 0
            ? Math.round((c.correct / (c.correct + c.wrong)) * 100)
            : null;
          return (
            <div key={c.key} className="flex-1 flex flex-col items-center gap-1">
              {c.studied > 0 && (
                <span className="text-[9px] text-navy-500 font-medium">{c.studied}</span>
              )}
              <div className="w-full flex flex-col justify-end" style={{ height: "60px" }}>
                <div
                  className={`w-full rounded-t-md transition-all ${
                    c.isToday ? "bg-sky-500" : "bg-navy-300"
                  }`}
                  style={{ height: c.studied > 0 ? `${Math.max(pct, 8)}%` : "2px" }}
                  title={`${c.key}: ${c.studied}語${acc !== null ? ` (正答率${acc}%)` : ""}`}
                />
              </div>
              <span className={`text-[10px] font-medium ${c.isToday ? "text-sky-600" : "text-navy-400"}`}>
                {c.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 正答率ライン（点グラフ） */}
      <div className="mt-3 pt-3 border-t border-navy-100">
        <p className="text-[10px] text-navy-400 mb-2">正答率 (7日間)</p>
        <div className="flex gap-1.5">
          {cells.map((c) => {
            const acc = c.correct + c.wrong > 0
              ? Math.round((c.correct / (c.correct + c.wrong)) * 100)
              : null;
            return (
              <div key={c.key} className="flex-1 text-center">
                {acc !== null ? (
                  <div className={`text-[10px] font-bold rounded-md py-0.5 ${
                    acc >= 80 ? "bg-emerald-100 text-emerald-700"
                    : acc >= 60 ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-600"
                  }`}>
                    {acc}%
                  </div>
                ) : (
                  <div className="text-[10px] text-navy-200">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
