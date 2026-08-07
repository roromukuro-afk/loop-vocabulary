"use client";

import { useRef, useState } from "react";

interface Props {
  wordbookId: string;
  initialShared: boolean;
  initialCode: string | null;
}

const FALLBACK_MESSAGE = "共有設定を更新できませんでした。時間をおいてもう一度お試しください";
const COPY_SUCCESS_MESSAGE = "共有URLをコピーしました";
const COPY_FAILURE_MESSAGE = "共有URLをコピーできませんでした";

type ApiResult = { ok: true; shareCode?: string } | { ok: false };

// HTTP JSONエラー・非JSON応答・network abort・{ok:true}欠如(malformed
// success)・未知のapplication codeのいずれも、区別せず共通の安全な
// フォールバック文言で失敗として扱う(生のDBエラー・application codeの
// 詳細はユーザーへ表示しない)。
async function callShareApi(wordbookId: string, method: "POST" | "DELETE"): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(`/api/wordbook/${wordbookId}/share`, { method });
  } catch {
    return { ok: false };
  }
  const json: unknown = await res.json().catch(() => null);
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!res.ok || !body || body.ok !== true) {
    return { ok: false };
  }
  if (method === "POST") {
    const shareCode = typeof body.share_code === "string" ? body.share_code : undefined;
    if (!shareCode) return { ok: false }; // malformed success({ok:true}だがshare_codeが文字列でない)
    return { ok: true, shareCode };
  }
  return { ok: true };
}

export function ShareButton({ wordbookId, initialShared, initialCode }: Props) {
  const [shared, setShared] = useState(initialShared);
  const [code, setCode] = useState<string | null>(initialCode);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 有効化/無効化は同一の共有トグルに対する操作(同時に両方は起こり得ない)
  // なので、1つの同期的refで二重送信を防止する。
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  // copy()はenable/disableと違い連打を弾かない(コピー自体は繰り返し安全な
  // 操作のため)。ただしそのままだと2回連続クリック時、完了順序(呼び出し順序
  // ではなく)でUI状態が決まってしまい、後から解決した古い試行の結果が新しい
  // 試行の結果を上書きしうる。呼び出しごとに単調増加するトークンを持たせ、
  // 解決時に自分が最新の呼び出しでなければ結果を反映しない。
  const copySeqRef = useRef(0);

  const shareUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${code}`
    : null;

  function beginAction(): boolean {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(true);
    setStatusMessage(null);
    setErrorMessage(null);
    // 進行中のcopy()を無効化する。コピーボタンは有効化/無効化の操作中も
    // 押せる状態のままのため、コピー実行中に共有トグルが開始された場合、
    // トグルの結果を古いコピーの結果で上書きしてしまう可能性がある。
    // トグル開始時点でシーケンスを進め、それ以前に呼ばれたcopy()の結果が
    // 後から解決してもUIへ反映されないようにする。
    copySeqRef.current++;
    // 無効化されたcopy()のresetタイマーはseq不一致でsetCopied(false)を
    // スキップするようになるため、ここで明示的にクリアしないとチェック
    // マークが消えないまま残留し続けてしまう。
    setCopied(false);
    return true;
  }
  function endAction() {
    pendingRef.current = false;
    setPending(false);
  }

  async function enable() {
    if (!beginAction()) return;
    const result = await callShareApi(wordbookId, "POST");
    endAction();
    if (!result.ok) {
      setErrorMessage(FALLBACK_MESSAGE);
      return;
    }
    setCode(result.shareCode ?? null);
    setShared(true);
    setStatusMessage("単語帳の共有を開始しました");
  }

  async function disable() {
    if (!beginAction()) return;
    const result = await callShareApi(wordbookId, "DELETE");
    endAction();
    if (!result.ok) {
      // 失敗時はUIを非共有へ変更しない(サーバー側は実際には共有中のまま
      // かもしれないため、決め打ちで状態を変えない)。
      setErrorMessage(FALLBACK_MESSAGE);
      return;
    }
    setShared(false);
    setStatusMessage("単語帳の共有を停止しました");
  }

  async function copy() {
    if (!shareUrl) return;
    const seq = ++copySeqRef.current;
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (copySeqRef.current !== seq) return; // 自分より新しい呼び出しが既にある場合、古い結果は無視する
      setCopied(true);
      setStatusMessage(COPY_SUCCESS_MESSAGE);
      setErrorMessage(null);
      // このtimerも呼び出し単位で紐付ける。2秒以内に別の成功コピーが起きて
      // いた場合、その新しい試行のチェックマークを古いtimerが誤って消さない
      // ようにする。
      setTimeout(() => {
        if (copySeqRef.current === seq) setCopied(false);
      }, 2000);
    } catch {
      if (copySeqRef.current !== seq) return;
      setStatusMessage(null);
      setCopied(false);
      setErrorMessage(COPY_FAILURE_MESSAGE);
    }
  }

  const statusEl = (
    <p
      role="status"
      aria-live="polite"
      data-testid="wordbook-share-status"
      className="text-xs text-emerald-700 min-h-[1em]"
    >
      {statusMessage ?? ""}
    </p>
  );
  const alertEl = errorMessage ? (
    <p role="alert" data-testid="wordbook-share-alert" className="text-xs text-red-600">
      {errorMessage}
    </p>
  ) : null;

  if (!shared) {
    return (
      <div aria-busy={pending}>
        {statusEl}
        {alertEl}
        <button
          onClick={enable}
          disabled={pending}
          aria-label="この単語帳を共有"
          aria-busy={pending}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-navy-200 text-navy-500 text-sm font-semibold hover:border-sky-400 hover:text-sky-600 transition-colors disabled:opacity-50"
        >
          {pending ? "…" : "🔗 この単語帳を共有"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3" aria-busy={pending}>
      {statusEl}
      {alertEl}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-sky-800">共有中</p>
        <button
          onClick={disable}
          disabled={pending}
          aria-label="共有を停止"
          aria-busy={pending}
          className="text-[11px] text-navy-400 underline disabled:opacity-50"
        >
          共有を停止
        </button>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl ?? ""}
          aria-label="共有URL"
          className="flex-1 text-xs bg-white border border-sky-200 rounded-lg px-3 py-2 font-mono truncate"
        />
        <button
          onClick={copy}
          disabled={pending}
          aria-label="共有URLをコピー"
          className="px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors shrink-0 disabled:opacity-50"
        >
          {copied ? "✓" : "コピー"}
        </button>
      </div>
      <p className="text-[11px] text-sky-600">このURLを送ると、他のユーザーが単語帳をインポートできます</p>
    </div>
  );
}
