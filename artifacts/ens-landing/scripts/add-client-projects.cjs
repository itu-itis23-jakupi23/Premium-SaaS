/**
 * add-client-projects.cjs
 * Adds client.projects.* keys to all 11 locale files.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const TRANSLATIONS = {
  en: {
    pageTitle: "My Projects | ENS",
    title: "My Projects",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProjects: "Projects",
    actionRequired: "Action Required",
    exhibitionTbd: "Exhibition TBD",
    productionProgress: "Production Progress",
    quickActions: "Quick Actions",
    stat: {
      total: "Total Projects",
      active: "Active",
      pendingReview: "Pending Review",
      avgProgress: "Avg. Progress",
    },
    status: {
      Active: "Active",
      Pending: "Pending",
      Delayed: "Delayed",
      Completed: "Completed",
    },
    meta: {
      system: "System",
      size: "Size",
      pm: "PM",
      deadline: "Deadline",
    },
    timeline: {
      heading: "Project Timeline",
      defaultLabel: "Project created — design in progress",
      defaultDate: "Recently",
    },
    action: {
      viewDesign: "View Design",
      reviewPending: "Review Pending",
      approvals: "Approvals",
      documents: "Documents",
      messagePm: "Message PM",
    },
  },
  de: {
    pageTitle: "Meine Projekte | ENS",
    title: "Meine Projekte",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProjects: "Projekte",
    actionRequired: "Aktion erforderlich",
    exhibitionTbd: "Messe noch offen",
    productionProgress: "Produktionsfortschritt",
    quickActions: "Schnellaktionen",
    stat: {
      total: "Projekte gesamt",
      active: "Aktiv",
      pendingReview: "Ausstehende Prüfung",
      avgProgress: "Ø Fortschritt",
    },
    status: {
      Active: "Aktiv",
      Pending: "Ausstehend",
      Delayed: "Verzögert",
      Completed: "Abgeschlossen",
    },
    meta: {
      system: "System",
      size: "Größe",
      pm: "PM",
      deadline: "Deadline",
    },
    timeline: {
      heading: "Projektzeitplan",
      defaultLabel: "Projekt erstellt — Design in Arbeit",
      defaultDate: "Kürzlich",
    },
    action: {
      viewDesign: "Design ansehen",
      reviewPending: "Ausstehende Prüfung",
      approvals: "Genehmigungen",
      documents: "Dokumente",
      messagePm: "PM anschreiben",
    },
  },
  fr: {
    pageTitle: "Mes projets | ENS",
    title: "Mes projets",
    breadcrumbDashboard: "Tableau de bord",
    breadcrumbProjects: "Projets",
    actionRequired: "Action requise",
    exhibitionTbd: "Exposition à confirmer",
    productionProgress: "Avancement production",
    quickActions: "Actions rapides",
    stat: {
      total: "Total projets",
      active: "Actifs",
      pendingReview: "En attente de révision",
      avgProgress: "Progression moy.",
    },
    status: {
      Active: "Actif",
      Pending: "En attente",
      Delayed: "Retardé",
      Completed: "Terminé",
    },
    meta: {
      system: "Système",
      size: "Taille",
      pm: "Chef de projet",
      deadline: "Échéance",
    },
    timeline: {
      heading: "Chronologie du projet",
      defaultLabel: "Projet créé — design en cours",
      defaultDate: "Récemment",
    },
    action: {
      viewDesign: "Voir le design",
      reviewPending: "Révision en attente",
      approvals: "Approbations",
      documents: "Documents",
      messagePm: "Contacter le chef de projet",
    },
  },
  es: {
    pageTitle: "Mis proyectos | ENS",
    title: "Mis proyectos",
    breadcrumbDashboard: "Panel",
    breadcrumbProjects: "Proyectos",
    actionRequired: "Acción requerida",
    exhibitionTbd: "Exposición por confirmar",
    productionProgress: "Progreso de producción",
    quickActions: "Acciones rápidas",
    stat: {
      total: "Total proyectos",
      active: "Activos",
      pendingReview: "Revisión pendiente",
      avgProgress: "Progreso promedio",
    },
    status: {
      Active: "Activo",
      Pending: "Pendiente",
      Delayed: "Retrasado",
      Completed: "Completado",
    },
    meta: {
      system: "Sistema",
      size: "Tamaño",
      pm: "Director",
      deadline: "Fecha límite",
    },
    timeline: {
      heading: "Cronograma del proyecto",
      defaultLabel: "Proyecto creado — diseño en curso",
      defaultDate: "Recientemente",
    },
    action: {
      viewDesign: "Ver diseño",
      reviewPending: "Revisión pendiente",
      approvals: "Aprobaciones",
      documents: "Documentos",
      messagePm: "Contactar director",
    },
  },
  it: {
    pageTitle: "I miei progetti | ENS",
    title: "I miei progetti",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProjects: "Progetti",
    actionRequired: "Azione richiesta",
    exhibitionTbd: "Fiera da definire",
    productionProgress: "Avanzamento produzione",
    quickActions: "Azioni rapide",
    stat: {
      total: "Totale progetti",
      active: "Attivi",
      pendingReview: "In attesa di revisione",
      avgProgress: "Avanzamento medio",
    },
    status: {
      Active: "Attivo",
      Pending: "In attesa",
      Delayed: "In ritardo",
      Completed: "Completato",
    },
    meta: {
      system: "Sistema",
      size: "Dimensione",
      pm: "PM",
      deadline: "Scadenza",
    },
    timeline: {
      heading: "Cronologia progetto",
      defaultLabel: "Progetto creato — design in corso",
      defaultDate: "Di recente",
    },
    action: {
      viewDesign: "Vedi design",
      reviewPending: "Revisione in attesa",
      approvals: "Approvazioni",
      documents: "Documenti",
      messagePm: "Scrivi al PM",
    },
  },
  pt: {
    pageTitle: "Meus projetos | ENS",
    title: "Meus projetos",
    breadcrumbDashboard: "Painel",
    breadcrumbProjects: "Projetos",
    actionRequired: "Ação necessária",
    exhibitionTbd: "Exposição a confirmar",
    productionProgress: "Progresso de produção",
    quickActions: "Ações rápidas",
    stat: {
      total: "Total projetos",
      active: "Ativos",
      pendingReview: "Revisão pendente",
      avgProgress: "Progresso médio",
    },
    status: {
      Active: "Ativo",
      Pending: "Pendente",
      Delayed: "Atrasado",
      Completed: "Concluído",
    },
    meta: {
      system: "Sistema",
      size: "Tamanho",
      pm: "Gerente",
      deadline: "Prazo",
    },
    timeline: {
      heading: "Cronograma do projeto",
      defaultLabel: "Projeto criado — design em andamento",
      defaultDate: "Recentemente",
    },
    action: {
      viewDesign: "Ver design",
      reviewPending: "Revisão pendente",
      approvals: "Aprovações",
      documents: "Documentos",
      messagePm: "Contatar gerente",
    },
  },
  nl: {
    pageTitle: "Mijn projecten | ENS",
    title: "Mijn projecten",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProjects: "Projecten",
    actionRequired: "Actie vereist",
    exhibitionTbd: "Beurs nog te bevestigen",
    productionProgress: "Productie voortgang",
    quickActions: "Snelle acties",
    stat: {
      total: "Totaal projecten",
      active: "Actief",
      pendingReview: "In beoordeling",
      avgProgress: "Gem. voortgang",
    },
    status: {
      Active: "Actief",
      Pending: "In behandeling",
      Delayed: "Vertraagd",
      Completed: "Voltooid",
    },
    meta: {
      system: "Systeem",
      size: "Grootte",
      pm: "PM",
      deadline: "Deadline",
    },
    timeline: {
      heading: "Projecttijdlijn",
      defaultLabel: "Project aangemaakt — ontwerp in uitvoering",
      defaultDate: "Recent",
    },
    action: {
      viewDesign: "Ontwerp bekijken",
      reviewPending: "Beoordeling in behandeling",
      approvals: "Goedkeuringen",
      documents: "Documenten",
      messagePm: "PM berichten",
    },
  },
  zh: {
    pageTitle: "我的项目 | ENS",
    title: "我的项目",
    breadcrumbDashboard: "仪表板",
    breadcrumbProjects: "项目",
    actionRequired: "需要操作",
    exhibitionTbd: "展会待定",
    productionProgress: "生产进度",
    quickActions: "快速操作",
    stat: {
      total: "项目总数",
      active: "进行中",
      pendingReview: "待审核",
      avgProgress: "平均进度",
    },
    status: {
      Active: "进行中",
      Pending: "待处理",
      Delayed: "已延迟",
      Completed: "已完成",
    },
    meta: {
      system: "系统",
      size: "尺寸",
      pm: "项目经理",
      deadline: "截止日期",
    },
    timeline: {
      heading: "项目时间线",
      defaultLabel: "项目已创建 — 设计进行中",
      defaultDate: "最近",
    },
    action: {
      viewDesign: "查看设计",
      reviewPending: "待审核",
      approvals: "审批",
      documents: "文档",
      messagePm: "联系项目经理",
    },
  },
  ja: {
    pageTitle: "マイプロジェクト | ENS",
    title: "マイプロジェクト",
    breadcrumbDashboard: "ダッシュボード",
    breadcrumbProjects: "プロジェクト",
    actionRequired: "対応が必要",
    exhibitionTbd: "展示会未定",
    productionProgress: "製作の進捗",
    quickActions: "クイックアクション",
    stat: {
      total: "プロジェクト総数",
      active: "進行中",
      pendingReview: "レビュー待ち",
      avgProgress: "平均進捗",
    },
    status: {
      Active: "進行中",
      Pending: "保留中",
      Delayed: "遅延",
      Completed: "完了",
    },
    meta: {
      system: "システム",
      size: "サイズ",
      pm: "PM",
      deadline: "締切",
    },
    timeline: {
      heading: "プロジェクトタイムライン",
      defaultLabel: "プロジェクト作成済み — デザイン進行中",
      defaultDate: "最近",
    },
    action: {
      viewDesign: "デザインを見る",
      reviewPending: "レビュー待ち",
      approvals: "承認",
      documents: "ドキュメント",
      messagePm: "PMに連絡",
    },
  },
  ar: {
    pageTitle: "مشاريعي | ENS",
    title: "مشاريعي",
    breadcrumbDashboard: "لوحة التحكم",
    breadcrumbProjects: "المشاريع",
    actionRequired: "إجراء مطلوب",
    exhibitionTbd: "المعرض لم يتحدد بعد",
    productionProgress: "تقدم الإنتاج",
    quickActions: "إجراءات سريعة",
    stat: {
      total: "إجمالي المشاريع",
      active: "نشط",
      pendingReview: "في انتظار المراجعة",
      avgProgress: "متوسط التقدم",
    },
    status: {
      Active: "نشط",
      Pending: "قيد الانتظار",
      Delayed: "متأخر",
      Completed: "مكتمل",
    },
    meta: {
      system: "النظام",
      size: "الحجم",
      pm: "مدير المشروع",
      deadline: "الموعد النهائي",
    },
    timeline: {
      heading: "الجدول الزمني للمشروع",
      defaultLabel: "تم إنشاء المشروع — التصميم جارٍ",
      defaultDate: "مؤخراً",
    },
    action: {
      viewDesign: "عرض التصميم",
      reviewPending: "مراجعة معلقة",
      approvals: "الموافقات",
      documents: "المستندات",
      messagePm: "مراسلة مدير المشروع",
    },
  },
  tr: {
    pageTitle: "Projelerim | ENS",
    title: "Projelerim",
    breadcrumbDashboard: "Gösterge Paneli",
    breadcrumbProjects: "Projeler",
    actionRequired: "İşlem Gerekli",
    exhibitionTbd: "Fuar Belirlenmedi",
    productionProgress: "Üretim İlerlemesi",
    quickActions: "Hızlı İşlemler",
    stat: {
      total: "Toplam Proje",
      active: "Aktif",
      pendingReview: "İnceleme Bekliyor",
      avgProgress: "Ort. İlerleme",
    },
    status: {
      Active: "Aktif",
      Pending: "Bekliyor",
      Delayed: "Gecikmiş",
      Completed: "Tamamlandı",
    },
    meta: {
      system: "Sistem",
      size: "Boyut",
      pm: "PM",
      deadline: "Son Tarih",
    },
    timeline: {
      heading: "Proje Zaman Çizelgesi",
      defaultLabel: "Proje oluşturuldu — tasarım devam ediyor",
      defaultDate: "Son zamanlarda",
    },
    action: {
      viewDesign: "Tasarımı Gör",
      reviewPending: "İnceleme Bekliyor",
      approvals: "Onaylar",
      documents: "Belgeler",
      messagePm: "PM'e Mesaj Gönder",
    },
  },
};

function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(target[key] ?? {}, source[key]);
    } else if (!(key in result)) {
      result[key] = source[key];
    }
  }
  return result;
}

let updated = 0;
let skipped = 0;

for (const [lang, keys] of Object.entries(TRANSLATIONS)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP  ${lang} — file not found`);
    skipped++;
    continue;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);

  if (!json.client) json.client = {};
  if (!json.client.projects) json.client.projects = {};

  json.client.projects = deepMerge(json.client.projects, keys);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
