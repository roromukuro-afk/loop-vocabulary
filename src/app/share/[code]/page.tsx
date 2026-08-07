import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SharedWordbookImport } from "./SharedWordbookImport";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function SharedWordbookPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();

  // このページはadmin client(RLSを経由しない)を使うため、公開条件は
  // share/API側のUI制限に依存せず、必ずこのクエリ自身がDB側で強制する。
  // source_typeもここで直接条件に含めることで、万一DB値が誤ってsharedに
  // なっていても許諾教材をadmin client経由で公開しない(多層防御)。
  const { data: book, error: bookError } = await admin
    .from("word_books")
    .select("id, title, description, level, exam_type")
    .eq("share_code", code)
    .eq("is_shared", true)
    .eq("source_type", "custom")
    .maybeSingle();

  // クエリ自体が失敗した場合(schema/接続障害等)は、存在しないと偽装せず
  // 安全なerror境界へ委譲する(生のDBエラーはユーザーへ表示しない)。
  if (bookError) {
    console.error("share page: word_books query failed", { code: bookError.code });
    throw new Error("共有ページの読み込みに失敗しました");
  }
  // クエリ自体は成功したが対象が存在しない(または非公開・非custom)場合のみ404。
  if (!book) notFound();

  const { count: wordCount, error: countError } = await admin
    .from("words")
    .select("*", { count: "exact", head: true })
    .eq("word_book_id", book.id);
  if (countError) {
    console.error("share page: words count query failed", { code: countError.code });
    throw new Error("共有ページの読み込みに失敗しました");
  }

  const { data: preview, error: previewError } = await admin
    .from("words")
    .select("word, meaning")
    .eq("word_book_id", book.id)
    .limit(10);
  if (previewError) {
    console.error("share page: words preview query failed", { code: previewError.code });
    throw new Error("共有ページの読み込みに失敗しました");
  }

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-10 pb-14 text-white">
        <div className="max-w-lg mx-auto">
          <div className="text-[11px] text-sky-300 font-bold uppercase tracking-widest mb-2">共有された単語帳</div>
          <h1 className="text-2xl font-black leading-tight">{book.title}</h1>
          {book.description && <p className="mt-2 text-sm text-navy-300">{book.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {book.level && <span className="px-2 py-0.5 rounded-full bg-white/10">{book.level}</span>}
            {book.exam_type && <span className="px-2 py-0.5 rounded-full bg-white/10">{book.exam_type}</span>}
            <span className="px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200">{wordCount ?? 0} 語収録</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        {/* インポートボタン */}
        <SharedWordbookImport wordbookId={book.id} wordCount={wordCount ?? 0} />

        {/* プレビュー */}
        <div className="bg-white rounded-2xl border border-navy-100 p-5">
          <p className="text-xs font-bold text-navy-500 mb-3">収録単語のプレビュー（最初の10語）</p>
          <ul className="divide-y divide-navy-100">
            {(preview ?? []).map((w, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-semibold text-navy-800 text-sm">{w.word}</span>
                <span className="text-navy-500 text-sm truncate">{w.meaning}</span>
              </li>
            ))}
          </ul>
          {(wordCount ?? 0) > 10 && (
            <p className="text-xs text-navy-400 mt-3 text-center">… 他 {(wordCount ?? 0) - 10} 語</p>
          )}
        </div>

        <div className="text-center text-sm text-navy-500">
          <Link href="/" className="underline">Loop Vocabulary とは？</Link>
        </div>
      </div>
    </div>
  );
}
