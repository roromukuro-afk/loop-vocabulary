import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

// 主役: 経済ニュース英単語100・企業ニュース英単語100
const ECONOMIC_NEWS_ID = "10000000-0000-0000-0000-000000000114";
const CORPORATE_NEWS_ID = "10000000-0000-0000-0000-000000000115";
// 関連教材: ビジネス英語 基礎100・TOEIC 頻出名詞100・TOEIC 頻出動詞100（この順で表示）
const BUSINESS_BASIC_ID = "10000000-0000-0000-0000-000000000111";
const TOEIC_FREQUENT_NOUNS_ID = "10000000-0000-0000-0000-000000000113";
const TOEIC_FREQUENT_VERBS_ID = "10000000-0000-0000-0000-000000000110";

export const metadata: Metadata = {
  title: "ニュース英語の単語教材【無料】経済・企業ニュースを読む語彙 | Loop Vocabulary",
  description:
    "経済ニュース・企業ニュースで頻出する英単語を無料でインポートして学習。英語ニュースを読むための基礎語彙を、単語帳に追加するだけで忘却曲線による自動復習・4択/入力/タイピングテストで定着できます。社会人・投資/ビジネス関心層におすすめです。",
  openGraph: {
    title: "ニュース英語の単語教材【無料】経済・企業ニュースを読む語彙",
    description: "経済・企業ニュースで頻出する英単語を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/news`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/news` },
};

type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  exam_type: string | null;
};

export default async function NewsMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allIds = [ECONOMIC_NEWS_ID, CORPORATE_NEWS_ID, BUSINESS_BASIC_ID, TOEIC_FREQUENT_NOUNS_ID, TOEIC_FREQUENT_VERBS_ID];
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .in("id", allIds);

  const byId = new Map(((materials ?? []) as MaterialRow[]).map((m) => [m.id, m]));
  const primaryRows = [ECONOMIC_NEWS_ID, CORPORATE_NEWS_ID].map((id) => byId.get(id)).filter((m): m is MaterialRow => !!m);
  const relatedRows = [BUSINESS_BASIC_ID, TOEIC_FREQUENT_NOUNS_ID, TOEIC_FREQUENT_VERBS_ID]
    .map((id) => byId.get(id))
    .filter((m): m is MaterialRow => !!m);

  const materialIds = [...primaryRows, ...relatedRows].map((m) => m.id);
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
      { "@type": "ListItem", position: 3, name: "ニュース英語", item: `${SITE_URL}/materials/news` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ニュース英語の単語教材",
    url: `${SITE_URL}/materials/news`,
    itemListElement: primaryRows.map((m, i) => ({
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

      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">ニュース英語の単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        経済ニュース・企業ニュースでよく使われる英単語を厳選した内蔵教材です。英語ニュースを読むための
        基礎語彙を増やせます。単語帳に追加するだけで忘却曲線（SRS）による自動復習が始まり、4択・入力・
        タイピングテストで定着できます。社会人の方、投資・ビジネス情報を英語で追いたい方におすすめです。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#news-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          ニュース英語教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/news"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 教材一覧（主役: 経済/企業ニュース） */}
      <div id="news-materials" className="mt-6 space-y-3 scroll-mt-4" data-testid="category-lp-materials">
        {primaryRows.map((m) => (
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
        {primaryRows.length === 0 && (
          <p className="text-sm text-navy-500">現在準備中です。しばらくお待ちください。</p>
        )}
      </div>

      {/* 関連教材（TOEIC・ビジネス英語） */}
      {relatedRows.length > 0 && (
        <div className="mt-5" data-testid="news-related-materials">
          <div className="text-sm font-bold text-navy-700 mb-2">あわせて学びたい方に</div>
          <div className="space-y-2">
            {relatedRows.map((m) => (
              <Link
                key={m.id}
                href={`/materials/${m.id}`}
                className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy-800 text-sm">{m.title}</span>
                  <span className="text-navy-400 text-[11px] shrink-0">
                    {(wordCounts[m.id] ?? 0).toLocaleString()} 語
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 学習の流れ */}
      <div className="mt-6 bg-navy-50 rounded-2xl p-4">
        <div className="text-sm font-bold text-navy-700 mb-2">学習の流れ</div>
        <div className="flex items-center gap-1.5 text-xs text-navy-600 flex-wrap">
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">① 教材を選ぶ</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">② 単語帳に追加</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">③ SRSで復習</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">④ 4択・入力・タイピングで確認</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">⑤ 辞書で単語を追加</span>
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
          href="/materials/toeic"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📝 TOEIC教材を見る
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
