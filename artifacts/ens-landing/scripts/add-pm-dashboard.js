const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "../src/i18n/locales");

const translations = {
  de: {
    common: {
      noDeadline: "Kein Termin", today: "Heute", tomorrow: "Morgen",
      overdue: "{{count}}T überfällig", inDays: "In {{count}}T",
      loading: "Wird geladen...", noResults: "Keine Ergebnisse gefunden.",
      cancel: "Abbrechen", save: "Speichern", create: "Erstellen",
      saving: "Wird gespeichert...", search: "Suchen", filter: "Filter",
      priority: { high: "Hoch", medium: "Mittel", low: "Niedrig" },
      status: { active: "Aktiv", pending: "Ausstehend", lead: "Lead", inactive: "Inaktiv",
        planning: "Planung", inDesign: "Im Entwurf", clientReview: "Kundenbewertung",
        revision: "Überarbeitung", delayed: "Verzögert", approved: "Genehmigt",
        completed: "Abgeschlossen", inProgress: "In Bearbeitung", resolved: "Gelöst", declined: "Abgelehnt" }
    },
    dashboard: {
      title: "Projektmanager-Dashboard", overview: "Übersicht",
      loadError: "Dashboard-Daten konnten nicht geladen werden.",
      stats: { assignedClients: "Zugewiesene Kunden", activeProjects: "Aktive Projekte",
        pendingReviews: "Ausstehende Überprüfungen", completed: "Abgeschlossen", workspaceFiles: "Arbeitsbereichsdateien" },
      activeWork: { title: "Aktive Projektarbeit", viewAll: "Alle anzeigen",
        loading: "Lade zugewiesene Projektarbeit...", empty: "Derzeit sind keine Projekte zugewiesen.", openProject: "{{name}} öffnen" },
      actionItems: { title: "Aufgaben", loading: "Lade Aufgaben...", empty: "Keine dringenden Aktionen für diese Organisation." },
      actions: { pendingApprovals: "{{count}} ausstehende Genehmigungen",
        pendingApprovalsDesc: "Kundenbewertungen warten auf eine Entscheidung.", openApprovals: "Genehmigungen öffnen",
        delayedProjects: "{{count}} verzögerte Projekte", delayedProjectsDesc: "Projekte benötigen PM-Aufmerksamkeit.",
        reviewRisk: "Risiko prüfen", activeWorkspaces: "{{count}} aktive Arbeitsbereiche",
        activeWorkspacesDesc: "Booth-Designs sind zur Bearbeitung verfügbar.", openWorkspace: "Arbeitsbereich öffnen" },
      recentActivity: { title: "Letzte Aktivitäten", loading: "Lade Aktivitäten...", empty: "Es wurden noch keine Aktivitätsereignisse aufgezeichnet." }
    }
  },
  fr: {
    common: {
      noDeadline: "Pas d'échéance", today: "Aujourd'hui", tomorrow: "Demain",
      overdue: "{{count}}j de retard", inDays: "Dans {{count}}j",
      loading: "Chargement...", noResults: "Aucun résultat trouvé.",
      cancel: "Annuler", save: "Enregistrer", create: "Créer",
      saving: "Enregistrement...", search: "Rechercher", filter: "Filtrer",
      priority: { high: "Élevé", medium: "Moyen", low: "Faible" },
      status: { active: "Actif", pending: "En attente", lead: "Prospect", inactive: "Inactif",
        planning: "Planification", inDesign: "En conception", clientReview: "Révision client",
        revision: "Révision", delayed: "Retardé", approved: "Approuvé",
        completed: "Terminé", inProgress: "En cours", resolved: "Résolu", declined: "Refusé" }
    },
    dashboard: {
      title: "Tableau de bord PM", overview: "Aperçu",
      loadError: "Impossible de charger les données du tableau de bord.",
      stats: { assignedClients: "Clients assignés", activeProjects: "Projets actifs",
        pendingReviews: "Révisions en attente", completed: "Terminé", workspaceFiles: "Fichiers d'espace de travail" },
      activeWork: { title: "Travail de projet actif", viewAll: "Voir tout",
        loading: "Chargement du travail de projet assigné...", empty: "Aucun projet actif assigné pour le moment.", openProject: "Ouvrir {{name}}" },
      actionItems: { title: "Actions requises", loading: "Chargement des actions...", empty: "Aucune action urgente pour cette organisation." },
      actions: { pendingApprovals: "{{count}} approbations en attente",
        pendingApprovalsDesc: "Des révisions clients attendent une décision.", openApprovals: "Ouvrir les approbations",
        delayedProjects: "{{count}} projets retardés", delayedProjectsDesc: "Des projets nécessitent l'attention du PM.",
        reviewRisk: "Examiner les risques", activeWorkspaces: "{{count}} espaces de travail actifs",
        activeWorkspacesDesc: "Des designs de stands sont disponibles pour édition.", openWorkspace: "Ouvrir l'espace de travail" },
      recentActivity: { title: "Activité récente", loading: "Chargement de l'activité...", empty: "Aucun événement d'activité enregistré pour l'instant." }
    }
  },
  es: {
    common: {
      noDeadline: "Sin fecha límite", today: "Hoy", tomorrow: "Mañana",
      overdue: "{{count}}d de retraso", inDays: "En {{count}}d",
      loading: "Cargando...", noResults: "No se encontraron resultados.",
      cancel: "Cancelar", save: "Guardar", create: "Crear",
      saving: "Guardando...", search: "Buscar", filter: "Filtrar",
      priority: { high: "Alto", medium: "Medio", low: "Bajo" },
      status: { active: "Activo", pending: "Pendiente", lead: "Prospecto", inactive: "Inactivo",
        planning: "Planificación", inDesign: "En diseño", clientReview: "Revisión del cliente",
        revision: "Revisión", delayed: "Retrasado", approved: "Aprobado",
        completed: "Completado", inProgress: "En progreso", resolved: "Resuelto", declined: "Rechazado" }
    },
    dashboard: {
      title: "Panel del Gestor de Proyectos", overview: "Resumen",
      loadError: "No se pudieron cargar los datos del panel.",
      stats: { assignedClients: "Clientes asignados", activeProjects: "Proyectos activos",
        pendingReviews: "Revisiones pendientes", completed: "Completado", workspaceFiles: "Archivos de espacio de trabajo" },
      activeWork: { title: "Trabajo de proyecto activo", viewAll: "Ver todo",
        loading: "Cargando trabajo de proyecto asignado...", empty: "No hay proyectos activos asignados actualmente.", openProject: "Abrir {{name}}" },
      actionItems: { title: "Elementos de acción", loading: "Cargando elementos de acción...", empty: "No hay acciones urgentes para esta organización." },
      actions: { pendingApprovals: "{{count}} aprobaciones pendientes",
        pendingApprovalsDesc: "Las revisiones de clientes esperan una decisión.", openApprovals: "Abrir aprobaciones",
        delayedProjects: "{{count}} proyectos retrasados", delayedProjectsDesc: "Los proyectos necesitan atención del PM.",
        reviewRisk: "Revisar riesgo", activeWorkspaces: "{{count}} espacios de trabajo activos",
        activeWorkspacesDesc: "Los diseños de stands están disponibles para edición.", openWorkspace: "Abrir espacio de trabajo" },
      recentActivity: { title: "Actividad reciente", loading: "Cargando actividad...", empty: "No se han registrado eventos de actividad aún." }
    }
  },
  it: {
    common: {
      noDeadline: "Nessuna scadenza", today: "Oggi", tomorrow: "Domani",
      overdue: "{{count}}g di ritardo", inDays: "Tra {{count}}g",
      loading: "Caricamento...", noResults: "Nessun risultato trovato.",
      cancel: "Annulla", save: "Salva", create: "Crea",
      saving: "Salvataggio...", search: "Cerca", filter: "Filtra",
      priority: { high: "Alto", medium: "Medio", low: "Basso" },
      status: { active: "Attivo", pending: "In attesa", lead: "Lead", inactive: "Inattivo",
        planning: "Pianificazione", inDesign: "In progettazione", clientReview: "Revisione cliente",
        revision: "Revisione", delayed: "In ritardo", approved: "Approvato",
        completed: "Completato", inProgress: "In corso", resolved: "Risolto", declined: "Rifiutato" }
    },
    dashboard: {
      title: "Dashboard PM", overview: "Panoramica",
      loadError: "Impossibile caricare i dati della dashboard.",
      stats: { assignedClients: "Clienti assegnati", activeProjects: "Progetti attivi",
        pendingReviews: "Revisioni in sospeso", completed: "Completato", workspaceFiles: "File di lavoro" },
      activeWork: { title: "Lavoro di progetto attivo", viewAll: "Vedi tutto",
        loading: "Caricamento lavoro di progetto...", empty: "Nessun progetto attivo assegnato al momento.", openProject: "Apri {{name}}" },
      actionItems: { title: "Elementi di azione", loading: "Caricamento elementi di azione...", empty: "Nessuna azione urgente per questa organizzazione." },
      actions: { pendingApprovals: "{{count}} approvazioni in sospeso",
        pendingApprovalsDesc: "Le revisioni client attendono una decisione.", openApprovals: "Apri approvazioni",
        delayedProjects: "{{count}} progetti in ritardo", delayedProjectsDesc: "I progetti richiedono attenzione del PM.",
        reviewRisk: "Esamina il rischio", activeWorkspaces: "{{count}} aree di lavoro attive",
        activeWorkspacesDesc: "I design degli stand sono disponibili per la modifica.", openWorkspace: "Apri area di lavoro" },
      recentActivity: { title: "Attività recente", loading: "Caricamento attività...", empty: "Nessun evento di attività registrato ancora." }
    }
  },
  pt: {
    common: {
      noDeadline: "Sem prazo", today: "Hoje", tomorrow: "Amanhã",
      overdue: "{{count}}d de atraso", inDays: "Em {{count}}d",
      loading: "Carregando...", noResults: "Nenhum resultado encontrado.",
      cancel: "Cancelar", save: "Salvar", create: "Criar",
      saving: "Salvando...", search: "Buscar", filter: "Filtrar",
      priority: { high: "Alto", medium: "Médio", low: "Baixo" },
      status: { active: "Ativo", pending: "Pendente", lead: "Lead", inactive: "Inativo",
        planning: "Planejamento", inDesign: "Em design", clientReview: "Revisão do cliente",
        revision: "Revisão", delayed: "Atrasado", approved: "Aprovado",
        completed: "Concluído", inProgress: "Em andamento", resolved: "Resolvido", declined: "Recusado" }
    },
    dashboard: {
      title: "Painel do Gestor de Projetos", overview: "Visão geral",
      loadError: "Não foi possível carregar os dados do painel.",
      stats: { assignedClients: "Clientes atribuídos", activeProjects: "Projetos ativos",
        pendingReviews: "Revisões pendentes", completed: "Concluído", workspaceFiles: "Arquivos de espaço de trabalho" },
      activeWork: { title: "Trabalho de projeto ativo", viewAll: "Ver tudo",
        loading: "Carregando trabalho de projeto atribuído...", empty: "Nenhum projeto ativo atribuído no momento.", openProject: "Abrir {{name}}" },
      actionItems: { title: "Itens de ação", loading: "Carregando itens de ação...", empty: "Nenhuma ação urgente para esta organização." },
      actions: { pendingApprovals: "{{count}} aprovações pendentes",
        pendingApprovalsDesc: "Revisões de clientes aguardam uma decisão.", openApprovals: "Abrir aprovações",
        delayedProjects: "{{count}} projetos atrasados", delayedProjectsDesc: "Projetos precisam de atenção do PM.",
        reviewRisk: "Revisar risco", activeWorkspaces: "{{count}} espaços de trabalho ativos",
        activeWorkspacesDesc: "Designs de estandes disponíveis para edição.", openWorkspace: "Abrir espaço de trabalho" },
      recentActivity: { title: "Atividade recente", loading: "Carregando atividade...", empty: "Nenhum evento de atividade registrado ainda." }
    }
  },
  nl: {
    common: {
      noDeadline: "Geen deadline", today: "Vandaag", tomorrow: "Morgen",
      overdue: "{{count}}d te laat", inDays: "Over {{count}}d",
      loading: "Laden...", noResults: "Geen resultaten gevonden.",
      cancel: "Annuleren", save: "Opslaan", create: "Aanmaken",
      saving: "Opslaan...", search: "Zoeken", filter: "Filteren",
      priority: { high: "Hoog", medium: "Middel", low: "Laag" },
      status: { active: "Actief", pending: "In afwachting", lead: "Lead", inactive: "Inactief",
        planning: "Planning", inDesign: "In ontwerp", clientReview: "Klantbeoordeling",
        revision: "Revisie", delayed: "Vertraagd", approved: "Goedgekeurd",
        completed: "Voltooid", inProgress: "In uitvoering", resolved: "Opgelost", declined: "Afgewezen" }
    },
    dashboard: {
      title: "PM-dashboard", overview: "Overzicht",
      loadError: "Dashboard-gegevens konden niet worden geladen.",
      stats: { assignedClients: "Toegewezen klanten", activeProjects: "Actieve projecten",
        pendingReviews: "Openstaande beoordelingen", completed: "Voltooid", workspaceFiles: "Werkruimtebestanden" },
      activeWork: { title: "Actief projectwerk", viewAll: "Alles bekijken",
        loading: "Toegewezen projectwerk laden...", empty: "Momenteel zijn er geen actieve projecten toegewezen.", openProject: "{{name}} openen" },
      actionItems: { title: "Actiepunten", loading: "Actiepunten laden...", empty: "Geen urgente acties voor deze organisatie." },
      actions: { pendingApprovals: "{{count}} openstaande goedkeuringen",
        pendingApprovalsDesc: "Klantbeoordelingen wachten op een beslissing.", openApprovals: "Goedkeuringen openen",
        delayedProjects: "{{count}} vertraagde projecten", delayedProjectsDesc: "Projecten hebben PM-aandacht nodig.",
        reviewRisk: "Risico beoordelen", activeWorkspaces: "{{count}} actieve werkruimten",
        activeWorkspacesDesc: "Standontwerpen zijn beschikbaar voor bewerking.", openWorkspace: "Werkruimte openen" },
      recentActivity: { title: "Recente activiteit", loading: "Activiteit laden...", empty: "Er zijn nog geen activiteitsgebeurtenissen geregistreerd." }
    }
  },
  zh: {
    common: {
      noDeadline: "无截止日期", today: "今天", tomorrow: "明天",
      overdue: "逾期 {{count}} 天", inDays: "{{count}} 天后",
      loading: "加载中...", noResults: "未找到结果。",
      cancel: "取消", save: "保存", create: "创建",
      saving: "保存中...", search: "搜索", filter: "筛选",
      priority: { high: "高", medium: "中", low: "低" },
      status: { active: "活跃", pending: "待处理", lead: "潜在客户", inactive: "不活跃",
        planning: "规划中", inDesign: "设计中", clientReview: "客户审核",
        revision: "修订", delayed: "已延迟", approved: "已批准",
        completed: "已完成", inProgress: "进行中", resolved: "已解决", declined: "已拒绝" }
    },
    dashboard: {
      title: "项目经理仪表板", overview: "概览",
      loadError: "无法加载仪表板数据。",
      stats: { assignedClients: "已分配客户", activeProjects: "活跃项目",
        pendingReviews: "待审核", completed: "已完成", workspaceFiles: "工作区文件" },
      activeWork: { title: "活跃项目工作", viewAll: "查看全部",
        loading: "正在加载分配的项目工作...", empty: "目前没有分配的活跃项目。", openProject: "打开 {{name}}" },
      actionItems: { title: "行动项目", loading: "正在加载行动项目...", empty: "该组织目前没有紧急操作。" },
      actions: { pendingApprovals: "{{count}} 个待处理审批",
        pendingApprovalsDesc: "客户审核工作正在等待决定。", openApprovals: "打开审批",
        delayedProjects: "{{count}} 个延迟项目", delayedProjectsDesc: "项目需要 PM 关注。",
        reviewRisk: "查看风险", activeWorkspaces: "{{count}} 个活跃工作区",
        activeWorkspacesDesc: "展台设计可供编辑。", openWorkspace: "打开工作区" },
      recentActivity: { title: "近期活动", loading: "正在加载活动...", empty: "尚未记录任何活动事件。" }
    }
  },
  ja: {
    common: {
      noDeadline: "期限なし", today: "今日", tomorrow: "明日",
      overdue: "{{count}}日超過", inDays: "{{count}}日後",
      loading: "読み込み中...", noResults: "結果が見つかりません。",
      cancel: "キャンセル", save: "保存", create: "作成",
      saving: "保存中...", search: "検索", filter: "フィルター",
      priority: { high: "高", medium: "中", low: "低" },
      status: { active: "アクティブ", pending: "保留中", lead: "リード", inactive: "非アクティブ",
        planning: "計画中", inDesign: "設計中", clientReview: "クライアントレビュー",
        revision: "改訂", delayed: "遅延", approved: "承認済み",
        completed: "完了", inProgress: "進行中", resolved: "解決済み", declined: "却下" }
    },
    dashboard: {
      title: "プロジェクトマネージャーダッシュボード", overview: "概要",
      loadError: "ダッシュボードデータを読み込めませんでした。",
      stats: { assignedClients: "担当クライアント", activeProjects: "アクティブプロジェクト",
        pendingReviews: "審査待ち", completed: "完了", workspaceFiles: "ワークスペースファイル" },
      activeWork: { title: "アクティブプロジェクト作業", viewAll: "すべて表示",
        loading: "担当プロジェクト作業を読み込み中...", empty: "現在アクティブなプロジェクトはありません。", openProject: "{{name}} を開く" },
      actionItems: { title: "アクション項目", loading: "アクション項目を読み込み中...", empty: "この組織に緊急アクションはありません。" },
      actions: { pendingApprovals: "{{count}} 件の承認待ち",
        pendingApprovalsDesc: "クライアントレビューが決定を待っています。", openApprovals: "承認を開く",
        delayedProjects: "{{count}} 件の遅延プロジェクト", delayedProjectsDesc: "プロジェクトにはPMの注意が必要です。",
        reviewRisk: "リスクを確認", activeWorkspaces: "{{count}} 件のアクティブワークスペース",
        activeWorkspacesDesc: "ブースデザインが編集可能です。", openWorkspace: "ワークスペースを開く" },
      recentActivity: { title: "最近のアクティビティ", loading: "アクティビティを読み込み中...", empty: "まだアクティビティイベントは記録されていません。" }
    }
  },
  ar: {
    common: {
      noDeadline: "لا يوجد موعد نهائي", today: "اليوم", tomorrow: "غداً",
      overdue: "متأخر {{count}} يوم", inDays: "خلال {{count}} يوم",
      loading: "جار التحميل...", noResults: "لم يتم العثور على نتائج.",
      cancel: "إلغاء", save: "حفظ", create: "إنشاء",
      saving: "جار الحفظ...", search: "بحث", filter: "تصفية",
      priority: { high: "عالٍ", medium: "متوسط", low: "منخفض" },
      status: { active: "نشط", pending: "معلق", lead: "عميل محتمل", inactive: "غير نشط",
        planning: "التخطيط", inDesign: "قيد التصميم", clientReview: "مراجعة العميل",
        revision: "مراجعة", delayed: "متأخر", approved: "موافق عليه",
        completed: "مكتمل", inProgress: "قيد التنفيذ", resolved: "تم الحل", declined: "مرفوض" }
    },
    dashboard: {
      title: "لوحة تحكم مدير المشروع", overview: "نظرة عامة",
      loadError: "تعذر تحميل بيانات لوحة التحكم.",
      stats: { assignedClients: "العملاء المعيّنون", activeProjects: "المشاريع النشطة",
        pendingReviews: "المراجعات المعلقة", completed: "مكتمل", workspaceFiles: "ملفات مساحة العمل" },
      activeWork: { title: "عمل المشروع النشط", viewAll: "عرض الكل",
        loading: "جار تحميل عمل المشروع المعيّن...", empty: "لا توجد مشاريع نشطة معيّنة حالياً.", openProject: "فتح {{name}}" },
      actionItems: { title: "عناصر الإجراءات", loading: "جار تحميل عناصر الإجراءات...", empty: "لا توجد إجراءات عاجلة لهذه المنظمة." },
      actions: { pendingApprovals: "{{count}} موافقة معلقة",
        pendingApprovalsDesc: "مراجعات العملاء تنتظر قراراً.", openApprovals: "فتح الموافقات",
        delayedProjects: "{{count}} مشروع متأخر", delayedProjectsDesc: "المشاريع تحتاج إلى اهتمام مدير المشروع.",
        reviewRisk: "مراجعة المخاطر", activeWorkspaces: "{{count}} مساحة عمل نشطة",
        activeWorkspacesDesc: "تصاميم الجناح متاحة للتعديل.", openWorkspace: "فتح مساحة العمل" },
      recentActivity: { title: "النشاط الأخير", loading: "جار تحميل النشاط...", empty: "لم يتم تسجيل أي أحداث نشاط بعد." }
    }
  },
  tr: {
    common: {
      noDeadline: "Son tarih yok", today: "Bugün", tomorrow: "Yarın",
      overdue: "{{count}} gün gecikmiş", inDays: "{{count}} gün içinde",
      loading: "Yükleniyor...", noResults: "Sonuç bulunamadı.",
      cancel: "İptal", save: "Kaydet", create: "Oluştur",
      saving: "Kaydediliyor...", search: "Ara", filter: "Filtrele",
      priority: { high: "Yüksek", medium: "Orta", low: "Düşük" },
      status: { active: "Aktif", pending: "Beklemede", lead: "Potansiyel Müşteri", inactive: "Pasif",
        planning: "Planlama", inDesign: "Tasarımda", clientReview: "Müşteri İncelemesi",
        revision: "Revizyon", delayed: "Gecikmiş", approved: "Onaylandı",
        completed: "Tamamlandı", inProgress: "Devam Ediyor", resolved: "Çözüldü", declined: "Reddedildi" }
    },
    dashboard: {
      title: "Proje Yöneticisi Panosu", overview: "Genel Bakış",
      loadError: "Pano verileri yüklenemedi.",
      stats: { assignedClients: "Atanmış Müşteriler", activeProjects: "Aktif Projeler",
        pendingReviews: "Bekleyen İncelemeler", completed: "Tamamlandı", workspaceFiles: "Çalışma Alanı Dosyaları" },
      activeWork: { title: "Aktif Proje Çalışması", viewAll: "Tümünü Gör",
        loading: "Atanmış proje çalışması yükleniyor...", empty: "Şu anda atanmış aktif proje yok.", openProject: "{{name}} aç" },
      actionItems: { title: "Eylem Öğeleri", loading: "Eylem öğeleri yükleniyor...", empty: "Bu organizasyon için acil eylem yok." },
      actions: { pendingApprovals: "{{count}} bekleyen onay",
        pendingApprovalsDesc: "Müşteri incelemeleri bir karar bekliyor.", openApprovals: "Onayları aç",
        delayedProjects: "{{count}} gecikmiş proje", delayedProjectsDesc: "Projeler PM dikkatine ihtiyaç duyuyor.",
        reviewRisk: "Riski incele", activeWorkspaces: "{{count}} aktif çalışma alanı",
        activeWorkspacesDesc: "Fuar tasarımları düzenleme için hazır.", openWorkspace: "Çalışma alanını aç" },
      recentActivity: { title: "Son Aktivite", loading: "Aktivite yükleniyor...", empty: "Henüz hiçbir aktivite olayı kaydedilmedi." }
    }
  }
};

for (const [lang, vals] of Object.entries(translations)) {
  const filePath = path.join(base, lang + ".json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.pm) data.pm = {};
  data.pm.common = vals.common;
  data.pm.dashboard = vals.dashboard;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(lang + " OK");
}
