"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import {
  IconSend, IconBrandInstagram, IconCopy, IconCheck,
  IconChevronDown, IconX, IconLoader2,
} from "@tabler/icons-react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";
import { createClient } from "@/lib/supabase/client";
import { getClients } from "@/lib/db/clients";

/* ── 보고 메시지 ── */
type ToneId    = "formal" | "friendly" | "concise";
type ContentTab = "report" | "instagram";
type InstaTone  = "bright" | "emotional" | "info";

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

function buildReportSystemPrompt(tone: ToneId, customSample?: string): string {
  let prompt: string;
  if (customSample?.trim()) {
    prompt = `당신은 실무 경험이 풍부한 한국 비즈니스 보고 메시지 작성 전문가입니다.
완료한 업무 내용을 바탕으로 보고 메시지를 작성하세요.

[말투 샘플 — 아래 문체를 최대한 그대로 따라 작성하세요]
"${customSample.trim()}"

위 샘플에서 사용된 어투, 종결어미, 문장 길이, 표현 방식을 분석하여 동일한 스타일로 작성하세요.`;
  } else {
    prompt = `당신은 실무 경험이 풍부한 한국 비즈니스 보고 메시지 작성 전문가입니다.
완료한 업무 내용을 바탕으로 실제로 쓰이는 자연스러운 보고 메시지를 작성하세요.

[톤 지침]
${TONE_GUIDE[tone]}`;
  }
  prompt += `

[공통 규칙]
- 인사말("안녕하세요" 등)·맺음말("감사합니다" 등) 없이 보고 내용만 작성
- 마크다운(**, ## 등) 사용 금지
- 반드시 한국어로만 작성${customSample?.trim() ? "" : "\n- 같은 종결어미 반복 금지 — 문장마다 다른 표현 사용"}`;
  return prompt;
}

/* ── 인스타그램 ── */
interface InstaClient { id: string; name: string; tags: string[]; }

const INSTA_TONES: { id: InstaTone; label: string; desc: string }[] = [
  { id: "bright",    label: "밝고 경쾌하게", desc: "에너지 넘치고 친근한 어투" },
  { id: "emotional", label: "감성적으로",     desc: "따뜻하고 시적인 스토리텔링" },
  { id: "info",      label: "정보 전달형",    desc: "핵심 정보 강조·CTA 포함" },
];

const INSTA_TONE_GUIDE: Record<InstaTone, string> = {
  bright:    "밝고 에너지 넘치는 어투로 작성하세요. 짧고 임팩트 있는 문장, 이모지를 적극 활용하세요.",
  emotional: "따뜻하고 감성적인 어투로 작성하세요. 감동적인 스토리텔링과 시적인 표현을 사용하세요.",
  info:      "명확하고 간결한 정보 전달형으로 작성하세요. 제품·서비스 특징을 강조하고 행동 유도 문구를 포함하세요.",
};

function buildInstaSystemPrompt(tone: InstaTone, hashtags: string[]): string {
  return `당신은 SNS 마케팅 전문가입니다. 인스타그램 게시글 캡션과 해시태그를 작성해주세요.

[톤 지침]
${INSTA_TONE_GUIDE[tone]}

[형식]
- 캡션: 3~5문장, 자연스럽고 매력적으로
- 캡션 아래 빈 줄 한 줄
- 해시태그: 10~15개, # 붙여서 한 줄에 나열${hashtags.length > 0 ? `\n- 반드시 다음 키워드를 해시태그에 포함: ${hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")}` : ""}

[공통 규칙]
- 한국어로 작성
- 이모지 적극 활용
- 마크다운(**, ## 등) 사용 금지`;
}

const TONE_SAMPLE_KEY = "worky_report_tone_sample";

export default function ContentCreator() {
  const [activeTab, setActiveTab] = useState<ContentTab>("report");
  const [hydrated,  setHydrated]  = useState(false);

  /* ── 보고 메시지 상태 ── */
  const [workInput,        setWorkInput]        = useState("");
  const [tone,             setTone]             = useState<ToneId>("formal");
  const [reportResult,     setReportResult]     = useState("");
  const [reportLoading,    setReportLoading]    = useState(false);
  const [reportError,      setReportError]      = useState("");
  const [reportCopied,     setReportCopied]     = useState(false);
  const [customToneSample, setCustomToneSample] = useState("");
  const [useCustomTone,    setUseCustomTone]    = useState(false);
  const [sampleOpen,       setSampleOpen]       = useState(false);

  /* ── 인스타 상태 ── */
  const [instaClients,    setInstaClients]    = useState<InstaClient[]>([]);
  const [instaClientId,   setInstaClientId]   = useState("");
  const [instaClientOpen, setInstaClientOpen] = useState(false);
  const [instaContent,    setInstaContent]    = useState("");
  const [instaHashtags,   setInstaHashtags]   = useState<string[]>([]);
  const [instaTagInput,   setInstaTagInput]   = useState("");
  const [instaTone,       setInstaTone]       = useState<InstaTone>("bright");
  const [instaResult,     setInstaResult]     = useState("");
  const [instaLoading,    setInstaLoading]    = useState(false);
  const [instaError,      setInstaError]      = useState("");
  const [instaCopied,     setInstaCopied]     = useState(false);
  const reportResultRef = useRef<HTMLDivElement>(null);
  const instaResultRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reportResult) reportResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reportResult]);

  useEffect(() => {
    if (instaResult) instaResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [instaResult]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TONE_SAMPLE_KEY);
      if (saved) setCustomToneSample(saved);
    } catch {}

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        const clients = await getClients(uid);
        setInstaClients(clients.map((c) => ({ id: c.id, name: c.name, tags: (c.tags as string[]) ?? [] })));
      }
      setHydrated(true);
    });
  }, []);

  const handleCustomToneChange = (v: string) => {
    setCustomToneSample(v);
    localStorage.setItem(TONE_SAMPLE_KEY, v);
    if (!v.trim()) setUseCustomTone(false);
  };

  const handleInstaClientSelect = (clientId: string) => {
    setInstaClientId(clientId);
    setInstaClientOpen(false);
    setInstaTagInput("");
    if (clientId) {
      const client = instaClients.find((c) => c.id === clientId);
      setInstaHashtags(client?.tags.length ? [...client.tags] : []);
    } else {
      setInstaHashtags([]);
    }
  };

  const commitInstaTag = () => {
    const tag = instaTagInput.trim().replace(/^#/, "").replace(/,+$/, "");
    if (!tag || instaHashtags.includes(tag)) { setInstaTagInput(""); return; }
    setInstaHashtags((prev) => [...prev, tag]);
    setInstaTagInput("");
  };

  const handleReportGenerate = async () => {
    if (!workInput.trim()) return;
    setReportLoading(true); setReportError(""); setReportResult("");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: workInput.trim() }],
          systemPrompt: buildReportSystemPrompt(tone, useCustomTone ? customToneSample : undefined),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setReportResult(data.result);
      trackUsage("report");
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "메시지 생성 중 오류가 발생했습니다.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleInstaGenerate = async () => {
    if (!instaContent.trim()) return;
    setInstaLoading(true); setInstaError(""); setInstaResult("");
    const clientName = instaClients.find((c) => c.id === instaClientId)?.name;
    const userMsg = clientName
      ? `[거래처] ${clientName}\n[게시글 내용] ${instaContent.trim()}`
      : instaContent.trim();
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMsg }],
          systemPrompt: buildInstaSystemPrompt(instaTone, instaHashtags),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setInstaResult(data.result);
      trackUsage("template");
    } catch (e) {
      setInstaError(e instanceof Error ? e.message : "게시글 생성 중 오류가 발생했습니다.");
    } finally {
      setInstaLoading(false);
    }
  };

  if (!hydrated) return null;

  const selectedClientName = instaClients.find((c) => c.id === instaClientId)?.name;

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full self-start">

      {/* 탭 */}
      <div role="tablist" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-1.5 shadow-sm grid grid-cols-2 gap-1 shrink-0">
        {[
          { id: "report"    as ContentTab, label: "보고 메시지",   Icon: IconSend           },
          { id: "instagram" as ContentTab, label: "인스타 게시글", Icon: IconBrandInstagram },
        ].map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}
            className={[
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-[#6C63FF] text-white shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
            ].join(" ")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── 보고 메시지 ── */}
      {activeTab === "report" && (
        <>
          {/* 작업 내용 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              완료한 작업 내용
            </label>
            <textarea value={workInput} onChange={(e) => setWorkInput(e.target.value)} rows={4}
              placeholder={"오늘 완료한 작업을 자유롭게 입력하세요.\n예: A사 견적서 발송 완료, B사 미팅 일정 조율, 계약서 검토 후 수정안 전달"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </div>

          {/* 내 말투 샘플 */}
          <div className="rounded-2xl border border-[#6C63FF]/40 shadow-sm overflow-hidden bg-[#6C63FF]/[0.04] dark:bg-[#6C63FF]/[0.08]">
            <button type="button" onClick={() => setSampleOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">내 말투 샘플</span>
                <span className={[
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  customToneSample.trim()
                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
                ].join(" ")}>
                  {customToneSample.trim() ? "설정됨" : "미설정"}
                </span>
              </div>
              <IconChevronDown className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${sampleOpen ? "rotate-180" : ""}`} />
            </button>
            <div style={{ maxHeight: sampleOpen ? "280px" : "0px", opacity: sampleOpen ? 1 : 0 }}
              className="overflow-hidden transition-all duration-300 ease-in-out">
              <div className="px-5 pt-1 pb-5">
                <textarea value={customToneSample} onChange={(e) => handleCustomToneChange(e.target.value)} rows={3}
                  placeholder="안녕하세요 대표님, 오늘 업로드 완료됐고 노출 확인했습니다. 감사합니다!"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" disabled={!customToneSample.trim()}
                    onClick={() => setUseCustomTone((v) => !v)}
                    className={`flex items-center gap-2 ${!customToneSample.trim() ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    <span className={[
                      "w-4 h-4 rounded flex items-center justify-center border-2 transition-all shrink-0",
                      useCustomTone ? "bg-[#6C63FF] border-[#6C63FF]" : "border-slate-300 dark:border-zinc-600",
                    ].join(" ")}>
                      {useCustomTone && <IconCheck className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">사용자 설정 톤 사용</span>
                  </button>
                  {useCustomTone && <p className="text-xs text-[#6C63FF]/70">위 샘플 스타일로 생성됩니다</p>}
                </div>
              </div>
            </div>
          </div>

          {/* 톤 선택 */}
          <div style={{ maxHeight: useCustomTone ? 0 : "300px", opacity: useCustomTone ? 0 : 1 }}
            className="overflow-hidden transition-all duration-300 ease-in-out">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">톤 선택</p>
              <div className="grid grid-cols-3 gap-3">
                {TONES.map((t) => {
                  const active = tone === t.id;
                  return (
                    <button key={t.id} onClick={() => setTone(t.id)}
                      className={[
                        "flex flex-col gap-1.5 p-4 rounded-2xl border text-left transition-all",
                        active ? "border-[#6C63FF] shadow-md" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                      ].join(" ")}
                      style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}>
                      <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>{t.label}</span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 생성 버튼 */}
          <div className="flex justify-end">
            <button onClick={handleReportGenerate} disabled={reportLoading || !workInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {reportLoading ? (
                <><IconLoader2 className="w-4 h-4 animate-spin text-white" />생성 중...</>
              ) : (
                <><IconSend className="w-4 h-4" />메시지 생성</>
              )}
            </button>
          </div>

          {reportError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {reportError}
            </div>
          )}

          {reportResult ? (
            <div ref={reportResultRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 보고 메시지</h2>
                <button onClick={async () => { await navigator.clipboard.writeText(reportResult); setReportCopied(true); setTimeout(() => setReportCopied(false), 2000); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                  {reportCopied ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</> : <><IconCopy className="w-3.5 h-3.5" />복사</>}
                </button>
              </div>
              <EditableResult value={reportResult} onChange={setReportResult} rows={8}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{reportResult}</p>
              </EditableResult>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
              <IconSend className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">내용을 입력하고 생성하면 보고서가 여기에 만들어집니다.</p>
            </div>
          )}
        </>
      )}

      {/* ── 인스타 게시글 ── */}
      {activeTab === "instagram" && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">

            {/* 거래처 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">거래처 선택</label>
              <div className="relative">
                <button type="button" onClick={() => setInstaClientOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40">
                  <span className={instaClientId ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"}>
                    {selectedClientName ?? "직접 입력 (거래처 없음)"}
                  </span>
                  <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${instaClientOpen ? "rotate-180" : ""}`} />
                </button>
                {instaClientOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 w-full bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    <button type="button" onClick={() => handleInstaClientSelect("")}
                      className={`w-full px-3 py-2.5 text-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 ${!instaClientId ? "text-[#6C63FF] font-medium" : "text-slate-600 dark:text-zinc-300"}`}>
                      직접 입력 (거래처 없음)
                    </button>
                    {instaClients.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-400 dark:text-zinc-500">등록된 거래처가 없습니다</div>
                    ) : (
                      instaClients.map((c) => (
                        <button key={c.id} type="button" onClick={() => handleInstaClientSelect(c.id)}
                          className={`w-full px-3 py-2.5 text-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 ${instaClientId === c.id ? "text-[#6C63FF] font-medium" : "text-slate-700 dark:text-zinc-200"}`}>
                          {c.name}
                          {c.tags.length > 0 && (
                            <span className="ml-2 text-xs text-slate-400 dark:text-zinc-500">
                              #{c.tags.slice(0, 3).join(" #")}{c.tags.length > 3 ? " ..." : ""}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 게시글 내용 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">게시글 내용</label>
              <textarea value={instaContent} onChange={(e) => setInstaContent(e.target.value)} rows={3}
                placeholder="예: 봄 신메뉴 출시, 아메리카노 할인 이벤트"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 해시태그 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">키워드 / 해시태그</label>
              {instaHashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {instaHashtags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#6C63FF]/10 text-[#6C63FF]">
                      #{tag}
                      <button type="button" onClick={() => setInstaHashtags((prev) => prev.filter((t) => t !== tag))}>
                        <IconX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input value={instaTagInput}
                onChange={(e) => setInstaTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitInstaTag(); } }}
                onBlur={commitInstaTag}
                placeholder={instaClientId && instaHashtags.length === 0 ? "등록된 키워드가 없습니다. 직접 입력해주세요" : "키워드 입력 후 Enter (예: 카페, 신메뉴)"}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>
          </div>

          {/* 톤 선택 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">톤 선택</p>
            <div className="grid grid-cols-3 gap-3">
              {INSTA_TONES.map((t) => {
                const active = instaTone === t.id;
                return (
                  <button key={t.id} onClick={() => setInstaTone(t.id)}
                    className={[
                      "flex flex-col gap-1.5 p-4 rounded-2xl border text-left transition-all",
                      active ? "border-[#6C63FF] shadow-md" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                    ].join(" ")}
                    style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}>
                    <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>{t.label}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 생성 버튼 */}
          <div className="flex justify-end">
            <button onClick={handleInstaGenerate} disabled={instaLoading || !instaContent.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {instaLoading ? (
                <><IconLoader2 className="w-4 h-4 animate-spin text-white" />생성 중...</>
              ) : (
                <><IconBrandInstagram className="w-4 h-4" />게시글 생성</>
              )}
            </button>
          </div>

          {instaError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {instaError}
            </div>
          )}

          {instaResult ? (
            <div ref={instaResultRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 인스타 게시글</h2>
                <button onClick={async () => { await navigator.clipboard.writeText(instaResult); setInstaCopied(true); setTimeout(() => setInstaCopied(false), 2000); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                  {instaCopied ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</> : <><IconCopy className="w-3.5 h-3.5" />복사</>}
                </button>
              </div>
              <EditableResult value={instaResult} onChange={setInstaResult} rows={10}>
                <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{instaResult}</p>
              </EditableResult>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
              <IconBrandInstagram className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-400 dark:text-zinc-500">거래처를 선택하고 생성하면 인스타그램 게시물 초안이 여기에 만들어집니다.</p>
            </div>
          )}
        </>
      )}
      <HelpButton
        title="메시지 작성 사용법"
        steps={[
          { step: "탭 선택", desc: "보고 메시지 또는 인스타 게시글 탭을 선택하세요." },
          { step: "내용 입력", desc: "작업 내용 또는 게시글 주제를 입력합니다." },
          { step: "톤 설정", desc: "원하는 어투와 분위기를 선택합니다." },
          { step: "생성", desc: "버튼 클릭으로 생성 후 클릭하여 직접 편집도 가능합니다." },
        ]}
      />
    </div>
  );
}
