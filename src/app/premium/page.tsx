import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { PremiumCheckout } from "./PremiumCheckout";
import { PremiumTracker } from "./PremiumTracker";
import { PremiumStickyBar } from "@/components/premium/PremiumStickyBar";

export const metadata: Metadata = {
  title: "プレミアムプラン | Loop Vocabulary",
  description: "広告なし・AI無制限・CSV一括インポート・弱点分析・リスニングテスト。月額¥480から始める英単語学習のアップグレード。",
};

const COMPARISON = [
  { label: "単語帳・SRS復習",         free: "✓",       prem: "✓" },
  { label: "4択・入力テスト",          free: "✓",       prem: "✓" },
  { label: "AI解説（例文・語源）",     free: "5回/日",   prem: "∞ 無制限" },
  { label: "AI弱点分析レポート",       free: "—",        prem: "✓" },
  { label: "AIパーソナル学習プラン",   free: "—",        prem: "✓" },
  { label: "英文から単語自動抽出",     free: "—",        prem: "✓" },
  { label: "リスニングテスト",         free: "—",        prem: "✓" },
  { label: "タイピング練習",           free: "—",        prem: "✓" },
  { label: "CSV一括インポート",        free: "—",        prem: "✓" },
  { label: "統計データ書き出し",       free: "—",        prem: "✓" },
  { label: "小テストPDF出力",          free: "3回/日",   prem: "∞ 無制限" },
  { label: "広告表示",                 free: "あり",     prem: "完全なし" },
];

const FAQS = [
  { q: "いつでもキャンセルできますか？", a: "はい。Stripeのカスタマーポータルからいつでもキャンセルできます。キャンセル後も期間終了まで全機能が使えます。" },
  { q: "年間プランはいつでも解約できますか？", a: "年間プランも途中解約可能です。ただし残期間の日割り返金は対応しておりません。まずは月額プランでお試しください。" },
  { q: "支払い方法は何が使えますか？", a: "Visa・Mastercard・JCB・American Expressなどのクレジットカード・デビットカードに対応しています（Stripe安全決済）。" },
  { q: "無料プランで作った単語帳はどうなりますか？", a: "プレミアム登録後もすべてのデータ（単語帳・学習履歴・AI解説履歴）はそのまま引き継がれます。" },
  { q: "AIの使用量に制限はありますか？", a: "プレミアムプランではAI解説・弱点分析・学習プラン生成・英文抽出がすべて無制限で利用できます（過度な自動化利用を除く）。" },
];

export default async function PremiumPage() {
  if (!getSupabaseEnv().ok) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-navy-500">Supabase が未設定です。</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isPremium = false;
  let hasStripe = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    isPremium = profile?.is_premium ?? false;
    hasStripe = !!(profile as Record<string, unknown>)?.stripe_customer_id;
  }

  const stripeReady = !!(process.env.STRIPE_PRICE_ID_MONTHLY && process.env.STRIPE_SECRET_KEY);

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <PremiumTracker />
      {!isPremium && <PremiumStickyBar />}

      {/* ヒーロー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-10 pb-20 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 left-8 text-8xl">📚</div>
          <div className="absolute bottom-4 right-8 text-8xl">🎯</div>
        </div>
        <div className="relative z-10">
          <div className="inline-block bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            ⚡ Premium
          </div>
          <h1 className="text-2xl font-black leading-tight">
            広告なし・AI使い放題で<br />英語力を最短で伸ばす
          </h1>
          <p className="mt-3 text-sm text-navy-300 max-w-xs mx-auto">
            月額たった¥480。スタバ1杯より安く、英語学習が劇的に変わります。
          </p>
          {isPremium && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-bold">
              ✓ 現在プレミアム会員です
            </div>
          )}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 -mt-10">

        {/* 料金カード */}
        {isPremium ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <div className="font-black text-navy-800 text-xl">プレミアム会員</div>
            <p className="text-sm text-navy-500 mt-1">すべての機能をご利用いただけます</p>
            {hasStripe && <PremiumCheckout action="portal" />}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            {/* 年間プランバナー */}
            <div className="bg-amber-500 text-white text-center py-2 text-xs font-black tracking-wide">
              🏅 おすすめ — 34% OFF でお得な年間プラン
            </div>
            <div className="p-6 space-y-3">
              <PremiumCheckout
                action="checkout"
                stripeReady={stripeReady}
                loggedIn={!!user}
              />
              {/* 信頼バッジ */}
              <div className="flex items-center justify-center gap-3 pt-1">
                <span className="text-[10px] text-navy-400">🔒 Stripe 安全決済</span>
                <span className="text-navy-200">|</span>
                <span className="text-[10px] text-navy-400">✓ いつでも解約OK</span>
                <span className="text-navy-200">|</span>
                <span className="text-[10px] text-navy-400">📱 全端末対応</span>
              </div>
            </div>
          </div>
        )}

        {/* Premiumで増える主な機能（数字の誇張ではなく機能そのもので訴求） */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: "🚫", label: "広告非表示" },
            { icon: "🤖", label: "AI利用無制限" },
            { icon: "📄", label: "PDF出力無制限" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-navy-100 p-3 text-center">
              <div className="text-xl">{s.icon}</div>
              <div className="text-[10px] text-navy-500 mt-1 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AI機能ショーケース */}
        <div className="mt-6">
          <h2 className="font-black text-navy-800 text-center mb-3">Premium限定のAI機能</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "✨", title: "英文から単語抽出", desc: "英語記事を貼るだけでAIが語彙を自動抽出。気づかなかった表現も見逃さない。" },
              { icon: "🗓️", title: "AI学習プラン", desc: "試験日と目標を入力するとAIが最適な学習スケジュールを自動生成。" },
              { icon: "🔬", title: "AI弱点分析", desc: "間違いパターンをAIが分析して「次に何をすべきか」を具体的に提案。" },
              { icon: "🎧", title: "リスニングテスト", desc: "音声を聞いてスペルを入力。リスニング×スペリングを同時特訓。" },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-navy-100 p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-bold text-navy-800 text-sm">{f.title}</div>
                <p className="text-xs text-navy-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 機能比較表 */}
        <div className="mt-8">
          <h2 className="font-black text-navy-800 text-center mb-3">無料 vs Premium</h2>
          <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 bg-navy-50 text-[11px] font-bold text-center text-navy-600 border-b border-navy-100">
              <div className="py-3 px-2">機能</div>
              <div className="py-3 border-l border-navy-100">無料</div>
              <div className="py-3 border-l border-navy-100 bg-amber-50 text-amber-700">Premium</div>
            </div>
            {COMPARISON.map((r, i) => (
              <div key={r.label} className={`grid grid-cols-3 text-[11px] border-b border-navy-50 last:border-0 ${i % 2 === 0 ? "" : "bg-navy-50/30"}`}>
                <div className="py-2.5 px-3 text-navy-600">{r.label}</div>
                <div className={`py-2.5 text-center border-l border-navy-50 ${r.free === "—" ? "text-navy-300" : "text-navy-600"}`}>{r.free}</div>
                <div className={`py-2.5 text-center border-l border-navy-50 font-bold bg-amber-50/50 ${r.prem.startsWith("—") ? "text-navy-300" : "text-amber-700"}`}>{r.prem}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 中段CTA */}
        {!isPremium && (
          <div className="mt-8 bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-center text-white">
            <div className="font-black text-base mb-1">今すぐ始める</div>
            <p className="text-xs text-navy-300 mb-4">月額¥480〜 · いつでもキャンセル可 · データ引き継ぎOK</p>
            <PremiumCheckout
              action="checkout"
              stripeReady={stripeReady}
              loggedIn={!!user}
            />
          </div>
        )}

        {/* FAQ */}
        <div className="mt-8">
          <h2 className="font-black text-navy-800 mb-4">よくある質問</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="bg-white rounded-xl border border-navy-100 overflow-hidden group">
                <summary className="px-4 py-3.5 font-semibold text-navy-800 text-sm cursor-pointer list-none flex items-center justify-between gap-2">
                  {faq.q}
                  <span className="text-navy-400 shrink-0 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-4 pb-3.5 text-sm text-navy-600 leading-relaxed border-t border-navy-50">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* 価格訴求 */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <div className="text-sm font-black text-amber-800">💡 こんな人にオススメ</div>
          <ul className="mt-2 text-xs text-amber-700 space-y-1 text-left max-w-xs mx-auto">
            <li>✓ 英検・TOEICまでに確実に語彙を増やしたい</li>
            <li>✓ 広告のせいで集中できないと感じている</li>
            <li>✓ AIに弱点を分析してもらいたい</li>
            <li>✓ 英語記事や教材から単語を効率よく学びたい</li>
            <li>✓ 月¥480で本気の英語学習サポートが欲しい</li>
          </ul>
        </div>

        <div className="mt-6 text-center text-xs text-navy-400 space-y-1">
          <p>決済は <a href="https://stripe.com/jp" target="_blank" rel="noopener noreferrer" className="underline">Stripe</a> が安全に処理します</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/faq" className="underline">よくある質問</Link>
            <Link href="/contact" className="underline">お問い合わせ</Link>
            <Link href="/privacy" className="underline">プライバシーポリシー</Link>
            <Link href="/terms" className="underline">利用規約</Link>
            <Link href="/dashboard" className="underline">ダッシュボードへ</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
