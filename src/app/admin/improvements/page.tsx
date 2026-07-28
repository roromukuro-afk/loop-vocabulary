import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/supabase/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImprovementsClient } from "./ImprovementsClient";
import type { IssueRow, TaskRow, MemoryRow, AutonomyLevelRow } from "./types";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

const AUTONOMY_LEVELS: AutonomyLevelRow[] = [
  { category: "analytics", level: 2 },
  { category: "seo", level: 2 },
  { category: "reliability", level: 3 },
  { category: "engineering", level: 3 },
  { category: "content", level: 2 },
  { category: "revenue", level: 2 },
  { category: "acquisition", level: 2 },
  { category: "activation", level: 2 },
  { category: "retention", level: 2 },
  { category: "performance", level: 2 },
  { category: "privacy", level: 0 },
  { category: "legal", level: 0 },
];

export default async function AdminImprovementsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: issueRows }, { data: taskRows }, { data: memoryRows }] = await Promise.all([
    admin
      .from("improvement_issues")
      .select("*")
      .order("priority_score", { ascending: false })
      .limit(200),
    admin
      .from("improvement_tasks")
      .select("*, improvement_issues(title, category)")
      .order("updated_at", { ascending: false })
      .limit(200),
    admin
      .from("improvement_memory")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const issues = (issueRows ?? []) as IssueRow[];
  const tasks = (taskRows ?? []) as unknown as TaskRow[];
  const memory = (memoryRows ?? []) as MemoryRow[];

  return (
    <AppShell>
      <ImprovementsClient issues={issues} tasks={tasks} memory={memory} autonomyLevels={AUTONOMY_LEVELS} />
    </AppShell>
  );
}
