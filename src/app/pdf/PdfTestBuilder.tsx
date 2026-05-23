"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { sample } from "@/lib/utils/shuffle";
import { createClient } from "@/lib/supabase/client";

type SourceKind = "book" | "material";
type Direction = "en2ja" | "ja2en";
type Format = "write" | "choice";
type Filter = "all" | "weak" | "new";

type Row = { word: string; meaning: string };

export function PdfTestBuilder({
  books, materials,
}: { books: { id: string; title: string }[]; materials: { id: string; title: string }[] }) {
  const [src, setSrc] = useState<SourceKind>(books[0] ? "book" : "material");
  const [sourceId, setSourceId] = useState<string>(books[0]?.id ?? materials[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("en2ja");
  const [format, setFormat] = useState<Format>("write");
  const [filter, setFilter] = useState<Filter>("all");
  const [count, setCount] = useState<number>(20);
  const [withAnswer, setWithAnswer] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchRows = async (): Promise<Row[]> => {
    const supabase = createClient();
    if (src === "book") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !sourceId) return [];
      let q = supabase
        .from("words")
        .select("word, meaning, is_weak, last_studied_at")
        .eq("user_id", user.id)
        .eq("word_book_id", sourceId);
      if (filter === "weak") q = q.eq("is_weak", true);
      if (filter === "new")  q = q.is("last_studied_at", null);
      const { data } = await q.limit(500);
      return (data ?? []).map((r) => ({ word: r.word, meaning: r.meaning }));
    } else {
      const { data } = await supabase
        .from("material_words")
        .select("word, meaning")
        .eq("material_id", sourceId)
        .limit(500);
      return (data ?? []).map((r) => ({ word: r.word, meaning: r.meaning }));
    }
  };

  const generate = async () => {
    setBusy(true); setMsg(null);
    try {
      const all = await fetchRows();
      const rows = sample(all, Math.min(count, all.length));
      if (rows.length === 0) { setMsg("対象の単語が見つかりませんでした"); return; }

      // 印刷用ウィンドウを開いて jsPDF でなく HTML 印刷を使う (フォント互換のため)
      // 多言語フォント問題を避けるため HTML 経由でブラウザ印刷 → PDF 化
      const html = renderHtml({
        rows, direction, format, withAnswer,
        title: src === "book"
          ? books.find((b) => b.id === sourceId)?.title ?? "小テスト"
          : materials.find((m) => m.id === sourceId)?.title ?? "小テスト",
      });
      const w = window.open("", "_blank");
      if (!w) { setMsg("ポップアップがブロックされました"); return; }
      w.document.write(html);
      w.document.close();
      // ログ保存
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("pdf_exports").insert({
          user_id: user.id,
          word_book_id: src === "book"     ? sourceId : null,
          material_id:   src === "material" ? sourceId : null,
          config: { direction, format, filter, count, withAnswer },
        });
      }
      // ブラウザ印刷ダイアログ
      setTimeout(() => { w.focus(); w.print(); }, 500);
    } finally {
      setBusy(false);
    }
  };

  const options = src === "book" ? books : materials;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="ソース">
        <Select value={src} onChange={(e) => { setSrc(e.target.value as SourceKind); setSourceId(""); }}>
          <option value="book">自分の単語帳</option>
          <option value="material">教材</option>
        </Select>
      </Field>
      <Field label={src === "book" ? "単語帳" : "教材"}>
        <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {options.length === 0 && <option value="">選択肢がありません</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </Select>
      </Field>
      <Field label="出題方向">
        <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
          <option value="en2ja">英 → 日</option>
          <option value="ja2en">日 → 英</option>
        </Select>
      </Field>
      <Field label="出題形式">
        <Select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
          <option value="write">記述</option>
          <option value="choice">4 択</option>
        </Select>
      </Field>
      <Field label="絞り込み">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">全部から</option>
          <option value="weak">苦手単語のみ (自分の単語帳のみ)</option>
          <option value="new">未学習のみ (自分の単語帳のみ)</option>
        </Select>
      </Field>
      <Field label="出題数">
        <Input type="number" min={5} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-navy-700 sm:col-span-2">
        <input type="checkbox" checked={withAnswer} onChange={(e) => setWithAnswer(e.target.checked)} />
        解答つき (答え合わせ用) を生成
      </label>
      <div className="sm:col-span-2">
        <Button onClick={generate} disabled={busy || !sourceId} size="lg" fullWidth>
          {busy ? "生成中..." : "印刷用ウィンドウを開く"}
        </Button>
        <p className="text-[11px] text-navy-400 mt-2">
          ※ 別タブで印刷プレビューが開きます。ブラウザの「PDFで保存」で PDF 化できます。
        </p>
      </div>
      {msg && <div className="text-sm text-red-600 sm:col-span-2">{msg}</div>}
    </div>
  );
}

function renderHtml(o: {
  rows: Row[]; direction: Direction; format: Format; withAnswer: boolean; title: string;
}) {
  const { rows, direction, format, withAnswer, title } = o;
  const items = rows.map((r, i) => {
    const prompt = direction === "en2ja" ? r.word : r.meaning;
    const answer = direction === "en2ja" ? r.meaning : r.word;
    if (format === "choice") {
      // 4 択: 他の単語からダミーを抽出
      const others = sample(rows.filter((_, j) => j !== i), 3)
        .map((p) => direction === "en2ja" ? p.meaning : p.word);
      const choices = [answer, ...others].sort(() => Math.random() - 0.5);
      return { i, prompt, answer, choices };
    }
    return { i, prompt, answer, choices: null as string[] | null };
  });

  const css = `
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: 'Hiragino Sans','Noto Sans JP', sans-serif; color:#111e38; }
    h1 { font-size: 16pt; margin: 0 0 6mm; }
    .meta { font-size: 10pt; color:#476394; margin-bottom: 8mm; display:flex; justify-content:space-between; }
    ol { margin: 0; padding-left: 8mm; }
    li { font-size: 11pt; margin-bottom: 5mm; line-height: 1.6; }
    .ans-line { display:inline-block; min-width: 60mm; border-bottom: 1px solid #243860; margin-left: 4mm; }
    .choices { display:flex; flex-wrap:wrap; gap: 6mm; font-size:10.5pt; margin-top:1mm; }
    .answers { margin-top: 12mm; border-top: 1px dashed #6b87b3; padding-top: 6mm; }
    .answers h2 { font-size: 12pt; margin: 0 0 3mm; }
    .answers ol li { font-size: 10pt; margin-bottom: 1mm; }
    .name-box { border:1px solid #243860; padding: 2mm 4mm; font-size: 10pt; }
  `;

  const qhtml = items.map((q) => {
    const choicesHtml = q.choices
      ? `<div class="choices">${q.choices.map((c, idx) => `<span>${["ア","イ","ウ","エ"][idx]}. ${escape(c)}</span>`).join("")}</div>`
      : `<span class="ans-line">&nbsp;</span>`;
    return `<li>${escape(q.prompt)} ${choicesHtml}</li>`;
  }).join("");

  const answersHtml = withAnswer
    ? `<div class="answers"><h2>解答</h2><ol>${items.map((q) => `<li>${escape(q.answer)}</li>`).join("")}</ol></div>`
    : "";

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escape(title)} 小テスト</title>
<style>${css}</style></head><body>
<h1>${escape(title)} 小テスト</h1>
<div class="meta">
  <span>出題方向: ${direction === "en2ja" ? "英 → 日" : "日 → 英"} / 形式: ${format === "choice" ? "4 択" : "記述"} / 全 ${items.length} 問</span>
  <span class="name-box">氏名: ___________________</span>
</div>
<ol>${qhtml}</ol>
${answersHtml}
</body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
