import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "TOEIC対策の英単語教材【無料】基礎100語から始める | Loop Vocabulary",
  description:
    "TOEIC初心者〜600・700点前後を目指す方向けの英単語教材を無料でインポートして学習。忘却曲線で自動復習、AI解説つき。スマホ対応・ログイン不要で教材を閲覧できます。",
  openGraph: {
    title: "TOEIC対策の英単語教材【無料】基礎100語から始める",
    description: "TOEIC初心者向けの英単語教材を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/toeic`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/toeic` },
};

type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  exam_type: string | null;
};

const FAQ_ITEMS = [
  {
    q: "TOEIC対策はどのレベルから始めればいいですか？",
    a: "TOEIC初心者〜600・700点前後を目指す方は、まず頻出動詞・頻出名詞を中心とした基礎語彙から固めるのがおすすめです。単語帳に追加するだけで忘却曲線（SRS）による自動復習が始まります。",
  },
  {
    q: "TOEICの単語はビジネス英語と何が違いますか？",
    a: "TOEICは会議・オフィス・出張などのビジネスシーンを想定した語彙が多く出題されるため、ビジネス英語と重なる部分が大きいです。TOEIC対策と合わせてビジネス英語教材を学習すると、実務でも使える語彙として定着しやすくなります。",
  },
  {
    q: "スコアアップのために単語以外に必要な対策はありますか？",
    a: "語彙力はリスニング・リーディング双方の土台になりますが、TOEICでは文法・パート別の解答テクニックも重要です。単語学習と並行してパート別の演習を進めることをおすすめします。",
  },
];

const FAQ_PAGE_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function ToeicMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .eq("exam_type", "TOEIC")
    .order("title", { ascending: true });

  const rows = (materials ?? []) as MaterialRow[];
  const materialIds = rows.map((m) => m.id);
  const { data: wordRows } =
    materialIds.length > 0
      ? await supabase.rpc("get_material_word_counts", { p_material_ids: materialIds })
      : { data: [] as { material_id: string; word_count: number }[] };
  const wordCounts = ((wordRows ?? []) as { material_id: string; word_count: number }[]).reduce(
    (acc: Record<string, number>, r) => {
      acc[r.material_id] = Number(r.word_count);
      return acc;
    },
    {},
  );

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "教材・単語帳", item: `${SITE_URL}/materials` },
      { "@type": "ListItem", position: 3, name: "TOEIC対策", item: `${SITE_URL}/materials/toeic` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "TOEIC対策の英単語教材",
    url: `${SITE_URL}/materials/toeic`,
    itemListElement: rows.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/materials/${m.id}`,
      name: m.title,
    })),
  };

  return (
    <AppShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_PAGE_LD) }} />

      <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "教材・単語帳", href: "/materials" }, { label: "TOEIC対策" }]} className="mb-2" />
      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">TOEIC対策の英単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        TOEIC初心者〜600・700点前後を目指す方向けに、頻出動詞・頻出名詞を中心とした語彙を
        厳選した内蔵教材をご用意しています。単語帳に追加するだけで、忘却曲線（SRS）による
        自動復習・AI解説がすぐに使えます。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#toeic-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          TOEIC教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 単語を調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/toeic"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 教材一覧 */}
      <div id="toeic-materials" className="mt-6 space-y-3 scroll-mt-4" data-testid="category-lp-materials">
        {rows.map((m) => (
          <Link
            key={m.id}
            href={`/materials/${m.id}`}
            className="block bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-md transition-shadow"
          >
            <div className="font-bold text-navy-800">{m.title}</div>
            {m.description && <div className="text-sm text-navy-500 mt-1">{m.description}</div>}
            <div className="mt-2 flex gap-2 text-[11px] flex-wrap">
              {m.level && (
                <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium">{m.level}</span>
              )}
              <span className="text-navy-400">{(wordCounts[m.id] ?? 0).toLocaleString()} 語</span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-navy-500">現在準備中です。しばらくお待ちください。</p>
        )}
      </div>

      {/* 学習の流れ */}
      <div className="mt-6 bg-navy-50 rounded-2xl p-4">
        <div className="text-sm font-bold text-navy-700 mb-2">学習の流れ</div>
        <div className="flex items-center gap-1.5 text-xs text-navy-600 flex-wrap">
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">① 教材を選ぶ</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">② 単語帳に追加</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">③ 復習</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">④ テスト</span>
        </div>
      </div>

      {/* よくある質問 */}
      <div className="mt-6">
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

      {/* 関連ガイド */}
      <div className="mt-6">
        <div className="text-sm font-bold text-navy-800 mb-2">関連ガイド</div>
        <div className="space-y-2">
          <Link href="/guide/ai-vocabulary-learning" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
            <div className="text-[11px] text-sky-600 font-semibold mb-0.5">AI活用</div>
            <div className="text-sm font-semibold text-navy-800">AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】</div>
          </Link>
          <Link href="/guide/toeic-tango" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
            <div className="text-[11px] text-sky-600 font-semibold mb-0.5">TOEIC</div>
            <div className="text-sm font-semibold text-navy-800">TOEICスコアアップの英単語学習法【600→800点】</div>
          </Link>
        </div>
      </div>

      {/* 内部リンク */}
      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        <Link
          href="/materials/business"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          💼 ビジネス英語教材を見る
        </Link>
        <Link
          href="/exam-countdown-planner"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🗓️ 試験日から逆算する学習計画を立てる
        </Link>
        <Link
          href="/guide"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📘 学習ガイド一覧
        </Link>
        <Link
          href="/materials"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📚 教材一覧に戻る
        </Link>
      </div>
    </AppShell>
  );
}
