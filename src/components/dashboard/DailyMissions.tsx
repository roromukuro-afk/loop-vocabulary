type Mission = {
  icon: string;
  label: string;
  done: boolean;
};

interface Props {
  studied: number;
  dailyGoal: number;
  streak: number;
  wordCount: number;
}

export function DailyMissions({ studied, dailyGoal, streak, wordCount }: Props) {
  const missions: Mission[] = [
    {
      icon: "📖",
      label: `今日5語以上学習する（${Math.min(studied, 5)}/5）`,
      done: studied >= 5,
    },
    {
      icon: "🎯",
      label: `1日の目標${dailyGoal}語を達成する`,
      done: studied >= dailyGoal,
    },
    {
      icon: "🔥",
      label: "連続学習を継続する",
      done: streak > 0,
    },
    {
      icon: "📚",
      label: `単語を100語以上登録する（${Math.min(wordCount, 100)}/100）`,
      done: wordCount >= 100,
    },
  ];

  const doneCount = missions.filter((m) => m.done).length;
  const allDone = doneCount === missions.length;

  return (
    <div className="mt-5 bg-white rounded-2xl border border-navy-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-navy-50">
        <div className="font-bold text-navy-800 text-sm">📋 デイリーミッション</div>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-600"}`}>
          {doneCount} / {missions.length}
        </div>
      </div>
      <ul className="divide-y divide-navy-50">
        {missions.map((m) => (
          <li key={m.label} className={`px-4 py-3 flex items-center gap-3 ${m.done ? "opacity-60" : ""}`}>
            <span className="text-base shrink-0">{m.done ? "✅" : "⬜"}</span>
            <span className={`text-xs ${m.done ? "line-through text-navy-400" : "text-navy-700"}`}>{m.icon} {m.label}</span>
          </li>
        ))}
      </ul>
      {allDone && (
        <div className="px-4 py-3 bg-emerald-50 text-center">
          <div className="text-sm font-black text-emerald-700">🎉 全ミッション達成！今日もすばらしい！</div>
        </div>
      )}
    </div>
  );
}
