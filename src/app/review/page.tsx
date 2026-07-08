import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle, Stat } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/lib/supabase/requireUser";
import { srsV2EnabledFor } from "@/lib/srs";
import { resolveScopeLabel } from "@/lib/learning/scopeLabel";
import { ChoiceTestRunner } from "../test/choice/ChoiceTestRunner";
import { FlipCardRunner } from "@/components/review/FlipCardRunner";

export const dynamic = "force-dynamic";

// 復習待ちがこの件数以上たまったら「リカバリーモード」導線を表示する。
const RECOVERY_THRESHOLD = 20;
// リカバリーモードの出題上限として選べる件数（?limit=）。範囲外の値はこの中で丸める。
const RECOVERY_LIMIT_MIN = 1;
const RECOVERY_LIMIT_MAX = 50;

export default async function ReviewPage({
  searchParams,
}: { searchParams: Promise<{ start?: string; mode?: string; book?: string; limit?: string }> }) {
  const { user, supabase } = await requireUser();
  const sp = await searchParams;

  const now = new Date().toISOString();
  let dueQuery = supabase
    .from("words")
    .select("id, word, meaning, phonetic, example, example_ja, streak, is_weak, next_review_at, wrong_count")
    .eq("user_id", user.id)
    .or(`next_review_at.lte.${now},is_weak.eq.true`)
    // 優先順位: 最も期限切れが古い単語を先に。同時刻の場合はwrong_countが多い方を先に。
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .order("wrong_count", { ascending: false })
    .limit(50);
  if (sp.book) dueQuery = (dueQuery as typeof dueQuery).eq("word_book_id", sp.book);
  const { data: due } = await dueQuery;

  const pool = (due ?? []).filter((w) => w.word && w.meaning);
  const mode = sp.mode === "choice" ? "choice" : sp.mode === "recovery" ? "recovery" : "flip";
  const scopeLabel = await resolveScopeLabel(supabase, user.id, sp.book);
  const bookQuery = sp.book ? `&book=${sp.book}` : "";
  const isRecoveryCandidate = pool.length >= RECOVERY_THRESHOLD;

  if (sp.start === "1") {
    if (mode === "recovery" && pool.length >= 1) {
      const rawLimit = Number(sp.limit);
      const recoveryLimit = Number.isFinite(rawLimit)
        ? Math.min(RECOVERY_LIMIT_MAX, Math.max(RECOVERY_LIMIT_MIN, Math.floor(rawLimit)))
        : 10;
      const recoveryPool = pool.slice(0, recoveryLimit);
      const { data: prof } = await supabase
        .from("profiles")
        .select("srs_v2")
        .eq("id", user.id)
        .maybeSingle();
      return (
        <FlipCardRunner
          pool={recoveryPool}
          v2Enabled={srsV2EnabledFor(prof?.srs_v2)}
          scopeLabel={scopeLabel}
          recoveryMode
          recoveryTotalDue={pool.length}
        />
      );
    }
    if (mode === "flip" && pool.length >= 1) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("srs_v2")
        .eq("id", user.id)
        .maybeSingle();
      return <FlipCardRunner pool={pool} v2Enabled={srsV2EnabledFor(prof?.srs_v2)} scopeLabel={scopeLabel} />;
    }
    if (mode === "choice" && pool.length >= 4) {
      return <ChoiceTestRunner pool={pool} mode="en2ja" count={Math.min(10, pool.length)} placement="review" scopeLabel={scopeLabel} />;
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">今日の復習</h1>
      <p className="text-sm text-navy-500 mt-1">
        {pool.length > 0
          ? `${pool.length}語が復習タイミングに来ています。今が覚えどき。`
          : "今日の復習は完了しています。"}
      </p>
      <p className="text-xs text-navy-400 mt-1" data-testid="quiz-scope-label">{scopeLabel}</p>

      {pool.length > 0 && (
        <div className="mt-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs text-sky-700">
          忘却曲線に基づく最適なタイミングです。今やるのが一番定着します。
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="復習待ち" value={pool.length} hint="単語" />
        <Stat label="苦手フラグ" value={pool.filter((w) => w.is_weak).length} hint="単語" />
      </div>

      {/* リカバリーモード導線: 復習待ちが溜まっている時に、少量から再開できる選択肢を出す */}
      {isRecoveryCandidate && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" data-testid="recovery-banner">
          <p className="text-sm font-bold text-amber-800">復習が少し溜まっています</p>
          <p className="text-xs text-amber-700 mt-1">
            一気に全部やらなくても大丈夫です。まずは少しだけ再開しましょう。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/review?start=1&mode=recovery&limit=10${bookQuery}`}>
              <Button fullWidth size="md" data-testid="recovery-10">
                まず10語だけ
              </Button>
            </Link>
            <Link href={`/review?start=1&mode=recovery&limit=20${bookQuery}`}>
              <Button fullWidth size="md" variant="secondary" data-testid="recovery-20">
                20語だけ進める
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* モード選択ボタン（通常復習・従来通り維持） */}
      <div className="mt-5 space-y-3">
        <Link href={`/review?start=1&mode=flip${bookQuery}`}>
          <Button fullWidth size="lg" disabled={pool.length < 1} data-testid="review-normal-flip">
            🃏 {isRecoveryCandidate ? "通常復習する（全" + pool.length + "語）" : "フラッシュカードで自力に思い出す"}
          </Button>
        </Link>
        <Link href={`/review?start=1&mode=choice${bookQuery}`}>
          <Button fullWidth size="lg" variant="secondary" disabled={pool.length < 4}>
            ✏️ 4択で確認（仕上げ用）
          </Button>
        </Link>
        <Link href={`/test/typing${sp.book ? `?book=${sp.book}` : ""}`}>
          <Button fullWidth size="lg" variant="secondary">
            ⌨️ タイピング練習（Premium）
          </Button>
        </Link>
        <Link href="/weak">
          <Button fullWidth size="lg" variant="secondary">
            苦手単語を見る
          </Button>
        </Link>
      </div>

      <Card className="mt-6">
        <CardTitle>復習対象</CardTitle>
        <ul className="divide-y divide-navy-100">
          {pool.slice(0, 20).map((w) => (
            <li key={w.id} className="py-2.5 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy-800">{w.word}</div>
                <div className="text-sm text-navy-600 truncate">{w.meaning}</div>
              </div>
              {w.is_weak && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">苦手</span>}
            </li>
          ))}
          {pool.length === 0 && (
            <li data-testid="review-empty-state" className="py-8 text-center">
              <div className="text-3xl mb-2">✨</div>
              <div className="font-semibold text-navy-700 text-sm">復習待ちの単語はありません</div>
              <div className="text-xs text-navy-400 mt-1 mb-4">
                新しい単語を追加すると、忘却曲線に沿って<br/>ここに復習タイミングが並びます。
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/dictionary" className="text-xs font-bold rounded-lg px-3 py-2 bg-sky-600 text-white hover:bg-sky-700 transition-colors">
                  🔍 辞書で単語を探す
                </Link>
                <Link href="/materials" className="text-xs font-bold rounded-lg px-3 py-2 border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors">
                  📚 教材から追加
                </Link>
              </div>
            </li>
          )}
        </ul>
      </Card>
    </AppShell>
  );
}
