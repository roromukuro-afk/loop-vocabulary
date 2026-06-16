import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Loop Vocabulary";
  const desc = searchParams.get("desc") ?? "調べた英語を、覚える英語へ。";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a2744 0%, #0f1e3a 100%)",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* badge */}
        <div
          style={{
            fontSize: 13,
            color: "#7eb3d8",
            letterSpacing: 5,
            marginBottom: 20,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Loop Vocabulary
        </div>

        {/* title */}
        <div
          style={{
            fontSize: title.length > 24 ? 42 : 52,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: 980,
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* desc */}
        <div
          style={{
            fontSize: 22,
            color: "#a0bad0",
            marginTop: 24,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.5,
            display: "flex",
          }}
        >
          {desc}
        </div>

        {/* pills */}
        <div style={{ marginTop: 48, display: "flex", gap: 14 }}>
          {["忘却曲線 × SRS", "完全無料", "英検 / TOEIC 対応"].map((t) => (
            <div
              key={t}
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10,
                padding: "10px 22px",
                fontSize: 16,
                color: "#dce8f5",
                display: "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
