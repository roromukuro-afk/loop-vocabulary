"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UpsellModal } from "@/components/premium/UpsellModal";
import { parseCsv, type ParsedWord } from "@/lib/utils/csvImportParsing";

export function CsvImportPanel({ wordbookId, isPremium }: { wordbookId: string; isPremium: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedWord[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [done, setDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setPreview([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const words = parseCsv(ev.target?.result as string);
        if (words.length === 0) {
          setError("単語が見つかりませんでした。フォーマットを確認してください。");
          return;
        }
        setPreview(words);
      } catch {
        setError("CSVの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!isPremium) { setShowUpsell(true); return; }
    if (preview.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/wordbook/${wordbookId}/csv-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: preview }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 403) { setShowUpsell(true); return; }
    if (!res.ok) { setError(data.error ?? "インポートに失敗しました"); return; }
    setImportCount(data.count);
    setDone(true);
  };

  const hasPhonetic = preview.some(w => w.phonetic);

  // showUpsell/done/メインフォームは元々それぞれ独立した早期returnで、
  // role="status"を安全に共有できる「常時マウント済みの領域」を置けなかった。
  // 3つの表示状態を1つの返り値の中で出し分けるよう変更し、状態が切り替わっても
  // 消えないsr-only領域をその外側に置けるようにした(各状態のJSX自体は変更していない)。
  return (
    <>
      <div role="status" className="sr-only">
        {done ? `${importCount} 語をインポートしました` : ""}
      </div>

      {showUpsell ? (
        <UpsellModal trigger="csv" onClose={() => setShowUpsell(false)} />
      ) : done ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-xl font-bold text-navy-800">{importCount} 語をインポートしました</div>
          <p className="text-sm text-navy-500 mt-1">単語帳に追加されました</p>
          <button
            onClick={() => router.push(`/wordbooks/${wordbookId}`)}
            className="mt-6 px-6 py-3 rounded-xl bg-navy-800 text-white font-bold text-sm hover:bg-navy-700 transition-colors"
          >
            単語帳を見る →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {!isPremium && (
            <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-4 text-white">
              <div className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-1">Premium 限定</div>
              <div className="font-bold">CSV一括インポートはプレミアム機能です</div>
              <div className="text-xs text-navy-300 mt-0.5">月額 ¥480 〜 で無制限にインポート可能</div>
              <button
                onClick={() => setShowUpsell(true)}
                className="mt-3 inline-block px-4 py-2 rounded-lg bg-white text-navy-800 text-xs font-bold hover:bg-navy-50 transition-colors"
              >
                プレミアムにアップグレード →
              </button>
            </div>
          )}

          {/* フォーマット説明 */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <div className="text-sm font-bold text-sky-800 mb-2">CSV フォーマット（UTF-8）</div>
            <div className="text-xs text-sky-700 mb-2">
              1行目にヘッダーを書くか、そのまま単語データを並べてください。
            </div>
            <pre className="bg-white border border-sky-100 rounded-lg p-3 text-xs text-navy-600 overflow-x-auto">{`word,meaning,phonetic
abandon,捨てる,/əˈbændən/
persist,固執する,/pɚˈsɪst/
achieve,達成する,/əˈtʃiːv/`}</pre>
            <div className="text-xs text-sky-600 mt-2">
              対応列: <code className="bg-white px-1 rounded border border-sky-200">word</code>
              <code className="bg-white px-1 rounded border border-sky-200 ml-1">meaning</code>
              <code className="bg-white px-1 rounded border border-sky-200 ml-1">phonetic</code>
              <code className="bg-white px-1 rounded border border-sky-200 ml-1">example</code>
              <code className="bg-white px-1 rounded border border-sky-200 ml-1">example_ja</code>
            </div>
          </div>

          {/* ファイル選択 */}
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-10 rounded-2xl border-2 border-dashed border-navy-300 text-navy-500 hover:border-navy-500 hover:bg-navy-50 transition-all flex flex-col items-center gap-2"
          >
            <span className="text-4xl">📁</span>
            <span className="text-sm font-semibold">{fileName || "CSVファイルを選択"}</span>
            <span className="text-xs text-navy-400">タップして .csv / .txt を選択</span>
          </button>

          {error && <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}

          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-navy-800">プレビュー</div>
                <div className="text-xs text-navy-500">{preview.length} 語を検出</div>
              </div>
              <div className="border border-navy-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-navy-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-navy-600 font-semibold">英単語</th>
                      <th className="px-3 py-2 text-left text-navy-600 font-semibold">意味</th>
                      {hasPhonetic && <th className="px-3 py-2 text-left text-navy-600 font-semibold hidden sm:table-cell">発音</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {preview.slice(0, 6).map((w, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-navy-800">{w.word}</td>
                        <td className="px-3 py-2 text-navy-600">{w.meaning}</td>
                        {hasPhonetic && <td className="px-3 py-2 text-navy-400 hidden sm:table-cell">{w.phonetic ?? "—"}</td>}
                      </tr>
                    ))}
                    {preview.length > 6 && (
                      <tr>
                        <td colSpan={hasPhonetic ? 3 : 2} className="px-3 py-2 text-navy-400 text-center">
                          … 他 {preview.length - 6} 語
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} disabled={busy} fullWidth className="mt-4">
                {busy ? "インポート中…" : `${preview.length} 語をインポートする`}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
