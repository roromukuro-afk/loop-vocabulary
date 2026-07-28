"use client";
// Google Funding Choices（同意管理タグ）の再表示API呼び出しボタン。
// EU/EEA・英国・スイス等、AdSense管理画面でメッセージが有効な地域からのアクセスの場合、
// クリックすると同意選択（パーソナライズ広告の許可/不許可）を後から変更できる。
// それ以外の地域ではメッセージ自体が存在しないため、クリックしても何も起こらない
// （Googleの公式リファレンス実装と同じ挙動。ボタン自体は常に表示する）。
type WindowWithGooglefc = Window & {
  googlefc?: { showRevocationMessage?: () => void };
};

export function AdConsentSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const googlefc = (window as WindowWithGooglefc).googlefc;
        googlefc?.showRevocationMessage?.();
      }}
    >
      広告のパーソナライズ設定を変更する
    </button>
  );
}
