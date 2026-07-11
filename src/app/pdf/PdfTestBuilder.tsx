"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { sample } from "@/lib/utils/shuffle";
import { createClient } from "@/lib/supabase/client";
import { UpsellModal } from "@/components/premium/UpsellModal";
import { trackFeatureUsed } from "@/lib/analytics/events";
import { todayStartJstISO } from "@/lib/utils/date";

// PDF小テストの配布先（生徒・保護者）がオフラインから流入できるようにするための
// QRコード遷移先。個人情報・生徒名・学校名・単語帳の内容は一切含めない、
// 固定の公開URLのみを埋め込む。
const PDF_QR_TARGET_URL = "https://loop-vocabulary.app/vocab-check";

const FREE_PDF_LIMIT = 3;

type SourceKind = "book" | "material";
type Direction = "en2ja" | "ja2en";
type Format = "write" | "choice";
type Filter = "all" | "weak" | "new";
type Columns = 1 | 2;
type AnswerMode = "none" | "inline" | "separate";

type Row = { word: string; meaning: string };

export function PdfTestBuilder({
  books, materials, initialBookId,
}: { books: { id: string; title: string }[]; materials: { id: string; title: string }[]; initialBookId?: string | null }) {
  // ?book=<id> で単語帳詳細ページ等から遷移してきた場合は、その単語帳を初期選択する
  const initialBook = initialBookId ? books.find((b) => b.id === initialBookId) : undefined;
  const [src, setSrc] = useState<SourceKind>(initialBook ? "book" : books[0] ? "book" : "material");
  const [sourceId, setSourceId] = useState<string>(initialBook?.id ?? books[0]?.id ?? materials[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("en2ja");
  const [format, setFormat] = useState<Format>("write");
  const [filter, setFilter] = useState<Filter>("all");
  const [count, setCount] = useState<number>(20);
  const [columns, setColumns] = useState<Columns>(1);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("none");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [scopeWordCount, setScopeWordCount] = useState<number | null>(null);

  // 選択中の単語帳の対象語数を表示するため、選択が変わるたびに件数のみ取得する
  useEffect(() => {
    if (src !== "book" || !sourceId) { setScopeWordCount(null); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { count: n } = await supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .eq("word_book_id", sourceId);
      if (!cancelled) setScopeWordCount(n ?? 0);
    })();
    return () => { cancelled = true; };
  }, [src, sourceId]);

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
    trackFeatureUsed("pdf_export");
    setBusy(true); setMsg(null);
    try {
      // PDF 利用上限チェック（無料ユーザーは1日3回まで）
      const supabaseCheck = createClient();
      const { data: { user: checkUser } } = await supabaseCheck.auth.getUser();
      if (checkUser) {
        const { data: prof } = await supabaseCheck
          .from("profiles").select("is_premium").eq("id", checkUser.id).maybeSingle();
        if (!prof?.is_premium) {
          const { count } = await supabaseCheck
            .from("pdf_exports")
            .select("*", { count: "exact", head: true })
            .eq("user_id", checkUser.id)
            .gte("created_at", todayStartJstISO());
          if ((count ?? 0) >= FREE_PDF_LIMIT) {
            setShowUpsell(true);
            return;
          }
        }
      }

      const all = await fetchRows();
      const rows = sample(all, Math.min(count, all.length));
      if (rows.length === 0) { setMsg("対象の単語が見つかりませんでした"); return; }

      // オフライン配布からの流入導線用に、固定の公開URLへ遷移するQRコードを
      // 印刷ウィンドウを開く前に生成しておく（外部通信なし、ローカル生成）。
      const qrDataUrl = await QRCode.toDataURL(PDF_QR_TARGET_URL, {
        width: 88,
        margin: 0,
        color: { dark: "#1a2a4a", light: "#ffffff" },
      }).catch(() => null);

      // 印刷用ウィンドウを開いて jsPDF でなく HTML 印刷を使う (フォント互換のため)
      // 多言語フォント問題を避けるため HTML 経由でブラウザ印刷 → PDF 化
      const html = renderHtml({
        rows, direction, format, columns, answerMode,
        title: src === "book"
          ? books.find((b) => b.id === sourceId)?.title ?? "小テスト"
          : materials.find((m) => m.id === sourceId)?.title ?? "小テスト",
        qrDataUrl,
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
          config: { direction, format, filter, count, columns, answerMode },
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
      {showUpsell && (
        <div className="sm:col-span-2">
          <UpsellModal trigger="generic" onClose={() => setShowUpsell(false)} />
        </div>
      )}
      <Field label="ソース">
        <Select
          data-testid="pdf-source-kind"
          value={src}
          onChange={(e) => { setSrc(e.target.value as SourceKind); setSourceId(""); }}
        >
          <option value="book">自分の単語帳</option>
          <option value="material">教材</option>
        </Select>
      </Field>
      <Field label={src === "book" ? "単語帳" : "教材"}>
        <Select data-testid="pdf-source-id" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {options.length === 0 && <option value="">選択肢がありません</option>}
          {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </Select>
        {src === "book" && sourceId && (
          <p className="mt-1 text-[11px] text-navy-400" data-testid="quiz-scope-label">
            {scopeWordCount === null ? "対象語数を確認中…" : `対象語数: ${scopeWordCount}語`}
          </p>
        )}
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
      <Field label="段組み">
        <Select value={String(columns)} onChange={(e) => setColumns(Number(e.target.value) as Columns)}>
          <option value="1">1 段組み</option>
          <option value="2">2 段組み (省スペース)</option>
        </Select>
      </Field>
      <Field label="解答">
        <Select value={answerMode} onChange={(e) => setAnswerMode(e.target.value as AnswerMode)}>
          <option value="none">なし (問題のみ)</option>
          <option value="inline">同ページ末尾に解答</option>
          <option value="separate">別紙 (解答用紙を分離)</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Button onClick={generate} disabled={busy || !sourceId} size="lg" fullWidth data-testid="pdf-generate-button">
          {busy ? "生成中..." : "印刷用ウィンドウを開く"}
        </Button>
        <p className="text-[11px] text-navy-400 mt-2">
          ※ 別タブで印刷プレビューが開きます。ブラウザの「PDFで保存」で PDF 化できます。
          「別紙」を選ぶと解答が改ページされ、問題用紙と解答用紙を分けて印刷できます。
          無料プランは1日 {FREE_PDF_LIMIT} 回まで。プレミアムで無制限。
        </p>
      </div>
      {msg && <div className="text-sm text-red-600 sm:col-span-2">{msg}</div>}
    </div>
  );
}

function renderHtml(o: {
  rows: Row[]; direction: Direction; format: Format; columns: Columns; answerMode: AnswerMode; title: string;
  qrDataUrl: string | null;
}) {
  const { rows, direction, format, columns, answerMode, title, qrDataUrl } = o;
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

  const olClass = columns === 2 ? "cols2" : "";

  const css = `
    @page { size: A4; margin: 16mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Hiragino Sans','Noto Sans JP', sans-serif; color:#111e38; margin:0; }
    h1 { font-size: 15pt; margin: 0 0 4mm; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 6mm; gap: 6mm; }
    .head .info { display:flex; gap: 4mm; flex-shrink:0; }
    .info-box { border:1px solid #243860; border-radius: 2px; padding: 1.5mm 4mm; font-size: 10pt; white-space:nowrap; }
    .meta { font-size: 9.5pt; color:#476394; margin: 0 0 6mm; }
    ol { margin: 0; padding-left: 8mm; }
    ol.cols2 { column-count: 2; column-gap: 10mm; }
    li { font-size: 11pt; margin-bottom: 5mm; line-height: 1.6; break-inside: avoid; -webkit-column-break-inside: avoid; page-break-inside: avoid; }
    .prompt { font-weight: 500; }
    .ans-line { display:inline-block; min-width: 45mm; border-bottom: 1px solid #243860; margin-left: 3mm; }
    .choices { display:flex; flex-wrap:wrap; gap: 5mm; font-size:10pt; margin-top:1.5mm; }
    .sheet { }
    .answer-sheet { page-break-before: always; }
    .answers-title { font-size: 13pt; margin: 0 0 4mm; border-bottom: 2px solid #243860; padding-bottom: 2mm; }
    .answers.inline { margin-top: 10mm; border-top: 1px dashed #6b87b3; padding-top: 5mm; }
    .answers.inline h2 { font-size: 12pt; margin: 0 0 3mm; }
    ol.answers-list { padding-left: 8mm; }
    ol.answers-list.cols2 { column-count: 2; column-gap: 10mm; }
    ol.answers-list li { font-size: 10pt; margin-bottom: 1.5mm; line-height: 1.5; }
    @media print { .answer-sheet { page-break-before: always; } }
    .lv-footer { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #d8dfec; display: flex; align-items: center; gap: 3mm; break-inside: avoid; page-break-inside: avoid; }
    .lv-footer img { width: 14mm; height: 14mm; flex-shrink: 0; }
    .lv-footer .lv-text { font-size: 7.5pt; color: #8092b0; line-height: 1.4; }
  `;

  const footerHtml = qrDataUrl
    ? `<div class="lv-footer">
        <img src="${qrDataUrl}" alt="Loop Vocabulary QRコード" />
        <span class="lv-text">作成：Loop Vocabulary（英単語小テストを作成できます）<br/>https://loop-vocabulary.app</span>
      </div>`
    : `<div class="lv-footer"><span class="lv-text">作成：Loop Vocabulary（英単語小テストを作成できます）— https://loop-vocabulary.app</span></div>`;

  const qhtml = items.map((q) => {
    const choicesHtml = q.choices
      ? `<div class="choices">${q.choices.map((c, idx) => `<span>${["ア","イ","ウ","エ"][idx]}. ${escape(c)}</span>`).join("")}</div>`
      : `<span class="ans-line">&nbsp;</span>`;
    return `<li><span class="prompt">${escape(q.prompt)}</span> ${choicesHtml}</li>`;
  }).join("");

  const dirLabel = direction === "en2ja" ? "英 → 日" : "日 → 英";
  const fmtLabel = format === "choice" ? "4 択" : "記述";

  const answersListHtml = `<ol class="answers-list ${olClass}">${items.map((q) => `<li>${escape(q.answer)}</li>`).join("")}</ol>`;

  // 解答の配置: none=なし / inline=同ページ末尾 / separate=別ページ(解答用紙)
  let answersHtml = "";
  if (answerMode === "inline") {
    answersHtml = `<div class="answers inline"><h2>解答</h2>${answersListHtml}</div>`;
  } else if (answerMode === "separate") {
    answersHtml = `<section class="answer-sheet">
      <h1>${escape(title)} 小テスト <span style="font-size:11pt;color:#476394;">— 解答用紙</span></h1>
      <div class="meta">出題方向: ${dirLabel} / 形式: ${fmtLabel} / 全 ${items.length} 問</div>
      ${answersListHtml}
    </section>`;
  }

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${escape(title)} 小テスト</title>
<style>${css}</style></head><body>
<section class="sheet">
  <div class="head">
    <h1>${escape(title)} 小テスト</h1>
    <div class="info">
      <span class="info-box">氏名: ______________</span>
      <span class="info-box">日付: ___/___</span>
      <span class="info-box">得点: ____ / ${items.length}</span>
    </div>
  </div>
  <div class="meta">出題方向: ${dirLabel} / 形式: ${fmtLabel} / 全 ${items.length} 問</div>
  <ol class="${olClass}">${qhtml}</ol>
  ${answerMode === "inline" ? answersHtml : ""}
  ${footerHtml}
</section>
${answerMode === "separate" ? answersHtml : ""}
</body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
