"use client";

import { ShareUrlButton } from "@/components/share/ShareUrlButton";
import { trackEvent } from "@/lib/analytics/track";

// page.tsxはServer Componentのため、trackEvent()を呼ぶクロージャをprops経由で
// Client Component(ShareUrlButton)へ直接渡せない(関数はServer→Client境界を
// またげない)。そのためこの薄いClient Componentでイベント発火だけを閉じ込める
// (Issue #98)。

const SHARE_URL = "https://loop-vocabulary.app/guide/eiken-2kyu-tango";
const SHARE_TITLE = "英検2級 単語対策｜頻出テーマ別の覚え方と無料単語一覧";
const SHARE_TEXT = "英検2級の単語対策を、頻出テーマ別の覚え方から無料の単語一覧・テスト作成ツールまでまとめて解説しています。";

export function GuideShareCta() {
  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 text-center">
      <p className="text-xs text-navy-500 mb-3">この記事が役に立ったら、SNSでシェアしてもらえると励みになります</p>
      <ShareUrlButton
        url={SHARE_URL}
        title={SHARE_TITLE}
        text={SHARE_TEXT}
        label="🔗 この記事をシェア"
        className="px-6 py-2.5 rounded-xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-900 transition-colors"
        // 既定のinputスタイルは/tools/vocab-test-maker等の暗い背景向けで、この白い
        // カード上ではURL/枠がほぼ判読できなくなるため、明るい背景向けに上書きする
        // (Codexレビュー指摘対応)。
        inputClassName="mt-2 w-full text-xs bg-navy-50 border border-navy-200 rounded-lg px-3 py-2 font-mono text-navy-800"
        onShareInvoked={(method) => trackEvent("guide_share_invoked", { guide_slug: "eiken-2kyu-tango", method })}
      />
    </div>
  );
}
