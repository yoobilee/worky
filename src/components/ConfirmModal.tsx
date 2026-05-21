"use client";

import { IconAlertTriangle, IconX } from "@tabler/icons-react";

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  message, confirmLabel = "삭제", onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/30 shrink-0">
              <IconAlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">삭제 확인</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed mb-5">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
            취소
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
