"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import {
  IconFileCertificate, IconCopy, IconCheck, IconLoader2,
} from "@tabler/icons-react";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";

type OfficialDocType = "approval" | "official_doc" | "expense" | "cooperation";

interface OfficialField { key: string; label: string; placeholder: string; optional?: boolean; }
interface OfficialDoc   { id: OfficialDocType; label: string; desc: string; fields: OfficialField[]; systemPrompt: string; }

const KO_RULES = `
공통 규칙:
- 반드시 순수 한국어로만 작성
- 날짜는 임의로 만들지 말고 입력된 날짜 기준으로 작성
- 격식 있는 공문서 문체 사용`;

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
형식: 제목(업무협조 요청), 작성일, 요청 부서, 협조 내용, 기한, 요청 사유.

작성 원칙:
- 각 항목은 1~2문장으로 간결하게
- 중복·반복 표현 없이 핵심만 작성
- 불필요한 수식어·나열 금지
- 실무에서 바로 사용할 수 있도록 간결하고 명확하게${KO_RULES}`,
  },
];

export default function DocumentWriter() {
  const [docType,   setDocType]   = useState<OfficialDocType>("approval");
  const [fields,    setFields]    = useState<Record<string, string>>({});
  const [result,    setResult]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const handleDocTypeChange = (id: OfficialDocType) => {
    setDocType(id); setFields({}); setResult(""); setError("");
  };

  const handleGenerate = async () => {
    const doc = OFFICIAL_DOCS.find((d) => d.id === docType)!;
    const requiredEmpty = doc.fields.filter((f) => !f.optional).some((f) => !fields[f.key]?.trim());
    if (requiredEmpty) return;
    setLoading(true); setError(""); setResult("");
    const now = new Date();
    const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    const userMsg = [
      `오늘 날짜: ${todayStr}`,
      ...doc.fields.map((f) => `${f.label}: ${fields[f.key]?.trim() ?? "(없음)"}`),
    ].join("\n");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: userMsg }], systemPrompt: doc.systemPrompt }),
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const doc = OFFICIAL_DOCS.find((d) => d.id === docType)!;
  const requiredEmpty = doc.fields.filter((f) => !f.optional).some((f) => !fields[f.key]?.trim());

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full self-start">

      {/* 문서 유형 선택 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {OFFICIAL_DOCS.map((d) => {
          const active = docType === d.id;
          return (
            <button key={d.id} onClick={() => handleDocTypeChange(d.id)}
              className={[
                "flex flex-col gap-1 p-4 rounded-2xl border text-left transition-all",
                active ? "border-[#6C63FF] shadow-md" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
              ].join(" ")}
              style={active ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" } : undefined}>
              <span className={`text-sm font-semibold ${active ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>{d.label}</span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">{d.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 입력 필드 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{doc.label} 정보 입력</p>
        {doc.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
              {field.label}
              {field.optional
                ? <span className="ml-1 text-slate-400">(선택)</span>
                : <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input
              value={fields[field.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <button onClick={handleGenerate} disabled={loading || requiredEmpty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
            {loading ? (
              <><IconLoader2 className="w-4 h-4 animate-spin text-white" />생성 중...</>
            ) : (
              <><IconFileCertificate className="w-4 h-4" />{doc.label} 생성</>
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
      {result ? (
        <div ref={resultRef} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">생성된 {doc.label}</h2>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
              {copied
                ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />복사됨!</>
                : <><IconCopy className="w-3.5 h-3.5" />복사</>}
            </button>
          </div>
          <EditableResult value={result} onChange={setResult} rows={16}>
            <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1.5">
              {result.split("\n").map((line, i) => {
                if (line.startsWith("### ")) return <p key={i} className="font-bold text-slate-800 dark:text-zinc-100 mt-2 first:mt-0">{line.slice(4)}</p>;
                if (line.startsWith("## "))  return <p key={i} className="font-bold text-slate-800 dark:text-zinc-100 mt-3 first:mt-0">{line.slice(3)}</p>;
                if (line.startsWith("* ") || line.startsWith("- ")) return (
                  <p key={i} className="flex gap-1.5"><span className="text-[#6C63FF] shrink-0">•</span><span>{line.slice(2)}</span></p>
                );
                if (!line.trim()) return <div key={i} className="h-1" />;
                return <p key={i}>{line}</p>;
              })}
            </div>
          </EditableResult>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconFileCertificate className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-400 dark:text-zinc-500">필요한 내용을 입력하고 작성하면 문서가 여기에 만들어집니다.</p>
        </div>
      )}
      <HelpButton
        title="공문서 작성 사용법"
        steps={[
          { step: "유형 선택", desc: "품의서·공문·지출결의서·업무협조 요청서 중 선택합니다." },
          { step: "정보 입력", desc: "요청 부서·내용·금액 등 필수 항목(*)을 입력합니다." },
          { step: "문서 생성", desc: "버튼 클릭으로 실무용 공문서가 자동 작성됩니다." },
          { step: "편집·복사", desc: "생성된 문서를 클릭하여 수정하거나 복사하세요." },
        ]}
      />
    </div>
  );
}
