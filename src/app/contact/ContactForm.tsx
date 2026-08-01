"use client";

import { useState } from "react";

const TOPICS = [
  "ログイン・認証の不具合",
  "アカウント削除・データ削除",
  "学習データの不具合",
  "著作権に関するお問い合わせ",
  "広告に関するお問い合わせ",
  "バグ報告",
  "機能リクエスト",
  "塾・学校での利用",
  "その他",
];

// 通知は成功用のstatusMessageとエラー用のerrorMessageに分離している。
// 送信成功時は完了画面(done)へ切り替わるため、role="status"は常時
// マウント済みのsr-only領域を1つ用意し、form/done両方の状態を跨いで
// 共有できるようコンポーネント全体をFragmentで包んでいる。role="alert"は
// 事前マウント不要のため、可視のエラー要素自体に直接付ける。
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      let json: { ok?: boolean; error?: string };
      try {
        json = await res.json();
      } catch {
        throw new Error("サーバーからの応答を読み取れませんでした。時間をおいて再度お試しください");
      }
      if (!res.ok || !json.ok) {
        setErrorMessage(json.error ?? "送信に失敗しました");
        return;
      }
      setStatusMessage("お問い合わせを受け付けました");
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "送信に失敗しました。ネットワーク接続を確認してください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div role="status" className="sr-only">{statusMessage ?? ""}</div>

      {done ? (
        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="font-bold text-emerald-800">お問い合わせを受け付けました</p>
          <p className="text-sm text-emerald-600 mt-1">2〜3営業日以内にご返信します。自動返信メールもご確認ください。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-busy={busy}>
          <div>
            <label htmlFor="contact-name" className="block text-xs font-bold text-navy-700 mb-1">お名前（任意）</label>
            <input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-xs font-bold text-navy-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
          <div>
            <label htmlFor="contact-topic" className="block text-xs font-bold text-navy-700 mb-1">お問い合わせ種別</label>
            <select
              id="contact-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">選択してください</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="contact-message" className="block text-xs font-bold text-navy-700 mb-1">内容 <span className="text-red-500">*</span></label>
            <textarea
              id="contact-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="お問い合わせ内容をご記入ください"
              className="w-full border border-navy-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
            />
          </div>
          {errorMessage && <p role="alert" className="text-sm text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            {busy ? "送信中…" : "送信する"}
          </button>
          <p className="text-[11px] text-navy-400 text-center">送信後、入力したメールアドレスに自動返信が届きます。</p>
        </form>
      )}
    </>
  );
}
