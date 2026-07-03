"use client";


import HelpButton from "./HelpButton";
import { useState, useEffect, useRef } from "react";
import ConfirmModal from "./ConfirmModal";
import EditableResult from "./EditableResult";
import {
  IconBook,
  IconSearch,
  IconPlus,
  IconPencil,
  IconTrash,
  IconSparkles,
  IconX,
  IconCheck,
  IconTag,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { getGlossary, addTerm, updateTerm, deleteTerm } from "@/lib/db/glossary";
import { useLocale } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n/translations";

/* ───────── 타입·상수 ───────── */

type Category = "직무" | "회사규정" | "IT" | "마케팅" | "재무" | "기타";

interface Term {
  id: string;
  term: string;
  description: string;
  category: Category;
  createdAt: number;
}

const CATEGORIES: Category[] = ["직무", "회사규정", "IT", "마케팅", "재무", "기타"];

const CATEGORY_DISPLAY_KEYS: Record<Category, TranslationKey> = {
  직무:   "gl_cat_job",
  회사규정: "gl_cat_policy",
  IT:     "gl_cat_it",
  마케팅: "gl_cat_marketing",
  재무:   "gl_cat_finance",
  기타:   "gl_cat_etc",
};

const CATEGORY_COLORS: Record<Category, string> = {
  직무:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  회사규정: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IT:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  마케팅: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  재무:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  기타:   "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const DEFAULT_TERMS: Term[] = [
  { id: "default-1", term: "KPI",   category: "직무",   createdAt: 0,
    description: "핵심 성과 지표 (Key Performance Indicator). 목표 달성 정도를 측정하는 수치" },
  { id: "default-2", term: "OKR",   category: "직무",   createdAt: 1,
    description: "목표와 핵심 결과 (Objectives and Key Results). 목표 설정 프레임워크" },
  { id: "default-3", term: "B2B",   category: "마케팅", createdAt: 2,
    description: "기업 간 거래 (Business to Business). 기업이 다른 기업을 대상으로 하는 비즈니스" },
  { id: "default-4", term: "ROI",   category: "재무",   createdAt: 3,
    description: "투자 대비 수익률 (Return on Investment). 투자한 비용 대비 얻은 이익의 비율" },
  { id: "default-5", term: "온보딩", category: "직무",  createdAt: 4,
    description: "신규 입사자가 조직에 적응하는 과정. 업무 교육, 시스템 접근권한 부여 등 포함" },
];

const AI_SYSTEM_PROMPT = `당신은 친절한 직장 내 용어 해설사입니다. 사용자가 모르는 업무 용어를 입력하면 아래 형식으로 설명하세요.

[뜻] 한두 문장으로 핵심 의미를 설명합니다.
[예시] 실제 업무에서 사용되는 예문을 1개 작성합니다.
[관련 용어] 관련 있는 용어 2~3개를 쉼표로 나열합니다.

전문 용어지만 신입사원도 이해할 수 있게 쉽게 설명하세요.`;

/* ───────── 하위 컴포넌트 ───────── */

function CategoryBadge({ category }: { category: Category }) {
  const { t } = useLocale();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[category]}`}>
      {t(CATEGORY_DISPLAY_KEYS[category])}
    </span>
  );
}

/* ───────── 메인 컴포넌트 ───────── */

export default function Glossary() {
  const { t } = useLocale();
  const [terms, setTerms]           = useState<Term[]>([]);
  const [hydrated, setHydrated]     = useState(false);
  const [userId, setUserId]         = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState<Category | "전체">("전체");
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);

  // 폼 상태
  const [formTerm, setFormTerm]     = useState("");
  const [formDesc, setFormDesc]     = useState("");
  const [formCat, setFormCat]       = useState<Category>("직무");

  // AI 설명
  const [aiQuery, setAiQuery]       = useState("");
  const [aiResult,        setAiResult]        = useState("");
  const aiResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiResult) aiResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [aiResult]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState("");

  // Supabase 로드
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const rows = await getGlossary(uid);
        if (rows.length > 0) {
          setTerms(rows.map((r) => ({
            id: r.id, term: r.term, description: r.definition ?? "",
            category: (r.category ?? "기타") as Category, createdAt: new Date(r.created_at ?? Date.now()).getTime(),
          })));
        } else {
          // 기본 예시 일괄 삽입
          const inserted: Term[] = [];
          for (const d of DEFAULT_TERMS) {
            const row = await addTerm(uid, { term: d.term, definition: d.description, category: d.category });
            if (row) inserted.push({ id: row.id, term: row.term, description: row.definition ?? "", category: (row.category ?? "기타") as Category, createdAt: new Date(row.created_at ?? Date.now()).getTime() });
          }
          setTerms(inserted.length > 0 ? inserted : DEFAULT_TERMS);
        }
      } else {
        setTerms(DEFAULT_TERMS);
      }
      setHydrated(true);
    });
  }, []);

  /* ── CRUD ── */
  const openAdd = () => {
    setEditId(null);
    setFormTerm(""); setFormDesc(""); setFormCat("직무");
    setShowForm(true);
  };

  const openEdit = (term: Term) => {
    setEditId(term.id);
    setFormTerm(term.term); setFormDesc(term.description); setFormCat(term.category);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTerm.trim() || !formDesc.trim()) return;
    if (editId) {
      await updateTerm(editId, { term: formTerm.trim(), definition: formDesc.trim(), category: formCat });
      setTerms((prev) =>
        prev.map((item) =>
          item.id === editId ? { ...item, term: formTerm.trim(), description: formDesc.trim(), category: formCat } : item
        )
      );
    } else {
      const row = userId
        ? await addTerm(userId, { term: formTerm.trim(), definition: formDesc.trim(), category: formCat })
        : null;
      const newTerm: Term = {
        id: row?.id ?? crypto.randomUUID(),
        term: formTerm.trim(),
        description: formDesc.trim(),
        category: formCat,
        createdAt: Date.now(),
      };
      setTerms((prev) => [newTerm, ...prev]);
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => setConfirmDeleteId(id);
  const doDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteTerm(confirmDeleteId);
    setTerms((prev) => prev.filter((item) => item.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  /* ── AI 설명 ── */
  const handleAiExplain = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult("");
    try {
      const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: aiQuery }],
          systemPrompt: AI_SYSTEM_PROMPT,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "알 수 없는 오류");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setAiResult("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAiResult(acc);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("gl_error"));
    } finally {
      setAiLoading(false);
    }
  };

  /* ── 필터링 ── */
  const filtered = terms.filter((item) => {
    const matchSearch = item.term.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === "전체" || item.category === filterCat;
    return matchSearch && matchCat;
  });

  if (!hydrated) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-3 w-full">

      {confirmDeleteId && (
        <ConfirmModal
          message={t("gl_confirm_delete")}
          onConfirm={doDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* ── Bento 상단: 통계 + AI 설명 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* 통계 카드 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconBook className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("gl_stat_title")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{terms.length}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{t("gl_stat_total")}</p>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
              <p className="text-2xl font-bold text-[#4D44CC] dark:text-[#8B85FF]">
                {new Set(terms.map((item) => item.category)).size}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{t("gl_stat_category")}</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            <IconPlus className="w-4 h-4" />
            {t("gl_add_btn")}
          </button>
        </div>

        {/* AI 설명 카드 */}
        <div ref={aiResultRef} className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconSparkles className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{t("gl_ai_section")}</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiExplain()}
              placeholder={t("gl_ai_placeholder")}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/20 transition"
            />
            <button
              onClick={handleAiExplain}
              disabled={aiLoading || !aiQuery.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
            >
              {aiLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <IconSparkles className="w-4 h-4" />
              )}
              {aiLoading ? t("gl_loading") : t("gl_ai_btn")}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-500 dark:text-red-400">{aiError}</p>
          )}
          {aiResult && (
            <div className="animate-result-in">
              <EditableResult value={aiResult} onChange={setAiResult} rows={6}>
                <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {aiResult}
                </div>
              </EditableResult>
            </div>
          )}
          {!aiResult && !aiError && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {t("gl_ai_hint")}
            </p>
          )}
        </div>
      </div>

      {/* ── 용어 목록 ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* 검색 + 필터 헤더 */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("gl_search_placeholder")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["전체", ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={[
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  filterCat === cat
                    ? "text-white shadow-sm"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700",
                ].join(" ")}
                style={filterCat === cat ? { background: "#6C63FF" } : undefined}
              >
                {cat === "전체" ? t("gl_cat_all") : t(CATEGORY_DISPLAY_KEYS[cat])}
              </button>
            ))}
          </div>
        </div>

        {/* 용어 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <IconBook className="w-6 h-6 text-slate-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {search || filterCat !== "전체" ? t("gl_empty_search") : t("gl_empty")}
            </p>
            {!search && filterCat === "전체" && (
              <button
                onClick={openAdd}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconPlus className="w-3.5 h-3.5" /> {t("gl_first_add_btn")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filtered.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors group">
                <IconTag className="w-4 h-4 text-[#4D44CC] dark:text-[#8B85FF] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{item.term}</span>
                    <CategoryBadge category={item.category} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:text-[#4D44CC] dark:text-[#8B85FF] transition-colors"
                    aria-label={t("gl_aria_edit")}
                  >
                    <IconPencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                    aria-label={t("gl_aria_delete")}
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 용어 추가/수정 모달 ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editId ? t("gl_modal_edit") : t("gl_modal_add")}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">{t("gl_label_term")}</label>
                <input
                  value={formTerm}
                  onChange={(e) => setFormTerm(e.target.value)}
                  placeholder="예: KPI"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">{t("gl_label_desc")}</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="용어에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">{t("gl_label_category")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFormCat(cat)}
                      className={[
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                        formCat === cat
                          ? "text-white border-transparent"
                          : "border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-[#6C63FF]/40",
                      ].join(" ")}
                      style={formCat === cat ? { background: "#6C63FF" } : undefined}
                    >
                      {t(CATEGORY_DISPLAY_KEYS[cat])}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!formTerm.trim() || !formDesc.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconCheck className="w-4 h-4" />
                {editId ? t("gl_edit_done") : t("gl_add_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
      <HelpButton
        title={t("help_gl_title")}
        steps={[
          { step: t("help_gl_1_step"), desc: t("help_gl_1_desc") },
          { step: t("help_gl_2_step"), desc: t("help_gl_2_desc") },
          { step: t("help_gl_3_step"), desc: t("help_gl_3_desc") },
          { step: t("help_gl_4_step"), desc: t("help_gl_4_desc") },
        ]}
      />
    </div>
  );
}
