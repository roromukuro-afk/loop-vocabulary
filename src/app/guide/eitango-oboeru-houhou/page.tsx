import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { GuideByline } from "@/components/guide/GuideByline";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "eitango-oboeru-houhou";

// 2026-07-21: 総合監査で「英単語の覚え方【自己想起の科学】」(旧 /guide/how-to-memorize-english-words)
// との内容重複・「科学的に証明された」等の根拠を示さない断定表現を指摘され、本ページへ統合した。
// 旧URLは next.config.js の redirects() で本ページへ308リダイレクトしている。
export const metadata: Metadata = {
  title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】| Loop Vocabulary",
  description:
    "英単語が覚えられない・すぐ忘れる悩みに、自己想起（アクティブリコール）・忘却曲線に沿った復習スケジュールの決まり方・語源学習・例文記憶など、研究にもとづく考え方と実践のコツを解説。英検・TOEIC・大学受験対応。",
  openGraph: {
    title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】",
    description: "自己想起・忘却曲線に沿った復習を中心に、英単語の覚え方を7つのアプローチで解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const METHODS = [
  {
    icon: "🎯",
    title: "自己想起（アクティブリコール）で「わかる」と「思い出せる」の差を埋める",
    level: "研究で支持",
    color: "from-rose-500 to-rose-600",
    body: "選択肢や日本語訳を見て「知っている」と感じる感覚（再認）と、何もない状態から自力で意味を引き出す力（想起）は別の働きです。答えを見ながら単語帳を眺めるだけでは、何もない状態から意味を思い出す練習が不足しやすく、テストや読解で必要な想起との間に差が生じることがあります。答えを見る前に、まず自分の力で思い出そうとする練習（自己想起）に切り替えることが、多くの学習法の中でも効果が比較的大きいとされています。",
    tips: [
      "単語だけを見て、日本語訳を自分の力で思い出してから答え合わせをする",
      "「すぐ思い出せた／時間がかかった／思い出せなかった」で自己評価する",
      "思い出せなかった単語こそ、語源やAI解説で深掘りする",
      "4択は消去法で正解できる場合があるため、自己想起の練習と組み合わせる",
    ],
  },
  {
    icon: "🧠",
    title: "忘却曲線に沿って復習タイミングを分散する（SRS）",
    level: "研究で支持",
    color: "from-emerald-500 to-emerald-600",
    body: "一夜漬けのように詰め込んで一度に覚えるより、忘れかけたタイミングで復習を繰り返す方が長期的に記憶に残りやすい傾向があります。この「間隔を空けて復習する」考え方をもとに、SRS（間隔反復システム）は次の復習タイミングを自動で計算します。具体的には、単語ごとに「思い出しやすさ」を示す指標を持ち、正解した直前の間隔にこの指標を掛けて次の間隔を決めます。簡単だった単語は指標が上がってさらに間隔が伸び、もう一度と答えた単語は指標に関わらず翌日に戻ります。単語ごと・人ごとに指標が異なるため、全員・全単語に共通する「◯日後」という固定スケジュールはありません。仕組みの詳細と毎日の組み立て方は、専用記事で解説しています。",
    tips: [
      "最初は1日10〜20語程度を目安にし、復習量や学習時間に合わせて調整する",
      "アプリの「復習待ち」を優先してこなす",
      "同じ単語でも、答えた学習モード（フラッシュカード・タイピング・4択など）によって次の間隔の伸び方が変わる",
      "詳しい仕組みは「忘却曲線と英単語の復習タイミング」も参照",
    ],
    linkTo: { href: "/guide/spaced-repetition-english-vocabulary", label: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】を読む →" },
  },
  {
    icon: "🔤",
    title: "語源（ルーツ）から単語を体系的に覚える",
    level: "応用力UP",
    color: "from-sky-500 to-sky-600",
    body: "英語の単語の多くはラテン語・ギリシャ語由来の語根を持っています。「pre-（前）」「re-（再）」「-tion（名詞化）」などの接頭辞・接尾辞を覚えると、未知の単語でも意味を推測しやすくなります。例：predict（予測する）= pre（前）+ dict（言う）＝前もって言う。",
    tips: [
      "頻出接頭辞（pre, re, un, in, dis, mis…）を先に覚える",
      "語根（rupt=壊す・duct=導く）を意識して単語を分解する",
      "派生語（happy / happiness / unhappy）をセットで学ぶ",
    ],
  },
  {
    icon: "📖",
    title: "例文・文脈で覚える",
    level: "使い方まで確認",
    color: "from-purple-500 to-purple-600",
    body: "例文の中で確認すると、意味だけでなく使い方や一緒に使われやすい語も確認できます。「persevere = 頑張る」より「She persevered through difficulties.（彼女は困難を乗り越えて頑張り続けた）」のように、具体的な文で覚えることで意味・使い方・コロケーションを同時に押さえられます。",
    tips: [
      "自分で例文を作ってみる（アウトプット学習）",
      "英英辞典の定義文を例文として読んでみる",
      "AIで新しい例文を生成し、複数の文脈で確認する",
    ],
  },
  {
    icon: "🎵",
    title: "語呂合わせ・イメージ記憶法（ニーモニック）",
    level: "短期記憶向け",
    color: "from-amber-500 to-amber-600",
    body: "「bizarre（奇妙な）＝ビザールみたいなビールを飲む奇妙な人」のように、音と意味を結びつけるイメージ記憶法（ニーモニック）は、短期間で単語を覚えるとっかかりとして使われています。試験直前の詰め込みには向きますが、それだけでは長期記憶に残りにくいため、上記の自己想起・SRSと組み合わせるのが現実的です。",
    tips: [
      "音の響きから連想できる日本語イメージを作る",
      "視覚的なイメージ（絵）と一緒に覚える",
      "語呂合わせはあくまで「とっかかり」として使い、復習も忘れない",
    ],
  },
  {
    icon: "✍️",
    title: "書いて覚える（書字記憶法）",
    level: "試験対策向け",
    color: "from-indigo-500 to-indigo-600",
    body: "書く練習は、スペルを見ずに自力で再現できるか確認する方法として使えます。ただし「ただ写す」だけでは確認の意味が薄く、意味を意識しながら書くこと・書いた後に答えを隠して正しく書けるか確認するステップが重要です。",
    tips: [
      "回数だけを増やさず、最後に答えを隠して正しく書けるか確認する",
      "発音しながら書く",
      "英検・入試の入力形式の問題で、書く練習を兼ねる",
    ],
  },
  {
    icon: "👂",
    title: "聞いて覚える・シャドーイング",
    level: "リスニング対策",
    color: "from-teal-500 to-teal-600",
    body: "「読んで意味は分かるのに、聞くと分からない」状態を防ぐには、単語を覚える段階で音声も一緒に確認しておくことが役立ちます。発音・リスニングに特化した取り入れ方は、専用記事で詳しく解説しています。",
    tips: [
      "単語を覚えるときは必ず音声を聞く",
      "通勤・通学中のシャドーイングで効率よく復習",
    ],
    linkTo: { href: "/guide/listening-and-pronunciation-vocabulary", label: "単語を音で覚える【音声ファースト学習法】を読む →" },
  },
];

const MISTAKES = [
  { title: "1日に覚えようとする単語が多すぎる", fix: "1日10〜20語程度を目安に絞る。量より「思い出せる状態」を重視する。" },
  { title: "覚えたらそれで終わり（復習しない）", fix: "SRSで復習サイクルを回す。覚えた翌日・3日後・1週間後に復習する。" },
  { title: "日本語訳だけで覚えようとする", fix: "例文・語源・発音もセットで覚える。意味だけでは使い方が身につきにくい。" },
  { title: "単語帳をただ眺めるだけ（想起の練習が不足しがち）", fix: "答えを隠してから自分の力で思い出す（自己想起）練習を組み込む。" },
  { title: "自己想起で正答率が下がると不安になる", fix: "自己想起は再認より負荷が高い作業のため、最初は正答率が下がったように感じることがあります。これは記憶が弱くなったのではなく、負荷の高い練習に切り替わったサインです。" },
  { title: "継続できずにリセットを繰り返す", fix: "1日5語でもいい。完璧主義をやめて、習慣化を優先する。" },
];

const FAQ_ITEMS = [
  {
    q: "「わかる」のに単語テストで思い出せないのはなぜですか？",
    a: "選択肢や日本語訳を見て「知っている」と感じる感覚（再認）と、何もない状態から自力で意味を引き出す力（想起）は別の働きです。答えを見ながら単語帳を眺めるだけでは、何もない状態から意味を思い出す練習が不足しやすく、テストや読解で必要な想起との間に差が生じることがあります。",
  },
  {
    q: "自己想起（アクティブリコール）とは何ですか？",
    a: "答えを見る前に、自分の記憶だけで意味やスペルを引き出そうとする学習法です。フラッシュカードで単語だけを見て意味を思い出そうとする、あるいは日本語だけを見て英単語を書き出そうとするのが典型例です。",
  },
  {
    q: "自己想起・SRS以外の方法は意味がないのですか？",
    a: "いいえ。語源・例文・語呂合わせ・書字・音声はいずれも実際に役立つ補助的な方法です。特に語源やイメージ記憶は、初見の単語を推測したり短期的に覚えたりする場面で有効です。ただし長期的に「思い出せる」状態を作るには、自己想起とSRSによる復習を土台にするのが現実的です。",
  },
  {
    q: "この記事の内容で必ず成績が上がりますか？",
    a: "保証するものではありません。学習効果には個人差があり、単語学習だけで試験の合否や成績が決まるわけでもありません。ここで紹介しているのは、学習法の一つの考え方としてご活用いただける内容です。",
  },
  {
    q: "英単語を長期記憶にするための復習スケジュールの目安はありますか？",
    a: "全員・全単語に共通する固定の「◯日後」というスケジュールはありません。Loop Vocabularyでは単語ごとに「思い出しやすさ」を示す指標を持ち、正解のたびに直前の間隔とこの指標をもとに次の復習日を計算します。目安として、初めて正解した単語は数日以内に再出題され、簡単だったと答えた単語ほど次第に間隔が伸びていきます（間隔の上限は半年程度）。逆に「もう一度」と答えた単語は、それまでの間隔に関係なく翌日に戻ります。同じ単語でも、答えた学習モードやこれまでの自己評価によって具体的な日数は変わります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】",
  description: "自己想起・忘却曲線に沿った復習を中心に、英単語の覚え方を7つのアプローチで解説する。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-06-15",
  dateModified: "2026-09-03",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "英単語の覚え方・効率的な記憶術", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function EitangoOboeruPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英単語の覚え方・効率的な記憶術" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">学習法ガイド</div>
          <h1 className="text-2xl font-black leading-tight">英単語の覚え方</h1>
          <p className="mt-2 text-sm text-navy-300">自己想起と忘却曲線を軸に、7つのアプローチで語彙学習を見直す</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* 誰向けの記事か・この記事で分かること */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="text-[11px] font-bold text-navy-500 mb-1">対象読者</div>
          <p className="text-sm text-navy-700 leading-relaxed mb-3">
            単語帳を繰り返し見ているのにテストで思い出せない、覚え方が非効率だと感じている中学生〜社会人の英語学習者向けです。
          </p>
          <div className="text-[11px] font-bold text-navy-500 mb-1">この記事で分かること</div>
          <p className="text-sm text-navy-700 leading-relaxed">
            なぜ「見れば分かる」のにテストで思い出せないのか、その差を埋める自己想起（アクティブリコール）の練習法、忘却曲線に沿った復習の考え方、語源・例文・語呂合わせ・書字・音声を使った補助的な覚え方、よくある失敗とその対策を解説します。
          </p>
        </div>

        {/* 結論 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 英単語は「見て分かる（再認）」だけでなく「見ずに思い出せる（想起）」練習をすることで、忘れにくくなる傾向があります。答えを隠してから自分の力で思い出す習慣（自己想起）に切り替え、忘れかけたタイミングで復習を繰り返す（分散学習・SRS）ことが、以下で紹介する他の方法よりも比較的優先度の高いアプローチだとされています。
          </p>
        </div>

        {/* なぜ覚えられないのか */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">なぜ「覚えたはず」なのに思い出せないのか</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            単語帳を何周もしたのに、テストになると意味が出てこない。これは記憶力そのものの問題というより、練習していた作業とテストで求められる作業がズレていることが原因のことが多いです。単語帳を眺める・日本語訳を読む作業は「見れば思い出せる」という<strong>再認（recognition）</strong>の力を鍛えます。一方でテストや長文読解、会話で必要なのは、手がかりなしで意味を引き出す<strong>想起（recall）</strong>の力です。この2つは似ているようで別の働きであり、再認だけを繰り返しても想起力はあまり伸びません。
          </p>
        </div>

        {/* 7つの方法 */}
        <div>
          <h2 className="font-black text-navy-800 text-lg px-1 mb-3">覚え方・7つのアプローチ</h2>
          <div className="space-y-4">
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
                  {m.linkTo && (
                    <Link href={m.linkTo.href} className="inline-block mt-3 text-xs text-sky-700 font-semibold hover:underline">
                      {m.linkTo.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

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

        {/* 実践手順 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-4">実践手順（1語あたり数分の目安）</h2>
          <div className="space-y-3">
            {[
              { step: "1", label: "音声を聞く", detail: "発音を確認する" },
              { step: "2", label: "答えを隠して思い出す（自己想起）", detail: "日本語訳を自分の力で思い出そうとしてから、答え合わせをする" },
              { step: "3", label: "仕上げの確認", detail: "4択・入力テストで最終確認（4択は消去法で正解できる場合があるため、自己想起の練習と組み合わせる）" },
              { step: "4", label: "復習スケジュールに乗せる", detail: "翌日・3日後・1週間後…とSRSが自動計算する復習タイミングに従う" },
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

        {/* Loop Vocabularyでの使い方 */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabularyでの使い方</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyのフラッシュカードは、意味を隠した状態から始まり、自分で思い出してから正誤を自己評価する設計になっています。「覚えたつもり」を防ぐ意図で、答えを先に見せない流れにしています。思い出せなかった（forgot）と答えたカードでは、その場でAI解説の導線が表示され、任意でタップすると語源やニュアンスを確認できます（自動では呼び出されません）。評価結果は忘却曲線（SRS）に反映され、思い出しにくい単語ほど早いタイミングで再出題されます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-white rounded-xl border border-navy-100 p-4">
              <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
              <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
                <li>フラッシュカードで自己想起の練習</li>
                <li>忘却曲線（SRS）による自動復習</li>
                <li>4択・入力テストでの仕上げ確認</li>
                <li>単語帳の作成・教材のインポート</li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-navy-100 p-4">
              <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
              <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
                <li>思い出せなかった単語のAI解説を1日300回まで利用</li>
                <li>AI弱点分析で「想起が苦手な単語」の傾向を確認</li>
                <li>広告非表示</li>
              </ul>
              <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
            </div>
          </div>
        </div>

        {/* 出典・参考情報 */}
        <GuideByline
          targetAudience="単語帳を繰り返しても本番で思い出せない、と感じている中学生〜社会人の英語学習者向け"
          sources={
            <>
              下記の論文は、自己想起（検索練習・testing effect）と分散学習（忘却曲線に沿った復習、SRSの考え方の土台）の2つを、認知・教育心理学分野で「高い有用性（high utility）」があると評価しています。学習法全般を対象とした知見であり、英単語学習に限定して検証した研究ではありません。効果には個人差があります。
              <br />
              <a
                href="https://doi.org/10.1177/1529100612453266"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sky-700 underline"
              >
                Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., &amp; Willingham, D. T. (2013). Improving Students&apos; Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology. <em>Psychological Science in the Public Interest</em>, 14(1), 4-58. DOI: 10.1177/1529100612453266
              </a>
              <br />
              解説ページ:{" "}
              <a
                href="https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sky-700 underline"
              >
                Association for Psychological Science
              </a>
              （閲覧日: 2026-07-21）
              <br />
              なお、語源・例文・語呂合わせ・書字・音声を使った覚え方は、本記事で実践上有用な方法として紹介していますが、上記論文で直接検証されたものではありません。
            </>
          }
          lastUpdated="2026-09-03"
          changelog={[
            { date: "2026-09-03", note: "GSCで実際に検索されているクエリ(「英単語 長期記憶 復習 スケジュール」)を踏まえ、SRSの復習間隔が実際どう計算されるか(単語ごとの動的な指標・学習モード別の重み付け)を具体化し、関連FAQを追加。" },
            { date: "2026-07-21", note: "レビュー指摘を受け、手法数の表記統一・断定的な言い回しの修正・出典の対象範囲の明確化を実施。" },
            { date: "2026-07-21", note: "「英単語の覚え方【自己想起の科学】」の内容を統合。根拠のない断定表現を修正し、出典を明記。" },
            { date: "2026-07-12", note: "（統合前の旧記事にて）対象者・出典・更新履歴セクションを追加" },
          ]}
        />

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="text-sm font-bold text-navy-800 mb-2">よくある質問</div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* アプリCTA */}
        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">自己想起の練習を今日から無料で始める</div>
          <p className="text-sm text-navy-300 mb-4">
            Loop Vocabulary は自己想起の練習と忘却曲線（SRS）を組み合わせたフラッシュカード学習を無料で利用できます。
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">現在の語彙力を確認する</Link>
            <Link href="/tools/vocab-test-maker" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">自己想起用のテストを無料作成</Link>
          </div>
        </div>

        <GuideEmailCapture slug={SLUG} />

        <AmazonBookSection
          heading="📚 英単語学習おすすめ参考書（Amazon）"
          books={[
            { title: "英単語の語源図鑑", author: "清水建二・すずきひろし", asin: "4046021969", price: "¥1,650", label: "語源学習の定番" },
            { title: "システム英単語 改訂新版", author: "霜康司・刀祢雅彦", asin: "4796111727", price: "¥1,210", label: "大学受験・TOEIC兼用" },
            { title: "ターゲット1900 6訂版", author: "旺文社", asin: "4010773634", price: "¥1,100", label: "大学受験最定番" },
            { title: "TOEIC L&Rテスト 出る単特急 金のフレーズ", author: "TEX加藤", asin: "4023315079", price: "¥990", label: "TOEIC最強単語帳" },
          ]}
        />

        {/* 関連記事・関連機能 */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/spaced-repetition-english-vocabulary", tag: "学習法", title: "忘却曲線と英単語の復習タイミング【SRSの仕組みを解説】" },
              { href: "/guide/flashcards-vs-multiple-choice", tag: "学習法", title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】" },
              { href: "/guide/listening-and-pronunciation-vocabulary", tag: "学習法", title: "単語を音で覚える【音声ファースト学習法】" },
              { href: "/guide/eitango-oboerarenai", tag: "学習法", title: "英単語が覚えられない原因と解決法" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

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

        <GuideMaterialCTA
          heading="覚えたい単語を自分の単語帳へ追加する"
          materials={[
            { id: "10000000-0000-0000-0000-000000000102", title: "高校英単語 基礎100" },
            { id: "00000000-0000-0000-0000-000000000020", title: "大学入試頻出英単語 2000+" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
