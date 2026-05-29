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
  en: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Toggle details for {{name}}",
        },
      },
    },
  },
  de: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Details für {{name}} ein-/ausblenden",
        },
      },
    },
  },
  fr: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Afficher/masquer les détails de {{name}}",
        },
      },
    },
  },
  es: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Alternar detalles de {{name}}",
        },
      },
    },
  },
  it: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Mostra/nascondi dettagli di {{name}}",
        },
      },
    },
  },
  pt: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Alternar detalhes de {{name}}",
        },
      },
    },
  },
  nl: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "Details van {{name}} in-/uitklappen",
        },
      },
    },
  },
  zh: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "展开/折叠 {{name}} 的详情",
        },
      },
    },
  },
  ja: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "{{name}} の詳細を展開/折りたたむ",
        },
      },
    },
  },
  ar: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "توسيع/طي تفاصيل {{name}}",
        },
      },
    },
  },
  tr: {
    pm: {
      clients: {
        actions: {
          toggleExpand: "{{name}} ayrıntılarını aç/kapat",
        },
      },
    },
  },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}
console.log('Done.');
