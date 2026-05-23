"use client";
import { cn } from "@/lib/utils/cn";

export function StudyCalendar({ days }: { days: { day: string; count: number }[] }) {
  const map = new Map(days.map((d) => [d.day, d.count]));
  const today = new Date();
  const cells: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    cells.push({ day: d, count: map.get(d) ?? 0 });
  }
  return (
    <div className="grid grid-cols-10 gap-1">
      {cells.map(({ day, count }) => {
        const lvl =
          count === 0 ? 0
          : count < 5 ? 1
          : count < 15 ? 2
          : count < 30 ? 3 : 4;
        return (
          <div
            key={day}
            title={`${day} : ${count} 単語`}
            className={cn(
              "aspect-square rounded-md",
              lvl === 0 && "bg-navy-50 border border-navy-100",
              lvl === 1 && "bg-sky-100",
              lvl === 2 && "bg-sky-300",
              lvl === 3 && "bg-navy-500",
              lvl === 4 && "bg-navy-800",
            )}
          />
        );
      })}
    </div>
  );
}
