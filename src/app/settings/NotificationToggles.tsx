"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  weeklyEmail: boolean;
  pushEnabled: boolean;
}

const FALLBACK_MESSAGE = "通知設定を更新できませんでした。時間をおいてもう一度お試しください";

// bracket accessだとerror codeがconstructor/__proto__/toString等のprototype継承
// プロパティ名と一致した場合に文字列以外の値を拾ってしまうため、hasOwnPropertyで
// own propertyだけに限定する(inはprototype chainを含むため使わない)。
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "ログイン状態を確認して、もう一度お試しください",
  invalid_body: "入力内容を確認してください",
  update_failed: FALLBACK_MESSAGE,
};
function resolveErrorMessage(code: string | null): string {
  if (code && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code)) {
    return ERROR_MESSAGES[code];
  }
  return FALLBACK_MESSAGE;
}

type ApiResult = { ok: true } | { ok: false; code: string | null };

async function patchNotificationSetting(key: string, value: boolean): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  } catch {
    return { ok: false, code: null };
  }
  const json: unknown = await res.json().catch(() => null);
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!res.ok) {
    const code = body && typeof body.error === "string" ? body.error : null;
    return { ok: false, code };
  }
  if (!body || body.ok !== true) {
    return { ok: false, code: null };
  }
  return { ok: true };
}

function Toggle({
  value, onChange, label, desc, pending, testId,
}: {
  value: boolean; onChange: (v: boolean) => void; label: string; desc: string; pending: boolean; testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-navy-100 last:border-0" aria-busy={pending}>
      <div>
        <p className="text-sm font-semibold text-navy-800">{label}</p>
        <p className="text-[11px] text-navy-400 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={pending}
        aria-label={label}
        aria-pressed={value}
        data-testid={testId}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${value ? "bg-emerald-500" : "bg-navy-200"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

export function NotificationToggles({ weeklyEmail, pushEnabled }: Props) {
  const router = useRouter();
  const [weekly, setWeekly] = useState(weeklyEmail);
  const [push, setPush] = useState(pushEnabled);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  // weekly/pushそれぞれ独立したkeyで管理し、一方の保存中にもう一方を
  // 不必要にロックしない。
  const pendingRef = useRef<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  function beginAction(key: string): boolean {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    setStatusMessage(null);
    setErrorMessage(null);
    return true;
  }
  function endAction(key: string) {
    pendingRef.current.delete(key);
    setPending(new Set(pendingRef.current));
  }

  async function handleToggle(
    key: "weekly" | "push",
    apiKey: "notify_weekly_email" | "notify_push_enabled",
    nextValue: boolean,
    setLocal: (v: boolean) => void,
    successMessage: string,
  ) {
    if (!beginAction(key)) return;
    setLocal(nextValue); // optimistic更新。失敗時は下でnextValue反転前の値へ戻す。
    const result = await patchNotificationSetting(apiKey, nextValue);
    endAction(key);
    if (!result.ok) {
      setLocal(!nextValue);
      setErrorMessage(resolveErrorMessage(result.code));
      return;
    }
    setStatusMessage(successMessage);
    router.refresh();
  }

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        data-testid="notification-settings-status"
        className="mb-2 text-xs text-emerald-700 min-h-[1em]"
      >
        {statusMessage ?? ""}
      </p>
      {errorMessage && (
        <p role="alert" data-testid="notification-settings-alert" className="mb-2 text-xs text-red-600">
          {errorMessage}
        </p>
      )}
      <Toggle
        value={weekly}
        label="週次学習レポート（メール）"
        desc="毎週月曜日に先週の学習まとめをメールでお届け"
        pending={pending.has("weekly")}
        testId="notification-toggle-weekly"
        onChange={(v) => handleToggle("weekly", "notify_weekly_email", v, setWeekly, "週次学習レポートの設定を更新しました")}
      />
      <Toggle
        value={push}
        label="プッシュ通知"
        desc="復習がある日に毎朝9時に通知"
        pending={pending.has("push")}
        testId="notification-toggle-push"
        onChange={(v) => handleToggle("push", "notify_push_enabled", v, setPush, "プッシュ通知の設定を更新しました")}
      />
    </div>
  );
}
