import Link from "next/link";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const env = getSupabaseEnv();
  if (env.ok) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5 text-center">
        <div className="max-w-md bg-white border border-navy-100 shadow-card rounded-2xl p-6">
          <div className="text-emerald-600 font-bold">✓ Supabase 設定済み</div>
          <div className="mt-2 text-sm text-navy-600">アプリは正常に動作します。</div>
          <Link href="/" className="inline-block mt-4 text-navy-800 underline">トップへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="max-w-xl bg-white border border-navy-100 shadow-card rounded-2xl p-6">
        <div className="text-amber-600 font-bold">⚠ Supabase 未設定</div>
        <h1 className="text-2xl font-bold text-navy-800 mt-1">セットアップが必要です</h1>
        <p className="text-sm text-navy-600 mt-2">
          Loop Vocabulary は Supabase を使用します。以下の環境変数を <code>.env.local</code> に設定してください。
        </p>

        <pre className="text-xs bg-navy-50 p-3 rounded-xl mt-3 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>

        <ol className="mt-4 text-sm text-navy-700 list-decimal pl-5 space-y-1.5">
          <li><a className="underline" href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> でプロジェクトを作成</li>
          <li>Project Settings → API から URL と anon key を取得</li>
          <li>プロジェクトルートに <code>.env.local</code> を作成し上記キーを記入</li>
          <li>Supabase Studio → SQL Editor で <code>supabase/schema.sql</code> → <code>rls.sql</code> → <code>seed.sql</code> を順に実行</li>
          <li><code>npm run dev</code> を再起動</li>
        </ol>

        <p className="text-xs text-navy-400 mt-4">
          詳細は <code>README.md</code> の「Supabase 設定手順」を参照してください。
        </p>

        <div className="mt-4 text-xs">
          現在の値:
          <ul className="font-mono mt-1">
            <li>NEXT_PUBLIC_SUPABASE_URL: {env.url ? "✓ 設定済" : "✗ 未設定"}</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: {env.anon ? "✓ 設定済" : "✗ 未設定"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
