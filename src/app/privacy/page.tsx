import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">プライバシーポリシー</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-05-23</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">1. 取得する情報</h2>
      <p>Loop Vocabulary (以下「本サービス」) は、サービス提供のため以下の情報を取得します。</p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>メールアドレス・認証用パスワードハッシュ (Supabase Auth)</li>
        <li>ユーザーが登録・編集した単語・単語帳・例文等の学習データ</li>
        <li>テスト結果、復習進捗、日次学習集計などの学習履歴</li>
        <li>AI 例文・解説の利用履歴</li>
        <li>アクセスログ、デバイス情報、Cookie</li>
        <li>(Android / iOS アプリ版のみ) 広告 ID (IDFA / Advertising ID)。トラッキング許可時のみ</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">2. 利用目的</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>本サービスの提供・改善</li>
        <li>不正利用の検知</li>
        <li>広告配信 (AdMob 等の広告配信事業者を利用)</li>
        <li>お問い合わせ対応</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">3. 広告について</h2>
      <p>
        本サービスは Android / iOS アプリ版で <b>Google AdMob</b> を利用して広告を配信します。
        Loop Vocabulary では <b>非パーソナライズ広告 (npa: true) を既定</b>としており、
        広告のパーソナライズには広告 ID を利用しません。
        iOS では App Tracking Transparency に従い、トラッキングの可否をユーザーが選択できます。
        広告 ID のリセット・パーソナライズ広告のオプトアウトは端末設定からいつでも変更できます。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">4. 第三者提供</h2>
      <p>法令に基づく場合を除き、ユーザーの同意なく第三者に個人情報を提供することはありません。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5. データ削除・アカウント削除</h2>
      <p>
        ユーザーはいつでも自身のアカウントとそれに紐づくデータの削除を請求できます。
        削除リクエストの方法は以下のとおりです。
      </p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li><b>アプリ内</b>: 「設定」→「アカウント削除」から削除リクエストを送信</li>
        <li><b>Web</b>: <Link href="/account/delete" className="underline">/account/delete</Link> から削除リクエストを送信</li>
        <li><b>メール</b>: ログインができない等の事情がある場合は <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> へ</li>
      </ul>

      <h3 className="text-base font-bold text-navy-800 mt-4">5-1. 削除対象</h3>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>アカウント情報 (メールアドレス、認証情報)</li>
        <li>作成した単語帳および登録単語</li>
        <li>学習履歴 (テスト結果、復習進捗、日次集計)</li>
        <li>AI 利用履歴とリワードチケット</li>
        <li>PDF 出力履歴・小テストテンプレート</li>
        <li>その他、本サービス内でユーザーに紐づくデータ</li>
      </ul>

      <h3 className="text-base font-bold text-navy-800 mt-4">5-2. 完了までの目安</h3>
      <p className="text-sm text-navy-700">
        削除リクエストを受け付けてから、通常 <b>数営業日以内</b> に処理を完了します。
        混雑時は最大 30 日程度かかる場合があります。
      </p>

      <h3 className="text-base font-bold text-navy-800 mt-4">5-3. 削除後も保持する情報</h3>
      <p className="text-sm text-navy-700">
        法令上の保持義務があるアクセスログや不正利用検知用のログは、
        ユーザー画面からは参照できなくなりますが、サーバ側で一定期間 (最大 1 年) 保管されます。
        この期間経過後に完全削除されます。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5-4. 先生向け機能における学習状況の共有</h2>
      <p className="text-sm text-navy-700">
        「先生向け機能」では、生徒が招待コードでクラスに参加し、参加時に
        <b>明示的に同意した場合に限り</b>、担当の先生が当該生徒の
        <b>集計値（学習日数・学習語数・正答率・苦手単語数・復習状況など）のみ</b>を閲覧できます。
        生徒が登録した個々の単語や単語帳の内容などの生データは共有されません。
        この共有は本人同意に基づくものであり、生徒は「設定」からいつでも同意を撤回・退出でき、
        撤回後は先生の一覧に表示されません。13 歳未満の方は保護者の同意のもとでご利用ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">6. 13 歳以上の利用</h2>
      <p>
        本サービスは原則として 13 歳以上の英語学習者を対象としています。
        13 歳未満の方は、保護者の同意のもとでご利用ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">7. お問い合わせ</h2>
      <p>
        本ポリシーに関するお問い合わせは <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> または{" "}
        <Link href="/contact" className="underline">/contact</Link> までご連絡ください。
      </p>
    </div>
  );
}
