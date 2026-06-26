"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Dataset = "all" | "eiken45" | "eiken3" | "eikenPre2" | "basicDaily" | "highschool" | "toeic" | "eiken2" | "eikenP1" | "eiken1" | "junior" | "daigaku";

const DATASETS: { value: Dataset; label: string; count: string; tag?: string }[] = [
  { value: "all", label: "全データセット（推奨）", count: "~10,000語+" },
  { value: "eiken45", label: "英検5・4級 基礎単語", count: "~506語", tag: "初学者" },
  { value: "eiken3", label: "英検3級 重要単語", count: "~453語", tag: "初学者" },
  { value: "eikenPre2", label: "英検準2級 重要単語", count: "~445語", tag: "基礎" },
  { value: "basicDaily", label: "日常英会話 基礎フレーズ", count: "~309語", tag: "基礎" },
  { value: "highschool", label: "高校英語基礎 B1+B2+B3", count: "~662語" },
  { value: "toeic", label: "TOEIC 頻出 B1〜B6", count: "~793語" },
  { value: "eiken2", label: "英検2級 B1〜B5", count: "~591語" },
  { value: "eikenP1", label: "英検準1級 B1+B2+B3", count: "~480語" },
  { value: "eiken1", label: "英検1級 B1+B2+B3", count: "~544語" },
  { value: "junior", label: "中学英語 B1〜B6", count: "~1,195語" },
  { value: "daigaku", label: "大学受験 B2〜B8", count: "~776語" },
];

type SeedResult = {
  ok: boolean;
  dataset: string;
  results: Record<string, { inserted: number; skipped: number }>;
  totalInserted: number;
  totalSkipped: number;
  dbTotal: number;
};

export default function SeedVocabPage() {
  const [selected, setSelected] = useState<Dataset>("all");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("待機中");
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSeed() {
    setRunning(true);
    setResult(null);
    setError(null);
    setStatus("認証確認中…");

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("ログインしていません。");
      setRunning(false);
      return;
    }

    setStatus(`${selected} のシード実行中…`);

    try {
      const res = await fetch("/api/admin/seed-vocab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ dataset: selected }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data: SeedResult = await res.json();
      setResult(data);
      setStatus("✅ 完了！");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("❌ エラー");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif", maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: "bold", marginBottom: 4 }}>単語データ大規模投入</h1>
      <p style={{ color: "#555", fontSize: 14, marginBottom: 24 }}>
        英検5〜1級・TOEIC・高校英語・中学英語・大学受験・日常英会話の語彙データをDBに投入します。<br />
        service_role キーを使用しRLSをバイパスしてINSERTします（既存語はスキップ）。
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}>データセット選択:</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DATASETS.map((d) => (
            <label
              key={d.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                border: selected === d.value ? "2px solid #1e40af" : "1px solid #d1d5db",
                borderRadius: 8,
                cursor: "pointer",
                background: selected === d.value ? "#eff6ff" : "#fff",
              }}
            >
              <input
                type="radio"
                value={d.value}
                checked={selected === d.value}
                onChange={() => setSelected(d.value)}
              />
              <span style={{ fontWeight: selected === d.value ? "bold" : "normal" }}>
                {d.label}
                {d.tag && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 11,
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontWeight: "bold",
                  }}>
                    {d.tag}
                  </span>
                )}
              </span>
              <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: 13 }}>{d.count}</span>
            </label>
          ))}
        </div>
      </div>

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
          width: "100%",
        }}
      >
        {running ? "⏳ 実行中…" : "🚀 シード実行"}
      </button>

      <p style={{ marginTop: 16, color: "#374151" }}>ステータス: <strong>{status}</strong></p>

      {error && (
        <div style={{ marginTop: 16, background: "#fef2f2", padding: 16, borderRadius: 8, border: "1px solid #fca5a5", color: "#b91c1c" }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, background: "#f0fdf4", padding: 20, borderRadius: 10, border: "1px solid #86efac" }}>
          <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>
            🗄️ DB合計: <strong>{result.dbTotal?.toLocaleString() ?? "?"}</strong> 語
          </div>
          <div style={{ fontSize: 15, marginBottom: 4 }}>
            ✅ 追加: <strong>{result.totalInserted}</strong> 語 /
            ⏭ スキップ: <strong>{result.totalSkipped}</strong> 語
          </div>
          {Object.entries(result.results).map(([key, r]) => (
            <div key={key} style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
              {key}: +{r.inserted} / skip {r.skipped}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 12, background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280" }}>
        ⚠️ このページはadmin権限ユーザー専用です。<br />
        <a href="/admin" style={{ color: "#1e40af" }}>← 管理画面へ戻る</a>
      </div>
    </div>
  );
}
