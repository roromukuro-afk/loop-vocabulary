"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function ImportMaterialButton({
  materialId, userId, title, level, examType,
}: {
  materialId: string; userId: string; title: string;
  level: string | null; examType: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { data: book, error: e1 } = await supabase
      .from("word_books")
      .insert({
        user_id: userId,
        title,
        level,
        exam_type: examType,
        source_type: "material",
        source_material_id: materialId,
        description: `教材「${title}」からインポート`,
      })
      .select("id").single();
    if (e1 || !book) { setBusy(false); setMsg("単語帳の作成に失敗しました"); return; }

    const { data: mwords, error: e2 } = await supabase
      .from("material_words")
      .select("word, meaning, pos, example, example_ja, importance")
      .eq("material_id", materialId);
    if (e2 || !mwords) { setBusy(false); setMsg("教材単語の取得に失敗しました"); return; }

    const now = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const rows = mwords.map((m) => ({
      user_id: userId,
      word_book_id: book.id,
      word: m.word,
      meaning: m.meaning,
      pos: m.pos,
      example: m.example,
      example_ja: m.example_ja,
      importance: m.importance,
      material_id: materialId,
      license_status: "approved",
      next_review_at: now,
    }));
    const { error: e3 } = await supabase.from("words").insert(rows);
    setBusy(false);
    if (e3) { setMsg("単語のインポートに失敗しました: " + e3.message); return; }
    setMsg(`${rows.length} 語をインポートしました`);
    router.push(`/wordbooks/${book.id}`);
    router.refresh();
  };

  return (
    <div>
      <Button onClick={run} disabled={busy} size="lg" fullWidth>
        {busy ? "インポート中..." : "自分の単語帳にインポート"}
      </Button>
      {msg && <div className="mt-2 text-sm text-navy-600">{msg}</div>}
    </div>
  );
}
