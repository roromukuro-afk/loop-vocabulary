"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type PermState = "unsupported" | "denied" | "granted" | "default" | "loading";

export function PushPermission() {
  const [state, setState] = useState<PermState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PermState);
  }, []);

  async function subscribe() {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState("granted");
    } catch {
      setState("default");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  if (state === "granted") {
    return (
      <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-emerald-800">プッシュ通知 ON</p>
          <p className="text-[11px] text-emerald-600">毎朝9時に復習リマインダーが届きます</p>
        </div>
        <button
          onClick={unsubscribe}
          disabled={busy}
          className="text-[11px] text-emerald-700 underline disabled:opacity-50"
        >
          解除
        </button>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mt-4 bg-navy-50 border border-navy-100 rounded-2xl px-4 py-3">
        <p className="text-xs text-navy-500">通知がブロックされています。ブラウザの設定から許可してください。</p>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-sky-800">毎朝リマインダーを受け取る</p>
        <p className="text-[11px] text-sky-600">復習がある日だけ通知します</p>
      </div>
      <button
        onClick={subscribe}
        disabled={busy}
        className="shrink-0 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {busy ? "…" : "通知を許可"}
      </button>
    </div>
  );
}
