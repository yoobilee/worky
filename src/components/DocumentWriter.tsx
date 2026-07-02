"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import {
  IconFileCertificate, IconCopy, IconCheck, IconLoader2,
} from "@tabler/icons-react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import type { TranslationKey } from "@/lib/i18n/translations";
import EditableResult from "./EditableResult";
import { trackUsage } from "@/lib/usageStats";

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

type OfficialDocType = "approval" | "official_doc" | "expense" | "cooperation";

interface OfficialField { key: string; labelKey: TranslationKey; placeholderKey: TranslationKey; optional?: boolean; }
interface OfficialDoc   { id: OfficialDocType; labelKey: TranslationKey; descKey: TranslationKey; fields: OfficialField[]; systemPrompt: string; }

const KO_RULES = `
공통 규칙:
- 반드시 순수 한국어로만 작성
- 날짜는 임의로 만들지 말고 입력된 날짜 기준으로 작성
- 격식 있는 공문서 문체 사용`;

const OFFICIAL_DOCS: OfficialDoc[] = [
  {
    id: "approval", labelKey: "dw_type_approval", descKey: "dw_type_approval_desc",
    fields: [
      { key: "dept",    labelKey: "dw_label_dept",    placeholderKey: "dw_ph_dept"    },
      { key: "content", labelKey: "dw_label_content",  placeholderKey: "dw_ph_content" },
      { key: "amount",  labelKey: "dw_label_amount",   placeholderKey: "dw_ph_amount",  optional: true },
      { key: "reason",  labelKey: "dw_label_reason",   placeholderKey: "dw_ph_reason"  },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 내부 결재용 품의서를 작성해주세요.
형식: 제목(○○ 품의서), 작성일, 요청 부서, 요청 내용, 금액(있는 경우만), 사유, 기대 효과(간략히).
격식 있는 공문서 문체로 작성하세요.${KO_RULES}`,
  },
  {
    id: "official_doc", labelKey: "dw_type_official", descKey: "dw_type_official_desc",
    fields: [
      { key: "sender",   labelKey: "dw_label_from",     placeholderKey: "dw_ph_sender"    },
      { key: "receiver", labelKey: "dw_label_to_org",   placeholderKey: "dw_ph_receiver"  },
      { key: "title",    labelKey: "dw_label_title",    placeholderKey: "dw_ph_doc_title" },
      { key: "content",  labelKey: "dw_label_main",     placeholderKey: "dw_ph_doc_content" },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 공식 공문을 작성해주세요.
형식: 수신, 발신, 제목, 본문(목적·내용·요청사항 순), 끝.
표준 공문 형식을 정확히 따르고 격식체로 작성하세요.${KO_RULES}`,
  },
  {
    id: "expense", labelKey: "dw_type_expense", descKey: "dw_type_expense_desc",
    fields: [
      { key: "item",    labelKey: "dw_label_expense_item",    placeholderKey: "dw_ph_expense_item"    },
      { key: "amount",  labelKey: "dw_label_amount",          placeholderKey: "dw_ph_expense_amount"  },
      { key: "purpose", labelKey: "dw_label_expense_purpose", placeholderKey: "dw_ph_expense_purpose" },
      { key: "date",    labelKey: "dw_label_expense_date",    placeholderKey: "dw_ph_expense_date"    },
    ],
    systemPrompt: `당신은 공문서 작성 전문가입니다. 입력된 내용을 바탕으로 지출결의서를 작성해주세요.
형식: 제목(지출결의서), 작성일, 지출 항목, 금액, 사용 목적, 사용 날짜, 결재 요청 내용.
격식 있는 공문서 문체로 간결하게 작성하세요.${KO_RULES}`,
  },
  {
    id: "cooperation", labelKey: "dw_type_coop", descKey: "dw_type_coop_desc",
    fields: [
      { key: "dept",     labelKey: "dw_label_dept",         placeholderKey: "dw_ph_coop_dept"    },
      { key: "content",  labelKey: "dw_label_coop_content", placeholderKey: "dw_ph_coop_content" },
      { key: "deadline", labelKey: "dw_label_deadline",     placeholderKey: "dw_ph_deadline"     },
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
  const { t } = useLocale();
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
      ...doc.fields.map((f) => `${t(f.labelKey)}: ${fields[f.key]?.trim() ?? "(없음)"}`),
    ].join("\n");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: userMsg }], systemPrompt: doc.systemPrompt, stream: true }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "알 수 없는 오류");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setResult("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResult(acc);
      }
      trackUsage("template");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dw_error"));
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
              <span className={`text-sm font-semibold ${active ? "text-[#4D44CC] dark:text-[#8B85FF]" : "text-slate-700 dark:text-zinc-300"}`}>{t(d.labelKey)}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400">{t(d.descKey)}</span>
            </button>
          );
        })}
      </div>

      {/* 입력 필드 카드 */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm space-y-3">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{tFormat(t("dw_section_title"), { label: t(doc.labelKey) })}</p>
        {doc.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
              {t(field.labelKey)}
              {field.optional
                ? <span className="ml-1 text-slate-500">{t("dw_optional")}</span>
                : <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input
              value={fields[field.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={t(field.placeholderKey)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <button onClick={handleGenerate} disabled={loading || requiredEmpty}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
            {loading ? (
              <><IconLoader2 className="w-4 h-4 animate-spin text-white" />{t("generating")}</>
            ) : (
              <><IconFileCertificate className="w-4 h-4" />{tFormat(t("dw_generate_btn"), { label: t(doc.labelKey) })}</>
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
            <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{tFormat(t("dw_result_title"), { label: t(doc.labelKey) })}</h2>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
              {copied
                ? <><IconCheck className="w-3.5 h-3.5 text-emerald-500" />{t("copied")}</>
                : <><IconCopy className="w-3.5 h-3.5" />{t("copy")}</>}
            </button>
          </div>
          <EditableResult value={result} onChange={setResult} rows={16}>
            <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1.5">
              {result.split("\n").map((line, i) => {
                if (line.startsWith("### ")) return <p key={i} className="font-bold text-slate-800 dark:text-zinc-100 mt-2 first:mt-0">{parseInline(line.slice(4))}</p>;
                if (line.startsWith("## "))  return <p key={i} className="font-bold text-slate-800 dark:text-zinc-100 mt-3 first:mt-0">{parseInline(line.slice(3))}</p>;
                if (line.startsWith("* ") || line.startsWith("- ")) return (
                  <p key={i} className="flex gap-1.5"><span className="text-[#4D44CC] dark:text-[#8B85FF] shrink-0">•</span><span>{parseInline(line.slice(2))}</span></p>
                );
                if (!line.trim()) return <div key={i} className="h-1" />;
                return <p key={i}>{parseInline(line)}</p>;
              })}
            </div>
          </EditableResult>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center py-10 gap-2">
          <IconFileCertificate className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t("dw_empty")}</p>
        </div>
      )}
      <HelpButton
        title={t("help_dw_title")}
        steps={[
          { step: t("help_dw_1_step"), desc: t("help_dw_1_desc") },
          { step: t("help_dw_2_step"), desc: t("help_dw_2_desc") },
          { step: t("help_dw_3_step"), desc: t("help_dw_3_desc") },
          { step: t("help_dw_4_step"), desc: t("help_dw_4_desc") },
        ]}
      />
    </div>
  );
}
