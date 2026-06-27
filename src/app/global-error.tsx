"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Worky 치명적 에러]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", gap: "16px", textAlign: "center", padding: "16px", backgroundColor: "#F8F8FA",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #6C63FF, #8B85FF)", color: "white", fontSize: 28, fontWeight: 700,
          }}>!</div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>문제가 발생했습니다</h1>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>페이지를 새로고침해 주세요.</p>
          </div>
          <button onClick={() => reset()} style={{
            padding: "10px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, color: "white",
            background: "linear-gradient(135deg, #6C63FF, #8B85FF)", border: "none", cursor: "pointer",
          }}>다시 시도</button>
        </div>
      </body>
    </html>
  );
}
