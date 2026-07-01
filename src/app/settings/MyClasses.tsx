"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Membership = {
  class_id: string;
  class_name: string;
  teacher_name: string;
  consent: boolean;
  status: string;
};

export function MyClasses({ memberships }: { memberships: Membership[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function act(classId: string, action: "revoke" | "reconsent" | "leave") {
    setBusyId(classId);
    await fetch("/api/teacher/membership", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, action }),
    }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  const active = memberships.filter((m) => m.status === "active");
  if (active.length === 0) {
    return <p className="text-sm text-navy-500">参加中のクラスはありません。</p>;
  }

  return (
    <ul className="divide-y divide-navy-100">
      {active.map((m) => (
        <li key={m.class_id} data-testid="my-class-row" data-class={m.class_name} className="py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-navy-800 text-sm">{m.class_name}</div>
              <div className="text-[11px] text-navy-400">担当: {m.teacher_name} 先生</div>
            </div>
            <span
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                m.consent ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-500"
              }`}
            >
              {m.consent ? "共有中" : "共有停止中"}
            </span>
          </div>
          <div className={`mt-2 flex gap-2 ${busyId === m.class_id ? "opacity-60 pointer-events-none" : ""}`}>
            {m.consent ? (
              <button
                data-testid="revoke-consent"
                onClick={() => act(m.class_id, "revoke")}
                className="text-xs font-bold text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50"
              >
                共有を停止（同意撤回）
              </button>
            ) : (
              <button
                data-testid="reconsent"
                onClick={() => act(m.class_id, "reconsent")}
                className="text-xs font-bold text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50"
              >
                共有を再開
              </button>
            )}
            <button
              data-testid="leave-class"
              onClick={() => act(m.class_id, "leave")}
              className="text-xs font-bold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
            >
              退出
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
