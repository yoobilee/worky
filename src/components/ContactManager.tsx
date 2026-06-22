"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconUser, IconPhone, IconMail, IconMessageCircle,
  IconPlus, IconPencil, IconTrash, IconSearch, IconX,
  IconTag, IconUsersGroup,
} from "@tabler/icons-react";
import ConfirmModal from "./ConfirmModal";
import HelpButton from "./HelpButton";
import DatePickerInput from "./DatePickerInput";
import { useToast } from "@/contexts/ToastContext";
import { createClient } from "@/lib/supabase/client";
import { getContacts, addContact, updateContact, deleteContact } from "@/lib/db/contacts";
import type { Contact, ContactFormState } from "@/types/contact";

const EMPTY_FORM: ContactFormState = {
  name: "", position: "", department: "", phone: "",
  email: "", kakaoId: "", birthday: "", memo: "", tags: [],
};

export default function ContactManager() {
  const toast = useToast();

  const [hydrated,         setHydrated]         = useState(false);
  const [contacts,         setContacts]         = useState<Contact[]>([]);
  const [search,           setSearch]           = useState("");
  const [groupByDept,      setGroupByDept]      = useState(false);
  const [showForm,         setShowForm]         = useState(false);
  const [editingId,        setEditingId]        = useState<string | null>(null);
  const [form,             setForm]             = useState<ContactFormState>(EMPTY_FORM);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null);
  const [tagInput,         setTagInput]         = useState("");
  const [userId,           setUserId]           = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) setContacts(await getContacts(uid));
      setHydrated(true);
    });
  }, []);

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.department ?? "").toLowerCase().includes(q) ||
      (c.position ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const grouped: { dept: string; items: Contact[] }[] = (() => {
    const map = new Map<string, Contact[]>();
    for (const c of sorted) {
      const key = c.department?.trim() || "미분류";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === "미분류") return 1;
        if (b === "미분류") return -1;
        return a.localeCompare(b, "ko");
      })
      .map(([dept, items]) => ({ dept, items }));
  })();

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTagInput("");
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      name:       c.name,
      position:   c.position ?? "",
      department: c.department ?? "",
      phone:      c.phone ?? "",
      email:      c.email ?? "",
      kakaoId:    c.kakaoId ?? "",
      birthday:   c.birthday ?? "",
      memo:       c.memo ?? "",
      tags:       [...c.tags],
    });
    setTagInput("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput("");
  };

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  const handleSave = async () => {
    if (!form.name.trim() || !userId) return;
    if (editingId) {
      await updateContact(editingId, form);
      setContacts(prev => prev.map(c => c.id !== editingId ? c : {
        id: c.id,
        name:       form.name.trim(),
        position:   form.position.trim() || null,
        department: form.department.trim() || null,
        phone:      form.phone.trim() || null,
        email:      form.email.trim() || null,
        kakaoId:    form.kakaoId.trim() || null,
        birthday:   form.birthday || null,
        memo:       form.memo.trim() || null,
        tags:       form.tags,
      }));
      toast.success("연락처가 수정되었습니다");
    } else {
      const row = await addContact(userId, form);
      if (row) setContacts(prev => [...prev, row]);
      toast.success("연락처가 추가되었습니다");
    }
    closeForm();
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteContact(confirmDeleteId);
    setContacts(prev => prev.filter(c => c.id !== confirmDeleteId));
    toast.success("연락처가 삭제되었습니다");
    setConfirmDeleteId(null);
  };

  if (!hydrated) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-2xl h-8 w-40" />
          <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-9 w-24" />
        </div>
        <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-16" />
          ))}
        </div>
      </div>
    );
  }

  const FormCard = (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 space-y-3 shadow-sm mb-4">
      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
        {editingId ? "연락처 수정" : "연락처 추가"}
      </p>

      {/* 이름 */}
      <input
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="이름 *"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
      />

      {/* 직급 + 소속 */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.position}
          onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
          placeholder="직급"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <input
          value={form.department}
          onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
          placeholder="소속"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
      </div>

      {/* 전화번호 + 이메일 */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="전화번호"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <input
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="이메일"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
      </div>

      {/* 카카오톡 ID + 생일 */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.kakaoId}
          onChange={e => setForm(f => ({ ...f, kakaoId: e.target.value }))}
          placeholder="카카오톡 ID"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        <DatePickerInput value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} />
      </div>

      {/* 메모 */}
      <textarea
        value={form.memo}
        onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
        placeholder="메모"
        rows={2}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition resize-none"
      />

      {/* 태그 */}
      <div className="space-y-1.5">
        <input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          placeholder="태그 입력 후 Enter"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.tags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-[#6C63FF]/10 text-[#6C63FF] rounded-full text-xs font-medium">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="hover:opacity-70 transition">
                  <IconX className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={closeForm}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
          <IconX className="w-3.5 h-3.5" />취소
        </button>
        <button onClick={handleSave} disabled={!form.name.trim()}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
          저장
        </button>
      </div>
    </div>
  );

  const ContactRow = ({ c }: { c: Contact }) => (
    <div className="group flex items-center gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 px-3 py-2.5 transition">
      {/* 아바타 */}
      <div className="w-9 h-9 rounded-full bg-[#6C63FF] text-white font-bold flex items-center justify-center text-sm shrink-0 select-none">
        {c.name.charAt(0)}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{c.name}</span>
          {(c.position || c.department) && (
            <span className="text-xs text-slate-400 dark:text-zinc-500 truncate">
              {[c.position, c.department].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {c.phone && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
              <IconPhone className="w-3 h-3 shrink-0" />{c.phone}
            </span>
          )}
          {c.email && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400 truncate">
              <IconMail className="w-3 h-3 shrink-0" />{c.email}
            </span>
          )}
          {c.kakaoId && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
              <IconMessageCircle className="w-3 h-3 shrink-0" />{c.kakaoId}
            </span>
          )}
        </div>
        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {c.tags.map(t => (
              <span key={t} className="px-2 py-0.5 bg-[#6C63FF]/10 text-[#6C63FF] rounded-full text-[11px] font-medium">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 수정/삭제 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        <button onClick={() => openEdit(c)}
          className="p-1.5 rounded-lg hover:bg-[#6C63FF]/10 text-[#6C63FF] transition">
          <IconPencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setConfirmDeleteId(c.id)}
          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-400 transition">
          <IconTrash className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full">
      {confirmDeleteId && (
        <ConfirmModal
          message="연락처를 삭제하시겠습니까?"
          onConfirm={doDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-100">연락처 관리</h2>
          <span className="text-xs text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {contacts.length}명
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 소속별 토글 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400">소속별로 보기</span>
            <button
              type="button"
              role="switch"
              aria-checked={groupByDept}
              onClick={() => setGroupByDept(v => !v)}
              className={[
                "relative inline-flex w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0",
                groupByDept ? "bg-[#6C63FF]" : "bg-slate-200 dark:bg-zinc-700",
              ].join(" ")}
            >
              <span className={[
                "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                groupByDept ? "translate-x-5" : "translate-x-1",
              ].join(" ")} />
            </button>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
            <IconPlus className="w-4 h-4" />추가
          </button>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 소속, 직급, 전화번호, 이메일, 태그 검색"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
        />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <IconX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 추가/수정 폼 */}
      {showForm && FormCard}

      {/* 리스트 */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-zinc-600">
          <IconUser className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">등록된 연락처가 없습니다</p>
          <button onClick={openAdd}
            className="mt-2 text-xs text-[#6C63FF] hover:underline transition">
            연락처 추가하기
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-zinc-600">
          <IconSearch className="w-10 h-10 mb-3" />
          <p className="text-sm font-medium text-slate-400 dark:text-zinc-500">검색 결과가 없습니다</p>
        </div>
      ) : groupByDept ? (
        <div className="space-y-4">
          {grouped.map(({ dept, items }) => (
            <div key={dept}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <IconUsersGroup className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{dept}</span>
                <span className="text-xs text-slate-300 dark:text-zinc-600">{items.length}명</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                {items.map(c => <ContactRow key={c.id} c={c} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          {sorted.map(c => <ContactRow key={c.id} c={c} />)}
        </div>
      )}

      <HelpButton
        title="연락처 관리 사용법"
        steps={[
          { step: "연락처 추가", desc: "우측 상단 추가 버튼으로 이름, 직급, 소속, 연락처, 태그 등을 등록합니다." },
          { step: "검색", desc: "이름·소속·직급·전화번호·이메일·태그로 통합 검색이 가능합니다." },
          { step: "소속별 보기", desc: "소속별로 보기 토글을 켜면 부서·소속별로 그룹화해서 볼 수 있습니다." },
          { step: "수정/삭제", desc: "각 행에 마우스를 올리면 수정·삭제 아이콘이 나타납니다." },
          { step: "태그 활용", desc: "태그를 입력 후 Enter로 추가하고, 검색에서 태그로도 찾을 수 있습니다." },
        ]}
      />
    </div>
  );
}
