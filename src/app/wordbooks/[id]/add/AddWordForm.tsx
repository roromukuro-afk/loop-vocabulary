"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

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

  const set = (k: keyof typeof w) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setW({ ...w, [k]: e.target.value });

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
    router.push(`/wordbooks/${wordBookId}`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="英単語"><Input required value={w.word} onChange={set("word")} /></Field>
      <Field label="意味"><Input required value={w.meaning} onChange={set("meaning")} /></Field>
      <Field label="品詞"><Input value={w.pos} onChange={set("pos")} placeholder="名詞 / 動詞 ..." /></Field>
      <Field label="発音記号"><Input value={w.phonetic} onChange={set("phonetic")} placeholder="/ɪmˈpɔːrtnt/" /></Field>
      <Field label="例文"><Textarea value={w.example} onChange={set("example")} /></Field>
      <Field label="例文の和訳"><Textarea value={w.example_ja} onChange={set("example_ja")} /></Field>
      <Field label="語源メモ"><Textarea value={w.etymology} onChange={set("etymology")} /></Field>
      <Field label="ニュアンス"><Textarea value={w.nuance} onChange={set("nuance")} /></Field>
      <Field label="似た単語"><Input value={w.similar_words} onChange={set("similar_words")} /></Field>
      <Field label="反意語"><Input value={w.antonym} onChange={set("antonym")} /></Field>
      <Field label="派生語"><Input value={w.derivative} onChange={set("derivative")} /></Field>
      <Field label="熟語"><Input value={w.idiom} onChange={set("idiom")} /></Field>
      <Field label="重要度 (1-5)">
        <Input type="number" min={1} max={5} value={w.importance} onChange={set("importance")} />
      </Field>
      {error && <div className="text-sm text-red-600 sm:col-span-2">{error}</div>}
      <div className="sm:col-span-2">
        <Button type="submit" fullWidth size="lg" disabled={busy}>{busy ? "登録中..." : "登録"}</Button>
      </div>
    </form>
  );
}
