import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Button } from "@/components/ui/Button";
import { LandingPageTracker } from "./LandingPageTracker";

type PublicStats = {
  materialCounts: { exam_type: string; count: number }[];
};

// 教材の exam_type 表記ゆれを表示用に統合（データ自体は変更しない）
const EXAM_CANON: Record<string, string> = {
  "大学入試": "大学受験",
  "大学受験": "大学受験",
  "高校英語": "高校入試",
  "高校入試": "高校入試",
  "高校": "高校入試",
  "中学": "高校入試",
  "英検": "英検",
  "TOEIC": "TOEIC",
  "一般": "一般",
};

// 実データに基づく教材の冊数のみを集計する（利用者数・学習語数・評価点等の
// 社会的証明は、実データと乖離した誇張表現になるため一切表示しない方針
// —2026-07-05 マーケティング文言の棚卸しにより撤去。詳細はWORK_HISTORY.md参照）。
const getPublicStats = unstable_cache(
  async (): Promise<PublicStats> => {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data: materialsData } = await supabase
        .from("materials")
        .select("exam_type")
        .eq("is_public", true)
        .in("license_status", ["approved", "original"]);

      const countByExam: Record<string, number> = {};
      for (const m of materialsData ?? []) {
        const raw = m.exam_type ?? "その他";
        const key = EXAM_CANON[raw] ?? raw; // 表記ゆれを統合（例: 大学入試→大学受験）
        countByExam[key] = (countByExam[key] ?? 0) + 1;
      }
      const materialCounts = Object.entries(countByExam)
        .map(([exam_type, count]) => ({ exam_type, count }))
        .sort((a, b) => b.count - a.count);

      return { materialCounts };
    } catch {
      return { materialCounts: [] };
    }
  },
  ["public-stats"],
  { revalidate: 3600 },
);

const STATIC_MATERIAL_COUNTS = [
  { exam_type: "英検", count: 8 },
  { exam_type: "大学受験", count: 9 },
  { exam_type: "高校入試", count: 6 },
  { exam_type: "TOEIC", count: 2 },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Loop Vocabulary",
  "url": "https://loop-vocabulary.app",
  "description": "忘却曲線・間隔反復（SRS）・AI解説を組み合わせた無料英単語学習アプリ。調べた英語を本当に覚える。",
  "applicationCategory": "EducationApplication",
  "operatingSystem": "Any",
  "offers": [
    { "@type": "Offer", "price": "0", "priceCurrency": "JPY", "name": "無料プラン" },
    { "@type": "Offer", "price": "480", "priceCurrency": "JPY", "name": "プレミアムプラン（月額）" },
  ],
  "inLanguage": "ja",
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "本当に無料ですか？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "基本機能はすべて無料でご利用いただけます（広告あり）。広告非表示・AI例文/解説の上限解放・小テストPDF出力の無制限などはPremium（月額¥480）でご利用いただけます。",
      },
    },
    {
      "@type": "Question",
      "name": "スマホアプリはありますか？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Webアプリとして動作しますが、ホーム画面に追加するとアプリのように使えます（PWA対応）。ネイティブアプリも準備中です。",
      },
    },
    {
      "@type": "Question",
      "name": "自分の単語帳を作れますか？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "もちろんです。単語・意味を自由に登録して自分だけの単語帳を作れます。既存の教材インポートも可能です。",
      },
    },
    {
      "@type": "Question",
      "name": "学習の進捗は記録されますか？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "毎日の学習数・正答率・連続学習日数・学習カレンダーで記録・確認できます。",
      },
    },
  ],
};

export const metadata = {
  title: "Loop Vocabulary — 忘却曲線で英単語を本当に覚える",
  description: "調べた英語を本当に覚える英単語学習アプリ。SRS・忘却曲線・AI解説搭載。無料登録30秒。",
  alternates: { canonical: "https://loop-vocabulary.app" },
  openGraph: {
    title: "Loop Vocabulary — 忘却曲線で英単語を本当に覚える",
    description: "調べた英語を本当に覚える英単語学習アプリ。無料登録30秒。",
    url: "https://loop-vocabulary.app",
    siteName: "Loop Vocabulary",
    type: "website",
  },
};

export default async function LandingPage() {
  const { materialCounts } = await getPublicStats();
  const displayMaterialCounts = materialCounts.length > 0 ? materialCounts : STATIC_MATERIAL_COUNTS;

  const totalMaterials = displayMaterialCounts.reduce((sum, m) => sum + m.count, 0);
  const NUMBERS = [
    { value: "¥0", label: "基本機能が無料" },
    { value: "SRS", label: "忘却曲線で自動復習" },
    { value: "AI", label: "語源・例文をその場で解説" },
    { value: totalMaterials > 0 ? `${totalMaterials}+` : "多数", label: "収録教材・単語帳" },
  ];

  return (
    <div className="min-h-dvh bg-white text-navy-900">
      <LandingPageTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      {/* ナビ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-navy-100">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="font-extrabold text-navy-800 text-lg tracking-tight">
            Loop <span className="text-sky-500">Vocabulary</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">ログイン</Button></Link>
            <Link href="/signup"><Button size="sm">無料で始める</Button></Link>
          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-sky-500 opacity-[0.06] blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-indigo-500 opacity-[0.08] blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-5 py-16 sm:py-24 grid sm:grid-cols-2 gap-10 items-center">
          {/* 左: コピー */}
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              登録無料 · 広告なしでも使える基本機能
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.1] tracking-tight">
              英単語を、<br />
              <span className="text-sky-400">もう一度</span><br />
              調べない。
            </h1>
            <p className="mt-4 text-sky-300 text-sm font-bold">
              調べた英語を、覚える英語へ。覚えた英語を、使える英語へ。
            </p>
            <p className="mt-3 text-navy-300 text-base leading-relaxed max-w-sm">
              自力で思い出す（自己想起）ほど記憶は定着します。忘却曲線に合わせて自動で復習タイミングを提案。
              仕上げの4択で確認、AIが語源・ニュアンスをその場で解説。
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto px-10 font-black">
                  無料で始める →
                </Button>
              </Link>
              <Link href="/dictionary">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto text-navy-300 hover:text-white border border-white/10 hover:bg-white/10">
                  辞書だけ試す（登録不要）
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-navy-500">クレジットカード不要 · 30秒で登録完了</p>
          </div>

          {/* 右: プロダクトビジュアル */}
          <div className="flex justify-center sm:justify-end">
            <div className="relative">
              {/* メインカード */}
              <div className="bg-white rounded-3xl shadow-2xl p-5 w-64">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">大学受験標準</span>
                  <span className="text-[10px] text-navy-400">12 / 20</span>
                </div>
                <div className="h-1 bg-navy-100 rounded-full mb-4">
                  <div className="h-full w-3/5 bg-sky-500 rounded-full" />
                </div>
                <div className="text-center py-2">
                  <div className="text-[11px] text-navy-400 mb-1">意味を選ぼう</div>
                  <div className="text-3xl font-black text-navy-900 mb-1">persist</div>
                  <div className="text-xs text-navy-400">[pəˈsɪst]</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {[
                    ["やり遂げる", "bg-white border-navy-100 text-navy-700"],
                    ["固執する", "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold"],
                    ["消滅する", "bg-white border-navy-100 text-navy-700"],
                    ["獲得する", "bg-white border-navy-100 text-navy-700"],
                  ].map(([label, cls]) => (
                    <div key={label} className={`rounded-xl border px-2 py-2.5 text-[11px] text-center ${cls}`}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-sky-500 text-white text-[11px] font-bold rounded-xl py-2.5 text-center">
                  次へ →
                </div>
              </div>
              {/* フローティングバッジ */}
              <div className="absolute -top-3 -right-3 bg-amber-400 text-amber-900 font-black text-[11px] rounded-2xl px-3 py-1.5 shadow-lg rotate-3 whitespace-nowrap">
                🔥 7日連続
              </div>
              <div className="absolute -bottom-3 -left-3 bg-emerald-400 text-emerald-900 font-black text-[11px] rounded-2xl px-3 py-1.5 shadow-lg -rotate-2 whitespace-nowrap">
                ✓ 234語 習得済み
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 数字で訴求 */}
      <section className="bg-white border-b border-navy-100">
        <div className="max-w-5xl mx-auto px-5 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {NUMBERS.map((n) => (
            <div key={n.label}>
              <div className="text-2xl sm:text-3xl font-black text-navy-900">{n.value}</div>
              <div className="text-xs text-navy-400 mt-1 font-medium">{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方 3ステップ */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="text-center mb-10">
          <span className="text-xs font-black uppercase tracking-widest text-sky-500 mb-2 block">How it works</span>
          <h2 className="text-2xl sm:text-3xl font-black text-navy-900">登録30秒。5分後には学習スタート。</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-navy-100 p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-6xl font-black text-navy-50 select-none leading-none">{i + 1}</div>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-sky-500 text-white font-black text-lg flex items-center justify-center mb-4 shadow-sm">
                  {i + 1}
                </div>
                <div className="font-black text-navy-900 text-base mb-2">{s.title}</div>
                <div className="text-sm text-navy-500 leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 収録コンテンツ */}
      <section className="bg-slate-50 border-y border-navy-100">
        <div className="max-w-5xl mx-auto px-5 py-12">
          <div className="text-center mb-8">
            <span className="text-xs font-black uppercase tracking-widest text-sky-500 mb-2 block">Content Library</span>
            <h2 className="text-2xl font-black text-navy-900">試験別・教材別の単語ライブラリ</h2>
            <p className="text-sm text-navy-500 mt-2">許諾済み教材をまるごとインポートして即スタート。自分の単語も無制限で追加できます。</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(materialCounts.length > 0 ? materialCounts : STATIC_MATERIAL_COUNTS).map((mc) => (
              <div key={mc.exam_type} className="bg-white rounded-2xl border border-navy-100 p-4 text-center shadow-sm">
                <div className="text-xl font-black text-navy-900">
                  {mc.count}
                  <span className="text-sm font-semibold text-navy-400">冊</span>
                </div>
                <div className="text-xs text-navy-500 mt-1 font-medium">{mc.exam_type}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/materials" className="inline-flex items-center gap-1.5 text-sm text-sky-600 font-bold hover:underline">
              全教材を見る →
            </Link>
          </div>
        </div>
      </section>

      {/* アプリUIプレビュー */}
      <section className="bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold text-navy-800 text-center mb-2">こんな画面で学習できます</h2>
          <p className="text-center text-navy-500 text-sm mb-10">スマホ感覚でサクサク操作。テンポよく進めます。</p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-start">
            {/* ダッシュボード画面モック */}
            <div className="w-full sm:w-56 bg-white border-2 border-navy-200 rounded-3xl shadow-xl overflow-hidden mx-auto sm:mx-0">
              <div className="bg-navy-800 text-white text-[10px] px-3 py-1.5 text-center font-medium tracking-wide">Loop Vocabulary</div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-navy-400">おはようございます</p>
                    <p className="text-xs font-bold text-navy-800">今日も続けよう</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-1 text-center">
                    <div className="text-base leading-none">🔥</div>
                    <div className="text-[9px] font-bold text-orange-600">7日</div>
                  </div>
                </div>
                <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
                  <div className="h-full bg-navy-700 rounded-full" style={{ width: "65%" }} />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[["13", "今日学習"], ["85%", "正答率"], ["6", "復習待ち"]].map(([v, l]) => (
                    <div key={l} className="bg-navy-50 rounded-lg p-1.5 text-center">
                      <div className="text-xs font-bold text-navy-800">{v}</div>
                      <div className="text-[8px] text-navy-500">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-navy-800 text-white text-[9px] font-bold rounded-lg py-2 text-center">今日の復習</div>
                  <div className="bg-navy-50 text-navy-700 text-[9px] font-bold rounded-lg py-2 text-center">4択で確認</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-[8px] font-bold text-amber-800 mb-1">獲得バッジ</p>
                  <div className="flex gap-1">
                    {["🔥","⚡","📖"].map((e) => <span key={e} className="text-base">{e}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* フラッシュカード画面モック（自己想起） */}
            <div className="w-full sm:w-56 bg-white border-2 border-navy-200 rounded-3xl shadow-xl overflow-hidden mx-auto sm:mx-0">
              <div className="bg-navy-800 text-white text-[10px] px-3 py-1.5 text-center font-medium tracking-wide">フラッシュカード</div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-[9px] text-navy-400">
                  <span>← 中断</span>
                  <span>5 / 10</span>
                </div>
                <div className="h-1 bg-navy-100 rounded-full">
                  <div className="h-full bg-navy-700 rounded-full" style={{ width: "50%" }} />
                </div>
                <div className="mt-2 bg-navy-50 border border-navy-100 rounded-2xl py-6 text-center">
                  <div className="text-[9px] text-navy-400 mb-1">意味を自分で思い出そう</div>
                  <div className="text-2xl font-black text-navy-900">persist</div>
                  <div className="text-[9px] text-navy-400 mt-1">タップして答えを確認</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="rounded-xl border border-red-200 bg-red-50 text-red-600 text-[10px] font-bold text-center py-2.5">忘れた</div>
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-bold text-center py-2.5">思い出せた</div>
                </div>
              </div>
            </div>

            {/* AI解説画面モック */}
            <div className="w-full sm:w-56 bg-white border-2 border-navy-200 rounded-3xl shadow-xl overflow-hidden mx-auto sm:mx-0">
              <div className="bg-navy-800 text-white text-[10px] px-3 py-1.5 text-center font-medium tracking-wide">AI例文・解説</div>
              <div className="p-3 space-y-2">
                <div className="bg-navy-50 border border-navy-100 rounded-xl p-2">
                  <div className="text-[8px] text-navy-500">英単語</div>
                  <div className="text-sm font-bold text-navy-800">persist</div>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[8px] font-bold text-sky-700">【中学レベル】</div>
                  <div className="text-[9px] text-navy-700">I will persist until I succeed.</div>
                  <div className="text-[8px] text-navy-500">成功するまでやり続けます。</div>
                  <div className="text-[8px] font-bold text-sky-700 mt-1">【大学受験レベル】</div>
                  <div className="text-[9px] text-navy-700">Despite setbacks, she persisted in her research.</div>
                  <div className="text-[8px] text-navy-500">挫折にもかかわらず彼女は研究を続けた。</div>
                </div>
                <div className="bg-navy-800 text-white text-[9px] font-bold rounded-lg py-2 text-center">AIで例文を生成</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 機能カード */}
      <section className="bg-navy-900">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-sky-400 mb-2 block">Features</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">主要機能は、無料。</h2>
            <p className="text-navy-400 text-sm mt-2">単語帳・復習・テスト・辞書は無料で使い放題（広告あり）。広告非表示やAI解説300回/日はPremiumで。</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-2xl p-5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-lg mb-3">{f.icon}</div>
                <div className="text-[10px] text-sky-400 font-black uppercase tracking-widest mb-1">{f.tag}</div>
                <div className="text-sm font-bold text-white">{f.title}</div>
                <div className="mt-1.5 text-xs text-navy-400 leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 他アプリとの比較 */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-navy-800 text-center mb-8">他のアプリと比べると</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-navy-800 text-white">
                <th className="py-3 px-4 text-left rounded-tl-xl">機能</th>
                <th className="py-3 px-4 text-center">
                  <span className="text-sky-300 font-bold">Loop Vocabulary</span>
                </th>
                <th className="py-3 px-4 text-center text-navy-300">一般的な単語帳アプリ</th>
                <th className="py-3 px-4 text-center text-navy-300 rounded-tr-xl">紙の単語帳</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-navy-50" : "bg-white"}>
                  <td className="py-3 px-4 font-medium text-navy-800">{row.feature}</td>
                  <td className="py-3 px-4 text-center text-lg">{row.loop}</td>
                  <td className="py-3 px-4 text-center text-lg">{row.general}</td>
                  <td className="py-3 px-4 text-center text-lg">{row.paper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 料金プラン */}
      <section className="bg-gradient-to-b from-navy-50 to-white">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold text-navy-800 text-center mb-2">シンプルな料金プラン</h2>
          <p className="text-center text-navy-500 text-sm mb-10">まずは無料で始めて、必要になったらアップグレード</p>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* 無料プラン */}
            <div className="bg-white border-2 border-navy-100 rounded-3xl p-7 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-widest text-navy-400 mb-1">Free</div>
              <div className="text-3xl font-extrabold text-navy-900 mt-1">¥0</div>
              <div className="text-xs text-navy-400 mt-0.5">ずっと無料</div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-navy-700">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-7 block text-center bg-navy-100 hover:bg-navy-200 text-navy-800 font-bold py-3 rounded-xl transition-colors text-sm">
                無料で始める
              </Link>
            </div>

            {/* プレミアムプラン */}
            <div className="bg-gradient-to-b from-navy-800 to-navy-950 border-2 border-sky-400 rounded-3xl p-7 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-sky-400 text-navy-900 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">おすすめ</div>
              <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-1">Premium</div>
              <div className="text-3xl font-extrabold text-white mt-1">¥480<span className="text-base font-normal text-navy-300">/月</span></div>
              <div className="text-xs text-navy-400 mt-0.5">年払いなら ¥3,800（¥317/月）</div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white">
                    <span className="text-sky-400 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/premium" className="mt-7 block text-center bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                プレミアムを見る →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* こんな人に */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="text-center mb-8">
            <span className="text-xs font-black uppercase tracking-widest text-sky-500 mb-2 block">For you</span>
            <h2 className="text-2xl sm:text-3xl font-black text-navy-900">こんな人におすすめ</h2>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AUDIENCE.map((a) => (
              <li key={a.label} className="flex items-start gap-3 bg-slate-50 border border-navy-100 rounded-2xl px-5 py-4">
                <span className="text-xl mt-0.5 shrink-0">{a.icon}</span>
                <div>
                  <div className="font-black text-navy-900 text-sm">{a.label}</div>
                  <div className="text-xs text-navy-500 mt-0.5 leading-relaxed">{a.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-navy-800 text-center mb-8">よくある質問</h2>
        <div className="space-y-4 max-w-2xl mx-auto">
          {FAQ.map((q) => (
            <div key={q.q} className="border border-navy-100 rounded-xl px-5 py-4">
              <div className="font-bold text-navy-800 text-sm">Q. {q.q}</div>
              <div className="mt-2 text-sm text-navy-600 leading-relaxed">A. {q.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Premium AI機能紹介 */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="text-center mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">Premium AI Features</div>
          <h2 className="text-2xl font-bold text-navy-800">AIで学習効率を最大化</h2>
          <p className="text-sm text-navy-500 mt-2">プレミアムプランで使えるAI機能で、学習の質と速度を飛躍的に向上させます</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: "✨", title: "英文から単語を自動抽出", desc: "英語ニュース・メールを貼り付けるだけでAIが学習すべき語彙を自動抽出して単語帳に追加。" },
            { icon: "🗓️", title: "AIパーソナル学習プラン", desc: "英検2級・TOEIC800点など目標を入力するとAIが最適な学習スケジュールを自動生成。" },
            { icon: "🔬", title: "AI弱点分析レポート", desc: "間違いのパターンをAIが分析し、苦手な単語の傾向と具体的な改善策を提案。" },
            { icon: "🎧", title: "リスニングテスト", desc: "英単語の音声を聞いてスペルを入力するリスニング×スペリング同時練習。" },
          ].map((f) => (
            <div key={f.title} className="bg-gradient-to-br from-navy-50 to-white border border-navy-100 rounded-2xl p-5">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-bold text-navy-800">{f.title}</div>
              <p className="text-sm text-navy-600 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link href="/premium">
            <Button variant="secondary" size="lg">プレミアムの全機能を見る →</Button>
          </Link>
        </div>
      </section>

      {/* 語彙力チェックCTA */}
      <section className="bg-sky-600">
        <div className="max-w-5xl mx-auto px-5 py-12 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-200 mb-2">無料 · ログイン不要 · 20問</div>
          <h2 className="text-2xl font-extrabold text-white mb-2">まず語彙力チェックを試す</h2>
          <p className="text-sky-100 text-sm mb-6">20問の4択クイズで、あなたの英語語彙レベルを診断。中学〜IELTS上級まで5段階判定。</p>
          <Link href="/vocab-check">
            <Button size="lg" className="bg-white hover:bg-sky-50 text-sky-700 px-10 font-bold">
              語彙力チェックを始める（無料）→
            </Button>
          </Link>
        </div>
      </section>

      {/* 学習ガイドセクション */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="text-center mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">学習ガイド</div>
          <h2 className="text-2xl font-bold text-navy-800">英語試験別 単語学習ガイド</h2>
          <p className="text-sm text-navy-500 mt-2">目標別に最短ルートを解説</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { slug: "eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術", desc: "SRS・語源・例文記憶など科学的な学習法を解説" },
            { slug: "eiken-3kyu-tango", tag: "英検3級", title: "英検3級 頻出単語対策", desc: "頻出800語をカテゴリ別に完全解説" },
            { slug: "eiken-jun2-tango", tag: "英検準2級", title: "英検準2級 単語対策", desc: "テーマ別1,000語と6週間合格プラン" },
            { slug: "eiken-2kyu-tango", tag: "英検2級", title: "英検2級 単語対策", desc: "社会・医療・科学の頻出1,500語" },
            { slug: "eiken-jun1-tango", tag: "英検準1級", title: "英検準1級 単語対策", desc: "7,000〜8,000語レベルをカテゴリ別に攻略" },
            { slug: "toeic-tango", tag: "TOEIC", title: "TOEIC 頻出単語 スコア別解説", desc: "600点〜990点を目指す語彙学習戦略" },
            { slug: "business-english-tango", tag: "ビジネス英語", title: "ビジネス英語 必須単語300選", desc: "メール・会議・プレゼン・交渉シーン別に厳選" },
            { slug: "daigaku-juken-tango", tag: "大学受験", title: "大学受験英単語の覚え方", desc: "共通テスト〜難関大に必要な3,000〜5,000語" },
          ].map((g) => (
            <Link key={g.slug} href={`/guide/${g.slug}`} className="block bg-white border border-navy-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
              <div className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold inline-block mb-2">{g.tag}</div>
              <div className="font-bold text-navy-800 text-sm leading-snug">{g.title}</div>
              <p className="text-xs text-navy-500 mt-1">{g.desc}</p>
              <div className="mt-3 text-xs text-sky-600 font-semibold">続きを読む →</div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link href="/guide" className="inline-block text-sm text-sky-600 font-bold hover:underline">
            すべてのガイドを見る →
          </Link>
        </div>
      </section>

      {/* 語彙力チェックバナー */}
      <section className="bg-white py-10">
        <div className="max-w-5xl mx-auto px-5">
          <Link href="/vocab-check" className="block">
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white hover:opacity-95 transition-opacity flex flex-col sm:flex-row items-center gap-5">
              <div className="text-5xl">📊</div>
              <div className="flex-1 text-center sm:text-left">
                <div className="text-[11px] font-bold uppercase tracking-widest text-sky-200 mb-1">無料診断</div>
                <div className="text-xl font-black leading-tight">あなたの英語語彙力を今すぐチェック</div>
                <p className="text-sm text-sky-100 mt-1">20問・3分・ログイン不要。中学〜IELTS上級まで5段階で判定します。</p>
              </div>
              <div className="shrink-0 px-5 py-3 rounded-2xl bg-white text-sky-700 font-black text-sm hover:bg-sky-50 transition-colors">
                今すぐ診断 →
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* 最終CTA */}
      <section className="bg-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-sky-500 opacity-[0.07] blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-5 py-20 text-center">
          <div className="text-xs font-black uppercase tracking-widest text-sky-400 mb-3">無料・登録30秒・CC不要</div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            今日、最初の1語を覚える。
          </h2>
          <p className="text-navy-400 mb-10 max-w-md mx-auto text-sm leading-relaxed">
            英単語学習は「続けられるか」がすべて。<br />
            Loop Vocabularyは忘却曲線で、あなたの継続を全力でサポートします。
          </p>
          <Link href="/signup">
            <Button size="lg" className="px-14 text-lg font-black shadow-lg shadow-sky-500/20">
              無料で始める →
            </Button>
          </Link>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-navy-500">
            <span>✓ クレジットカード不要</span>
            <span>✓ 30秒で登録完了</span>
            <span>✓ いつでも退会可能</span>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-navy-100 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-8 text-xs text-navy-500">
          {/* 運営・公式情報 */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="font-extrabold text-navy-800 text-sm mb-1.5">
                Loop <span className="text-sky-500">Vocabulary</span>
              </div>
              <p className="leading-relaxed">
                英単語を辞書検索・単語帳・忘却曲線復習・小テストで<br className="hidden sm:block" />
                効率よく学習できる英単語学習アプリ
              </p>
              <p className="mt-2">
                公式サイト:{" "}
                <a
                  href="https://loop-vocabulary.app"
                  className="text-sky-600 hover:underline font-medium"
                >
                  https://loop-vocabulary.app
                </a>
              </p>
              <p className="mt-1">
                お問い合わせ:{" "}
                <Link href="/contact" className="text-sky-600 hover:underline font-medium">
                  お問い合わせフォーム
                </Link>
              </p>
            </div>

            <div className="flex gap-6 flex-wrap sm:justify-end">
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-navy-700">サービス</span>
                <Link href="/materials" className="hover:text-navy-700">教材・単語帳</Link>
                <Link href="/guide" className="hover:text-navy-700">学習ガイド</Link>
                <Link href="/grammar" className="hover:text-navy-700">英文法レッスン</Link>
                <Link href="/vocab-check" className="hover:text-navy-700">語彙力チェック</Link>
                <Link href="/dictionary" className="hover:text-navy-700">辞書検索</Link>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-navy-700">運営情報</span>
                <Link href="/about" className="hover:text-navy-700">運営者について</Link>
                <Link href="/press" className="hover:text-navy-700">プレスキット</Link>
                <Link href="/privacy" className="hover:text-navy-700">プライバシーポリシー</Link>
                <Link href="/terms" className="hover:text-navy-700">利用規約</Link>
                <Link href="/legal/commercial-transaction" className="hover:text-navy-700">特定商取引法に基づく表記</Link>
                <Link href="/contact" className="hover:text-navy-700">お問い合わせ</Link>
                <Link href="/premium" className="hover:text-navy-700">プレミアムプラン</Link>
                <Link href="/faq" className="hover:text-navy-700">FAQ</Link>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-navy-100 text-navy-400">
            © 2025–2026 Loop Vocabulary
          </div>
        </div>
      </footer>
    </div>
  );
}


const STEPS = [
  {
    title: "単語を検索・登録",
    body: "英単語を検索すると意味・品詞が自動入力。ワンタップで自分の単語帳に追加できます。",
  },
  {
    title: "フラッシュカードで自力に思い出す",
    body: "見て終わりにせず、まず自分の力で意味を思い出す（自己想起）。4択・入力テストは仕上げの確認に使えます。",
  },
  {
    title: "忘却曲線で自動復習",
    body: "「思い出せた／忘れた」の結果に応じて次の復習タイミングを自動計算。覚えたつもりを防ぎ、本当に定着させます。",
  },
];

const FEATURES = [
  {
    icon: "🔍",
    tag: "辞書",
    title: "調べてそのまま単語帳へ",
    body: "英単語を検索して結果からワンタップで登録。「調べる→忘れる」のループを断ち切ります。",
  },
  {
    icon: "🧠",
    tag: "復習モード",
    title: "フラッシュカードで自己想起",
    body: "答えを見る前に、まず自分の力で思い出す。4択・入力テストは仕上げの確認用として使えます。",
  },
  {
    icon: "🔄",
    tag: "忘却曲線",
    title: "忘却曲線で自動スケジューリング",
    body: "エビングハウス忘却曲線に基づいて復習タイミングを自動計算。「覚えたつもり」を防ぎ、長期記憶へ。",
  },
  {
    icon: "📚",
    tag: "教材",
    title: "大学受験・英検・TOEIC対応",
    body: "中学英単語・大学入試頻出・英検2級/準1級の単語集を収録。そのままインポートできます。",
  },
  {
    icon: "🤖",
    tag: "AI",
    title: "AI例文・ニュアンス解説",
    body: "単語のニュアンス・覚え方・レベル別例文をAIが解説。辞書では分からない「使い方」が分かる。",
  },
  {
    icon: "📄",
    tag: "PDF",
    title: "小テストPDFを自動生成",
    body: "英→日・日→英・4択・記述をPDFで出力。塾・学校・自習プリントにそのまま使えます。",
  },
];

const COMPARISON = [
  { feature: "忘却曲線による自動復習", loop: "✅", general: "△", paper: "❌" },
  { feature: "辞書→単語帳ワンタップ登録", loop: "✅", general: "❌", paper: "❌" },
  { feature: "4択・入力テスト", loop: "✅", general: "✅", paper: "❌" },
  { feature: "苦手単語の自動フラグ", loop: "✅", general: "△", paper: "❌" },
  { feature: "大学受験/英検/TOEIC教材内蔵", loop: "✅", general: "有料", paper: "❌" },
  { feature: "AI例文・ニュアンス解説", loop: "✅", general: "❌", paper: "❌" },
  { feature: "小テストPDF出力", loop: "✅", general: "❌", paper: "✅" },
  { feature: "完全無料で全機能", loop: "✅", general: "△", paper: "✅" },
];

const AUDIENCE = [
  { icon: "🎓", label: "中学生・高校生・大学受験生", body: "定期テストから共通テストまで。教科書の単語もすぐ登録できます。" },
  { icon: "📝", label: "英検・TOEIC学習者", body: "英検2級・準1級の単語集を収録。自分の苦手を把握して効率よく。" },
  { icon: "👔", label: "英語を学び直す社会人", body: "スキマ時間にスマホで完結。忘却曲線で「久しぶり」でも安心。" },
  { icon: "👩‍🏫", label: "塾講師・学校の先生", body: "PDF小テスト機能でオリジナルプリントを5分で作成。授業の準備が楽になります。" },
  { icon: "📖", label: "参考書をデジタル化したい人", body: "市販の参考書の単語を自分でインポートして使えます。" },
  { icon: "✈️", label: "旅行・留学前に単語を増やしたい", body: "旅行英語・ビジネス英語もカテゴリ別に整理できます。" },
];

const FREE_FEATURES = [
  "単語帳・単語登録（無制限）",
  "忘却曲線による自動復習",
  "4択テスト・入力テスト",
  "辞書検索（ワンタップ登録）",
  "AI例文・解説（1日5回）",
  "小テストPDF出力（1日3回）",
  "苦手単語フィルター",
  "教材・参考書インポート",
];

const PREMIUM_FEATURES = [
  "広告を完全に非表示",
  "AI例文・解説（1日300回）",
  "小テストPDF出力 無制限",
  "CSVで単語を一括インポート（5000語）",
  "学習データ CSVエクスポート",
  "Free プランの全機能",
];

const FAQ = [
  {
    q: "本当に無料ですか？",
    a: "はい、全機能が無料でご利用いただけます。広告が表示されますが、有料プラン（広告非表示）もご用意しています。",
  },
  {
    q: "スマホアプリはありますか？",
    a: "Webアプリとして動作しますが、ホーム画面に追加するとアプリのように使えます（PWA対応）。ネイティブアプリも準備中です。",
  },
  {
    q: "自分の単語帳を作れますか？",
    a: "もちろんです。単語・意味を自由に登録して自分だけの単語帳を作れます。既存の教材インポートも可能です。",
  },
  {
    q: "学習の進捗は記録されますか？",
    a: "毎日の学習数・正答率・連続学習日数・学習カレンダーで記録・確認できます。",
  },
];
