import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 prose prose-sm">
      <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-3">利用規約</h1>
      <p className="text-sm text-navy-500">最終更新日: 2026-05-22</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">1. 適用</h2>
      <p>本規約は Loop Vocabulary (以下「本サービス」) の利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用するものとします。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">2. 利用対象</h2>
      <p>本サービスは原則として 13 歳以上の英語学習者を対象とします。13 歳未満の方は、保護者の同意のもとで利用してください。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">3. 禁止事項</h2>
      <ul className="list-disc pl-5 text-sm text-navy-700">
        <li>第三者の著作物・データを無断で本サービスに登録すること</li>
        <li>本サービスの運営を妨害する行為</li>
        <li>逆コンパイル・改変・自動化アクセス</li>
        <li>その他、運営者が不適切と判断する行為</li>
      </ul>

      <h2 className="text-lg font-bold text-navy-800 mt-6">4. 著作権</h2>
      <p>本サービスに収録された公開教材データは、許諾を得た上で掲載しています。許諾の確認が取れない教材は公開しません。ユーザーが登録した単語・例文等の権利はユーザーに帰属します。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">5. 広告・課金</h2>
      <p>本サービスは将来的に広告を表示することがあります。広告非表示プラン (有料) を提供する場合があります。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">6. 免責</h2>
      <p>本サービスは現状有姿で提供され、運営者は本サービスの正確性・有用性について保証しません。</p>

      <h2 className="text-lg font-bold text-navy-800 mt-6">7. 規約の変更</h2>
      <p>運営者は必要に応じて本規約を変更できるものとします。重要な変更は本サービス内で告知します。</p>
    </div>
  );
}
