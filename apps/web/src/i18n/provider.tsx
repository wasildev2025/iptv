"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import { defaultLocale, loadMessages } from "./config";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<string>(defaultLocale);
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("locale") || defaultLocale;
    setLocale(stored);

    loadMessages(stored).then((msgs) => {
      setMessages(msgs);
    });
  }, []);

  if (!messages) {
    return null;
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
