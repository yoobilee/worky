"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconUser, IconUsers, IconPhone, IconMail, IconMessageCircle,
  IconPlus, IconPencil, IconTrash, IconSearch, IconX,
  IconUsersGroup, IconCalendar, IconChevronDown,
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

const EMAIL_DOMAINS = [
  "gmail.com", "naver.com", "daum.net", "kakao.com",
  "nate.com", "hanmail.net", "outlook.com", "icloud.com",
];
const CUSTOM_DOMAIN = "__custom__";

const INPUT_CLS = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition";

const AVATAR_PALETTES: [string, string][] = [
  ["#6C63FF", "#8B85FF"],
  ["#06B6D4", "#67E8F9"],
  ["#F97316", "#FDBA74"],
  ["#10B981", "#6EE7B7"],
  ["#EC4899", "#F9A8D4"],
];

function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const [c1, c2] = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

function parseEmail(email: string): { id: string; domain: string; custom: string } {
  if (!email) return { id: "", domain: "", custom: "" };
  const [id, domain] = email.split("@");
  if (!domain) return { id, domain: "", custom: "" };
  if (EMAIL_DOMAINS.includes(domain)) return { id, domain, custom: "" };
  return { id, domain: CUSTOM_DOMAIN, custom: domain };
}

function EmailDomainPicker({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = value === CUSTOM_DOMAIN ? "직접 입력" : value || "도메인 선택";

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button type="button" onClick={() => setOpen(v => { const next = !v; if (next) requestAnimationFrame(() => popoverRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); return next; })}
        className={[
          "w-full px-3 py-2 rounded-xl border text-sm text-left flex items-center justify-between gap-1 transition",
          "bg-slate-50 dark:bg-zinc-800",
          error ? "border-red-400 dark:border-red-500 text-red-500" : value ? "border-[#6C63FF] text-[#6C63FF]" : "border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500",
        ].join(" ")}
      >
        <span className="truncate">{label}</span>
        <IconChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={popoverRef} className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg overflow-hidden w-full">
          <div className="max-h-56 overflow-y-auto">
            {EMAIL_DOMAINS.map(d => (
              <button key={d} type="button" onClick={() => { onChange(d); setOpen(false); }}
                className={`w-full px-3 py-2 text-sm text-left transition ${d === value ? "bg-[#6C63FF]/10 text-[#6C63FF] font-medium" : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => { onChange(CUSTOM_DOMAIN); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-left border-t border-slate-100 dark:border-zinc-800 transition ${value === CUSTOM_DOMAIN ? "bg-[#6C63FF]/10 text-[#6C63FF] font-medium" : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"}`}>
              직접 입력
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactManager() {
  const toast = useToast();

  const [hydrated,        setHydrated]        = useState(false);
  const [contacts,        setContacts]        = useState<Contact[]>([]);
  const [search,          setSearch]          = useState("");
  const [groupByDept,     setGroupByDept]     = useState(false);
  const [showForm,        setShowForm]        = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [form,            setForm]            = useState<ContactFormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);

  const [emailId,      setEmailId]      = useState("");
  const [emailDomain,  setEmailDomain]  = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [errors,       setErrors]       = useState<{ phone?: string; email?: string }>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) setContacts(await getContacts(uid));
      setHydrated(true);
    });
  }, []);

  const selectedContact = contacts.find(c => c.id === selectedId) ?? null;

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.department ?? "").toLowerCase().includes(q) ||
      (c.position ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
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

  const resetEmailState = (email: string) => {
    const { id, domain, custom } = parseEmail(email);
    setEmailId(id); setEmailDomain(domain); setCustomDomain(custom);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetEmailState("");
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setSelectedId(c.id);
    setForm({
      name: c.name, position: c.position ?? "", department: c.department ?? "",
      phone: c.phone ?? "", email: c.email ?? "", kakaoId: c.kakaoId ?? "",
      birthday: c.birthday ?? "", memo: c.memo ?? "", tags: [...c.tags],
    });
    resetEmailState(c.email ?? "");
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetEmailState("");
    setErrors({});
  };

  const handleSave = async () => {
    if (!form.name.trim() || !userId) return;

    const finalDomain = emailDomain === CUSTOM_DOMAIN ? customDomain.trim() : emailDomain;
    const finalEmail  = emailId.trim() && finalDomain ? `${emailId.trim()}@${finalDomain}` : "";

    const newErrors: { phone?: string; email?: string } = {};
    if (finalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail))
      newErrors.email = "올바른 이메일 형식이 아닙니다";
    if (form.phone.trim() && !/^[0-9\-+() ]{7,20}$/.test(form.phone.trim()))
      newErrors.phone = "올바른 전화번호 형식이 아닙니다";
    if (newErrors.email || newErrors.phone) { setErrors(newErrors); return; }
    setErrors({});

    const payload: ContactFormState = { ...form, email: finalEmail };

    if (editingId) {
      await updateContact(editingId, payload);
      setContacts(prev => prev.map(c => c.id !== editingId ? c : {
        id: c.id,
        name:       payload.name.trim(),
        position:   payload.position.trim()   || null,
        department: payload.department.trim() || null,
        phone:      payload.phone.trim()      || null,
        email:      payload.email.trim()      || null,
        kakaoId:    payload.kakaoId.trim()    || null,
        birthday:   payload.birthday          || null,
        memo:       payload.memo.trim()       || null,
        tags:       payload.tags,
      }));
      setSelectedId(editingId);
      toast.success("연락처가 수정되었습니다");
    } else {
      const row = await addContact(userId, payload);
      if (row) { setContacts(prev => [...prev, row]); setSelectedId(row.id); }
      toast.success("연락처가 추가되었습니다");
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetEmailState("");
    setErrors({});
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteContact(confirmDeleteId);
    if (confirmDeleteId === selectedId) setSelectedId(null);
    setContacts(prev => prev.filter(c => c.id !== confirmDeleteId));
    toast.success("연락처가 삭제되었습니다");
    setConfirmDeleteId(null);
  };

  // ── 스켈레톤 ─────────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-[300px] shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-3 sm:h-[600px]">
            <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-6 w-32" />
            <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-8 w-full" />
            <div className="space-y-2 flex-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-xl h-12" />
              ))}
            </div>
          </div>
          <div className="hidden sm:block flex-1 self-stretch bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm sm:h-[600px] animate-pulse" />
        </div>
      </div>
    );
  }

  // ── EmptyState ──────────────────────────────────────────────────────
  const EmptyState = (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-zinc-600">
      <IconUsers className="w-12 h-12" />
      <p className="text-sm text-slate-400 dark:text-zinc-500">연락처를 선택하거나 추가해보세요</p>
    </div>
  );

  // ── ProfileContent ──────────────────────────────────────────────────
  const ProfileContent = selectedContact ? (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full text-white flex items-center justify-center text-xl font-bold shrink-0 select-none"
          style={{ background: avatarGradient(selectedContact.id) }}
        >
          {selectedContact.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-800 dark:text-zinc-100 truncate">{selectedContact.name}</p>
          {(selectedContact.position || selectedContact.department) && (
            <p className="text-sm text-slate-400 dark:text-zinc-500 truncate">
              {[selectedContact.position, selectedContact.department].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => openEdit(selectedContact)}
            className="p-2 rounded-lg text-[#6C63FF] hover:bg-[#6C63FF]/10 transition">
            <IconPencil className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmDeleteId(selectedContact.id)}
            className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
            <IconTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-zinc-800 my-4" />

      {(!selectedContact.phone && !selectedContact.email && !selectedContact.kakaoId && !selectedContact.birthday && !selectedContact.memo) ? (
        <p className="text-xs text-slate-400 dark:text-zinc-500 italic">등록된 추가 정보가 없습니다</p>
      ) : (
        <div className="space-y-3">
          {selectedContact.phone && (
            <div className="flex items-center gap-3">
              <IconPhone className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-zinc-200">{selectedContact.phone}</span>
            </div>
          )}
          {selectedContact.email && (
            <div className="flex items-center gap-3">
              <IconMail className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-zinc-200">{selectedContact.email}</span>
            </div>
          )}
          {selectedContact.kakaoId && (
            <div className="flex items-center gap-3">
              <IconMessageCircle className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-zinc-200">{selectedContact.kakaoId}</span>
            </div>
          )}
          {selectedContact.birthday && (
            <div className="flex items-center gap-3">
              <IconCalendar className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm text-slate-700 dark:text-zinc-200">{selectedContact.birthday}</span>
            </div>
          )}
        </div>
      )}

      {selectedContact.memo && (
        <div className="mt-4 bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">
          <p className="text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-line">{selectedContact.memo}</p>
        </div>
      )}
    </div>
  ) : null;

  // ── FormContent ─────────────────────────────────────────────────────
  const FormContent = (
    <div className="flex flex-col h-full">
      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200 mb-4 shrink-0">
        {editingId ? "연락처 수정" : "연락처 추가"}
      </p>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 px-1 -mx-1 pt-1 -mt-1">
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="이름 *"
          className={INPUT_CLS}
        />

        <div className="grid grid-cols-2 gap-2">
          <input value={form.position}   onChange={e => setForm(f => ({ ...f, position:   e.target.value }))} placeholder="직급"  className={INPUT_CLS} />
          <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="소속"  className={INPUT_CLS} />
        </div>

        <div>
          <input
            value={form.phone}
            onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(prev => ({ ...prev, phone: undefined })); }}
            placeholder="전화번호"
            className={`${INPUT_CLS} ${errors.phone ? "border-red-400 dark:border-red-500 focus:ring-red-300/40" : ""}`}
          />
          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <input
              value={emailId}
              onChange={e => { setEmailId(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
              placeholder="아이디"
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 transition ${errors.email ? "border-red-400 dark:border-red-500 focus:ring-red-300/40" : "border-slate-200 dark:border-zinc-700 focus:ring-[#6C63FF]/40"}`}
            />
            <span className="text-slate-400 dark:text-zinc-500 text-sm shrink-0">@</span>
            <EmailDomainPicker
              value={emailDomain}
              onChange={(v) => { setEmailDomain(v); if (v !== CUSTOM_DOMAIN) setCustomDomain(""); setErrors(prev => ({ ...prev, email: undefined })); }}
              error={!!errors.email}
            />
            {emailDomain === CUSTOM_DOMAIN && (
              <input
                value={customDomain}
                onChange={e => { setCustomDomain(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder="도메인 직접 입력"
                className={`flex-1 min-w-0 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 transition ${errors.email ? "border-red-400 dark:border-red-500 focus:ring-red-300/40" : "border-slate-200 dark:border-zinc-700 focus:ring-[#6C63FF]/40"}`}
              />
            )}
          </div>
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input value={form.kakaoId} onChange={e => setForm(f => ({ ...f, kakaoId: e.target.value }))} placeholder="카카오톡 ID" className={INPUT_CLS} />
          <DatePickerInput value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} placeholder="생일 선택" />
        </div>

        <textarea
          value={form.memo}
          onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
          placeholder="메모"
          rows={3}
          className={`${INPUT_CLS} resize-none`}
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
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

  // ── 목록 행 ─────────────────────────────────────────────────────────
  const ContactRow = ({ c }: { c: Contact }) => {
    const isSelected = c.id === selectedId && !showForm;
    return (
      <button
        type="button"
        onClick={() => { setSelectedId(c.id); setShowForm(false); }}
        className={[
          "w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition",
          isSelected ? "bg-[#6C63FF]/10" : "hover:bg-slate-50 dark:hover:bg-zinc-800",
        ].join(" ")}
      >
        <div
          className="w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0 select-none"
          style={{ background: avatarGradient(c.id) }}
        >
          {c.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isSelected ? "text-[#6C63FF]" : "text-slate-800 dark:text-zinc-100"}`}>
            {c.name}
          </p>
          {(c.position || c.department) && (
            <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">
              {[c.position, c.department].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </button>
    );
  };

  const listContent = contacts.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-8 gap-1 text-slate-300 dark:text-zinc-600">
      <IconUser className="w-8 h-8" />
      <p className="text-xs text-slate-400 dark:text-zinc-500">등록된 연락처가 없습니다</p>
    </div>
  ) : filtered.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-8 gap-1 text-slate-300 dark:text-zinc-600">
      <IconSearch className="w-8 h-8" />
      <p className="text-xs text-slate-400 dark:text-zinc-500">검색 결과가 없습니다</p>
    </div>
  ) : groupByDept ? (
    <div className="space-y-3">
      {grouped.map(({ dept, items }) => (
        <div key={dept}>
          <div className="flex items-center gap-1.5 mb-1 px-2">
            <IconUsersGroup className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{dept}</span>
            <span className="text-[11px] text-slate-300 dark:text-zinc-600">{items.length}명</span>
          </div>
          {items.map(c => <ContactRow key={c.id} c={c} />)}
        </div>
      ))}
    </div>
  ) : (
    <div>{sorted.map(c => <ContactRow key={c.id} c={c} />)}</div>
  );

  const rightPanelContent = showForm ? FormContent : selectedContact ? ProfileContent : EmptyState;

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      {confirmDeleteId && (
        <ConfirmModal
          message="연락처를 삭제하시겠습니까?"
          onConfirm={doDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* 왼쪽: 목록 패널 */}
        <div className="w-full sm:w-[300px] shrink-0 self-stretch bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-3 sm:h-[600px]">
          {/* 헤더 */}
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">연락처 관리</h2>
            <span className="text-xs text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {contacts.length}명
            </span>
          </div>

          {/* 검색 */}
          <div className="relative shrink-0">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 소속, 직급 검색"
              className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 transition">
                <IconX className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 소속별 토글 + 추가 버튼 */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-zinc-400">소속별로 보기</span>
              <button
                type="button"
                role="switch"
                aria-checked={groupByDept}
                onClick={() => setGroupByDept(v => !v)}
                className={[
                  "relative inline-flex w-8 h-5 rounded-full transition-colors duration-200 focus:outline-none shrink-0",
                  groupByDept ? "bg-[#6C63FF]" : "bg-slate-200 dark:bg-zinc-700",
                ].join(" ")}
              >
                <span className={[
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                  groupByDept ? "translate-x-3.5" : "translate-x-0.5",
                ].join(" ")} />
              </button>
            </div>
            <button
              onClick={openAdd}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white transition shrink-0"
              style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}
              aria-label="연락처 추가"
            >
              <IconPlus className="w-4 h-4" />
            </button>
          </div>

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {listContent}
          </div>
        </div>

        {/* 오른쪽: 상세 패널 (sm 이상) */}
        <div className="hidden sm:flex flex-1 self-stretch flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 sm:h-[600px] overflow-y-auto">
          {rightPanelContent}
        </div>
      </div>

      {/* 모바일: 상세 패널 (목록 아래 펼침) */}
      <div
        className="sm:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
        style={{ maxHeight: (selectedId || showForm) ? "2000px" : "0px", opacity: (selectedId || showForm) ? 1 : 0 }}
      >
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm">
          {showForm ? FormContent : selectedContact ? ProfileContent : null}
        </div>
      </div>

      <HelpButton
        title="연락처 관리 사용법"
        steps={[
          { step: "연락처 추가", desc: "목록 패널 우측 상단 + 버튼으로 새 연락처를 등록합니다." },
          { step: "이메일 입력", desc: "아이디와 도메인을 분리해서 입력하거나 직접 입력 옵션을 선택합니다." },
          { step: "검색", desc: "이름·소속·직급·전화번호·이메일로 통합 검색이 가능합니다." },
          { step: "소속별 보기", desc: "소속별로 보기 토글을 켜면 부서·소속별로 그룹화해서 볼 수 있습니다." },
          { step: "수정/삭제", desc: "연락처를 선택하면 상세 패널에서 수정·삭제 버튼이 표시됩니다." },
        ]}
      />
    </div>
  );
}
