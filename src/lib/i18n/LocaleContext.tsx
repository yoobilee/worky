"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { translations, type Locale, type TranslationKey } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: settings } = await supabase
        .from("user_settings")
        .select("language")
        .eq("user_id", uid)
        .maybeSingle();
      if (settings?.language === "en" || settings?.language === "ko") {
        setLocaleState(settings.language);
      }
    });
  }, []);

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (uid) {
      await supabase.from("user_settings").upsert({ user_id: uid, language: l }, { onConflict: "user_id" });
    }
  };

  const t = (key: TranslationKey): string => translations[locale][key] ?? translations.ko[key];

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
