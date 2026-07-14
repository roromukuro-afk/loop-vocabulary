"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { trackWordAdded, trackFirstWordAdded } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { checkActivationAfterSession } from "@/lib/analytics/activation";

export function AddWordForm({ wordBookId }: { wordBookId: string }) {
  const router = useRouter();
  const [w, setW] = useState({
    word: "", meaning: "", pos: "", phonetic: "",
    example: "", example_ja: "",
    etymology: "", nuance: "", similar_words: "", antonym: "", derivative: "", idiom: "",
    importance: 3,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const set = (k: keyof typeof w) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setW((prev) => ({ ...prev, [k]: e.target.value }));

  const aiLookup = async () => {
    if (!w.word.trim()) return;
    setLookingUp(true);
    try {
      const res = await fetch("/api/ai/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w.word.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setW((prev) => ({
          ...prev,
          meaning:     data.meaning     || prev.meaning,
          pos:         data.pos         || prev.pos,
          phonetic:    data.phonetic    || prev.phonetic,
          example:     data.example     || prev.example,
          example_ja:  data.example_ja  || prev.example_ja,
        }));
      }
    } catch {
      // ignore — user can fill manually
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setBusy(false); return; }
    const { error } = await supabase.from("words").insert({
      user_id: user.id,
      word_book_id: wordBookId,
      ...w,
      importance: Number(w.importance) || 3,
      next_review_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    trackWordAdded();
    const { count } = await supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    if (count === 1) { trackFirstWordAdded(); trackEvent("first_word_added"); }
    if (count === 5) trackEvent("five_words_added");
    if (count === 10) trackEvent("ten_words_added");
    void checkActivationAfterSession();
    router.push(`/wordbooks/${wordBookId}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {/* 英単語 + AI補完ボタン */}
      <div className="sm:col-span-2">
        <Field label="英単語">
          <div className="flex gap-2">
            <Input
              required
              value={w.word}
              onChange={set("word")}
              placeholder="例: persevere"
              className="flex-1"
            />
            <button
              type="button"
              onClick={aiLookup}
              disabled={lookingUp || !w.word.trim()}
              className="shrink-0 px-3 py-2 rounded-xl bg-sky-100 text-sky-700 text-xs font-bold hover:bg-sky-200 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {lookingUp ? "調査中…" : "✨ AI補完"}
            </button>
          </div>
        </Field>
        {lookingUp && (
          <p className="text-xs text-sky-600 mt-1">意味・発音・例文を自動入力しています…</p>
        )}
      </div>

      <Field label="意味">
        <Input required value={w.meaning} onChange={set("meaning")} placeholder="AI補完後に編集できます" />
      </Field>
      <Field label="品詞">
        <Input value={w.pos} onChange={set("pos")} placeholder="名詞 / 動詞 ..." />
      </Field>
      <Field label="発音記号">
        <Input value={w.phonetic} onChange={set("phonetic")} placeholder="/ɪmˈpɔːrtnt/" />
      </Field>
      <Field label="重要度 (1-5)">
        <Input type="number" min={1} max={5} value={w.importance} onChange={set("importance")} />
      </Field>
      <Field label="例文">
        <Textarea value={w.example} onChange={set("example")} placeholder="英語例文" />
      </Field>
      <Field label="例文の和訳">
        <Textarea value={w.example_ja} onChange={set("example_ja")} />
      </Field>
      <Field label="語源メモ">
        <Textarea value={w.etymology} onChange={set("etymology")} placeholder="自分の言葉でメモ" />
      </Field>
      <Field label="ニュアンス">
        <Textarea value={w.nuance} onChange={set("nuance")} placeholder="使い方のコツなど" />
      </Field>
      <Field label="似た単語">
        <Input value={w.similar_words} onChange={set("similar_words")} />
      </Field>
      <Field label="反意語">
        <Input value={w.antonym} onChange={set("antonym")} />
      </Field>
      <Field label="派生語">
        <Input value={w.derivative} onChange={set("derivative")} />
      </Field>
      <Field label="熟語">
        <Input value={w.idiom} onChange={set("idiom")} />
      </Field>
      {error && <div className="text-sm text-red-600 sm:col-span-2">{error}</div>}
      <div className="sm:col-span-2">
        <Button type="submit" fullWidth size="lg" disabled={busy}>{busy ? "登録中..." : "登録"}</Button>
      </div>
    </form>
  );
}
