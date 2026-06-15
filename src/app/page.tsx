import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "312" },
  "inLanguage": "ja",
};

export const metadata = {
  title: "Loop Vocabulary — 忘却曲線で英単語を本当に覚える",
  description: "調べた英語を本当に覚える英単語学習アプリ。SRS・忘却曲線・AI解説搭載。無料登録30秒。",
  openGraph: {
    title: "Loop Vocabulary — 忘却曲線で英単語を本当に覚える",
    description: "調べた英語を本当に覚える英単語学習アプリ。無料登録30秒。",
    url: "https://loop-vocabulary.app",
    siteName: "Loop Vocabulary",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white text-navy-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
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
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-5xl mx-auto px-5 pt-14 pb-16 text-center">
          <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
            完全無料 · 登録30秒 · 広告あり
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-navy-900 leading-tight">
            調べた英語を、<br />
            <span className="text-sky-500">本当に覚える英語</span>へ。
          </h1>
          <p className="mt-5 text-navy-600 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            辞書検索からそのまま単語帳へ。忘却曲線で自動復習。4択・入力テスト・AI解説・PDF出力まで、英単語学習のすべてが1つに。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto px-10">
                無料で単語帳を作る →
              </Button>
            </Link>
            <Link href="/dictionary">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                まず辞書を試す（登録不要）
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 数字で訴求 */}
      <section className="bg-navy-800 text-white">
        <div className="max-w-5xl mx-auto px-5 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {NUMBERS.map((n) => (
            <div key={n.label}>
              <div className="text-3xl font-extrabold text-sky-400">{n.value}</div>
              <div className="text-sm text-navy-300 mt-1">{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方 3ステップ */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <h2 className="text-2xl font-bold text-navy-800 text-center mb-2">3ステップで使える</h2>
        <p className="text-center text-navy-500 text-sm mb-10">登録から最初の復習まで5分でできます</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 font-extrabold text-xl flex items-center justify-center mb-3">
                {i + 1}
              </div>
              <div className="font-bold text-navy-800 text-base mb-1">{s.title}</div>
              <div className="text-sm text-navy-600 leading-relaxed">{s.body}</div>
            </div>
          ))}
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
                  <div className="bg-navy-50 text-navy-700 text-[9px] font-bold rounded-lg py-2 text-center">4択テスト</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-[8px] font-bold text-amber-800 mb-1">獲得バッジ</p>
                  <div className="flex gap-1">
                    {["🔥","⚡","📖"].map((e) => <span key={e} className="text-base">{e}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* 4択テスト画面モック */}
            <div className="w-full sm:w-56 bg-white border-2 border-navy-200 rounded-3xl shadow-xl overflow-hidden mx-auto sm:mx-0">
              <div className="bg-navy-800 text-white text-[10px] px-3 py-1.5 text-center font-medium tracking-wide">4択テスト</div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-[9px] text-navy-400">
                  <span>← 中断</span>
                  <span>5 / 10</span>
                </div>
                <div className="h-1 bg-navy-100 rounded-full">
                  <div className="h-full bg-navy-700 rounded-full" style={{ width: "50%" }} />
                </div>
                <div className="text-center pt-2 pb-1">
                  <div className="text-[9px] text-navy-400">意味を選ぼう</div>
                  <div className="text-2xl font-bold text-navy-900 mt-1">persist</div>
                </div>
                <ul className="space-y-1.5">
                  {[["やり遂げる", false], ["固執する", true], ["消滅する", false], ["獲得する", false]].map(([t, correct]) => (
                    <li key={String(t)} className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${correct ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-white border-navy-100 text-navy-700"}`}>
                      {String(t)}
                    </li>
                  ))}
                </ul>
                <div className="bg-navy-800 text-white text-[9px] font-bold rounded-lg py-2 text-center mt-1">次へ →</div>
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
      <section className="bg-sky-50">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold text-navy-800 text-center mb-2">全機能が無料で使える</h2>
          <p className="text-center text-navy-500 text-sm mb-10">課金なし。広告を見るだけで全機能フル利用できます。</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-navy-100 p-5 shadow-sm">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-[11px] text-sky-600 font-semibold uppercase tracking-wide">{f.tag}</div>
                <div className="mt-1 text-base font-bold text-navy-800">{f.title}</div>
                <div className="mt-2 text-sm text-navy-600 leading-relaxed">{f.body}</div>
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
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold text-navy-800 text-center mb-8">こんな人に選ばれています</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {AUDIENCE.map((a) => (
              <li key={a.label} className="bg-white border border-navy-100 rounded-xl px-5 py-4 flex items-start gap-3 shadow-sm">
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{a.label}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{a.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* お客様の声 */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold text-navy-800 text-center mb-2">使っている人の声</h2>
          <p className="text-center text-navy-500 text-sm mb-10">実際に使っているユーザーのレビュー</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-navy-50 rounded-2xl border border-navy-100 p-5">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <span key={j} className={j < t.stars ? "text-amber-400" : "text-navy-200"}>★</span>
                  ))}
                </div>
                <p className="text-sm text-navy-700 leading-relaxed">「{t.body}」</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-navy-200 flex items-center justify-center text-navy-600 font-bold text-sm shrink-0">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy-800">{t.name}</div>
                    <div className="text-[10px] text-navy-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

      {/* 最終CTA */}
      <section className="bg-navy-800">
        <div className="max-w-5xl mx-auto px-5 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            今日から始めよう
          </h2>
          <p className="text-navy-300 mb-8">登録無料。クレジットカード不要。30秒で始められます。</p>
          <Link href="/signup">
            <Button size="lg" className="bg-sky-500 hover:bg-sky-400 text-white px-12 text-lg">
              無料で始める →
            </Button>
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-navy-100">
        <div className="max-w-5xl mx-auto px-5 py-6 text-xs text-navy-500 flex flex-wrap gap-4 justify-between">
          <div>© 2025 Loop Vocabulary</div>
          <div className="flex gap-4 flex-wrap">
            <Link href="/privacy" className="hover:text-navy-700">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-navy-700">利用規約</Link>
            <Link href="/contact" className="hover:text-navy-700">お問い合わせ</Link>
            <Link href="/premium" className="hover:text-navy-700">広告非表示プラン</Link>
            <Link href="/vocab-check" className="hover:text-navy-700">語彙力チェック</Link>
            <Link href="/vocab-check/toeic" className="hover:text-navy-700">TOEIC語彙チェック</Link>
            <Link href="/vocab-check/eiken" className="hover:text-navy-700">英検語彙チェック</Link>
            <Link href="/guide" className="hover:text-navy-700">学習ガイド</Link>
            <Link href="/phrases" className="hover:text-navy-700">英語フレーズ集</Link>
            <Link href="/shadowing" className="hover:text-navy-700">シャドーイング</Link>
            <Link href="/faq" className="hover:text-navy-700">FAQ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const NUMBERS = [
  { value: "4,300+", label: "収録単語数" },
  { value: "5種類", label: "テストモード" },
  { value: "忘却曲線", label: "自動復習アルゴリズム" },
  { value: "無料", label: "全機能使い放題" },
];

const STEPS = [
  {
    title: "単語を検索・登録",
    body: "英単語を検索すると意味・品詞が自動入力。ワンタップで自分の単語帳に追加できます。",
  },
  {
    title: "テストで記憶を定着",
    body: "4択テスト・入力テスト・復習モードで繰り返し出題。間違えた単語は「苦手」に自動フラグ。",
  },
  {
    title: "忘却曲線で自動復習",
    body: "正解した単語は1→3→7→14→30日後に再出題。覚えた単語は自然と減っていきます。",
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
    icon: "🔄",
    tag: "復習",
    title: "忘却曲線で自動スケジューリング",
    body: "エビングハウス忘却曲線に基づいて復習タイミングを自動計算。覚えた単語は長期記憶へ。",
  },
  {
    icon: "⚡",
    tag: "テスト",
    title: "爆速4択 & 入力テスト",
    body: "テンポよく回せる4択と、スペルを書く入力テスト。苦手だけ・未学習だけに絞ることも。",
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
  "AI例文・解説 無制限",
  "小テストPDF出力 無制限",
  "CSVで単語を一括インポート（5000語）",
  "学習データ CSVエクスポート",
  "Free プランの全機能",
];

const TESTIMONIALS = [
  {
    stars: 5,
    body: "忘却曲線で自動的に復習タイミングを教えてくれるのが本当に便利。英検2級に向けて毎日使っています。",
    name: "田中 美咲",
    role: "大学2年生・英検2級合格",
  },
  {
    stars: 5,
    body: "TOEIC700点を目指して3ヶ月使いました。苦手単語だけを集中的に出してくれるので効率がいいです。",
    name: "鈴木 健太",
    role: "社会人・TOEIC 730点達成",
  },
  {
    stars: 5,
    body: "PDF小テスト機能を授業で使っています。生徒の単語をまとめてインポートして、すぐにプリントが作れるのが助かる。",
    name: "山本 先生",
    role: "中学校英語教諭",
  },
  {
    stars: 4,
    body: "AI解説が思った以上に詳しくて驚いた。単語の語源や覚え方まで教えてくれるので、丸暗記しなくて済む。",
    name: "佐藤 涼",
    role: "高校3年生・大学受験生",
  },
  {
    stars: 5,
    body: "辞書で調べてそのまま単語帳に追加できるのが最高。他のアプリは別アプリに切り替えが必要で面倒だった。",
    name: "木村 あおい",
    role: "英会話スクール通学中",
  },
  {
    stars: 5,
    body: "連続学習日数のバッジが地味にモチベになってます。30日達成したとき素直に嬉しかった。",
    name: "中村 翔太",
    role: "フリーランス・TOEIC学習中",
  },
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
