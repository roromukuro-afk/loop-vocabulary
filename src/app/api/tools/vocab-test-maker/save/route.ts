import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackServerEvent, trackWordCountMilestones } from "@/lib/analytics/trackServerEvent";
import { sanitizeRows } from "@/lib/vocabTest/parsePastedWords";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawWords = body && typeof body === "object" ? (body as Record<string, unknown>).words : null;
  const rows = sanitizeRows(rawWords);
  if (rows.length === 0) {
    return NextResponse.json({ error: "no_valid_words" }, { status: 400 });
  }

  // 単語帳のタイトルはユーザーの自由記述を含めない(自動生成の固定文言のみ)。
  // ANALYTICS_PRIVACY_POLICY.mdの方針(自由記述はanalyticsへ送らない)とは別に、
  // タイトル自体もここでは常に定型文にすることで、貼り付け内容がDBのtitle列経由で
  // 別画面(単語帳一覧等)に平文表示される範囲を狭める意図。
  const title = `貼り付けた単語(${rows.length}語)`;

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
  const { count: countBefore } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

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
  await trackServerEvent("wordbook_created", { userId: user.id, anonymousSessionId, properties: { source_type: "custom" } });
  await trackServerEvent("vocab_test_maker_saved_to_wordbook", { userId: user.id, anonymousSessionId, properties: { row_count: rows.length } });
  await trackWordCountMilestones(user.id, countBefore ?? 0, (countBefore ?? 0) + wordRows.length);

  return NextResponse.json({ ok: true, wordbook_id: newBook.id, word_count: rows.length });
}
