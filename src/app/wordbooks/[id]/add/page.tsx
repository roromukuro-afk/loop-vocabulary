import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { AddWordForm } from "./AddWordForm";

export const dynamic = "force-dynamic";

export default async function AddWordPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await requireUser();
  const { id } = await params;
  const { data: book } = await supabase
    .from("word_books")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!book) notFound();

  return (
    <AppShell>
      <Link href={`/wordbooks/${book.id}`} className="text-xs text-navy-500">← {book.title}</Link>
      <h1 className="text-xl font-bold text-navy-800 mt-2">単語を追加</h1>

      <Card className="mt-4">
        <CardTitle>新しい単語</CardTitle>
        <AddWordForm wordBookId={book.id} />
      </Card>
    </AppShell>
  );
}
