import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { AiPanel } from "./AiPanel";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function AiPage({ searchParams }: { searchParams: Promise<{ word?: string; meaning?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">AI例文・解説</h1>
      <p className="text-sm text-navy-500 mt-1">
        中学〜TOEICまでのレベル別例文、ニュアンス・語源・覚え方をAIが生成 (現在はモック)。
      </p>
      <Card className="mt-4">
        <CardTitle>単語を選んで生成</CardTitle>
        <AiPanel initialWord={sp.word ?? ""} initialMeaning={sp.meaning ?? ""} />
      </Card>
      <p className="text-[11px] text-navy-400 mt-3">
        無料ユーザーは 1 日 5 回まで。超過後は「リワード広告を見て + 1 回」または有料プランで利用できます。
      </p>
    </AppShell>
  );
}
