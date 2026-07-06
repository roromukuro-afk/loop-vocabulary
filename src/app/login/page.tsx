"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseNotConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { trackLoginComplete } from "@/lib/analytics/events";

type Mode = "password" | "magic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const onSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setError(error.message); return; }
      trackLoginComplete("email");
      router.replace(next);
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (isSupabaseNotConfigured(e)) { router.push("/setup"); return; }
      setError(e instanceof Error ? e.message : "予期せぬエラー");
    }
  };

  const onSubmitMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      setMessage(`${email} にログインリンクを送信しました。メールのリンクをクリックしてください。`);
    } catch (e) {
      setBusy(false);
      if (isSupabaseNotConfigured(e)) { router.push("/setup"); return; }
      setError(e instanceof Error ? e.message : "予期せぬエラー");
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setError(`Googleログインエラー: ${error.message}`);
        setGoogleBusy(false);
      } else if (!data.url) {
        setError("Google認証URLが取得できませんでした。SupabaseダッシュボードでGoogle Providerを有効化してください。");
        setGoogleBusy(false);
      } else {
        trackLoginComplete("google");
        window.location.href = data.url;
      }
    } catch (e) {
      setGoogleBusy(false);
      setError(e instanceof Error ? e.message : "予期せぬエラー");
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-navy-100 p-6">
        <Link href="/" className="text-xs text-navy-500">← トップへ</Link>
        <div className="flex items-center gap-2 mt-4">
          <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M10 3a7 7 0 1 0 7 7" />
              <path d="M17 3v4h-4" />
            </svg>
          </div>
          <span className="font-bold text-navy-800 text-sm tracking-tight">Loop <span className="text-sky-500">Vocabulary</span></span>
        </div>
        <h1 className="text-xl font-bold text-navy-800 mt-3">おかえり。</h1>
        <p className="text-sm text-navy-500 mt-1">続きの単語、待ってたよ。</p>

        {/* Google ログイン */}
        <button
          onClick={onGoogle}
          disabled={googleBusy || busy}
          className="mt-5 w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-navy-200 text-navy-700 font-semibold text-sm hover:bg-navy-50 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
            <path d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h8c4.7-4.3 7.2-10.7 7.2-17.3z" fill="#4285F4"/>
            <path d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-8-6c-2.1 1.4-4.8 2.2-7.8 2.2-6 0-11.1-4-12.9-9.5H2.9v6.2C6.8 42.5 14.9 48 24 48z" fill="#34A853"/>
            <path d="M11.1 28.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-6.2H2.9C1 17.2 0 20.5 0 24c0 3.5 1 6.8 2.9 9.7l8.2-4.8z" fill="#FBBC04"/>
            <path d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.5-6.5C35.9 2.5 30.5 0 24 0 14.9 0 6.8 5.5 2.9 14.3l8.2 6.2C12.9 13.5 18 9.5 24 9.5z" fill="#EA4335"/>
          </svg>
          {googleBusy ? "リダイレクト中…" : "Google でログイン"}
        </button>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="relative mt-5 mb-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-navy-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-navy-400">またはメールアドレスで</span>
          </div>
        </div>

        {/* モード切替タブ */}
        <div className="flex rounded-xl border border-navy-100 overflow-hidden mb-4">
          <button
            onClick={() => { setMode("password"); setError(null); setMessage(null); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "password" ? "bg-sky-500 text-white" : "text-navy-500 hover:bg-navy-50"}`}
          >
            パスワード
          </button>
          <button
            onClick={() => { setMode("magic"); setError(null); setMessage(null); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "magic" ? "bg-sky-500 text-white" : "text-navy-500 hover:bg-navy-50"}`}
          >
            メールリンク
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={onSubmitPassword} className="space-y-4">
            <Field label="メールアドレス">
              <Input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="パスワード">
              <Input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Button data-testid="login-submit" type="submit" fullWidth size="lg" disabled={busy || googleBusy}>
              {busy ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmitMagic} className="space-y-4">
            <Field label="メールアドレス" hint="登録済みのメールアドレスを入力してください">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="example@gmail.com" />
            </Field>
            {message ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 px-3 py-3 rounded-lg border border-emerald-200">
                {message}
              </div>
            ) : (
              <Button type="submit" fullWidth size="lg" disabled={busy || googleBusy}>
                {busy ? "送信中..." : "ログインリンクを送信"}
              </Button>
            )}
            <p className="text-xs text-navy-400 text-center">メールに届くリンクをクリックするだけでログインできます</p>
          </form>
        )}

        <div className="mt-5 text-sm text-navy-500">
          アカウントをお持ちでない方は <Link href="/signup" className="text-navy-800 font-semibold">新規登録</Link>
        </div>
      </div>
    </div>
  );
}
