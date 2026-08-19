"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackToolStarted, trackToolCompleted } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/track";
import { parseWordList, toWordbookCsv, csvWithBom, type WordListEntry } from "@/lib/utils/wordListCleaner";

const TOOL_KEY = "word-list-cleaner";

const PLACEHOLDER = `apple: りんご
banana - バナナ
cherry\tさくらんぼ`;

export function WordListCleaner() {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<WordListEntry[]>([]);
  const [skippedLineNumbers, setSkippedLineNumbers] = useState<number[]>([]);
  const [hasFormatted, setHasFormatted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const generatedFiredRef = useRef(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackToolStarted(TOOL_KEY);
    // GA4専用のtrackToolStartedとは別に、first-party Growth OS側でもページ表示を
    // 追跡する(exam-countdown-planner等、他の無料ツールと同じパターン)。
    trackEvent("word_list_cleaner_page_viewed", {});
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const { csv, neutralizedCount } = entries.length > 0 ? toWordbookCsv(entries) : { csv: "", neutralizedCount: 0 };

  function handleFormat() {
    const result = parseWordList(input);
    setEntries(result.entries);
    setSkippedLineNumbers(result.skippedLineNumbers);
    setHasFormatted(true);
    setCopyFailed(false);
    setDownloadFailed(false);
    if (result.entries.length > 0 && !generatedFiredRef.current) {
      generatedFiredRef.current = true;
      trackToolCompleted(TOOL_KEY);
      trackEvent("word_list_cleaner_formatted", { entry_count: result.entries.length });
    }
  }

  async function handleCopy() {
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setCopyFailed(false);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードAPIが使えない環境(権限拒否・非対応ブラウザ)では、下に表示される
      // 読み取り専用テキストエリアを全選択して手動コピーしてもらうフォールバックを示す。
      setCopied(false);
      setCopyFailed(true);
    }
  }

  function handleDownload() {
    if (!csv) return;
    try {
      const blob = new Blob([csvWithBom(csv)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wordlist.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Firefox/Safari系ブラウザでは、クリック直後に同期的にrevokeすると
      // ダウンロード自体が開始前に失敗することがあるため、次のイベントループまで遅延する。
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadFailed(false);
    } catch {
      // Blob/Object URL生成がブロックされる環境(サンドボックス化されたiframe等)向けの
      // フォールバック表示。コピー機能の利用を案内する。
      setDownloadFailed(true);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
        このツールは貼り付けたテキストをブラウザ内だけで整形します。サーバーへの保存は一切行いません。
        <strong>ご自身で作成した単語リストのみをご利用ください。</strong>市販教材や他者の著作物をそのまま貼り付けないでください。
      </div>

      <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
        <label htmlFor="word-list-input" className="font-black text-navy-800 text-base block mb-1">
          単語リストを貼り付け
        </label>
        <p className="text-xs text-navy-500 mb-3">
          1行に「単語」と「意味」を1組ずつ。区切り文字はタブ・コロン(: ：)・ハイフン(-)・カンマ・スペースのいずれでも構いません。
        </p>
        <textarea
          id="word-list-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="w-full rounded-xl border border-navy-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          type="button"
          onClick={handleFormat}
          disabled={!input.trim()}
          className="mt-3 w-full py-3 rounded-xl bg-navy-800 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-navy-900 transition-colors"
        >
          CSVに整形する
        </button>
      </div>

      {hasFormatted && (
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          {entries.length === 0 ? (
            <p className="text-sm text-navy-600">
              単語と意味のペアを認識できませんでした。区切り文字(タブ・コロン・ハイフン・カンマ・スペース)を確認してください。
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-navy-800 text-base">整形結果({entries.length}件)</h2>
              </div>
              {skippedLineNumbers.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                  {skippedLineNumbers.length}行(行番号: {skippedLineNumbers.join(", ")})は単語/意味のペアとして認識できず、スキップしました。
                </p>
              )}
              {neutralizedCount > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                  「=」「+」「-」「@」で始まる項目が{neutralizedCount}件あったため、表計算ソフトで数式として実行されるのを防ぐ目的で、コピー・ダウンロードされるCSVでは該当セルの先頭に <code className="bg-white px-1 rounded">&apos;</code> を追加しています(下のプレビュー表示は元の値のままです)。
                </p>
              )}
              <div className="max-h-64 overflow-y-auto border border-navy-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-navy-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-bold text-navy-700">単語</th>
                      <th className="text-left px-3 py-2 font-bold text-navy-700">意味</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} className="border-t border-navy-50">
                        <td className="px-3 py-1.5 text-navy-800">{e.word}</td>
                        <td className="px-3 py-1.5 text-navy-600">{e.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2.5 rounded-xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors"
                >
                  {copied ? "コピーしました ✓" : "CSVをコピー"}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="py-2.5 rounded-xl border border-navy-200 text-navy-700 font-bold text-sm hover:bg-navy-50 transition-colors"
                >
                  CSVをダウンロード
                </button>
              </div>

              {copyFailed && (
                <div className="mt-3 text-xs text-navy-600 bg-navy-50 rounded-lg p-3">
                  <p className="mb-2">
                    お使いのブラウザではコピー機能を利用できませんでした。下のテキストを全選択してコピーしてください。
                  </p>
                  <textarea
                    readOnly
                    value={csv}
                    rows={4}
                    aria-label="整形されたCSV(手動コピー用)"
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-lg border border-navy-200 p-2 text-xs font-mono"
                  />
                </div>
              )}
              {downloadFailed && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  ダウンロードに失敗しました。お使いの環境ではファイル保存が制限されている可能性があります。「CSVをコピー」してテキストエディタ等に貼り付けてご利用ください。
                </p>
              )}

              <p className="mt-4 text-xs text-navy-400 text-center">
                CSVを使ってテストも作りたい場合は{" "}
                <Link href="/tools/vocab-test-maker" className="text-sky-600 underline hover:text-sky-700">
                  単語テスト作成ツール
                </Link>
                {" "}もご利用いただけます。
              </p>
            </>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-6 text-white text-center">
        <div className="font-black text-lg mb-1">整形したCSVをそのまま単語帳にインポート</div>
        <p className="text-sm text-navy-300 mb-4">
          無料登録後、単語帳の「CSV一括インポート」からこの形式のファイルをそのまま読み込めます。
        </p>
        <Link
          href="/signup"
          onClick={() => trackEvent("word_list_cleaner_signup_cta_clicked", {})}
          className="inline-block px-6 py-3 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
        >
          無料で始める →
        </Link>
      </div>
    </div>
  );
}
