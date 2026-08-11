"use client";

import { useState, type RefObject } from "react";
import { IconFileTypePdf, IconLoader2 } from "@tabler/icons-react";
import { useToast } from "@/contexts/ToastContext";
import { useLocale } from "@/lib/i18n/LocaleContext";

interface PdfDownloadButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  filename: string;
  disabled?: boolean;
}

export default function PdfDownloadButton({ targetRef, filename, disabled = false }: PdfDownloadButtonProps) {
  const { t } = useLocale();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!targetRef.current || disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: targetRef.current.outerHTML, filename }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? t("pdf_error"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pdf_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
          {t("pdf_generating")}
        </>
      ) : (
        <>
          <IconFileTypePdf className="w-3.5 h-3.5" />
          {t("pdf_download_btn")}
        </>
      )}
    </button>
  );
}
