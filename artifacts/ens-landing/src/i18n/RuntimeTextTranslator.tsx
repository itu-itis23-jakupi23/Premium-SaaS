import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode, type LangCode } from "@/i18n";

const originalTextNodes = new WeakMap<Text, string>();

const phraseKeys: Record<string, string> = {
  "Dashboard": "team.footer.dashboard",
  "Clients": "team.footer.clients",
  "Projects": "team.footer.projects",
  "Reports": "team.footer.reports",
  "Settings": "team.footer.settings",
  "Messages": "team.footer.messages",
  "Workspace": "team.footer.workspace",
  "Tasks": "team.footer.tasks",
  "Documents": "team.footer.docs",
  "Resources": "team.footer.resources",
  "Training": "team.footer.training",
  "Security": "team.footer.security",
  "Privacy": "team.footer.privacy",
  "Features": "nav.features",
  "Workflow": "nav.workflow",
  "Staff Portal": "nav.staffPortal",
  "Client Site": "nav.clientSite",
  "Sign In": "common.signIn",
  "Log In": "common.logIn",
  "Get Started": "common.getStarted",
  "Learn More": "common.learnMore",
  "Project Manager": "team.footer.projectManager",
  "Chief Manager": "team.footer.chiefManager",
};

// customPhrases is a fallback for components that have not yet been migrated to useTranslation().
// Chief-specific strings (chief/managers, chief/dashboard) are now handled by proper i18n in their
// respective components and have been removed from here.
const customPhrases: Partial<Record<LangCode, Record<string, string>>> = {
  tr: {
    // Navigation / sidebar (DashboardLayout is not yet migrated)
    "Logout": "Çıkış Yap",
    "Managers": "Yöneticiler",
    "My Clients": "Müşterilerim",
    "Workspace Monitor": "Çalışma Alanı İzleme",
    "Calendar": "Takvim",
    "Approvals": "Onaylar",
    "Profile": "Profil",
    "Requests": "Talepler",
    // Common status labels used across non-migrated pages
    "Active": "Aktif",
    "Pending": "Beklemede",
    "Completed": "Tamamlandı",
    "Delayed": "Gecikti",
    "Unassigned": "Atanmamış",
    "On Leave": "İzinde",
    "High Load": "Yüksek Yük",
    // Common action labels used across non-migrated pages
    "Message": "Mesaj",
    "Assign": "Ata",
    "Rebalance": "Dengele",
    "Save": "Kaydet",
    "Cancel": "İptal",
    "Select all": "Tümünü seç",
    "Clear": "Temizle",
    "Details": "Detaylar",
    "Open Details": "Detayları Aç",
    "View Calendar": "Takvimi Gör",
    "Send Reminder": "Hatırlatma Gönder",
    "Overview": "Genel Bakış",
    "Recent Activity": "Son Aktivite",
    "Rating": "Puan",
  },
};

const translatedAttributes = ["placeholder", "aria-label", "title"];
const ignoredParents = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

export function RuntimeTextTranslator() {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    const translate = () => translateRoot(language, i18n.t.bind(i18n));
    translate();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(translate);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes,
    });

    return () => observer.disconnect();
  }, [i18n, language]);

  return null;
}

function translateRoot(language: LangCode, t: (key: string, options?: Record<string, unknown>) => string) {
  const root = document.getElementById("root");
  if (!root) return;

  translateTextNodes(root, language, t);
  translateAttributes(root, language, t);
}

function translateTextNodes(root: HTMLElement, language: LangCode, t: (key: string, options?: Record<string, unknown>) => string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ignoredParents.has(parent.tagName) || parent.closest("[data-no-runtime-translate]")) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let node = walker.nextNode() as Text | null;
  while (node) {
    const original = originalTextNodes.get(node) ?? node.textContent ?? "";
    const translated = translatePhrase(original, language, t);
    if (translated !== original) {
      const nextText = preserveSpacing(original, translated);
      originalTextNodes.set(node, original);
      if (node.textContent !== nextText) node.textContent = nextText;
    } else if (originalTextNodes.has(node)) {
      const nextText = originalTextNodes.get(node) ?? node.textContent;
      if (node.textContent !== nextText) node.textContent = nextText;
    }
    node = walker.nextNode() as Text | null;
  }
}

function translateAttributes(root: HTMLElement, language: LangCode, t: (key: string, options?: Record<string, unknown>) => string) {
  const elements = root.querySelectorAll<HTMLElement>(translatedAttributes.map((attr) => `[${attr}]`).join(","));
  elements.forEach((element) => {
    if (element.closest("[data-no-runtime-translate]")) return;

    translatedAttributes.forEach((attr) => {
      const current = element.getAttribute(attr);
      if (!current) return;
      const dataKey = `runtimeOriginal${toDatasetKey(attr)}`;
      const original = element.dataset[dataKey] ?? current;
      const translated = translatePhrase(original, language, t);

      if (translated !== original) {
        element.dataset[dataKey] = original;
        if (element.getAttribute(attr) !== translated) element.setAttribute(attr, translated);
      } else if (element.dataset[dataKey]) {
        if (element.getAttribute(attr) !== original) element.setAttribute(attr, original);
        delete element.dataset[dataKey];
      }
    });
  });
}

function translatePhrase(value: string, language: LangCode, t: (key: string, options?: Record<string, unknown>) => string) {
  const phrase = value.trim();
  if (!phrase || language === "en") return phrase;

  const key = phraseKeys[phrase];
  if (key) return t(key, { defaultValue: phrase });

  return customPhrases[language]?.[phrase] ?? phrase;
}

function preserveSpacing(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function toDatasetKey(attr: string) {
  return attr.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
