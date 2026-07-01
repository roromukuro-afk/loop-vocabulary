import Link from "next/link";

type Material = { id: string; title: string };

export function GuideMaterialCTA({
  materials,
  heading = "この教材で単語を学習する",
}: {
  materials: Material[];
  heading?: string;
}) {
  return (
    <div className="mt-6 bg-sky-50 border border-sky-200 rounded-2xl p-5">
      <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1">
        Loop Vocabulary 教材
      </div>
      <div className="text-sm font-bold text-navy-800 mb-3">{heading}</div>
      <div className="space-y-2">
        {materials.map((m) => (
          <Link
            key={m.id}
            href={`/materials/${m.id}`}
            className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-sky-100 hover:border-sky-400 hover:shadow-sm transition-all"
          >
            <span className="font-semibold text-navy-800 text-sm">{m.title}</span>
            <span className="text-xs font-bold text-sky-600 shrink-0">無料 →</span>
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-navy-400 mt-3 text-center">
        ログイン不要で単語一覧を閲覧 · 無料登録で学習記録が使えます
      </p>
    </div>
  );
}
