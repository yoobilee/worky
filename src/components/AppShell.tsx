"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { createClient } from "@/lib/supabase/client";

const routeMeta: Record<string, { title: string; desc: string; aiChip: boolean }> = {
  "/":         { title: "Home",         desc: "오늘의 업무 현황을 한눈에 확인하세요",                 aiChip: false },
  "/data":     { title: "데이터 정리",  desc: "지저분한 텍스트를 AI가 표로 정리합니다",              aiChip: true  },
  "/todo":     { title: "할 일 / 메모", desc: "할 일을 추가하고 메모를 자유롭게 기록하세요",          aiChip: false },
  "/template": { title: "템플릿 생성",  desc: "업무 문서를 AI가 즉시 작성해드립니다",                aiChip: true  },
  "/qa":       { title: "Q&A",          desc: "업무 관련 질문을 AI에게 자유롭게 물어보세요",          aiChip: true  },
  "/email":    { title: "이메일 작성",  desc: "받은 이메일에 톤에 맞는 답장 초안을 생성합니다",        aiChip: true  },
  "/summary":  { title: "문서 요약",    desc: "텍스트나 PDF를 붙여넣으면 AI가 요약해드립니다",        aiChip: true  },
  "/schedule":  { title: "일정 추출",   desc: "이메일·공지·메시지에서 일정 정보를 자동으로 추출합니다",  aiChip: true  },
  "/translate": { title: "번역·다듬기", desc: "텍스트를 번역하거나 비즈니스 톤으로 다듬어드립니다",        aiChip: true  },
  "/calendar":  { title: "일정 관리",   desc: "월별 캘린더로 일정을 관리하세요",                              aiChip: false },
  "/insight":   { title: "데이터 분석", desc: "숫자 데이터를 붙여넣으면 AI가 핵심 수치와 트렌드를 분석합니다", aiChip: true  },
  "/glossary":  { title: "용어집",      desc: "사내 용어를 등록하고 AI로 뜻을 설명받아 보세요",            aiChip: true  },
  "/feedback":  { title: "피드백 정리",  desc: "클라이언트 피드백을 필수/선택/구체화로 자동 정리합니다",        aiChip: true  },
  "/content":   { title: "메시지 작성",  desc: "업무 보고 메시지와 SNS 게시글을 AI로 빠르게 작성합니다",       aiChip: true  },
  "/document":  { title: "공문서 작성",  desc: "품의서·공문·지출결의서·업무협조 요청서를 AI로 작성합니다",         aiChip: true  },
  "/clients":   { title: "거래처 관리",  desc: "거래처별 보고 현황과 담당자 정보를 관리하세요",               aiChip: false },
  "/settings":  { title: "설정",        desc: "내 정보와 앱 환경설정을 관리하세요",                        aiChip: false },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // 스크롤바 드래그 중 강조 표시
  useEffect(() => {
    const onGrab = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const rect = el.getBoundingClientRect();
      const isScrollbarX = e.clientY > rect.bottom - 12 && e.clientY <= rect.bottom;
      const isScrollbarY = e.clientX > rect.right - 12 && e.clientX <= rect.right;
      if (isScrollbarX || isScrollbarY) {
        document.documentElement.setAttribute("data-scrolling", "true");
      }
    };
    const onRelease = () => {
      document.documentElement.removeAttribute("data-scrolling");
    };
    document.addEventListener("mousedown", onGrab);
    document.addEventListener("mouseup", onRelease);
    return () => {
      document.removeEventListener("mousedown", onGrab);
      document.removeEventListener("mouseup", onRelease);
    };
  }, []);

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

  // 로그인 페이지는 레이아웃 없이 children만 렌더링
  if (pathname === "/login") {
    return <>{children}</>;
  }

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
          <span className="font-bold text-base flex-1" style={{ color: "var(--primary)" }}>Worky</span>
          <NotificationBell userId={userId} />
        </header>

        {/* Topbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{meta.title}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{meta.desc}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {meta.aiChip && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                AI 처리
              </span>
            )}
            <NotificationBell userId={userId} />
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
