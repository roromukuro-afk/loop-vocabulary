import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-navy-100 bg-white">
      <div className="max-w-5xl mx-auto px-5 py-8 text-xs text-navy-500">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="font-extrabold text-navy-800 text-sm mb-1.5">
              Loop <span className="text-sky-500">Vocabulary</span>
            </div>
            <p className="leading-relaxed">
              英単語を辞書検索・単語帳・忘却曲線復習・小テストで<br className="hidden sm:block" />
              効率よく学習できる英単語学習アプリ
            </p>
            <p className="mt-2">
              公式サイト:{" "}
              <a
                href="https://loop-vocabulary.app"
                className="text-sky-600 hover:underline font-medium"
              >
                https://loop-vocabulary.app
              </a>
            </p>
            <p className="mt-1">
              お問い合わせ:{" "}
              <Link href="/contact" className="text-sky-600 hover:underline font-medium">
                お問い合わせフォーム
              </Link>
            </p>
          </div>

          <div className="flex gap-6 flex-wrap sm:justify-end">
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-navy-700">サービス</span>
              <Link href="/tools" className="hover:text-navy-700">ツール一覧</Link>
              <Link href="/materials" className="hover:text-navy-700">教材・単語帳</Link>
              <Link href="/guide" className="hover:text-navy-700">学習ガイド</Link>
              <Link href="/grammar" className="hover:text-navy-700">英文法レッスン</Link>
              <Link href="/vocab-check" className="hover:text-navy-700">語彙力チェック</Link>
              <Link href="/dictionary" className="hover:text-navy-700">辞書検索</Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-navy-700">運営情報</span>
              <Link href="/about" className="hover:text-navy-700">運営者について</Link>
              <Link href="/press" className="hover:text-navy-700">プレスキット</Link>
              <Link href="/privacy" className="hover:text-navy-700">プライバシーポリシー</Link>
              <Link href="/terms" className="hover:text-navy-700">利用規約</Link>
              <Link href="/legal/commercial-transaction" className="hover:text-navy-700">特定商取引法に基づく表記</Link>
              <Link href="/contact" className="hover:text-navy-700">お問い合わせ</Link>
              <Link href="/premium" className="hover:text-navy-700">プレミアムプラン</Link>
              <Link href="/faq" className="hover:text-navy-700">FAQ</Link>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-navy-100 text-navy-400">
          © 2025–2026 Loop Vocabulary
        </div>
      </div>
    </footer>
  );
}
