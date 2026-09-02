import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackServerEvent, trackWordCountMilestones } from "@/lib/analytics/trackServerEvent";
import { sanitizeRows } from "@/lib/vocabTest/parsePastedWords";
import { resolveAnalyticsRequestContext } from "@/lib/analytics/resolveAnalyticsRequestContext";

export const runtime = "nodejs";

/**
 * /tools/vocab-test-maker(no-login公開ツール)で作成した単語を、
 * ログイン中のユーザーの新規「custom」単語帳として保存する。
 *
 * 認証必須の狭いendpoint。未認証writeは一切行わない(公開ツール自体の生成・印刷は
 * 完全にclient-sideで完結しており、このendpointは「Loopで覚える」を選んだ
 * 認証済みユーザーのみが呼ぶ)。
 *
 * bodyのwordsは信用しない — クライアント側でparsePastedWords()を通していても、
 * ここでもう一度sanitizeRows()で同じ上限(100件・各200文字・重複除去)を
 * ゼロから再検証する。
 */
export async function POST(req: NextRequest) {
  const analyticsContext = await resolveAnalyticsRequestContext(req);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const rawWords = bodyRecord?.words ?? null;
  // attributionは認証・保存可否には一切使わない未信用の分析用相関値。
  // trackServerEvent()側でクライアントイベントと同じ100文字上限へ正規化する。
  const rawAttribution = bodyRecord?.attribution;
  const attributionRecord =
    rawAttribution && typeof rawAttribution === "object"
      ? rawAttribution as Record<string, unknown>
      : null;
  const attributionSource =
    typeof attributionRecord?.source === "string" ? attributionRecord.source : null;
  const attributionCampaign =
    typeof attributionRecord?.campaign === "string" ? attributionRecord.campaign : null;
  const rows = sanitizeRows(rawWords);
  if (rows.length === 0) {
    return NextResponse.json({ error: "no_valid_words" }, { status: 400 });
  }

  // 単語帳のタイトルはユーザーの自由記述を含めない(自動生成の固定文言のみ)。
  // ANALYTICS_PRIVACY_POLICY.mdの方針(自由記述はanalyticsへ送らない)とは別に、
  // タイトル自体もここでは常に定型文にすることで、貼り付け内容がDBのtitle列経由で
  // 別画面(単語帳一覧等)に平文表示される範囲を狭める意図。
  const title = `貼り付けた単語(${rows.length}語)`;

  // このAPIにスキーマ変更(idempotency key列の追加等)を加えずに、レスポンス消失や
  // タイムアウトによる再送でも重複したwordbookを作らないようにする(Codexレビュー
  // 指摘対応)。直前(30秒以内)に同じユーザー・同じ自動生成タイトルで作られた
  // custom単語帳があり、かつ実際のword内容が今回のリクエストと完全一致する場合は、
  // 新規作成せずその単語帳を返す(たまたま同じ語数・内容を短時間に2回貼り付けた
  // 正当なケースと区別するため、タイトルだけでなく内容の完全一致まで確認する)。
  const { data: recentBooks } = await supabase
    .from("word_books")
    .select("id, created_at")
    .eq("user_id", user.id)
    .eq("title", title)
    .eq("source_type", "custom")
    .gte("created_at", new Date(Date.now() - 30_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(3);
  if (recentBooks && recentBooks.length > 0) {
    const requestedSet = new Set(rows.map((r) => `${r.word}\u0000${r.meaning}`));
    for (const candidate of recentBooks) {
      const { data: existingWords } = await supabase
        .from("words")
        .select("word, meaning")
        .eq("word_book_id", candidate.id);
      const existingSet = new Set((existingWords ?? []).map((w) => `${w.word}\u0000${w.meaning}`));
      const sameContent = existingSet.size === requestedSet.size && [...requestedSet].every((k) => existingSet.has(k));
      if (sameContent) {
        return NextResponse.json({ ok: true, wordbook_id: candidate.id, word_count: rows.length });
      }
    }
  }

  const { data: newBook, error: bookErr } = await supabase
    .from("word_books")
    .insert({ user_id: user.id, title, source_type: "custom" })
    .select("id")
    .single();
  if (bookErr || !newBook) {
    console.error("[vocab-test-maker/save] wordbook create failed:", bookErr?.code);
    return NextResponse.json({ error: "wordbook_create_failed" }, { status: 500 });
  }

  // words.id(NOT NULL)はDB側default(gen_random_uuid()等)に委ねるため、
  // 挿入行オブジェクトに`id`キー自体を一切含めない(bulk array insertでの
  // undefined→null直列化事故を避ける。詳細はbuildImportedWordRows.tsのコメント参照)。
  const wordRows = rows.map((r) => ({
    user_id: user.id,
    word_book_id: newBook.id,
    word: r.word,
    meaning: r.meaning,
  }));

  // milestone判定用に挿入前件数を取得しておく(bulk-add等の既存保存経路と同じ方式)。
  // このクエリが失敗した場合、countBeforeはnullになる。`?? 0`で0扱いにしてしまうと、
  // 既にfive/ten_words_added閾値を超えている既存ユーザーでも「初めて超えた」と
  // 誤判定し、実際には超えていないmilestoneイベントを誤発火してしまうため、
  // 失敗時はmilestone計算自体を省略する(Codexレビュー指摘対応)。
  const { count: countBefore, error: countBeforeErr } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countBeforeErr) {
    console.error("[vocab-test-maker/save] countBefore query failed:", countBeforeErr.code);
  }

  const { error: wordsErr } = await supabase.from("words").insert(wordRows);
  if (wordsErr) {
    // 単語の永続化に失敗した場合、空のwordbookをorphanとして残さない。
    const { error: cleanupError } = await supabase.from("word_books").delete().eq("id", newBook.id);
    if (cleanupError) {
      console.error("[vocab-test-maker/save] cleanup after words insert failure also failed:", cleanupError.code);
      return NextResponse.json({ error: "save_cleanup_failed" }, { status: 500 });
    }
    console.error("[vocab-test-maker/save] words insert failed:", wordsErr.code);
    return NextResponse.json({ error: "words_create_failed" }, { status: 500 });
  }

  // analyticsはここまで(wordbook作成・単語挿入とも成功確定)まで発火しない。
  // 失敗してもこのAPI自体の成功レスポンスを妨げない(trackServerEventは例外を握りつぶす)。
  //
  // anonymous_session_id: page_viewed/generated/srs_cta_clickedはクライアント側で
  // lv_aid cookie(1年、未認証時から発行済み)付きで送信されるが、この保存イベントは
  // サーバー側発火のためこれまでnull固定になっており、匿名時点の行動(閲覧→生成→CTA)と
  // 認証後のこの保存完了イベントを同じセッションとして繋げられなかった。同一originの
  // fetch()はcookieを自動送信するため、ここでもlv_aidを読み取り同じ列に入れることで、
  // 他のイベントと同じ相関キーで繋げられるようにする(/api/analytics/eventsの
  // 既存クライアント経路と同じ「未信用の相関キーとして100文字に切り詰め」方針)。
  const anonymousSessionId = req.cookies.get("lv_aid")?.value ?? null;
  await trackServerEvent("wordbook_created", analyticsContext, {
    userId: user.id,
    anonymousSessionId,
    source: attributionSource,
    campaign: attributionCampaign,
    properties: { source_type: "custom" },
  });
  await trackServerEvent("vocab_test_maker_saved_to_wordbook", analyticsContext, {
    userId: user.id,
    anonymousSessionId,
    source: attributionSource,
    campaign: attributionCampaign,
    properties: { row_count: rows.length },
  });
  if (!countBeforeErr) {
    await trackWordCountMilestones(user.id, countBefore ?? 0, (countBefore ?? 0) + wordRows.length, analyticsContext);
  }

  return NextResponse.json({ ok: true, wordbook_id: newBook.id, word_count: rows.length });
}
