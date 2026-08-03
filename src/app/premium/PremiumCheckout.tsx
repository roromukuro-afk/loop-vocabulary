"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { trackCheckoutStart } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";

type Props =
  | { action: "checkout"; stripeReady: boolean; loggedIn: boolean }
  | { action: "portal" };

// リダイレクト先として安全なURLだけを許可する。javascript:/data: 等の危険なschemeや、
// 空文字・型不正・不正なURL文字列はすべて拒否する。本番Stripe URLはHTTPSだが、
// ローカルE2Eの安全な同一サイト遷移にHTTPを使えるようhttp:も許可する。
function parseRedirectUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

type ApiResult = { ok: true; url: string } | { ok: false; code: string | null };

// checkout/portal共通のfetch+解析ヘルパー。network例外・非JSON応答・HTTP非2xx・
// bodyがobjectでない・url欠如/型不正のいずれも、生のエラー内容を漏らさず
// 呼び出し側へ「成功URL」か「(あれば)既知のerror code」だけを返す。
async function callStripeApi(path: string, requestBody?: Record<string, unknown>): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
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
  const url = parseRedirectUrl(body?.url);
  if (!url) {
    return { ok: false, code: null };
  }
  return { ok: true, url };
}

const COMMON_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "ログイン状態を確認して、もう一度お試しください",
  stripe_not_configured: "決済機能は現在利用できません",
  price_not_configured: "決済機能は現在利用できません",
};
const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  already_premium: "すでにプレミアム会員です",
};
const PORTAL_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  no_subscription: "管理できるサブスクリプションが見つかりません",
};
const FALLBACK_MESSAGE = "決済ページを開けませんでした。時間をおいてもう一度お試しください";

export function PremiumCheckout(props: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const submittingRef = useRef(false);

  const startCheckout = async (plan: "monthly" | "yearly") => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    setLoading(true);
    // analyticsの二重送信を避けるため、同期的refガードの後で呼ぶ。
    trackCheckoutStart(plan);
    trackEvent("checkout_started", { plan });

    const result = await callStripeApi("/api/stripe/checkout", { plan });
    if (!result.ok) {
      setErrorMessage((result.code && CHECKOUT_ERROR_MESSAGES[result.code]) ?? FALLBACK_MESSAGE);
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    // 成功時はリダイレクト先へ移動する直前まで再操作可能へ戻さない(loading維持)。
    // window.location.assign自体が同期的にthrowした場合のみ、再操作可能へ戻す。
    let redirecting = false;
    try {
      redirecting = true;
      window.location.assign(result.url);
    } catch {
      redirecting = false;
      setErrorMessage(FALLBACK_MESSAGE);
    } finally {
      if (!redirecting) {
        submittingRef.current = false;
        setLoading(false);
      }
    }
  };

  const openPortal = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setErrorMessage(null);
    setLoading(true);

    const result = await callStripeApi("/api/stripe/portal");
    if (!result.ok) {
      setErrorMessage((result.code && PORTAL_ERROR_MESSAGES[result.code]) ?? FALLBACK_MESSAGE);
      submittingRef.current = false;
      setLoading(false);
      return;
    }

    let redirecting = false;
    try {
      redirecting = true;
      window.location.assign(result.url);
    } catch {
      redirecting = false;
      setErrorMessage(FALLBACK_MESSAGE);
    } finally {
      if (!redirecting) {
        submittingRef.current = false;
        setLoading(false);
      }
    }
  };

  if (props.action === "portal") {
    return (
      <div aria-busy={loading}>
        <button
          onClick={openPortal}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-xl border-2 border-navy-200 text-navy-700 text-sm font-bold hover:bg-navy-50 transition-colors disabled:opacity-60"
        >
          {loading ? "読み込み中…" : "サブスクリプションを管理"}
        </button>
        {errorMessage && (
          <p role="alert" className="mt-2 text-xs text-red-600 text-center">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  if (!props.loggedIn) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-navy-600">プレミアムに登録するにはログインが必要です</p>
        <Link
          href="/login?next=/premium"
          className="block w-full py-4 rounded-2xl bg-navy-800 text-white font-black text-base hover:bg-navy-700 transition-colors"
        >
          ログインして始める
        </Link>
      </div>
    );
  }

  if (!props.stripeReady) {
    return (
      <div className="text-center space-y-2 py-2">
        <div className="text-sm text-navy-600 font-semibold">決済機能は準備中です</div>
        <p className="text-xs text-navy-400">もうしばらくお待ちください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-busy={loading}>
      <button
        onClick={() => startCheckout("yearly")}
        disabled={loading}
        className="w-full py-5 rounded-2xl bg-navy-800 text-white font-black text-lg hover:bg-navy-700 active:scale-[0.98] transition-all disabled:opacity-60 relative"
      >
        <span className="absolute -top-2.5 right-4 text-[10px] px-2.5 py-0.5 bg-emerald-500 text-white rounded-full font-bold">
          34% OFF
        </span>
        年間プラン ¥3,800/年
        <div className="text-xs font-normal text-white/70 mt-0.5">¥317/月 相当</div>
      </button>
      <button
        onClick={() => startCheckout("monthly")}
        disabled={loading}
        className="w-full py-4 rounded-2xl border-2 border-navy-200 text-navy-700 font-bold text-base hover:bg-navy-50 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        月額プラン ¥480/月
      </button>
      {errorMessage && (
        <p role="alert" className="text-xs text-red-600 text-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
