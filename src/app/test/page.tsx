import Link from "next/link";
import { requireUser } from "@/lib/supabase/requireUser";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const MODES = [
  {
    href: "/test/choice",
    icon: "🎯",
    title: "4択テスト (英→日)",
    desc: "英単語を見て日本語の意味を4択から選ぶ。最もポピュラーなモード。",
    premium: false,
  },
  {
    href: "/test/choice?mode=ja2en",
    icon: "🔄",
    title: "4択テスト (日→英)",
    desc: "日本語の意味を見て英単語を4択から選ぶ。スペルの識別力も鍛えられる。",
    premium: false,
  },
  {
    href: "/test/input",
    icon: "✏️",
    title: "入力テスト",
    desc: "日本語の意味を見て英単語をスペルまで入力する。記述対策・入試対策に最適。",
    premium: false,
  },
  {
    href: "/test/typing",
    icon: "⌨️",
    title: "タイピング練習",
    desc: "意味を見て英単語をリアルタイムでタイプ。文字ごとに正誤が色で表示され、速度と正確性を同時に鍛えられる。",
    premium: true,
  },
  {
    href: "/test/listening",
    icon: "🎧",
    title: "リスニングテスト",
    desc: "英単語の音声を聞いてスペルを入力するリスニング練習。リスニング力とスペリング力を同時に強化。",
    premium: true,
  },
  {
    href: "/test/attack",
    icon: "⚡",
    title: "60秒タイムアタック",
    desc: "60秒以内に何問正解できるか！コンボを繋いで高スコアを目指せ。SNSシェアで友達と競い合おう。",
    premium: false,
  },
];

export default async function TestPage() {
  const { user, supabase } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  return (
    <AppShell>
      <h1 className="text-xl font-bold text-navy-800">テストモード</h1>
      <p className="text-sm text-navy-500 mt-1">学習スタイルに合わせてモードを選んでください。</p>

      <div className="mt-5 space-y-3">
        {MODES.map((m) => {
          const locked = m.premium && !isPremium;
          return (
            <Link key={m.href} href={locked ? "/premium" : m.href} className="block">
              <Card
                className={`hover:shadow-md transition-shadow ${
                  locked ? "border-amber-200 bg-amber-50/30" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl shrink-0 mt-0.5">{m.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base leading-tight">{m.title}</CardTitle>
                      {m.premium && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                            isPremium
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isPremium ? "Premium ✓" : "Premium"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-navy-500 mt-1 leading-relaxed">{m.desc}</p>
                  </div>
                  <div className="text-navy-300 text-lg shrink-0 self-center">›</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {!isPremium && (
        <Link href="/premium" className="block mt-5">
          <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-4 text-white text-center">
            <div className="font-black">タイピング練習・リスニングテストを解放する</div>
            <div className="text-xs text-navy-300 mt-1">月額 ¥480〜 でプレミアムにアップグレード →</div>
          </div>
        </Link>
      )}

      <div className="mt-6 text-center">
        <Link href="/review" className="text-sm text-navy-500 underline">復習モード（忘却曲線）はこちら →</Link>
      </div>
    </AppShell>
  );
}
