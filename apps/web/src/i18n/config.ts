export const locales = ["en", "pt", "es", "fr", "nl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  nl: "Nederlands",
};

export async function loadMessages(locale: string) {
  try {
    const messages = (await import(`./messages/${locale}.json`)).default;
    return messages;
  } catch {
    const messages = (await import(`./messages/en.json`)).default;
    return messages;
  }
}
