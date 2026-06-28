"use client";

import { useState, useRef } from "react";
import { IconPencil } from "@tabler/icons-react";

interface EditableResultProps {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  rows?: number;
  textareaClassName?: string;
}

export default function EditableResult({
  value, onChange, children, rows = 10, textareaClassName = "",
}: EditableResultProps) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  if (editing) {
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        rows={rows}
        className={`w-full px-4 py-3 rounded-xl border-2 border-[#6C63FF]/60 bg-slate-50 dark:bg-zinc-800 text-sm text-slate-800 dark:text-zinc-100 resize-none focus:outline-none leading-relaxed ${textareaClassName}`}
      />
    );
  }

  return (
    <div className="relative group cursor-text" onClick={startEdit}>
      {children}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-1 px-1.5 py-1 rounded-bl-lg rounded-tr-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
        <IconPencil className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
        <span className="text-[10px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">클릭하여 편집</span>
      </div>
    </div>
  );
}
