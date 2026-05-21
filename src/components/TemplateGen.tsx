"use client";

import { useState, useEffect } from "react";
import { trackUsage } from "@/lib/usageStats";
import Link from "next/link";
import {
  IconReport, IconMail, IconNotes, IconBulb, IconSettings, IconAlertTriangle,
  IconBrandInstagram, IconX, IconCopy, IconCheck, IconChevronDown, IconFileCertificate,
} from "@tabler/icons-react";

const SENDER_KEY   = "worky_sender_info";
const CLIENTS_KEY  = "worky_clients";

interface SenderInfo { org: string; name: string; title: string; }
interface InstaClient { id: string; name: string; tags: string[]; }

type TemplateType    = "report" | "email" | "meeting" | "plan" | "instagram" | "official";
type InstaTone       = "bright" | "emotional" | "info";
type OfficialDocType = "approval" | "official_doc" | "expense" | "cooperation";

interface TemplateOption {
  id: TemplateType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  systemPrompt: string;
}

const KO_RULES = `
You must respond ONLY in Korean (한국어). Do not use any Chinese characters (한자), Japanese, Russian, Greek, or any other language mixed in. Use pure, natural modern Korean only.
공통 규칙 (반드시 준수):
- 반드시 순수 한국어로만 작성
- 한자, 영어, 일본어, 러시아어 등 모든 외국어 혼용 절대 금지
- 고유명사나 브랜드명은 한국어 표기 사용
- 자연스러운 현대 한국어 비즈니스 문체 사용
- 제목은 사용자가 입력한 내용 기반으로 작성하고 임의로 변경 금지
- 날짜는 임의로 만들지 말고, 필요 시 오늘 날짜 기준으로 작성
- 불필요하게 내용을 늘리거나 과도하게 길게 작성 금지`;

const TEMPLATES: TemplateOption[] = [
  {
    id: "report",
    label: "업무 보고서",
    Icon: IconReport,
    placeholder: "예: 이번 주 마케팅 캠페인 성과 보고. 클릭율 15% 향상, 전환율 8% 향상, 예산 초과 없음.",
    systemPrompt: `당신은 전문 비즈니스 문서 작성가입니다. 사용자가 제공한 내용을 바탕으로 체계적인 업무 보고서를 작성해주세요.
보고서에는 반드시 포함해야 할 항목: 제목, 작성일, 보고 목적, 주요 내용 (번호 목록), 결과 및 성과, 향후 계획, 특이사항.
전문적이고 간결하게 작성하세요.${KO_RULES}`,
  },
  {
    id: "email",
    label: "이메일",
    Icon: IconMail,
    placeholder: "예: 신규 프로젝트 킥오프 미팅 일정 조율. 다음 주 화요일이나 목요일 오후 2시~4시 가능.",
    systemPrompt: `당신은 비즈니스 이메일 전문가입니다. 사용자가 제공한 내용으로 격식 있는 비즈니스 이메일 본문을 작성해주세요.
반드시 아래 형식을 정확히 따르세요. "인사말:", "본문:", "마무리 인사:", "서명란:" 같은 라벨이나 구분자는 절대 쓰지 마세요.

안녕하세요.
[발신자]입니다.

(본문 내용 — 목적, 세부 내용, 요청/안내 순서로 작성)

감사합니다.

마지막 줄은 반드시 "감사합니다."로만 끝내세요. 그 이후 이름, 소속, 직급 등 아무것도 추가하지 마세요.${KO_RULES}`,
  },
  {
    id: "meeting",
    label: "회의록",
    Icon: IconNotes,
    placeholder: "예: 2024 Q1 마케팅 전략 회의. 참석자: 마케팅팀 5명. 주요 안건: 신규 채널 발굴, 예산 배분.",
    systemPrompt: `당신은 회의록 작성 전문가입니다. 사용자가 제공한 내용으로 공식 회의록을 작성해주세요.
회의록 구조: 회의명, 일시/장소, 참석자, 안건 목록, 논의 내용 (각 안건별), 결정 사항, 액션 아이템 (담당자/기한 포함), 차기 회의 예정.
명확하고 구조적으로 작성하세요.${KO_RULES}`,
  },
  {
    id: "plan",
    label: "기획안",
    Icon: IconBulb,
    placeholder: "예: 사내 온보딩 프로그램 개선 기획. 현재 2주 과정을 1달로 확대, 멘토링 시스템 도입.",
    systemPrompt: `당신은 기획안 작성 전문가입니다. 사용자가 제공한 아이디어를 바탕으로 체계적인 기획안을 작성해주세요.
기획안 구조: 제목, 기획 배경 및 목적, 현황 분석, 기획 내용 (세부 계획), 기대 효과, 일정 계획, 예산 계획 (개략), 리스크 및 대응 방안.
설득력 있고 전문적으로 작성하세요.${KO_RULES}`,
  },
];

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

/* ── 공문서 설정 ── */
interface OfficialField { key: string; label: string; placeholder: string; optional?: boolean; }
interface OfficialDoc   { id: OfficialDocType; label: string; desc: string; fields: OfficialField[]; systemPrompt: string; }

const OFFICIAL_DOCS: OfficialDoc[] = [
  {
    id: "approval", label: "품의서", desc: "내부 결재 요청",
    fields: [
      { key: "dept",    label: "요청 부서",  placeholder: "예: 마케팅팀" },
      { key: "content", label: "요청 내용",  placeholder: "예: 외부 강사 초빙 비용 집행 요청" },
      { key: "amount",  label: "금액",        placeholder: "예: 500,000원", optional: true },
      { key: "reason",  label: "사유",        placeholder: "예: 팀 역량 강화를 위한 교육 프로그램 진행" },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 내부 결재용 품의서를 작성해주세요.
형식: 제목(○○ 품의서), 작성일, 요청 부서, 요청 내용, 금액(있는 경우만), 사유, 기대 효과(간략히).
격식 있는 공문서 문체로 작성하세요.${KO_RULES}`,
  },
  {
    id: "official_doc", label: "공문", desc: "대외/대내 공식 문서",
    fields: [
      { key: "sender",   label: "발신 기관/부서", placeholder: "예: (주)워키 마케팅팀" },
      { key: "receiver", label: "수신 기관/부서", placeholder: "예: ○○구청 문화체육과" },
      { key: "title",    label: "제목",            placeholder: "예: 업무 협약 체결 요청" },
      { key: "content",  label: "주요 내용",       placeholder: "예: 양 기관 간 마케팅 협력을 위한 MOU 체결 요청" },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 공식 공문을 작성해주세요.
형식: 수신, 발신, 제목, 본문(목적·내용·요청사항 순), 끝.
표준 공문 형식을 정확히 따르고 격식체로 작성하세요.${KO_RULES}`,
  },
  {
    id: "expense", label: "지출결의서", desc: "비용 집행 승인 요청",
    fields: [
      { key: "item",    label: "지출 항목",  placeholder: "예: 외부 교육비" },
      { key: "amount",  label: "금액",        placeholder: "예: 300,000원" },
      { key: "purpose", label: "사용 목적",  placeholder: "예: 신입사원 역량 강화 교육 수강" },
      { key: "date",    label: "사용 날짜",  placeholder: "예: 2026-05-20" },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 지출결의서를 작성해주세요.
형식: 제목(지출결의서), 작성일, 지출 항목, 금액, 사용 목적, 사용 날짜, 결재 요청 내용.
격식 있는 공문서 문체로 간결하게 작성하세요.${KO_RULES}`,
  },
  {
    id: "cooperation", label: "업무협조 요청서", desc: "타 부서 협조 요청",
    fields: [
      { key: "dept",     label: "요청 부서",  placeholder: "예: IT팀" },
      { key: "content",  label: "협조 내용",  placeholder: "예: 신규 서비스 서버 환경 세팅 지원" },
      { key: "deadline", label: "기한",        placeholder: "예: 2026년 6월 15일까지" },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 업무협조 요청서를 작성해주세요.
형식: 제목(업무협조 요청), 작성일, 요청 부서, 협조 요청 내용, 기한, 협조 요청 사유.
격식 있는 공문서 문체로 작성하세요.${KO_RULES}`,
  },
];

export default function TemplateGen() {
  /* ── 공통 상태 ── */
  const [selectedType, setSelectedType] = useState<TemplateType>("report");
  const [content,      setContent]      = useState("");
  const [result,       setResult]       = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [copied,       setCopied]       = useState(false);
  const [sender,       setSender]       = useState<SenderInfo>({ org: "", name: "", title: "" });
  const [pendingTab,   setPendingTab]   = useState<TemplateType | null>(null);

  /* ── 공문서 전용 상태 ── */
  const [officialDocType,  setOfficialDocType]  = useState<OfficialDocType>("approval");
  const [officialFields,   setOfficialFields]   = useState<Record<string, string>>({});
  const [officialResult,   setOfficialResult]   = useState("");
  const [officialLoading,  setOfficialLoading]  = useState(false);
  const [officialError,    setOfficialError]    = useState("");
  const [officialCopied,   setOfficialCopied]   = useState(false);

  /* ── 인스타 전용 상태 ── */
  const [instaClients,      setInstaClients]      = useState<InstaClient[]>([]);
  const [instaClientId,     setInstaClientId]     = useState("");
  const [instaClientOpen,   setInstaClientOpen]   = useState(false);
  const [instaContent,      setInstaContent]      = useState("");
  const [instaHashtags,     setInstaHashtags]     = useState<string[]>([]);
  const [instaTagInput,     setInstaTagInput]     = useState("");
  const [instaTone,         setInstaTone]         = useState<InstaTone>("bright");
  const [instaResult,       setInstaResult]       = useState("");
  const [instaLoading,      setInstaLoading]      = useState(false);
  const [instaError,        setInstaError]        = useState("");
  const [instaCopied,       setInstaCopied]       = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SENDER_KEY);
      if (raw) setSender(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem(CLIENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; name: string; tags?: string[] }[];
        setInstaClients(parsed.map((c) => ({ id: c.id, name: c.name, tags: c.tags ?? [] })));
      }
    } catch {}
  }, []);

  /* 거래처 선택 시 태그 자동 로드 */
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

  /* 인스타 해시태그 입력 */
  const commitInstaTag = () => {
    const tag = instaTagInput.trim().replace(/^#/, "").replace(/,+$/, "");
    if (!tag || instaHashtags.includes(tag)) { setInstaTagInput(""); return; }
    setInstaHashtags((prev) => [...prev, tag]);
    setInstaTagInput("");
  };

  /* ── 기존 템플릿 로직 ── */
  const selectedTemplate    = TEMPLATES.find((t) => t.id === selectedType);
  const SelectedTemplateIcon = selectedTemplate?.Icon;

  const buildPrompt = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    const dateNote = `\n오늘 날짜: ${todayStr}. 날짜가 필요한 경우 반드시 이 날짜를 사용하고, 임의로 다른 날짜를 만들지 마세요.`;

    const hasSender = sender.org || sender.name || sender.title;
    const senderLine = hasSender ? [sender.org, sender.name, sender.title].filter(Boolean).join(" ") : null;

    if (selectedType === "email") {
      const intro = senderLine ? `${senderLine}입니다.` : "담당자입니다.";
      return selectedTemplate!.systemPrompt +
        dateNote +
        `\n[발신자] 자리에는 "${intro}"을 그대로 사용하세요.` +
        `\n마지막 줄은 반드시 "감사합니다."로만 끝내세요. 그 이후 이름, 소속, 직급 등 절대 추가 금지.`;
    }
    return selectedTemplate!.systemPrompt + dateNote;
  };

  const hasUnsaved = () => {
    if (selectedType === "instagram") return !!(instaContent.trim() || instaResult);
    if (selectedType === "official")  return !!(Object.values(officialFields).some((v) => v.trim()) || officialResult);
    return !!(content.trim() || result);
  };

  const handleTabChange = (type: TemplateType) => {
    if (type === selectedType) return;
    if (hasUnsaved()) {
      setPendingTab(type);
    } else {
      applyTabChange(type);
    }
  };

  const applyTabChange = (type: TemplateType) => {
    setSelectedType(type);
    setContent(""); setResult(""); setError("");
    setInstaContent(""); setInstaResult(""); setInstaError("");
    setInstaClientId(""); setInstaHashtags([]); setInstaTagInput("");
    setOfficialFields({}); setOfficialResult(""); setOfficialError("");
  };

  const confirmTabChange = () => {
    if (!pendingTab) return;
    applyTabChange(pendingTab);
    setPendingTab(null);
  };

  const handleGenerate = async () => {
    if (!content.trim()) return;
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content }], systemPrompt: buildPrompt() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
      trackUsage("template");
    } catch (e) {
      setError(e instanceof Error ? e.message : "문서 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleInstaCopy = async () => {
    await navigator.clipboard.writeText(instaResult);
    setInstaCopied(true); setTimeout(() => setInstaCopied(false), 2000);
  };

  const handleOfficialGenerate = async () => {
    const doc = OFFICIAL_DOCS.find((d) => d.id === officialDocType)!;
    const requiredEmpty = doc.fields.filter((f) => !f.optional).some((f) => !officialFields[f.key]?.trim());
    if (requiredEmpty) return;
    setOfficialLoading(true); setOfficialError(""); setOfficialResult("");
    const now = new Date();
    const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    const userMsg = [
      `오늘 날짜: ${todayStr}`,
      ...doc.fields.map((f) => `${f.label}: ${officialFields[f.key]?.trim() ?? "(없음)"}`),
    ].join("\n");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: userMsg }], systemPrompt: doc.systemPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setOfficialResult(data.result);
      trackUsage("template");
    } catch (e) {
      setOfficialError(e instanceof Error ? e.message : "문서 생성 중 오류가 발생했습니다.");
    } finally {
      setOfficialLoading(false);
    }
  };

  const handleOfficialCopy = async () => {
    await navigator.clipboard.writeText(officialResult);
    setOfficialCopied(true); setTimeout(() => setOfficialCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `worky_${selectedType}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const hasSender = sender.org || sender.name || sender.title;
  const selectedClientName = instaClients.find((c) => c.id === instaClientId)?.name;

  const ALL_TABS = [
    ...TEMPLATES.map((t) => ({ id: t.id as TemplateType, label: t.label, Icon: t.Icon })),
    { id: "instagram" as TemplateType, label: "인스타 게시글", Icon: IconBrandInstagram },
    { id: "official"  as TemplateType, label: "공문서",         Icon: IconFileCertificate },
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full self-start">

      {/* 탭 이동 확인 모달 */}
      {pendingTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
                <IconAlertTriangle className="w-5 h-5 text-[#6C63FF]" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-100">탭 이동 확인</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
              작성 중인 내용이 있습니다. 탭을 이동하면 내용이 삭제됩니다. 이동하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingTab(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                취소
              </button>
              <button onClick={confirmTabChange}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                이동하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이메일 탭 선택 시 발신자 없으면 안내 */}
      {selectedType === "email" && !hasSender && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          <span>이메일 서명에 사용할 내 정보가 없습니다.</span>
          <Link href="/settings"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shrink-0">
            <IconSettings className="w-3.5 h-3.5" />
            설정에서 입력
          </Link>
        </div>
      )}

      {/* 탭 선택 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_TABS.map((tab) => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            className={[
              "flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all",
              selectedType === tab.id
                ? "border-[#6C63FF] shadow-md"
                : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
            ].join(" ")}
            style={selectedType === tab.id
              ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" }
              : undefined}
          >
            <tab.Icon className={`w-6 h-6 ${selectedType === tab.id ? "text-[#6C63FF]" : "text-slate-500 dark:text-zinc-400"}`} />
            <span className={`text-sm font-semibold ${selectedType === tab.id ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── 인스타 게시글 UI ── */}
      {selectedType === "instagram" ? (
        <>
          {/* 거래처 + 내용 입력 카드 */}
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
              <textarea value={instaContent} onChange={(e) => setInstaContent(e.target.value)}
                rows={3}
                placeholder="예: 봄 신메뉴 출시, 아메리카노 할인 이벤트"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
              />
            </div>

            {/* 키워드/해시태그 */}
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
                placeholder={
                  instaClientId && instaHashtags.length === 0
                    ? "등록된 키워드가 없습니다. 직접 입력해주세요"
                    : "키워드 입력 후 Enter (예: 카페, 신메뉴)"
                }
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
                      active
                        ? "border-[#6C63FF] shadow-md"
                        : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                    ].join(" ")}
                    style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}
                  >
                    <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>{t.label}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 생성 버튼 */}
          <div className="flex justify-end">
            <button onClick={handleInstaGenerate}
              disabled={instaLoading || !instaContent.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
              {instaLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</>
              ) : (
                <><IconBrandInstagram className="w-4 h-4" />게시글 생성</>
              )}
            </button>
          </div>

          {/* 인스타 에러 */}
          {instaError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {instaError}
            </div>
          )}

          {/* 인스타 결과 */}
          {instaResult && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 인스타 게시글</h2>
                <button onClick={handleInstaCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                  {instaCopied
                    ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                    : <><IconCopy className="w-3.5 h-3.5" />복사</>}
                </button>
              </div>
              <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {instaResult}
              </p>
            </div>
          )}
        </>

      ) : selectedType === "official" ? (
        /* ── 공문서 UI ── */
        <>
          {/* 문서 유형 선택 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OFFICIAL_DOCS.map((doc) => {
              const active = officialDocType === doc.id;
              return (
                <button key={doc.id} onClick={() => { setOfficialDocType(doc.id); setOfficialFields({}); setOfficialResult(""); setOfficialError(""); }}
                  className={[
                    "flex flex-col gap-1 p-4 rounded-2xl border text-left transition-all",
                    active ? "border-[#6C63FF] shadow-md" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
                  ].join(" ")}
                  style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}
                >
                  <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>{doc.label}</span>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">{doc.desc}</span>
                </button>
              );
            })}
          </div>

          {/* 입력 필드 카드 */}
          {(() => {
            const doc = OFFICIAL_DOCS.find((d) => d.id === officialDocType)!;
            const requiredEmpty = doc.fields.filter((f) => !f.optional).some((f) => !officialFields[f.key]?.trim());
            return (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{doc.label} 정보 입력</p>
                {doc.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                      {field.label}{field.optional && <span className="ml-1 text-slate-400">(선택)</span>}
                      {!field.optional && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <input
                      value={officialFields[field.key] ?? ""}
                      onChange={(e) => setOfficialFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                    />
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <button onClick={handleOfficialGenerate} disabled={officialLoading || requiredEmpty}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                    {officialLoading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</>
                      : <><IconFileCertificate className="w-4 h-4" />{doc.label} 생성</>}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 에러 */}
          {officialError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {officialError}
            </div>
          )}

          {/* 결과 */}
          {officialResult && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                  생성된 {OFFICIAL_DOCS.find((d) => d.id === officialDocType)!.label}
                </h2>
                <button onClick={handleOfficialCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                  {officialCopied
                    ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                    : <><IconCopy className="w-3.5 h-3.5" />복사</>}
                </button>
              </div>
              <textarea readOnly value={officialResult} rows={16}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 resize-none focus:outline-none font-mono leading-relaxed"
              />
            </div>
          )}
        </>

      ) : (
        /* ── 기존 템플릿 UI ── */
        <>
          {/* 입력 카드 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              {selectedTemplate!.label} 내용 입력
            </label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={selectedTemplate!.placeholder} rows={5}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            <div className="flex justify-end mt-3">
              <button onClick={handleGenerate} disabled={loading || !content.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</>
                ) : (
                  <>{SelectedTemplateIcon && <SelectedTemplateIcon className="w-4 h-4" />}{selectedTemplate!.label} 생성</>
                )}
              </button>
            </div>
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
                <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                  생성된 {selectedTemplate!.label}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copied ? "복사됨!" : "복사"}
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                    style={{ background: "var(--primary)" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    다운로드
                  </button>
                </div>
              </div>
              <textarea readOnly value={result} rows={16}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 resize-none focus:outline-none font-mono leading-relaxed"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
