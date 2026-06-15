"use client";

import { useState } from "react";

interface Props {
  weeklyEmail: boolean;
  pushEnabled: boolean;
}

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-navy-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-navy-800">{label}</p>
        <p className="text-[11px] text-navy-400 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-emerald-500" : "bg-navy-200"}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

export function NotificationToggles({ weeklyEmail, pushEnabled }: Props) {
  const [weekly, setWeekly] = useState(weeklyEmail);
  const [push, setPush] = useState(pushEnabled);
  const [saving, setSaving] = useState(false);

  async function update(key: "notify_weekly_email" | "notify_push_enabled", val: boolean) {
    setSaving(true);
    await fetch("/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: val }),
    });
    setSaving(false);
  }

  return (
    <div className={saving ? "opacity-60 pointer-events-none" : ""}>
      <Toggle
        value={weekly}
        label="週次学習レポート（メール）"
        desc="毎週月曜日に先週の学習まとめをメールでお届け"
        onChange={(v) => { setWeekly(v); update("notify_weekly_email", v); }}
      />
      <Toggle
        value={push}
        label="プッシュ通知"
        desc="復習がある日に毎朝9時に通知"
        onChange={(v) => { setPush(v); update("notify_push_enabled", v); }}
      />
    </div>
  );
}
