"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  IconTable,
  IconMail,
  IconFileDescription,
  IconCalendarEvent,
  IconListCheck,
  IconBulb,
  IconWifi,
  IconWifiOff,
  IconArrowRight,
  IconCircleCheck,
} from "@tabler/icons-react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const TIPS = [
  "모르는 것을 모른다고 말하는 용기가 성장의 시작입니다.",
  "중요한 업무는 오전에 처리하면 집중력이 높아집니다.",
  "이메일 제목은 결론을 먼저, 본문은 육하원칙으로 작성하세요.",
  "회의 전에 아젠다를 미리 공유하면 효율이 2배 올라갑니다.",
  "업무 메모는 바로 기록하는 습관이 실수를 줄입니다.",
  "모르는 용어는 그냥 넘기지 말고 바로 찾아보세요.",
  "작은 성공을 매일 기록하면 자신감이 쌓입니다.",
  "상사의 피드백은 적어두고 패턴을 파악해 보세요.",
  "바쁠수록 To-Do 리스트를 먼저 작성하면 우선순위가 명확해집니다.",
  "동료에게 먼저 인사하는 작은 습관이 팀 분위기를 바꿉니다.",
];

const QUICK_LINKS = [
  { href: "/data",     label: "데이터 정리", Icon: IconTable,           desc: "텍스트를 표로 정리" },
  { href: "/email",    label: "이메일 작성", Icon: IconMail,            desc: "답장 초안 3가지 생성" },
  { href: "/summary",  label: "문서 요약",   Icon: IconFileDescription, desc: "AI 핵심 요약" },
  { href: "/schedule", label: "일정 추출",   Icon: IconCalendarEvent,   desc: "날짜·시간·장소 추출" },
];

const DAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export default function HomePage() {
  const [today, setToday] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tip, setTip] = useState("");
  const [aiStatus, setAiStatus] = useState<"checking" | "connected" | "error">("checking");

  useEffect(() => {
    // 오늘 날짜 포맷
    const now = new Date();
    const month = now.getMonth() + 1;
    const date  = now.getDate();
    const day   = DAY_KO[now.getDay()];
    setToday(`${month}월 ${date}일 ${day}`);

    // 랜덤 팁 (날짜 기반 고정)
    setTip(TIPS[date % TIPS.length]);

    // localStorage 할 일 읽기
    try {
      const saved = localStorage.getItem("worky_todos");
      if (saved) setTodos(JSON.parse(saved));
    } catch {}

    // AI 연결 확인
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

  const total     = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const progress  = total === 0 ? 0 : Math.round((completed / total) * 100);
  const remaining = total - completed;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 환영 인사 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 px-5 py-4 shadow-sm">
        <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1">{today}</p>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">안녕하세요, 오늘도 잘 부탁드립니다.</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Worky가 오늘 업무를 도와드릴게요.</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* 할 일 진행률 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconListCheck className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">할 일 진행률</span>
            </div>
            <Link
              href="/todo"
              className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-[#6C63FF] transition-colors"
            >
              관리하기 <IconArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {total === 0 ? (
            <p className="text-sm text-slate-400 dark:text-zinc-500 py-2">등록된 할 일이 없습니다.</p>
          ) : (
            <>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{progress}%</span>
                <span className="text-xs text-slate-400 dark:text-zinc-500 mb-1">
                  {completed}/{total}건 완료
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6C63FF, #9C95FF)" }}
                />
              </div>
              {remaining > 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">{remaining}개 남음</p>
              )}
              {remaining === 0 && total > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-500">
                  <IconCircleCheck className="w-3.5 h-3.5" />
                  오늘 할 일을 모두 완료했습니다.
                </div>
              )}
            </>
          )}
        </div>

        {/* AI 연결 상태 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            {aiStatus === "connected" ? (
              <IconWifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <IconWifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">AI 연결 상태</span>
          </div>

          {aiStatus === "checking" && (
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-zinc-500">
              <span className="w-4 h-4 border-2 border-slate-200 border-t-[#6C63FF] rounded-full animate-spin shrink-0" />
              연결 확인 중...
            </div>
          )}
          {aiStatus === "connected" && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Groq AI 연결됨</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                llama-3.3-70b-versatile 모델이 준비되었습니다.
              </p>
            </>
          )}
          {aiStatus === "error" && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-500 dark:text-red-400">연결 실패</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                GROQ_API_KEY를 확인해주세요.
              </p>
            </>
          )}
        </div>

        {/* 빠른 접근 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">빠른 접근</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map(({ href, label, Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 transition-all"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">{label}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 오늘의 팁 */}
        <div
          className="rounded-2xl p-4 shadow-sm sm:col-span-2 lg:col-span-1"
          style={{ background: "linear-gradient(135deg, #6C63FF18, #8B85FF10)", border: "1px solid #6C63FF30" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <IconBulb className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-[#6C63FF]">오늘의 팁</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            {tip || "오늘 하루도 차근차근 해나가면 됩니다."}
          </p>
        </div>

      </div>
    </div>
  );
}
