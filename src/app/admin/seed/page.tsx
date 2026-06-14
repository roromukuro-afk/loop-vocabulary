"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type WordRow = {
  material_id: string;
  word: string;
  meaning: string;
  pos: string;
  level: string;
  importance: number;
  display_order: number;
};

export default function SeedPage() {
  const [status, setStatus] = useState("待機中");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setIsAdmin(false); return; }
      supabase.from("profiles").select("is_admin").eq("id", data.user.id).single()
        .then(({ data: p }) => setIsAdmin(!!p?.is_admin));
    });
  }, []);

  async function runSeed() {
    setRunning(true);
    setResult(null);
    setStatus("単語データ読み込み中…");

    const supabase = createClient();

    // JSON を動的インポート（バンドルサイズ節約）
    const { default: rawData } = await import("@/data/seed-words-vol2.json");
    const rows = rawData as WordRow[];

    setStatus(`${rows.length} 語を挿入中…`);

    const CHUNK = 100;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("material_words").insert(chunk);
      if (error) {
        // 重複などがある場合は1件ずつ
        for (const row of chunk) {
          const { error: e2 } = await supabase.from("material_words").insert(row);
          if (!e2) inserted++;
          else skipped++;
        }
      } else {
        inserted += chunk.length;
      }
      setStatus(`処理中: ${Math.min(i + CHUNK, rows.length)} / ${rows.length} 語`);
    }

    // DB合計確認
    const { count: total } = await supabase
      .from("material_words")
      .select("*", { count: "exact", head: true });

    setResult({ inserted, skipped, total: total ?? 0 });
    setStatus("✅ 完了！");
    setRunning(false);
  }

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif", maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: "bold", marginBottom: 8 }}>管理者用 単語シード</h1>

      {isAdmin === null && <p style={{ color: "#888" }}>認証確認中…</p>}
      {isAdmin === false && (
        <p style={{ color: "red" }}>
          ⚠ ログインしていないか、管理者権限がありません。<br />
          <a href="/login" style={{ color: "#1e40af" }}>ログイン</a>してから再度開いてください。
        </p>
      )}

      {isAdmin === true && (
        <>
          <p style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>
            約1,996語をDBに追加します。重複はスキップされます。
          </p>
          <button
            onClick={runSeed}
            disabled={running}
            style={{
              padding: "12px 32px",
              background: running ? "#9ca3af" : "#1e40af",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: running ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {running ? "実行中…" : "🚀 シード実行"}
          </button>

          <p style={{ marginTop: 16, color: "#374151" }}>ステータス: {status}</p>

          {result && (
            <div style={{ marginTop: 16, background: "#f0fdf4", padding: 20, borderRadius: 10, border: "1px solid #86efac" }}>
              <div style={{ fontSize: 15 }}>✅ 追加: <strong>{result.inserted}</strong> 語</div>
              <div style={{ fontSize: 15 }}>⏭ スキップ(重複): <strong>{result.skipped}</strong> 語</div>
              <div style={{ fontSize: 18, fontWeight: "bold", marginTop: 8 }}>
                🗄️ DB合計: <strong>{result.total.toLocaleString()}</strong> 語
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
