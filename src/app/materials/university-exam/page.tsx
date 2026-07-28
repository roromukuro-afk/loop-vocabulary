import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";

// レベルの表示順（易しい→難しい）。全教材はexam_type="大学受験"で動的に取得する。
const LEVEL_ORDER = [
  "高校基礎",
  "高校基礎〜標準",
  "高校3年",
  "高校標準〜大学受験",
  "大学受験標準",
  "大学受験標準〜難関",
  "大学受験難関〜最難関",
];

export const metadata: Metadata = {
  title: "大学受験向け英単語教材【無料】共通テスト・私大対策に使える英単語学習 | Loop Vocabulary",
  description:
    "大学受験の英単語学習に使える教材を無料でインポートして学習。共通テスト・私大対策・難関大対策まで、高校基礎から仕上げまでレベル別の単語帳をSRS（忘却曲線）による自動復習・4択/入力/PDFテストで効率よく定着できます。高校生・浪人生・保護者の方にもおすすめです。",
  openGraph: {
    title: "大学受験向け英単語教材【無料】共通テスト・私大対策に使える英単語学習",
    description: "共通テスト・私大対策などレベル別の英単語を無料で学習。忘却曲線で自動復習。",
    url: `${SITE_URL}/materials/university-exam`,
    type: "website",
  },
  alternates: { canonical: `${SITE_URL}/materials/university-exam` },
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
    q: "フラッシュカード学習は何が良いですか？",
    a: "答えを見る前に自分の力で意味を思い出す「自己想起」は、選択肢から選ぶだけの学習より記憶に残りやすいとされています。フラッシュカードで自己想起し、忘却曲線に基づく復習タイミングにも反映される仕組みです。",
  },
  {
    q: "忘却曲線に合わせた復習とは何ですか？",
    a: "エビングハウスの忘却曲線の考え方をもとに、正解・不正解や自己評価に応じて次の復習タイミングを自動で計算する仕組みです。間隔を空けながら繰り返すことで、詰め込みに頼らず記憶の定着を目指せます。",
  },
  {
    q: "大学受験英単語はどう復習すればいいですか？",
    a: "覚える語数が多いため、レベル別の単語帳をこまめに区切って登録し、フラッシュカードで自己想起→忘却曲線での自動復習を繰り返すのが基本です。模試や過去問で出た単語をその都度単語帳に追加すると、実戦的な語彙が積み上がります。",
  },
];

export default async function UniversityExamMaterialsLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .eq("exam_type", "大学受験")
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
      { "@type": "ListItem", position: 3, name: "大学受験対策", item: `${SITE_URL}/materials/university-exam` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "大学受験対策の英単語教材",
    url: `${SITE_URL}/materials/university-exam`,
    itemListElement: sortedRows.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/materials/${m.id}`,
      name: m.title,
    })),
  };
  const faqPageLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <AppShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }} />

      <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "教材・単語帳", href: "/materials" }, { label: "大学受験対策" }]} className="mb-2" />
      <Link href="/materials" className="text-xs text-navy-500 hover:underline">
        ← 教材一覧
      </Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">大学受験向け英単語教材</h1>
      <p className="text-sm text-navy-600 mt-2 leading-relaxed">
        高校基礎から共通テスト・私大対策・難関大対策まで、レベルに合わせて英単語教材を選べます。
        単語帳に追加するだけでフラッシュカードによる自己想起と、忘却曲線（SRS）に基づく自動復習が
        始まります。4択・入力・PDFテストは「覚えたつもり」を防ぐ最後の確認に使えます。まずは無料でお試しいただけます。
      </p>

      {/* CTA */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a
          href="#university-exam-materials"
          className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
        >
          大学受験対策教材を見る
        </a>
        <Link
          href="/dictionary"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🔍 辞書で調べる
        </Link>
        {!user && (
          <Link
            href="/signup?next=/materials/university-exam"
            className="px-3 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            無料で始める
          </Link>
        )}
      </div>

      {/* 大学受験英単語対策で使える理由 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">📖 共通テスト対策に</div>
          <p className="text-xs text-navy-500 mt-1">
            共通テストで狙われる頻出語・分析語彙を厳選した教材で対策できます。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">🏫 私大対策に</div>
          <p className="text-xs text-navy-500 mt-1">
            難関大・超難関大まで、志望校のレベルに合わせて単語帳を選べます。
          </p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-3">
          <div className="text-sm font-bold text-navy-800">🌱 基礎固めに</div>
          <p className="text-xs text-navy-500 mt-1">
            高校基礎レベルから始めて、SRSで自動復習しながら無理なく積み上げられます。
          </p>
        </div>
      </div>

      {/* 教材一覧（レベル別） */}
      <div id="university-exam-materials" className="mt-6 space-y-5 scroll-mt-4" data-testid="category-lp-materials">
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
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
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
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">① レベルを選ぶ</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">② 単語帳に追加</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">③ フラッシュカードで自己想起</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">④ 忘却曲線で自動復習</span>
          <span>→</span>
          <span className="px-2 py-1 bg-white rounded-lg border border-navy-100">⑤ 4択・入力・PDFで最終確認</span>
        </div>
      </div>

      {/* 無料でできること / Premiumでできること */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-navy-100 p-4">
          <div className="text-sm font-bold text-navy-800 mb-2">無料でできること</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>フラッシュカードで自己想起 → 忘却曲線で自動復習</li>
            <li>大学受験向け教材のインポート・単語帳の作成</li>
            <li>4択テスト・入力テストでの確認</li>
            <li>PDFテストの作成</li>
            <li>達成スタンプでの学習記録</li>
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-4">
          <div className="text-sm font-bold text-navy-800 mb-2">Premiumでさらに効率化</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>AI弱点分析で苦手な品詞・意味・単語傾向を確認</li>
            <li>AI学習プランで模試前・定期テスト前・入試前の復習範囲を整理</li>
            <li>長文・問題集からAIで単語を抽出（AI単語抽出）</li>
            <li>入力テストでスペルまで確認、リスニング練習で音も確認</li>
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
          <li>広告を非表示にしたい場合はPremiumで対応可能です</li>
        </ul>
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
          <Link href="/guide/university-exam-vocabulary" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
            <div className="text-[11px] text-sky-600 font-semibold mb-0.5">大学受験</div>
            <div className="text-sm font-semibold text-navy-800">大学受験 直前期の英単語復習法【模試・AI弱点分析の活用】</div>
          </Link>
          <Link href="/guide/ai-vocabulary-learning" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
            <div className="text-[11px] text-sky-600 font-semibold mb-0.5">AI活用</div>
            <div className="text-sm font-semibold text-navy-800">AIを使った英単語学習法【弱点分析・学習プラン・単語抽出の使い方】</div>
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
          href="/materials/highschool"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          🎓 高校生向けページへ
        </Link>
        <Link
          href="/materials/eiken"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📝 英検対策教材を見る
        </Link>
        <Link
          href="/materials/school-test"
          className="px-3 py-2 rounded-xl border border-navy-200 text-navy-600 hover:bg-navy-50 transition-colors"
        >
          📖 定期テスト対策教材を見る
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
