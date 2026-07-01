import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'ens-lang';
export const LANGUAGE_COOKIE_NAME = 'ens-lang';

export const LANGUAGES = [
  { code: 'en', label: 'English', settingsLabel: 'English (US)', flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', settingsLabel: 'German (DE)', flag: '🇩🇪', dir: 'ltr' },
  { code: 'fr', label: 'Français', settingsLabel: 'French (FR)', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', label: 'Español', settingsLabel: 'Spanish (ES)', flag: '🇪🇸', dir: 'ltr' },
  { code: 'it', label: 'Italiano', settingsLabel: 'Italian (IT)', flag: '🇮🇹', dir: 'ltr' },
  { code: 'pt', label: 'Português', settingsLabel: 'Portuguese (PT)', flag: '🇧🇷', dir: 'ltr' },
  { code: 'zh', label: '中文', settingsLabel: 'Chinese (ZH)', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ja', label: '日本語', settingsLabel: 'Japanese (JA)', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ar', label: 'العربية', settingsLabel: 'Arabic (AR)', flag: '🇦🇪', dir: 'rtl' },
  { code: 'nl', label: 'Nederlands', settingsLabel: 'Dutch (NL)', flag: '🇳🇱', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', settingsLabel: 'Turkish (TR)', flag: '🇹🇷', dir: 'ltr' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

type TranslationResource = Record<string, unknown>;

const localeLoaders: Partial<Record<LangCode, () => Promise<{ default: TranslationResource }>>> = {
  de: () => import('./locales/de.json'),
  fr: () => import('./locales/fr.json'),
  es: () => import('./locales/es.json'),
  it: () => import('./locales/it.json'),
  pt: () => import('./locales/pt.json'),
  zh: () => import('./locales/zh.json'),
  ja: () => import('./locales/ja.json'),
  ar: () => import('./locales/ar.json'),
  nl: () => import('./locales/nl.json'),
  tr: () => import('./locales/tr.json'),
};

export function normalizeLanguageCode(value: string | null | undefined): LangCode {
  const raw = value?.trim();
  if (!raw) return 'en';

  const lower = raw.toLowerCase();
  const byCode = LANGUAGES.find((language) => lower === language.code || lower.startsWith(`${language.code}-`));
  if (byCode) return byCode.code;

  const byLabel = LANGUAGES.find((language) => (
    lower === language.label.toLowerCase() ||
    lower === language.settingsLabel.toLowerCase() ||
    lower.includes(`(${language.code})`)
  ));

  return byLabel?.code ?? 'en';
}

export function getLanguageOption(code: string | null | undefined) {
  const normalized = normalizeLanguageCode(code);
  return LANGUAGES.find((language) => language.code === normalized) ?? LANGUAGES[0];
}

export function readLanguagePreference(): LangCode {
  if (typeof window === 'undefined') return 'en';

  const queryLanguage = new URLSearchParams(window.location.search).get('lang');
  return normalizeLanguageCode(
    queryLanguage ||
    localStorage.getItem(LANGUAGE_STORAGE_KEY) ||
    readLanguageCookie() ||
    navigator.language,
  );
}

export function persistLanguagePreference(code: string) {
  const normalized = normalizeLanguageCode(code);
  if (typeof window === 'undefined') return normalized;

  localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${normalized}; Max-Age=31536000; Path=/; SameSite=Lax`;
  return normalized;
}

export async function setLanguagePreference(code: string) {
  const normalized = persistLanguagePreference(code);
  applyDir(normalized);
  await ensureLanguageResource(normalized);
  if (i18n.language !== normalized) {
    await i18n.changeLanguage(normalized);
  }
  return normalized;
}

async function ensureLanguageResource(code: LangCode) {
  if (code === 'en' || i18n.hasResourceBundle(code, 'translation')) return;

  const loadLocale = localeLoaders[code];
  if (!loadLocale) return;

  const resource = await loadLocale();
  i18n.addResourceBundle(code, 'translation', resource.default, true, true);
}

function readLanguageCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LANGUAGE_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

const initialLanguage = readLanguagePreference();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    lng: initialLanguage,
    supportedLngs: LANGUAGES.map(l => l.code),
    detection: {
      order: ['querystring', 'localStorage', 'cookie', 'navigator'],
      caches: ['localStorage', 'cookie'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      lookupCookie: LANGUAGE_COOKIE_NAME,
    },
    interpolation: { escapeValue: false },
  });

export function applyDir(lang: string) {
  if (typeof document === 'undefined') return;
  const language = getLanguageOption(lang);
  document.documentElement.dir = language.dir;
  document.documentElement.lang = language.code;
}

i18n.on('languageChanged', (language) => {
  const normalized = persistLanguagePreference(language);
  applyDir(normalized);
});

void ensureLanguageResource(initialLanguage).then(() => {
  if (initialLanguage !== 'en') {
    void i18n.changeLanguage(initialLanguage);
  }
});

export default i18n;
