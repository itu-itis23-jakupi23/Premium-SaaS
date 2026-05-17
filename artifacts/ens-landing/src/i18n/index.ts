import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ar from './locales/ar.json';
import nl from './locales/nl.json';

export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', dir: 'ltr' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', label: 'Español',    flag: '🇪🇸', dir: 'ltr' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹', dir: 'ltr' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷', dir: 'ltr' },
  { code: 'zh', label: '中文',        flag: '🇨🇳', dir: 'ltr' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵', dir: 'ltr' },
  { code: 'ar', label: 'العربية',    flag: '🇦🇪', dir: 'rtl' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', dir: 'ltr' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, de: { translation: de }, fr: { translation: fr }, es: { translation: es }, it: { translation: it }, pt: { translation: pt }, zh: { translation: zh }, ja: { translation: ja }, ar: { translation: ar }, nl: { translation: nl } },
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map(l => l.code),
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ens-lang',
    },
    interpolation: { escapeValue: false },
  });

export function applyDir(lang: string) {
  const l = LANGUAGES.find(x => x.code === lang);
  document.documentElement.dir = l?.dir ?? 'ltr';
  document.documentElement.lang = lang;
}

export default i18n;
