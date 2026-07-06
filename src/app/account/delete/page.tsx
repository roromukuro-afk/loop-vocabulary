import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { SUPPORT_EMAIL } from "@/lib/support";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";

export const dynamic = "force-dynamic";

// ============================================================
// /account/delete
// ------------------------------------------------------------
// アプリを削除してしまったユーザー / 設定からたどり着けないユーザーが
// Web からアカウント削除を開始できる専用ページ。
// Google Play / App Store のストア審査で「Web から削除できる導線」
// を示す URL としても使う。
// ============================================================

export default async function AccountDeletePage() {
  let isLoggedIn = false;
  let email: string | null = null;

  if (getSupabaseEnv().ok) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isLoggedIn = !!data?.user;
    email = data?.user?.email ?? null;
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
        <h1 className="text-2xl font-bold text-navy-800 mt-3">アカウント削除</h1>
        <p className="text-sm text-navy-600 mt-2">
          Loop Vocabulary は、ユーザーの希望に応じて、登録済みのアカウントと関連データを削除します。
          このページはアプリをアンインストール済みの方や、設定画面からたどり着けない方が、
          Web から削除を開始するための専用ページです。
        </p>

        <Card className="mt-5">
          <CardTitle>削除リクエスト</CardTitle>
          {isLoggedIn ? (
            <>
              <p className="text-sm text-navy-600 mb-3">
                ログイン中のアカウント:{" "}
                <span className="font-mono text-navy-800">{email}</span>
              </p>
              <DeleteAccountPanel supportEmail={SUPPORT_EMAIL} />
            </>
          ) : (
            <div className="space-y-3 text-sm text-navy-700">
              <p>
                削除リクエストにはログインが必要です。下のリンクからログインしてから、
                再度このページに戻って削除を開始してください。
              </p>
              <p>
                アプリを既にアンインストール済みの場合でも、登録時のメールアドレス・パスワードでログインできます。
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent("/account/delete")}`}
                  className="inline-block px-4 py-2 rounded-xl bg-navy-700 text-white font-semibold"
                >
                  ログインへ
                </Link>
                <Link
                  href={`/signup`}
                  className="inline-block px-4 py-2 rounded-xl border border-navy-200 text-navy-700"
                >
                  新規登録
                </Link>
              </div>
              <p className="text-xs text-navy-500 mt-2">
                ログイン情報を失った場合は、登録メールアドレスから{" "}
                <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
                までお問い合わせください。本人確認のうえ削除手続きを進めます。
              </p>
            </div>
          )}
        </Card>

        <Card className="mt-4 border-amber-200">
          <CardTitle className="text-amber-800">プレミアムプランご利用中の方へ</CardTitle>
          <p className="text-sm text-navy-700">
            アカウント削除は Stripe のサブスクリプションを自動的には解約しません。
            削除前に「設定」ページまたは Stripe カスタマーポータルからサブスクリプションを
            解約してください。解約せずに削除すると、削除後も課金が継続するおそれがあります。
          </p>
        </Card>

        <Card className="mt-4">
          <CardTitle>削除されるデータ</CardTitle>
          <ul className="text-sm text-navy-700 list-disc pl-5 space-y-1">
            <li>アカウント情報 (メールアドレス、認証情報)</li>
            <li>作成した単語帳および登録単語</li>
            <li>学習履歴 (テスト結果、復習進捗、日次集計)</li>
            <li>AI 利用履歴とリワードチケット</li>
            <li>PDF 出力履歴・小テストテンプレート</li>
            <li>その他、本サービス内でユーザーに紐づくデータ</li>
          </ul>
        </Card>

        <Card className="mt-4">
          <CardTitle>その他</CardTitle>
          <ul className="text-sm text-navy-700 space-y-1.5">
            <li>処理完了までに数営業日かかる場合があります</li>
            <li>法令上保持が必要なログは別途一定期間サーバ側で保管されますが、ユーザー画面からは参照できなくなります</li>
            <li>本人確認や処理状況のお問い合わせ: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
            <li>その他: <Link href="/privacy" className="underline">プライバシーポリシー</Link> / <Link href="/terms" className="underline">利用規約</Link> / <Link href="/contact" className="underline">お問い合わせ</Link></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
