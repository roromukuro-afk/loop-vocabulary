"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function JoinConsentClient({ code, className }: { code: string; className: string }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const submittingRef = useRef(false);

  async function join() {
    if (!consent) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/teacher/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, consent: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok !== true) {
        // 5xxはAPIが生のDBエラーを返す経路があるため、そのまま表示せず一般化する。
        const message = res.status >= 500
          ? "参加に失敗しました。しばらくしてから再度お試しください"
          : (json.error ?? "参加に失敗しました");
        setErrorMessage(message);
        return;
      }
      setDone(true);
    } catch {
      setErrorMessage("参加に失敗しました。ネットワーク接続を確認してください");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  // 遷移タイマーはコンポーネントのライフサイクルに紐づけ、アンマウント時に
  // cleanupする(joinのローカル関数内に裸のsetTimeoutを置くと、先にアンマウント
  // された場合もタイマーが残り続ける)。
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [done, router]);

  const successMessage = done
    ? `「${className}」に参加しました。ダッシュボードへ移動します…`
    : "";

  return (
    <div className="mt-4">
      {/* role="status"はマウント前から存在するライブリージョンでないと確実に読み上げ
          られないため、常時マウント済みのsr-only領域を用意し、成功時にテキストだけを
          更新する。 */}
      <div
        data-testid="join-success-status"
        role="status"
        aria-live="polite"
        className={done
          ? "bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800"
          : "sr-only"}
      >
        {successMessage}
      </div>

      {!done && (
        <div aria-busy={busy}>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900">
            <p className="font-bold mb-1">共有される内容（先生が閲覧できる集計値）</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>学習日数・学習語数・正答率・苦手単語数・復習状況</li>
            </ul>
            <p className="mt-2 text-sky-800">
              あなたが登録した個々の単語や単語帳の中身は共有されません。
              同意は<b>設定画面からいつでも撤回</b>でき、撤回後は先生の一覧から外れます。
            </p>
          </div>

          <label className="flex items-start gap-2 mt-3 text-sm text-navy-700">
            <input
              data-testid="join-consent-checkbox"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy}
              className="mt-0.5"
            />
            <span>上記の学習状況（集計値）を担当の先生と共有することに同意します。</span>
          </label>

          <div className="mt-4">
            <Button data-testid="join-submit" onClick={join} disabled={!consent || busy} size="lg" fullWidth>
              {busy ? "参加中..." : "同意してクラスに参加"}
            </Button>
          </div>
          {errorMessage && <p role="alert" className="text-sm text-red-600 mt-2">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
