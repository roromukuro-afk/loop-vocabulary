"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { trackWordAdded, trackFirstWordAdded } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { checkActivationAfterSession } from "@/lib/analytics/activation";

export function QuickAddWord({ wordBookId }: { wordBookId: string }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("words").insert({
      user_id: user.id,
      word_book_id: wordBookId,
      word: word.trim(),
      meaning: meaning.trim(),
    });
    setSaving(false);
    if (!error) {
      trackWordAdded();
      const { count } = await supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      if (count === 1) { trackFirstWordAdded(); trackEvent("first_word_added"); }
      if (count === 5) trackEvent("five_words_added");
      if (count === 10) trackEvent("ten_words_added");
      void checkActivationAfterSession();
      setWord("");
      setMeaning("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-3 border-2 border-dashed border-navy-200 text-navy-400 rounded-2xl py-3 text-sm font-semibold hover:border-navy-400 hover:text-navy-600 transition-colors flex items-center justify-center gap-2"
      >
        ＋ クイック追加
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-navy-50 rounded-2xl p-4 space-y-2">
      <div className="text-xs font-bold text-navy-600 mb-2">単語をクイック追加</div>
      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="英単語 (例: persevere)"
        className="w-full border border-navy-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        autoFocus
      />
      <input
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="意味 (例: 頑張り続ける)"
        className="w-full border border-navy-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !word.trim() || !meaning.trim()}
          className="flex-1 bg-navy-800 text-white font-bold py-2 rounded-xl text-sm hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "追加中…" : success ? "✓ 追加済み" : "追加"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setWord(""); setMeaning(""); }}
          className="flex-1 border border-navy-200 text-navy-600 font-semibold py-2 rounded-xl text-sm hover:bg-navy-50"
        >
          キャンセル
        </button>
      </div>
      <div className="text-[10px] text-navy-400 text-center">詳細（発音・語源など）は <span className="underline">＋ 単語追加</span> ページから</div>
    </form>
  );
}
