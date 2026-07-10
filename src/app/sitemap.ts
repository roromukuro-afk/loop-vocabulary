import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LESSONS } from "@/lib/grammar/lessons";

const GUIDE_SLUGS = [
  "vocabulary-quiz-pdf-for-teachers",
  "how-to-memorize-english-words",
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
  "eiken-2kyu-tango-nanko",
  "tangocho-erabikata",
  "system-eitango",
  "target-1900",
  "systan-vs-target-1900",
  "leap-eitango",
  "eitango-cho-hikaku",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.app";
  const now = new Date();

  // Fetch all public material IDs for dynamic sitemap entries
  let materialIds: string[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("materials")
      .select("id")
      .eq("is_public", true)
      .order("created_at", { ascending: true });
    if (data) {
      materialIds = data.map((m: { id: string }) => m.id);
    }
  } catch {
    // If DB fetch fails at build time, sitemap still works without material entries
  }

  return [
    { url: base,                         lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/about`,              lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/press`,              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/vocab-check`,        lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vocab-check/eiken`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vocab-check/toeic`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/dictionary`,         lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/premium`,            lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/materials`,          lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/materials/toeic`,    lastModified: now, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/business`, lastModified: now, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/news`,     lastModified: now, changeFrequency: "weekly",  priority: 0.85 },
    { url: `${base}/materials/highschool`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/eiken`,      lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/university-exam`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/materials/school-test`,     lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    ...materialIds.map((id) => ({
      url: `${base}/materials/${id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${base}/guide`,              lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    ...GUIDE_SLUGS.map((slug) => ({
      url: `${base}/guide/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/grammar`,            lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    ...LESSONS.map((l) => ({
      url: `${base}/grammar/${l.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/faq`,                lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/phrases`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/shadowing`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/roadmap`,           lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/terms`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/contact`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/legal/commercial-transaction`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/content-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
