"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  IconTie,
  IconBolt,
  IconBan,
  IconHeartHandshake,
  IconHeart,
  IconSettings,
  IconMailForward,
  IconMailPlus,
  IconLoader2,
} from "@tabler/icons-react";

type Tone = "정중하게" | "간결하게" | "거절하기" | "사과하기" | "감사하기";
type TabType = "new" | "reply";

interface SenderInfo {
  org:   string;
  name:  string;
  title: string;
}

const SENDER_KEY = "worky_sender_info";

const TONES: { id: Tone; Icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "정중하게", Icon: IconTie,            desc: "격식 있고 공손한 톤" },
  { id: "간결하게", Icon: IconBolt,           desc: "짧고 핵심만 전달" },
  { id: "거절하기", Icon: IconBan,            desc: "정중히 거절하는 톤" },
  { id: "사과하기", Icon: IconHeartHandshake, desc: "진심 어린 사과 표현" },
  { id: "감사하기", Icon: IconHeart,          desc: "감사함을 전하는 톤" },
];

const KO_RULES = `
You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, Greek, or any other language mixed in. Use pure, natural modern Korean only.
공통 규칙 (반드시 준수):
- 반드시 순수 한국어로만 작성
- 한자, 영어, 일본어 등 모든 외국어 혼용 절대 금지
- 자연스러운 현대 한국어 비즈니스 문체 사용`;

function buildNewEmailSystemPrompt(sender: SenderInfo): string {
  const hasSender = sender.org || sender.name || sender.title;
  const senderLine = hasSender
    ? [sender.org, sender.name, sender.title].filter(Boolean).join(" ")
    : null;
  const senderIntro = senderLine ? `${senderLine}입니다.` : null;
  const senderInfo = senderLine ? `발신자 정보: ${senderLine}\n` : "";

  const introLine = senderIntro
    ? `안녕하세요. {받는 사람 이름이 있으면 "○○님," 으로 시작, 없으면 생략}
${senderIntro}`
    : `안녕하세요. {받는 사람 이름이 있으면 "○○님," 으로 시작, 없으면 생략}`;

  return `당신은 비즈니스 이메일 전문가입니다. 사용자가 제공한 내용으로 격식 있는 비즈니스 이메일 본문을 작성해주세요.
${senderInfo}
반드시 아래 형식을 정확히 따르세요. "인사말:", "본문:", "마무리 인사:", "서명란:" 같은 라벨이나 구분자는 절대 쓰지 마세요.

${introLine}

(본문 내용 — 목적, 세부 내용, 요청/안내 순서로 자연스럽게 작성)

감사합니다.

[중요]
- 첫 줄은 반드시 "안녕하세요."로 시작하세요.
- 받는 사람 이름을 제목이나 내용에서 파악할 수 있으면 "안녕하세요. ○○님," 형식으로, 없으면 "안녕하세요." 만 쓰세요.
- 발신자 정보가 있으면 인사말 바로 다음 줄에 "${senderIntro ?? ""}" 를 넣으세요. 없으면 생략하세요.
- 마지막 줄은 반드시 "감사합니다."로만 끝내세요. 그 이후 이름, 소속, 직급 등 절대 추가 금지.${KO_RULES}`;
}

function buildReplySystemPrompt(sender: SenderInfo): string {
  const hasSender = sender.org || sender.name || sender.title;
  const senderLine = hasSender
    ? [sender.org, sender.name, sender.title].filter(Boolean).join(" ")
    : "[소속] [이름] [직급]";
  const senderInfo = hasSender ? `발신자 정보: ${senderLine}\n` : "";

  return `당신은 비즈니스 이메일 작성 전문가입니다.
사용자가 받은 이메일 내용과 원하는 답장 톤을 제공하면, 해당 톤에 맞는 한국어 답장 초안 3가지를 작성하세요.
${senderInfo}
각 초안은 반드시 아래 구조를 정확히 따르세요. 날짜는 절대 임의로 만들지 마세요.

안녕하세요.
${senderLine}입니다.

(본문 내용 — 톤에 맞게 작성, 150자 내외)

감사합니다.

[중요] 마지막 줄은 반드시 "감사합니다."로만 끝내세요.
"감사합니다." 이후 이름, 소속, 직급, 서명 등 어떤 텍스트도 절대 추가하지 마세요.
"[회사명]", "[이름]", "[직함]", "[담당자]" 같은 플레이스홀더도 절대 사용 금지.

응답은 반드시 아래 구분자 형식으로만 작성하세요. JSON, 마크다운, 설명 텍스트는 절대 포함하지 마세요.

[초안 1]
(첫 번째 이메일 전체)

[초안 2]
(두 번째 이메일 전체)

[초안 3]
(세 번째 이메일 전체)`;
}

function parseDrafts(raw: string): string[] {
  const sections = raw.split(/\[초안\s*\d+\]/);
  const drafts = sections.map((s) => s.trim()).filter((s) => s.length > 10);
  if (drafts.length >= 2) return drafts.slice(0, 3);

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0)
        return parsed.drafts.slice(0, 3);
    }
  } catch {}

  const trimmed = raw.trim();
  if (trimmed.length > 0) return [trimmed];
  return [];
}

export default function EmailReply() {
  const [activeTab, setActiveTab]   = useState<TabType>("new");
  const [sender, setSender]         = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [hydrated, setHydrated]     = useState(false);

  // 새 이메일 작성 상태
  const [newTo, setNewTo]           = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newResult, setNewResult]   = useState("");
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError]     = useState("");
  const [newCopied, setNewCopied]   = useState(false);
  const newResultRef = useRef<HTMLDivElement>(null);

  // 답장 작성 상태
  const [emailInput, setEmailInput]     = useState("");
  const [selectedTone, setSelectedTone] = useState<Tone>("정중하게");
  const [drafts, setDrafts]             = useState<string[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError]     = useState("");
  const [copiedIndex, setCopiedIndex]   = useState<number | null>(null);
  const replyResultRef = useRef<HTMLDivElement>(null);

  // 전송 모달
  const [sendModal, setSendModal]     = useState<{ to: string; subject: string; body: string } | null>(null);
  const [sendTo, setSendTo]           = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sending, setSending]         = useState(false);

  // 토스트
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (newResult) newResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [newResult]);

  useEffect(() => {
    if (drafts.length > 0) replyResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drafts]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDER_KEY);
      if (raw) setSender(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  const handleNewGenerate = async () => {
    if (!newContent.trim()) return;
    setNewLoading(true); setNewError(""); setNewResult("");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `이메일 목적: ${newSubject || "업무 연락"}\n내용: ${newContent}` }],
          systemPrompt: buildNewEmailSystemPrompt(sender),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setNewResult(data.result);
      trackUsage("email");
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "이메일 생성 중 오류가 발생했습니다.");
    } finally {
      setNewLoading(false);
    }
  };

  const handleReplyGenerate = async () => {
    if (!emailInput.trim()) return;
    setReplyLoading(true); setReplyError(""); setDrafts([]);
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `받은 이메일:\n${emailInput}\n\n답장 톤: ${selectedTone}` }],
          systemPrompt: buildReplySystemPrompt(sender),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      const parsed = parseDrafts(data.result);
      if (parsed.length === 0) throw new Error("AI 응답이 비어 있습니다. 다시 시도해주세요.");
      setDrafts(parsed);
      trackUsage("email");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "이메일 생성 중 오류가 발생했습니다.");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCopy = async (text: string, index?: number) => {
    await navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setNewCopied(true);
      setTimeout(() => setNewCopied(false), 2000);
    }
  };

  const openSendModal = (to: string, subject: string, body: string) => {
    setSendModal({ to, subject, body });
    setSendTo(to);
    setSendSubject(subject);
  };

  const handleSend = async () => {
    if (!sendModal || !sendTo.trim() || !sendSubject.trim()) return;
    setSending(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.provider_token;
      if (!accessToken) {
        setSendModal(null);
        showToast(false, "Gmail 권한이 없습니다. 다시 로그인해 주세요.");
        return;
      }
      const res = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo.trim(),
          subject: sendSubject.trim(),
          body: sendModal.body,
          accessToken,
        }),
      });
      const data = await res.json();
      setSendModal(null);
      if (res.ok) {
        showToast(true, "이메일이 성공적으로 전송되었습니다.");
      } else {
        showToast(false, data.error ?? "전송 실패");
      }
    } catch {
      setSendModal(null);
      showToast(false, "전송 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return null;

  const hasSender = sender.org || sender.name || sender.title;

  return (
    <div className="flex flex-col gap-3 max-w-5xl mx-auto w-full flex-1 min-h-0">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.ok ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* 탭 */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1 shrink-0">
        {([
          { id: "new",   label: "새 이메일 작성", Icon: IconMailPlus },
          { id: "reply", label: "답장 작성",       Icon: IconMailForward },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 발신자 정보 없을 때 안내 */}
      {!hasSender && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm shrink-0">
          <span>이메일 서명에 사용할 내 정보가 없습니다.</span>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shrink-0"
          >
            <IconSettings className="w-3.5 h-3.5" />
            설정에서 입력
          </Link>
        </div>
      )}

      {/* ── 새 이메일 작성 탭 ── */}
      {activeTab === "new" && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm shrink-0 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">받는 사람 (이메일)</label>
              <input
                type="email"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">제목</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="이메일 제목"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">이메일 내용</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={"예: 다음 주 화요일 오후 2시 프로젝트 킥오프 미팅 일정 조율 요청. 참석자는 개발팀과 기획팀."}
                rows={4}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
              <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
                * 보낼 내용을 자유롭게 작성하면 AI가 맞춤법·표현을 다듬어 완성도 높은 이메일로 생성합니다.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleNewGenerate}
                disabled={newLoading || !newContent.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {newLoading ? (
                  <><IconLoader2 className="w-4 h-4 animate-spin text-white" />생성 중...</>
                ) : (
                  <><IconMailPlus className="w-4 h-4" />이메일 생성</>
                )}
              </button>
            </div>
          </div>

          {newError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {newError}
            </div>
          )}

          {newResult ? (
            <div ref={newResultRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 이메일</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openSendModal(newTo, newSubject, newResult)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#6C63FF]/40 text-[#6C63FF] hover:bg-[#6C63FF]/5 dark:hover:bg-[#6C63FF]/10 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    전송
                  </button>
                  <button
                    onClick={() => handleCopy(newResult)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {newCopied ? "복사됨!" : "복사"}
                  </button>
                </div>
              </div>
              <EditableResult value={newResult} onChange={setNewResult} rows={12}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {newResult}
                </p>
              </EditableResult>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
              <IconMailPlus className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">이메일 내용을 입력하면 답장 초안이 여기에 생성됩니다.</p>
            </div>
          )}
        </>
      )}

      {/* ── 답장 작성 탭 ── */}
      {activeTab === "reply" && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm shrink-0">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              받은 이메일 내용
            </label>
            <textarea
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={"안녕하세요,\n다음 주 회의 일정을 변경할 수 있을지 문의드립니다..."}
              className="w-full h-52 px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm shrink-0">
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">답장 톤 선택</p>
            <div className="grid grid-cols-5 gap-2">
              {TONES.map((tone) => {
                const isActive = selectedTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    onClick={() => setSelectedTone(tone.id)}
                    className={[
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all",
                      isActive
                        ? "text-white border-transparent shadow-md"
                        : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40 hover:bg-slate-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                    style={isActive ? { background: "linear-gradient(135deg, #6C63FF, #8B85FF)" } : undefined}
                  >
                    <tone.Icon className="w-5 h-5" />
                    <span>{tone.id}</span>
                    <span className={`text-xs ${isActive ? "text-white/70" : "text-slate-400 dark:text-zinc-500"}`}>
                      {tone.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleReplyGenerate}
                disabled={replyLoading || !emailInput.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {replyLoading ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin text-white" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    답장 초안 생성
                  </>
                )}
              </button>
            </div>
          </div>

          {replyError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {replyError}
            </div>
          )}

          {drafts.length > 0 && (
            <div ref={replyResultRef} className="grid gap-3 lg:grid-cols-3">
              {drafts.map((draft, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                      초안 {i + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openSendModal("", "", draft)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#6C63FF]/40 text-[#6C63FF] hover:bg-[#6C63FF]/5 dark:hover:bg-[#6C63FF]/10 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        전송
                      </button>
                      <button
                        onClick={() => handleCopy(draft, i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {copiedIndex === i ? "복사됨!" : "복사"}
                      </button>
                    </div>
                  </div>
                  <EditableResult
                    value={draft}
                    onChange={(v) => setDrafts((prev) => prev.map((d, j) => j === i ? v : d))}
                    rows={10}
                  >
                    <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed flex-1">
                      {draft}
                    </p>
                  </EditableResult>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 이메일 전송 모달 */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">이메일 전송</h3>
              <button
                onClick={() => setSendModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">받는 사람 (이메일)</label>
                <input
                  type="email"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">제목</label>
                <input
                  type="text"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  placeholder="이메일 제목"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1.5">이메일 내용</label>
                <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {sendModal.body}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSendModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !sendTo.trim() || !sendSubject.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                {sending ? (
                  <>
                    <IconLoader2 className="w-4 h-4 animate-spin text-white" />
                    전송 중...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    전송
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <HelpButton
        title="이메일 작성 사용법"
        steps={[
          { step: "탭 선택", desc: "새 이메일 작성 또는 답장 작성 탭을 선택합니다." },
          { step: "내용 입력", desc: "보낼 이메일 내용이나 받은 이메일을 입력합니다." },
          { step: "생성", desc: "AI가 이메일 초안을 작성합니다." },
          { step: "전송", desc: "'전송' 버튼으로 Gmail을 통해 직접 발송하거나 복사해 사용하세요." },
        ]}
      />
    </div>
  );
}
