type ChangelogEntry = { date: string; note: string };

export function GuideByline({
  targetAudience,
  sources,
  lastUpdated,
  changelog,
}: {
  /** 対象者（例: "高校生・大学受験生向け"） */
  targetAudience: string;
  /** 出典・参考文献。特定の論文引用がない場合は、一般的に確立された研究領域である旨を明記する */
  sources: string;
  /** 最終更新日（YYYY-MM-DD） */
  lastUpdated: string;
  /** 更新履歴（新しい順） */
  changelog: ChangelogEntry[];
}) {
  return (
    <div className="bg-navy-50 rounded-2xl p-4 text-xs text-navy-600 space-y-2" data-testid="guide-byline">
      <div>
        <span className="font-bold text-navy-700">対象者: </span>
        {targetAudience}
      </div>
      <div>
        <span className="font-bold text-navy-700">出典・参考: </span>
        {sources}
      </div>
      <div>
        <span className="font-bold text-navy-700">執筆・確認: </span>
        Loop Vocabulary編集チーム（最終更新日: {lastUpdated}）
      </div>
      {changelog.length > 0 && (
        <div>
          <span className="font-bold text-navy-700">更新履歴: </span>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {changelog.map((c) => (
              <li key={c.date}>
                {c.date} — {c.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
