import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white">
      <header className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="font-bold text-navy-800 text-lg">Loop Vocabulary</div>
        <div className="flex gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">ログイン</Button></Link>
          <Link href="/signup"><Button size="sm">無料で始める</Button></Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-10 pb-16 text-center">
        <p className="text-navy-500 text-sm font-semibold mb-3">
          調べた英語を、覚える英語へ。覚えた英語を、使える英語へ。
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-navy-900 leading-tight">
          英単語学習を、<br className="sm:hidden" />まるごと1つに。
        </h1>
        <p className="mt-5 text-navy-600 text-base sm:text-lg max-w-2xl mx-auto">
          検索・登録・分類・忘却曲線復習・4択テスト・入力テスト・AI解説・小テストPDF出力を
          1アプリで完結。中高生・大学受験生・英検/TOEIC学習者・先生まで使える総合英単語学習アプリ。
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup"><Button size="lg">無料で単語帳を作る</Button></Link>
          <Link href="/dictionary"><Button size="lg" variant="secondary">まず辞書を試す</Button></Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl border border-navy-100 p-5 shadow-card">
            <div className="text-navy-400 text-xs font-semibold">{f.tag}</div>
            <div className="mt-1 text-lg font-bold text-navy-800">{f.title}</div>
            <div className="mt-2 text-sm text-navy-600 leading-relaxed">{f.body}</div>
          </div>
        ))}
      </section>

      <section className="max-w-5xl mx-auto px-5 py-10">
        <h2 className="text-xl font-bold text-navy-800 mb-4">こんな人におすすめ</h2>
        <ul className="grid sm:grid-cols-2 gap-3 text-sm text-navy-700">
          {AUDIENCE.map((a) => (
            <li key={a} className="bg-white border border-navy-100 rounded-xl px-4 py-3">{a}</li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-navy-100 mt-10">
        <div className="max-w-5xl mx-auto px-5 py-6 text-xs text-navy-500 flex flex-wrap gap-4 justify-between">
          <div>© Loop Vocabulary</div>
          <div className="flex gap-4">
            <Link href="/privacy">プライバシーポリシー</Link>
            <Link href="/terms">利用規約</Link>
            <Link href="/premium">広告非表示プラン</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  { tag: "辞書", title: "調べてそのまま単語帳へ", body: "検索結果からワンタップで自分の単語帳に追加。調べる→覚える、までが一本道。" },
  { tag: "復習", title: "忘却曲線で自動復習", body: "1→3→7→14→30日。覚えた単語と覚えていない単語を自動で分けて回します。" },
  { tag: "テスト", title: "爆速4択 & 入力テスト", body: "テンポよく回せる4択と、スペルを書く入力テスト。苦手だけ・未学習だけにも絞れる。" },
  { tag: "分類", title: "レベル・試験別に整理", body: "中学/高校/大学受験/英検5級〜準1級/TOEIC3段階/参考書別/自作/苦手まで対応。" },
  { tag: "AI", title: "AI例文・解説", body: "中学向け〜TOEIC向けまでレベル別の例文・覚え方・ニュアンスをAIが解説 (後日接続)。" },
  { tag: "PDF", title: "小テストPDFを自動生成", body: "選んだ単語帳から英→日・日→英・4択・記述を選んで印刷用PDFに。塾・学校でそのまま使える。" },
];

const AUDIENCE = [
  "中学生 / 高校生 / 大学受験生",
  "英検・TOEIC 学習者",
  "英語を学び直したい社会人",
  "塾講師・学校の先生",
  "自分だけの単語帳を作りたい人",
  "参考書をデジタル化して効率化したい人",
];
