import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

// 主役: 高校英単語 基礎100・基礎100 Part2（大学受験の土台となる高校標準語彙）
const HIGHSCHOOL_BASIC_ID = "10000000-0000-0000-0000-000000000102";
const HIGHSCHOOL_BASIC_PART2_ID = "10000000-0000-0000-0000-000000000106";
// 関連教材: 英検準2級・英検3級・大学受験の基礎動詞/名詞（この順で表示）
const EIKEN_PRE2_ID = "10000000-0000-0000-0000-000000000103";
const EIKEN_3_ID = "10000000-0000-0000-0000-000000000105";
const UNIVERSITY_VERBS_ID = "10000000-0000-0000-0000-000000000104";
const UNIVERSITY_NOUNS_ID = "10000000-0000-0000-0000-000000000107";

export const metadata: Metadata = {
  title: "高校生向け英単語教材【無料】定期テスト・英検・大学受験対策 | Loop Vocabulary",
  description:
    "高校生向けの英単語教材を無料でインポートして学習。定期テスト対策・英検3級/準2級・大学受験の基礎英単語を、忘却曲線による自動復習（SRS）・4択/入力/PDFテストで効率よく定着できます。スマホ対応・ログイン不要で教材を閲覧できます。",
  openGraph: {
    title: "高校生向け英単語教材【無料】定期テスト・英検・大学受験対策",
    description: "定期テスト・英検・大学受験の基礎英単語を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/highschool`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/highschool` },
};

type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  exam_type: string | null;
};

export default async function HighschoolMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allIds = [
    HIGHSCHOOL_BASIC_ID,
    HIGHSCHOOL_BASIC_PART2_ID,
    EIKEN_PRE2_ID,
    EIKEN_3_ID,
    UNIVERSITY_VERBS_ID,
    UNIVERSITY_NOUNS_ID,
  ];
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .in("id", allIds);

  const byId = new Map(((materials ?? []) as MaterialRow[]).map((m) => [m.id, m]));
  const primaryRows = [HIGHSCHOOL_BASIC_ID, HIGHSCHOOL_BASIC_PART2_ID]
    .map((id) => byId.get(id))
    .filter((m): m is MaterialRow => !!m);
  const relatedRows = [EIKEN_PRE2_ID, EIKEN_3_ID, UNIVERSITY_VERBS_ID, UNIVERSITY_NOUNS_ID]
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
      { "@type": "ListItem", position: 3, name: "高校生向け", item: `${SITE_URL}/materials/highschool` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "高校生向け英単語教材",
    url: `${SITE_URL}/materials/highschool`,
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
      <h1 className="text-xl font-bold text-navy-800 mt-2">高校生向け英単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        定期テスト対策・英検対策・大学受験の基礎固めに使える英単語教材です。単語帳に追加するだけで
        忘却曲線（SRS）による自動復習が始まり、4択・入力・PDFテストで定着度を確認できます。
        まずは無料でお試しいただけます。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#highschool-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          高校生向け教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/highschool"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 高校生の使い方 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">📚 定期テスト前に</div>
          <p className="text-xs text-navy-500 mt-1">
            テスト範囲の単語を単語帳にまとめて登録し、4択・入力テストで最終チェックできます。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">📝 英検対策に</div>
          <p className="text-xs text-navy-500 mt-1">
            英検3級・準2級レベルの頻出語を集中的に復習。SRSで直前期も忘れにくくなります。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">🎓 大学受験に</div>
          <p className="text-xs text-navy-500 mt-1">
            共通テスト・大学入試の長文でよく出る基礎動詞・名詞を効率よく暗記できます。
          </p>
        </div>
      </div>

      {/* 教材一覧（主役: 高校英単語 基礎100・Part2） */}
      <div id="highschool-materials" className="mt-6 space-y-3 scroll-mt-4" data-testid="category-lp-materials">
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
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{m.level}</span>
              )}
              <span className="text-navy-400">{(wordCounts[m.id] ?? 0).toLocaleString()} 語</span>
            </div>
          </Link>
        ))}
        {primaryRows.length === 0 && (
          <p className="text-sm text-navy-500">現在準備中です。しばらくお待ちください。</p>
        )}
      </div>

      {/* 関連教材（英検・大学受験） */}
      {relatedRows.length > 0 && (
        <div className="mt-5" data-testid="highschool-related-materials">
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
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">③ SRSで自動復習</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">④ 4択・入力・PDFテストで確認</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">⑤ 苦手単語はPremiumのAI分析で効率化</span>
        </div>
      </div>

      {/* 無料でできること / Premiumでできること */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-navy-100 p-4">
          <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>教材のインポート・単語帳の作成</li>
            <li>SRS（忘却曲線）による自動復習</li>
            <li>4択テスト・入力テスト</li>
            <li>PDFテストの作成</li>
            <li>達成スタンプでの学習記録</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-4">
          <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>AI弱点分析・AI学習プラン作成</li>
            <li>AIによる英文からの単語抽出</li>
            <li>タイピング・リスニング練習</li>
            <li>広告非表示</li>
          </ul>
          <Link href="/premium" className="inline-block mt-2 text-xs text-sky-700 hover:underline">
            月額 ¥480〜 プレミアムを見る →
          </Link>
        </div>
      </div>

      {/* 保護者の方へ */}
      <div className="mt-5 bg-navy-50 rounded-2xl p-4">
        <div className="text-sm font-bold text-navy-700 mb-2">保護者の方へ</div>
        <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
          <li>無料の範囲でも、単語帳・SRS復習・4択/入力/PDFテストなど基本的な学習が可能です</li>
          <li>有料プランの料金（月額¥480〜・年額¥3,800）は<Link href="/premium" className="underline">プレミアムページ</Link>に明記しています</li>
          <li>解約方法は<Link href="/terms" className="underline">利用規約</Link>に記載しています</li>
          <li>テストの点数上昇や合格を確約するような表現、誇張した実績の記載は行っていません</li>
          <li>学習データ（正誤・復習状況）をもとに、無理なく復習を続けられるよう支援するアプリです</li>
        </ul>
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
          href="/materials"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📚 教材一覧に戻る
        </Link>
      </div>
    </AppShell>
  );
}
