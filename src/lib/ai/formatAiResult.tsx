import type { ReactNode } from "react";

/**
 * AI応答テキスト（【見出し】形式のセクション区切りを含む）を表示用のReactノードへ整形する。
 * AiPanel（辞書検索時のAI解説）とFlashcardAiHint（フラッシュカードforgot直後のAI解説）の
 * 両方で同じ整形ロジックを使う。
 */
export function formatAiResult(text: string): ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const sectionMatch = line.match(/^【(.+?)】(.*)$/);
    if (sectionMatch) {
      return (
        <div key={i} className="mt-3 first:mt-0">
          <span className="inline-block text-[11px] font-bold px-2 py-0.5 bg-navy-100 text-navy-700 rounded-full mb-1">
            {sectionMatch[1]}
          </span>
          {sectionMatch[2] && <p className="text-sm text-navy-700 mt-0.5">{sectionMatch[2].trim()}</p>}
        </div>
      );
    }
    if (line.match(/^\d+\./)) {
      return <p key={i} className="text-sm text-navy-700 mt-1.5 pl-1">{line}</p>;
    }
    if (line.trim() === "") return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm text-navy-700 mt-1 leading-relaxed">{line}</p>;
  });
}
