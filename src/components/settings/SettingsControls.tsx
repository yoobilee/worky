"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconMinus, IconPlus } from "@tabler/icons-react";
import { containDialogFocus } from "@/lib/dialogFocus";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";

export function SettingsField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="st-field"><label htmlFor={id}>{label}</label>{children}</div>;
}

export function SettingsSwitch({ label, description, checked, disabled, onChange }: {
  label: string; description?: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <div className="st-switch-row">
    <div><p className="st-label">{label}</p>{description && <p className="st-hint">{description}</p>}</div>
    <button type="button" className="st-switch" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}>
      <span>{checked && <IconCheck size={12} aria-hidden="true" />}</span>
    </button>
  </div>;
}

export function SettingsStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const { t } = useLocale();
  return <div className="st-stepper-row"><p className="st-label">{label}</p><div className="st-stepper" role="group" aria-label={label}>
    <button type="button" className="st-icon-button" disabled={value <= 0} aria-label={tFormat(t("st_decrease"), { name: label })} onClick={() => onChange(Math.max(0, Math.round((value - .5) * 2) / 2))}><IconMinus size={16} /></button>
    <output aria-label={label}>{value}{t("leave_unit_day")}</output>
    <button type="button" className="st-icon-button" disabled={value >= 25} aria-label={tFormat(t("st_increase"), { name: label })} onClick={() => onChange(Math.min(25, Math.round((value + .5) * 2) / 2))}><IconPlus size={16} /></button>
  </div></div>;
}

export function SettingsConfirm({ title, children, onCancel, onConfirm }: { title: string; children: ReactNode; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="st-confirm" aria-labelledby="st-confirm-title" onCancel={onCancel} onKeyDown={containDialogFocus}>
    <h2 id="st-confirm-title">{title}</h2>{children}
    <div className="st-confirm-actions"><button autoFocus className="st-button" onClick={onCancel}>{t("cancel")}</button><button className="st-button st-button--primary" onClick={onConfirm}>{t("confirm")}</button></div>
  </dialog>, document.body);
}
