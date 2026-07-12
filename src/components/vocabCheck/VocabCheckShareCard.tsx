/**
 * 語彙力チェック結果の「スクショ映え」カード。
 * X・Instagram等での画面キャプチャ共有を想定した、コンパクトで完結した見た目にする。
 * 実データが無い「上位◯%」「難関大合格レベル」等の断定・順位表現は出さない。
 */
export function VocabCheckShareCard({
  levelLabel,
  scoreLabel,
  correct,
  total,
  strong,
  weak,
  nextAction,
  colorClass,
  emoji,
}: {
  levelLabel: string;
  scoreLabel?: string;
  correct: number;
  total: number;
  strong: string | null;
  weak: string | null;
  nextAction: string;
  colorClass: string;
  emoji: string;
}) {
  const accuracy = Math.round((correct / total) * 100);
  return (
    <div
      data-testid="vocab-check-share-card"
      className="rounded-3xl border-2 border-navy-200 bg-white p-6 text-center shadow-sm"
    >
      <div className="text-3xl">{emoji}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mt-1">
        Loop Vocabulary・3分で語彙力チェック
      </div>
      <div className={`mt-2 text-2xl font-black ${colorClass}`}>{levelLabel}</div>
      {scoreLabel && <div className="text-xs text-navy-500 mt-0.5">{scoreLabel}</div>}
      <div className="mt-3 text-sm text-navy-700">
        正答率 <span className="font-bold">{accuracy}%</span>
        <span className="text-navy-400">（{correct}/{total}問）</span>
      </div>
      {strong && weak && strong !== weak && (
        <div className="mt-3 flex justify-center gap-2 text-xs flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">得意: {strong}</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">苦手: {weak}</span>
        </div>
      )}
      <div className="mt-4 text-xs text-navy-600 border-t border-navy-100 pt-3">
        次にやること: {nextAction}
      </div>
    </div>
  );
}
