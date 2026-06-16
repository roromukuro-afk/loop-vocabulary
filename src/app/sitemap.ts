import type { MetadataRoute } from "next";

const GUIDE_SLUGS = [
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
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://loop-vocabulary.vercel.app";
  const now = new Date();
  return [
    { url: base,                         lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/login`,              lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`,             lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/premium`,            lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/guide`,              lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    ...GUIDE_SLUGS.map((slug) => ({
      url: `${base}/guide/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/faq`,                lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/test`,              lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/test/attack`,      lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/vocab-check`,       lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/vocab-check/toeic`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/vocab-check/eiken`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/extract`,           lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/plan`,              lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/phrases`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/shadowing`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/roadmap`,           lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/terms`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/contact`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
