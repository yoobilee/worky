"use client";

import { useState, useEffect } from "react";
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

const CATEGORY_COLORS: Record<Category, string> = {
  직무:   "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  회사규정: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IT:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  마케팅: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  재무:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  기타:   "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STORAGE_KEY = "worky_glossary";

const AI_SYSTEM_PROMPT = `당신은 친절한 직장 내 용어 해설사입니다. 사용자가 모르는 업무 용어를 입력하면 아래 형식으로 설명하세요.

[뜻] 한두 문장으로 핵심 의미를 설명합니다.
[예시] 실제 업무에서 사용되는 예문을 1개 작성합니다.
[관련 용어] 관련 있는 용어 2~3개를 쉼표로 나열합니다.

전문 용어지만 신입사원도 이해할 수 있게 쉽게 설명하세요.`;

/* ───────── 하위 컴포넌트 ───────── */

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[category]}`}>
      {category}
    </span>
  );
}

/* ───────── 메인 컴포넌트 ───────── */

export default function Glossary() {
  const [terms, setTerms]           = useState<Term[]>([]);
  const [hydrated, setHydrated]     = useState(false);
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
  const [aiResult, setAiResult]     = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState("");

  // localStorage 로드
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTerms(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  // localStorage 저장
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  }, [terms, hydrated]);

  /* ── CRUD ── */
  const openAdd = () => {
    setEditId(null);
    setFormTerm(""); setFormDesc(""); setFormCat("직무");
    setShowForm(true);
  };

  const openEdit = (t: Term) => {
    setEditId(t.id);
    setFormTerm(t.term); setFormDesc(t.description); setFormCat(t.category);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formTerm.trim() || !formDesc.trim()) return;
    if (editId) {
      setTerms((prev) =>
        prev.map((t) =>
          t.id === editId ? { ...t, term: formTerm.trim(), description: formDesc.trim(), category: formCat } : t
        )
      );
    } else {
      setTerms((prev) => [
        { id: crypto.randomUUID(), term: formTerm.trim(), description: formDesc.trim(), category: formCat, createdAt: Date.now() },
        ...prev,
      ]);
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setTerms((prev) => prev.filter((t) => t.id !== id));
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "알 수 없는 오류");
      setAiResult(data.result);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "설명을 가져오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  /* ── 필터링 ── */
  const filtered = terms.filter((t) => {
    const matchSearch = t.term.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === "전체" || t.category === filterCat;
    return matchSearch && matchCat;
  });

  if (!hydrated) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-3 w-full">

      {/* ── Bento 상단: 통계 + AI 설명 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* 통계 카드 */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconBook className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">용어집 현황</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{terms.length}</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">전체 용어</p>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
              <p className="text-2xl font-bold text-[#6C63FF]">
                {new Set(terms.map((t) => t.category)).size}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">카테고리</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
          >
            <IconPlus className="w-4 h-4" />
            용어 추가
          </button>
        </div>

        {/* AI 설명 카드 */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconSparkles className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">AI 용어 설명</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiExplain()}
              placeholder="모르는 용어를 입력하세요 (예: OKR, KPI, IR...)"
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
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
              {aiLoading ? "설명 중..." : "AI 설명"}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-500 dark:text-red-400">{aiError}</p>
          )}
          {aiResult && (
            <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {aiResult}
            </div>
          )}
          {!aiResult && !aiError && (
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Enter 또는 버튼을 눌러 AI 설명을 받아보세요.
            </p>
          )}
        </div>
      </div>

      {/* ── 용어 목록 ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* 검색 + 필터 헤더 */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="용어 검색..."
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
                {cat}
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
            <p className="text-sm text-slate-400 dark:text-zinc-500">
              {search || filterCat !== "전체" ? "검색 결과가 없습니다." : "등록된 용어가 없습니다."}
            </p>
            {!search && filterCat === "전체" && (
              <button
                onClick={openAdd}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconPlus className="w-3.5 h-3.5" /> 첫 용어 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors group">
                <IconTag className="w-4 h-4 text-[#6C63FF] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{t.term}</span>
                    <CategoryBadge category={t.category} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{t.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:text-[#6C63FF] transition-colors"
                    aria-label="수정"
                  >
                    <IconPencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                    aria-label="삭제"
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
                {editId ? "용어 수정" : "용어 추가"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">용어명</label>
                <input
                  value={formTerm}
                  onChange={(e) => setFormTerm(e.target.value)}
                  placeholder="예: KPI"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">설명</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="용어에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">카테고리</label>
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
                      {cat}
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
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!formTerm.trim() || !formDesc.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              >
                <IconCheck className="w-4 h-4" />
                {editId ? "수정 완료" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
