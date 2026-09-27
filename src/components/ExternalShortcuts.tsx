"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { tFormat } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/client";
import { containDialogFocus } from "@/lib/dialogFocus";
import {
  IconPlus, IconX, IconBrandOpenai, IconBrandGoogle, IconBrandGmail,
  IconBrandGoogleDrive, IconBrandNotion, IconSearch, IconBrandGithub, IconBrandYoutube,
  IconBrandInstagram, IconBrandX, IconBrandFigma, IconBrandLinkedin, IconBrandSlack,
  IconBrandDiscord, IconMessageCircle, IconBrandFacebook, IconBrandTiktok, IconBrandTrello, IconBrandDropbox,
} from "@tabler/icons-react";

interface CustomLink { url: string; name: string }

type IconComp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const DEFAULT_SPEED_LINKS: Array<{ name: string; href: string; Icon: IconComp | null; letter: string | null }> = [
  { name: "Claude",       href: "https://claude.ai",         Icon: null,                 letter: "C" },
  { name: "ChatGPT",      href: "https://chatgpt.com",        Icon: IconBrandOpenai,      letter: null },
  { name: "Gemini",       href: "https://gemini.google.com",  Icon: IconBrandGoogle,      letter: null },
  { name: "구글",         href: "https://google.com",         Icon: IconSearch,           letter: null },
  { name: "노션",         href: "https://notion.so",          Icon: IconBrandNotion,      letter: null },
  { name: "Gmail",        href: "https://mail.google.com",    Icon: IconBrandGmail,       letter: null },
  { name: "네이버",       href: "https://naver.com",          Icon: null,                 letter: "N" },
  { name: "Google Drive", href: "https://drive.google.com",   Icon: IconBrandGoogleDrive, letter: null },
];

const BRAND_ICON_MAP: Record<string, IconComp> = {
  "github.com":      IconBrandGithub,
  "youtube.com":     IconBrandYoutube,
  "instagram.com":   IconBrandInstagram,
  "twitter.com":     IconBrandX,
  "x.com":           IconBrandX,
  "figma.com":       IconBrandFigma,
  "linkedin.com":    IconBrandLinkedin,
  "slack.com":       IconBrandSlack,
  "discord.com":     IconBrandDiscord,
  "notion.so":       IconBrandNotion,
  "kakao.com":       IconMessageCircle,
  "kakaowork.com":   IconMessageCircle,
  "facebook.com":    IconBrandFacebook,
  "tiktok.com":      IconBrandTiktok,
  "trello.com":      IconBrandTrello,
  "dropbox.com":     IconBrandDropbox,
};

function getBrandIcon(domain: string): IconComp | null {
  const host = domain.replace(/^www\./, "");
  for (const [key, Icon] of Object.entries(BRAND_ICON_MAP)) {
    if (host === key || host.endsWith(`.${key}`)) return Icon;
  }
  return null;
}

function FaviconImg({ domain, name, size }: { domain: string; name: string; size: number }) {
  const [err, setErr] = useState(false);
  const isLocal =
    !domain ||
    domain.startsWith("file://") ||
    domain === "localhost" ||
    domain.startsWith("localhost:") ||
    domain === "127.0.0.1" ||
    domain.startsWith("127.0.0.1:");

  const BrandIcon = !isLocal ? getBrandIcon(domain) : null;
  if (BrandIcon) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "var(--wk-brand)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrandIcon style={{ width: size * 0.45, height: size * 0.45, color: "white" }} />
      </div>
    );
  }

  if (err || isLocal) {
    return (
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold leading-none shrink-0"
        style={{
          background: "var(--wk-brand)",
          fontSize: Math.round(size * 0.38),
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-nunito), 'Varela Round', 'Noto Sans KR', sans-serif",
          fontWeight: 800,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={name}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setErr(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 16 && img.naturalHeight <= 16) setErr(true);
      }}
    />
  );
}

export default function ExternalShortcuts() {
  const { t } = useLocale();
  const [open, setOpen]               = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
  const [showModal, setShowModal]     = useState(false);
  const [newUrl, setNewUrl]           = useState("");
  const [newName, setNewName]         = useState("");
  const [userId, setUserId]           = useState<string | null>(null);
  const ref       = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      try {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("speed_dial_custom")
          .eq("user_id", uid)
          .maybeSingle();
        if (settings?.speed_dial_custom?.length) {
          setCustomLinks(settings.speed_dial_custom as CustomLink[]);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (showModal) dialogRef.current?.showModal();
    else if (dialogRef.current?.open) {
      dialogRef.current.close();
      addButtonRef.current?.focus();
    }
  }, [showModal]);

  const getDomain = (url: string) => {
    try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname; }
    catch { return url; }
  };

  const saveCustomLinks = async (updated: CustomLink[]) => {
    if (!userId) return;
    try {
      const supabase = createClient();
      await supabase
        .from("user_settings")
        .upsert({ user_id: userId, speed_dial_custom: updated }, { onConflict: "user_id" });
    } catch {}
  };

  const addLink = async () => {
    const trimUrl  = newUrl.trim();
    const trimName = newName.trim();
    if (!trimUrl || !trimName) return;
    const finalUrl = trimUrl.startsWith("http") ? trimUrl : "https://" + trimUrl;
    const updated  = [...customLinks, { url: finalUrl, name: trimName }];
    setCustomLinks(updated);
    setShowModal(false);
    setNewUrl("");
    setNewName("");
    await saveCustomLinks(updated);
  };

  const removeLink = async (idx: number) => {
    const updated = customLinks.filter((_, i) => i !== idx);
    setCustomLinks(updated);
    await saveCustomLinks(updated);
  };

  const previewDomain = (() => {
    const t = newUrl.trim();
    return t ? getDomain(t) : "";
  })();

  const closeModal = () => { setShowModal(false); setNewUrl(""); setNewName(""); };

  return <div className="wk-external" ref={ref}>
    <button type="button" className="wk-text-link" aria-expanded={open} aria-controls="worky-external-links" onClick={() => setOpen(!open)}>
      <IconPlus size={16} aria-hidden="true" />{t("wk_external")}
    </button>
    {open && <div id="worky-external-links" className="wk-external-panel">
      {DEFAULT_SPEED_LINKS.map(({ name, href, Icon, letter }) => <a className="wk-external-item" key={href} href={href} target="_blank" rel="noopener noreferrer">
        {Icon ? <Icon className="w-4 h-4" /> : <span aria-hidden="true">{letter}</span>}{name}
      </a>)}
      {customLinks.map((link, i) => <div className="flex items-center" key={link.url + i}>
        <a className="wk-external-item" href={link.url} target="_blank" rel="noopener noreferrer">{link.name}</a>
        <button type="button" className="wk-icon-button" aria-label={tFormat(t("wk_remove_link"), { name: link.name })} onClick={() => removeLink(i)}><IconX size={14} /></button>
      </div>)}
      <button ref={addButtonRef} type="button" className="wk-external-item" onClick={() => setShowModal(true)}><IconPlus size={16} />{t("speeddial_add_label")}</button>
    </div>}
    {mounted && createPortal(
      <dialog ref={dialogRef} className="wk-shortcut-dialog" aria-labelledby="worky-shortcut-title" onCancel={closeModal} onKeyDown={containDialogFocus}>
        <h3 id="worky-shortcut-title">{t("speeddial_modal_title")}</h3>
        <label>{t("wk_link_url")}<input type="url" placeholder="https://example.com" value={newUrl} onChange={e => setNewUrl(e.target.value)} /></label>
        <label>{t("wk_link_name")}<input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addLink(); }} /></label>
        {previewDomain && <div className="flex items-center gap-2"><FaviconImg domain={previewDomain} name={newName || newUrl} size={28} /><span>{t("speeddial_icon_preview")}</span></div>}
        <div className="wk-shortcut-actions"><button className="wk-text-link" type="button" onClick={closeModal}>{t("cancel")}</button><button className="wk-action" type="button" disabled={!newUrl.trim() || !newName.trim()} onClick={addLink}>{t("speeddial_add_label")}</button></div>
      </dialog>, document.body
    )}
  </div>;
}
