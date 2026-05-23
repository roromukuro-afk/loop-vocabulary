"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";

// ============================================================
// アカウント削除リクエスト UI
// ------------------------------------------------------------
// /settings 内と /account/delete (専用ページ) の両方から利用される
// 共通パネル。チェックボックス → 確認ダイアログ → API 送信、の
// 三段階を踏んで誤操作を防ぐ。
// ============================================================

type Existing = {
  id: string;
  status: "pending" | "processing" | "completed" | "rejected";
  requested_at: string;
  completed_at: string | null;
} | null;

const STATUS_LABEL: Record<NonNullable<Existing>["status"], string> = {
  pending:    "受付済 (処理待ち)",
  processing: "処理中",
  completed:  "削除完了",
  rejected:   "却下",
};

export function DeleteAccountPanel({ supportEmail }: { supportEmail: string }) {
  const [existing, setExisting] = useState<Existing | "loading" | "error">("loading");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/delete-request");
        if (!res.ok) { setExisting("error"); return; }
        const json = await res.json();
        setExisting(json.request ?? null);
      } catch {
        setExisting("error");
      }
    })();
  }, []);

  const canSubmit =
    confirmed && confirmText.trim() === "削除する" && !busy && existing === null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "リクエスト送信に失敗しました"); return; }
      setDoneMessage(json.message ?? "削除リクエストを受け付けました");
      setExisting({
        id: json.request_id ?? "",
        status: "pending",
        requested_at: json.requested_at ?? new Date().toISOString(),
        completed_at: null,
      });
    } finally {
      setBusy(false);
    }
  };

  if (existing === "loading") {
    return <div className="text-sm text-navy-500">読み込み中...</div>;
  }

  if (existing && existing !== "error") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="font-semibold text-amber-800">削除リクエスト: {STATUS_LABEL[existing.status]}</div>
        <div className="text-xs text-amber-700 mt-1">
          受付日時: {new Date(existing.requested_at).toLocaleString("ja-JP")}
        </div>
        {existing.completed_at && (
          <div className="text-xs text-amber-700">
            完了日時: {new Date(existing.completed_at).toLocaleString("ja-JP")}
          </div>
        )}
        <div className="text-xs text-amber-700 mt-2">
          処理についてのお問い合わせは <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> まで。
        </div>
      </div>
    );
  }

  if (doneMessage) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {doneMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <div className="font-bold mb-1">⚠ アカウント削除について</div>
        <ul className="list-disc pl-5 space-y-0.5 text-red-700">
          <li>登録した <b>単語帳・単語・学習履歴・AI 利用履歴・チケット・設定</b> がすべて削除対象になります</li>
          <li>削除されたデータは原則として <b>復元できません</b></li>
          <li>法令上の保持義務があるログは一定期間サーバ側で保管されますが、ユーザー画面からは参照できなくなります</li>
          <li>処理完了までに数営業日かかる場合があります</li>
          <li>削除完了前であれば、<a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a> へご連絡いただくことでキャンセル可能です</li>
        </ul>
      </div>

      <Field label="削除理由 (任意・サービス改善の参考にします)">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例: 別アプリに乗り換える / 機能が足りない / 学習を一区切りにする 等"
          rows={3}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-navy-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          上記の説明をすべて読み、データが復元できなくなる可能性があることを理解しました
        </span>
      </label>

      <Field label="確認のため、下のテキスト欄に「削除する」と入力してください">
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="削除する"
          className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-base"
        />
      </Field>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <Button
        variant="danger"
        fullWidth
        size="lg"
        disabled={!canSubmit}
        onClick={() => {
          if (window.confirm("本当にアカウント削除をリクエストしますか? この操作は元に戻せません。")) {
            void submit();
          }
        }}
      >
        {busy ? "送信中..." : "アカウント削除をリクエストする"}
      </Button>
    </div>
  );
}
