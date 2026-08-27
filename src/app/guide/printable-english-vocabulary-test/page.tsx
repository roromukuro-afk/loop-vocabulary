import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { GuideTracker } from "@/components/guide/GuideTracker";

const SITE_URL = "https://loop-vocabulary.app";
const SLUG = "printable-english-vocabulary-test";

export const metadata: Metadata = {
  title: "印刷できる英単語テストPDFを作る方法【A4・段組み対応】 | Loop Vocabulary",
  description:
    "英単語テストの作り方から、A4用紙にきれいに印刷できる設定までを解説。単語帳の準備・出題形式の選び方・段組み・解答欄の配置・印刷設定のポイントを紹介します。",
  openGraph: {
    title: "印刷できる英単語テストPDFを作る方法【A4・段組み対応】",
    description: "小テストの作り方から、A4用紙にきれいに印刷できるPDFの作り方・印刷設定のポイントまで解説。",
    url: `${SITE_URL}/guide/${SLUG}`,
    type: "article",
  },
  alternates: { canonical: `${SITE_URL}/guide/${SLUG}` },
};

const FAQ_ITEMS = [
  {
    q: "印刷するにはどうすればいいですか？",
    a: "小テストを作成すると印刷用のウィンドウが自動で開きます。ブラウザの印刷機能（Ctrl+P または Cmd+P）から「PDFとして保存」を選べばPDF化でき、そのままプリンターで印刷することもできます。",
  },
  {
    q: "紙を節約するために1枚に多く印刷できますか？",
    a: "はい。段組みを2段組みにすると、同じ問題数でも用紙の枚数を減らせます。出題数が多い場合や配布部数が多い場合に便利です。",
  },
  {
    q: "解答用紙を別に印刷できますか？",
    a: "解答の配置で「別紙」を選ぶと、問題用紙の後に改ページされた解答用紙が続けて出力されます。授業中に配って回収するテストでは別紙、宿題では同ページ末尾に解答をつける、といった使い分けができます。",
  },
  {
    q: "スマホやタブレットからでも印刷できますか？",
    a: "ブラウザに印刷機能があれば可能ですが、A4のレイアウト調整のしやすさから、パソコンからの利用を推奨しています。",
  },
  {
    // Codexレビュー指摘対応と同種の是正(Issue #127): 単語帳からの小テスト作成・保存は
    // /pdf（小テスト作成画面）の機能で、実装(requireUser)上ログインが必須。「無料」は
    // 事実だが「登録不要」ではないため、両方を切り分けて明記する。
    q: "無料で使えますか？",
    a: "はい。無料登録すれば、1日3回まで無料で小テストを作成できます。単語帳の作成・保存もすべて無料です。貼り付けた単語からログインなしですぐ試したいだけの場合は、登録不要の英単語テスト作成ツールも使えます（そちらには苦手単語・未学習での絞り込みはありません）。",
  },
  {
    q: "単語帳がなくても使えますか？",
    a: "単語帳（出題する単語のリスト）を作るには無料登録が必要です。自分で単語を入力して作るほか、当サービスが公開している教材データをインポートして使うこともできます。単語帳を作らずその場でテストを作りたいだけの場合は、登録不要の英単語テスト作成ツールで単語を貼り付けて作成できます。",
  },
  {
    q: "出題形式は選べますか？",
    a: "はい。記述式（英→日・日→英）と4択式のどちらかを選べます。同じ単語帳から両方の形式でテストを作ることもできます。",
  },
  {
    q: "作った小テストは保存できますか？",
    a: "小テストの元になる単語帳は保存されます。同じ単語帳から、出題範囲や形式を変えて何度でも新しい小テストを作成できます。",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "印刷できる英単語テストPDFを作る方法【A4・段組み対応】",
  description: "小テストの作り方から、A4用紙にきれいに印刷できるPDFの作り方・印刷設定のポイントまで解説。",
  author: { "@type": "Organization", name: "Loop Vocabulary" },
  publisher: { "@type": "Organization", name: "Loop Vocabulary" },
  datePublished: "2026-07-13",
  dateModified: "2026-08-26",
  url: `${SITE_URL}/guide/${SLUG}`,
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "学習ガイド", item: `${SITE_URL}/guide` },
    { "@type": "ListItem", position: 3, name: "印刷できる英単語テストPDFを作る方法", item: `${SITE_URL}/guide/${SLUG}` },
  ],
};

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PrintableEnglishVocabularyTestPage() {
  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }, { label: "学習ガイド", href: "/guide" }, { label: "印刷できる英単語テストPDFを作る方法" }]} />
      </div>

      <GuideTracker slug={SLUG} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />

      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-12 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Link href="/guide" className="text-xs text-navy-400 hover:text-white transition-colors block mb-4">← ガイド一覧</Link>
          <div className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-semibold mb-3">教員・塾講師向け</div>
          <h1 className="text-2xl font-black leading-tight">印刷できる英単語テストPDFを<br />作る方法</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-sm mx-auto">小テストの作り方から、A4用紙にきれいに収まる段組み・解答欄つきの印刷設定まで。</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-5">
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <p className="text-base font-semibold text-navy-800 leading-relaxed">
            結論: 単語帳（出題したい単語のリスト）を用意して出題方向・形式・出題数・解答の配置を選べば、その場で小テストが作成でき、段組みや解答欄をA4用紙に合わせて選ぶだけで、そのまま印刷できるレイアウトのPDFとして保存できます。Word・Excelで表を作る手間がかかりません。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">手作業での小テスト作成にかかる時間</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            WordやExcelで小テストを手作業で作ると、単語の選定・表の整形・答え合わせ用の解答欄の配置など、1回あたり数十分かかることが珍しくありません。とくに苦手な単語だけを絞り込みたい場合や、出題方向（英→日／日→英）を変えて2種類作りたい場合、作業はさらに増えます。オンラインの小テスト作成ツールを使うと、これらの設定をその場で切り替えて、印刷用のレイアウトまで自動で組んでくれます。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">使い方の流れ</h2>
          <ol className="text-sm text-navy-700 leading-relaxed space-y-2 list-decimal pl-5">
            <li>単語帳を用意する（自作、または公開教材からインポート）。単語帳の作成・保存には無料登録が必要です</li>
            <li>無料登録した上で<Link href="/pdf" className="underline font-semibold">小テスト作成画面</Link>を開き、出題範囲（単語帳全体・苦手単語のみ・未学習のみ）を選ぶ</li>
            <li>出題方向（英→日／日→英）・出題形式（記述／4択）・出題数・段組みを選ぶ</li>
            <li>解答の配置（なし／同ページ末尾／別紙）を選ぶ</li>
            <li>印刷用ウィンドウが開くので、ブラウザの印刷機能でPDF保存・印刷する</li>
          </ol>
          <p className="text-xs text-navy-500 mt-3">
            単語帳を作らず、貼り付けた単語からログインなしですぐテストを作りたい場合は、
            <Link href="/tools/vocab-test-maker" className="underline font-semibold">登録不要の英単語テスト作成ツール</Link>
            も使えます（苦手単語・未学習での絞り込みは、単語帳を使う小テスト作成画面のみの機能です）。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">Word・Excel手作業との違い</h2>
          <table className="w-full text-sm text-navy-700 border-collapse">
            <thead>
              <tr className="border-b border-navy-100">
                <th className="text-left py-2 font-bold text-navy-800">項目</th>
                <th className="text-left py-2 font-bold text-navy-800">手作業（Word/Excel）</th>
                <th className="text-left py-2 font-bold text-navy-800">オンラインツール</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy-50">
                <td className="py-2">作成時間</td>
                <td className="py-2">数十分〜</td>
                <td className="py-2">数十秒〜</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">苦手単語の絞り込み</td>
                <td className="py-2">手動で選別</td>
                <td className="py-2">学習履歴から自動抽出</td>
              </tr>
              <tr className="border-b border-navy-50">
                <td className="py-2">出題方向の切り替え</td>
                <td className="py-2">作り直しが必要</td>
                <td className="py-2">選択肢を変えるだけ</td>
              </tr>
              <tr>
                <td className="py-2">解答用紙の分離</td>
                <td className="py-2">レイアウトを別途調整</td>
                <td className="py-2">設定を選ぶだけ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">印刷を前提にしたレイアウト設計</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            画面で見るだけの単語リストと、実際に配布して使う印刷物では必要なレイアウトが異なります。行間が詰まりすぎていると生徒が答えを書き込みにくく、逆に余白が多すぎると紙の枚数が増えてしまいます。小テスト作成ツールでは、A4用紙(size: A4, margin: 16mm 15mm)を前提に、解答欄の幅・行の高さがあらかじめ調整されているため、追加のレイアウト作業なしでそのまま印刷に使えます。
          </p>
        </div>

        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-5">
          <h2 className="font-black text-navy-800 mb-3">印刷設定のポイント</h2>
          <div className="space-y-3">
            {[
              { icon: "📄", title: "段組みの選択", desc: "1段組みは1問あたりの余白が広く見やすい構成、2段組みは同じ問題数でも紙の枚数を抑えられる構成です。配布部数が多い場合は2段組みがおすすめです。" },
              { icon: "✏️", title: "解答欄の配置", desc: "記述式では解答欄の下線を、4択式では選択肢を自動でレイアウトします。授業中に配って回収するテストは「別紙」、持ち帰る宿題は「同ページ末尾」が扱いやすい設定です。" },
              { icon: "🖨️", title: "ブラウザの印刷設定", desc: "印刷ダイアログで「用紙サイズ: A4」「余白: デフォルト」を選ぶと、想定通りのレイアウトで印刷されます。倍率は「実際のサイズ」のままにしてください。" },
            ].map((s) => (
              <div key={s.title} className="flex gap-3">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="font-bold text-navy-800 text-sm">{s.title}</div>
                  <p className="text-xs text-navy-600 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <h2 className="font-black text-navy-800 text-lg mb-3">PDFの隅に入るQRコードについて</h2>
          <p className="text-sm text-navy-700 leading-relaxed">
            出力されるPDFの紙面の隅には、小さなQRコードと「作成：Loop Vocabulary」の表記が入ります。問題文や解答欄を邪魔しないサイズ・位置にしており、個人情報は一切含まれていません。読み取ると、登録不要で使える語彙力チェックページに遷移するだけの仕組みです。
          </p>
        </div>

        <div className="bg-navy-50 rounded-2xl p-4">
          <div className="text-sm font-bold text-navy-700 mb-2">注意点</div>
          <ul className="text-xs text-navy-600 space-y-1 list-disc pl-4">
            <li>市販の単語帳・問題集の単語リストをそのまま転載・配布することは想定していません。自作の単語リスト、または当サービスが許諾を得て公開している教材を単語帳にインポートしてご利用ください。</li>
            <li>特定の塾・学校で使われていることを示すものではありません。</li>
            <li>ブラウザやプリンターの設定によっては、余白の見え方が多少異なる場合があります。</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="text-sm font-bold text-navy-800 mb-2">よくある質問</div>
          <div className="space-y-2">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="border border-navy-100 rounded-xl px-4 py-3">
                <div className="font-bold text-navy-800 text-sm">Q. {f.q}</div>
                <div className="mt-1 text-xs text-navy-600 leading-relaxed">A. {f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
          <div className="font-black text-lg mb-1">印刷できる小テストPDFを作る</div>
          <p className="text-sm text-navy-300 mb-4">単語帳を作って、1日3回まで無料で小テストを作成できます。</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors">無料で始める →</Link>
            <Link href="/vocab-check" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">語彙力チェック（無料）</Link>
            <Link href="/tools/vocab-test-maker" className="px-5 py-2.5 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors">印刷用の英単語テストを作る</Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-navy-700 mb-3">関連ページ</div>
          <div className="space-y-2">
            <Link href="/guide/juku-vocabulary-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">塾・家庭教師</div>
              <div className="text-sm font-semibold text-navy-800">塾・家庭教師向け英単語小テストの作り方</div>
            </Link>
            <Link href="/guide/high-school-english-vocabulary-test" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">高校英語</div>
              <div className="text-sm font-semibold text-navy-800">高校英語の単語テストを効率よく作る方法</div>
            </Link>
            <Link href="/guide/vocabulary-quiz-pdf-for-teachers" className="block bg-white rounded-xl border border-navy-100 p-3 hover:shadow-sm transition-shadow">
              <div className="text-[11px] text-sky-600 font-semibold mb-0.5">教員向け</div>
              <div className="text-sm font-semibold text-navy-800">英単語 小テスト 作成ツール【印刷できるPDF・塾/学校/家庭教師向け】</div>
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-navy-500 underline">← トップページ</Link>
        </div>
      </div>
    </div>
  );
}
