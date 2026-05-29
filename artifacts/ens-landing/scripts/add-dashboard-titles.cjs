'use strict';
const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

const translations = {
  en: { chief: { dashboard: { pageTitle: "Dashboard | ENS" } } },
  de: { chief: { dashboard: { pageTitle: "Dashboard | ENS" } } },
  fr: { chief: { dashboard: { pageTitle: "Tableau de bord | ENS" } } },
  es: { chief: { dashboard: { pageTitle: "Panel de control | ENS" } } },
  it: { chief: { dashboard: { pageTitle: "Dashboard | ENS" } } },
  pt: { chief: { dashboard: { pageTitle: "Painel | ENS" } } },
  nl: { chief: { dashboard: { pageTitle: "Dashboard | ENS" } } },
  zh: { chief: { dashboard: { pageTitle: "仪表板 | ENS" } } },
  ja: { chief: { dashboard: { pageTitle: "ダッシュボード | ENS" } } },
  ar: { chief: { dashboard: { pageTitle: "لوحة التحكم | ENS" } } },
  tr: { chief: { dashboard: { pageTitle: "Gösterge Paneli | ENS" } } },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
console.log('Done.');
