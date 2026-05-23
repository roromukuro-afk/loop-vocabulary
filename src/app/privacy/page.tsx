import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">プライバシーポリシー</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-05-22</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">1. 取得する情報</h2>
      <p>Loop Vocabulary (以下「本サービス」) は、サービス提供のため以下の情報を取得します。</p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>メールアドレス・認証用パスワードハッシュ (Supabase Auth)</li>
        <li>ユーザーが登録・編集した単語・単語帳・学習履歴</li>
        <li>アクセスログ、デバイス情報、Cookie</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">2. 利用目的</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>本サービスの提供・改善</li>
        <li>不正利用の検知</li>
        <li>広告配信 (将来的に AdMob / 第三者広告配信事業者を利用)</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">3. 広告について</h2>
      <p>本サービスは将来的に AdMob 等の広告配信事業者を利用する場合があります。広告配信事業者は Cookie や広告 ID を利用して、興味関心に基づく広告を表示することがあります。広告 ID のリセット・パーソナライズ広告のオプトアウトは端末設定から行えます。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">4. 第三者提供</h2>
      <p>法令に基づく場合を除き、ユーザーの同意なく第三者に個人情報を提供することはありません。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5. データの削除</h2>
      <p>アカウント削除を希望する場合は、設定ページのお問い合わせ先までご連絡ください。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">6. お問い合わせ</h2>
      <p>本ポリシーに関するお問い合わせは、運営者までご連絡ください。</p>
    </div>
  );
}
