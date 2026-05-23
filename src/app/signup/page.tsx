"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseNotConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setMessage("確認メールを送信しました。メール内のリンクから認証してください。");
    } catch (e) {
      setBusy(false);
      if (isSupabaseNotConfigured(e)) {
        router.push("/setup");
        return;
      }
      setError(e instanceof Error ? e.message : "予期せぬエラー");
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-navy-100 p-6">
        <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
        <h1 className="text-2xl font-bold text-navy-800 mt-3">新規登録</h1>
        <p className="text-sm text-navy-500 mt-1">無料で英単語帳を作って、忘却曲線復習を始めよう</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="メールアドレス">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="パスワード" hint="6文字以上">
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {message && <div className="text-sm text-navy-700 bg-sky-50 p-3 rounded-lg">{message}</div>}
          <Button type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? "登録中..." : "無料で登録"}
          </Button>
          <p className="text-xs text-navy-400">
            登録した時点で <Link href="/terms" className="underline">利用規約</Link> と
            <Link href="/privacy" className="underline ml-1">プライバシーポリシー</Link> に同意したものとします。
          </p>
        </form>

        <div className="mt-5 text-sm text-navy-500">
          すでにアカウントをお持ちの方は <Link href="/login" className="text-navy-800 font-semibold">ログイン</Link>
        </div>
      </div>
    </div>
  );
}
