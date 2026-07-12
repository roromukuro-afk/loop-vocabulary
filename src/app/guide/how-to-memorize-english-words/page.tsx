import type { Metadata } from "next";
import Link from "next/link";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { GuideByline } from "@/components/guide/GuideByline";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "how-to-memorize-english-words";

export const metadata: Metadata = {
  title: "英単語の覚え方【「わかる」と「思い出せる」は違う】自己想起の科学 | Loop Vocabulary",
  description:
    "英単語が覚えられないのは、才能ではなく「わかる（再認）」と「思い出せる（想起）」を混同しているからかもしれません。認知心理学の考え方をもとに、自己想起（アクティブリコール）を使った覚え方を解説します。",
  openGraph: {
    title: "英単語の覚え方【「わかる」と「思い出せる」は違う】",
    description: "再認と想起の違いを理解して、忘れにくい覚え方に切り替える方法を解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "「わかる」のに単語テストで思い出せないのはなぜですか？",
    a: "選択肢や日本語訳を見て「知っている」と感じる感覚（再認）と、何もない状態から自力で意味を引き出す力（想起）は別の脳の働きです。単語帳を眺めるだけの学習は再認力しか鍛えられず、テストや読解で必要な想起力とズレが生まれます。",
  },
  {
    q: "自己想起（アクティブリコール）とは何ですか？",
    a: "答えを見る前に、自分の記憶だけで意味やスペルを引き出そうとする学習法です。フラッシュカードで単語だけを見て意味を思い出そうとする、あるいは日本語だけを見て英単語を書き出そうとするのが典型例です。",
  },
  {
    q: "自己想起を今日から始めるにはどうすればいいですか？",
    a: "まず単語帳や参考書を「答えを隠して」読む習慣をつけましょう。Loop Vocabularyのフラッシュカードは意味を隠した状態から始まり、自分の力で思い出してから答え合わせをする流れになっています。",
  },
  {
    q: "4択問題は自己想起の練習になりませんか？",
    a: "4択は選択肢の中から選ぶ「再認」寄りの形式です。消去法や見覚えだけでも正解できてしまうことがあるため、仕上げの確認には有効ですが、それだけに頼ると自力で思い出す力が育ちにくい面があります。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "英単語の覚え方【「わかる」と「思い出せる」は違う】自己想起の科学",
  description:
    "再認と想起の違いを理解し、自己想起（アクティブリコール）を使った英単語の覚え方を解説します。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-08",
  dateModified: "2026-07-08",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "英単語の覚え方【自己想起の科学】", item: `${SITE_URL}/guide/${SLUG}` },
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

export default function HowToMemorizeEnglishWordsPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 font-semibold mb-3">学習法</div>
          <h1 className="text-2xl font-black leading-tight">英単語の覚え方<br />「わかる」と「思い出せる」は違う</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">認知心理学でいう「再認」と「想起」の違いから、忘れにくい覚え方を見直します。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 英単語は「見て分かる（再認）」だけでなく「見ずに思い出せる（想起）」練習をすることで忘れにくくなります。答えを隠してから自分の力で思い出す習慣に切り替えるのが、最も効果の大きい一歩です。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">なぜ「覚えたはず」なのに思い出せないのか</h2>
          <p className="text-sm font-semibold text-navy-800 mb-2">再認と想起という別の力を鍛える練習をしているためです。</p>
          <p className="text-sm text-navy-700 leading-relaxed">
            単語帳を何周もしたのに、テストになると意味が出てこない。これは記憶力の問題というより、練習していた作業とテストで求められる作業がズレていることが原因のことが多いです。単語帳を眺める・日本語訳を読む作業は「見れば思い出せる」という<strong>再認（recognition）</strong>の力を鍛えます。一方でテストや長文読解、会話で必要なのは、手がかりなしで意味を引き出す<strong>想起（recall）</strong>の力です。この2つは似ているようで別の作業であり、再認だけを繰り返しても想起力はあまり伸びません。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">解決策：自己想起（アクティブリコール）を練習に組み込む</h2>
          <div className="space-y-3">
            {[
              { icon: "1️⃣", title: "答えを隠してから始める", desc: "単語だけを見て、日本語訳を自分の力で思い出そうとしてから答え合わせをする。これだけで再認から想起への切り替えができます。" },
              { icon: "2️⃣", title: "「言えたか・言えなかったか」で自己評価する", desc: "正解率だけでなく「すぐ思い出せたか、時間がかかったか、思い出せなかったか」を意識すると、次に見直すタイミングの精度が上がります。" },
              { icon: "3️⃣", title: "思い出せなかった単語こそ深掘りする", desc: "想起に失敗した単語は、語源やAI解説で「なぜ覚えにくいか」を確認すると定着しやすくなります。" },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">Loop Vocabularyでの使い方</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            Loop Vocabularyのフラッシュカードは、意味を隠した状態から始まり、自分で思い出してから正誤を自己評価する設計になっています。「覚えたつもり」を防ぐ意図で、答えを先に見せない流れにしています。思い出せなかった（forgot）と答えたカードでは、その場でAI解説の導線が表示され、任意でタップすると語源やニュアンスを確認できます（自動では呼び出されません）。評価結果は忘却曲線（SRS）に反映され、思い出しにくい単語ほど早いタイミングで再出題されます。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <li>タイピング・リスニング練習</li>
              <li>広告非表示</li>
            </ul>
            <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">月額 ¥480〜 プレミアムを見る →</Link>
          </div>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>自己想起は再認より疲れる作業のため、最初は正答率が下がったように感じることがあります。これは記憶が弱いのではなく、負荷の高い練習に切り替わったサインです。</li>
            <li>この記事の内容で必ず成績が上がることを保証するものではありません。学習法の一つの考え方としてご活用ください。</li>
          </ul>
        </div>

        <GuideByline
          targetAudience="単語帳を繰り返しても本番で思い出せない、と感じている中学生〜社会人の英語学習者向け"
          sources="「検索練習(retrieval practice)」「テスト効果(testing effect)」と呼ばれる、認知心理学で広く支持されている研究領域の考え方を一般向けに要約したものです。特定の論文の引用ではありません。"
          lastUpdated="2026-07-12"
          changelog={[{ date: "2026-07-12", note: "対象者・出典・更新履歴セクションを追加" }]}
        />

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

        <GuideEmailCapture slug={SLUG} />

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">自己想起の練習をLoop Vocabularyで始める</div>
          <p className="text-sm text-navy-300 mb-4">フラッシュカード × 忘却曲線 × AI解説。無料で今すぐ使えます。</p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/flashcards-vs-multiple-choice", tag: "学習法", title: "フラッシュカードと4択テストの違い【消去法で正解するリスク】" },
              { href: "/guide/spaced-repetition-english-vocabulary", tag: "学習法", title: "忘却曲線と復習タイミングの科学【いつ復習すればいいか】" },
              { href: "/guide/eitango-oboerarenai", tag: "学習法", title: "英単語が覚えられない原因と解決法【記憶科学で攻略】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="思い出す練習を今すぐ試す"
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
