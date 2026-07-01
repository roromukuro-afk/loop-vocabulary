"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * 単語帳0件のユーザーがダッシュボードを開いたとき、
 * デフォルト単語帳を自動作成する（サーバ側で冪等・重複作成なし）。
 * 新規作成できたときだけ「作りました」案内を表示する。
 * 呼び出し側で hasWordbook=false のときのみマウントすること。
 */
export function EnsureDefaultWordbook() {
  const ran = useRef(false);
  const [created, setCreated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    fetch("/api/wordbook/ensure-default", { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (j?.created) setCreated(true); })
      .catch(() => {});
  }, []);

  if (!created || dismissed) return null;

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-emerald-800">
            最初の単語帳「マイ単語帳」を作成しました 🎉
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
            辞書で調べた単語をワンタップで追加できます。まずは1語追加してみましょう。
          </p>
          <Link
            href="/dictionary"
            className="mt-2 inline-block text-xs font-bold rounded-lg px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            🔍 辞書で単語を追加
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-emerald-400 hover:text-emerald-600 text-lg leading-none"
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}
