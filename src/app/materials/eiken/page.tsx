import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

// 級の表示順（易しい→難しい）。全教材はexam_type="英検"で動的に取得する。
const LEVEL_ORDER = ["英検4・5級", "英検3級", "英検準2級", "英検2級", "英検準1級", "英検1級"];

export const metadata: Metadata = {
  title: "英検対策向け英単語教材【無料】3級・準2級・2級ほか対応 | Loop Vocabulary",
  description:
    "英検対策に使える英単語教材を無料でインポートして学習。英検3級・準2級・2級ほか5級〜1級まで、レベル別の単語帳をSRS（忘却曲線）による自動復習・4択/入力/PDFテストで効率よく定着できます。中高生・保護者の方にもおすすめです。",
  openGraph: {
    title: "英検対策向け英単語教材【無料】3級・準2級・2級ほか対応",
    description: "英検3級・準2級・2級などレベル別の英単語を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/eiken`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/eiken` },
};

type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  exam_type: string | null;
};

export default async function EikenMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .eq("exam_type", "英検")
    .order("title", { ascending: true });

  const rows = (materials ?? []) as MaterialRow[];
  const levelRank = (level: string | null) => {
    const idx = LEVEL_ORDER.indexOf(level ?? "");
    return idx === -1 ? LEVEL_ORDER.length : idx;
  };
  const sortedRows = [...rows].sort((a, b) => {
    const rankDiff = levelRank(a.level) - levelRank(b.level);
    if (rankDiff !== 0) return rankDiff;
    return a.title.localeCompare(b.title, "ja");
  });
  const groups = LEVEL_ORDER.map((level) => ({
    level,
    materials: sortedRows.filter((m) => m.level === level),
  })).filter((g) => g.materials.length > 0);

  const materialIds = sortedRows.map((m) => m.id);
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
      { "@type": "ListItem", position: 3, name: "英検対策", item: `${SITE_URL}/materials/eiken` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "英検対策の英単語教材",
    url: `${SITE_URL}/materials/eiken`,
    itemListElement: sortedRows.map((m, i) => ({
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
      <h1 className="text-xl font-bold text-navy-800 mt-2">英検対策向け英単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        英検4・5級から1級まで、目指す級に合わせて英単語教材を選べます。単語帳に追加するだけで
        忘却曲線（SRS）による自動復習が始まり、4択・入力・PDFテストで定着度を確認できます。
        まずは無料でお試しいただけます。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#eiken-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          英検対策教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/eiken"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 英検対策で使える理由 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">📖 級別に選べる</div>
          <p className="text-xs text-navy-500 mt-1">
            英検4・5級から1級まで、目指す級に合わせて単語帳を選べます。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">🔁 SRSで自動復習</div>
          <p className="text-xs text-navy-500 mt-1">
            単語帳に追加するだけで、忘却曲線に基づいた復習が自動で始まります。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">📝 PDFテストで最終確認</div>
          <p className="text-xs text-navy-500 mt-1">
            試験直前は紙のテストを作成して最終チェックすることもできます。
          </p>
        </div>
      </div>

      {/* 教材一覧（級別） */}
      <div id="eiken-materials" className="mt-6 space-y-5 scroll-mt-4" data-testid="category-lp-materials">
        {groups.map((group) => (
          <div key={group.level}>
            <div className="text-sm font-bold text-navy-700 mb-2">{group.level}</div>
            <div className="space-y-3">
              {group.materials.map((m) => (
                <Link
                  key={m.id}
                  href={`/materials/${m.id}`}
                  className="block bg-white rounded-2xl border border-navy-100 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="font-bold text-navy-800">{m.title}</div>
                  {m.description && <div className="text-sm text-navy-500 mt-1">{m.description}</div>}
                  <div className="mt-2 flex gap-2 text-[11px] flex-wrap">
                    {m.level && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        {m.level}
                      </span>
                    )}
                    <span className="text-navy-400">{(wordCounts[m.id] ?? 0).toLocaleString()} 語</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-navy-500">現在準備中です。しばらくお待ちください。</p>
        )}
      </div>

      {/* 学習の流れ */}
      <div className="mt-6 bg-navy-50 rounded-2xl p-4">
        <div className="text-sm font-bold text-navy-700 mb-2">学習の流れ</div>
        <div className="flex items-center gap-1.5 text-xs text-navy-600 flex-wrap">
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">① 級を選ぶ</span>
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
            <li>英検向け教材のインポート・単語帳の作成</li>
            <li>SRS（忘却曲線）による自動復習</li>
            <li>4択テスト・入力テスト</li>
            <li>PDFテストの作成</li>
            <li>達成スタンプでの学習記録</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-4">
          <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>AI弱点分析で苦手な品詞・単語の傾向を確認</li>
            <li>AI学習プランで試験前の復習範囲を整理</li>
            <li>長文・問題集からAIで単語を抽出（AI単語抽出）</li>
            <li>リスニング対策の一部として音声練習</li>
            <li>タイピング練習・広告非表示</li>
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
          <li>合格や点数を保証するような表現、誇張した実績の記載は行っていません</li>
          <li>学習履歴（正誤・復習状況）をもとに、無理なく復習を続けられるよう支援するアプリです</li>
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
          href="/materials/highschool"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🎓 高校生向けページへ
        </Link>
        <Link
          href="/materials/university-exam"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🎓 大学受験対策教材を見る
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
