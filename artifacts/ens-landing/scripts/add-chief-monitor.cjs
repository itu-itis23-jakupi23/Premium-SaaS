/**
 * Adds chief.monitor.* keys to all 11 locale files.
 * Run: node scripts/add-chief-monitor.cjs
 */
const fs   = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const translations = {
  en: {
    title:        "Workspace Monitor",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} Active Now",
    refresh:      "Refresh",
    loading:      "Loading live workspace data...",
    errorSuffix:  ". No local demo data is shown in real-data mode.",
    searchPlaceholder: "Search workspaces...",
    pmPlaceholder: "Project manager",
    allManagers:  "All project managers",
    legend:       "Live — refreshes every 8 s",
    status: {
      all:     "All",
      live:    "Live",
      review:  "Review",
      pending: "Pending",
      blocked: "Blocked",
    },
    stat: {
      total:       "Total",
      totalDesc:   "All workspaces",
      liveDesc:    "In workspace",
      reviewDesc:  "Client sign-off",
      pendingDesc: "Need attention",
      blockedDesc: "Action required",
    },
    bottleneck: {
      title_one:   "Bottleneck Alert — {{count}} project waiting for client response",
      title_other: "Bottleneck Alerts — {{count}} projects waiting for client response",
      waiting:     "{{days}}d waiting",
    },
    card: {
      editingNow:  "Editing now",
      minutesAgo:  "{{mins}}m ago",
      hoursAgo:    "{{hours}}h ago",
      waitingDays: "{{days}}d waiting",
      openPreview: "Expand {{name}} preview",
      reassign:    "Reassign",
      join:        "Join",
    },
    reassign: {
      title:       "Reassign Project Manager",
      description: "Choose a new PM for {{name}}.",
      client:      "Client",
      current:     "Current",
      unassigned:  "Unassigned",
      cancel:      "Cancel",
      confirm:     "Reassign",
    },
    error: {
      load:       "Workspace monitor data could not be loaded",
      noManagers: "No active project managers are available",
      reassign:   "Project could not be reassigned",
    },
    toast: {
      refreshed:      "Refreshed all workspaces",
      openedPreview:  "Opened {{name}} preview",
      joinedSession:  "Joined monitor session for {{name}}",
      reassigned:     "{{name}} reassigned to {{pm}}",
    },
  },

  de: {
    title:        "Workspace-Monitor",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} aktiv",
    refresh:      "Aktualisieren",
    loading:      "Live-Workspace-Daten werden geladen...",
    errorSuffix:  ". Im Echtdatenmodus sind keine Demo-Daten verfügbar.",
    searchPlaceholder: "Workspaces suchen...",
    pmPlaceholder: "Projektmanager",
    allManagers:  "Alle Projektmanager",
    legend:       "Live — Aktualisierung alle 8 s",
    status: {
      all:     "Alle",
      live:    "Live",
      review:  "Überprüfung",
      pending: "Ausstehend",
      blocked: "Blockiert",
    },
    stat: {
      total:       "Gesamt",
      totalDesc:   "Alle Workspaces",
      liveDesc:    "Im Workspace",
      reviewDesc:  "Kundenfreigabe",
      pendingDesc: "Aufmerksamkeit erforderlich",
      blockedDesc: "Maßnahme erforderlich",
    },
    bottleneck: {
      title_one:   "Engpass-Alarm — {{count}} Projekt wartet auf Kundenantwort",
      title_other: "Engpass-Alarm — {{count}} Projekte warten auf Kundenantwort",
      waiting:     "{{days}}T wartend",
    },
    card: {
      editingNow:  "Wird gerade bearbeitet",
      minutesAgo:  "vor {{mins}} Min.",
      hoursAgo:    "vor {{hours}} Std.",
      waitingDays: "{{days}}T wartend",
      openPreview: "Vorschau von {{name}} öffnen",
      reassign:    "Neu zuweisen",
      join:        "Beitreten",
    },
    reassign: {
      title:       "Projektmanager neu zuweisen",
      description: "Neuen PM für {{name}} auswählen.",
      client:      "Kunde",
      current:     "Aktuell",
      unassigned:  "Nicht zugewiesen",
      cancel:      "Abbrechen",
      confirm:     "Neu zuweisen",
    },
    error: {
      load:       "Workspace-Monitor-Daten konnten nicht geladen werden",
      noManagers: "Keine aktiven Projektmanager verfügbar",
      reassign:   "Projekt konnte nicht neu zugewiesen werden",
    },
    toast: {
      refreshed:     "Alle Workspaces aktualisiert",
      openedPreview: "Vorschau von {{name}} geöffnet",
      joinedSession: "Monitor-Sitzung für {{name}} beigetreten",
      reassigned:    "{{name}} wurde {{pm}} zugewiesen",
    },
  },

  fr: {
    title:        "Moniteur des espaces",
    breadcrumb:   "Moniteur",
    activeNow:    "{{count}} actif(s)",
    refresh:      "Actualiser",
    loading:      "Chargement des données en direct...",
    errorSuffix:  ". Aucune donnée de démo n'est disponible en mode données réelles.",
    searchPlaceholder: "Rechercher des espaces...",
    pmPlaceholder: "Chef de projet",
    allManagers:  "Tous les chefs de projet",
    legend:       "En direct — actualisation toutes les 8 s",
    status: {
      all:     "Tous",
      live:    "En direct",
      review:  "Révision",
      pending: "En attente",
      blocked: "Bloqué",
    },
    stat: {
      total:       "Total",
      totalDesc:   "Tous les espaces",
      liveDesc:    "Dans l'espace",
      reviewDesc:  "Validation client",
      pendingDesc: "Attention requise",
      blockedDesc: "Action requise",
    },
    bottleneck: {
      title_one:   "Alerte goulot — {{count}} projet en attente de réponse client",
      title_other: "Alertes goulots — {{count}} projets en attente de réponse client",
      waiting:     "{{days}}j en attente",
    },
    card: {
      editingNow:  "En cours d'édition",
      minutesAgo:  "il y a {{mins}} min",
      hoursAgo:    "il y a {{hours}} h",
      waitingDays: "{{days}}j en attente",
      openPreview: "Aperçu de {{name}}",
      reassign:    "Réassigner",
      join:        "Rejoindre",
    },
    reassign: {
      title:       "Réassigner le chef de projet",
      description: "Choisir un nouveau CP pour {{name}}.",
      client:      "Client",
      current:     "Actuel",
      unassigned:  "Non assigné",
      cancel:      "Annuler",
      confirm:     "Réassigner",
    },
    error: {
      load:       "Les données du moniteur n'ont pas pu être chargées",
      noManagers: "Aucun chef de projet actif disponible",
      reassign:   "Le projet n'a pas pu être réassigné",
    },
    toast: {
      refreshed:     "Tous les espaces actualisés",
      openedPreview: "Aperçu de {{name}} ouvert",
      joinedSession: "Session moniteur rejointe pour {{name}}",
      reassigned:    "{{name}} réassigné à {{pm}}",
    },
  },

  es: {
    title:        "Monitor de Espacios",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} activo(s)",
    refresh:      "Actualizar",
    loading:      "Cargando datos en vivo...",
    errorSuffix:  ". No hay datos de demostración en modo de datos reales.",
    searchPlaceholder: "Buscar espacios...",
    pmPlaceholder: "Jefe de proyecto",
    allManagers:  "Todos los jefes de proyecto",
    legend:       "En vivo — se actualiza cada 8 s",
    status: {
      all:     "Todos",
      live:    "En vivo",
      review:  "Revisión",
      pending: "Pendiente",
      blocked: "Bloqueado",
    },
    stat: {
      total:       "Total",
      totalDesc:   "Todos los espacios",
      liveDesc:    "En el espacio",
      reviewDesc:  "Aprobación del cliente",
      pendingDesc: "Atención necesaria",
      blockedDesc: "Acción requerida",
    },
    bottleneck: {
      title_one:   "Alerta de cuello de botella — {{count}} proyecto esperando respuesta",
      title_other: "Alertas de cuello de botella — {{count}} proyectos esperando respuesta",
      waiting:     "{{days}}d esperando",
    },
    card: {
      editingNow:  "Editando ahora",
      minutesAgo:  "hace {{mins}} min",
      hoursAgo:    "hace {{hours}} h",
      waitingDays: "{{days}}d esperando",
      openPreview: "Ampliar vista previa de {{name}}",
      reassign:    "Reasignar",
      join:        "Unirse",
    },
    reassign: {
      title:       "Reasignar jefe de proyecto",
      description: "Elegir un nuevo JP para {{name}}.",
      client:      "Cliente",
      current:     "Actual",
      unassigned:  "Sin asignar",
      cancel:      "Cancelar",
      confirm:     "Reasignar",
    },
    error: {
      load:       "No se pudieron cargar los datos del monitor",
      noManagers: "No hay jefes de proyecto activos disponibles",
      reassign:   "No se pudo reasignar el proyecto",
    },
    toast: {
      refreshed:     "Todos los espacios actualizados",
      openedPreview: "Vista previa de {{name}} abierta",
      joinedSession: "Sesión de monitor iniciada para {{name}}",
      reassigned:    "{{name}} reasignado a {{pm}}",
    },
  },

  it: {
    title:        "Monitor degli spazi",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} attivo/i",
    refresh:      "Aggiorna",
    loading:      "Caricamento dati in tempo reale...",
    errorSuffix:  ". Nessun dato demo disponibile in modalità dati reali.",
    searchPlaceholder: "Cerca spazi...",
    pmPlaceholder: "Project manager",
    allManagers:  "Tutti i project manager",
    legend:       "Live — aggiornamento ogni 8 s",
    status: {
      all:     "Tutti",
      live:    "Live",
      review:  "Revisione",
      pending: "In attesa",
      blocked: "Bloccato",
    },
    stat: {
      total:       "Totale",
      totalDesc:   "Tutti gli spazi",
      liveDesc:    "Nello spazio",
      reviewDesc:  "Approvazione cliente",
      pendingDesc: "Attenzione necessaria",
      blockedDesc: "Azione richiesta",
    },
    bottleneck: {
      title_one:   "Alerta collo di bottiglia — {{count}} progetto in attesa",
      title_other: "Alerte colli di bottiglia — {{count}} progetti in attesa",
      waiting:     "{{days}}g in attesa",
    },
    card: {
      editingNow:  "In modifica ora",
      minutesAgo:  "{{mins}} min fa",
      hoursAgo:    "{{hours}} h fa",
      waitingDays: "{{days}}g in attesa",
      openPreview: "Espandi anteprima di {{name}}",
      reassign:    "Riassegna",
      join:        "Partecipa",
    },
    reassign: {
      title:       "Riassegna project manager",
      description: "Scegli un nuovo PM per {{name}}.",
      client:      "Cliente",
      current:     "Attuale",
      unassigned:  "Non assegnato",
      cancel:      "Annulla",
      confirm:     "Riassegna",
    },
    error: {
      load:       "Impossibile caricare i dati del monitor",
      noManagers: "Nessun project manager attivo disponibile",
      reassign:   "Impossibile riassegnare il progetto",
    },
    toast: {
      refreshed:     "Tutti gli spazi aggiornati",
      openedPreview: "Anteprima di {{name}} aperta",
      joinedSession: "Sessione monitor avviata per {{name}}",
      reassigned:    "{{name}} riassegnato a {{pm}}",
    },
  },

  pt: {
    title:        "Monitor de Espaços",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} ativo(s)",
    refresh:      "Atualizar",
    loading:      "A carregar dados em tempo real...",
    errorSuffix:  ". Sem dados de demonstração no modo de dados reais.",
    searchPlaceholder: "Pesquisar espaços...",
    pmPlaceholder: "Gestor de projeto",
    allManagers:  "Todos os gestores de projeto",
    legend:       "Em direto — atualiza a cada 8 s",
    status: {
      all:     "Todos",
      live:    "Em direto",
      review:  "Revisão",
      pending: "Pendente",
      blocked: "Bloqueado",
    },
    stat: {
      total:       "Total",
      totalDesc:   "Todos os espaços",
      liveDesc:    "No espaço",
      reviewDesc:  "Aprovação do cliente",
      pendingDesc: "Atenção necessária",
      blockedDesc: "Ação necessária",
    },
    bottleneck: {
      title_one:   "Alerta de gargalo — {{count}} projeto à espera de resposta",
      title_other: "Alertas de gargalo — {{count}} projetos à espera de resposta",
      waiting:     "{{days}}d esperando",
    },
    card: {
      editingNow:  "A editar agora",
      minutesAgo:  "há {{mins}} min",
      hoursAgo:    "há {{hours}} h",
      waitingDays: "{{days}}d a aguardar",
      openPreview: "Expandir pré-visualização de {{name}}",
      reassign:    "Reatribuir",
      join:        "Participar",
    },
    reassign: {
      title:       "Reatribuir gestor de projeto",
      description: "Escolher um novo GP para {{name}}.",
      client:      "Cliente",
      current:     "Atual",
      unassigned:  "Não atribuído",
      cancel:      "Cancelar",
      confirm:     "Reatribuir",
    },
    error: {
      load:       "Não foi possível carregar os dados do monitor",
      noManagers: "Nenhum gestor de projeto ativo disponível",
      reassign:   "Não foi possível reatribuir o projeto",
    },
    toast: {
      refreshed:     "Todos os espaços atualizados",
      openedPreview: "Pré-visualização de {{name}} aberta",
      joinedSession: "Sessão de monitor iniciada para {{name}}",
      reassigned:    "{{name}} reatribuído a {{pm}}",
    },
  },

  nl: {
    title:        "Werkruimtemonitor",
    breadcrumb:   "Monitor",
    activeNow:    "{{count}} actief",
    refresh:      "Vernieuwen",
    loading:      "Live werkruimtegegevens laden...",
    errorSuffix:  ". In de echte gegevensmodus zijn geen demogegevens beschikbaar.",
    searchPlaceholder: "Werkruimten zoeken...",
    pmPlaceholder: "Projectmanager",
    allManagers:  "Alle projectmanagers",
    legend:       "Live — elke 8 s vernieuwd",
    status: {
      all:     "Alle",
      live:    "Live",
      review:  "Beoordeling",
      pending: "In behandeling",
      blocked: "Geblokkeerd",
    },
    stat: {
      total:       "Totaal",
      totalDesc:   "Alle werkruimten",
      liveDesc:    "In werkruimte",
      reviewDesc:  "Klantgoedkeuring",
      pendingDesc: "Aandacht vereist",
      blockedDesc: "Actie vereist",
    },
    bottleneck: {
      title_one:   "Knelpuntalarm — {{count}} project wacht op klantreactie",
      title_other: "Knelpuntalarms — {{count}} projecten wachten op klantreactie",
      waiting:     "{{days}}d wachtend",
    },
    card: {
      editingNow:  "Bezig met bewerken",
      minutesAgo:  "{{mins}} min geleden",
      hoursAgo:    "{{hours}} uur geleden",
      waitingDays: "{{days}}d wachtend",
      openPreview: "Voorbeeld van {{name}} uitbreiden",
      reassign:    "Hertoewijzen",
      join:        "Deelnemen",
    },
    reassign: {
      title:       "Projectmanager hertoewijzen",
      description: "Kies een nieuwe PM voor {{name}}.",
      client:      "Klant",
      current:     "Huidig",
      unassigned:  "Niet toegewezen",
      cancel:      "Annuleren",
      confirm:     "Hertoewijzen",
    },
    error: {
      load:       "Monitorgegevens konden niet worden geladen",
      noManagers: "Geen actieve projectmanagers beschikbaar",
      reassign:   "Project kon niet worden hertoegewezen",
    },
    toast: {
      refreshed:     "Alle werkruimten vernieuwd",
      openedPreview: "Voorbeeld van {{name}} geopend",
      joinedSession: "Monitorsessie voor {{name}} gestart",
      reassigned:    "{{name}} hertoegewezen aan {{pm}}",
    },
  },

  zh: {
    title:        "工作区监控",
    breadcrumb:   "监控",
    activeNow:    "{{count}} 个活跃",
    refresh:      "刷新",
    loading:      "正在加载实时工作区数据...",
    errorSuffix:  "。实时数据模式下不显示演示数据。",
    searchPlaceholder: "搜索工作区...",
    pmPlaceholder: "项目经理",
    allManagers:  "所有项目经理",
    legend:       "实时 — 每 8 秒刷新",
    status: {
      all:     "全部",
      live:    "实时",
      review:  "审核中",
      pending: "待处理",
      blocked: "已阻塞",
    },
    stat: {
      total:       "总计",
      totalDesc:   "所有工作区",
      liveDesc:    "工作区中",
      reviewDesc:  "客户审批",
      pendingDesc: "需要关注",
      blockedDesc: "需要操作",
    },
    bottleneck: {
      title_one:   "瓶颈警报 — {{count}} 个项目等待客户响应",
      title_other: "瓶颈警报 — {{count}} 个项目等待客户响应",
      waiting:     "等待 {{days}} 天",
    },
    card: {
      editingNow:  "正在编辑",
      minutesAgo:  "{{mins}} 分钟前",
      hoursAgo:    "{{hours}} 小时前",
      waitingDays: "等待 {{days}} 天",
      openPreview: "展开 {{name}} 预览",
      reassign:    "重新分配",
      join:        "加入",
    },
    reassign: {
      title:       "重新分配项目经理",
      description: "为 {{name}} 选择新的项目经理。",
      client:      "客户",
      current:     "当前",
      unassigned:  "未分配",
      cancel:      "取消",
      confirm:     "重新分配",
    },
    error: {
      load:       "无法加载工作区监控数据",
      noManagers: "没有可用的活跃项目经理",
      reassign:   "无法重新分配项目",
    },
    toast: {
      refreshed:     "所有工作区已刷新",
      openedPreview: "已打开 {{name}} 的预览",
      joinedSession: "已加入 {{name}} 的监控会话",
      reassigned:    "{{name}} 已重新分配给 {{pm}}",
    },
  },

  ja: {
    title:        "ワークスペースモニター",
    breadcrumb:   "モニター",
    activeNow:    "{{count}} 件進行中",
    refresh:      "更新",
    loading:      "ライブデータを読み込み中...",
    errorSuffix:  "。実データモードではデモデータは表示されません。",
    searchPlaceholder: "ワークスペースを検索...",
    pmPlaceholder: "プロジェクトマネージャー",
    allManagers:  "すべてのPM",
    legend:       "ライブ — 8 秒ごとに更新",
    status: {
      all:     "すべて",
      live:    "ライブ",
      review:  "レビュー中",
      pending: "保留中",
      blocked: "ブロック中",
    },
    stat: {
      total:       "合計",
      totalDesc:   "すべてのワークスペース",
      liveDesc:    "ワークスペース内",
      reviewDesc:  "顧客承認待ち",
      pendingDesc: "要対応",
      blockedDesc: "アクション必要",
    },
    bottleneck: {
      title_one:   "ボトルネックアラート — {{count}} 件が顧客応答待ち",
      title_other: "ボトルネックアラート — {{count}} 件が顧客応答待ち",
      waiting:     "{{days}} 日待機中",
    },
    card: {
      editingNow:  "編集中",
      minutesAgo:  "{{mins}} 分前",
      hoursAgo:    "{{hours}} 時間前",
      waitingDays: "{{days}} 日待機中",
      openPreview: "{{name}} のプレビューを拡大",
      reassign:    "再割当",
      join:        "参加",
    },
    reassign: {
      title:       "PMを再割当",
      description: "{{name}} の新しい PM を選択してください。",
      client:      "クライアント",
      current:     "現在",
      unassigned:  "未割当",
      cancel:      "キャンセル",
      confirm:     "再割当",
    },
    error: {
      load:       "ワークスペースデータを読み込めませんでした",
      noManagers: "利用可能なアクティブPMがいません",
      reassign:   "プロジェクトを再割当できませんでした",
    },
    toast: {
      refreshed:     "すべてのワークスペースを更新しました",
      openedPreview: "{{name}} のプレビューを開きました",
      joinedSession: "{{name}} のモニターセッションに参加しました",
      reassigned:    "{{name}} を {{pm}} に再割当しました",
    },
  },

  ar: {
    title:        "مراقب مساحات العمل",
    breadcrumb:   "المراقب",
    activeNow:    "{{count}} نشط",
    refresh:      "تحديث",
    loading:      "جارٍ تحميل البيانات المباشرة...",
    errorSuffix:  ". لا تتوفر بيانات تجريبية في وضع البيانات الحقيقية.",
    searchPlaceholder: "البحث في مساحات العمل...",
    pmPlaceholder: "مدير المشروع",
    allManagers:  "جميع مديري المشاريع",
    legend:       "مباشر — يتحدث كل 8 ث",
    status: {
      all:     "الكل",
      live:    "مباشر",
      review:  "قيد المراجعة",
      pending: "قيد الانتظار",
      blocked: "محظور",
    },
    stat: {
      total:       "الإجمالي",
      totalDesc:   "جميع المساحات",
      liveDesc:    "في مساحة العمل",
      reviewDesc:  "موافقة العميل",
      pendingDesc: "يحتاج اهتماماً",
      blockedDesc: "يحتاج إجراءً",
    },
    bottleneck: {
      title_one:   "تنبيه اختناق — {{count}} مشروع ينتظر رد العميل",
      title_other: "تنبيهات اختناق — {{count}} مشروع ينتظر رد العميل",
      waiting:     "{{days}} يوم انتظار",
    },
    card: {
      editingNow:  "جارٍ التحرير",
      minutesAgo:  "منذ {{mins}} دقيقة",
      hoursAgo:    "منذ {{hours}} ساعة",
      waitingDays: "{{days}} يوم انتظار",
      openPreview: "توسيع معاينة {{name}}",
      reassign:    "إعادة التعيين",
      join:        "انضمام",
    },
    reassign: {
      title:       "إعادة تعيين مدير المشروع",
      description: "اختر مديراً جديداً لـ {{name}}.",
      client:      "العميل",
      current:     "الحالي",
      unassigned:  "غير معين",
      cancel:      "إلغاء",
      confirm:     "إعادة التعيين",
    },
    error: {
      load:       "تعذّر تحميل بيانات المراقب",
      noManagers: "لا يوجد مديرو مشاريع نشطون",
      reassign:   "تعذّر إعادة تعيين المشروع",
    },
    toast: {
      refreshed:     "تم تحديث جميع مساحات العمل",
      openedPreview: "تم فتح معاينة {{name}}",
      joinedSession: "تم الانضمام إلى جلسة مراقبة {{name}}",
      reassigned:    "تم إعادة تعيين {{name}} إلى {{pm}}",
    },
  },

  tr: {
    title:        "Çalışma Alanı Monitörü",
    breadcrumb:   "Monitör",
    activeNow:    "{{count}} Aktif",
    refresh:      "Yenile",
    loading:      "Canlı veriler yükleniyor...",
    errorSuffix:  ". Gerçek veri modunda demo verisi gösterilmez.",
    searchPlaceholder: "Çalışma alanı ara...",
    pmPlaceholder: "Proje yöneticisi",
    allManagers:  "Tüm proje yöneticileri",
    legend:       "Canlı — her 8 sn'de yenilenir",
    status: {
      all:     "Tümü",
      live:    "Canlı",
      review:  "İnceleme",
      pending: "Beklemede",
      blocked: "Engellendi",
    },
    stat: {
      total:       "Toplam",
      totalDesc:   "Tüm çalışma alanları",
      liveDesc:    "Çalışma alanında",
      reviewDesc:  "Müşteri onayı",
      pendingDesc: "İlgi gerekiyor",
      blockedDesc: "Eylem gerekiyor",
    },
    bottleneck: {
      title_one:   "Darboğaz uyarısı — {{count}} proje müşteri yanıtı bekliyor",
      title_other: "Darboğaz uyarıları — {{count}} proje müşteri yanıtı bekliyor",
      waiting:     "{{days}}g bekliyor",
    },
    card: {
      editingNow:  "Şu an düzenleniyor",
      minutesAgo:  "{{mins}} dk önce",
      hoursAgo:    "{{hours}} sa önce",
      waitingDays: "{{days}}g bekliyor",
      openPreview: "{{name}} önizlemesini genişlet",
      reassign:    "Yeniden ata",
      join:        "Katıl",
    },
    reassign: {
      title:       "Proje Yöneticisini Yeniden Ata",
      description: "{{name}} için yeni bir PM seçin.",
      client:      "Müşteri",
      current:     "Mevcut",
      unassigned:  "Atanmamış",
      cancel:      "İptal",
      confirm:     "Yeniden Ata",
    },
    error: {
      load:       "İzleme verileri yüklenemedi",
      noManagers: "Kullanılabilir aktif PM yok",
      reassign:   "Proje yeniden atanamadı",
    },
    toast: {
      refreshed:     "Tüm çalışma alanları yenilendi",
      openedPreview: "{{name}} önizlemesi açıldı",
      joinedSession: "{{name}} izleme oturumuna katıldı",
      reassigned:    "{{name}}, {{pm}} kişisine yeniden atandı",
    },
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let updated = 0;
let skipped = 0;

for (const [lang, keys] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP  ${lang}.json — file not found`);
    skipped++;
    continue;
  }

  const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!existing.chief) existing.chief = {};

  const merged = deepMerge(existing, {
    chief: { monitor: keys },
  });

  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}.json`);
  updated++;
}

console.log(`\nDone — ${updated} updated, ${skipped} skipped.`);
