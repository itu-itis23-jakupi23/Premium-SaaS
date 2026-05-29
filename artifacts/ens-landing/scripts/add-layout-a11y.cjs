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
  en: { layout: { skipToContent: "Skip to main content", navigation: "Main navigation", expandSidebar: "Expand sidebar", collapseSidebar: "Collapse sidebar" } },
  de: { layout: { skipToContent: "Zum Hauptinhalt springen", navigation: "Hauptnavigation", expandSidebar: "Seitenleiste ausklappen", collapseSidebar: "Seitenleiste einklappen" } },
  fr: { layout: { skipToContent: "Aller au contenu principal", navigation: "Navigation principale", expandSidebar: "Développer la barre latérale", collapseSidebar: "Réduire la barre latérale" } },
  es: { layout: { skipToContent: "Ir al contenido principal", navigation: "Navegación principal", expandSidebar: "Expandir barra lateral", collapseSidebar: "Contraer barra lateral" } },
  it: { layout: { skipToContent: "Vai al contenuto principale", navigation: "Navigazione principale", expandSidebar: "Espandi barra laterale", collapseSidebar: "Comprimi barra laterale" } },
  pt: { layout: { skipToContent: "Ir para o conteúdo principal", navigation: "Navegação principal", expandSidebar: "Expandir barra lateral", collapseSidebar: "Recolher barra lateral" } },
  nl: { layout: { skipToContent: "Ga naar hoofdinhoud", navigation: "Hoofdnavigatie", expandSidebar: "Zijbalk uitklappen", collapseSidebar: "Zijbalk inklappen" } },
  zh: { layout: { skipToContent: "跳至主要内容", navigation: "主导航", expandSidebar: "展开侧栏", collapseSidebar: "折叠侧栏" } },
  ja: { layout: { skipToContent: "メインコンテンツへスキップ", navigation: "メインナビゲーション", expandSidebar: "サイドバーを展開", collapseSidebar: "サイドバーを折りたたむ" } },
  ar: { layout: { skipToContent: "انتقل إلى المحتوى الرئيسي", navigation: "التنقل الرئيسي", expandSidebar: "توسيع الشريط الجانبي", collapseSidebar: "طي الشريط الجانبي" } },
  tr: { layout: { skipToContent: "Ana içeriğe geç", navigation: "Ana gezinti", expandSidebar: "Kenar çubuğunu genişlet", collapseSidebar: "Kenar çubuğunu daralt" } },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
console.log('Done.');
