"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type SyncResult = {
  ok: boolean;
  status?: number;
  error?: string;
  submittedCount?: number;
  skippedCount?: number;
  totalUrls?: number;
};

// 通知は成功用のresult(ok:trueの場合のみ保持)とエラー用のerrorMsgに分離している。
// 以前はHTTP 200かつresult.ok===falseの場合もresultへ格納し、可視テキストの
// 先頭記号(✅/⚠️)だけで成否を切り替えていたため、成功用のライブリージョンに
// 実質的な失敗が「成功として」入ってしまう恐れがあった。ok===falseはエラー
// 経路(errorMsg)へ一本化し、role="status"には常に成功結果のみを流す。
export function IndexNowSyncButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/indexnow-sync", { method: "POST" });
      let data: SyncResult;
      try {
        data = await res.json();
      } catch {
        throw new Error("サーバーからの応答を読み取れませんでした");
      }
      if (!res.ok) {
        setErrorMsg(`失敗しました (HTTP ${res.status}): ${data?.error ?? "unknown error"}`);
        return;
      }
      if (!data.ok) {
        // 外部IndexNow API側のstatusが取得できている場合のみ表示し、
        // 取得できていない場合は推測で補わない。
        const statusPart = data.status ? ` (HTTP ${data.status})` : "";
        setErrorMsg(`同期に失敗しました${statusPart}: ${data.error ?? "unknown error"}`);
        return;
      }
      setResult(data);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const statusText = result
    ? `sitemap全${result.totalUrls ?? "?"}URL中、送信${result.submittedCount ?? 0}件、スキップ${result.skippedCount ?? 0}件`
    : "";

  return (
    <div className="grid gap-3">
      {/* role="status"はマウント前から存在するライブリージョンでないと確実に読み上げ
          られないため、常時マウント済みのsr-only領域を用意する。role="alert"は
          事前マウント不要のため、可視のエラー要素自体に直接付ける。 */}
      <div role="status" className="sr-only">{statusText}</div>
      <Button onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? "送信中..." : "今すぐIndexNowへ同期"}
      </Button>
      {errorMsg && <div role="alert" className="text-sm text-red-600">{errorMsg}</div>}
      {result && (
        <div className="text-sm text-navy-700">
          ✅ sitemap全 {result.totalUrls ?? "?"} URL中、送信 {result.submittedCount ?? 0} 件 / 直近10分以内送信済でスキップ {result.skippedCount ?? 0} 件
        </div>
      )}
    </div>
  );
}
