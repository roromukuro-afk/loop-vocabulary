"use client";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

// PR #57(単語帳ドロワー)のレビューで指摘された、独自モーダル/ドロワー共通の
// アクセシビリティ要件(Escapeで閉じる・Tab/Shift+Tabのフォーカストラップ・開いた際の
// フォーカス移動・閉じた際の起点要素へのフォーカス復帰)を1箇所にまとめたフック。
// 同じ実装を複数のモーダルへ個別に書くと、同じレビュー指摘を繰り返すリスクがあるため
// 共通化している。

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * @param open モーダルが開いているかどうか。
 * @param onClose Escapeキーで呼び出す、モーダルを閉じる関数。
 * @returns
 *   - containerRef: モーダル本体(role="dialog"を付ける要素)へ渡すref。
 *   - handleKeyDown: 同じ要素のonKeyDownへ渡すハンドラ(Escape・フォーカストラップ)。
 *
 * 呼び出し側は、openの値に応じてrole="dialog"・aria-modal="true"・aria-labelledbyを
 * 条件付きで付与すること(閉じている間はダイアログとして認識されないようにするため)。
 */
export function useModalA11y(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // 開いた瞬間にフォーカスされていた要素(=通常はモーダルを開くトリガーとなった
    // ボタン)を起点として記憶し、フォーカスをモーダル本体へ移す。
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    containerRef.current?.focus();

    // openがfalseになった時(closeボタンでstate管理するモーダル)だけでなく、
    // 親が条件付きレンダリングでこのコンポーネント自体をアンマウントする形で閉じる
    // モーダル(例: UpsellModal・AiSuggestButtonのモーダル)でも、このcleanupが
    // アンマウント時に必ず実行されるため、いずれの閉じ方でもフォーカスが復帰する。
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) {
        // 閉じるアニメーション(transitionによる非表示)がある場合に備え、次フレームで
        // フォーカスを戻す。
        requestAnimationFrame(() => opener.focus());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const container = containerRef.current;
    if (!container) return;
    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      e.preventDefault();
      container.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return { containerRef, handleKeyDown };
}
