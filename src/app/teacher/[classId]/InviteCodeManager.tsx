"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Status = "ok" | "expired" | "revoked";

function fmtDateTime(s: string | null): string {
  if (!s) return "無期限";
  return new Date(s).toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function InviteCodeManager({
  classId,
  inviteCode,
  expiresAt,
  revokedAt,
  status,
}: {
  classId: string;
  inviteCode: string;
  expiresAt: string | null;
  revokedAt: string | null;
  status: Status;
}) {
  const [busy, setBusy] = useState<"reissue" | "revoke" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const submittingRef = useRef(false);

  async function run(action: "reissue" | "revoke") {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(action);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/teacher/invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        // 5xxはAPIが生のDBエラーを返す経路があるため、そのまま表示せず一般化する。
        const message = res.status >= 500
          ? "操作に失敗しました。しばらくしてから再度お試しください"
          : (json.error ?? "操作に失敗しました");
        setErrorMessage(message);
        return;
      }
      setStatusMessage(action === "reissue" ? "招待コードを再発行しました" : "招待コードを無効化しました");
      router.refresh();
    } catch {
      setErrorMessage("操作に失敗しました。ネットワーク接続を確認してください");
    } finally {
      submittingRef.current = false;
      setBusy(null);
    }
  }

  const statusLabel = { ok: "有効", expired: "期限切れ", revoked: "無効化済み" }[status];
  const statusColor = { ok: "text-emerald-600", expired: "text-amber-600", revoked: "text-red-600" }[status];

  return (
    <div className="mt-1" data-testid="invite-code-manager" aria-busy={busy !== null}>
      <div className="text-[11px] text-navy-400">
        招待コード:{" "}
        <span className="font-mono font-bold text-navy-700 tracking-wider" data-testid="invite-code-value">
          {inviteCode}
        </span>
        <span className="ml-2">
          状態: <span className={`font-bold ${statusColor}`} data-testid="invite-code-status">{statusLabel}</span>
        </span>
        <span className="ml-2">有効期限: {fmtDateTime(expiresAt)}</span>
        {revokedAt && <span className="ml-2">無効化日時: {fmtDateTime(revokedAt)}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          data-testid="invite-code-reissue"
          size="sm"
          variant="secondary"
          onClick={() => run("reissue")}
          disabled={busy !== null}
        >
          {busy === "reissue" ? "再発行中..." : "コードを再発行"}
        </Button>
        <Button
          data-testid="invite-code-revoke"
          size="sm"
          variant="danger"
          onClick={() => run("revoke")}
          disabled={busy !== null || status === "revoked"}
        >
          {busy === "revoke" ? "無効化中..." : "コードを無効化"}
        </Button>
      </div>
      <div role="status" className={statusMessage ? "text-sm mt-2 text-emerald-700" : "sr-only"}>
        {statusMessage ?? ""}
      </div>
      {errorMessage && <p role="alert" className="text-sm text-red-600 mt-2">{errorMessage}</p>}
      <p className="text-[10px] text-navy-400 mt-1">
        再発行すると古いコードは即座に使えなくなります。無効化すると新しいコードを再発行するまで誰も参加できません。
      </p>
    </div>
  );
}
