"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseNotConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
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
        <h1 className="text-2xl font-bold text-navy-800 mt-3">ログイン</h1>
        <p className="text-sm text-navy-500 mt-1">Loop Vocabulary にログインして、単語帳を続きから学習</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="メールアドレス">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="パスワード">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? "ログイン中..." : "ログイン"}
          </Button>
        </form>

        <div className="mt-5 text-sm text-navy-500">
          アカウントをお持ちでない方は <Link href="/signup" className="text-navy-800 font-semibold">新規登録</Link>
        </div>
      </div>
    </div>
  );
}
