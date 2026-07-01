"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SrsModeToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function update(val: boolean) {
    setOn(val);
    setSaving(true);
    await fetch("/api/settings/srs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ srs_v2: val }),
    }).catch(() => {});
    setSaving(false);
    router.refresh();
  }

  return (
    <div className={saving ? "opacity-60 pointer-events-none" : ""}>
      <div className="flex items-center justify-between gap-3 py-1">
        <div>
          <p className="text-sm font-semibold text-navy-800">動的復習アルゴリズム（β）</p>
          <p className="text-[11px] text-navy-400 mt-0.5">
            復習カードで「もう一度／難しい／普通／簡単」の4段階評価を使い、
            覚え具合に応じて次の復習間隔を自動調整します。オフにすると従来の方式に戻ります。
          </p>
        </div>
        <button
          data-testid="srs-v2-toggle"
          onClick={() => update(!on)}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-emerald-500" : "bg-navy-200"}`}
          aria-pressed={on}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
  );
}
