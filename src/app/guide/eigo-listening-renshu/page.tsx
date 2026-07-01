import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英語リスニング練習方法【初心者〜上級者別 完全ガイド】| Loop Vocabulary",
  description: "英語リスニングを独学で上達させる方法を徹底解説。シャドーイング・ディクテーション・多聴の効果的な使い方、レベル別おすすめ教材まで。TOEICリスニング対策にも対応。",
};

const LEVELS = [
  {
    level: "初級（英検3〜準2級・TOEIC〜500点）",
    color: "from-sky-500 to-sky-600",
    badge: "bg-sky-100 text-sky-700",
    issues: ["音声が速すぎて聞き取れない", "単語は知っているのに聞き取れない", "集中が途切れると全部わからなくなる"],
    methods: ["NHK World JAPAN（英語ニュース、ゆっくり明瞭）", "VOA Learning English（学習者向け標準速度）", "英会話アニメ（Peppa Pig / Blippi）"],
    tip: "まず「聞き取れる素材」を見つけることが最優先。速い音声を無理やり聞いても上達しない。",
  },
  {
    level: "中級（英検2級〜準1級・TOEIC 600〜800点）",
    color: "from-emerald-500 to-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    issues: ["単語は知っているのにリエゾン（音の連結）で聞こえ方が変わる", "速い会話についていけない", "長文だと後半で意味が取れなくなる"],
    methods: ["BBC 6 Minute English（明瞭・スクリプト付き）", "TEDxトーク（日本語字幕 → 英語字幕 → 字幕なしの順）", "TOEIC公式問題集のPart 3・4を繰り返す"],
    tip: "シャドーイングでリエゾンに慣れると、自然な速度の英語がクリアに聞こえるようになる。",
  },
  {
    level: "上級（英検準1級〜1級・TOEIC 860点〜）",
    color: "from-purple-500 to-purple-600",
    badge: "bg-purple-100 text-purple-700",
    issues: ["ネイティブの速い会話で方言・スラングがわからない", "ポッドキャストの長尺コンテンツで集中力が続かない", "専門用語を含む音声が難しい"],
    methods: ["NPR Planet Money / How I Built This（ネイティブ自然速度）", "Harvard/MIT OpenCourseWare（学術英語）", "Netflix英語コンテンツ（字幕なし）"],
    tip: "語彙力がリスニングの上限を決める。知らない単語は音で聞いても理解できない。上位7,000語の定着が最優先。",
  },
];

const METHODS = [
  {
    name: "シャドーイング",
    icon: "🎧",
    effect: "★★★★★",
    time: "1日10〜15分",
    desc: "音声を聞きながら0.5〜1秒遅れて声に出して追いかける。リエゾン・イントネーション・発音が同時に身につく。リスニング上達の最速手段。",
    how: ["同じ素材を5日間繰り返す", "最初はテキストを見ながら → 慣れたら目を閉じて", "スマホで録音して自分の音声と比較"],
  },
  {
    name: "ディクテーション",
    icon: "✍️",
    effect: "★★★★",
    time: "1日15〜20分",
    desc: "音声を聞きながら文字に書き起こす。「聞こえているが意味がわからない」から「正確に聞き取れる」へのステップアップに最適。",
    how: ["1文ずつ止めながら書く", "聞き取れなかった箇所をスクリプトで確認", "特に苦手な音（/l/vs/r/、/v/vs/b/）に注目"],
  },
  {
    name: "多聴（たちょう）",
    icon: "🔊",
    effect: "★★★",
    time: "1日30〜60分",
    desc: "意味を理解しながら大量に聞く。通勤・通学中のながら聴きでも効果あり。ただし「わかる素材」でないと効果が薄い。",
    how: ["理解率70〜80%の素材を選ぶ", "同じトピックを繰り返し聴く", "単語を覚えながら並行して進める"],
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英語リスニング練習方法【初心者〜上級者別 完全ガイド】",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "url": "https://loop-vocabulary.app/guide/eigo-listening-renshu",
};

export default function EigoListeningRenshuPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eigo-listening-renshu" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英語リスニング練習方法【初心者〜上級者別 完全ガイド】","item":"https://loop-vocabulary.app/guide/eigo-listening-renshu"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-navy-400 mb-3">リスニングガイド</div>
        <h1 className="text-2xl font-black leading-tight">英語リスニング練習<br />完全攻略ガイド</h1>
        <p className="mt-2 text-sm text-navy-300">初心者〜上級者レベル別の最適な練習法</p>
        <div className="mt-4 flex justify-center gap-3 flex-wrap">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">TOEIC対応</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">英検対応</div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-xs">独学OK</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">リスニングが伸びない本当の理由</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            リスニングが伸びない最大の原因は<strong>「語彙不足」と「音の変化への未対応」</strong>の2つです。知らない単語は音で聞いても理解できません。また英語では「want to → wanna」「going to → gonna」のような音の変化（リエゾン・脱落）が多発します。この2つを同時に解決することで、リスニング力は急速に向上します。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "語彙不足", icon: "📚" },
              { label: "音の変化", icon: "🔊" },
              { label: "速度慣れ", icon: "⚡" },
            ].map((s) => (
              <div key={s.label} className="bg-navy-50 rounded-xl p-3">
                <div className="text-2xl">{s.icon}</div>
                <div className="text-xs font-bold text-navy-700 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="font-black text-navy-800 text-lg px-1">レベル別 最適な練習法</h2>
        {LEVELS.map((l) => (
          <div key={l.level} className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${l.color} px-5 py-4 text-white`}>
              <div className="font-black text-sm">{l.level}</div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="text-[11px] font-bold text-red-600 mb-1.5">よくある悩み</div>
                <ul className="space-y-1">
                  {l.issues.map((i) => (
                    <li key={i} className="text-xs text-navy-600 flex gap-2">
                      <span className="text-red-400 shrink-0">×</span>{i}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-bold text-navy-700 mb-1.5">おすすめ教材</div>
                <ul className="space-y-1">
                  {l.methods.map((m) => (
                    <li key={m} className="text-xs text-navy-600 flex gap-2">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-navy-50 pt-3">
                <p className="text-xs text-navy-600 leading-relaxed">💡 {l.tip}</p>
              </div>
            </div>
          </div>
        ))}

        <h2 className="font-black text-navy-800 text-lg px-1">3大リスニング練習法の比較</h2>
        {METHODS.map((m) => (
          <div key={m.name} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{m.icon}</span>
              <div>
                <div className="font-black text-navy-800">{m.name}</div>
                <div className="flex gap-3 text-[11px] text-navy-500">
                  <span>効果：{m.effect}</span>
                  <span>目安：{m.time}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-navy-600 leading-relaxed mb-3">{m.desc}</p>
            <ul className="space-y-1">
              {m.how.map((h) => (
                <li key={h} className="text-xs text-navy-600 flex gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>{h}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl border border-sky-100 p-5">
          <h2 className="font-black text-navy-800 mb-2">リスニングと語彙力の関係</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            リスニング力の上限は語彙力で決まります。どれだけ耳を鍛えても、知らない単語は聞き取れません。Loop Vocabularyでリスニングで出てきた単語をその場で登録し、SRS（忘却曲線）で定着させることで、リスニングと語彙を同時に強化できます。
          </p>
        </div>

        <AmazonBookSection
          heading="📚 リスニング練習おすすめ教材（Amazon）"
          books={[
            { title: "英語リスニングのお医者さん", author: "倉林秀男", asin: "4757433697", price: "¥1,760", label: "聞き取れない原因を解説" },
            { title: "公式TOEIC Listening & Reading 問題集10", author: "ETS", asin: "4906033989", price: "¥3,300", label: "公式リスニング対策" },
            { title: "シャドーイング・音読で学ぶ英語", author: "門田修平", asin: "4342765926", price: "¥2,530", label: "シャドーイング完全理解" },
            { title: "反復学習が言語習得に与える影響", author: "竹内理", asin: "4758921261", price: "¥3,080", label: "科学的な多聴の根拠" },
          ]}
        />

        <GuideEmailCapture slug="eigo-listening-renshu" />

        <div className="bg-gradient-to-r from-navy-800 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">リスニングで出た単語を即登録</div>
          <p className="text-sm text-navy-300 mb-4">シャドーイング機能搭載。聞き取れなかった単語をSRSで完全定着。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/shadowing" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">シャドーイング機能</Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eigo-hatsuon-renshu" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🗣️</div>
            <div className="font-bold text-navy-800 text-sm">発音練習ガイド</div>
          </Link>
          <Link href="/guide/toeic-900ten" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🎯</div>
            <div className="font-bold text-navy-800 text-sm">TOEIC 900点攻略</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/guide" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📚</div>
            <div className="font-bold text-navy-800 text-sm">学習ガイド一覧</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
