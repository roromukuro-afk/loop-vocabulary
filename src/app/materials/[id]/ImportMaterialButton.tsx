"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { trackMaterialImported } from "@/lib/analytics/events";
import { checkActivationAfterSession } from "@/lib/analytics/activation";

export function ImportMaterialButton({
  materialId,
  examType,
  alreadyImported,
  importedBookId,
}: {
  materialId: string;
  examType: string;
  alreadyImported: boolean;
  importedBookId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(importedBookId);
  const [wasAlready, setWasAlready] = useState(alreadyImported);
  const [justImportedCount, setJustImportedCount] = useState<number | null>(null);

  const run = async () => {
    setBusy(true);
    setErrorMsg(null);
    const res = await fetch(`/api/material/${materialId}/import`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErrorMsg("インポートに失敗しました: " + (json.error ?? res.status));
      return;
    }
    setBookId(json.bookId);
    if (json.alreadyImported) {
      setWasAlready(true);
    } else {
      trackMaterialImported(examType, json.count ?? 0);
      setJustImportedCount(json.count ?? 0);
      void checkActivationAfterSession();
    }
    router.refresh();
  };

  // インポート済み（今回インポートした場合・以前から済んでいた場合の両方）:
  // 単語帳詳細（学習モード選択）をメインCTAに、4択・PDFをサブCTAとして次の行動へ進める
  if (bookId) {
    return (
      <div data-testid={wasAlready ? "material-already-imported" : "material-import-success"}>
        {justImportedCount !== null && (
          <div className="mb-2 text-sm text-emerald-600 font-medium text-center" data-testid="material-import-message">
            {justImportedCount} 語をインポートしました！
          </div>
        )}
        {wasAlready && justImportedCount === null && (
          <div className="mb-2 text-xs text-navy-500 text-center" data-testid="material-already-imported-note">
            この教材はすでに単語帳にインポート済みです
          </div>
        )}
        <Button
          fullWidth
          size="lg"
          data-testid="material-open-wordbook"
          onClick={() => router.push(`/wordbooks/${bookId}`)}
        >
          📖 単語帳で学習モードを選ぶ
        </Button>
        <div className="mt-2 flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            data-testid="material-start-choice"
            onClick={() => router.push(`/test/choice?book=${bookId}`)}
          >
            🎯 4択で始める
          </Button>
          <Button
            variant="secondary"
            fullWidth
            data-testid="material-start-pdf"
            onClick={() => router.push(`/pdf?book=${bookId}`)}
          >
            📄 PDFテストを作る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={run} disabled={busy} size="lg" fullWidth data-testid="material-import-button">
        {busy ? "インポート中..." : "自分の単語帳にインポート"}
      </Button>
      {errorMsg && (
        <div className="mt-2 text-sm text-red-600 font-medium text-center" data-testid="material-import-error">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
