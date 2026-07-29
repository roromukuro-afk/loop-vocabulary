"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LEVELS } from "@/types/db";
import { trackEvent } from "@/lib/analytics/track";

export function CreateWordBookForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("ログインが必要です"); setBusy(false); return; }
    const { error } = await supabase.from("word_books").insert({
      user_id: user.id,
      title,
      level: level || null,
      source_type: "custom",
    });
    setBusy(false);
    if (error) return setError(error.message);
    // wordbook_created: 単語帳タイトル(title)は個人の自由記述でありプライバシー方針上
    // 送信禁止のため、source_typeのみを送る(ANALYTICS_PRIVACY_POLICY.md参照)。
    trackEvent("wordbook_created", { source_type: "custom" });
    setTitle("");
    setLevel("");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
      <Field label="タイトル">
        <Input
          data-testid="wordbook-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 英検準2級"
          required
        />
      </Field>
      <Field label="レベル / 試験">
        <Select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">未設定</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy} fullWidth data-testid="create-wordbook-submit">{busy ? "作成中..." : "作成"}</Button>
      </div>
      {error && <div className="text-sm text-red-600 sm:col-span-3">{error}</div>}
    </form>
  );
}
