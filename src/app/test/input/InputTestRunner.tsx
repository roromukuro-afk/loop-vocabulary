"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { levenshtein, normalizeAnswer } from "@/lib/utils/shuffle";
import { saveStudyResult } from "@/lib/srs/saveResult";
import { selectQuizWords, type SrsQuizWord } from "@/lib/learning/wordSelection";

type W = SrsQuizWord & { streak: number; is_weak: boolean };
type State = "input" | "judged";
type Verdict = "correct" | "close" | "wrong";

export function InputTestRunner({ pool, count }: { pool: W[]; count: number }) {
  // 未学習優先→due/weak優先の重み付き抽選（4択テストと共通ロジック、詳細はwordSelection.ts参照）
  const qs = useMemo(() => selectQuizWords(pool, count) as W[], [pool, count]);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [state, setState] = useState<State>("input");
  const [verdict, setVerdict] = useState<Verdict>("wrong");
  const [results, setResults] = useState<{ word: string; meaning: string; ok: boolean; v: Verdict }[]>([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cur = qs[idx];

  const judge = (e: React.FormEvent) => {
    e.preventDefault();
    if (state !== "input") return;
    const ans = normalizeAnswer(cur.word);
    const got = normalizeAnswer(val);
    const dist = levenshtein(ans, got);
    let v: Verdict = "wrong";
    if (ans === got) v = "correct";
    else if (dist > 0 && dist <= 2 && got.length >= 2) v = "close";
    const ok = v === "correct";
    setVerdict(v);
    setState("judged");
    setResults((r) => [...r, { word: cur.word, meaning: cur.meaning, ok, v }]);
    void saveStudyResult(cur, ok);
  };

  const next = () => {
    setVal("");
    setState("input");
    if (idx + 1 >= qs.length) { setDone(true); return; }
    setIdx(idx + 1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const correctCount = results.filter((r) => r.ok).length;
  const acc = results.length ? Math.round((correctCount / results.length) * 100) : 0;

  if (done) {
    return (
      <div className="min-h-dvh px-4 py-6 max-w-md mx-auto" data-testid="quiz-done">
        <h1 className="text-2xl font-bold text-navy-800 text-center">結果</h1>
        <div className="mt-6 bg-white rounded-2xl border border-navy-100 shadow-card p-6 text-center">
          <div className="text-sm text-navy-500">正答率</div>
          <div className="text-5xl font-bold text-navy-800 mt-1">{acc}%</div>
          <div className="text-sm text-navy-500 mt-2">{correctCount} / {results.length} 正解</div>
        </div>
        <h2 className="mt-6 font-bold text-navy-800">間違えた・惜しかった単語</h2>
        <ul className="mt-2 space-y-2">
          {results.filter((r) => !r.ok).map((r, i) => (
            <li key={i} className="bg-white rounded-xl border border-navy-100 p-3">
              <div className="font-semibold text-navy-800">{r.word}
                {r.v === "close" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">惜しい</span>}
              </div>
              <div className="text-sm text-navy-600">{r.meaning}</div>
            </li>
          ))}
          {results.every((r) => r.ok) && <li className="text-sm text-navy-500">全問正解！</li>}
        </ul>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/test/input"><Button fullWidth>もう一度</Button></Link>
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
        <div className="h-full bg-navy-700 transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
      </div>

      <div className="mt-10 text-center">
        <div className="text-xs text-navy-400">この意味の英単語を入力</div>
        <div className="mt-2 text-3xl font-bold text-navy-900" data-testid="quiz-prompt" data-word-id={cur.id}>{cur.meaning}</div>
      </div>

      <form onSubmit={judge} className="mt-8 space-y-3">
        <Input
          ref={inputRef}
          data-testid="quiz-input"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="英単語"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={state !== "input"}
          className="text-center text-xl"
        />
        {state === "input" ? (
          <Button type="submit" fullWidth size="lg" data-testid="quiz-submit">判定</Button>
        ) : (
          <div>
            {verdict === "correct" && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-center font-bold">正解！</div>
            )}
            {verdict === "close" && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-center">
                惜しい！ 正解: <b>{cur.word}</b>
              </div>
            )}
            {verdict === "wrong" && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-center">
                正解: <b>{cur.word}</b>
              </div>
            )}
            <Button fullWidth size="lg" className="mt-3" onClick={next} data-testid="quiz-next">
              {idx + 1 >= qs.length ? "結果を見る" : "次へ"}
            </Button>
          </div>
        )}
      </form>

      <p className="mt-auto pt-8 text-center text-[10px] text-navy-400">
        大文字小文字・前後の空白は無視されます。
      </p>
    </div>
  );
}
