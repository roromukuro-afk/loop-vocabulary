"use client";

type DayData = { day: string; studied_count: number };

interface Props {
  stats: DayData[];
}

const WEEKS = 13;
const DAYS_TOTAL = WEEKS * 7;

function getColor(count: number): string {
  if (count === 0) return "bg-navy-100";
  if (count < 6) return "bg-emerald-200";
  if (count < 16) return "bg-emerald-400";
  return "bg-emerald-600";
}

export function StudyCalendar({ stats }: Props) {
  const statsMap = new Map(stats.map((s) => [s.day, s.studied_count]));

  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = DAYS_TOTAL - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, count: statsMap.get(dateStr) ?? 0 });
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < DAYS_TOTAL; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const activeDays = stats.filter((s) => s.studied_count > 0).length;
  const totalStudied = stats.reduce((sum, s) => sum + s.studied_count, 0);

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count}語`}
                className={`w-3.5 h-3.5 rounded-[3px] flex-shrink-0 ${getColor(day.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-navy-400">
        <span>{activeDays}日 稼働 / 13週間</span>
        <span>累計 {totalStudied.toLocaleString()} 語</span>
        <div className="flex items-center gap-1">
          <span>少</span>
          {["bg-navy-100", "bg-emerald-200", "bg-emerald-400", "bg-emerald-600"].map((c) => (
            <div key={c} className={`w-3.5 h-3.5 rounded-[3px] ${c}`} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  );
}
