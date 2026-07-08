import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { SUPPORT_EMAIL } from "@/lib/support";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "お問い合わせ | Loop Vocabulary",
  description: "Loop Vocabulary のサポート窓口。ログイン障害・データ削除・著作権・広告に関するお問い合わせはこちら。",
};

export default function ContactPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
        <h1 className="text-2xl font-bold text-navy-800 mt-3">お問い合わせ</h1>
        <p className="text-sm text-navy-600 mt-2">
          下記フォームまたはメール（
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
          ）にてお問い合わせください。通常 2〜3 営業日以内にご返信します。
        </p>

        <Card className="mt-5">
          <CardTitle>お問い合わせフォーム</CardTitle>
          <ContactForm />
        </Card>

        <Card className="mt-4">
          <CardTitle>よくある質問</CardTitle>
          <ul className="space-y-3 text-sm">
            <li>
              <div className="font-semibold text-navy-800">ログイン・認証に関する不具合</div>
              <div className="text-navy-600">ログインできない / パスワードリセットが届かない → 種別「ログイン・認証の不具合」でお問い合わせください。</div>
            </li>
            <li>
              <div className="font-semibold text-navy-800">アカウント削除・データ削除</div>
              <div className="text-navy-600">アプリ内（設定 → アカウント削除）または <Link href="/account/delete" className="underline">/account/delete</Link> からも操作できます。</div>
            </li>
            <li>
              <div className="font-semibold text-navy-800">著作権・権利侵害に関するお問い合わせ</div>
              <div className="text-navy-600">教材名・該当箇所を明記のうえ「著作権に関するお問い合わせ」でご連絡ください。速やかに対応いたします。</div>
            </li>
            <li>
              <div className="font-semibold text-navy-800">塾・学校での法人利用</div>
              <div className="text-navy-600">クラス管理・宿題配信など B2B 機能についてはお気軽にご相談ください。</div>
            </li>
          </ul>
        </Card>

        <Card className="mt-4">
          <CardTitle>その他のリンク</CardTitle>
          <ul className="text-sm text-navy-700 space-y-1.5">
            <li><Link href="/about" className="underline">運営者について</Link></li>
            <li><Link href="/faq" className="underline">よくある質問（FAQ）</Link></li>
            <li><Link href="/privacy" className="underline">プライバシーポリシー</Link></li>
            <li><Link href="/terms" className="underline">利用規約</Link></li>
            <li><Link href="/legal/commercial-transaction" className="underline">特定商取引法に基づく表記</Link></li>
            <li><Link href="/account/delete" className="underline">アカウント削除</Link></li>
            <li><Link href="/premium" className="underline">プレミアムプランの案内</Link></li>
          </ul>
        </Card>

        <p className="text-[11px] text-navy-400 mt-4">
          ※ 重要なお問い合わせは件名に「至急」「削除依頼」等を明記いただくと優先対応いたします。
        </p>
      </div>
    </div>
  );
}
