"use client";

import { IconCheck, IconX, IconInfoCircle, IconAlertCircle } from "@tabler/icons-react";
import type { ToastItem } from "@/contexts/ToastContext";

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const CONFIG = {
  success: {
    icon: <IconCheck className="w-4 h-4 shrink-0" />,
    bg:   "bg-emerald-50  dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800",
    icon_color: "text-emerald-500",
    text: "text-emerald-800 dark:text-emerald-200",
  },
  error: {
    icon: <IconAlertCircle className="w-4 h-4 shrink-0" />,
    bg:   "bg-red-50 dark:bg-red-950/60",
    border: "border-red-200 dark:border-red-800",
    icon_color: "text-red-500",
    text: "text-red-800 dark:text-red-200",
  },
  info: {
    icon: <IconInfoCircle className="w-4 h-4 shrink-0" />,
    bg:   "bg-[#6C63FF]/8 dark:bg-[#6C63FF]/20",
    border: "border-[#6C63FF]/30",
    icon_color: "text-[#6C63FF]",
    text: "text-slate-800 dark:text-zinc-100",
  },
};

export default function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const cfg = CONFIG[t.type];
        return (
          <div
            key={t.id}
            className={[
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg",
              "min-w-[220px] max-w-[340px]",
              "animate-toast-in",
              cfg.bg, cfg.border,
            ].join(" ")}
          >
            <span className={cfg.icon_color}>{cfg.icon}</span>
            <p className={`flex-1 text-sm font-medium ${cfg.text}`}>{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              aria-label="닫기"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
