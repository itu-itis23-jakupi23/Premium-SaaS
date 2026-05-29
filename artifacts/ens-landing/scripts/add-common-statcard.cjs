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
  en: { common: { vsLastMonth: "vs last month", clickToView: "Click to view →" } },
  de: { common: { vsLastMonth: "vs. letzten Monat", clickToView: "Klicken zum Anzeigen →" } },
  fr: { common: { vsLastMonth: "vs mois dernier", clickToView: "Cliquer pour afficher →" } },
  es: { common: { vsLastMonth: "vs mes anterior", clickToView: "Haga clic para ver →" } },
  it: { common: { vsLastMonth: "vs mese scorso", clickToView: "Clicca per visualizzare →" } },
  pt: { common: { vsLastMonth: "vs mês anterior", clickToView: "Clique para ver →" } },
  nl: { common: { vsLastMonth: "vs vorige maand", clickToView: "Klik om te bekijken →" } },
  zh: { common: { vsLastMonth: "与上月相比", clickToView: "点击查看 →" } },
  ja: { common: { vsLastMonth: "先月比", clickToView: "クリックして表示 →" } },
  ar: { common: { vsLastMonth: "مقارنةً بالشهر الماضي", clickToView: "انقر للعرض →" } },
  tr: { common: { vsLastMonth: "geçen aya kıyasla", clickToView: "Görüntülemek için tıklayın →" } },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
console.log('Done.');
