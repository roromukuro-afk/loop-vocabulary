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
  description: "広告なし・AI解説が1日300回まで使える・CSV一括インポート・弱点分析・リスニングテスト。月額¥480から始める英単語学習のアップグレード。",
  alternates: { canonical: "https://loop-vocabulary.app/premium" },
};

const COMPARISON = [
  { label: "単語帳・SRS復習",         free: "✓",       prem: "✓" },
  { label: "4択・入力テスト",          free: "✓",       prem: "✓" },
  { label: "AI解説（例文・語源）",     free: "5回/日",   prem: "300回/日" },
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
  { q: "AIの使用量に制限はありますか？", a: "プレミアムプランではAI解説・弱点分析・学習プラン生成・英文抽出を合計1日300回まで利用できます。通常の学習でこの上限に達することはほとんどありません。" },
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

  const faqPageLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }} />
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
            月額¥480。忘却曲線に沿った自己想起の復習を、AIでもう一歩サポートします。
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
            { icon: "🤖", label: "AI解説300回/日" },
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
          <h2 className="font-black text-navy-800 text-center mb-1">Premium限定のAI機能</h2>
          <p className="text-xs text-navy-500 text-center mb-3 leading-relaxed">
            「自力で思い出せなかった」ときの理解を助ける補助機能です。復習そのものはフラッシュカード・忘却曲線が中心です。
          </p>
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

        {/* 高校生・英検・大学受験向け */}
        <div className="mt-8">
          <h2 className="font-black text-navy-800 text-center mb-1">高校生・英検・大学受験にも使えるPremium</h2>
          <p className="text-xs text-navy-500 text-center mb-4 leading-relaxed">
            無料でも単語帳・SRS復習・4択/入力/PDFテストなど基本の学習はできます。
            Premiumなら、目的に合わせて復習をもう少し効率化できます。
          </p>
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-navy-100 p-4">
              <div className="font-bold text-navy-800 text-sm mb-1">📝 英検対策</div>
              <p className="text-xs text-navy-500 mb-2 leading-relaxed">
                苦手な品詞や単語の傾向を確認し、試験前の復習範囲を整理。音とスペルも確認できます。
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {["AI弱点分析", "AI学習プラン", "リスニング練習", "タイピング練習", "広告非表示"].map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{f}</span>
                ))}
              </div>
              <Link href="/materials/eiken" className="inline-block mt-2 text-[11px] text-sky-700 hover:underline">
                英検対策教材を見る →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-navy-100 p-4">
              <div className="font-bold text-navy-800 text-sm mb-1">🎓 大学受験</div>
              <p className="text-xs text-navy-500 mb-2 leading-relaxed">
                模試前・入試前に復習範囲を整理し、長文や問題集から覚えるべき単語を抽出。入力テストでスペルまで確認できます。
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {["AI弱点分析", "AI学習プラン", "AI単語抽出", "タイピング練習", "リスニング練習"].map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{f}</span>
                ))}
              </div>
              <Link href="/materials/university-exam" className="inline-block mt-2 text-[11px] text-sky-700 hover:underline">
                大学受験対策教材を見る →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-navy-100 p-4">
              <div className="font-bold text-navy-800 text-sm mb-1">📚 定期テスト</div>
              <p className="text-xs text-navy-500 mb-2 leading-relaxed">
                テスト前に覚える範囲を整理し、学校教材やプリントの英文から単語を抽出。広告なしで短時間学習に集中できます。
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {["AI学習プラン", "AI単語抽出", "広告非表示", "タイピング練習"].map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{f}</span>
                ))}
              </div>
              <Link href="/materials/highschool" className="inline-block mt-2 text-[11px] text-sky-700 hover:underline">
                高校生向けページへ →
              </Link>
            </div>
          </div>

          {/* 無料/Premiumの違い（要約） */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-navy-100 p-4">
              <div className="text-xs font-bold text-navy-800 mb-2">無料でできること</div>
              <ul className="text-[11px] text-navy-600 space-y-1 list-disc pl-4">
                <li>フラッシュカードで自己想起 → 忘却曲線で自動復習</li>
                <li>教材のインポート・単語帳の作成</li>
                <li>4択テスト・入力テストでの確認</li>
                <li>PDFテストの作成</li>
                <li>達成スタンプでの学習記録</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-navy-100 p-4">
              <div className="text-xs font-bold text-navy-800 mb-2">Premiumで効率化できること</div>
              <ul className="text-[11px] text-navy-600 space-y-1 list-disc pl-4">
                <li>AI弱点分析・AI学習プラン</li>
                <li>AI単語抽出</li>
                <li>タイピング・リスニング練習</li>
                <li>広告非表示</li>
              </ul>
            </div>
          </div>

          {/* 保護者の方へ */}
          <div className="mt-4 bg-navy-50 rounded-2xl p-4">
            <div className="text-sm font-bold text-navy-700 mb-2">保護者の方へ</div>
            <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
              <li>無料の範囲でも、単語帳・SRS復習・4択/入力/PDFテストなど基本的な学習が可能です</li>
              <li>Premiumへの加入は任意です</li>
              <li>月額・年額の料金はこのページ内に明記しています</li>
              <li>解約方法は<Link href="/terms" className="underline">利用規約</Link>に記載しています</li>
              <li>販売事業者情報などは<Link href="/legal/commercial-transaction" className="underline">特定商取引法に基づく表記</Link>をご確認ください</li>
              <li>テストの点数上昇や合格を確約するような表現、誇張した実績の記載は行っていません</li>
              <li>学習データ（正誤・復習状況）をもとに、無理なく復習を続けられるよう支援するアプリです</li>
            </ul>
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
            <Link href="/legal/commercial-transaction" className="underline">特定商取引法に基づく表記</Link>
            <Link href="/dashboard" className="underline">ダッシュボードへ</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
