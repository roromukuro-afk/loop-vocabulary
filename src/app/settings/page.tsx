import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { requireUser } from "@/lib/supabase/requireUser";
import { SUPPORT_EMAIL } from "@/lib/support";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";
import { LogoutButton } from "./LogoutButton";
import { PortalButton } from "./PortalButton";
import { ExportButton } from "./ExportButton";
import { ReferralCard } from "./ReferralCard";
import { NotificationToggles } from "./NotificationToggles";
import { SrsModeToggle } from "./SrsModeToggle";
import { MyClasses } from "./MyClasses";
import { DisplayNameForm } from "./DisplayNameForm";
import { ExamCountdown } from "@/components/dashboard/ExamCountdown";

export const metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();

  // 基本プロフィールと通知設定は別クエリに分離する。1回の結合select()だと、
  // notify_weekly_email/notify_push_enabled等どちらかの列がDB上に存在しない
  // だけでクエリ全体が失敗し、アカウント・Premium状態・AI利用量・試験日・
  // SRS設定・先生機能まで巻き込んで表示できなくなってしまうため
  // (Issue #80: plan列は本コード内で未使用のため削除)。
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, is_admin, is_premium, daily_ai_used, daily_ai_reset_at, exam_goal, exam_date, srs_v2, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    // メールアドレス・user ID・SQL文言は出さない。
    console.error("settings: 基本プロフィールの取得に失敗した");
  }
  const profileLoadFailed = !!profileError;

  const { data: notificationSettings, error: notificationError } = await supabase
    .from("profiles")
    .select("notify_weekly_email, notify_push_enabled")
    .eq("id", user.id)
    .maybeSingle();
  if (notificationError) {
    console.error("settings: 通知設定の取得に失敗した");
  }

  const { data: memberships } = await supabase.rpc("get_my_memberships");
  const myClasses = (memberships ?? []) as {
    class_id: string; class_name: string; teacher_name: string; consent: boolean; status: string;
  }[];

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">設定</h1>

      {profileLoadFailed && (
        <p
          role="alert"
          data-testid="settings-basic-profile-alert"
          className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          設定情報の読み込みに失敗しました。時間をおいてもう一度お試しください
        </p>
      )}

      {/* プレミアムバナー（無料ユーザーのみ。取得失敗時は実際のプラン不明のため表示しない） */}
      {!profileLoadFailed && !profile?.is_premium && (
        <div className="mt-4 bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-4 text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-1">Premium</div>
          <div className="font-bold text-base">広告ゼロ・AI解説300回/日</div>
          <div className="text-xs text-navy-300 mt-0.5">月額 ¥480 〜 でアップグレード</div>
          <Link
            href="/premium"
            className="mt-3 inline-block px-4 py-2 rounded-lg bg-white text-navy-800 text-xs font-bold hover:bg-navy-50 transition-colors"
          >
            月額 ¥480〜 プレミアムを見る →
          </Link>
        </div>
      )}

      <Card className="mt-4">
        <CardTitle>アカウント</CardTitle>
        <div className="text-sm text-navy-700 space-y-1">
          <div>メール: <span className="font-mono">{user.email}</span></div>
          <div>表示名: {profileLoadFailed ? "取得できませんでした" : (profile?.display_name ?? "未設定")}</div>
          <DisplayNameForm current={profile?.display_name ?? null} />
          <div className="flex items-center gap-2">
            <span>プラン:</span>
            {profileLoadFailed ? (
              <span className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-600 text-xs">取得できませんでした</span>
            ) : profile?.is_premium ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Premium ✓</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-600 text-xs">Free</span>
            )}
          </div>
          <div>本日の AI 利用: {profileLoadFailed ? "取得できませんでした" : `${profile?.daily_ai_used ?? 0} / ${profile?.is_premium ? "∞" : "5"}`}</div>
          {!profileLoadFailed && profile?.is_admin && <div className="text-navy-800 font-semibold">管理者アカウント</div>}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {!profileLoadFailed && profile?.is_premium && (
            <PortalButton />
          )}
          <LogoutButton />
        </div>
      </Card>

      {/* 学習データエクスポート */}
      <Card className="mt-4">
        <CardTitle>学習データ</CardTitle>
        {profileLoadFailed ? (
          <p className="text-sm text-navy-600">プラン情報を取得できなかったため表示できません。</p>
        ) : profile?.is_premium ? (
          <div className="space-y-2">
            <p className="text-xs text-navy-500">単語・学習履歴を CSV ファイルでダウンロードできます。</p>
            <ExportButton />
          </div>
        ) : (
          <div>
            <p className="text-sm text-navy-600">学習データの CSV エクスポートはプレミアム限定機能です。</p>
            <Link href="/premium" className="mt-2 inline-block text-sm text-sky-600 font-semibold underline">
              プレミアムにアップグレード →
            </Link>
          </div>
        )}
      </Card>

      {/* 学習目標 */}
      <Card className="mt-4">
        <CardTitle>学習目標・試験日</CardTitle>
        <p className="text-xs text-navy-500 mb-1">設定した試験日はダッシュボードにカウントダウン表示されます。</p>
        {profileLoadFailed ? (
          <p className="text-sm text-navy-600">取得できませんでした。</p>
        ) : (
          <ExamCountdown
            examGoal={profile?.exam_goal ?? null}
            examDate={profile?.exam_date ?? null}
          />
        )}
      </Card>

      {/* 通知設定 */}
      <Card className="mt-4">
        <CardTitle>通知設定</CardTitle>
        {notificationError ? (
          <p
            role="alert"
            data-testid="notification-settings-load-alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            通知設定を読み込めませんでした。時間をおいてもう一度お試しください
          </p>
        ) : (
          <NotificationToggles
            weeklyEmail={notificationSettings?.notify_weekly_email ?? false}
            pushEnabled={notificationSettings?.notify_push_enabled ?? false}
          />
        )}
      </Card>

      {/* 学習設定 */}
      <Card className="mt-4">
        <CardTitle>学習設定</CardTitle>
        {profileLoadFailed ? (
          <p className="text-sm text-navy-600">取得できませんでした。</p>
        ) : (
          <SrsModeToggle enabled={profile?.srs_v2 ?? false} />
        )}
      </Card>

      {/* 参加中のクラス（生徒向け・同意管理） */}
      {myClasses.some((m) => m.status === "active") && (
        <Card className="mt-4">
          <CardTitle>参加中のクラス</CardTitle>
          <p className="text-[11px] text-navy-400 mb-1">
            共有を停止すると、先生の一覧からあなたの学習状況が表示されなくなります。
          </p>
          <MyClasses memberships={myClasses} />
        </Card>
      )}

      {/* 先生向け機能 */}
      <Card className="mt-4">
        <CardTitle>先生向け機能</CardTitle>
        <p className="text-sm text-navy-600">
          塾・家庭教師・学校の先生は、クラスを作って生徒の学習状況（集計）を確認できます。
        </p>
        <Link
          href="/teacher"
          className="mt-3 inline-block px-4 py-2 rounded-lg bg-navy-800 text-white text-xs font-bold hover:bg-navy-700 transition-colors"
        >
          {!profileLoadFailed && profile?.role === "teacher" ? "先生ダッシュボードへ" : "先生機能を見る"} →
        </Link>
      </Card>

      {/* 友だち紹介 */}
      <Card className="mt-4">
        <CardTitle>友だち紹介</CardTitle>
        <ReferralCard userId={user.id} />
      </Card>

      <Card className="mt-4">
        <CardTitle>サポート・規約</CardTitle>
        <ul className="text-sm text-navy-700 space-y-2">
          <li><Link href="/premium" className="underline">プレミアムプラン</Link></li>
          <li><Link href="/contact" className="underline">お問い合わせ</Link></li>
          <li><Link href="/privacy" className="underline">プライバシーポリシー</Link></li>
          <li><Link href="/terms" className="underline">利用規約</Link></li>
          {profile?.is_admin && <li><Link href="/admin/materials" className="underline text-navy-800 font-semibold">管理画面へ</Link></li>}
        </ul>
      </Card>

      <Card className="mt-4 border-red-200">
        <CardTitle className="text-red-700">アカウント削除</CardTitle>
        <p className="text-sm text-navy-600 mb-3">
          アカウントを削除すると、登録した単語帳・学習履歴・AI 利用履歴・チケットなど、
          ユーザーに紐づくデータがすべて削除対象となります。
          削除完了までに数営業日かかる場合があります。
        </p>
        {profile?.is_premium && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            ⚠️ アカウント削除はサブスクリプションを自動的には解約しません。
            上の「サブスクリプションを管理」から先に解約してください。
          </p>
        )}
        <DeleteAccountPanel supportEmail={SUPPORT_EMAIL} />
        <p className="text-xs text-navy-500 mt-3">
          Web からも削除リクエストできます: <Link href="/account/delete" className="underline">/account/delete</Link>
        </p>
      </Card>
    </AppShell>
  );
}
