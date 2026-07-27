import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getPresetMeta } from "@/lib/materials/presetMeta";
import { TrackedLink } from "@/components/analytics/TrackedLink";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "英語教材・単語帳一覧【無料】英検・TOEIC・大学受験 | Loop Vocabulary",
  description: "英検2級・準1級・TOEIC・大学受験・中学高校英語の単語帳を無料でインポートして学習。AIが苦手を分析し効率的に暗記。スマホ対応・ログイン不要で閲覧可能。",
  openGraph: {
    title: "英語教材・単語帳一覧【無料】英検・TOEIC・大学受験 | Loop Vocabulary",
    description: "英検・TOEIC・大学受験の単語帳を無料でインポートして学習。AIが苦手を分析し効率的に暗記。",
  },
  alternates: { canonical: "https://loop-vocabulary.app/materials" },
};

const LEVEL_COLOR: Record<string, string> = {
  "中学基礎":    "bg-green-50 text-green-700",
  "中学標準":    "bg-green-50 text-green-700",
  "高校基礎":    "bg-blue-50 text-blue-700",
  "大学受験標準":"bg-indigo-50 text-indigo-700",
  "大学受験難関":"bg-purple-50 text-purple-700",
  "英検2級":    "bg-amber-50 text-amber-700",
  "英検準1級":  "bg-orange-50 text-orange-700",
  "英検1級":    "bg-red-50 text-red-700",
  "共通テスト":  "bg-rose-50 text-rose-700",
  "TOEIC基礎":  "bg-sky-50 text-sky-700",
  "TOEIC":      "bg-sky-50 text-sky-700",
  "ビジネス基礎": "bg-cyan-50 text-cyan-700",
  "ビジネス実践": "bg-cyan-50 text-cyan-700",
};

type Material = {
  id: string;
  title: string;
  publisher: string | null;
  author: string | null;
  description: string | null;
  level: string | null;
  exam_type: string | null;
};

type CategoryGroup = {
  id: string;
  label: string;
  icon: string;
  description: string;
  iconBg: string;
  comingSoon?: string[];
  match: (m: Material) => boolean;
  /** このカテゴリに対応する公開LPがあれば表示（例: /materials/toeic） */
  landingPages?: { href: string; label: string }[];
};

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "starter",
    label: "はじめての人におすすめ",
    icon: "🔰",
    description: "1日7語×2週間で終わる、厳選100語のスターターパック",
    iconBg: "bg-emerald-50",
    match: (m) => getPresetMeta(m.id)?.tags.includes("はじめての人におすすめ") ?? false,
  },
  {
    id: "university",
    label: "大学受験・共通テスト",
    icon: "🎓",
    description: "センター試験・難関大・推薦入試対策",
    iconBg: "bg-indigo-50",
    comingSoon: ["共通テスト必須800語"],
    match: (m) =>
      ["大学受験", "共通テスト", "高校入試"].includes(m.exam_type ?? "") ||
      ["大学受験標準", "大学受験難関", "高校基礎"].some((p) =>
        (m.level ?? "").startsWith(p),
      ),
    landingPages: [
      { href: "/materials/highschool", label: "高校生向けページへ" },
      { href: "/materials/university-exam", label: "大学受験対策ページへ" },
    ],
  },
  {
    id: "eiken",
    label: "英検対策",
    icon: "📝",
    description: "英検3級〜1級の合格を目指す",
    iconBg: "bg-amber-50",
    comingSoon: ["英検1級 必須単語"],
    match: (m) =>
      m.exam_type === "英検" ||
      ["英検2級", "英検準1級", "英検1級", "英検準2級", "英検3級"].some((p) =>
        (m.level ?? "").startsWith(p),
      ),
    landingPages: [{ href: "/materials/eiken", label: "英検対策ページへ" }],
  },
  {
    id: "toeic",
    label: "TOEIC・ビジネス英語",
    icon: "💼",
    description: "TOEIC 600〜990点・就活・昇進対策・社会人の学び直しに",
    iconBg: "bg-sky-50",
    comingSoon: ["TOEIC 990点突破"],
    match: (m) =>
      m.exam_type === "TOEIC" ||
      m.exam_type === "ビジネス英語" ||
      (m.level ?? "").startsWith("TOEIC") ||
      (m.level ?? "").startsWith("ビジネス"),
    landingPages: [
      { href: "/materials/toeic", label: "TOEIC対策ページへ" },
      { href: "/materials/business", label: "ビジネス英語ページへ" },
      { href: "/materials/news", label: "ニュース英語ページへ" },
    ],
  },
  {
    id: "junior",
    label: "中学・高校基礎",
    icon: "🌱",
    description: "英語の基礎を固める・高校入試対策",
    iconBg: "bg-green-50",
    comingSoon: ["中学英語 基礎500語"],
    match: (m) =>
      m.exam_type === "高校入試" ||
      ["中学基礎", "中学標準", "高校基礎"].some((p) =>
        (m.level ?? "").startsWith(p),
      ),
    landingPages: [{ href: "/materials/school-test", label: "定期テスト対策ページへ" }],
  },
  {
    id: "general",
    label: "日常会話・学び直し",
    icon: "☕",
    description: "社会人の学び直し・日常英会話に",
    iconBg: "bg-orange-50",
    match: (m) => m.exam_type === "一般",
  },
];

function MaterialCard({
  m,
  wordCount,
  learned,
  imported,
}: {
  m: Material;
  wordCount: number;
  learned: number;
  imported: boolean;
}) {
  const levelCls = LEVEL_COLOR[m.level ?? ""] ?? "bg-sky-50 text-navy-700";
  const progressPct =
    wordCount > 0 ? Math.round((learned / wordCount) * 100) : 0;
  const preset = getPresetMeta(m.id);

  return (
    <Link href={`/materials/${m.id}`} className="block">
      <div className="bg-white rounded-2xl border border-navy-100 shadow-card p-4 relative">
        {imported && (
          <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            ✓ 学習中
          </span>
        )}
        <div className="font-bold text-navy-800 pr-20">{m.title}</div>
        {(m.publisher || m.author) && (
          <div className="text-xs text-navy-500 mt-0.5">
            {[m.publisher, m.author].filter(Boolean).join(" / ")}
          </div>
        )}
        {m.description && (
          <div className="text-sm text-navy-600 mt-1 line-clamp-2">
            {m.description}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
          {m.level && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${levelCls}`}>
              {m.level}
            </span>
          )}
          {m.exam_type && (
            <span className="px-2 py-0.5 rounded-full bg-navy-50 text-navy-700">
              {m.exam_type}
            </span>
          )}
          {wordCount > 0 && (
            <span className="ml-auto text-navy-400 font-medium">
              {wordCount.toLocaleString()} 語
            </span>
          )}
        </div>
        {preset && (
          <div className="mt-1.5 flex items-center gap-2 text-[10px] flex-wrap text-navy-400">
            <span>{preset.grade}</span>
            <span>・目安 {preset.recommendedWeeks}週間</span>
            <span>・1日{preset.dailyWordTarget}語</span>
            {preset.tags.slice(0, 2).map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                {t}
              </span>
            ))}
          </div>
        )}
        {imported && wordCount > 0 && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-navy-400 mb-1">
              <span>
                習得済み {learned.toLocaleString()} / {wordCount.toLocaleString()} 語
              </span>
              <span className="font-semibold text-navy-600">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sp = await searchParams;

  let dbQuery = supabase
    .from("materials")
    .select("id, title, publisher, author, description, level, exam_type")
    .eq("is_public", true)
    .in("license_status", ["approved", "original"])
    .order("level", { ascending: true });

  if (sp.q) dbQuery = dbQuery.ilike("title", `%${sp.q}%`);

  const { data: materials } = await dbQuery.limit(200);

  const materialIds = (materials ?? []).map((m) => m.id);
  const [{ data: wordRows }, { data: importedBooks }, { data: userWordRows }] =
    await Promise.all([
      materialIds.length > 0
        ? supabase.rpc("get_material_word_counts", { p_material_ids: materialIds })
        : Promise.resolve({ data: [] as { material_id: string; word_count: number }[] }),
      user
        ? supabase
            .from("word_books")
            .select("source_material_id")
            .eq("user_id", user.id)
            .not("source_material_id", "is", null)
        : Promise.resolve({ data: [] as { source_material_id: string }[] }),
      user && materialIds.length > 0
        ? supabase
            .from("words")
            .select("material_id, mastery")
            .eq("user_id", user.id)
            .in("material_id", materialIds)
            .limit(50000)
        : Promise.resolve({ data: [] as { material_id: string; mastery: number }[] }),
    ]);

  type WordCountRow = { material_id: string; word_count: number };
  type UserWordRow = { material_id: string; mastery: number };
  const wordCounts = ((wordRows ?? []) as WordCountRow[]).reduce((acc: Record<string, number>, r) => {
    acc[r.material_id] = Number(r.word_count);
    return acc;
  }, {});
  const importedSet = new Set(
    (importedBooks ?? []).map((b) => b.source_material_id as string),
  );
  const userLearnedCounts = ((userWordRows ?? []) as UserWordRow[]).reduce((acc: Record<string, number>, r) => {
    if ((r.mastery ?? 0) >= 1) acc[r.material_id] = (acc[r.material_id] ?? 0) + 1;
    return acc;
  }, {});

  const allMaterials = (materials ?? []) as Material[];

  // 検索モード: フラットリスト表示
  if (sp.q) {
    return (
      <AppShell>
        <h1 className="text-xl font-bold text-navy-800 mb-4">教材・参考書</h1>
        <SearchBar defaultValue={sp.q} />
        <p className="text-sm text-navy-500 mt-3 mb-3">
          「{sp.q}」の検索結果 — {allMaterials.length} 件
        </p>
        <ul className="space-y-3">
          {allMaterials.map((m) => (
            <li key={m.id}>
              <MaterialCard
                m={m}
                wordCount={wordCounts[m.id] ?? 0}
                learned={userLearnedCounts[m.id] ?? 0}
                imported={importedSet.has(m.id)}
              />
            </li>
          ))}
          {allMaterials.length === 0 && (
            <li className="bg-white border border-dashed border-navy-200 rounded-2xl p-8 text-sm text-navy-500 text-center">
              該当する教材がありません。
            </li>
          )}
        </ul>
      </AppShell>
    );
  }

  // カテゴリ別表示
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">教材・参考書</h1>
      <p className="text-sm text-navy-500 mt-1 mb-4">
        英検・TOEIC・大学受験など許諾済み教材の単語をまとめて学習できます
      </p>

      {!user && (
        <div className="mb-4 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-sky-800">
            <span className="font-bold">無料登録</span>すると単語帳にインポートして学習を記録できます
          </div>
          <TrackedLink
            href="/signup"
            growthEvent="signup_cta_click"
            growthProperties={{ cta_location: "material" }}
            className="shrink-0 px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors"
          >
            無料で始める
          </TrackedLink>
        </div>
      )}

      {user && importedSet.size === 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">はじめての方へ</span> — 気になる教材を1つ選んで
            <b>「単語帳にインポート」</b>すると、すぐに学習と自動復習を始められます。
          </p>
        </div>
      )}

      <SearchBar />

      <div className="mt-3">
        <Link
          href="/guide"
          className="block bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs text-sky-800 hover:bg-sky-100 transition-colors"
        >
          <span className="font-bold">📘 学習ガイド</span> — 覚え方・復習タイミング・AI活用など学習法の記事はこちら →
        </Link>
      </div>

      {/* カテゴリから探す（アンカーリンクでページ内ジャンプ。新規ページは作らない） */}
      <div className="mt-4 flex flex-wrap gap-1.5" data-testid="category-quick-jump">
        {CATEGORY_GROUPS.map((group) => {
          const grouped = allMaterials.filter((m) => group.match(m));
          if (grouped.length === 0 && !group.comingSoon?.length) return null;
          return (
            <a
              key={group.id}
              href={`#${group.id}`}
              className="text-[11px] px-2.5 py-1 rounded-full bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors"
            >
              {group.icon} {group.label}
            </a>
          );
        })}
      </div>

      <div className="mt-5 space-y-7">
        {CATEGORY_GROUPS.map((group) => {
          const grouped = allMaterials.filter((m) => group.match(m));
          if (grouped.length === 0 && !group.comingSoon?.length) return null;

          return (
            <section key={group.id} id={group.id} className="scroll-mt-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className={`w-8 h-8 ${group.iconBg} rounded-xl flex items-center justify-center text-base flex-shrink-0`}
                >
                  {group.icon}
                </div>
                <div>
                  <h2 className="font-bold text-navy-800 text-sm leading-tight">
                    {group.label}
                  </h2>
                  <p className="text-[11px] text-navy-400">{group.description}</p>
                </div>
              </div>

              {group.landingPages && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {group.landingPages.map((lp) => (
                    <Link
                      key={lp.href}
                      href={lp.href}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors"
                    >
                      {lp.label} →
                    </Link>
                  ))}
                </div>
              )}

              <ul className="space-y-2.5">
                {grouped.map((m) => (
                  <li key={m.id}>
                    <MaterialCard
                      m={m}
                      wordCount={wordCounts[m.id] ?? 0}
                      learned={userLearnedCounts[m.id] ?? 0}
                      imported={importedSet.has(m.id)}
                    />
                  </li>
                ))}
                {group.comingSoon?.map((title) => (
                  <li key={title}>
                    <div className="bg-navy-50/60 border border-dashed border-navy-200 rounded-2xl p-3.5 text-center">
                      <span className="text-[11px] text-navy-400">
                        + {title}（近日公開）
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

function SearchBar({ defaultValue }: { defaultValue?: string }) {
  return (
    <form method="GET" action="/materials">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none text-sm">
          🔍
        </span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="教材を検索..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-navy-200 bg-white text-sm text-navy-800 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
      </div>
    </form>
  );
}
