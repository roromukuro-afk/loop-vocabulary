import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/supabase/requireUser";
import { StudyPlanClient } from "./StudyPlanClient";

export const metadata: Metadata = {
  title: "AIパーソナル学習プラン | Loop Vocabulary",
  description: "試験の種類・目標日・現在のレベルを入力するだけで、AIがあなた専用の英語学習スケジュールを自動生成します。",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function StudyPlanPage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">AIパーソナル学習プラン</h1>
      <p className="text-sm text-navy-500 mt-1">目標の試験と日程を入力するだけで、AIが最適な学習スケジュールを自動生成します</p>
      {isPremium && (
        <div className="mt-1 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
          ✨ プレミアム機能
        </div>
      )}
      <StudyPlanClient isPremium={isPremium} />
    </AppShell>
  );
}
