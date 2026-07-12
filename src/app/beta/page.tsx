import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/layout/AppShell";

export const metadata = {
  title: "ベータテスター募集 | Loop Vocabulary",
  description: "Loop Vocabulary Androidアプリのベータテスターを募集しています。無料でプレミアム機能を体験しながらアプリ改善に参加しよう。",
  // 募集人数「0/20名」等の表示が静的で陳腐化しやすい募集ページのためnoindex
  robots: { index: false, follow: true },
};

const BENEFITS = [
  { icon: "⚡", title: "プレミアム機能が無料", body: "テスト期間中、AI例文・PDF出力・広告非表示などプレミアム機能をすべて無料で使えます。" },
  { icon: "🎯", title: "あなたの意見が反映される", body: "フィードバックが直接アプリ改善に繋がります。欲しい機能を伝えてください。" },
  { icon: "🏆", title: "正式リリース後も特典あり", body: "ベータテスターには正式リリース後も1ヶ月間プレミアムを無料でプレゼントします。" },
  { icon: "📱", title: "最新機能を先行体験", body: "リリース前の新機能をいち早く試せます。" },
];

const TASKS = [
  "アプリをインストールして毎日10分程度使う（2週間）",
  "気になったバグや使いにくい点を報告する",
  "Google Playにレビューを投稿する（リリース後）",
];

const FAQ = [
  { q: "どんな端末が必要ですか？", a: "Android 8.0以上のスマートフォンまたはタブレット（iPhone版は現在準備中です）。" },
  { q: "費用はかかりますか？", a: "一切かかりません。むしろプレミアム機能を無料で使えます。" },
  { q: "どのくらいの時間が必要ですか？", a: "1日10分、2週間のテスト期間です。毎日でなくてもOKです。" },
  { q: "テスト後はどうなりますか？", a: "正式版リリース後、1ヶ月間プレミアムを無料でご利用いただけます。" },
];

export default function BetaPage() {
  return (
    <AppShell>
      {/* ヒーロー */}
      <div className="text-center py-6">
        <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
          📱 Android ベータ版 先行テスト
        </span>
        <h1 className="text-2xl font-extrabold text-navy-900 leading-tight">
          ベータテスター<br />募集中！
        </h1>
        <p className="mt-3 text-sm text-navy-600 leading-relaxed">
          Loop Vocabulary の Android アプリを正式リリース前に<br />
          体験して、改善に参加しませんか？
        </p>
        <div className="mt-5">
          <a
            href="https://docs.google.com/forms/d/e/1laIIMFgCjEaW64UmmONH_KVX5MykDP8Sg4Wv2z4gNDI/viewform"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="lg" className="w-full max-w-xs">
              テスターに応募する（無料）→
            </Button>
          </a>
        </div>
        <p className="mt-2 text-xs text-navy-400">現在 0 / 20名 募集中</p>
      </div>

      {/* 特典 */}
      <div className="mt-6">
        <h2 className="text-base font-bold text-navy-800 mb-3">テスターの特典</h2>
        <div className="space-y-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-3 bg-white border border-navy-100 rounded-2xl p-4 shadow-sm">
              <div className="text-2xl shrink-0">{b.icon}</div>
              <div>
                <div className="font-bold text-navy-800 text-sm">{b.title}</div>
                <div className="text-xs text-navy-600 mt-0.5 leading-relaxed">{b.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* やること */}
      <div className="mt-6 bg-navy-50 rounded-2xl p-4">
        <h2 className="text-base font-bold text-navy-800 mb-3">テスターにお願いすること</h2>
        <ul className="space-y-2">
          {TASKS.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-navy-700">
              <span className="text-sky-500 font-bold shrink-0 mt-0.5">{i + 1}.</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* 応募フロー */}
      <div className="mt-6">
        <h2 className="text-base font-bold text-navy-800 mb-3">参加の流れ</h2>
        <div className="space-y-0">
          {[
            { step: "01", title: "フォームで応募", body: "メールアドレスと使用端末を送信" },
            { step: "02", title: "招待メールが届く", body: "Google Play のテスター招待リンクをお送りします" },
            { step: "03", title: "インストール", body: "リンクからアプリをインストールして使い始めよう" },
            { step: "04", title: "フィードバック", body: "使った感想・バグをフォームやメールで教えてください" },
          ].map((s, i) => (
            <div key={s.step} className="flex gap-4 pb-5 relative">
              {i < 3 && <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-navy-100" />}
              <div className="w-10 h-10 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                {s.step}
              </div>
              <div className="pt-1.5">
                <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                <div className="text-xs text-navy-500 mt-0.5">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-4">
        <h2 className="text-base font-bold text-navy-800 mb-3">よくある質問</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
              <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
              <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 bg-gradient-to-r from-navy-800 to-navy-950 rounded-2xl p-6 text-center text-white">
        <div className="text-2xl mb-2">🚀</div>
        <div className="font-extrabold text-base">一緒にアプリを育てよう</div>
        <p className="text-xs text-navy-300 mt-1 mb-4">正式リリースを一緒に作り上げましょう</p>
        <a
          href="https://docs.google.com/forms/d/e/1laIIMFgCjEaW64UmmONH_KVX5MykDP8Sg4Wv2z4gNDI/viewform"
          target="_blank"
          rel="noreferrer"
        >
          <Button size="lg" className="bg-sky-500 hover:bg-sky-400 text-white w-full">
            今すぐ応募する →
          </Button>
        </a>
        <p className="mt-3 text-[11px] text-navy-400">
          質問は <a href="mailto:roromukuro@gmail.com" className="underline">roromukuro@gmail.com</a> まで
        </p>
      </div>

      <div className="mt-4 text-center">
        <Link href="/dashboard" className="text-xs text-navy-500 hover:underline">← ダッシュボードへ戻る</Link>
      </div>
    </AppShell>
  );
}
