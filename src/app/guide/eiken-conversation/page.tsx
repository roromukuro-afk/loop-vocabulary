import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";

export const metadata: Metadata = {
  title: "英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】| Loop Vocabulary",
  description: "日常英会話・旅行英語・ビジネス会話で実際に使える単語とフレーズの覚え方を解説。感情表現・口語表現・依頼表現など場面別に厳選。SRSで会話フレーズを定着させる方法も紹介。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-conversation" },
  openGraph: {
    title: "英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】",
    description: "日常英会話・旅行英語で使えるフレーズと語彙の覚え方を場面別に解説。",
    url: "https://loop-vocabulary.app/guide/eiken-conversation",
    type: "article",
  },
};

const BOOKS = [
  { title: "英会話フレーズ大特訓", author: "Phyllis Tanaka", asin: "4010910720", price: "¥1,540", label: "日常英会話の決定版" },
  { title: "DUO 3.0", author: "鈴木陽一", asin: "4900790052", price: "¥1,430", label: "フレーズで覚える定番" },
  { title: "一億人の英文法", author: "大西泰斗・ポール・マクベイ", asin: "4757412940", price: "¥1,980", label: "使える英語の感覚を養う" },
];

const SCENES = [
  {
    icon: "💬",
    title: "日常会話・相づち",
    bg: "bg-emerald-50 border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
    phrases: [
      { en: "That makes sense.", jp: "なるほど、理解できた" },
      { en: "Absolutely.", jp: "もちろん・その通り" },
      { en: "No worries.", jp: "大丈夫、気にしないで" },
      { en: "Fair enough.", jp: "それなら納得だね" },
      { en: "I hear you.", jp: "言いたいことは分かるよ" },
    ],
  },
  {
    icon: "😊",
    title: "感情・気持ちを表す",
    bg: "bg-sky-50 border-sky-100",
    badge: "bg-sky-100 text-sky-700",
    phrases: [
      { en: "thrilled", jp: "大興奮している" },
      { en: "overwhelmed", jp: "圧倒されている" },
      { en: "relieved", jp: "ほっとした" },
      { en: "frustrated", jp: "イライラしている" },
      { en: "grateful", jp: "ありがたく思っている" },
    ],
  },
  {
    icon: "✈️",
    title: "旅行英語・必須語彙",
    bg: "bg-amber-50 border-amber-100",
    badge: "bg-amber-100 text-amber-700",
    phrases: [
      { en: "departure / arrival", jp: "出発 / 到着" },
      { en: "gate", jp: "搭乗口" },
      { en: "reservation", jp: "予約" },
      { en: "recommendation", jp: "おすすめ（料理など）" },
      { en: "allergy", jp: "アレルギー" },
    ],
  },
  {
    icon: "🤝",
    title: "依頼・提案フレーズ",
    bg: "bg-violet-50 border-violet-100",
    badge: "bg-violet-100 text-violet-700",
    phrases: [
      { en: "Could you...?", jp: "〜していただけますか？" },
      { en: "Would you mind helping me?", jp: "手伝っていただけますか？" },
      { en: "How about...?", jp: "〜はどうですか？" },
      { en: "Why don't we...?", jp: "〜しませんか？" },
      { en: "I was wondering if...", jp: "〜していただけないかと思いまして" },
    ],
  },
];

const TRAVEL_CATEGORIES = [
  {
    title: "空港・交通",
    icon: "✈️",
    words: [
      { en: "departure / arrival", jp: "出発 / 到着" },
      { en: "gate", jp: "搭乗口" },
      { en: "transit", jp: "乗り継ぎ" },
      { en: "fare", jp: "運賃" },
    ],
  },
  {
    title: "ホテル",
    icon: "🏨",
    words: [
      { en: "check-in / check-out", jp: "チェックイン / チェックアウト" },
      { en: "reservation", jp: "予約" },
      { en: "vacancy", jp: "空室" },
      { en: "concierge", jp: "コンシェルジュ" },
    ],
  },
  {
    title: "レストラン",
    icon: "🍽️",
    words: [
      { en: "menu", jp: "メニュー" },
      { en: "recommendation", jp: "おすすめ" },
      { en: "allergy", jp: "アレルギー" },
      { en: "bill（英）/ check（米）", jp: "会計・勘定" },
      { en: "takeaway（英）/ takeout（米）", jp: "持ち帰り" },
    ],
  },
];

const TIPS = [
  {
    num: "01",
    icon: "🗂️",
    title: "フレーズ単位で登録する",
    desc: "単語1語ではなく「No worries.」「That makes sense.」のようにフレーズごと Loop Vocabulary に登録する方法もあります。文脈ごと覚えることで、会話の中でも使いやすくなることがあります。",
  },
  {
    num: "02",
    icon: "🎧",
    title: "音声で発音を耳に入れる",
    desc: "英会話では発音を耳で確認することも役立ちます。対応するブラウザでは、単語を登録した後に音声読み上げボタンで発音を確認できます。音声は発音確認の一つの手がかりとして使いましょう。",
  },
  {
    num: "03",
    icon: "📓",
    title: "日常で出会った表現を即登録",
    desc: "ドラマ・映画・英語ニュースで「これ何だろう？」と思った表現をその場で Loop Vocabulary に登録しておくと、後から復習しやすくなります。",
  },
  {
    num: "04",
    icon: "✍️",
    title: "アウトプットで定着させる",
    desc: "覚えたフレーズを英語日記・SNS投稿・メモで使ってみましょう。読むだけでなく書く・言う練習も、定着を助ける方法の一つです。",
  },
];

const CYCLE = [
  { icon: "📥", step: "Input", desc: "フレーズ・単語を登録" },
  { icon: "🔄", step: "Review", desc: "SRSで自動復習" },
  { icon: "📤", step: "Output", desc: "会話・日記で使う" },
  { icon: "📊", step: "Feedback", desc: "苦手フレーズを管理" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】",
  "description": "日常英会話・旅行英語・ビジネス会話で実際に使える単語とフレーズの覚え方を解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-12-15",
  "dateModified": "2026-07-24",
  "url": "https://loop-vocabulary.app/guide/eiken-conversation",
};

export default function EikenConversationPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】" }]} />
      </div>

      <GuideTracker slug="eiken-conversation" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英会話でよく使う英単語の覚え方【場面別フレーズ・旅行英語】","item":"https://loop-vocabulary.app/guide/eiken-conversation"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-emerald-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 font-semibold mb-3">
            英会話
          </div>
          <h1 className="text-2xl font-black leading-tight">英会話でよく使う<br />英単語の覚え方</h1>
          <p className="mt-2 text-sm text-emerald-200 max-w-sm mx-auto">日常会話・旅行・ビジネスで使えるフレーズと語彙を場面別に紹介</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* リード */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">英会話の語彙は「教科書英語」と何が違う？</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            テストで高得点でも英会話が苦手な人が多い理由は、<strong>知識として単語を知っているが瞬時に口から出てこない</strong>から。英会話に必要なのは丸暗記でなく「フレーズ単位での使い慣れ」です。相づち・感情表現・依頼フレーズを場面別に覚えるのも一つの方法です。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "学習シーン", value: "4場面" },
              { label: "場面別フレーズ", value: "20件" },
              { label: "学習方法", value: "4つ" },
            ].map((s) => (
              <div key={s.label} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-xs font-black text-emerald-800">{s.value}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 場面別フレーズ */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">場面別 英会話フレーズ集</h2>
          <div className="space-y-4">
            {SCENES.map((scene) => (
              <div key={scene.title} className={`rounded-xl border p-4 ${scene.bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{scene.icon}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${scene.badge}`}>{scene.title}</span>
                </div>
                <div className="space-y-2">
                  {scene.phrases.map((p) => (
                    <div key={p.en} className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-navy-800 flex-1">{p.en}</span>
                      <span className="text-navy-500 text-right shrink-0">{p.jp}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 旅行英語 必須語彙 */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">旅行英語 必須語彙</h2>
          <p className="text-sm text-navy-700 leading-relaxed mb-4">
            旅行中に使う可能性のある基本表現を、場面別に整理しました。
          </p>
          <div className="space-y-4">
            {TRAVEL_CATEGORIES.map((cat) => (
              <div key={cat.title} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">{cat.title}</span>
                </div>
                <div className="space-y-1.5">
                  {cat.words.map((w) => (
                    <div key={w.en} className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-navy-800 flex-1">{w.en}</span>
                      <span className="text-navy-500 text-right shrink-0">{w.jp}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 覚え方4tips */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-4">英会話フレーズを定着させる4つのコツ</h2>
          <div className="space-y-4">
            {TIPS.map((t) => (
              <div key={t.num} className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-700 text-white font-black text-xs flex items-center justify-center">{t.icon}</div>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{t.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 学習サイクル */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-4">英会話力を上げる学習サイクル</h2>
          <div className="flex items-center justify-between gap-1">
            {CYCLE.map((c, i) => (
              <div key={c.step} className="flex items-center gap-1">
                <div className="text-center">
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-[10px] font-black text-emerald-800">{c.step}</div>
                  <div className="text-[9px] text-navy-600 mt-0.5 leading-tight max-w-[60px]">{c.desc}</div>
                </div>
                {i < CYCLE.length - 1 && (
                  <div className="text-emerald-400 font-black text-lg mx-1">→</div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-700 mt-4 font-medium text-center">
            このサイクルを繰り返すことで、フレーズを使いやすくなることがあります（定着度には個人差があります）。
          </p>
        </div>

        {/* 教科書英語との違い */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">知っておきたい口語 vs 書き言葉</h2>
          <div className="space-y-2">
            {[
              { formal: "I understand.", casual: "Got it. / I see.", note: "口語では短く切る" },
              { formal: "I apologize.", casual: "Sorry! / My bad.", note: "Sorry!は一般的なカジュアル表現、My bad.はさらにくだけた表現（親しい間柄向け）" },
              { formal: "Could you assist me?", casual: "Can you help me?", note: "Canは日常的で直接的、Couldはより丁寧に聞こえることがある。相手や場面に応じて使い分ける。" },
              { formal: "I am unable to attend.", casual: "I can't make it.", note: "make it = 都合がつく" },
            ].map((r) => (
              <div key={r.formal} className="bg-navy-50 rounded-xl p-3">
                <div className="flex gap-2 text-xs">
                  <div className="flex-1">
                    <div className="text-[10px] text-navy-400 font-semibold">書き言葉</div>
                    <div className="font-mono font-semibold text-navy-700 mt-0.5">{r.formal}</div>
                  </div>
                  <div className="text-navy-300">→</div>
                  <div className="flex-1">
                    <div className="text-[10px] text-emerald-600 font-semibold">口語</div>
                    <div className="font-mono font-semibold text-emerald-700 mt-0.5">{r.casual}</div>
                  </div>
                </div>
                <div className="text-[10px] text-navy-500 mt-1.5 border-t border-navy-100 pt-1.5">💡 {r.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Amazon書籍 */}
        <AmazonBookSection books={BOOKS} heading="📚 英会話・フレーズにおすすめの参考書（Amazon）" />

        {/* メールキャプチャ */}
        <GuideEmailCapture slug="eiken-conversation" />

        {/* CTA */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">Loop Vocabulary でフレーズを定着させる</div>
          <p className="text-sm text-emerald-200 mb-4">場面別フレーズをSRSで自動管理。AI解説は使い方を確認する目安として活用できます。</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-sm hover:bg-emerald-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/vocab-check/eiken"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              英検語彙チェック
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/business-english-tango", tag: "ビジネス英語", title: "ビジネス英語の必須単語・表現と実践的な覚え方" },
              { href: "/guide/eitango-oboeru-houhou", tag: "学習法", title: "英単語の覚え方・効率的な記憶術【自己想起×忘却曲線】" },
              { href: "/guide/ielts-tango", tag: "IELTS", title: "IELTSの英単語学習法【アカデミック語彙を効率的に覚える】" },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
                <div className="text-[11px] text-sky-600 font-semibold mb-0.5">{r.tag}</div>
                <div className="text-sm font-semibold text-navy-800">{r.title}</div>
              </Link>
            ))}
          </div>
        </div>

        <GuideMaterialCTA
          heading="日常英会話の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000036", title: "日常英会話 基礎フレーズ" },
            { id: "00000000-0000-0000-0000-000000000051", title: "loop学びなおし英単語①【日常生活】" },
          ]}
        />

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
