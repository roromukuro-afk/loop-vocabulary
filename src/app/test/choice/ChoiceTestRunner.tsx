"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { sample, shuffle } from "@/lib/utils/shuffle";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { useAppInterstitial, AppRewardedAdButton } from "@/components/ads/AppAds";
import { speakEn } from "@/lib/tts";
import { PronounceButton } from "@/components/ui/PronounceButton";

type W = { id: string; word: string; meaning: string; streak: number; is_weak: boolean };

type Q = { w: W; choices: string[]; answer: string; prompt: string };

function buildQuestions(pool: W[], mode: "en2ja" | "ja2en", n: number): Q[] {
  const targets = sample(pool, n);
  return targets.map((w) => {
    const distractors = sample(
      pool.filter((p) => p.id !== w.id),
      3,
    ).map((p) => (mode === "en2ja" ? p.meaning : p.word));
    const answer = mode === "en2ja" ? w.meaning : w.word;
    const prompt = mode === "en2ja" ? w.word : w.meaning;
    const choices = shuffle([answer, ...distractors]);
    return { w, choices, answer, prompt };
  });
}

export function ChoiceTestRunner({
  pool, mode, count, placement = "choice_test",
}: { pool: W[]; mode: "en2ja" | "ja2en"; count: number; placement?: string }) {
  const router = useRouter();
  const showInterstitial = useAppInterstitial();
  const [qs, setQs] = useState(() => buildQuestions(pool, mode, count));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ word: string; meaning: string; ok: boolean }[]>([]);
  const [done, setDone] = useState(false);

  const cur = qs[idx];
  const ok = picked != null && picked === cur?.answer;

  // テスト完了時にインタースティシャル広告を表示
  useEffect(() => {
    if (done) void showInterstitial(placement);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // 英語→日本語モード: 問題が変わるたびに英単語を自動読み上げ
  useEffect(() => {
    if (!done && mode === "en2ja" && cur?.prompt) {
      speakEn(cur.prompt);
    }
  }, [cur?.prompt, mode, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (c: string) => {
    if (picked != null) return;
    setPicked(c);
    const isOk = c === cur.answer;
    setResults((r) => [...r, { word: cur.w.word, meaning: cur.w.meaning, ok: isOk }]);
    void saveStudyResult(cur.w, isOk);
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= qs.length) {
      setDone(true);
      return;
    }
    setIdx(idx + 1);
  };

  const restart = () => {
    setQs(buildQuestions(pool, mode, count));
    setIdx(0);
    setResults([]);
    setDone(false);
    setPicked(null);
    router.refresh();
  };

  // リワード広告視聴後に追加10問を開始
  const onRewardedExtra = () => {
    setQs(buildQuestions(pool, mode, Math.min(10, pool.length)));
    setIdx(0);
    setResults([]);
    setDone(false);
    setPicked(null);
  };

  const correctCount = results.filter((r) => r.ok).length;
  const acc = results.length ? Math.round((correctCount / results.length) * 100) : 0;

  const shareResult = async () => {
    const emoji = acc >= 90 ? "🎯" : acc >= 70 ? "📚" : "💪";
    const text = `${emoji} Loop Vocabulary で ${results.length}問中${correctCount}問正解！正答率${acc}%\n英単語学習アプリ → https://loop-vocabulary.vercel.app`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-navy-800 text-center">結果</h1>
        <div className="mt-6 bg-white rounded-2xl border border-navy-100 shadow-card p-6 text-center">
          <div className="text-sm text-navy-500">正答率</div>
          <div className="text-5xl font-bold text-navy-800 mt-1">{acc}%</div>
          <div className="text-sm text-navy-500 mt-2">{correctCount} / {results.length} 正解</div>
          <button
            onClick={shareResult}
            className="mt-4 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-sky-100 text-sky-700 font-semibold hover:bg-sky-200 transition-colors"
          >
            <span>📤</span> 結果をシェア
          </button>
        </div>

        <h2 className="mt-6 font-bold text-navy-800">間違えた単語</h2>
        <ul className="mt-2 space-y-2">
          {results.filter((r) => !r.ok).map((r, i) => (
            <li key={i} className="bg-white rounded-xl border border-navy-100 p-3">
              <div className="font-semibold text-navy-800">{r.word}</div>
              <div className="text-sm text-navy-600">{r.meaning}</div>
            </li>
          ))}
          {results.every((r) => r.ok) && (
            <li className="text-sm text-navy-500">全問正解！すばらしい。</li>
          )}
        </ul>

        {pool.length >= 4 && (
          <div className="mt-4">
            <AppRewardedAdButton
              kind="extra_review"
              label="広告を見てもう10問チャレンジ"
              onReward={onRewardedExtra}
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button fullWidth onClick={restart}>もう一度</Button>
          <Link href="/dashboard"><Button fullWidth variant="secondary">ホームへ</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 py-6 max-w-md mx-auto flex flex-col">
      <div className="flex items-center justify-between text-xs text-navy-500">
        <Link href="/dashboard">← 中断</Link>
        <span>{idx + 1} / {qs.length}</span>
      </div>
      <div className="mt-2 h-1.5 bg-navy-100 rounded-full overflow-hidden">
        <div className="h-full bg-navy-700 transition-all"
             style={{ width: `${((idx + (picked ? 1 : 0)) / qs.length) * 100}%` }} />
      </div>

      <div className="mt-10 text-center">
        <div className="text-xs text-navy-400">
          {mode === "en2ja" ? "意味を選ぼう" : "英単語を選ぼう"}
        </div>
        <div className={cn(
          "mt-2 font-bold text-navy-900 flex items-center justify-center gap-2",
          mode === "en2ja" ? "text-4xl" : "text-2xl",
        )}>
          {cur.prompt}
          {mode === "en2ja" && (
            <PronounceButton word={cur.prompt} size="lg" />
          )}
        </div>
      </div>

      <ul className="mt-8 space-y-3">
        {cur.choices.map((c) => {
          const isAnswer = c === cur.answer;
          const isPicked = c === picked;
          let style = "bg-white border-navy-200";
          if (picked != null) {
            if (isAnswer) style = "bg-emerald-50 border-emerald-300";
            else if (isPicked) style = "bg-red-50 border-red-300";
            else style = "bg-white border-navy-100 opacity-60";
          }
          return (
            <li key={c}>
              <button
                onClick={() => onPick(c)}
                className={cn(
                  "w-full text-left px-4 py-4 rounded-2xl border font-semibold text-navy-800",
                  "transition-all active:scale-[0.99]",
                  style,
                )}
              >
                {c}
              </button>
            </li>
          );
        })}
      </ul>

      {picked != null && (
        <div className="mt-6">
          {!ok && (
            <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
              正解: <b>{cur.answer}</b>
              <div className="mt-1 text-navy-600">{cur.w.word} = {cur.w.meaning}</div>
            </div>
          )}
          <Button fullWidth size="lg" onClick={next}>
            {idx + 1 >= qs.length ? "結果を見る" : "次へ"}
          </Button>
        </div>
      )}

      <p className="mt-auto pt-8 text-center text-[10px] text-navy-400">
        テスト中は広告を表示しません。
      </p>
    </div>
  );
}

