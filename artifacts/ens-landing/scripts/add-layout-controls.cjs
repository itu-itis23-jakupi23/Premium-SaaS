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
  en: { layout: { switchToLight: "Switch to light theme", switchToDark: "Switch to dark theme", selectLanguage: "Select language" } },
  de: { layout: { switchToLight: "Zum hellen Design wechseln", switchToDark: "Zum dunklen Design wechseln", selectLanguage: "Sprache auswählen" } },
  fr: { layout: { switchToLight: "Passer au thème clair", switchToDark: "Passer au thème sombre", selectLanguage: "Choisir la langue" } },
  es: { layout: { switchToLight: "Cambiar a tema claro", switchToDark: "Cambiar a tema oscuro", selectLanguage: "Seleccionar idioma" } },
  it: { layout: { switchToLight: "Passa al tema chiaro", switchToDark: "Passa al tema scuro", selectLanguage: "Seleziona la lingua" } },
  pt: { layout: { switchToLight: "Mudar para tema claro", switchToDark: "Mudar para tema escuro", selectLanguage: "Selecionar idioma" } },
  nl: { layout: { switchToLight: "Schakel naar licht thema", switchToDark: "Schakel naar donker thema", selectLanguage: "Taal selecteren" } },
  zh: { layout: { switchToLight: "切换到浅色主题", switchToDark: "切换到深色主题", selectLanguage: "选择语言" } },
  ja: { layout: { switchToLight: "ライトテーマに切り替え", switchToDark: "ダークテーマに切り替え", selectLanguage: "言語を選択" } },
  ar: { layout: { switchToLight: "التبديل إلى المظهر الفاتح", switchToDark: "التبديل إلى المظهر الداكن", selectLanguage: "اختر اللغة" } },
  tr: { layout: { switchToLight: "Açık temaya geç", switchToDark: "Koyu temaya geç", selectLanguage: "Dil seç" } },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
console.log('Done.');
