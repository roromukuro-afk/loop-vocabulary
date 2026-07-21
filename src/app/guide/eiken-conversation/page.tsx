import type { Metadata } from "next";
import Link from "next/link";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";

export const metadata: Metadata = {
  title: "英会話に効く英単語の覚え方【使えるフレーズ・旅行英語を習得】| Loop Vocabulary",
  description: "日常英会話・旅行英語・ビジネス会話で実際に使える単語とフレーズの覚え方を解説。感情表現・口語表現・依頼表現など場面別に厳選。SRSで会話フレーズを定着させる方法も紹介。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-conversation" },
  openGraph: {
    title: "英会話に効く英単語の覚え方【場面別フレーズ・旅行英語】",
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
      { en: "Absolutely.", jp: "全くその通り" },
      { en: "No worries.", jp: "大丈夫、気にしないで" },
      { en: "Fair enough.", jp: "まあ、そうだね" },
      { en: "I hear you.", jp: "おっしゃる通り" },
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
      { en: "Would you mind...?", jp: "〜してもいいですか？" },
      { en: "How about...?", jp: "〜はどうですか？" },
      { en: "Why don't we...?", jp: "〜しませんか？" },
      { en: "I was wondering if...", jp: "もし〜できますでしょうか" },
    ],
  },
];

const TIPS = [
  {
    num: "01",
    icon: "🗂️",
    title: "フレーズ単位で登録する",
    desc: "単語1語ではなく「No worries.」「That makes sense.」のようにフレーズごと Loop Vocabulary に登録。文脈ごと記憶することで実際の会話でも即座に出てくる。",
  },
  {
    num: "02",
    icon: "🎧",
    title: "音声で発音を耳に入れる",
    desc: "英会話では発音が重要。単語を登録したら音声読み上げボタンで正しい発音を確認。聞き慣れることでネイティブの英語が聞き取りやすくなる。",
  },
  {
    num: "03",
    icon: "📓",
    title: "日常で出会った表現を即登録",
    desc: "ドラマ・映画・英語ニュースで「これ何だろう？」と思った表現をその場で Loop Vocabulary に登録。出会った瞬間が記憶の第一歩。",
  },
  {
    num: "04",
    icon: "✍️",
    title: "アウトプットで定着させる",
    desc: "覚えたフレーズを英語日記・SNS投稿・メモで使う。「読める」より「書ける・言える」状態にするには出力練習が不可欠。",
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
  "headline": "英会話に効く英単語の覚え方【使えるフレーズ・旅行英語を習得】",
  "description": "日常英会話・旅行英語・ビジネス会話で実際に使える単語とフレーズの覚え方を解説。",
  "author": { "@type": "Organization", "name": "Loop Vocabulary" },
  "publisher": { "@type": "Organization", "name": "Loop Vocabulary" },
  "datePublished": "2024-12-15",
  "url": "https://loop-vocabulary.app/guide/eiken-conversation",
};

export default function EikenConversationPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <GuideTracker slug="eiken-conversation" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英会話に効く英単語の覚え方【使えるフレーズ・旅行英語を習得】","item":"https://loop-vocabulary.app/guide/eiken-conversation"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-emerald-300 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 font-semibold mb-3">
            英会話
          </div>
          <h1 className="text-2xl font-black leading-tight">英会話に効く<br />英単語の覚え方</h1>
          <p className="mt-2 text-sm text-emerald-200 max-w-sm mx-auto">日常会話・旅行・ビジネスで使えるフレーズと語彙を場面別に完全解説</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">

        {/* リード */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">英会話の語彙は「教科書英語」と何が違う？</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            テストで高得点でも英会話が苦手な人が多い理由は、<strong>知識として単語を知っているが瞬時に口から出てこない</strong>から。英会話に必要なのは丸暗記でなく「フレーズ単位での使い慣れ」です。相づち・感情表現・依頼フレーズを場面別に覚えるのが最短ルートです。
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "日常フレーズ", value: "約300語" },
              { label: "旅行英語", value: "約150語" },
              { label: "学習期間目安", value: "2〜3ヶ月" },
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
            このサイクルを繰り返すことで「知ってる」が「使える」に変わります
          </p>
        </div>

        {/* 教科書英語との違い */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">知っておきたい口語 vs 書き言葉</h2>
          <div className="space-y-2">
            {[
              { formal: "I understand.", casual: "Got it. / I see.", note: "口語では短く切る" },
              { formal: "I apologize.", casual: "Sorry! / My bad.", note: "謝罪は口語でも通じる" },
              { formal: "Could you assist me?", casual: "Can you help me?", note: "Couldより Can が自然" },
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
          <p className="text-sm text-emerald-200 mb-4">場面別フレーズをSRSで自動管理。AI例文で使い方まで深掘りできます。</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-sm hover:bg-emerald-50 transition-colors"
            >
              無料で始める →
            </Link>
            <Link
              href="/vocab-check"
              className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              語彙力を診断する
            </Link>
          </div>
        </div>

        {/* 関連ガイド */}
        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ガイド</div>
          <div className="space-y-2">
            {[
              { href: "/guide/business-english-tango", tag: "ビジネス英語", title: "ビジネス英語の必須単語300選と実践的な覚え方" },
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

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
