"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";

type Mat = { id: string; title: string; license_status: string; is_public: boolean };

type Row = {
  word: string; meaning: string;
  pos?: string; example?: string; example_ja?: string;
  importance?: number; frequency?: number; level?: string;
  chapter?: string; unit?: string; page?: string; display_order?: number;
};

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((s) => s.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const r: any = {};
    header.forEach((h, idx) => {
      const v = (cols[idx] ?? "").trim();
      if (!v) return;
      if (["importance", "frequency", "display_order"].includes(h)) r[h] = Number(v);
      else r[h] = v;
    });
    if (r.word && r.meaning) rows.push(r);
  }
  return rows;
}
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (const c of line) {
    if (c === '"') { q = !q; continue; }
    if (c === "," && !q) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function parseJson(text: string): Row[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("配列形式の JSON にしてください");
  return data.filter((r) => r?.word && r?.meaning);
}

export function ImportPanel({ materials }: { materials: Mat[] }) {
  const router = useRouter();
  const [materialId, setMaterialId] = useState<string>(materials[0]?.id ?? "");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const rows = format === "csv" ? parseCsv(text) : parseJson(text);
      if (rows.length === 0) { setMsg("有効な行がありません"); return; }
      const supabase = createClient();
      const payload = rows.map((r) => ({
        material_id: materialId,
        word: r.word, meaning: r.meaning,
        pos: r.pos ?? null,
        example: r.example ?? null,
        example_ja: r.example_ja ?? null,
        importance: r.importance ?? 3,
        frequency: r.frequency ?? 3,
        level: r.level ?? null,
        display_order: r.display_order ?? 0,
      }));
      // 1000 件ずつ分割
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const slice = payload.slice(i, i + 500);
        const { error } = await supabase.from("material_words").insert(slice);
        if (error) { setMsg(`エラー (offset ${i}): ${error.message}`); break; }
        inserted += slice.length;
      }
      setMsg(`${inserted} 件をインポートしました`);
      router.refresh();
    } catch (e) {
      setMsg(`パース失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3">
      <Field label="対象教材">
        <Select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.license_status} / {m.is_public ? "公開" : "非公開"})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="形式">
        <Select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "json")}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </Select>
      </Field>
      <Field label="データ (ペースト)">
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={format === "csv" ? "word,meaning,..." : '[{"word":"...","meaning":"..."}]'}
          className="font-mono text-sm"
        />
      </Field>
      <Button onClick={run} disabled={busy || !materialId || !text}>{busy ? "インポート中..." : "インポート実行"}</Button>
      {msg && <div className="text-sm text-navy-700">{msg}</div>}
    </div>
  );
}
