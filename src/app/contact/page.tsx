import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { SUPPORT_EMAIL } from "@/lib/support";

// ============================================================
// /contact
// ------------------------------------------------------------
// Apple App Store / Google Play のサポート URL として登録する想定。
// 専用のサポートメールがまだ無いため、SUPPORT_EMAIL は環境変数 or
// プレースホルダ。本番リリース前に必ず実メールへ置換すること。
// ============================================================

export const metadata = {
  title: "お問い合わせ | Loop Vocabulary",
  description: "Loop Vocabulary のサポート窓口。ログイン障害・データ削除・著作権・広告に関するお問い合わせはこちら。",
};

const TOPICS: { label: string; body: string }[] = [
  {
    label: "ログイン・認証に関する不具合",
    body: "ログインできない / パスワードリセットができない / メール認証リンクが届かない、など。",
  },
  {
    label: "アカウント削除・データ削除リクエスト",
    body: "アプリ内 (設定 → アカウント削除) または /account/delete からも開始できます。Web ログインができない場合のみメールでお問い合わせください。",
  },
  {
    label: "学習データ・教材データの不具合",
    body: "テスト結果が反映されない / 復習対象が変わらない / 教材の単語が正しくない、など。",
  },
  {
    label: "教材・参考書の著作権に関するお問い合わせ",
    body: "公開教材で権利侵害があると思われる場合、当該教材名・該当箇所を明記のうえご連絡ください。許諾を確認のうえ速やかに非公開化等の対応を行います。",
  },
  {
    label: "広告に関するお問い合わせ",
    body: "不適切な広告が表示された / 学習を妨げる広告がある、などの場合は表示画面のスクリーンショットを添付いただけると助かります。",
  },
  {
    label: "バグ報告 / 機能リクエスト",
    body: "再現手順・端末 (Android / iOS / OS バージョン)・スクリーンショットがあると調査が早くなります。",
  },
  {
    label: "塾・学校でのご利用に関するお問い合わせ",
    body: "クラス管理や宿題配信などの B2B 機能について、ご希望の運用方法をお知らせください。",
  },
];

export default function ContactPage() {
  const subject = encodeURIComponent("【Loop Vocabulary】お問い合わせ");
  const body = encodeURIComponent(
    [
      "▼ お問い合わせ種別:",
      "(ログイン障害 / データ削除 / 学習データ / 著作権 / 広告 / バグ / その他)",
      "",
      "▼ 内容:",
      "",
      "",
      "▼ 端末・環境 (任意):",
      "OS: ",
      "ブラウザまたはアプリ: ",
      "",
      "▼ 登録メールアドレス (本人確認用、任意):",
      "",
    ].join("\n"),
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
        <h1 className="text-2xl font-bold text-navy-800 mt-3">お問い合わせ</h1>
        <p className="text-sm text-navy-600 mt-2">
          Loop Vocabulary のサポート窓口です。下記のメールアドレスまで、お問い合わせ内容を明記してご連絡ください。
        </p>

        <Card className="mt-5">
          <CardTitle>サポートメール</CardTitle>
          <p className="text-sm text-navy-700">
            <a className="text-lg font-mono font-semibold text-navy-800 underline" href={mailto}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-xs text-navy-500 mt-2">
            上記アドレスをクリックすると、メールアプリで件名・テンプレートが自動入力されます。
          </p>
        </Card>

        <Card className="mt-4">
          <CardTitle>お問い合わせ内容の例</CardTitle>
          <ul className="space-y-3 text-sm">
            {TOPICS.map((t) => (
              <li key={t.label}>
                <div className="font-semibold text-navy-800">{t.label}</div>
                <div className="text-navy-600">{t.body}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4">
          <CardTitle>その他のリンク</CardTitle>
          <ul className="text-sm text-navy-700 space-y-1.5">
            <li><Link href="/privacy" className="underline">プライバシーポリシー</Link></li>
            <li><Link href="/terms" className="underline">利用規約</Link></li>
            <li><Link href="/account/delete" className="underline">アカウント削除</Link></li>
            <li><Link href="/premium" className="underline">広告非表示プラン案内</Link></li>
          </ul>
        </Card>

        <p className="text-[11px] text-navy-400 mt-4">
          ※ お問い合わせの内容によっては回答に数営業日かかる場合があります。
          重要なお問い合わせは件名に【至急】【削除依頼】等を明記いただくと優先して対応いたします。
        </p>
      </div>
    </div>
  );
}
