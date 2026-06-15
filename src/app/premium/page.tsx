import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { PremiumCheckout } from "./PremiumCheckout";

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
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-16 text-white text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
        <h1 className="text-3xl font-black leading-tight">
          最強の英単語学習を<br />ロック解除しよう
        </h1>
        <p className="mt-3 text-sm text-navy-300">広告なし・AI無制限・タイピング練習・CSV一括インポート</p>
        {isPremium && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-bold">
            ✓ 現在プレミアム会員です
          </div>
        )}
      </div>

      <div className="max-w-sm mx-auto px-4 -mt-8">
        {/* 料金カード */}
        {isPremium ? (
          <div className="bg-white rounded-3xl shadow-card p-6 text-center">
            <div className="text-2xl mb-2">🎉</div>
            <div className="font-bold text-navy-800 text-lg">プレミアム会員</div>
            <p className="text-sm text-navy-500 mt-1">すべての機能をご利用いただけます</p>
            {hasStripe && <PremiumCheckout action="portal" />}
          </div>
        ) : (
          <PremiumCheckout
            action="checkout"
            stripeReady={stripeReady}
            loggedIn={!!user}
          />
        )}

        {/* 機能比較 */}
        <div className="mt-8 bg-white rounded-2xl border border-navy-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 text-[11px] font-bold text-center text-navy-500 border-b border-navy-100">
            <div className="py-3">機能</div>
            <div className="py-3 border-l border-navy-100">無料</div>
            <div className="py-3 border-l border-navy-100 text-navy-800">Premium</div>
          </div>
          {[
            { label: "単語帳・テスト", free: "✓", prem: "✓" },
            { label: "AI解説", free: "5回/日", prem: "無制限" },
            { label: "タイピング練習", free: "—", prem: "✓" },
            { label: "リスニングテスト", free: "—", prem: "✓" },
            { label: "広告", free: "あり", prem: "なし ✓" },
            { label: "CSVインポート", free: "—", prem: "✓" },
            { label: "統計エクスポート", free: "—", prem: "✓" },
            { label: "PDFテスト出力", free: "3回/日", prem: "無制限" },
            { label: "英文から単語自動抽出", free: "—", prem: "✓" },
            { label: "AIパーソナル学習プラン", free: "—", prem: "✓" },
          ].map((r) => (
            <div key={r.label} className="grid grid-cols-3 text-[12px] border-b border-navy-50 last:border-0">
              <div className="py-3 px-3 text-navy-600 font-medium">{r.label}</div>
              <div className="py-3 text-center text-navy-400 border-l border-navy-50">{r.free}</div>
              <div className="py-3 text-center border-l border-navy-50 font-bold text-navy-800">{r.prem}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-8 space-y-4">
          <h2 className="font-bold text-navy-800">よくある質問</h2>
          {[
            { q: "いつでもキャンセルできますか？", a: "はい。Stripeのカスタマーポータルからいつでもキャンセルでき、次回請求日まで利用できます。" },
            { q: "支払い方法は？", a: "クレジットカード・デビットカードに対応しています（Stripe決済）。" },
            { q: "年間プランはお得ですか？", a: "月額¥480 × 12 = ¥5,760 のところ、年間¥3,800（34%OFF）です。" },
            { q: "無料プランのデータは引き継げますか？", a: "プレミアム登録後もすべての単語・学習履歴はそのまま引き継がれます。" },
          ].map((faq) => (
            <div key={faq.q} className="bg-white rounded-xl border border-navy-100 p-4">
              <div className="font-semibold text-navy-800 text-sm">Q. {faq.q}</div>
              <div className="mt-1 text-sm text-navy-600">{faq.a}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-sm text-navy-500 underline">ダッシュボードに戻る</Link>
        </div>
      </div>
    </div>
  );
}
