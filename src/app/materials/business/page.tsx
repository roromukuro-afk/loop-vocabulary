import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

export const metadata: Metadata = {
  title: "ビジネス英語の単語教材【無料】会議・メールで使える語彙 | Loop Vocabulary",
  description:
    "職場・取引先・会議・メールで使うビジネス英語の単語教材を無料でインポートして学習。忘却曲線で自動復習、AI解説つき。スマホ対応・ログイン不要で教材を閲覧できます。",
  openGraph: {
    title: "ビジネス英語の単語教材【無料】会議・メールで使える語彙",
    description: "職場英語・会議・メールで使うビジネス英語を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/business`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/business` },
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
    q: "ビジネス英語とTOEICの単語はどちらから学ぶべきですか？",
    a: "TOEICを受験予定の方はTOEIC対策と重なる語彙から、実務で英語メールや会議を行う方はビジネス英語の基礎語彙から始めるのがおすすめです。両者は重なる部分が多いため、どちらから始めても学習が無駄になりにくい構成にしています。",
  },
  {
    q: "職場ですぐ使える表現も学べますか？",
    a: "単語単体の意味だけでなく、会議・メールでよく使われる文脈を意識して教材を用意しています。単語帳に登録した後は、フラッシュカードや4択で繰り返し確認することで、実際の場面でも思い出しやすくなります。",
  },
  {
    q: "経済ニュースを読むための語彙も学べますか？",
    a: "はい。経済・企業ニュースで頻出する単語をまとめた教材も別途用意しています。ビジネス基礎語彙を固めたあとのステップアップとしておすすめです。",
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

export default async function BusinessMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .eq("exam_type", "ビジネス英語")
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
      { "@type": "ListItem", position: 3, name: "ビジネス英語", item: `${SITE_URL}/materials/business` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ビジネス英語の単語教材",
    url: `${SITE_URL}/materials/business`,
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

      <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "教材・単語帳", href: "/materials" }, { label: "ビジネス英語" }]} className="mb-2" />
      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">ビジネス英語の単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        職場・取引先・会議・メールで使う実務英語の単語を厳選した内蔵教材です。TOEIC対策に限らず、
        日々の職場英語としてもそのまま使えます。経済ニュース・企業ニュースを読むための語彙パックも
        あわせて用意しています。単語帳に追加するだけで自動復習が始まります。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#business-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          ビジネス英語教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/business"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 教材一覧 */}
      <div id="business-materials" className="mt-6 space-y-3 scroll-mt-4" data-testid="category-lp-materials">
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
                <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium">{m.level}</span>
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
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">① 調べる</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">② 登録</span>
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
          <Link href="/guide/business-english-tango" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
            <div className="text-[11px] text-sky-600 font-semibold mb-0.5">ビジネス英語</div>
            <div className="text-sm font-semibold text-navy-800">ビジネス英語の必須単語300選と実践的な覚え方</div>
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
          href="/materials/toeic"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📝 TOEIC教材を見る
        </Link>
        <Link
          href="/materials/news"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📰 経済・企業ニュースの英単語も学ぶ
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
