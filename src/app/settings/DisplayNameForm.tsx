"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DisplayNameForm({ current }: { current: string | null }) {
  const [name, setName] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  const savingRef = useRef(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setStatusMessage(null);
    setErrorMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed.slice(0, 30) }),
      });
      let ok = false;
      try {
        const json = await res.json();
        ok = res.ok && json?.ok === true;
      } catch {
        ok = false;
      }
      if (ok) {
        setStatusMessage("更新しました！");
        router.refresh();
      } else {
        // APIが返すエラー文言(生のDBエラーの可能性がある)をそのまま表示せず、
        // 常に一般化したメッセージのみを表示する。
        setErrorMessage("更新に失敗しました");
      }
    } catch {
      setErrorMessage("更新に失敗しました。ネットワーク接続を確認してください");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-3" aria-busy={busy}>
      <label htmlFor="display-name-input" className="block text-xs text-navy-500 mb-1">表示名（ランキングに表示）</label>
      <div className="flex gap-2">
        <input
          id="display-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="例: 英単語勉強中🌸"
          className="flex-1 border border-navy-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          onClick={save}
          disabled={busy || !name.trim()}
          className="px-3 py-1.5 rounded-xl bg-navy-800 text-white text-xs font-bold disabled:opacity-50 hover:bg-navy-700 transition-colors"
        >
          {busy ? "…" : "保存"}
        </button>
      </div>
      {/* role="status"はマウント前から存在するライブリージョンでないと確実に読み上げ
          られないため、常時マウント済みのsr-only領域を用意する。role="alert"は
          事前マウント不要のため、可視のエラー要素自体に直接付ける。 */}
      <div role="status" className={statusMessage ? "text-xs mt-1 text-emerald-700" : "sr-only"}>
        {statusMessage ?? ""}
      </div>
      {errorMessage && <p role="alert" className="text-xs mt-1 text-red-600">{errorMessage}</p>}
      <p className="text-[11px] text-navy-400 mt-1">最大 30 文字。週間ランキングに表示されます。</p>
    </div>
  );
}
