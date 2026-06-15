import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "英単語の覚え方・効率的な記憶術【2024年版】| Loop Vocabulary",
  description: "英単語が覚えられない悩みを解決！忘却曲線・SRS・語呂合わせ・語源学習・例文記憶など、科学的に証明された英単語の覚え方を徹底解説。英検・TOEIC・大学受験対応。",
};

const METHODS = [
  {
    icon: "🧠",
    title: "SRS（間隔反復学習）で忘却曲線を攻略",
    level: "最も効果的",
    color: "from-emerald-500 to-emerald-600",
    body: "エビングハウスの忘却曲線によると、人は24時間後に記憶の67%を忘れます。SRS（Spaced Repetition System）は「忘れかけたタイミング」で復習を繰り返すことで長期記憶に定着させる学習法です。1回目→翌日、2回目→3日後、3回目→1週間後…と間隔を伸ばすことで、少ない復習回数で確実に覚えられます。",
    tips: [
      "毎日10〜20語ずつ新規単語を追加",
      "復習は必ず決まった時間帯に行う",
      "アプリの「復習待ち」通知を見逃さない",
      "初回は必ず音声で発音も確認する",
    ],
  },
  {
    icon: "🔤",
    title: "語源（ルーツ）から単語を体系的に覚える",
    level: "応用力UP",
    color: "from-sky-500 to-sky-600",
    body: "英語の約60%はラテン語・ギリシャ語由来の語根を持っています。「pre-（前）」「re-（再）」「-tion（名詞化）」などの接頭辞・接尾辞を覚えると、未知の単語でも意味を推測できるようになります。例：predict（予測する）= pre（前）+ dict（言う）= 前もって言う。",
    tips: [
      "頻出接頭辞20個（pre, re, un, in, dis, mis…）を先に覚える",
      "語根（rupt=壊す・duct=導く）を意識して単語を分解する",
      "派生語（happy/happiness/unhappy）をセットで学ぶ",
      "語源辞典アプリも併用すると理解が深まる",
    ],
  },
  {
    icon: "📖",
    title: "例文・文脈で覚える（コンテキスト記憶法）",
    level: "定着率高",
    color: "from-purple-500 to-purple-600",
    body: "単語単体より「文脈」の中で覚えた方が忘れにくいことが研究で示されています。「persevere = 頑張る」より「She persevered through difficulties.（彼女は困難を乗り越えて頑張り続けた）」のように、具体的な文で覚えることで意味・使い方・コロケーションが同時に定着します。",
    tips: [
      "例文は感情を動かすストーリーのあるものを選ぶ",
      "自分で例文を作ってみる（アウトプット学習）",
      "英英辞典の定義文を例文として暗記する",
      "AIで新しい例文を自動生成させる",
    ],
  },
  {
    icon: "🎵",
    title: "語呂合わせ・イメージ記憶法（ニーモニック）",
    level: "短期記憶向け",
    color: "from-amber-500 to-amber-600",
    body: "「bizarre（奇妙な）= ビザールみたいなビールを飲む奇妙な人」のように、音と意味を結びつけるイメージ記憶法（ニーモニック）は短期間で大量の単語を覚えるのに有効です。特に試験直前の詰め込みに向いています。ただし長期記憶には向かないため、SRSと組み合わせるのが理想的です。",
    tips: [
      "音の響きから連想できる日本語イメージを作る",
      "視覚的なイメージ（絵）と一緒に覚える",
      "強烈・おかしな・感情的なほど記憶に残る",
      "語呂合わせはあくまでとっかかりとして使う",
    ],
  },
  {
    icon: "✍️",
    title: "書いて覚える（書字記憶法）",
    level: "試験対策向け",
    color: "from-indigo-500 to-indigo-600",
    body: "手を動かすことで身体記憶（手続き記憶）が活性化され、特にスペルの定着に効果的です。ただし「ただ写す」だけでは効果が薄く、意味を意識しながら書くこと・書いた後に隠して書けるか確認するステップが重要です。",
    tips: [
      "1語につき3〜5回書く（それ以上は時間対効果が低い）",
      "発音しながら書く（音韻・手指・視覚の複合記憶）",
      "自分の単語帳ノートを作り定期的に見返す",
      "英検・入試の入力テストで書く練習を兼ねる",
    ],
  },
  {
    icon: "👂",
    title: "聞いて覚える・シャドーイング",
    level: "リスニング対策",
    color: "from-teal-500 to-teal-600",
    body: "「目で見た英単語」より「耳で聞いた英単語」の方が長期記憶に残りやすいことが分かっています。発音を必ず確認してから覚えることで、リスニングでも聞き取れるようになります。さらにシャドーイング（音声を聞きながら発音）をすることで、記憶の定着率がさらに上がります。",
    tips: [
      "単語を覚えるときは必ず音声を聞く",
      "発音記号（フォニックス）を一度学ぶ",
      "通勤・通学中のシャドーイングで効率UP",
      "スピーキングの練習も同時にできる一石二鳥の方法",
    ],
  },
];

const MISTAKES = [
  { title: "1日に覚えようとする単語が多すぎる", fix: "1日10〜20語に絞る。量より「完全習得率」を重視する。" },
  { title: "覚えたらそれで終わり（復習しない）", fix: "必ずSRSで復習サイクルを回す。覚えた翌日・3日後・1週間後に復習。" },
  { title: "日本語訳だけで覚えようとする", fix: "例文・語源・発音もセットで覚える。意味だけでは使えない。" },
  { title: "単語帳をただ眺めるだけ", fix: "必ず意味を確認した後で「隠してテスト」する。受動的記憶NG。" },
  { title: "継続できずにリセットを繰り返す", fix: "1日5語でもいい。習慣化が最重要。完璧主義をやめる。" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英単語の覚え方・効率的な記憶術【2024年版】",
  "description": "SRS・語源・例文記憶など科学的に証明された英単語の覚え方を解説",
  "url": "https://loop-vocabulary.vercel.app/guide/eitango-oboeru-houhou",
};

export default function EitangoOboeruPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">学習法ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英単語の覚え方</h1>
        <p className="mt-2 text-sm text-navy-300">科学的に証明された記憶術で語彙力を劇的にUP</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* リード文 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">なぜ英単語は覚えられないのか？</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            多くの人が英単語学習で失敗する理由は「覚え方が非効率」なことにあります。ただ単語帳を眺めているだけ、一度覚えても復習しない、1日に100語詰め込もうとする—これらはすべて脳の仕組みに逆らった学習法です。
          </p>
          <p className="text-sm text-navy-600 leading-relaxed mt-2">
            このページでは、認知科学・記憶心理学の知見に基づいた<strong>本当に効果的な英単語の覚え方</strong>を6つのアプローチで解説します。
          </p>
        </div>

        {/* 6つの方法 */}
        {METHODS.map((m) => (
          <div key={m.title} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${m.color} px-5 py-4 text-white`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{m.icon}</span>
                <div>
                  <div className="text-[10px] font-bold opacity-80">{m.level}</div>
                  <div className="font-black text-base leading-tight">{m.title}</div>
                </div>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-navy-600 leading-relaxed">{m.body}</p>
              <div className="mt-3">
                <div className="text-[11px] font-bold text-navy-700 mb-2">実践のコツ</div>
                <ul className="space-y-1.5">
                  {m.tips.map((tip) => (
                    <li key={tip} className="text-xs text-navy-700 flex gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}

        {/* よくある失敗 */}
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 text-white">
            <div className="font-black text-base">❌ よくある失敗と対策</div>
          </div>
          <div className="p-5 space-y-4">
            {MISTAKES.map((m) => (
              <div key={m.title} className="border-l-4 border-red-300 pl-4">
                <div className="text-sm font-bold text-red-700">✗ {m.title}</div>
                <div className="text-xs text-navy-600 mt-0.5">→ {m.fix}</div>
              </div>
            ))}
          </div>
        </div>

        {/* おすすめ学習順序 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">推奨学習フロー（1語あたり3分）</h2>
          <div className="space-y-3">
            {[
              { step: "1", label: "音声を聞く", detail: "発音を確認（30秒）" },
              { step: "2", label: "意味を確認", detail: "日本語訳 + 例文を読む（60秒）" },
              { step: "3", label: "隠してテスト", detail: "英→日 or 日→英 4択テスト（30秒）" },
              { step: "4", label: "復習スケジュール", detail: "翌日・3日後・1週間後・1ヶ月後（SRS自動計算）" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-navy-800 text-white text-xs font-black flex items-center justify-center shrink-0">{s.step}</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.label}</div>
                  <div className="text-xs text-navy-500">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アプリCTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">SRS学習を今日から無料で始める</div>
          <p className="text-sm text-navy-300 mb-4">
            Loop Vocabulary はSRS（忘却曲線）を自動計算。毎日の復習タイミングをアプリが管理してくれるので、継続するだけで語彙力が伸び続けます。
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック</Link>
          </div>
        </div>

        {/* 関連記事 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/toeic-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📊</div>
            <div className="font-bold text-navy-800 text-sm">TOEIC単語学習法</div>
          </Link>
          <Link href="/guide/eiken-jun1-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📝</div>
            <div className="font-bold text-navy-800 text-sm">英検準1級単語対策</div>
          </Link>
          <Link href="/roadmap" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🗺</div>
            <div className="font-bold text-navy-800 text-sm">英語学習ロードマップ</div>
          </Link>
          <Link href="/vocab-check" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">語彙力チェック（無料）</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
