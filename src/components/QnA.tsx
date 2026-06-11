"use client";


import HelpButton from "./HelpButton";
import { useState, useRef, useEffect } from "react";
import { IconHistory, IconX } from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";
import { createClient } from "@/lib/supabase/client";
import { saveQaHistory, updateQaHistory, getQaHistories, type QaHistory } from "@/lib/db/qa_histories";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "안녕하세요! 저는 Worky예요.\n업무 관련 궁금한 점이 있으시면 뭐든지 물어보세요. 이메일 작성, 보고서 형식, 사내 커뮤니케이션 등 신입사원으로서 어려운 부분을 함께 해결해드릴게요!",
};

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SYSTEM_PROMPT = `당신은 신입사원의 업무를 돕는 친절한 AI 어시스턴트 Worky입니다.
업무 관련 질문(이메일 작성법, 회의 에티켓, 보고서 형식, 사내 커뮤니케이션, 업무 우선순위 등)에 대해 실용적이고 구체적인 답변을 제공하세요.
답변은 간결하되 핵심을 짚어주고, 필요한 경우 예시를 들어 설명하세요.
항상 신입사원 입장을 이해하고 격려하는 따뜻한 태도로 답변하세요.`;

function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "assistant" && (
        <div
          className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5"
          style={{ background: "linear-gradient(135deg, #6C63FF, #9C95FF)" }}
        >
          W
        </div>
      )}
      <div
        className={[
          "max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          msg.role === "user"
            ? "text-white rounded-tr-sm"
            : "bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 rounded-tl-sm",
        ].join(" ")}
        style={msg.role === "user" ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
      >
        {msg.content}
      </div>
      {msg.role === "user" && (
        <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold mt-0.5">
          나
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function QnA() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [histories, setHistories] = useState<QaHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<QaHistory | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 대화가 진행될 때마다(어시스턴트 응답 완료 시) 히스토리 자동 저장/갱신
  useEffect(() => {
    if (!userId || messages.length < 3) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    const firstUserMsg = messages.find((m) => m.id !== "welcome" && m.role === "user");
    if (!firstUserMsg) return;
    const title = firstUserMsg.content.slice(0, 30);

    (async () => {
      if (currentHistoryId) {
        await updateQaHistory(currentHistoryId, title, messages);
      } else {
        const { id, error } = await saveQaHistory(userId, title, messages);
        if (!error && id) setCurrentHistoryId(id);
      }
    })();
  }, [messages, userId, currentHistoryId]);

  const loadHistories = async () => {
    let uid = userId;
    if (!uid) {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
      if (uid) setUserId(uid);
    }
    if (!uid) return;
    const rows = await getQaHistories(uid);
    setHistories(rows);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      // 대화 히스토리 구성 (welcome 메시지 제외)
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, systemPrompt: SYSTEM_PROMPT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.result },
      ]);
      trackUsage("qa");
    } catch (e) {
      setError(e instanceof Error ? e.message : "응답을 가져오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setCurrentHistoryId(null);
    setError("");
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { await loadHistories(); setShowHistory(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <IconHistory className="w-3.5 h-3.5" />
            히스토리
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            대화 초기화
          </button>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm p-4 space-y-4 mb-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div
              className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm mt-0.5"
              style={{ background: "linear-gradient(135deg, #6C63FF, #9C95FF)" }}
            >
              W
            </div>
            <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl rounded-tl-sm">
              <LoadingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 추천 질문 */}
      <div className="flex gap-2 flex-wrap shrink-0">
        {["KPI가 뭔가요?", "상사에게 휴가 신청 메일 어떻게 써요?", "회의록 작성법 알려줘"].map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); inputRef.current?.focus(); }}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/5 hover:text-[#6C63FF] transition-all"
          >
            {q}
          </button>
        ))}
      </div>

      {/* 입력 영역 */}
      <div className="shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="질문을 입력하세요... (Shift+Enter로 줄바꿈)"
            rows={1}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none max-h-32 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-white transition-all disabled:opacity-40 shrink-0"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            aria-label="전송"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2 px-1">Enter로 전송 · Shift+Enter로 줄바꿈</p>
      </div>
      <HelpButton
        title="Q&A 사용법"
        steps={[
          { step: "질문 입력", desc: "채팅창에 업무 관련 질문을 자유롭게 입력하세요." },
          { step: "전송", desc: "Enter 또는 전송 버튼으로 AI에게 질문을 보냅니다." },
          { step: "대화 유지", desc: "이전 대화가 맥락으로 유지되어 이어서 대화할 수 있습니다." },
        ]}
      />

      {/* 히스토리 패널 */}
      {showHistory && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHistory(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-lg flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">대화 히스토리</h3>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="닫기"
                className="p-1 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {histories.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-zinc-500 text-center mt-8">저장된 히스토리가 없습니다</p>
              ) : (
                histories.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setSelectedHistory(h); setShowHistory(false); }}
                    className="block w-full text-left px-4 py-3 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{h.title}</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{formatHistoryDate(h.created_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 히스토리 상세 보기 모달 */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedHistory(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{selectedHistory.title}</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{formatHistoryDate(selectedHistory.created_at)}</p>
              </div>
              <button
                onClick={() => setSelectedHistory(null)}
                aria-label="닫기"
                className="p-1 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedHistory.messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
