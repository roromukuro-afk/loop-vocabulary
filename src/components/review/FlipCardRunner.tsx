"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { isSrsV2Enabled, type SrsRating } from "@/lib/srs";
import { useAppInterstitial, AppRewardedAdButton } from "@/components/ads/AppAds";
import { speakEn } from "@/lib/tts";
import { PronounceButton } from "@/components/ui/PronounceButton";
import { trackFeatureUsed, trackReviewComplete, trackFirstReviewComplete } from "@/lib/analytics/events";

type W = {
  id: string; word: string; meaning: string; streak: number; is_weak: boolean;
  phonetic?: string; example?: string | null; example_ja?: string | null;
};
type Result = { word: string; meaning: string; ok: boolean };

const SWIPE_KEY = "lv_swipe_mode";

export function FlipCardRunner({ pool, v2Enabled }: { pool: W[]; v2Enabled?: boolean }) {
  const showInterstitial = useAppInterstitial();
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [swipeMode, setSwipeMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(SWIPE_KEY) === "1" : false
  );
  // swipe detection
  const touchStartX = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);

  const cur = pool[idx];
  // V2判定: サーバから渡された実効フラグ（env or ユーザーopt-in）を優先。
  // 未指定時は env のみで判定。ON のとき4段階評価UI、OFFなら従来の2値。
  const v2 = v2Enabled ?? isSrsV2Enabled();

  useEffect(() => { trackFeatureUsed("flip_card"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done && cur) speakEn(cur.word);
  }, [idx, done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done) return;
    void showInterstitial("flip_review");
    const correct = results.filter((r) => r.ok).length;
    trackReviewComplete(correct, results.length);
    if (!localStorage.getItem("lv_first_review")) {
      localStorage.setItem("lv_first_review", "1");
      trackFirstReviewComplete();
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSwipe = () => {
    const next = !swipeMode;
    setSwipeMode(next);
    localStorage.setItem(SWIPE_KEY, next ? "1" : "0");
  };

  const handleFlip = () => {
    if (flipped || busy) return;
    setFlipped(true);
  };

  const handleAnswer = async (isCorrect: boolean, rating?: SrsRating) => {
    if (busy) return;
    setBusy(true);
    setSwipeHint(null);
    // rating は V2 フラグ ON のときのみ saveStudyResult 内で使用される。
    // OFF のときは無視され、従来通り isCorrect ベースで動作する。
    await saveStudyResult(cur, isCorrect, undefined, rating);
    const newResults = [...results, { word: cur.word, meaning: cur.meaning, ok: isCorrect }];
    setResults(newResults);
    if (idx + 1 >= pool.length) {
      setDone(true);
    } else {
      setFlipped(false);
      setTimeout(() => { setIdx((i) => i + 1); setBusy(false); }, 350);
    }
  };

  // 4段階評価（V2）: again 以外は「覚えた」= ok:true として集計
  const handleRate = (rating: SrsRating) => {
    void handleAnswer(rating !== "again", rating);
  };

  // Swipe handlers — only trigger answer when flipped
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !flipped) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) setSwipeHint(dx > 0 ? "right" : "left");
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    setSwipeHint(null);
    if (!swipeMode || !flipped || busy) return;
    if (dx > 60) void handleAnswer(true);   // 右スワイプ = 覚えた
    else if (dx < -60) void handleAnswer(false); // 左スワイプ = まだ
  };

  const restart = () => {
    setIdx(0); setFlipped(false); setResults([]); setDone(false); setBusy(false);
  };

  const correctCount = results.filter((r) => r.ok).length;
  const acc = results.length ? Math.round((correctCount / results.length) * 100) : 0;

  const shareResult = async () => {
    const emoji = acc >= 90 ? "🎯" : acc >= 70 ? "📚" : "💪";
    const text = `${emoji} Loop Vocabulary で ${results.length}枚中${correctCount}枚クリア！記憶率${acc}%\n英単語フラッシュカード → https://loop-vocabulary.app`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-navy-800 text-center">完了！</h1>
        <div className="mt-6 bg-white rounded-2xl border border-navy-100 shadow-card p-6 text-center">
          <div className="text-6xl mb-2">{acc >= 90 ? "🎯" : acc >= 70 ? "📚" : "💪"}</div>
          <div className="text-sm text-navy-500">記憶率</div>
          <div className="text-5xl font-bold text-navy-800 mt-1">{acc}%</div>
          <div className="text-sm text-navy-500 mt-2">{correctCount} / {results.length} 覚えてた</div>
          <button
            onClick={shareResult}
            className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-sky-100 text-sky-700 font-semibold hover:bg-sky-200 transition-colors"
          >
            <span>📤</span> 結果をシェア
          </button>
        </div>

        {results.some((r) => !r.ok) && (
          <>
            <h2 className="mt-6 font-bold text-navy-800">覚えていなかった単語</h2>
            <ul className="mt-2 space-y-2">
              {results.filter((r) => !r.ok).map((r, i) => (
                <li key={i} className="bg-white rounded-xl border border-navy-100 p-3">
                  <div className="font-semibold text-navy-800">{r.word}</div>
                  <div className="text-sm text-navy-600">{r.meaning}</div>
                </li>
              ))}
            </ul>
          </>
        )}

        {pool.length >= 4 && (
          <div className="mt-4">
            <AppRewardedAdButton kind="extra_review" label="広告を見てもう一周チャレンジ" onReward={restart} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button fullWidth onClick={restart}>もう一度</Button>
          <Link href="/dashboard"><Button fullWidth variant="secondary">ホームへ</Button></Link>
        </div>
      </div>
    );
  }

  const swipeOverlay = swipeHint && (
    <div className={`absolute inset-0 rounded-3xl flex items-center justify-center text-4xl font-black pointer-events-none transition-opacity z-10 ${
      swipeHint === "right" ? "bg-emerald-500/20 text-emerald-600" : "bg-red-500/20 text-red-600"
    }`}>
      {swipeHint === "right" ? "✓ 覚えた" : "✗ まだ"}
    </div>
  );

  return (
    <div className="min-h-dvh px-4 py-6 max-w-md mx-auto flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between text-xs text-navy-500">
        <Link href="/review">← 中断</Link>
        <span>{idx + 1} / {pool.length}</span>
        <button
          onClick={toggleSwipe}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
            swipeMode
              ? "bg-sky-100 border-sky-300 text-sky-700 font-semibold"
              : "bg-white border-navy-200 text-navy-400"
          }`}
        >
          {swipeMode ? "👆 スワイプON" : "👆 スワイプ"}
        </button>
      </div>

      <div className="mt-2 h-1.5 bg-navy-100 rounded-full overflow-hidden">
        <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${(idx / pool.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center mt-4 gap-6">
        {/* フリップカード */}
        <div
          className="w-full relative"
          style={{ perspective: "1200px" }}
          onClick={handleFlip}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              minHeight: "220px",
            }}
          >
            {/* 表 (英語) */}
            <div
              className="absolute inset-0 bg-white rounded-3xl border-2 border-navy-200 shadow-xl flex flex-col items-center justify-center p-8 select-none cursor-pointer"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="text-[11px] uppercase tracking-widest text-navy-400 mb-3">English</div>
              <div className="text-4xl font-black text-navy-900 text-center leading-tight">{cur.word}</div>
              {cur.phonetic && <div className="mt-2 text-sm text-navy-400 font-mono">{cur.phonetic}</div>}
              <div className="mt-5"><PronounceButton word={cur.word} size="lg" /></div>
              <div className="mt-5 flex items-center gap-1.5 text-xs text-navy-400">
                <span>タップして意味を確認</span>
                <span className="text-base">👆</span>
              </div>
            </div>

            {/* 裏 (日本語 + 例文) */}
            <div
              className="absolute inset-0 bg-navy-800 rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 select-none overflow-hidden"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              {swipeOverlay}
              <div className="text-[11px] uppercase tracking-widest text-navy-400 mb-2">{cur.word}</div>
              <div className="text-2xl font-bold text-white text-center leading-snug">{cur.meaning}</div>
              {cur.example && (
                <div className="mt-4 w-full border-t border-navy-600 pt-4 space-y-1">
                  <p className="text-xs text-sky-300 italic leading-relaxed text-center">{cur.example}</p>
                  {cur.example_ja && (
                    <p className="text-[11px] text-navy-400 text-center">{cur.example_ja}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ボタン / スワイプヒント */}
        {!flipped ? (
          <p className="text-sm text-navy-400">カードをタップして意味を確認してください</p>
        ) : swipeMode ? (
          <p className="text-sm text-navy-400">← まだ　　覚えた →</p>
        ) : v2 ? (
          <div className="w-full grid grid-cols-4 gap-2">
            <button
              onClick={() => handleRate("again")}
              disabled={busy}
              className="py-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 font-bold hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
            >
              <span className="text-base">もう一度</span>
              <span className="text-[10px] font-normal text-red-400">明日</span>
            </button>
            <button
              onClick={() => handleRate("hard")}
              disabled={busy}
              className="py-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-700 font-bold hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
            >
              <span className="text-base">難しい</span>
              <span className="text-[10px] font-normal text-amber-400">短め</span>
            </button>
            <button
              onClick={() => handleRate("good")}
              disabled={busy}
              className="py-4 rounded-2xl bg-sky-50 border-2 border-sky-200 text-sky-700 font-bold hover:bg-sky-100 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
            >
              <span className="text-base">普通</span>
              <span className="text-[10px] font-normal text-sky-400">標準</span>
            </button>
            <button
              onClick={() => handleRate("easy")}
              disabled={busy}
              className="py-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
            >
              <span className="text-base">簡単</span>
              <span className="text-[10px] font-normal text-emerald-400">長め</span>
            </button>
          </div>
        ) : (
          <div className="w-full grid grid-cols-2 gap-4">
            <button
              onClick={() => handleAnswer(false)}
              disabled={busy}
              className="py-5 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 font-bold text-xl hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
            >
              ✗ まだ
            </button>
            <button
              onClick={() => handleAnswer(true)}
              disabled={busy}
              className="py-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-bold text-xl hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-50"
            >
              ✓ 覚えた
            </button>
          </div>
        )}
      </div>

      <p className="pt-4 text-center text-[10px] text-navy-400">
        {swipeMode ? "右スワイプ＝覚えた・左スワイプ＝まだ" : "「覚えた」「まだ」で次回の復習タイミングが自動調整されます"}
      </p>
    </div>
  );
}
