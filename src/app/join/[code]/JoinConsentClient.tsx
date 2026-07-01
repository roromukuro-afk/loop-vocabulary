"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function JoinConsentClient({ code, className }: { code: string; className: string }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function join() {
    if (!consent) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/teacher/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, consent: true }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "参加に失敗しました");
    }
  }

  if (done) {
    return (
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
        「{className}」に参加しました。ダッシュボードへ移動します…
      </div>
    );
  }

  return (
    <div className="mt-4">
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
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span>上記の学習状況（集計値）を担当の先生と共有することに同意します。</span>
      </label>

      <div className="mt-4">
        <Button onClick={join} disabled={!consent || busy} size="lg" fullWidth>
          {busy ? "参加中..." : "同意してクラスに参加"}
        </Button>
      </div>
      {msg && <p className="text-sm text-red-600 mt-2">{msg}</p>}
    </div>
  );
}
