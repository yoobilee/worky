"use client";

import { useState } from "react";

type TemplateType = "report" | "email" | "meeting" | "plan";

interface TemplateOption {
  id: TemplateType;
  label: string;
  icon: string;
  placeholder: string;
  systemPrompt: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "report",
    label: "업무 보고서",
    icon: "📊",
    placeholder: "예: 이번 주 마케팅 캠페인 성과 보고. 클릭율 15% 향상, 전환율 8% 향상, 예산 초과 없음.",
    systemPrompt: `당신은 전문 비즈니스 문서 작성가입니다. 사용자가 제공한 내용을 바탕으로 체계적인 업무 보고서를 작성해주세요.
보고서에는 반드시 포함해야 할 항목: 제목, 작성일, 보고 목적, 주요 내용 (번호 목록), 결과 및 성과, 향후 계획, 특이사항.
전문적이고 간결한 한국어로 작성하세요.`,
  },
  {
    id: "email",
    label: "이메일",
    icon: "✉️",
    placeholder: "예: 신규 프로젝트 킥오프 미팅 일정 조율. 다음 주 화요일이나 목요일 오후 2시~4시 가능.",
    systemPrompt: `당신은 비즈니스 이메일 전문가입니다. 사용자가 제공한 내용으로 격식 있는 비즈니스 이메일을 작성해주세요.
이메일 구조: 수신자 (담당자 귀중), 제목, 인사말, 본문 (목적 → 세부 내용 → 요청/안내), 마무리 인사, 서명란.
정중하고 명확한 한국어 비즈니스 문체로 작성하세요.`,
  },
  {
    id: "meeting",
    label: "회의록",
    icon: "📝",
    placeholder: "예: 2024 Q1 마케팅 전략 회의. 참석자: 마케팅팀 5명. 주요 안건: 신규 채널 발굴, 예산 배분.",
    systemPrompt: `당신은 회의록 작성 전문가입니다. 사용자가 제공한 내용으로 공식 회의록을 작성해주세요.
회의록 구조: 회의명, 일시/장소, 참석자, 안건 목록, 논의 내용 (각 안건별), 결정 사항, 액션 아이템 (담당자/기한 포함), 차기 회의 예정.
명확하고 구조적인 한국어로 작성하세요.`,
  },
  {
    id: "plan",
    label: "기획안",
    icon: "💡",
    placeholder: "예: 사내 온보딩 프로그램 개선 기획. 현재 2주 과정을 1달로 확대, 멘토링 시스템 도입.",
    systemPrompt: `당신은 기획안 작성 전문가입니다. 사용자가 제공한 아이디어를 바탕으로 체계적인 기획안을 작성해주세요.
기획안 구조: 제목, 기획 배경 및 목적, 현황 분석, 기획 내용 (세부 계획), 기대 효과, 일정 계획, 예산 계획 (개략), 리스크 및 대응 방안.
설득력 있고 전문적인 한국어로 작성하세요.`,
  },
];

export default function TemplateGen() {
  const [selectedType, setSelectedType] = useState<TemplateType>("report");
  const [content, setContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedType)!;

  const handleGenerate = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          systemPrompt: selectedTemplate.systemPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문서 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worky_${selectedType}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">템플릿 생성</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          유형을 선택하고 내용을 입력하면 AI가 완성된 문서를 작성해드립니다.
        </p>
      </div>

      {/* 유형 선택 — Bento 스타일 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => setSelectedType(tpl.id)}
            className={[
              "flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all",
              selectedType === tpl.id
                ? "border-[#6C63FF] shadow-md"
                : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#6C63FF]/40 hover:shadow-sm",
            ].join(" ")}
            style={selectedType === tpl.id
              ? { background: "linear-gradient(135deg, #6C63FF15, #8B85FF20)", borderColor: "#6C63FF" }
              : undefined}
          >
            <span className="text-2xl">{tpl.icon}</span>
            <span className={`text-sm font-semibold ${selectedType === tpl.id ? "text-[#6C63FF]" : "text-slate-700 dark:text-zinc-300"}`}>
              {tpl.label}
            </span>
          </button>
        ))}
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          {selectedTemplate.label} 내용 입력
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={selectedTemplate.placeholder}
          rows={5}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
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
                <span>{selectedTemplate.icon}</span>
                {selectedTemplate.label} 생성
              </>
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
              생성된 {selectedTemplate.label}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? "복사됨!" : "복사"}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: "var(--primary)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                다운로드
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={result}
            rows={16}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 resize-none focus:outline-none font-mono leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
