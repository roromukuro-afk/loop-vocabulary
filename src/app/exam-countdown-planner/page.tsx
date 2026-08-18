import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ExamCountdownPlanner, type MaterialOption } from "./ExamCountdownPlanner";

export const dynamic = "force-dynamic";

const SITE_URL = "https://loop-vocabulary.app";
const PAGE_URL = `${SITE_URL}/exam-countdown-planner`;

// 「試験日から逆算」という文脈と相性が良い、明確な試験区分を持つ教材カテゴリのみに絞る
// (ビジネス英語・一般語彙のように「試験日」が存在しないカテゴリは対象外)。
const EXAM_TYPES_FOR_SELECTOR = ["英検", "TOEIC", "大学受験", "高校入試"];

export const metadata: Metadata = {
  title: "試験日から逆算する学習計画メーカー【無料】1日の単語数を自動計算 | Loop Vocabulary",
  description:
    "試験日と覚えたい単語数を入力するだけで、今日から試験日までの1日あたりの学習語数を無料で自動計算。復習期間を確保するパターンも同時に表示します。ログイン不要。",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "試験日から逆算する学習計画メーカー【無料】1日の単語数を自動計算",
    description: "試験日と単語数を入力するだけで、1日あたりの学習ペースを自動計算。ログイン不要ですぐ使えます。",
    url: PAGE_URL,
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "ツール一覧", item: `${SITE_URL}/tools` },
    { "@type": "ListItem", position: 3, name: "試験日から逆算する学習計画メーカー", item: PAGE_URL },
  ],
};

const FAQ_ITEMS = [
  {
    q: "1日の学習ペースはどう計算していますか？",
    a: "「覚えたい単語数 ÷ 学習に充てられる日数」を切り上げて計算しています。学習に充てられる日数は、今日から試験日までの残り日数（今日を含む）です。休憩日や理解度による復習の増減は考慮していない単純計算です。",
  },
  {
    q: "「復習期間を7日確保する場合」のペースは何が違いますか？",
    a: "試験直前の7日間は新しい単語を増やさず、既に学習した単語の復習に充てるという前提で、残りの日数だけで1日あたりの語数を再計算したものです。直前は新規学習より復習を優先した方が定着しやすいという一般的な学習アドバイスに基づく目安であり、残り日数が7日以下の場合は最短ペースと同じ表示になります。",
  },
  {
    q: "複数の教材を組み合わせて学習している場合はどうすればいいですか？",
    a: "「教材から単語数を入力」は1つの教材の総収録語数を自動入力する機能です。複数の教材を組み合わせている場合は、それぞれの語数を合計した数を「覚えたい単語数」に手入力してください。",
  },
  {
    q: "「教材から単語数を入力」で入力される数字は、自分が覚えていない残りの単語数ですか？",
    a: "いいえ、その教材に収録されている総単語数です。すでに覚えている単語の数は考慮されていません。自分の学習状況に応じて、表示された数字を目安に「覚えたい単語数」を調整してください。",
  },
  {
    q: "試験日を過ぎた日付を入力するとどうなりますか？",
    a: "試験日が今日より前の日付になっている旨のエラーメッセージが表示され、計算結果は表示されません。正しい試験日（今日以降の日付）を入力し直してください。",
  },
  {
    q: "このツールの計算結果は合格を保証しますか？",
    a: "いいえ、保証するものではありません。このツールは単語数と日数から学習ペースの目安を計算する簡易シミュレーターです。実際の記憶定着は単語の難易度・既知語との重複・復習の質によって大きく変わるため、あくまで学習計画を立てるための参考としてご利用ください。",
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

export default async function ExamCountdownPlannerPage() {
  // 教材選択肢: 既存の読み取り専用RPC get_material_word_counts を使って、公開・承認済みの
  // 教材から「試験区分」がある教材カテゴリのみ総語数付きで取得する(materials/eiken等と同じ
  // 呼び出しパターン。マイグレーション・書き込みは一切行わない)。
  let materialOptions: MaterialOption[] = [];
  try {
    const supabase = await createClient();
    const { data: materials } = await supabase
      .from("materials")
      .select("id, title, level, exam_type")
      .eq("is_public", true)
      .in("license_status", ["approved", "original"])
      .in("exam_type", EXAM_TYPES_FOR_SELECTOR)
      .order("exam_type", { ascending: true })
      .order("title", { ascending: true });

    const rows = (materials ?? []) as { id: string; title: string; level: string | null; exam_type: string | null }[];
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

    materialOptions = rows
      .map((m) => ({
        id: m.id,
        title: m.title,
        examType: m.exam_type,
        level: m.level,
        wordCount: wordCounts[m.id] ?? 0,
      }))
      .filter((m) => m.wordCount > 0);
  } catch {
    // 教材データの取得に失敗しても、手入力での利用は継続できるようにする
    // (Supabase未設定・一時的なエラー等でツール自体を止めない)。
    materialOptions = [];
  }

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">試験日から逆算する<br />学習計画メーカー</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">
            試験日と単語数を入力するだけで、1日あたりの学習ペースを自動計算します。
          </p>
        </div>
      </div>

      <ExamCountdownPlanner materials={materialOptions} />

      <div className="max-w-2xl mx-auto px-4 mt-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-2">よくある質問</h2>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
