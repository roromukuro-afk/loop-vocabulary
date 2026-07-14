"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { shuffle } from "@/lib/utils/shuffle";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { selectQuizWords, pickDistractors, type SrsQuizWord } from "@/lib/learning/wordSelection";
import { useAppInterstitial, AppRewardedAdButton } from "@/components/ads/AppAds";
import { speakEn } from "@/lib/tts";
import { isAudioAutoplayEnabled } from "@/lib/audioSettings";
import { PronounceButton } from "@/components/ui/PronounceButton";
import { AudioAutoplayToggle } from "@/components/ui/AudioAutoplayToggle";
import { trackFeatureUsed } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { markFirstTestCompletedIfNeeded, checkActivationAfterSession } from "@/lib/analytics/activation";

type W = SrsQuizWord & { streak: number; is_weak: boolean };

type Q = { w: W; choices: string[]; answer: string; prompt: string };

// 同一セッション（ページ表示中）で直近に出題した単語数の上限。
// これを超えて出題履歴を保持すると、単語数の少ない単語帳で出題不能になるため上限を設ける。
const RECENT_HISTORY_LIMIT = 12;

function buildQuestions(
  pool: W[],
  mode: "en2ja" | "ja2en",
  n: number,
  excludeIds?: readonly string[],
): Q[] {
  const targets = selectQuizWords(pool, n, { excludeIds }) as W[];
  return targets.map((w) => {
    const distractors = pickDistractors(w, pool, 3, mode);
    const answer = mode === "en2ja" ? w.meaning : w.word;
    const prompt = mode === "en2ja" ? w.word : w.meaning;
    const choices = shuffle([answer, ...distractors]);
    return { w, choices, answer, prompt };
  });
}

export function ChoiceTestRunner({
  pool, mode, count, placement = "choice_test", scopeLabel,
}: { pool: W[]; mode: "en2ja" | "ja2en"; count: number; placement?: string; scopeLabel?: string }) {
  const router = useRouter();
  const showInterstitial = useAppInterstitial();
  // 同一ページ表示中に出題した単語IDの履歴（直近出題の連続再出題を避けるため）。
  // 「もう一度」で再挑戦した場合も引き継がれる（コンポーネントがアンマウントされないため）。
  const recentIdsRef = useRef<string[]>([]);
  const rememberShown = (questions: Q[]) => {
    recentIdsRef.current = [...recentIdsRef.current, ...questions.map((q) => q.w.id)].slice(
      -RECENT_HISTORY_LIMIT,
    );
  };
  const [qs, setQs] = useState(() => {
    const built = buildQuestions(pool, mode, count);
    rememberShown(built);
    return built;
  });
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ word: string; meaning: string; ok: boolean }[]>([]);
  const [done, setDone] = useState(false);

  const cur = qs[idx];
  const ok = picked != null && picked === cur?.answer;

  useEffect(() => {
    trackFeatureUsed("choice_test");
    trackEvent("study_session_started", { mode: "choice" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // テスト完了時にインタースティシャル広告を表示
  useEffect(() => {
    if (done) void showInterstitial(placement);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  // 英語→日本語モード: 問題が変わるたびに英単語を自動読み上げ
  useEffect(() => {
    if (!done && mode === "en2ja" && cur?.prompt && isAudioAutoplayEnabled()) {
      speakEn(cur.prompt);
    }
  }, [cur?.prompt, mode, done]); // eslint-disable-line react-hooks/exhaustive-deps

  // 日本語→英語モード: 解答前は答えが漏れるため読み上げない。回答した直後
  // （英単語がすでに選択肢の色分けで判明した後）に発音を確認できるようにする。
  useEffect(() => {
    if (!done && mode === "ja2en" && picked != null && isAudioAutoplayEnabled()) {
      speakEn(cur.w.word);
    }
  }, [picked, mode, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (c: string) => {
    if (picked != null) return;
    setPicked(c);
    const isOk = c === cur.answer;
    setResults((r) => [...r, { word: cur.w.word, meaning: cur.w.meaning, ok: isOk }]);
    trackEvent("word_answered", { correct: isOk });
    // mode="choice": 4択(再認)は自己想起より弱いシグナルのため間隔重み付けを控えめにする。
    void saveStudyResult(cur.w, isOk, undefined, undefined, "choice");
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= qs.length) {
      setDone(true);
      const correctCount = results.filter((r) => r.ok).length;
      trackEvent("study_session_completed", { mode: "choice", total: results.length, correct: correctCount });
      markFirstTestCompletedIfNeeded();
      void checkActivationAfterSession();
      return;
    }
    setIdx(idx + 1);
  };

  // 無料の再挑戦: 広告なしで「今回と全く同じ問題」をもう一度解く。
  // 新しい問題を選び直すこと自体に価値があるため、それは広告視聴側(onRewardedExtra)に
  // 役割を寄せ、無料側は復習目的の「同じ問題の再演習」に限定している
  // （詳細はNEXT_IMPROVEMENTS.md「無料/広告再挑戦の役割分担」参照）。
  const retrySameQuestions = () => {
    setIdx(0);
    setResults([]);
    setDone(false);
    setPicked(null);
    router.refresh();
  };

  // リワード広告視聴後に追加10問を開始
  const onRewardedExtra = () => {
    const built = buildQuestions(pool, mode, Math.min(10, pool.length), recentIdsRef.current);
    rememberShown(built);
    setQs(built);
    setIdx(0);
    setResults([]);
    setDone(false);
    setPicked(null);
  };

  const correctCount = results.filter((r) => r.ok).length;
  const acc = results.length ? Math.round((correctCount / results.length) * 100) : 0;

  const shareResult = async () => {
    const emoji = acc >= 90 ? "🎯" : acc >= 70 ? "📚" : "💪";
    const text = `${emoji} Loop Vocabulary で ${results.length}問中${correctCount}問正解！正答率${acc}%\n英単語学習アプリ → https://loop-vocabulary.app`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-md mx-auto" data-testid="quiz-done">
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
              label="広告を見て別の10問に挑戦"
              onReward={onRewardedExtra}
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button fullWidth onClick={retrySameQuestions}>同じ問題をもう一度</Button>
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
        <AudioAutoplayToggle />
      </div>
      {scopeLabel && (
        <p className="mt-1 text-center text-[11px] text-navy-400" data-testid="quiz-scope-label">{scopeLabel}</p>
      )}
      <div className="mt-2 h-1.5 bg-navy-100 rounded-full overflow-hidden">
        <div className="h-full bg-navy-700 transition-all"
             style={{ width: `${((idx + (picked ? 1 : 0)) / qs.length) * 100}%` }} />
      </div>

      <div className="mt-10 text-center">
        <div className="text-xs text-navy-400">
          {mode === "en2ja" ? "意味を選ぼう" : "英単語を選ぼう"}
        </div>
        <div
          data-testid="quiz-prompt"
          data-word-id={cur.w.id}
          className={cn(
            "mt-2 font-bold text-navy-900 flex items-center justify-center gap-2",
            mode === "en2ja" ? "text-4xl" : "text-2xl",
          )}
        >
          {cur.prompt}
          {mode === "en2ja" && (
            <PronounceButton word={cur.prompt} size="lg" />
          )}
        </div>
      </div>

      <ul className="mt-8 space-y-3" data-testid="quiz-choices">
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
                data-testid="quiz-choice"
                data-answer={isAnswer ? "true" : "false"}
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
          {mode === "ja2en" && (
            <div className="mb-3 flex items-center justify-center gap-1.5 text-sm text-navy-600">
              <span className="font-semibold">{cur.w.word}</span>
              <PronounceButton word={cur.w.word} size="sm" />
            </div>
          )}
          <Button fullWidth size="lg" onClick={next} data-testid="quiz-next">
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

