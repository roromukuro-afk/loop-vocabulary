"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  weeklyEmail: boolean;
  pushEnabled: boolean;
}

const FALLBACK_MESSAGE = "通知設定を更新できませんでした。時間をおいてもう一度お試しください";
// 曖昧な失敗の後、再同期用GETも失敗し実際の状態を確認できなかった場合の
// メッセージ。反転で決め打ちしないため(下記handleToggle参照)、他の失敗
// メッセージと区別して状態未確認である旨を明示する。
const UNRESOLVED_MESSAGE = "設定を反映できたか確認できませんでした。画面を再読み込みしてご確認ください";

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

// ambiguous: サーバーへ実際に反映されたかどうかクライアント側で判別できない
// 失敗(network例外・応答本文が読めない等)。この場合は楽観的更新を無条件で
// 反転せず、GET /api/settings/notificationsで実際の現在値へ再同期する
// (Codexレビュー指摘 P2: 反転で決め打ちすると、実際にはDBへ反映されているのに
// UIだけが古い値へ戻ってしまう恐れがある)。
//
// 「確定的(ambiguous:false)」とみなすのは、自分のAPIが返す既知のerror code
// (ERROR_MESSAGESに列挙された値)を含む応答が返った場合だけに限定する。
// Vercel等のプロキシが返す502/504のようなgateway応答は、origin側で実際に
// commitが完了した後にレスポンスが失われて発生することがあり、その場合も
// 「サーバーが明確に拒否した」わけではないため、確定的失敗として扱っては
// ならない(Codexレビュー指摘 P2)。
type ApiResult = { ok: true } | { ok: false; code: string | null; ambiguous: boolean };

function isKnownErrorCode(code: string | null): boolean {
  return code !== null && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

async function patchNotificationSetting(key: string, value: boolean): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  } catch {
    return { ok: false, code: null, ambiguous: true };
  }
  const json: unknown = await res.json().catch(() => null);
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!res.ok) {
    const code = body && typeof body.error === "string" ? body.error : null;
    // 既知のerror codeを含む応答だけを「自分のAPIが明確に拒否した」ものとして
    // 確定的失敗とみなす。それ以外(gatewayエラー・未知のcode等)はambiguous。
    return { ok: false, code, ambiguous: !isKnownErrorCode(code) };
  }
  if (!body || body.ok !== true) {
    // HTTP 2xxだが応答本文が想定外(壊れている)。サーバーがどこまで処理を
    // 終えたか確定できないため、曖昧な失敗として扱う。
    return { ok: false, code: null, ambiguous: true };
  }
  return { ok: true };
}

// 曖昧な失敗の後、実際の現在値をサーバーから再取得する。取得自体にも
// 失敗した場合はnullを返し、呼び出し側が安全側(反転前の値)へフォールバックする。
async function fetchAuthoritativeValue(apiKey: "notify_weekly_email" | "notify_push_enabled"): Promise<boolean | null> {
  try {
    const res = await fetch("/api/settings/notifications");
    if (!res.ok) return null;
    const json: unknown = await res.json().catch(() => null);
    if (!json || typeof json !== "object") return null;
    const value = (json as Record<string, unknown>)[apiKey];
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
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
    setLocal(nextValue); // optimistic更新。失敗時は下で反転前の値(または実際の現在値)へ戻す。
    const result = await patchNotificationSetting(apiKey, nextValue);
    if (!result.ok) {
      let unresolved = false;
      if (result.ambiguous) {
        // サーバーへ実際に反映されたか不明なため、反転で決め打ちせず
        // 現在の実際の値を再取得して画面へ反映する。
        const reconciled = await fetchAuthoritativeValue(apiKey);
        if (reconciled !== null) {
          setLocal(reconciled);
        } else {
          // 再同期用GETも失敗し、実際の状態を確認できなかった
          // (Codexレビュー指摘 P2)。ここで反転で決め打ちすると、実際には
          // サーバーへ反映済みなのに画面だけ反転して見えてしまう恐れがある
          // (例: ONへ変更したのに画面上OFFに戻り、ユーザーは通知が
          // 無効だと誤認するが実際は有効なまま、というケース)。そのため
          // 直前の楽観的更新の値(nextValue)を維持したまま、状態を確認
          // できなかった旨を明示するメッセージへ切り替える。
          unresolved = true;
        }
      } else {
        // サーバーが明確に更新を適用しなかったことが確定しているため、
        // 反転前の値へ戻して問題ない。
        setLocal(!nextValue);
      }
      endAction(key);
      setErrorMessage(unresolved ? UNRESOLVED_MESSAGE : resolveErrorMessage(result.code));
      return;
    }
    endAction(key);
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
