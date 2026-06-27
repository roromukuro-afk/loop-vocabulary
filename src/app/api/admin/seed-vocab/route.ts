import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Batch 1
import highschoolWords from "@/data/seed-highschool.json";
import toeicWords from "@/data/seed-toeic.json";
import eiken2Extra from "@/data/seed-eiken2-extra.json";
import eikenP1Extra from "@/data/seed-eiken-p1-extra.json";
import juniorExtra from "@/data/seed-junior-extra.json";

// Vol 2 (material_id 000000000020-23)
import wordsVol2 from "@/data/seed-words-vol2.json";

// 初学者向け基礎語彙 (material_id 000000000033-36)
import eikenPre2Words from "@/data/seed-eiken-pre2.json";
import eikenPre2B2 from "@/data/seed-eiken-pre2-b2.json";
import eikenPre2B3 from "@/data/seed-eiken-pre2-b3.json";
import eiken3Words from "@/data/seed-eiken3.json";
import eiken3B2 from "@/data/seed-eiken3-b2.json";
import eiken3B3 from "@/data/seed-eiken3-b3.json";
import eiken45Words from "@/data/seed-eiken45.json";
import eiken45B2 from "@/data/seed-eiken45-b2.json";
import eiken45B3 from "@/data/seed-eiken45-b3.json";
import eiken45B4 from "@/data/seed-eiken45-b4.json";
import basicDailyWords from "@/data/seed-basic-daily.json";
import basicDailyB2 from "@/data/seed-basic-daily-b2.json";

// Batch 2
import highschoolB2 from "@/data/seed-highschool-b2.json";
import highschoolB3 from "@/data/seed-highschool-b3.json";
import eiken1Words from "@/data/seed-eiken1.json";
import eiken1B2 from "@/data/seed-eiken1-b2.json";
import eiken1B3 from "@/data/seed-eiken1-b3.json";
import daigakuB2 from "@/data/seed-daigaku-b2.json";
import daigakuB3 from "@/data/seed-daigaku-b3.json";
import daigakuB4 from "@/data/seed-daigaku-b4.json";
import daigakuB5 from "@/data/seed-daigaku-b5.json";
import daigakuB6 from "@/data/seed-daigaku-b6.json";
import daigakuB7 from "@/data/seed-daigaku-b7.json";
import daigakuB8 from "@/data/seed-daigaku-b8.json";
import juniorB2 from "@/data/seed-junior-b2.json";
import juniorB3 from "@/data/seed-junior-b3.json";
import juniorB4 from "@/data/seed-junior-b4.json";
import juniorB5 from "@/data/seed-junior-b5.json";
import juniorB6 from "@/data/seed-junior-b6.json";
import juniorB7 from "@/data/seed-junior-b7.json";
import toeicB2 from "@/data/seed-toeic-b2.json";
import toeicB3 from "@/data/seed-toeic-b3.json";
import toeicB4 from "@/data/seed-toeic-b4.json";
import toeicB5 from "@/data/seed-toeic-b5.json";
import toeicB6 from "@/data/seed-toeic-b6.json";
import toeicB7 from "@/data/seed-toeic-b7.json";
import eiken2B2 from "@/data/seed-eiken2-b2.json";
import eiken2B3 from "@/data/seed-eiken2-b3.json";
import eiken2B4 from "@/data/seed-eiken2-b4.json";
import eiken2B5 from "@/data/seed-eiken2-b5.json";
import eiken2B6 from "@/data/seed-eiken2-b6.json";
import eikenP1B2 from "@/data/seed-eiken-p1-b2.json";
import eikenP1B3 from "@/data/seed-eiken-p1-b3.json";
import eikenP1B4 from "@/data/seed-eiken-p1-b4.json";
import highschoolB4 from "@/data/seed-highschool-b4.json";
import eiken3B4 from "@/data/seed-eiken3-b4.json";
import eiken3B5 from "@/data/seed-eiken3-b5.json";
import eiken3B6 from "@/data/seed-eiken3-b6.json";
import eikenPre2B4 from "@/data/seed-eiken-pre2-b4.json";
import eikenPre2B5 from "@/data/seed-eiken-pre2-b5.json";
import eikenPre2B6 from "@/data/seed-eiken-pre2-b6.json";
import eiken45B5 from "@/data/seed-eiken45-b5.json";
import eiken45B6 from "@/data/seed-eiken45-b6.json";
import basicDailyB3 from "@/data/seed-basic-daily-b3.json";
import basicDailyB4 from "@/data/seed-basic-daily-b4.json";
import toeicB8 from "@/data/seed-toeic-b8.json";
import toeicB9 from "@/data/seed-toeic-b9.json";
import toeicB10 from "@/data/seed-toeic-b10.json";
import toeicB11 from "@/data/seed-toeic-b11.json";
import toeicB12 from "@/data/seed-toeic-b12.json";
import toeicB13 from "@/data/seed-toeic-b13.json";
import basicDailyB5 from "@/data/seed-basic-daily-b5.json";
import basicDailyB6 from "@/data/seed-basic-daily-b6.json";
import eiken3B7 from "@/data/seed-eiken3-b7.json";
import eikenPre2B7 from "@/data/seed-eiken-pre2-b7.json";
import eiken45B7 from "@/data/seed-eiken45-b7.json";
import eiken1B4 from "@/data/seed-eiken1-b4.json";
import eikenPre2B8 from "@/data/seed-eiken-pre2-b8.json";
import eiken45B8 from "@/data/seed-eiken45-b8.json";
import highschoolB5 from "@/data/seed-highschool-b5.json";
import highschoolB6 from "@/data/seed-highschool-b6.json";
import eiken3B8 from "@/data/seed-eiken3-b8.json";
import eiken3B9 from "@/data/seed-eiken3-b9.json";
import eikenPre2B9 from "@/data/seed-eiken-pre2-b9.json";
import eiken45B9 from "@/data/seed-eiken45-b9.json";
import basicDailyB7 from "@/data/seed-basic-daily-b7.json";
import toeicB14 from "@/data/seed-toeic-b14.json";
import eiken1B5 from "@/data/seed-eiken1-b5.json";
import eiken1B6 from "@/data/seed-eiken1-b6.json";
import highschoolB7 from "@/data/seed-highschool-b7.json";
import toeicB15 from "@/data/seed-toeic-b15.json";
import eikenPre2B10 from "@/data/seed-eiken-pre2-b10.json";
import eiken45B10 from "@/data/seed-eiken45-b10.json";
import eiken3B10 from "@/data/seed-eiken3-b10.json";
import basicDailyB8 from "@/data/seed-basic-daily-b8.json";
import highschoolB8 from "@/data/seed-highschool-b8.json";
import toeicB16 from "@/data/seed-toeic-b16.json";
import eikenPre2B11 from "@/data/seed-eiken-pre2-b11.json";
import eiken45B11 from "@/data/seed-eiken45-b11.json";
import eiken3B11 from "@/data/seed-eiken3-b11.json";
import basicDailyB9 from "@/data/seed-basic-daily-b9.json";
import eiken1B7 from "@/data/seed-eiken1-b7.json";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NEW_MATERIALS = [
  {
    id: "00000000-0000-0000-0000-000000000030",
    title: "高校英語基礎 重要単語",
    publisher: "Loop Vocabulary",
    level: "高校基礎",
    exam_type: "一般",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000031",
    title: "TOEIC 頻出単語 800",
    publisher: "Loop Vocabulary",
    level: "TOEIC",
    exam_type: "TOEIC",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000032",
    title: "英検1級 必須単語",
    publisher: "Loop Vocabulary",
    level: "英検1級",
    exam_type: "英検",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000033",
    title: "英検準2級 重要単語",
    publisher: "Loop Vocabulary",
    level: "英検準2級",
    exam_type: "英検",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000034",
    title: "英検3級 重要単語",
    publisher: "Loop Vocabulary",
    level: "英検3級",
    exam_type: "英検",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000035",
    title: "英検5・4級 基礎単語",
    publisher: "Loop Vocabulary",
    level: "英検4・5級",
    exam_type: "英検",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000036",
    title: "日常英会話 基礎フレーズ",
    publisher: "Loop Vocabulary",
    level: "日常会話",
    exam_type: "一般",
    is_public: true,
    license_status: "approved",
    license_note: "Loop Vocabularyオリジナル教材",
    source_url: null,
  },
];

type WordRow = {
  material_id: string;
  word: string;
  meaning: string;
  pos: string;
  level: string;
  importance: number;
  display_order: number;
  example?: string;
  example_ja?: string;
};

async function upsertChunked(
  supabase: ReturnType<typeof createAdminClient>,
  rows: WordRow[],
  chunkSize = 200
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // material_id ごとに既存の word セットを取得
  const materialIds = [...new Set(rows.map((r) => r.material_id))];
  const existingWords = new Set<string>();
  for (const mid of materialIds) {
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("material_words")
        .select("word")
        .eq("material_id", mid)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) break;
      data.forEach((r: { word: string }) => existingWords.add(`${mid}:${r.word}`));
      if (data.length < pageSize) break;
      page++;
    }
  }

  // 新規行だけ抽出（内部重複も除去）
  const seenKeys = new Set<string>();
  const newRows = rows.filter((r) => {
    const key = `${r.material_id}:${r.word}`;
    if (existingWords.has(key) || seenKeys.has(key)) {
      skipped++;
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  // チャンク単位で INSERT
  for (let i = 0; i < newRows.length; i += chunkSize) {
    const chunk = newRows.slice(i, i + chunkSize);
    const { error, data } = await supabase
      .from("material_words")
      .insert(chunk)
      .select("id");
    if (error) {
      console.error("insert error:", error.message);
      skipped += chunk.length;
    } else {
      inserted += (data ?? []).length;
    }
  }

  return { inserted, skipped };
}

async function isAdminUser(token: string): Promise<boolean> {
  const env = getSupabaseEnv();
  if (!env.ok) return false;
  // トークン検証は anon client で（JWT署名を検証）
  const client = createServerClient(env.url!, env.anon!, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return false;
  // profiles 参照は service_role（RLS無限ループ回避）
  let adminClient: ReturnType<typeof createAdminClient>;
  try { adminClient = createAdminClient(); } catch { return false; }
  const { data } = await adminClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return !!data?.is_admin;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CRON_SECRETが一致すればOK、そうでなければadmin JWTチェック
  const isValidCron = cronSecret && token === cronSecret;
  if (!isValidCron) {
    const admin = await isAdminUser(token);
    if (!admin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const dataset: string = body.dataset ?? "all";

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client not configured" }, { status: 500 });
  }

  const results: Record<string, { inserted: number; skipped: number }> = {};

  // 新規教材レコードをupsert
  if (dataset === "all" || dataset === "materials") {
    for (const mat of NEW_MATERIALS) {
      await supabase
        .from("materials")
        .upsert(mat, { onConflict: "id", ignoreDuplicates: true });
    }
  }

  // 高校英語基礎 (batch1 + b2 + b3 + b4)
  if (dataset === "all" || dataset === "highschool") {
    const allHighschool = [
      ...(highschoolWords as WordRow[]),
      ...(highschoolB2 as WordRow[]),
      ...(highschoolB3 as WordRow[]),
      ...(highschoolB4 as WordRow[]),
      ...(highschoolB5 as WordRow[]),
      ...(highschoolB6 as WordRow[]),
      ...(highschoolB7 as WordRow[]),
      ...(highschoolB8 as WordRow[]),
    ];
    results.highschool = await upsertChunked(supabase, allHighschool);
  }

  // TOEIC (batch1 + b2 + b3 + b4 + b5 + b6 + b7 + b8 + b9)
  if (dataset === "all" || dataset === "toeic") {
    const allToeic = [
      ...(toeicWords as WordRow[]),
      ...(toeicB2 as WordRow[]),
      ...(toeicB3 as WordRow[]),
      ...(toeicB4 as WordRow[]),
      ...(toeicB5 as WordRow[]),
      ...(toeicB6 as WordRow[]),
      ...(toeicB7 as WordRow[]),
      ...(toeicB8 as WordRow[]),
      ...(toeicB9 as WordRow[]),
      ...(toeicB10 as WordRow[]),
      ...(toeicB11 as WordRow[]),
      ...(toeicB12 as WordRow[]),
      ...(toeicB13 as WordRow[]),
      ...(toeicB14 as WordRow[]),
      ...(toeicB15 as WordRow[]),
      ...(toeicB16 as WordRow[]),
    ];
    results.toeic = await upsertChunked(supabase, allToeic);
  }

  // 英検2級 (batch1 + b2 + b3 + b4 + b5 + b6)
  if (dataset === "all" || dataset === "eiken2") {
    const allEiken2 = [
      ...(eiken2Extra as WordRow[]),
      ...(eiken2B2 as WordRow[]),
      ...(eiken2B3 as WordRow[]),
      ...(eiken2B4 as WordRow[]),
      ...(eiken2B5 as WordRow[]),
      ...(eiken2B6 as WordRow[]),
    ];
    results.eiken2 = await upsertChunked(supabase, allEiken2);
  }

  // 英検準1級 (batch1 + b2 + b3 + b4)
  if (dataset === "all" || dataset === "eikenP1") {
    const allEikenP1 = [
      ...(eikenP1Extra as WordRow[]),
      ...(eikenP1B2 as WordRow[]),
      ...(eikenP1B3 as WordRow[]),
      ...(eikenP1B4 as WordRow[]),
    ];
    results.eikenP1 = await upsertChunked(supabase, allEikenP1);
  }

  // 英検1級 (b1 + b2 + b3)
  if (dataset === "all" || dataset === "eiken1") {
    const allEiken1 = [
      ...(eiken1Words as WordRow[]),
      ...(eiken1B2 as WordRow[]),
      ...(eiken1B3 as WordRow[]),
      ...(eiken1B4 as WordRow[]),
      ...(eiken1B5 as WordRow[]),
      ...(eiken1B6 as WordRow[]),
      ...(eiken1B7 as WordRow[]),
    ];
    results.eiken1 = await upsertChunked(supabase, allEiken1);
  }

  // 中学英語 (batch1 + b2 + b3 + b4 + b5 + b6 + b7)
  if (dataset === "all" || dataset === "junior") {
    const allJunior = [
      ...(juniorExtra as WordRow[]),
      ...(juniorB2 as WordRow[]),
      ...(juniorB3 as WordRow[]),
      ...(juniorB4 as WordRow[]),
      ...(juniorB5 as WordRow[]),
      ...(juniorB6 as WordRow[]),
      ...(juniorB7 as WordRow[]),
    ];
    results.junior = await upsertChunked(supabase, allJunior);
  }

  // 大学受験 (b2 ~ b8)
  if (dataset === "all" || dataset === "daigaku") {
    const allDaigaku = [
      ...(daigakuB2 as WordRow[]),
      ...(daigakuB3 as WordRow[]),
      ...(daigakuB4 as WordRow[]),
      ...(daigakuB5 as WordRow[]),
      ...(daigakuB6 as WordRow[]),
      ...(daigakuB7 as WordRow[]),
      ...(daigakuB8 as WordRow[]),
    ];
    results.daigaku = await upsertChunked(supabase, allDaigaku);
  }

  // Vol2 (material_id 000000000020-23: 約1,996語)
  if (dataset === "all" || dataset === "vol2") {
    results.vol2 = await upsertChunked(supabase, wordsVol2 as WordRow[]);
  }

  // 英検準2級 (material 33)
  if (dataset === "all" || dataset === "eikenPre2") {
    const allEikenPre2 = [
      ...(eikenPre2Words as WordRow[]),
      ...(eikenPre2B2 as WordRow[]),
      ...(eikenPre2B3 as WordRow[]),
      ...(eikenPre2B4 as WordRow[]),
      ...(eikenPre2B5 as WordRow[]),
      ...(eikenPre2B6 as WordRow[]),
      ...(eikenPre2B7 as WordRow[]),
      ...(eikenPre2B8 as WordRow[]),
      ...(eikenPre2B9 as WordRow[]),
      ...(eikenPre2B10 as WordRow[]),
      ...(eikenPre2B11 as WordRow[]),
    ];
    results.eikenPre2 = await upsertChunked(supabase, allEikenPre2);
  }

  // 英検3級 (material 34)
  if (dataset === "all" || dataset === "eiken3") {
    const allEiken3 = [
      ...(eiken3Words as WordRow[]),
      ...(eiken3B2 as WordRow[]),
      ...(eiken3B3 as WordRow[]),
      ...(eiken3B4 as WordRow[]),
      ...(eiken3B5 as WordRow[]),
      ...(eiken3B6 as WordRow[]),
      ...(eiken3B7 as WordRow[]),
      ...(eiken3B8 as WordRow[]),
      ...(eiken3B9 as WordRow[]),
      ...(eiken3B10 as WordRow[]),
      ...(eiken3B11 as WordRow[]),
    ];
    results.eiken3 = await upsertChunked(supabase, allEiken3);
  }

  // 英検5・4級 (material 35)
  if (dataset === "all" || dataset === "eiken45") {
    const allEiken45 = [
      ...(eiken45Words as WordRow[]),
      ...(eiken45B2 as WordRow[]),
      ...(eiken45B3 as WordRow[]),
      ...(eiken45B4 as WordRow[]),
      ...(eiken45B5 as WordRow[]),
      ...(eiken45B6 as WordRow[]),
      ...(eiken45B7 as WordRow[]),
      ...(eiken45B8 as WordRow[]),
      ...(eiken45B9 as WordRow[]),
      ...(eiken45B10 as WordRow[]),
      ...(eiken45B11 as WordRow[]),
    ];
    results.eiken45 = await upsertChunked(supabase, allEiken45);
  }

  // 日常英会話基礎 (material 36)
  if (dataset === "all" || dataset === "basicDaily") {
    const allBasicDaily = [
      ...(basicDailyWords as WordRow[]),
      ...(basicDailyB2 as WordRow[]),
      ...(basicDailyB3 as WordRow[]),
      ...(basicDailyB4 as WordRow[]),
      ...(basicDailyB5 as WordRow[]),
      ...(basicDailyB6 as WordRow[]),
      ...(basicDailyB7 as WordRow[]),
      ...(basicDailyB8 as WordRow[]),
      ...(basicDailyB9 as WordRow[]),
    ];
    results.basicDaily = await upsertChunked(supabase, allBasicDaily);
  }

  const { count: total } = await supabase
    .from("material_words")
    .select("id", { count: "exact", head: true });

  const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
  const totalSkipped = Object.values(results).reduce((s, r) => s + r.skipped, 0);

  return NextResponse.json({
    ok: true,
    dataset,
    results,
    totalInserted,
    totalSkipped,
    dbTotal: total,
  });
}
