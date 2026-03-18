import { create } from "zustand";
import { defaultLocale, type Locale } from "@/i18n/config";

interface LocaleState {
  locale: string;
  setLocale: (locale: string) => void;
}

function getInitialLocale(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("locale") || defaultLocale;
  }
  return defaultLocale;
}

export const useLocale = create<LocaleState>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale: string) => {
    localStorage.setItem("locale", locale);
    set({ locale });
    window.location.reload();
  },
}));
