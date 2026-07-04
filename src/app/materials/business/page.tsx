import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
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

      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">ビジネス英語の単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        職場・取引先・会議・メールで使う実務英語の単語を厳選した内蔵教材です。TOEIC対策に限らず、
        日々の職場英語としてもそのまま使えます。単語帳に追加するだけで自動復習が始まります。
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
          href="/materials"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📚 教材一覧に戻る
        </Link>
      </div>
    </AppShell>
  );
}
