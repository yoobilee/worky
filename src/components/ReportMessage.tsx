"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconSend, IconCopy, IconCheck, IconBuilding, IconMessage, IconChevronDown,
} from "@tabler/icons-react";
import { trackUsage } from "@/lib/usageStats";

/* ── 타입 ── */
interface ClientOption {
  id:         string;
  name:       string;
  contact:    string;
  reportTone: string;
}

type ToneId = "formal" | "friendly" | "concise";

/* ── 상수 ── */
const TONES: { id: ToneId; label: string; desc: string }[] = [
  { id: "formal",   label: "정중하게", desc: "격식 있고 공손한 어투" },
  { id: "friendly", label: "친근하게", desc: "따뜻하고 편안한 어투" },
  { id: "concise",  label: "간결하게", desc: "핵심만 짧게 전달" },
];

const TONE_GUIDE: Record<ToneId, string> = {
  formal: `격식체로 작성하세요.
- "~드립니다", "~드렸습니다", "~해 드렸습니다", "~확인했습니다" 등 정중한 종결어미를 사용하세요.
- 문장 끝을 "~습니다"로만 반복하지 말고 "~드립니다", "~드렸습니다", "~말씀드립니다" 등 다양하게 사용하세요.
- 3~5문장으로 구성하세요.`,

  friendly: `구어체에 가까운 따뜻한 어투로 작성하세요.
- "~했어요", "~됐어요", "~드렸어요", "~확인했어요" 등 부드러운 종결어미를 사용하세요.
- 실제 카톡 보고 메시지처럼 자연스럽고 가볍게 작성하세요.
- 지나치게 딱딱하거나 사무적이지 않게, 사람 냄새 나게 쓰세요.
- 2~4문장으로 구성하세요.`,

  concise: `핵심만 1~2문장으로 매우 짧게 전달하세요.
- 주어·설명 없이 완료된 사실만 나열하세요.
- 군더더기 표현 없이 최대한 압축하세요.
- "~완료", "~처리", "~전달" 등 단호한 종결 표현을 사용하세요.`,
};

/* ── 헬퍼 ── */
function loadClients(): ClientOption[] {
  try {
    const raw = localStorage.getItem("worky_clients");
    if (!raw) return [];
    return (JSON.parse(raw) as ClientOption[]).map((c) => ({
      id:         c.id         ?? "",
      name:       c.name       ?? "",
      contact:    c.contact    ?? "",
      reportTone: c.reportTone ?? "",
    }));
  } catch {
    return [];
  }
}

function buildSystemPrompt(tone: ToneId, clientTone: string): string {
  let prompt = `당신은 실무 경험이 풍부한 한국 비즈니스 보고 메시지 작성 전문가입니다.
완료한 업무 내용을 바탕으로 실제로 쓰이는 자연스러운 보고 메시지를 작성하세요.

[톤 지침]
${TONE_GUIDE[tone]}`;

  if (clientTone.trim()) {
    prompt += `\n\n[거래처 선호사항]\n${clientTone.trim()}`;
  }

  prompt += `

[공통 규칙]
- 인사말("안녕하세요" 등)·맺음말("감사합니다" 등) 없이 보고 내용만 작성
- 마크다운(**, ## 등) 사용 금지
- 반드시 한국어로만 작성
- 같은 종결어미 반복 금지 — 문장마다 다른 표현 사용`;

  return prompt;
}

/* ── 컴포넌트 ── */
export default function ReportMessage() {
  const [clients,    setClients]    = useState<ClientOption[]>([]);
  const [clientId,   setClientId]   = useState("");
  const [workInput,  setWorkInput]  = useState("");
  const [tone,       setTone]       = useState<ToneId>("formal");
  const [result,     setResult]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [copied,        setCopied]        = useState(false);
  const [hydrated,      setHydrated]      = useState(false);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClients(loadClients());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const handleGenerate = async () => {
    if (!workInput.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    const clientTone = selectedClient?.reportTone ?? "";

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: workInput.trim() }],
          systemPrompt: buildSystemPrompt(tone, clientTone),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
      trackUsage("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "메시지 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hydrated) return null;

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full self-start">

      {/* 거래처 선택 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
          <IconBuilding className="w-4 h-4 text-[#6C63FF]" />
          거래처 선택
        </label>
        <div className="relative" ref={dropdownRef}>
          {/* 트리거 버튼 */}
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className={[
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all",
              dropdownOpen
                ? "border-[#6C63FF]/60 ring-2 ring-[#6C63FF]/40 bg-white dark:bg-zinc-900"
                : "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:border-[#6C63FF]/40",
            ].join(" ")}
          >
            <span className={clientId ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"}>
              {selectedClient ? selectedClient.name : "직접 입력 (거래처 선택 안 함)"}
            </span>
            <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* 드롭다운 목록 */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden">
              {/* 직접 입력 */}
              <button
                type="button"
                onClick={() => { setClientId(""); setDropdownOpen(false); }}
                className={[
                  "w-full flex items-center px-4 py-3 text-sm text-left transition-colors border-b border-slate-100 dark:border-zinc-800",
                  !clientId
                    ? "bg-[#6C63FF]/8 text-[#6C63FF] font-medium"
                    : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800",
                ].join(" ")}
              >
                직접 입력
              </button>
              {/* 거래처 목록 */}
              {clients.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400 dark:text-zinc-500">등록된 거래처가 없습니다</p>
              ) : (
                clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setClientId(c.id); setDropdownOpen(false); }}
                    className={[
                      "w-full flex items-center px-4 py-3 text-sm text-left transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0",
                      clientId === c.id
                        ? "bg-[#6C63FF]/8 text-[#6C63FF] font-semibold"
                        : "text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* 거래처 선호사항 */}
        {selectedClient?.reportTone && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#6C63FF]/5 border border-[#6C63FF]/20">
            <IconMessage className="w-3.5 h-3.5 text-[#6C63FF] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#6C63FF] uppercase tracking-wider mb-0.5">보고 선호사항</p>
              <p className="text-xs text-slate-600 dark:text-zinc-300">{selectedClient.reportTone}</p>
            </div>
          </div>
        )}
      </div>

      {/* 작업 내용 입력 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          완료한 작업 내용
        </label>
        <textarea
          value={workInput}
          onChange={(e) => setWorkInput(e.target.value)}
          rows={4}
          placeholder={"오늘 완료한 작업을 자유롭게 입력하세요.\n예: A사 견적서 발송 완료, B사 미팅 일정 조율, 계약서 검토 후 수정안 전달"}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
      </div>

      {/* 톤 선택 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">톤 선택</p>
        <div className="grid grid-cols-3 gap-3">
          {TONES.map((t) => {
            const active = tone === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={[
                  "flex flex-col gap-1.5 p-4 rounded-2xl border text-left transition-all",
                  active
                    ? "border-[#6C63FF] shadow-md"
                    : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                ].join(" ")}
                style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}
              >
                <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>
                  {t.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">{t.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 생성 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={loading || !workInput.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <IconSend className="w-4 h-4" />
              메시지 생성
            </>
          )}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 보고 메시지</h2>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              {copied ? (
                <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
              ) : (
                <><IconCopy className="w-3.5 h-3.5" />복사</>
              )}
            </button>
          </div>
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
