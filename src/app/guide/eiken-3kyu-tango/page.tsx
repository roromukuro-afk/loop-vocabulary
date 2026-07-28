import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AmazonBookSection } from "@/components/affiliate/AmazonBook";
import { GuideTracker } from "@/components/guide/GuideTracker";
import { GuideEmailCapture } from "@/components/guide/GuideEmailCapture";
import { GuideMaterialCTA } from "@/components/guide/GuideMaterialCTA";
import { ExamInfoDisclaimer } from "@/components/guide/ExamInfoDisclaimer";

export const metadata: Metadata = {
  title: "英検3級の単語・語彙対策【頻出800語一覧】| Loop Vocabulary",
  description: "英検3級に合格するための必須単語800語を完全解説。出題傾向・覚え方・おすすめ勉強法を紹介。中学英語レベルの語彙を効率よくマスターしよう。",
  alternates: { canonical: "https://loop-vocabulary.app/guide/eiken-3kyu-tango" },
};

const CATEGORIES = [
  {
    title: "日常生活・家族",
    count: "約150語",
    examples: ["family（家族）", "breakfast（朝食）", "bedroom（寝室）", "neighbor（隣人）", "vacation（休暇）"],
    tip: "身近な日常場面で使う基本名詞。絵や写真と結びつけて覚えると効果的。",
  },
  {
    title: "学校・勉強",
    count: "約120語",
    examples: ["subject（科目）", "homework（宿題）", "examination（試験）", "library（図書館）", "classmate（クラスメート）"],
    tip: "学校生活の場面設定の英文が多く出題される。動詞（study/learn/teach）もセットで。",
  },
  {
    title: "動詞・行動",
    count: "約200語",
    examples: ["enjoy（楽しむ）", "decide（決める）", "remember（覚える）", "explain（説明する）", "borrow（借りる）"],
    tip: "動詞は語形変化（ing形・過去形）も一緒に覚える。過去形の不規則変化に注意。",
  },
  {
    title: "形容詞・副詞",
    count: "約150語",
    examples: ["important（重要な）", "popular（人気の）", "careful（注意深い）", "quickly（素早く）", "finally（ついに）"],
    tip: "文の意味の中心を担う形容詞。反意語（easy ↔ difficult）とセットで暗記。",
  },
  {
    title: "場所・施設",
    count: "約100語",
    examples: ["hospital（病院）", "supermarket（スーパー）", "stadium（スタジアム）", "museum（博物館）", "bookstore（本屋）"],
    tip: "地図・案内の問題で頻出。建物の名前は語尾（-ment/-eum）でまとめて覚える。",
  },
  {
    title: "自然・環境",
    count: "約80語",
    examples: ["season（季節）", "temperature（気温）", "forest（森）", "environment（環境）", "pollution（汚染）"],
    tip: "英検3級では環境問題のテーマも出題。天気・気候の語彙から環境語彙へ発展させる。",
  },
];

const STUDY_PLAN = [
  { week: "1〜2週", goal: "頻出動詞200語", content: "日常よく使う動詞を優先。過去形・ing形も同時習得" },
  { week: "3〜4週", goal: "名詞150語（日常生活・学校）", content: "身近な場面の名詞。使用場面をイメージしながら覚える" },
  { week: "5〜6週", goal: "形容詞・副詞150語", content: "反意語ペアで覚える。感情・状態の形容詞を重点的に" },
  { week: "7〜8週", goal: "場所・自然・その他130語", content: "英文を読みながら文脈で定着させる" },
  { week: "9〜10週", goal: "弱点語彙の総復習", content: "間違えた単語だけ集中特訓。模擬試験で実力確認" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "英検3級の単語・語彙対策【頻出800語一覧】",
  "description": "英検3級合格に必要な必須単語800語と効率的な覚え方を解説",
  "url": "https://loop-vocabulary.app/guide/eiken-3kyu-tango",
};

const FAQ_ITEMS = [
  {
    q: "英検3級に必要な単語数はどれくらいですか？",
    a: "必須単語の目安は約800語程度とされます。中学英語の基礎レベルが中心なので、まずはこの800語を「読んで意味が分かる」レベルから「聞いて分かる」レベルまで引き上げることを目指すと安定します。",
  },
  {
    q: "英検3級はリスニングの配点が大きいと聞きましたが、単語対策で対応できますか？",
    a: "単語を目で見て分かるだけでなく、音で聞いて意味が浮かぶ状態にしておくとリスニング対策にもつながります。単語を覚える際に音声も一緒に確認する習慣をつけるのがおすすめです。",
  },
  {
    q: "中学校の教科書の単語と英検3級の単語は同じですか？",
    a: "重なる部分は多いですが、英検3級では教科書に出てこない語彙も出題されます。教科書の復習に加えて、英検専用の単語リストでカバーしておくと抜けが少なくなります。",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Eiken3KyuPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "英検3級の単語・語彙対策【頻出800語一覧】" }]} />
      </div>

      <GuideTracker slug="eiken-3kyu-tango" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"ホーム","item":"https://loop-vocabulary.app"},{"@type":"ListItem","position":2,"name":"学習ガイド","item":"https://loop-vocabulary.app/guide"},{"@type":"ListItem","position":3,"name":"英検3級の単語・語彙対策【頻出800語一覧】","item":"https://loop-vocabulary.app/guide/eiken-3kyu-tango"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-12 pb-12 text-white text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-3">英検対策ガイド</div>
        <h1 className="text-2xl font-black leading-tight">英検3級 単語・語彙対策</h1>
        <p className="mt-2 text-sm text-emerald-200">頻出800語を効率よくマスターして合格を勝ち取ろう</p>
        <div className="mt-4 inline-block bg-white/10 rounded-xl px-4 py-2 text-sm">
          難易度：中学卒業程度 / 目安語彙数：800〜1,200語
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">
        {/* 概要 */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">英検3級とは？</h2>
          <p className="text-sm text-navy-600 leading-relaxed">
            英検3級は「中学英語の総まとめ」とも言われ、中学卒業レベルの英語力が求められます。語彙問題では<strong>約800〜1,200語</strong>の知識が必要で、試験全体に占める語彙・文法問題の配点は約30%です。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-xl p-3">
              <div className="text-lg font-black text-emerald-700">800語</div>
              <div className="text-[10px] text-emerald-600">必須語彙数</div>
            </div>
            <div className="bg-navy-50 rounded-xl p-3">
              <div className="text-lg font-black text-navy-700">約65%</div>
              <div className="text-[10px] text-navy-500">合格ラインの目安（過去傾向）</div>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <div className="text-lg font-black text-sky-700">3〜6ヶ月</div>
              <div className="text-[10px] text-sky-500">学習期間目安</div>
            </div>
          </div>
          <div className="mt-4">
            <ExamInfoDisclaimer kind="eiken" showCseNote />
          </div>
        </div>

        {/* カテゴリ別単語 */}
        <h2 className="font-black text-navy-800 text-lg px-1">カテゴリ別 頻出単語</h2>
        {CATEGORIES.map((c) => (
          <div key={c.title} className="bg-white rounded-2xl border border-navy-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-navy-800">{c.title}</h3>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">{c.count}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {c.examples.map((ex) => (
                <span key={ex} className="text-xs bg-navy-50 text-navy-700 px-3 py-1 rounded-full">{ex}</span>
              ))}
            </div>
            <p className="text-xs text-navy-500 border-t border-navy-50 pt-2 mt-2">💡 {c.tip}</p>
          </div>
        ))}

        {/* 10週間学習プラン */}
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
            <h2 className="font-black">10週間合格プラン</h2>
            <p className="text-xs text-emerald-100 mt-0.5">1日15〜20分の学習で英検3級合格レベルへ</p>
          </div>
          <div className="divide-y divide-navy-50">
            {STUDY_PLAN.map((p) => (
              <div key={p.week} className="px-5 py-3 flex gap-4">
                <div className="text-xs font-bold text-emerald-600 shrink-0 w-16">{p.week}</div>
                <div>
                  <div className="text-sm font-bold text-navy-800">{p.goal}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{p.content}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 語彙問題攻略ポイント */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <h2 className="font-black text-navy-800 mb-3">語彙問題の攻略ポイント</h2>
          <div className="space-y-3">
            {[
              { icon: "🎯", title: "問題文の「空欄前後」を必ず読む", desc: "英検3級の語彙問題は選択肢4つ。前後の文脈から正解を絞れることが多い。" },
              { icon: "🔄", title: "動詞の活用形に注意", desc: "to不定詞・動名詞・過去形など、文法と合わせて正しい形を選べるよう練習する。" },
              { icon: "📝", title: "コロケーション（組み合わせ）を覚える", desc: "make a decision / take a photo のように、よく一緒に使う動詞・名詞のセットで覚える。" },
              { icon: "⏱", title: "1問20秒以内に解く", desc: "語彙・文法問題は速く解いてリスニング・英作文に時間を残す。迷ったら消去法で。" },
            ].map((p) => (
              <div key={p.title} className="flex gap-3">
                <span className="text-xl shrink-0">{p.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{p.title}</div>
                  <p className="text-xs text-navy-500 mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 語彙チェックCTA */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 text-white text-center">
          <div className="font-black text-base mb-1">英検3級レベルの語彙力をチェック</div>
          <p className="text-sm text-emerald-100 mb-4">20問の語彙チェックテストで今の実力を確認しよう（無料・登録不要）</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/vocab-check/eiken" className="px-5 py-2.5 rounded-xl bg-white text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-colors">英検語彙チェック →</Link>
            <Link href="/signup" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">SRS学習を始める</Link>
          </div>
        </div>

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

        <AmazonBookSection
          heading="📚 英検3級おすすめ参考書（Amazon）"
          books={[
            { title: "英検3級 でる順パス単 5訂版", author: "旺文社", asin: "4010947403", price: "¥880", label: "一番売れてる英検3級単語帳" },
            { title: "7日間完成 英検3級 予想問題ドリル 6訂版", author: "旺文社", asin: "401094696X", price: "¥990", label: "直前対策に最適" },
            { title: "英検3級 過去6回全問題集", author: "旺文社", asin: "4010946997", price: "¥1,320", label: "本番形式で仕上げ" },
          ]}
        />

        {/* 関連リンク */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guide/eiken-2kyu-tango" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">⬆️</div>
            <div className="font-bold text-navy-800 text-sm">英検2級の単語対策</div>
          </Link>
          <Link href="/guide/eitango-oboeru-houhou" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🧠</div>
            <div className="font-bold text-navy-800 text-sm">効率的な単語の覚え方</div>
          </Link>
          <Link href="/roadmap" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">🗺</div>
            <div className="font-bold text-navy-800 text-sm">英語学習ロードマップ</div>
          </Link>
          <Link href="/vocab-check/eiken" className="bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-sm transition-shadow">
            <div className="text-lg mb-1">📋</div>
            <div className="font-bold text-navy-800 text-sm">英検語彙チェック</div>
          </Link>
        </div>

        <GuideMaterialCTA
          heading="英検3級の単語帳を無料でインポート"
          materials={[
            { id: "00000000-0000-0000-0000-000000000034", title: "英検3級 重要単語" },
            { id: "00000000-0000-0000-0000-000000000021", title: "中学校英単語 基礎・標準" },
          ]}
        />
      </div>
    </div>
  );
}
