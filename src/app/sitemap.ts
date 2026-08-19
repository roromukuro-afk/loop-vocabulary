import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LESSONS } from "@/lib/grammar/lessons";
import { PILOT_WORDS } from "@/lib/dictionaryWords/pilotWords";
import { toSafeLastModified } from "@/lib/seo/sitemapDates";
import { normalizeSiteUrl } from "@/lib/seo/siteUrl";

const GUIDE_SLUGS = [
  "vocabulary-review-schedule-guide",
  "vocabulary-quiz-pdf-for-teachers",
  "english-vocabulary-quiz-maker",
  "printable-english-vocabulary-test",
  "juku-vocabulary-test",
  "high-school-english-vocabulary-test",
  "spaced-repetition-english-vocabulary",
  "flashcards-vs-multiple-choice",
  "eiken-vocabulary-study",
  "university-exam-vocabulary",
  "school-test-vocabulary",
  "listening-and-pronunciation-vocabulary",
  "ai-vocabulary-learning",
  "daigaku-juken-tango",
  "eiken-2kyu-tango",
  "eiken-jun1-tango",
  "eiken-1kyu-tango",
  "chugaku-eigo-tango",
  "eiken-conversation",
  "ielts-tango",
  "toeic-tango",
  "business-english-tango",
  "eitango-oboeru-houhou",
  "eitango-no-oboekata",
  "eiken-3kyu-tango",
  "eiken-jun2-tango",
  "eigo-hatsuon-renshu",
  "koukou-eigo-tango",
  "toeic-900ten",
  "eigo-listening-renshu",
  "eibunpo-kiso",
  "eigo-dokkai-houhou",
  "eitango-oboerarenai",
  "eitango-ichinichi-nanko",
  "genzaikanryo-kakokei-chigai",
  "fukikisoku-doushi-ichiran",
  "affect-vs-effect",
  "apply-for-vs-apply-to",
  "eiken-2kyu-tango-nanko",
  "tangocho-erabikata",
  "system-eitango",
  "target-1900",
  "systan-vs-target-1900",
  "leap-eitango",
  "eitango-cho-hikaku",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // NEXT_PUBLIC_SITE_URLが末尾スラッシュ付きで設定されていても、以降の全URLで
  // "//materials/xxx"のような二重スラッシュが発生しないよう正規化してから使う。
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

  // 公開教材ごとのlastModifiedは、実際のコンテンツ更新時のみ更新されるDBカラム
  // (materials.updated_at、trg_touch_materialsトリガーでUPDATE時にnow()がセットされる。
  // INSERT時のデフォルト値がそのまま残っているだけの行はcreated_atと同値になりうるが、
  // これは「作成時点」という実際の事実であり、偽の現在時刻ではない)から取得する。
  // 静的ページ・辞書・ガイド・文法は、ページ単位で信頼できる更新日時のデータソースが
  // 無いため、誤った現在時刻を設定するよりlastModifiedを省略する。
  let materials: { id: string; updated_at: string | null }[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("materials")
      .select("id, updated_at")
      .eq("is_public", true)
      .order("created_at", { ascending: true });
    if (data) {
      materials = data;
    }
  } catch {
    // If DB fetch fails at build time, sitemap still works without material entries
  }

  return [
    { url: base,                         changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/about`,              changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/press`,              changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/reports`,            changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/vocab-check`,        changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vocab-check/eiken`,  changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vocab-check/toeic`,  changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/dictionary`,         changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/premium`,            changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools`,              changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/vocab-test-maker`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/review-date-calculator`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/exam-countdown-planner`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/word-list-cleaner`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/materials`,          changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/materials/toeic`,    changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/business`, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/news`,     changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/highschool`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/eiken`,      changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/university-exam`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/school-test`,     changeFrequency: "weekly", priority: 0.85 },
    ...materials.map((m) => ({
      url: `${base}/materials/${m.id}`,
      lastModified: toSafeLastModified(m.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // /dictionary/[word] は品質基準(実例文あり・独自解説あり)を満たしindexEligible=trueの
    // ものだけをsitemapに含める。noindex対象のページは意図的にsitemapへ含めない。
    ...PILOT_WORDS.filter((w) => w.isIndexEligible).map((w) => ({
      url: `${base}/dictionary/${w.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/guide`,              changeFrequency: "weekly",  priority: 0.8 },
    ...GUIDE_SLUGS.map((slug) => ({
      url: `${base}/guide/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/grammar`,            changeFrequency: "weekly",  priority: 0.8 },
    ...LESSONS.map((l) => ({
      url: `${base}/grammar/${l.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/faq`,                changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/phrases`,           changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/shadowing`,         changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/roadmap`,           changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`,            changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/terms`,              changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/contact`,            changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/commercial-transaction`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/content-policy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
