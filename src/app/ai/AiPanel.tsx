"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RewardedAdButton } from "@/components/ads/AdComponents";
import { createClient } from "@/lib/supabase/client";

type Kind = "example" | "explain" | "etymology" | "mnemonic";

const KIND_LABEL: Record<Kind, string> = {
  example: "レベル別例文",
  explain: "ニュアンス解説 / 入試での出方",
  etymology: "語源解説",
  mnemonic: "覚え方・暗記のコツ",
};

export function AiPanel({ initialWord, initialMeaning }: { initialWord: string; initialMeaning: string }) {
  const [word, setWord] = useState(initialWord);
  const [meaning, setMeaning] = useState(initialMeaning);
  const [kind, setKind] = useState<Kind>("example");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const run = async () => {
    setBusy(true); setError(null); setLimitReached(false); setResult("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, word, meaning }),
    });
    setBusy(false);
    if (res.status === 429) { setLimitReached(true); setError("本日の利用上限に達しました"); return; }
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "失敗しました"); return; }
    setResult(data.result);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
  };

  const grantTicket = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("reward_tickets").insert({ user_id: user.id, kind: "ai", amount: 1 });
    setLimitReached(false);
    setError(null);
  };

  return (
    <div className="grid gap-3">
      <Field label="英単語">
        <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="provide" />
      </Field>
      <Field label="意味">
        <Input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="提供する" />
      </Field>
      <Field label="生成タイプ">
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </Select>
      </Field>
      <Button onClick={run} disabled={busy || !word}>{busy ? "生成中..." : "生成する"}</Button>
      {remaining != null && <div className="text-xs text-navy-400">本日残り: {remaining} 回</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {limitReached && (
        <RewardedAdButton label="リワード広告を見て AI を +1 回使う" onReward={grantTicket} />
      )}
      {result && (
        <pre className="whitespace-pre-wrap text-sm bg-navy-50 border border-navy-100 rounded-xl p-4 text-navy-700">
          {result}
        </pre>
      )}
    </div>
  );
}
