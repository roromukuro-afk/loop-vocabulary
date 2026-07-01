import type { Block, Section } from "@/lib/grammar/types";

const CALLOUT_STYLE: Record<
  "key" | "tip" | "warn",
  { bg: string; icon: string; label: string }
> = {
  key: { bg: "bg-sky-50 border-sky-200", icon: "🎯", label: "核心" },
  tip: { bg: "bg-emerald-50 border-emerald-200", icon: "💡", label: "ポイント" },
  warn: { bg: "bg-amber-50 border-amber-200", icon: "⚠️", label: "注意" },
};

function renderBlock(block: Block, key: string) {
  switch (block.type) {
    case "p":
      return (
        <p key={key} className="text-sm text-navy-700 leading-relaxed">
          {block.text}
        </p>
      );
    case "sub":
      return (
        <h3 key={key} className="text-base font-bold text-navy-800 mt-2">
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul key={key} className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm text-navy-700">
              <span className="text-sky-500 font-bold shrink-0 mt-0.5">·</span>
              <span className="leading-relaxed">{it}</span>
            </li>
          ))}
        </ul>
      );
    case "callout": {
      const s = CALLOUT_STYLE[block.tone];
      return (
        <div key={key} className={`rounded-xl border p-4 ${s.bg}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{s.icon}</span>
            <span className="text-[11px] font-bold text-navy-700 uppercase tracking-wide">
              {block.title ?? s.label}
            </span>
          </div>
          <p className="text-sm text-navy-700 leading-relaxed">{block.text}</p>
        </div>
      );
    }
    case "example":
      return (
        <div key={key} className="rounded-xl border border-navy-100 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-navy-50 border-b border-navy-100">
            <p className="font-semibold text-navy-900 text-sm leading-snug">{block.en}</p>
          </div>
          <div className="px-4 py-2.5 space-y-1">
            <p className="text-sm text-navy-600">{block.jp}</p>
            {block.point && (
              <p className="text-[12px] text-navy-500 leading-relaxed">
                <span className="font-bold text-sky-600">ポイント </span>
                {block.point}
              </p>
            )}
          </div>
        </div>
      );
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full text-sm border border-navy-200 rounded-xl overflow-hidden">
            <thead className="bg-navy-50">
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-navy-700 border-b border-navy-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-navy-100 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-navy-600 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quiz":
      return (
        <div key={key} className="rounded-2xl border border-navy-100 bg-white p-5">
          <p className="text-sm font-semibold text-navy-800 mb-3">{block.prompt}</p>
          <div className="space-y-3">
            {block.rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-navy-100 p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-navy-800 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-navy-700">{r.q}</p>
                    <p className="text-sm mt-1">
                      <span className="font-bold text-emerald-600">答え：{r.a}</span>
                    </p>
                    <p className="text-[12px] text-navy-500 mt-0.5 leading-relaxed">{r.exp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
  }
}

export function LessonBody({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-5">
      {sections.map((sec, si) => (
        <section
          key={si}
          className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 sm:p-6"
        >
          <h2 className="font-black text-navy-800 text-lg mb-4 leading-snug">
            <span className="text-sky-400 mr-2">{String(si + 1).padStart(2, "0")}</span>
            {sec.heading}
          </h2>
          <div className="space-y-4">
            {sec.blocks.map((b, bi) => renderBlock(b, `${si}-${bi}`))}
          </div>
        </section>
      ))}
    </div>
  );
}
