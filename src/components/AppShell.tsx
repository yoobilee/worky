"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const routeMeta: Record<string, { title: string; desc: string; aiChip: boolean }> = {
  "/":         { title: "Home",         desc: "오늘의 업무 현황을 한눈에 확인하세요",                 aiChip: false },
  "/data":     { title: "데이터 정리",  desc: "지저분한 텍스트를 AI가 표로 정리합니다",              aiChip: true  },
  "/todo":     { title: "할 일 / 메모", desc: "할 일을 추가하고 메모를 자유롭게 기록하세요",          aiChip: false },
  "/template": { title: "템플릿 생성",  desc: "업무 문서를 AI가 즉시 작성해드립니다",                aiChip: true  },
  "/qa":       { title: "Q&A",          desc: "업무 관련 질문을 AI에게 자유롭게 물어보세요",          aiChip: true  },
  "/email":    { title: "이메일 작성",  desc: "받은 이메일에 톤에 맞는 답장 초안을 생성합니다",        aiChip: true  },
  "/summary":  { title: "문서 요약",    desc: "텍스트나 PDF를 붙여넣으면 AI가 요약해드립니다",        aiChip: true  },
  "/schedule": { title: "일정 추출",    desc: "이메일·공지·메시지에서 일정 정보를 자동으로 추출합니다", aiChip: true  },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Groq API 연결 상태 확인 (최초 1회)
  useEffect(() => {
    fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "안녕" }],
        systemPrompt: "한 단어로만 대답하세요.",
      }),
    })
      .then((res) => setAiStatus(res.ok ? "connected" : "error"))
      .catch(() => setAiStatus("error"));
  }, []);

  const meta = routeMeta[pathname] ?? routeMeta["/"];

  return (
    <div className="flex h-full overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        aiStatus={aiStatus}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* 모바일 햄버거 헤더 */}
        <header className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-base" style={{ color: "var(--primary)" }}>Worky</span>
        </header>

        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{meta.title}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{meta.desc}</p>
          </div>
          {meta.aiChip && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
              AI 처리
            </span>
          )}
        </div>

        <main className="flex-1 overflow-auto p-3 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
