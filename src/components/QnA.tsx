"use client";


import HelpButton from "./HelpButton";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IconHistory, IconX } from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";
import { createClient } from "@/lib/supabase/client";
import { saveQaHistory, updateQaHistory, getQaHistories, type QaHistory } from "@/lib/db/qa_histories";
import { fetchWorkData } from "@/lib/db/qna-context";
import { useLocale } from "@/lib/i18n/LocaleContext";

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletItems: React.ReactNode[] = [];
  let orderedItems: React.ReactNode[] = [];
  let k = 0;

  const flushBullet = () => {
    if (bulletItems.length === 0) return;
    nodes.push(
      <ul key={k++} className="list-disc pl-5 space-y-0.5 my-1">
        {bulletItems.map((item, i) => (
          <li key={i} className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">{item}</li>
        ))}
      </ul>
    );
    bulletItems = [];
  };

  const flushOrdered = () => {
    if (orderedItems.length === 0) return;
    nodes.push(
      <ol key={k++} className="list-decimal pl-5 space-y-0.5 my-1">
        {orderedItems.map((item, i) => (
          <li key={i} className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">{item}</li>
        ))}
      </ol>
    );
    orderedItems = [];
  };

  const flushAll = () => { flushBullet(); flushOrdered(); };

  for (const line of lines) {
    const t = line.trim();

    if (/^#{1,6} /.test(t)) {
      flushAll();
      const content = t.replace(/^#+\s+/, "");
      const isLarge = t.startsWith("## ");
      nodes.push(
        <p key={k++} className={`font-bold text-slate-900 dark:text-zinc-50 mt-3 mb-1 ${isLarge ? "text-[15px]" : "text-sm"}`}>
          {parseInline(content)}
        </p>
      );
    } else if (/^[-•] /.test(t)) {
      flushOrdered();
      bulletItems.push(parseInline(t.slice(2)));
    } else if (/^\d+\. /.test(t)) {
      flushBullet();
      orderedItems.push(parseInline(t.replace(/^\d+\.\s+/, "")));
    } else if (t === "") {
      flushAll();
      nodes.push(<div key={k++} className="h-1.5" />);
    } else {
      flushAll();
      nodes.push(
        <p key={k++} className="text-sm text-slate-800 dark:text-zinc-100 leading-relaxed">
          {parseInline(t)}
        </p>
      );
    }
  }
  flushAll();
  return <div className="space-y-0.5">{nodes}</div>;
}

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

const QUESTION_POOL = [
  "KPI가 뭔가요?",
  "상사에게 휴가 신청 메일 어떻게 써요?",
  "회의록 작성법 알려줘",
  "회의 내용을 요약하는 방법은?",
  "이메일 초안 작성 도와줘",
  "업무 우선순위는 어떻게 정하나요?",
  "주간 보고서 작성 팁 알려줘",
  "프로젝트 진행 상황 정리하는 법",
  "거래처 미팅 준비 체크리스트",
  "업무 인수인계 문서는 어떻게 작성하나요?",
  "정중하게 거절하는 메시지 작성법",
  "동료에게 피드백 전달하는 방법",
  "클라이언트 불만에 어떻게 대응하나요?",
  "팀원에게 칭찬 메시지 보내는 법",
  "효과적인 시간 관리 팁 알려줘",
  "집중력을 높이는 방법은?",
  "번아웃 예방법 알려줘",
  "효율적인 회의 진행법",
  "자주 쓰는 엑셀 함수 추천해줘",
  "발표 자료는 어떻게 구성하나요?",
  "데이터 분석은 어떻게 시작하나요?",
  "협업 툴 활용법 알려줘",
];

function getRandomSuggestions(pool: string[], count: number): string[] {
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SYSTEM_PROMPT = `당신은 신입사원의 업무를 돕는 친절한 AI 어시스턴트 Worky입니다.
업무 관련 질문(이메일 작성법, 회의 에티켓, 보고서 형식, 사내 커뮤니케이션, 업무 우선순위 등)에 대해 실용적이고 구체적인 답변을 제공하세요.
답변은 간결하되 핵심을 짚어주고, 필요한 경우 예시를 들어 설명하세요.
항상 신입사원 입장을 이해하고 격려하는 따뜻한 태도로 답변하세요.
반드시 한국어로만 답변하세요. 다른 언어는 절대 사용하지 마세요.`;

const DATA_NEED_SYSTEM_PROMPT = `사용자 질문을 보고 Worky 앱의 데이터가 필요한지 판단하세요.
사용 가능한 데이터: clients(거래처), calendar_events(일정), todos(할일), memos(메모), glossary(용어사전)
응답은 반드시 JSON만: { "needsData": true/false, "tables": ["clients", ...] }
데이터가 필요 없으면: { "needsData": false, "tables": [] }
반드시 한국어로만 답변하세요. 다른 언어는 절대 사용하지 마세요.`;

function MessageBubble({ msg }: { msg: Message }) {
  const { t } = useLocale();
  return (
    <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "assistant" && (
        <div className="w-8 h-8 rounded-xl shrink-0 shadow-sm mt-0.5">
          <svg viewBox="0 0 32 32" className="w-full h-full rounded-xl">
            <rect width="32" height="32" rx="7" fill="#6C63FF"/>
            <path d="M5,8 L10.5,24 L16,14.5 L21.5,24 L27,8" fill="none" stroke="white"
              strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
        {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
      </div>
      {msg.role === "user" && (
        <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold mt-0.5">
          {t("qa_me")}
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
  const { t } = useLocale();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [histories, setHistories] = useState<QaHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<QaHistory | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(() => getRandomSuggestions(QUESTION_POOL, 3));
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

      // 1차 호출: 데이터 필요 여부 판단
      let needsData = false;
      let tables: string[] = [];
      try {
        const judgeRes = await fetch("/api/groq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            systemPrompt: DATA_NEED_SYSTEM_PROMPT,
            model: "llama-3.1-8b-instant",
          }),
        });
        const judgeData = await judgeRes.json();
        if (judgeRes.ok) {
          const parsed = JSON.parse(judgeData.result);
          needsData = !!parsed.needsData;
          tables = Array.isArray(parsed.tables) ? parsed.tables : [];
        }
      } catch {
        needsData = false;
      }

      let systemPrompt = SYSTEM_PROMPT;
      if (needsData && tables.length > 0 && userId) {
        setLoadingStage(t("qa_loading"));
        const workData = await fetchWorkData(userId, tables);
        setLoadingStage("");
        systemPrompt = `당신은 Worky 업무 도우미입니다.\n[사용자 데이터]\n${workData}\n위 데이터를 참고해서 답변하세요.\n\n${SYSTEM_PROMPT}`;
      }

      const assistantId = crypto.randomUUID();
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, systemPrompt, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error("알 수 없는 오류");

      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: acc } : m));
      }
      trackUsage("qa");

      // 스트리밍 완료 후 히스토리 저장/갱신 (최종 메시지 배열로 1회만)
      if (userId && acc.trim()) {
        const finalMessages: Message[] = [...messages, userMsg, { id: assistantId, role: "assistant", content: acc }];
        const firstUserMsg = finalMessages.find((m) => m.id !== "welcome" && m.role === "user");
        if (firstUserMsg) {
          const title = firstUserMsg.content.slice(0, 30);
          if (currentHistoryId) {
            await updateQaHistory(currentHistoryId, title, finalMessages);
          } else {
            const { id, error } = await saveQaHistory(userId, title, finalMessages);
            if (!error && id) setCurrentHistoryId(id);
          }
        }
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.role !== "assistant" || m.content !== ""));
      setError(e instanceof Error ? e.message : t("qa_error"));
    } finally {
      setLoading(false);
      setLoadingStage("");
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
    setSuggestions(getRandomSuggestions(QUESTION_POOL, 3));
  };

  const hasStarted = messages.length > 1 || messages.some(m => m.id !== "welcome");

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { await loadHistories(); setShowHistory(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <IconHistory className="w-3.5 h-3.5" />
            {t("qa_history_btn")}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t("qa_reset_btn")}
          </button>
        </div>
      </div>

      {hasStarted ? (
        <>
          {/* 채팅 영역 */}
          <div className="flex-1 overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm p-4 space-y-4 mb-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl shrink-0 shadow-sm mt-0.5">
                  <svg viewBox="0 0 32 32" className="w-full h-full rounded-xl">
                    <rect width="32" height="32" rx="7" fill="#6C63FF"/>
                    <path d="M5,8 L10.5,24 L16,14.5 L21.5,24 L27,8" fill="none" stroke="white"
                      strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-2xl rounded-tl-sm">
                  {loadingStage ? (
                    <p className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400">{loadingStage}</p>
                  ) : (
                    <LoadingDots />
                  )}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 추천 질문 */}
          <div className="flex gap-2 flex-wrap shrink-0 mb-3">
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:border-[#6C63FF]/40 hover:text-[#4D44CC] dark:text-[#8B85FF] transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* 초기 랜딩 화면 */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-12 h-12 mb-4">
            <svg viewBox="0 0 32 32" className="w-full h-full rounded-2xl shadow-sm">
              <rect width="32" height="32" rx="7" fill="#6C63FF"/>
              <path d="M5,8 L10.5,24 L16,14.5 L21.5,24 L27,8" fill="none" stroke="white"
                strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-800 dark:text-zinc-100 mb-2 text-center">
            {t("qa_welcome_title")}
          </p>
          <p className="text-sm text-slate-500 dark:text-zinc-400 text-center max-w-sm mb-6">
            {t("qa_welcome_desc")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg">
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="card-hover px-4 py-3 rounded-xl text-left text-xs font-medium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:text-[#4D44CC] dark:hover:text-[#8B85FF] transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("qa_input_hint")}
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
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 px-1">{t("qa_input_hint")}</p>
      </div>
      <HelpButton
        title={t("help_qa_title")}
        steps={[
          { step: t("help_qa_1_step"), desc: t("help_qa_1_desc") },
          { step: t("help_qa_2_step"), desc: t("help_qa_2_desc") },
          { step: t("help_qa_3_step"), desc: t("help_qa_3_desc") },
          { step: t("help_qa_4_step"), desc: t("help_qa_4_desc") },
        ]}
      />

      {/* 히스토리 패널 */}
      {typeof document !== "undefined" && createPortal(
      <div className={`fixed inset-0 z-50 ${showHistory ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out ${showHistory ? "opacity-100" : "opacity-0"}`}
          onClick={() => setShowHistory(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-lg flex flex-col transition-all duration-300 ease-in-out ${
            showHistory ? "w-72 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-full overflow-hidden"
          }`}
        >
          <div className="w-72 h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{t("qa_history_title")}</h3>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="닫기"
                className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {histories.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400 text-center mt-8">{t("qa_history_empty")}</p>
              ) : (
                histories.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setSelectedHistory(h); setShowHistory(false); }}
                    className="block w-full text-left px-4 py-3 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                  >
                    <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{h.title}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{formatHistoryDate(h.created_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
      )}

      {/* 히스토리 상세 보기 모달 */}
      {selectedHistory && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedHistory(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{selectedHistory.title}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{formatHistoryDate(selectedHistory.created_at)}</p>
              </div>
              <button
                onClick={() => setSelectedHistory(null)}
                aria-label="닫기"
                className="p-1 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
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
        </div>,
        document.body
      )}
    </div>
  );
}
