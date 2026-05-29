/**
 * add-client-documents.cjs
 * Adds client.documents.* keys to all 11 locale files.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const TRANSLATIONS = {
  en: {
    pageTitle: "Documents | ENS",
    title: "Documents",
    breadcrumbDashboard: "Dashboard",
    uploadBtn: "Upload Files",
    filterGroup: "Filter by category",
    searchPlaceholder: "Search files, tags…",
    emptyState: "No documents found.",
    filter: { all: "All" },
    stat: {
      total: "Total Files",
      final: "Final",
      inReview: "In Review",
      drafts: "Drafts",
    },
    status: {
      final: "Final",
      draft: "Draft",
      review: "In Review",
    },
    dropZone: {
      ariaLabel: "File upload drop zone",
      textBefore: "Drag and drop files here, or",
      browse: "browse",
      hint: "PDF, PNG, XLSX, DOC — up to 50 MB per file",
    },
    table: {
      file: "File",
      category: "Category",
      uploadedBy: "Uploaded By",
      date: "Date",
      status: "Status",
    },
    actions: {
      preview: "Preview {{name}}",
      download: "Download {{name}}",
      remove: "Remove {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} file uploaded",
      uploaded_other: "{{count}} files uploaded",
      fileRemoved: "File removed",
      downloading: "Downloading {{name}}…",
    },
    preview: {
      close: "Close preview",
      imageUnavailable: "Image preview not available in demo",
      typeUnavailable: "Preview not available for {{type}} files",
      category: "Category",
      status: "Status",
      uploadedBy: "Uploaded by",
      tags: "Tags",
      downloadBtn: "Download File",
    },
  },
  de: {
    pageTitle: "Dokumente | ENS",
    title: "Dokumente",
    breadcrumbDashboard: "Dashboard",
    uploadBtn: "Dateien hochladen",
    filterGroup: "Nach Kategorie filtern",
    searchPlaceholder: "Dateien, Tags suchen…",
    emptyState: "Keine Dokumente gefunden.",
    filter: { all: "Alle" },
    stat: {
      total: "Dateien gesamt",
      final: "Final",
      inReview: "In Prüfung",
      drafts: "Entwürfe",
    },
    status: {
      final: "Final",
      draft: "Entwurf",
      review: "In Prüfung",
    },
    dropZone: {
      ariaLabel: "Datei-Upload-Bereich",
      textBefore: "Dateien hierher ziehen oder",
      browse: "durchsuchen",
      hint: "PDF, PNG, XLSX, DOC — bis zu 50 MB pro Datei",
    },
    table: {
      file: "Datei",
      category: "Kategorie",
      uploadedBy: "Hochgeladen von",
      date: "Datum",
      status: "Status",
    },
    actions: {
      preview: "Vorschau {{name}}",
      download: "Herunterladen {{name}}",
      remove: "Entfernen {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} Datei hochgeladen",
      uploaded_other: "{{count}} Dateien hochgeladen",
      fileRemoved: "Datei entfernt",
      downloading: "{{name}} wird heruntergeladen…",
    },
    preview: {
      close: "Vorschau schließen",
      imageUnavailable: "Bildvorschau im Demo nicht verfügbar",
      typeUnavailable: "Vorschau für {{type}}-Dateien nicht verfügbar",
      category: "Kategorie",
      status: "Status",
      uploadedBy: "Hochgeladen von",
      tags: "Tags",
      downloadBtn: "Datei herunterladen",
    },
  },
  fr: {
    pageTitle: "Documents | ENS",
    title: "Documents",
    breadcrumbDashboard: "Tableau de bord",
    uploadBtn: "Téléverser des fichiers",
    filterGroup: "Filtrer par catégorie",
    searchPlaceholder: "Rechercher fichiers, tags…",
    emptyState: "Aucun document trouvé.",
    filter: { all: "Tous" },
    stat: {
      total: "Total fichiers",
      final: "Finaux",
      inReview: "En révision",
      drafts: "Brouillons",
    },
    status: {
      final: "Final",
      draft: "Brouillon",
      review: "En révision",
    },
    dropZone: {
      ariaLabel: "Zone de dépôt de fichiers",
      textBefore: "Glissez-déposez des fichiers ici ou",
      browse: "parcourir",
      hint: "PDF, PNG, XLSX, DOC — jusqu'à 50 Mo par fichier",
    },
    table: {
      file: "Fichier",
      category: "Catégorie",
      uploadedBy: "Téléversé par",
      date: "Date",
      status: "Statut",
    },
    actions: {
      preview: "Aperçu de {{name}}",
      download: "Télécharger {{name}}",
      remove: "Supprimer {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} fichier téléversé",
      uploaded_other: "{{count}} fichiers téléversés",
      fileRemoved: "Fichier supprimé",
      downloading: "Téléchargement de {{name}}…",
    },
    preview: {
      close: "Fermer l'aperçu",
      imageUnavailable: "Aperçu d'image non disponible dans la démo",
      typeUnavailable: "Aperçu non disponible pour les fichiers {{type}}",
      category: "Catégorie",
      status: "Statut",
      uploadedBy: "Téléversé par",
      tags: "Tags",
      downloadBtn: "Télécharger le fichier",
    },
  },
  es: {
    pageTitle: "Documentos | ENS",
    title: "Documentos",
    breadcrumbDashboard: "Panel",
    uploadBtn: "Subir archivos",
    filterGroup: "Filtrar por categoría",
    searchPlaceholder: "Buscar archivos, etiquetas…",
    emptyState: "No se encontraron documentos.",
    filter: { all: "Todos" },
    stat: {
      total: "Total archivos",
      final: "Finales",
      inReview: "En revisión",
      drafts: "Borradores",
    },
    status: {
      final: "Final",
      draft: "Borrador",
      review: "En revisión",
    },
    dropZone: {
      ariaLabel: "Zona de carga de archivos",
      textBefore: "Arrastre y suelte archivos aquí o",
      browse: "explorar",
      hint: "PDF, PNG, XLSX, DOC — hasta 50 MB por archivo",
    },
    table: {
      file: "Archivo",
      category: "Categoría",
      uploadedBy: "Subido por",
      date: "Fecha",
      status: "Estado",
    },
    actions: {
      preview: "Vista previa de {{name}}",
      download: "Descargar {{name}}",
      remove: "Eliminar {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} archivo subido",
      uploaded_other: "{{count}} archivos subidos",
      fileRemoved: "Archivo eliminado",
      downloading: "Descargando {{name}}…",
    },
    preview: {
      close: "Cerrar vista previa",
      imageUnavailable: "Vista previa de imagen no disponible en demo",
      typeUnavailable: "Vista previa no disponible para archivos {{type}}",
      category: "Categoría",
      status: "Estado",
      uploadedBy: "Subido por",
      tags: "Etiquetas",
      downloadBtn: "Descargar archivo",
    },
  },
  it: {
    pageTitle: "Documenti | ENS",
    title: "Documenti",
    breadcrumbDashboard: "Dashboard",
    uploadBtn: "Carica file",
    filterGroup: "Filtra per categoria",
    searchPlaceholder: "Cerca file, tag…",
    emptyState: "Nessun documento trovato.",
    filter: { all: "Tutti" },
    stat: {
      total: "File totali",
      final: "Definitivi",
      inReview: "In revisione",
      drafts: "Bozze",
    },
    status: {
      final: "Definitivo",
      draft: "Bozza",
      review: "In revisione",
    },
    dropZone: {
      ariaLabel: "Area di caricamento file",
      textBefore: "Trascina i file qui oppure",
      browse: "sfoglia",
      hint: "PDF, PNG, XLSX, DOC — fino a 50 MB per file",
    },
    table: {
      file: "File",
      category: "Categoria",
      uploadedBy: "Caricato da",
      date: "Data",
      status: "Stato",
    },
    actions: {
      preview: "Anteprima di {{name}}",
      download: "Scarica {{name}}",
      remove: "Rimuovi {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} file caricato",
      uploaded_other: "{{count}} file caricati",
      fileRemoved: "File rimosso",
      downloading: "Download di {{name}} in corso…",
    },
    preview: {
      close: "Chiudi anteprima",
      imageUnavailable: "Anteprima immagine non disponibile nella demo",
      typeUnavailable: "Anteprima non disponibile per file {{type}}",
      category: "Categoria",
      status: "Stato",
      uploadedBy: "Caricato da",
      tags: "Tag",
      downloadBtn: "Scarica file",
    },
  },
  pt: {
    pageTitle: "Documentos | ENS",
    title: "Documentos",
    breadcrumbDashboard: "Painel",
    uploadBtn: "Enviar arquivos",
    filterGroup: "Filtrar por categoria",
    searchPlaceholder: "Pesquisar arquivos, tags…",
    emptyState: "Nenhum documento encontrado.",
    filter: { all: "Todos" },
    stat: {
      total: "Total de arquivos",
      final: "Finais",
      inReview: "Em revisão",
      drafts: "Rascunhos",
    },
    status: {
      final: "Final",
      draft: "Rascunho",
      review: "Em revisão",
    },
    dropZone: {
      ariaLabel: "Área de upload de arquivos",
      textBefore: "Arraste e solte arquivos aqui ou",
      browse: "procurar",
      hint: "PDF, PNG, XLSX, DOC — até 50 MB por arquivo",
    },
    table: {
      file: "Arquivo",
      category: "Categoria",
      uploadedBy: "Enviado por",
      date: "Data",
      status: "Status",
    },
    actions: {
      preview: "Visualizar {{name}}",
      download: "Baixar {{name}}",
      remove: "Remover {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} arquivo enviado",
      uploaded_other: "{{count}} arquivos enviados",
      fileRemoved: "Arquivo removido",
      downloading: "Baixando {{name}}…",
    },
    preview: {
      close: "Fechar visualização",
      imageUnavailable: "Visualização de imagem não disponível na demo",
      typeUnavailable: "Visualização não disponível para arquivos {{type}}",
      category: "Categoria",
      status: "Status",
      uploadedBy: "Enviado por",
      tags: "Tags",
      downloadBtn: "Baixar arquivo",
    },
  },
  nl: {
    pageTitle: "Documenten | ENS",
    title: "Documenten",
    breadcrumbDashboard: "Dashboard",
    uploadBtn: "Bestanden uploaden",
    filterGroup: "Filteren op categorie",
    searchPlaceholder: "Zoek bestanden, tags…",
    emptyState: "Geen documenten gevonden.",
    filter: { all: "Alle" },
    stat: {
      total: "Totaal bestanden",
      final: "Definitief",
      inReview: "In beoordeling",
      drafts: "Concepten",
    },
    status: {
      final: "Definitief",
      draft: "Concept",
      review: "In beoordeling",
    },
    dropZone: {
      ariaLabel: "Bestand upload dropzone",
      textBefore: "Sleep bestanden hierheen of",
      browse: "bladeren",
      hint: "PDF, PNG, XLSX, DOC — tot 50 MB per bestand",
    },
    table: {
      file: "Bestand",
      category: "Categorie",
      uploadedBy: "Geüpload door",
      date: "Datum",
      status: "Status",
    },
    actions: {
      preview: "Voorbeeld van {{name}}",
      download: "Download {{name}}",
      remove: "Verwijder {{name}}",
    },
    toast: {
      uploaded_one: "{{count}} bestand geüpload",
      uploaded_other: "{{count}} bestanden geüpload",
      fileRemoved: "Bestand verwijderd",
      downloading: "{{name}} wordt gedownload…",
    },
    preview: {
      close: "Voorbeeld sluiten",
      imageUnavailable: "Afbeeldingsvoorbeeld niet beschikbaar in demo",
      typeUnavailable: "Voorbeeld niet beschikbaar voor {{type}}-bestanden",
      category: "Categorie",
      status: "Status",
      uploadedBy: "Geüpload door",
      tags: "Tags",
      downloadBtn: "Bestand downloaden",
    },
  },
  zh: {
    pageTitle: "文档 | ENS",
    title: "文档",
    breadcrumbDashboard: "仪表板",
    uploadBtn: "上传文件",
    filterGroup: "按类别筛选",
    searchPlaceholder: "搜索文件、标签…",
    emptyState: "未找到文档。",
    filter: { all: "全部" },
    stat: {
      total: "文件总数",
      final: "最终版",
      inReview: "审核中",
      drafts: "草稿",
    },
    status: {
      final: "最终版",
      draft: "草稿",
      review: "审核中",
    },
    dropZone: {
      ariaLabel: "文件上传区域",
      textBefore: "将文件拖放至此，或",
      browse: "浏览",
      hint: "PDF、PNG、XLSX、DOC — 每个文件最大50MB",
    },
    table: {
      file: "文件",
      category: "类别",
      uploadedBy: "上传者",
      date: "日期",
      status: "状态",
    },
    actions: {
      preview: "预览 {{name}}",
      download: "下载 {{name}}",
      remove: "删除 {{name}}",
    },
    toast: {
      uploaded_one: "已上传 {{count}} 个文件",
      uploaded_other: "已上传 {{count}} 个文件",
      fileRemoved: "文件已删除",
      downloading: "正在下载 {{name}}…",
    },
    preview: {
      close: "关闭预览",
      imageUnavailable: "演示版本中无法预览图片",
      typeUnavailable: "无法预览 {{type}} 文件",
      category: "类别",
      status: "状态",
      uploadedBy: "上传者",
      tags: "标签",
      downloadBtn: "下载文件",
    },
  },
  ja: {
    pageTitle: "ドキュメント | ENS",
    title: "ドキュメント",
    breadcrumbDashboard: "ダッシュボード",
    uploadBtn: "ファイルをアップロード",
    filterGroup: "カテゴリでフィルター",
    searchPlaceholder: "ファイル、タグを検索…",
    emptyState: "ドキュメントが見つかりません。",
    filter: { all: "すべて" },
    stat: {
      total: "ファイル総数",
      final: "確定版",
      inReview: "レビュー中",
      drafts: "下書き",
    },
    status: {
      final: "確定版",
      draft: "下書き",
      review: "レビュー中",
    },
    dropZone: {
      ariaLabel: "ファイルアップロードエリア",
      textBefore: "ファイルをここにドラッグ＆ドロップ、または",
      browse: "参照",
      hint: "PDF、PNG、XLSX、DOC — ファイルあたり最大50MB",
    },
    table: {
      file: "ファイル",
      category: "カテゴリ",
      uploadedBy: "アップロード者",
      date: "日付",
      status: "ステータス",
    },
    actions: {
      preview: "{{name}}をプレビュー",
      download: "{{name}}をダウンロード",
      remove: "{{name}}を削除",
    },
    toast: {
      uploaded_one: "{{count}}件のファイルをアップロードしました",
      uploaded_other: "{{count}}件のファイルをアップロードしました",
      fileRemoved: "ファイルを削除しました",
      downloading: "{{name}}をダウンロード中…",
    },
    preview: {
      close: "プレビューを閉じる",
      imageUnavailable: "デモでは画像プレビューは利用できません",
      typeUnavailable: "{{type}}ファイルのプレビューは利用できません",
      category: "カテゴリ",
      status: "ステータス",
      uploadedBy: "アップロード者",
      tags: "タグ",
      downloadBtn: "ファイルをダウンロード",
    },
  },
  ar: {
    pageTitle: "المستندات | ENS",
    title: "المستندات",
    breadcrumbDashboard: "لوحة التحكم",
    uploadBtn: "رفع الملفات",
    filterGroup: "تصفية حسب الفئة",
    searchPlaceholder: "البحث في الملفات والعلامات…",
    emptyState: "لم يتم العثور على مستندات.",
    filter: { all: "الكل" },
    stat: {
      total: "إجمالي الملفات",
      final: "نهائي",
      inReview: "قيد المراجعة",
      drafts: "مسودات",
    },
    status: {
      final: "نهائي",
      draft: "مسودة",
      review: "قيد المراجعة",
    },
    dropZone: {
      ariaLabel: "منطقة رفع الملفات",
      textBefore: "اسحب وأفلت الملفات هنا أو",
      browse: "تصفح",
      hint: "PDF، PNG، XLSX، DOC — حتى 50 ميجابايت لكل ملف",
    },
    table: {
      file: "الملف",
      category: "الفئة",
      uploadedBy: "رُفع بواسطة",
      date: "التاريخ",
      status: "الحالة",
    },
    actions: {
      preview: "معاينة {{name}}",
      download: "تنزيل {{name}}",
      remove: "إزالة {{name}}",
    },
    toast: {
      uploaded_one: "تم رفع {{count}} ملف",
      uploaded_other: "تم رفع {{count}} ملفات",
      fileRemoved: "تمت إزالة الملف",
      downloading: "جارٍ تنزيل {{name}}…",
    },
    preview: {
      close: "إغلاق المعاينة",
      imageUnavailable: "معاينة الصورة غير متاحة في العرض التوضيحي",
      typeUnavailable: "المعاينة غير متاحة لملفات {{type}}",
      category: "الفئة",
      status: "الحالة",
      uploadedBy: "رُفع بواسطة",
      tags: "العلامات",
      downloadBtn: "تنزيل الملف",
    },
  },
  tr: {
    pageTitle: "Belgeler | ENS",
    title: "Belgeler",
    breadcrumbDashboard: "Gösterge Paneli",
    uploadBtn: "Dosya Yükle",
    filterGroup: "Kategoriye göre filtrele",
    searchPlaceholder: "Dosya, etiket ara…",
    emptyState: "Belge bulunamadı.",
    filter: { all: "Tümü" },
    stat: {
      total: "Toplam Dosya",
      final: "Son Hali",
      inReview: "İncelemede",
      drafts: "Taslaklar",
    },
    status: {
      final: "Son Hali",
      draft: "Taslak",
      review: "İncelemede",
    },
    dropZone: {
      ariaLabel: "Dosya yükleme alanı",
      textBefore: "Dosyaları buraya sürükleyin veya",
      browse: "gözat",
      hint: "PDF, PNG, XLSX, DOC — dosya başına 50 MB'a kadar",
    },
    table: {
      file: "Dosya",
      category: "Kategori",
      uploadedBy: "Yükleyen",
      date: "Tarih",
      status: "Durum",
    },
    actions: {
      preview: "{{name}} önizleme",
      download: "{{name}} indir",
      remove: "{{name}} kaldır",
    },
    toast: {
      uploaded_one: "{{count}} dosya yüklendi",
      uploaded_other: "{{count}} dosya yüklendi",
      fileRemoved: "Dosya kaldırıldı",
      downloading: "{{name}} indiriliyor…",
    },
    preview: {
      close: "Önizlemeyi kapat",
      imageUnavailable: "Görüntü önizlemesi demoda mevcut değil",
      typeUnavailable: "{{type}} dosyaları için önizleme mevcut değil",
      category: "Kategori",
      status: "Durum",
      uploadedBy: "Yükleyen",
      tags: "Etiketler",
      downloadBtn: "Dosyayı İndir",
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
  if (!json.client.documents) json.client.documents = {};

  json.client.documents = deepMerge(json.client.documents, keys);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
