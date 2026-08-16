"use client";

import { useRef, useState } from "react";

/**
 * 固定URLを共有するための汎用ボタン(Issue #98)。
 *
 * Web Share API(navigator.share)が使えればネイティブの共有シートを、
 * 使えなければURLのクリップボードコピーにfallbackする。
 *
 * 重要な設計上の注意:
 * - urlは呼び出し側が渡す固定の正規URLのみを想定する。ユーザーの入力データ
 *   (単語・意味・診断結果等)をこのコンポーネント自身がURLやtext/titleへ
 *   混ぜ込むことは絶対にしない(呼び出し側の責任で安全な値だけを渡す)。
 * - navigator.share()のPromiseがresolveすることは「実際にSNSへ投稿された」
 *   ことを意味しない(共有シートを開いた時点・別アプリへ渡した時点等で
 *   resolveするブラウザがある)。そのためonShareInvokedは「共有操作を
 *   開始した」事実のみを表し、成功/投稿完了を意味する名前にしない。
 */

type ShareMethod = "web_share" | "copy_link";

type Props = {
  url: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
  onShareInvoked?: (method: ShareMethod) => void;
};

const COPY_SUCCESS_MESSAGE = "リンクをコピーしました";
const COPY_FAILURE_MESSAGE = "コピーできませんでした。URLを長押し(またはドラッグ選択)してコピーしてください。";

export function ShareUrlButton({ url, title, text, label = "🔗 シェアする", className, onShareInvoked }: Props) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // copy()は連打を弾かない(コピー自体は繰り返し安全)が、2回連続クリック時に
  // 古い呼び出しの結果が新しい呼び出しの結果を上書きしないよう、呼び出しごとに
  // 単調増加するトークンで最新の呼び出しかどうかを判定する
  // (src/components/wordbooks/ShareButton.tsxの既存パターンを踏襲)。
  const copySeqRef = useRef(0);

  async function copyLink() {
    const seq = ++copySeqRef.current;
    try {
      await navigator.clipboard.writeText(url);
      if (copySeqRef.current !== seq) return;
      setCopied(true);
      setStatusMessage(COPY_SUCCESS_MESSAGE);
      onShareInvoked?.("copy_link");
      setTimeout(() => {
        if (copySeqRef.current === seq) setCopied(false);
      }, 2000);
    } catch {
      if (copySeqRef.current !== seq) return;
      setCopied(false);
      setStatusMessage(COPY_FAILURE_MESSAGE);
    }
  }

  async function handleClick() {
    if (typeof navigator !== "undefined" && navigator.share) {
      onShareInvoked?.("web_share");
      // ユーザーが共有シートをキャンセルした場合もPromiseがrejectされ得るが、
      // それ自体はエラーではないため握りつぶす。
      await navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    await copyLink();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        data-testid="share-url-button"
        className={
          className ??
          "px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
        }
      >
        {copied ? "✓ コピーしました" : label}
      </button>
      {statusMessage && (
        // メッセージが無い間はrole="status"の要素自体をDOMへ出さない。他ページ
        // (/tools/vocab-test-maker等)では、このボタンが表示された時点で常時
        // 空のrole="status"要素が存在すると、既存E2E(vocab-test-maker-authenticated.mjs
        // シナリオB)がpage.waitForSelector('[role="status"]')を「保存完了の合図」として
        // 使っている前提を壊し、実際の保存完了より先にこの空要素へマッチして
        // タイミング検証が無意味になってしまう(Issue #98で発見・対応)。
        <p role="status" aria-live="polite" data-testid="share-url-status" className="mt-2 text-xs text-navy-300">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
