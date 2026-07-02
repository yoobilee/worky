"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import { trackUsage } from "@/lib/usageStats";
import { IconReport, IconNotes, IconBulb, IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import EditableResult from "@/components/EditableResult";
import React from "react";

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

type TemplateType = "report" | "meeting" | "plan";

import type { TranslationKey } from "@/lib/i18n/translations";

interface TemplateOption {
  id: TemplateType;
  labelKey: TranslationKey;
  placeholderKey: TranslationKey;
  Icon: React.ComponentType<{ className?: string }>;
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
    labelKey: "tg_type_report",
    placeholderKey: "tg_ph_report",
    Icon: IconReport,
    systemPrompt: `당신은 전문 비즈니스 문서 작성가입니다. 사용자가 제공한 내용을 바탕으로 체계적인 업무 보고서를 작성해주세요.
보고서에는 반드시 포함해야 할 항목: 제목, 작성일, 보고 목적, 주요 내용 (번호 목록), 결과 및 성과, 향후 계획, 특이사항.
전문적이고 간결하게 작성하세요.${KO_RULES}`,
  },
  {
    id: "meeting",
    labelKey: "tg_type_minutes",
    placeholderKey: "tg_ph_minutes",
    Icon: IconNotes,
    systemPrompt: `당신은 회의록 작성 전문가입니다. 사용자가 제공한 내용으로 공식 회의록을 작성해주세요.
회의록 구조: 회의명, 일시/장소, 참석자, 안건 목록, 논의 내용 (각 안건별), 결정 사항, 액션 아이템 (담당자/기한 포함), 차기 회의 예정.
명확하고 구조적으로 작성하세요.${KO_RULES}`,
  },
  {
    id: "plan",
    labelKey: "tg_type_plan",
    placeholderKey: "tg_ph_plan",
    Icon: IconBulb,
    systemPrompt: `당신은 기획안 작성 전문가입니다. 사용자가 제공한 아이디어를 바탕으로 체계적인 기획안을 작성해주세요.
기획안 구조: 제목, 기획 배경 및 목적, 현황 분석, 기획 내용 (세부 계획), 기대 효과, 일정 계획, 예산 계획 (개략), 리스크 및 대응 방안.
설득력 있고 전문적으로 작성하세요.${KO_RULES}`,
  },
];

export default function TemplateGen() {
  const { t } = useLocale();
  const [selectedType, setSelectedType] = useState<TemplateType>("report");
  const [content, setContent]           = useState("");
  const [result, setResult]             = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [copied, setCopied]             = useState(false);
  const [pendingTab, setPendingTab]     = useState<TemplateType | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const selectedTemplate    = TEMPLATES.find((tpl) => tpl.id === selectedType)!;
  const SelectedTemplateIcon = selectedTemplate.Icon;
  const selectedLabel = t(selectedTemplate.labelKey);

  const buildPrompt = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    const dateNote = `\n오늘 날짜: ${todayStr}. 날짜가 필요한 경우 반드시 이 날짜를 사용하고, 임의로 다른 날짜를 만들지 마세요.`;
    return selectedTemplate.systemPrompt + dateNote;
  };

  const handleTabChange = (type: TemplateType) => {
    if (type === selectedType) return;
    if (content.trim() || result) {
      setPendingTab(type);
    } else {
      setSelectedType(type);
    }
  };

  const confirmTabChange = () => {
    if (!pendingTab) return;
    setSelectedType(pendingTab);
    setContent(""); setResult(""); setError("");
    setPendingTab(null);
  };

  const handleGenerate = async () => {
    if (!content.trim()) return;
    setLoading(true); setError(""); setResult("");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content }], systemPrompt: buildPrompt(), stream: true }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t("unknown_error"));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
      trackUsage("template");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tg_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `worky_${selectedType}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto w-full self-start">

      {/* 탭 이동 확인 모달 */}
      {pendingTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6C63FF]/10 shrink-0">
                <IconAlertTriangle className="w-5 h-5 text-[#4D44CC] dark:text-[#8B85FF]" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-zinc-100">{t("tg_tab_confirm_title")}</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
              {t("tg_tab_confirm_body")}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingTab(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                {t("cancel")}
              </button>
              <button onClick={confirmTabChange}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                {t("tg_move")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 유형 선택 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((tpl) => (
          <button key={tpl.id} onClick={() => handleTabChange(tpl.id)}
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
            <tpl.Icon className="w-6 h-6" />
            <span className={`text-sm font-semibold ${selectedType === tpl.id ? "text-[#4D44CC] dark:text-[#8B85FF]" : "text-slate-700 dark:text-zinc-300"}`}>
              {t(tpl.labelKey)}
            </span>
          </button>
        ))}
      </div>

      {/* 입력 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
          {tFormat(t("tg_input_label"), { label: selectedLabel })}
        </label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={t(selectedTemplate.placeholderKey)} rows={5}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <div className="flex justify-end mt-3">
          <button onClick={handleGenerate} disabled={loading || !content.trim()}
            className="btn-press flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
            {loading ? (
              <><IconLoader2 className="w-4 h-4 animate-spin text-white" />{t("generating")}</>
            ) : (
              <><SelectedTemplateIcon className="w-4 h-4" />{tFormat(t("tg_generate_btn"), { label: selectedLabel })}</>
            )}
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div role="alert" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 결과 */}
      {result ? (
        <div ref={resultRef} className="animate-result-in bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
              {tFormat(t("tg_result_title"), { label: selectedLabel })}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? t("copied") : t("copy")}
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                다운로드
              </button>
            </div>
          </div>
          <EditableResult value={result} onChange={setResult} rows={16} textareaClassName="font-mono">
            <div className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
              {renderMarkdown(result)}
            </div>
          </EditableResult>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconNotes className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("tg_empty")}</p>
        </div>
      )}
      <HelpButton
        title={t("help_tg_title")}
        steps={[
          { step: t("help_tg_1_step"), desc: t("help_tg_1_desc") },
          { step: t("help_tg_2_step"), desc: t("help_tg_2_desc") },
          { step: t("help_tg_3_step"), desc: t("help_tg_3_desc") },
          { step: t("help_tg_4_step"), desc: t("help_tg_4_desc") },
        ]}
      />
    </div>
  );
}
