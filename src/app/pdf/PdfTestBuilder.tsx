"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { sample } from "@/lib/utils/shuffle";
import { createClient } from "@/lib/supabase/client";
import { UpsellModal } from "@/components/premium/UpsellModal";
import { trackFeatureUsed, trackPdfGenerateStart, trackPdfGenerateComplete } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { todayStartJstISO } from "@/lib/utils/date";
import type { AnswerMode, Columns, Direction, Format, Row } from "@/lib/vocabTest/types";
import { renderTestHtml } from "@/lib/vocabTest/renderTestHtml";

// PDF小テストの配布先（生徒・保護者）がオフラインから流入できるようにするための
// QRコード遷移先。個人情報・生徒名・学校名・単語帳の内容は一切含めない、
// 固定の公開URLのみを埋め込む。
// utm_* はGA4が着地ページ読み込み時に自動検出するため、QR側の追加実装は不要
const PDF_QR_TARGET_URL = "https://loop-vocabulary.app/vocab-check?utm_source=pdf_qr&utm_medium=offline&utm_campaign=teacher_pdf";

const FREE_PDF_LIMIT = 3;

type SourceKind = "book" | "material";
type Filter = "all" | "weak" | "new";

type BookOption = { id: string; title: string; source_type?: string | null; source_material_id?: string | null };
type MaterialOption = { id: string; title: string; publisher?: string | null; author?: string | null };

export function PdfTestBuilder({
  books, materials, initialBookId,
}: { books: BookOption[]; materials: MaterialOption[]; initialBookId?: string | null }) {
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
    trackPdfGenerateStart();
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
      // 出典表示: 教材を直接選んだ場合、または教材インポート由来の単語帳を選んだ場合に、
      // 元教材の publisher/author を「出典: 〇〇」として印刷物に明記する（著作権対応）。
      const sourceMaterial =
        src === "material"
          ? materials.find((m) => m.id === sourceId)
          : (() => {
              const b = books.find((bk) => bk.id === sourceId);
              if (!b || b.source_type !== "material" || !b.source_material_id) return undefined;
              return materials.find((m) => m.id === b.source_material_id);
            })();
      const attribution = sourceMaterial
        ? [sourceMaterial.publisher, sourceMaterial.author].filter(Boolean).join(" / ")
        : null;

      const html = renderTestHtml({
        rows, direction, format, columns, answerMode,
        title: src === "book"
          ? books.find((b) => b.id === sourceId)?.title ?? "小テスト"
          : materials.find((m) => m.id === sourceId)?.title ?? "小テスト",
        attribution,
        qrDataUrl,
      });
      const w = window.open("", "_blank");
      if (!w) { setMsg("ポップアップがブロックされました"); return; }
      w.document.write(html);
      w.document.close();
      trackPdfGenerateComplete(rows.length);
      trackEvent("pdf_generated", { question_count: rows.length });
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
