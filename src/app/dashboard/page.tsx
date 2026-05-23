import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BannerAdPlaceholder, NativeAdCard } from "@/components/ads/AdComponents";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const today = new Date().toISOString().slice(0, 10);
  const [{ count: wordCount }, { count: dueCount }, { data: todayStats }] = await Promise.all([
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("words")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString()),
    supabase.from("daily_stats").select("*").eq("user_id", user.id).eq("day", today).maybeSingle(),
  ]);

  const studied = todayStats?.studied_count ?? 0;
  const correct = todayStats?.correct_count ?? 0;
  const wrong   = todayStats?.wrong_count ?? 0;
  const acc     = studied > 0 ? Math.round((correct / (correct + wrong || 1)) * 100) : 0;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">こんにちは{user.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
      <p className="text-sm text-navy-500 mt-1">今日も少しずつ進めよう。</p>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="今日学習" value={studied} hint="単語" />
        <Stat label="正答率" value={`${acc}%`} hint="今日" />
        <Stat label="復習待ち" value={dueCount ?? 0} hint="単語" />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/review"><Button fullWidth size="lg">今日の復習を始める</Button></Link>
        <Link href="/test/choice"><Button fullWidth size="lg" variant="secondary">4択テスト</Button></Link>
        <Link href="/test/input"><Button fullWidth size="md" variant="secondary">入力テスト</Button></Link>
        <Link href="/dictionary"><Button fullWidth size="md" variant="secondary">辞書で調べる</Button></Link>
      </section>

      <Card className="mt-6">
        <CardTitle>あなたの単語帳</CardTitle>
        <div className="flex items-center justify-between">
          <div className="text-sm text-navy-600">登録単語: <b>{wordCount ?? 0}</b> 語</div>
          <Link href="/wordbooks"><Button size="sm" variant="secondary">単語帳を見る</Button></Link>
        </div>
      </Card>

      <div className="mt-6">
        <NativeAdCard />
      </div>

      <section className="mt-6 grid sm:grid-cols-2 gap-3">
        <Link href="/materials" className="block">
          <Card><CardTitle>教材・参考書</CardTitle>
            <p className="text-sm text-navy-600">レベル別・試験別・参考書別に整理された単語を探す。</p>
          </Card>
        </Link>
        <Link href="/weak" className="block">
          <Card><CardTitle>苦手単語</CardTitle>
            <p className="text-sm text-navy-600">不正解の多い単語だけを集中的に復習。</p>
          </Card>
        </Link>
        <Link href="/stats" className="block">
          <Card><CardTitle>学習記録</CardTitle>
            <p className="text-sm text-navy-600">連続学習日数・カレンダー・教材別の進捗。</p>
          </Card>
        </Link>
        <Link href="/pdf" className="block">
          <Card><CardTitle>小テストPDF出力</CardTitle>
            <p className="text-sm text-navy-600">単語帳から英→日・日→英・4択・記述の小テストを作成。</p>
          </Card>
        </Link>
      </section>

      <div className="mt-6">
        <BannerAdPlaceholder />
      </div>
    </AppShell>
  );
}
