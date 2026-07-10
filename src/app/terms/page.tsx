import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">利用規約</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-07-06</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">1. 適用</h2>
      <p>本規約は Loop Vocabulary (以下「本サービス」) の利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用するものとします。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">2. 利用対象</h2>
      <p>本サービスは原則として 13 歳以上の英語学習者を対象とします。13 歳未満の方は、保護者の同意のもとで利用してください。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">3. 禁止事項</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>第三者の著作物・データを無断で本サービスに登録すること</li>
        <li>本サービスの運営を妨害する行為</li>
        <li>逆コンパイル・改変・自動化アクセス</li>
        <li>他のユーザーに迷惑または不利益を与える行為</li>
        <li>本サービスを通じた違法・公序良俗に反する行為</li>
        <li>その他、運営者が不適切と判断する行為</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">4. 著作権</h2>
      <p>
        本サービスに収録された公開教材データは、許諾を得た上で掲載しています。
        許諾の確認が取れない教材は公開しません。ユーザーが登録した単語・例文等の権利はユーザーに帰属します。
        市販教材の紹介・比較記事における商標・著作権の扱いについては
        <Link href="/legal/content-policy">教材データ・著作権について</Link>もご確認ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5. 広告・課金</h2>
      <p>
        本サービスは無料プランで広告を表示します（Web 版は Google AdSense、Android / iOS
        アプリ版は Google AdMob）。プレミアムプラン（有料、月額 ¥480 または年額 ¥3,800）に
        登録すると広告が非表示になり、AI 解説の利用回数が1日300回まで拡大、CSV 一括インポート等の
        追加機能が利用できます。
      </p>
      <p className="mt-2">
        Web 版のプレミアムプランは <b>Stripe</b> を通じたクレジットカード等の決済により、
        月額または年額で自動更新されるサブスクリプション形式です。解約は
        「設定」ページの Stripe カスタマーポータルからいつでも行え、解約後も
        その時点の請求期間の終了まで全機能をご利用いただけます。日割りでの返金には
        対応しておりません。支払い方法・請求内容の詳細確認・解約も同ポータルから行えます。
      </p>
      <p className="mt-2">
        将来的に Android / iOS アプリ版でもデジタル商品を販売する場合は、
        Android では Google Play Billing、iOS では Apple In-App Purchase を経由して行います
        （現時点では未提供です）。
      </p>
      <p className="mt-2">
        事業者名・支払時期・解約方法等の詳細は{" "}
        <Link href="/legal/commercial-transaction" className="underline">特定商取引法に基づく表記</Link>
        をご確認ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">6. アカウントの削除 (ユーザー側)</h2>
      <p>
        ユーザーはいつでも、自らの意思で本サービスのアカウントを削除できます。
        削除手順は以下のとおりです。
      </p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li><b>アプリ内</b>: 「設定」 → 「アカウント削除」</li>
        <li><b>Web</b>: <Link href="/account/delete" className="underline">/account/delete</Link></li>
        <li><b>メール</b>: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
      </ul>
      <p>
        削除リクエスト受付後、登録した単語帳・学習履歴・AI 利用履歴・チケット等が削除対象となります。
        詳細は <Link href="/privacy" className="underline">プライバシーポリシー</Link> をご参照ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">7. 運営者によるアカウント利用停止</h2>
      <p>
        ユーザーが本規約に違反した場合、または以下に該当する場合、運営者は事前の通知なくアカウントの利用を停止または削除することがあります。
      </p>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>本規約の禁止事項に違反した場合</li>
        <li>長期間 (12 ヶ月以上) ログインがなく、再開の意思が確認できない場合</li>
        <li>本人確認に応じない場合</li>
        <li>その他、本サービスの運営上不適切と判断される場合</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">8. 先生向け機能・学習状況の共有</h2>
      <p>
        本サービスには、塾・家庭教師・学校の先生が生徒の学習状況を確認できる「先生向け機能」があります。
        生徒は招待コードでクラスに参加し、参加時に<b>学習状況の共有へ明示的に同意</b>した場合に限り、
        先生は当該生徒の<b>集計値（学習日数・学習語数・正答率・苦手単語数・復習状況など）のみ</b>を閲覧できます。
        生徒が登録した個々の単語・単語帳の内容など、生の学習データが先生に開示されることはありません。
      </p>
      <p className="mt-2">
        生徒は「設定」からいつでも同意を撤回、またはクラスから退出できます。
        撤回・退出後は、先生のロスターに当該生徒の情報は表示されません。
        13 歳未満の方が参加する場合は、保護者の同意のもとでご利用ください。
      </p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">9. 免責</h2>
      <p>本サービスは現状有姿で提供され、運営者は本サービスの正確性・有用性について保証しません。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">10. 規約の変更</h2>
      <p>運営者は必要に応じて本規約を変更できるものとします。重要な変更は本サービス内で告知します。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">11. お問い合わせ</h2>
      <p>
        本規約に関するお問い合わせは <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> または{" "}
        <Link href="/contact" className="underline">/contact</Link> までご連絡ください。
      </p>
    </div>
  );
}
