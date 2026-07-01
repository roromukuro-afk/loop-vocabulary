import Link from "next/link";

type Cta = { href: string; label: string; primary?: boolean };
type Step = { done: boolean; title: string; desc: string; ctas: Cta[] };

/**
 * 初回/未学習ユーザー向けの「はじめの3ステップ」ガイド。
 * ダッシュボード上部に表示し、単語追加→学習→復習まで迷わず進めるよう誘導する。
 * 一度でも学習すると非表示になる（呼び出し側で制御）。
 */
export function FirstStepsGuide({
  hasWords,
  hasStudied,
}: {
  hasWords: boolean;
  hasStudied: boolean;
}) {
  const steps: Step[] = [
    {
      done: hasWords,
      title: "単語を単語帳に追加する",
      desc: "辞書で検索してワンタップ追加、または教材をまるごとインポート。",
      ctas: [
        { href: "/dictionary", label: "🔍 辞書で探す", primary: true },
        { href: "/materials", label: "📚 教材から" },
      ],
    },
    {
      done: hasStudied,
      title: "テスト・カードで覚える",
      desc: "4択やフラッシュカードでテンポよく学習しましょう。",
      ctas: [
        { href: hasWords ? "/review?start=1&mode=flip" : "/materials", label: "▶ 学習を始める", primary: true },
      ],
    },
    {
      done: false,
      title: "忘却曲線で毎日復習する",
      desc: "覚えた単語は最適なタイミングで自動的に再出題され、記憶に定着します。",
      ctas: [{ href: "/review", label: "🔁 復習を見る", primary: true }],
    },
  ];

  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <div data-testid="first-steps-guide" className="mt-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🚀</span>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Getting started</div>
          <div className="text-sm font-black text-navy-800">はじめの3ステップ</div>
        </div>
      </div>

      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx;
          return (
            <li
              key={i}
              data-testid={`first-step-${i}`}
              data-done={s.done}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                s.done
                  ? "border-emerald-200 bg-emerald-50/60"
                  : isCurrent
                    ? "border-sky-300 bg-white shadow-sm"
                    : "border-navy-100 bg-white/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    s.done
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-sky-500 text-white"
                        : "bg-navy-100 text-navy-400"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${s.done ? "text-emerald-800" : "text-navy-800"}`}>
                    {s.title}
                  </div>
                  {!s.done && <div className="text-[11px] text-navy-500 mt-0.5 leading-relaxed">{s.desc}</div>}
                  {isCurrent && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.ctas.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`text-xs font-bold rounded-lg px-3 py-1.5 transition-colors ${
                            c.primary
                              ? "bg-sky-600 text-white hover:bg-sky-700"
                              : "border border-sky-200 text-sky-700 hover:bg-sky-50"
                          }`}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
