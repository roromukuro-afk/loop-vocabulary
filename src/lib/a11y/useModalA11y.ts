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
 *
 * 呼び出し側の注意点(PR #58レビューでの再確認事項):
 * - 複数モーダルの同時使用: containerRef・openerRefは呼び出しごとにuseRefで独立して
 *   生成されるため、複数のモーダルが同時に開いていても互いに干渉しない
 *   (フォーカストラップの走査対象は各containerRef配下のみに限定される)。
 * - cleanupの二重実行: cleanup関数は実行直後にopenerRef.currentをnullへ戻すため、
 *   仮に(React 18/19のStrictModeでの開発時二重実行等により)同じcleanupが2回
 *   呼ばれても、2回目はopenerが既にnullのため何もしない(安全に冪等)。
 * - モーダル内でstepやタブなどの内部状態が変化しDOM構造が入れ替わる場合、
 *   フォーカスされていた要素自体が消えてdocument.activeElementがbodyへ落ちる
 *   ことがある(このフックはopen変化時のフォーカス移動のみを行うため、モーダル
 *   内部の状態遷移までは検知できない)。呼び出し側はその状態遷移後に、新しい
 *   内容内の適切な要素へ明示的にフォーカスを移すこと(OnboardingModal.tsxの
 *   ステップ切り替え時のフォーカス管理を参照)。
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
