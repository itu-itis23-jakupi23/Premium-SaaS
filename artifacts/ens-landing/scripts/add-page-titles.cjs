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
    home: {
      pageTitle: "ENS — Exhibition & Stand Design Platform",
      chiefFeatures: {
        workspaceMonitor: { title: "Workspace Monitor", desc: "Live oversight of every active design session across all projects." },
        teamManagement:   { title: "Team Management",   desc: "Assign project managers, track workloads, and manage access levels." },
        clientPortfolio:  { title: "Client Portfolio",  desc: "Full view of all client accounts, contacts, and active contracts." },
        analytics:        { title: "Analytics & Reports", desc: "Project KPIs, time-to-approval rates, and revenue dashboards." },
        approvalGateway:  { title: "Approval Gateway",  desc: "Final structural and design sign-off before production release." },
        commsHub:         { title: "Communications Hub", desc: "Centralised messaging across clients, PMs, and sub-contractors." }
      }
    },
    team: {
      pageTitle: "ENS Team Portal — Staff & Client Hub",
      chiefFeatures: {
        workspaceMonitor: { title: "Workspace Monitor",   desc: "Live oversight of every active design session across all projects." },
        teamManagement:   { title: "Team Management",     desc: "Assign project managers, track workloads, and manage access levels." },
        clientPortfolio:  { title: "Client Portfolio",    desc: "Full view of all client accounts, contacts, and active contracts." },
        analytics:        { title: "Analytics & Reports", desc: "Project KPIs, time-to-approval rates, and revenue dashboards." },
        approvalGateway:  { title: "Approval Gateway",    desc: "Final structural and design sign-off before production release." },
        commsHub:         { title: "Communications Hub",  desc: "Centralised messaging across clients, PMs, and sub-contractors." }
      },
      pmFeatures: {
        boothWorkspace:  { title: "3D Booth Workspace", desc: "Full Octanorm/Maxima editor with real-time collaborative design." },
        clientMgmt:      { title: "Client Management",  desc: "Manage briefs, contacts, and live feedback sessions per project." },
        taskTracker:     { title: "Task Tracker",        desc: "Kanban task board covering production, design, and delivery phases." },
        pipeline:        { title: "Project Pipeline",   desc: "Track all active and upcoming projects with milestone timelines." },
        requestMgmt:     { title: "Request Management", desc: "Handle change requests, revision logs, and approval chains." },
        messaging:       { title: "Messaging",           desc: "Direct and group messaging with clients and the chief office." }
      },
      workflowSteps: {
        brief:      { title: "Client Brief",      desc: "Chief receives and assigns the show brief to a Project Manager." },
        workspace:  { title: "Workspace Setup",   desc: "PM creates the project and configures booth dimensions and system." },
        design:     { title: "3D Design",         desc: "PM builds the stand in the live workspace using structural libraries." },
        review:     { title: "Chief Review",      desc: "Chief monitors progress and provides structural guidance." },
        signoff:    { title: "Client Sign-Off",   desc: "Client reviews the design and submits change requests." },
        approval:   { title: "Final Approval",    desc: "Chief approves the final design and releases for production." },
        export:     { title: "Production Export", desc: "PM exports documentation, cut lists, and component schedules." }
      }
    }
  },
  de: {
    home: { pageTitle: "ENS — Messe- & Standbau-Plattform" },
    team: {
      pageTitle: "ENS Team-Portal — Mitarbeiter & Kunden-Hub",
      chiefFeatures: {
        workspaceMonitor: { title: "Arbeitsbereich-Monitor",  desc: "Live-Überwachung aller aktiven Design-Sitzungen über alle Projekte." },
        teamManagement:   { title: "Teamverwaltung",          desc: "Projektmanager zuweisen, Auslastung verfolgen und Zugriffe verwalten." },
        clientPortfolio:  { title: "Kunden-Portfolio",        desc: "Vollständige Übersicht über alle Kundenkonten, Kontakte und aktiven Verträge." },
        analytics:        { title: "Analysen & Berichte",     desc: "Projekt-KPIs, Zeit bis zur Genehmigung und Umsatz-Dashboards." },
        approvalGateway:  { title: "Genehmigungsportal",      desc: "Abschließende strukturelle und gestalterische Freigabe vor der Produktion." },
        commsHub:         { title: "Kommunikations-Hub",      desc: "Zentralisiertes Messaging zwischen Kunden, PMs und Subunternehmern." }
      },
      pmFeatures: {
        boothWorkspace: { title: "3D-Standbau-Arbeitsbereich", desc: "Vollständiger Octanorm/Maxima-Editor mit Echtzeit-Zusammenarbeit." },
        clientMgmt:     { title: "Kundenverwaltung",            desc: "Briefings, Kontakte und Live-Feedback-Sitzungen pro Projekt verwalten." },
        taskTracker:    { title: "Aufgaben-Tracker",             desc: "Kanban-Board für Produktion, Design und Lieferphasen." },
        pipeline:       { title: "Projekt-Pipeline",            desc: "Alle aktiven und bevorstehenden Projekte mit Meilenstein-Timelines verfolgen." },
        requestMgmt:    { title: "Anfragenverwaltung",          desc: "Änderungsanfragen, Revisionen und Genehmigungsketten bearbeiten." },
        messaging:      { title: "Nachrichten",                 desc: "Direkt- und Gruppennachrichten mit Kunden und dem Chief-Büro." }
      },
      workflowSteps: {
        brief:     { title: "Kunden-Briefing",   desc: "Der Chief empfängt das Messebriefing und weist es einem Projektmanager zu." },
        workspace: { title: "Arbeitsbereich",    desc: "PM erstellt das Projekt und konfiguriert Standmaße und System." },
        design:    { title: "3D-Design",          desc: "PM baut den Stand im Live-Arbeitsbereich mit Strukturbibliotheken." },
        review:    { title: "Chief-Review",       desc: "Chief überwacht den Fortschritt und gibt strukturelle Hinweise." },
        signoff:   { title: "Kunden-Abnahme",    desc: "Kunde prüft das Design und reicht Änderungsanfragen ein." },
        approval:  { title: "Endgenehmigung",    desc: "Chief genehmigt das endgültige Design und gibt es für die Produktion frei." },
        export:    { title: "Produktionsexport", desc: "PM exportiert Dokumentation, Schnittlisten und Komponentenpläne." }
      }
    }
  },
  fr: {
    home: { pageTitle: "ENS — Plateforme de conception de stands et expositions" },
    team: {
      pageTitle: "ENS Portail Équipe — Hub Personnel & Clients",
      chiefFeatures: {
        workspaceMonitor: { title: "Moniteur d'espace de travail", desc: "Supervision en direct de chaque session de conception active sur tous les projets." },
        teamManagement:   { title: "Gestion d'équipe",             desc: "Affecter des chefs de projet, suivre les charges de travail et gérer les accès." },
        clientPortfolio:  { title: "Portefeuille clients",         desc: "Vue complète de tous les comptes clients, contacts et contrats actifs." },
        analytics:        { title: "Analyses & Rapports",          desc: "KPI projets, délais d'approbation et tableaux de bord revenus." },
        approvalGateway:  { title: "Portail d'approbation",        desc: "Validation structurelle et design finale avant lancement en production." },
        commsHub:         { title: "Hub de communication",         desc: "Messagerie centralisée entre clients, chefs de projet et sous-traitants." }
      },
      pmFeatures: {
        boothWorkspace: { title: "Espace de travail 3D",    desc: "Éditeur Octanorm/Maxima complet avec conception collaborative en temps réel." },
        clientMgmt:     { title: "Gestion des clients",     desc: "Gérer les briefs, contacts et sessions de feedback en direct par projet." },
        taskTracker:    { title: "Suivi des tâches",         desc: "Tableau Kanban couvrant les phases de production, conception et livraison." },
        pipeline:       { title: "Pipeline de projets",     desc: "Suivre tous les projets actifs et à venir avec les jalons." },
        requestMgmt:    { title: "Gestion des demandes",    desc: "Traiter les demandes de modification, journaux de révision et chaînes d'approbation." },
        messaging:      { title: "Messagerie",               desc: "Messagerie directe et de groupe avec les clients et le bureau chef." }
      },
      workflowSteps: {
        brief:     { title: "Brief client",          desc: "Le Chief reçoit et affecte le brief à un Chef de Projet." },
        workspace: { title: "Configuration",         desc: "Le PM crée le projet et configure les dimensions et le système du stand." },
        design:    { title: "Conception 3D",          desc: "Le PM construit le stand dans l'espace de travail avec les bibliothèques structurelles." },
        review:    { title: "Révision Chief",         desc: "Le Chief surveille l'avancement et fournit des conseils structurels." },
        signoff:   { title: "Validation client",     desc: "Le client examine la conception et soumet des demandes de modification." },
        approval:  { title: "Approbation finale",    desc: "Le Chief approuve la conception finale et la lance en production." },
        export:    { title: "Export production",     desc: "Le PM exporte la documentation, les listes de coupe et les plannings." }
      }
    }
  },
  es: {
    home: { pageTitle: "ENS — Plataforma de diseño de stands y exposiciones" },
    team: {
      pageTitle: "ENS Portal de Equipo — Hub de Personal y Clientes",
      chiefFeatures: {
        workspaceMonitor: { title: "Monitor de espacio de trabajo", desc: "Supervisión en vivo de cada sesión de diseño activa en todos los proyectos." },
        teamManagement:   { title: "Gestión del equipo",            desc: "Asignar gerentes, rastrear cargas de trabajo y administrar accesos." },
        clientPortfolio:  { title: "Cartera de clientes",           desc: "Vista completa de todas las cuentas, contactos y contratos activos." },
        analytics:        { title: "Análisis e Informes",           desc: "KPIs de proyectos, tasas de aprobación y cuadros de mando de ingresos." },
        approvalGateway:  { title: "Portal de aprobación",          desc: "Aprobación estructural y de diseño final antes de la producción." },
        commsHub:         { title: "Hub de comunicaciones",         desc: "Mensajería centralizada entre clientes, PMs y subcontratistas." }
      },
      pmFeatures: {
        boothWorkspace: { title: "Espacio de trabajo 3D",   desc: "Editor Octanorm/Maxima completo con diseño colaborativo en tiempo real." },
        clientMgmt:     { title: "Gestión de clientes",     desc: "Gestionar briefs, contactos y sesiones de feedback en vivo por proyecto." },
        taskTracker:    { title: "Seguimiento de tareas",   desc: "Tablero Kanban para fases de producción, diseño y entrega." },
        pipeline:       { title: "Pipeline de proyectos",  desc: "Rastrear todos los proyectos activos y próximos con hitos." },
        requestMgmt:    { title: "Gestión de solicitudes", desc: "Gestionar cambios, registros de revisión y cadenas de aprobación." },
        messaging:      { title: "Mensajería",              desc: "Mensajería directa y grupal con clientes y la oficina principal." }
      },
      workflowSteps: {
        brief:     { title: "Brief del cliente",   desc: "El Chief recibe y asigna el brief a un Gerente de Proyecto." },
        workspace: { title: "Configuración",       desc: "El PM crea el proyecto y configura las dimensiones y el sistema del stand." },
        design:    { title: "Diseño 3D",            desc: "El PM construye el stand en el espacio de trabajo con las bibliotecas estructurales." },
        review:    { title: "Revisión del Chief",  desc: "El Chief monitorea el progreso y proporciona orientación estructural." },
        signoff:   { title: "Aprobación del cliente", desc: "El cliente revisa el diseño y envía solicitudes de cambio." },
        approval:  { title: "Aprobación final",    desc: "El Chief aprueba el diseño final y lo lanza a producción." },
        export:    { title: "Exportación",          desc: "El PM exporta documentación, listas de corte y cronogramas." }
      }
    }
  },
  it: {
    home: { pageTitle: "ENS — Piattaforma di progettazione stand ed esposizioni" },
    team: {
      pageTitle: "ENS Portale Team — Hub Personale e Clienti",
      chiefFeatures: {
        workspaceMonitor: { title: "Monitor area di lavoro",  desc: "Supervisione live di ogni sessione di progettazione attiva su tutti i progetti." },
        teamManagement:   { title: "Gestione del team",      desc: "Assegnare manager, monitorare i carichi di lavoro e gestire gli accessi." },
        clientPortfolio:  { title: "Portfolio clienti",      desc: "Visualizzazione completa di tutti gli account, contatti e contratti attivi." },
        analytics:        { title: "Analisi e Report",       desc: "KPI di progetto, tassi di approvazione e dashboard ricavi." },
        approvalGateway:  { title: "Portale approvazioni",   desc: "Approvazione strutturale e di design finale prima della produzione." },
        commsHub:         { title: "Hub comunicazioni",      desc: "Messaggistica centralizzata tra clienti, PM e subappaltatori." }
      },
      pmFeatures: {
        boothWorkspace: { title: "Area di lavoro 3D",    desc: "Editor Octanorm/Maxima completo con progettazione collaborativa in tempo reale." },
        clientMgmt:     { title: "Gestione clienti",     desc: "Gestire brief, contatti e sessioni di feedback live per progetto." },
        taskTracker:    { title: "Tracker attività",     desc: "Board Kanban per fasi di produzione, design e consegna." },
        pipeline:       { title: "Pipeline progetti",   desc: "Tracciare tutti i progetti attivi e futuri con milestone." },
        requestMgmt:    { title: "Gestione richieste",  desc: "Gestire modifiche, log di revisione e catene di approvazione." },
        messaging:      { title: "Messaggistica",        desc: "Messaggi diretti e di gruppo con clienti e l'ufficio principale." }
      },
      workflowSteps: {
        brief:     { title: "Brief cliente",    desc: "Il Chief riceve e assegna il brief a un Project Manager." },
        workspace: { title: "Configurazione",   desc: "Il PM crea il progetto e configura le dimensioni e il sistema dello stand." },
        design:    { title: "Design 3D",         desc: "Il PM costruisce lo stand nell'area di lavoro con le librerie strutturali." },
        review:    { title: "Revisione Chief",  desc: "Il Chief monitora l'avanzamento e fornisce indicazioni strutturali." },
        signoff:   { title: "Approvazione cliente", desc: "Il cliente esamina il design e invia richieste di modifica." },
        approval:  { title: "Approvazione finale", desc: "Il Chief approva il design finale e lo rilascia per la produzione." },
        export:    { title: "Export produzione", desc: "Il PM esporta documentazione, liste di taglio e pianificazioni." }
      }
    }
  },
  pt: {
    home: { pageTitle: "ENS — Plataforma de design de stands e exposições" },
    team: {
      pageTitle: "ENS Portal da Equipe — Hub de Pessoal e Clientes",
      chiefFeatures: {
        workspaceMonitor: { title: "Monitor de área de trabalho", desc: "Supervisão ao vivo de cada sessão de design ativa em todos os projetos." },
        teamManagement:   { title: "Gerenciamento de equipe",     desc: "Atribuir gerentes, acompanhar cargas de trabalho e gerenciar acessos." },
        clientPortfolio:  { title: "Portfólio de clientes",       desc: "Visão completa de todas as contas, contatos e contratos ativos." },
        analytics:        { title: "Análises e Relatórios",       desc: "KPIs de projetos, taxas de aprovação e painéis de receita." },
        approvalGateway:  { title: "Portal de aprovação",         desc: "Aprovação estrutural e de design final antes da produção." },
        commsHub:         { title: "Hub de comunicações",         desc: "Mensagens centralizadas entre clientes, GPs e subcontratados." }
      },
      pmFeatures: {
        boothWorkspace: { title: "Área de trabalho 3D",    desc: "Editor Octanorm/Maxima completo com design colaborativo em tempo real." },
        clientMgmt:     { title: "Gestão de clientes",     desc: "Gerenciar briefings, contatos e sessões de feedback ao vivo por projeto." },
        taskTracker:    { title: "Rastreador de tarefas",  desc: "Quadro Kanban para fases de produção, design e entrega." },
        pipeline:       { title: "Pipeline de projetos",  desc: "Acompanhar todos os projetos ativos e futuros com marcos." },
        requestMgmt:    { title: "Gestão de solicitações", desc: "Gerenciar mudanças, logs de revisão e cadeias de aprovação." },
        messaging:      { title: "Mensagens",               desc: "Mensagens diretas e em grupo com clientes e o escritório principal." }
      },
      workflowSteps: {
        brief:     { title: "Brief do cliente",   desc: "O Chief recebe e atribui o brief a um Gerente de Projeto." },
        workspace: { title: "Configuração",       desc: "O GP cria o projeto e configura as dimensões e o sistema do stand." },
        design:    { title: "Design 3D",           desc: "O GP constrói o stand no espaço de trabalho com bibliotecas estruturais." },
        review:    { title: "Revisão do Chief",   desc: "O Chief monitora o progresso e fornece orientação estrutural." },
        signoff:   { title: "Aprovação do cliente", desc: "O cliente analisa o design e envia solicitações de mudança." },
        approval:  { title: "Aprovação final",    desc: "O Chief aprova o design final e libera para produção." },
        export:    { title: "Exportação",          desc: "O GP exporta documentação, listas de corte e cronogramas." }
      }
    }
  },
  nl: {
    home: { pageTitle: "ENS — Platform voor beurs- en standontwerp" },
    team: {
      pageTitle: "ENS Teamportaal — Hub voor medewerkers en klanten",
      chiefFeatures: {
        workspaceMonitor: { title: "Werkruimtemonitor",  desc: "Live toezicht op elke actieve ontwerpsessie in alle projecten." },
        teamManagement:   { title: "Teambeheer",         desc: "Projectmanagers toewijzen, werklasten volgen en toegang beheren." },
        clientPortfolio:  { title: "Klantenportfolio",   desc: "Volledig overzicht van alle klantaccounts, contacten en actieve contracten." },
        analytics:        { title: "Analyses & Rapporten", desc: "Project-KPI's, goedkeuringstijden en omzetdashboards." },
        approvalGateway:  { title: "Goedkeuringsportaal", desc: "Definitieve structurele en ontwerp-goedkeuring vóór productie." },
        commsHub:         { title: "Communicatiehub",    desc: "Gecentraliseerd berichtenverkeer tussen klanten, PM's en onderaannemers." }
      },
      pmFeatures: {
        boothWorkspace: { title: "3D-standbouwwerkruimte", desc: "Volledige Octanorm/Maxima-editor met realtime samenwerking." },
        clientMgmt:     { title: "Klantbeheer",             desc: "Briefings, contacten en live feedbacksessies per project beheren." },
        taskTracker:    { title: "Taaktracker",              desc: "Kanban-bord voor productie-, ontwerp- en leveringsfasen." },
        pipeline:       { title: "Projectpijplijn",         desc: "Alle actieve en aankomende projecten volgen met mijlpaalplanning." },
        requestMgmt:    { title: "Verzoekbeheer",           desc: "Wijzigingsverzoeken, revisielogboeken en goedkeuringsketens beheren." },
        messaging:      { title: "Berichten",                desc: "Directe en groepsberichten met klanten en het hoofdkantoor." }
      },
      workflowSteps: {
        brief:     { title: "Klantbriefing",     desc: "De Chief ontvangt en wijst de beursbriefing toe aan een Projectmanager." },
        workspace: { title: "Werkruimte",        desc: "PM maakt het project en configureert standafmetingen en systeem." },
        design:    { title: "3D-ontwerp",         desc: "PM bouwt de stand in de live werkruimte met structuurbibliotheken." },
        review:    { title: "Chief-review",       desc: "Chief bewaakt de voortgang en geeft structurele begeleiding." },
        signoff:   { title: "Klantgoedkeuring",  desc: "De klant bekijkt het ontwerp en dient wijzigingsverzoeken in." },
        approval:  { title: "Eindgoedkeuring",   desc: "Chief keurt het uiteindelijke ontwerp goed en geeft het vrij voor productie." },
        export:    { title: "Productie-export",  desc: "PM exporteert documentatie, snijlijsten en componentenschema's." }
      }
    }
  },
  zh: {
    home: { pageTitle: "ENS — 展览与展台设计平台" },
    team: {
      pageTitle: "ENS 团队门户 — 员工与客户中心",
      chiefFeatures: {
        workspaceMonitor: { title: "工作区监控",     desc: "实时监督所有项目中每个活跃的设计会话。" },
        teamManagement:   { title: "团队管理",       desc: "分配项目经理、跟踪工作量并管理访问权限。" },
        clientPortfolio:  { title: "客户组合",       desc: "全面查看所有客户账户、联系人和活跃合同。" },
        analytics:        { title: "分析与报告",     desc: "项目KPI、审批时间和收入仪表盘。" },
        approvalGateway:  { title: "审批网关",       desc: "生产发布前的最终结构和设计审批。" },
        commsHub:         { title: "通讯中心",       desc: "客户、项目经理和分包商之间的集中消息传递。" }
      },
      pmFeatures: {
        boothWorkspace: { title: "3D展台工作区",   desc: "配备实时协作设计的完整Octanorm/Maxima编辑器。" },
        clientMgmt:     { title: "客户管理",       desc: "管理每个项目的简报、联系人和实时反馈会话。" },
        taskTracker:    { title: "任务跟踪",       desc: "涵盖生产、设计和交付阶段的看板任务板。" },
        pipeline:       { title: "项目管道",       desc: "使用里程碑时间线跟踪所有活跃和即将进行的项目。" },
        requestMgmt:    { title: "请求管理",       desc: "处理变更请求、修订日志和审批链。" },
        messaging:      { title: "消息传递",       desc: "与客户和首席办公室进行直接和群组消息传递。" }
      },
      workflowSteps: {
        brief:     { title: "客户简报",   desc: "首席接收并将展览简报分配给项目经理。" },
        workspace: { title: "工作区设置", desc: "PM创建项目并配置展台尺寸和系统。" },
        design:    { title: "3D设计",     desc: "PM使用结构库在实时工作区中构建展台。" },
        review:    { title: "首席审查",   desc: "首席监控进度并提供结构指导。" },
        signoff:   { title: "客户签字",   desc: "客户审查设计并提交变更请求。" },
        approval:  { title: "最终批准",   desc: "首席批准最终设计并发布生产。" },
        export:    { title: "生产导出",   desc: "PM导出文档、切割清单和组件计划表。" }
      }
    }
  },
  ja: {
    home: { pageTitle: "ENS — 展示会・ブースデザインプラットフォーム" },
    team: {
      pageTitle: "ENS チームポータル — スタッフ＆クライアントハブ",
      chiefFeatures: {
        workspaceMonitor: { title: "ワークスペースモニター", desc: "すべてのプロジェクトのアクティブなデザインセッションをリアルタイム監視。" },
        teamManagement:   { title: "チーム管理",             desc: "プロジェクトマネージャーを割り当て、作業負荷を追跡し、アクセスを管理。" },
        clientPortfolio:  { title: "クライアントポートフォリオ", desc: "すべてのクライアントアカウント、連絡先、アクティブな契約の完全な表示。" },
        analytics:        { title: "分析・レポート",         desc: "プロジェクトKPI、承認時間、収益ダッシュボード。" },
        approvalGateway:  { title: "承認ゲートウェイ",       desc: "本番リリース前の最終的な構造・デザイン承認。" },
        commsHub:         { title: "コミュニケーションハブ", desc: "クライアント、PM、外注業者間の一元化されたメッセージング。" }
      },
      pmFeatures: {
        boothWorkspace: { title: "3Dブースワークスペース", desc: "リアルタイム協働デザインを備えた完全なOctanorm/Maximaエディタ。" },
        clientMgmt:     { title: "クライアント管理",       desc: "プロジェクトごとのブリーフ、連絡先、ライブフィードバックを管理。" },
        taskTracker:    { title: "タスクトラッカー",       desc: "製造、デザイン、納品フェーズをカバーするカンバンボード。" },
        pipeline:       { title: "プロジェクトパイプライン", desc: "マイルストーンタイムラインで全プロジェクトを追跡。" },
        requestMgmt:    { title: "リクエスト管理",         desc: "変更依頼、修正ログ、承認チェーンを処理。" },
        messaging:      { title: "メッセージング",         desc: "クライアントと本部へのダイレクト・グループメッセージ。" }
      },
      workflowSteps: {
        brief:     { title: "クライアントブリーフ", desc: "Chiefが展示ブリーフを受け取り、プロジェクトマネージャーに割り当て。" },
        workspace: { title: "ワークスペース設定",   desc: "PMがプロジェクトを作成し、ブースの寸法とシステムを設定。" },
        design:    { title: "3Dデザイン",           desc: "PMが構造ライブラリを使ってライブワークスペースでブースを構築。" },
        review:    { title: "Chiefレビュー",        desc: "Chiefが進捗を監視し、構造的なガイダンスを提供。" },
        signoff:   { title: "クライアント承認",     desc: "クライアントがデザインを確認し、変更依頼を提出。" },
        approval:  { title: "最終承認",             desc: "Chiefが最終デザインを承認し、製造に向けてリリース。" },
        export:    { title: "製造エクスポート",     desc: "PMが文書、カットリスト、部品スケジュールをエクスポート。" }
      }
    }
  },
  ar: {
    home: { pageTitle: "ENS — منصة تصميم المعارض والأجنحة" },
    team: {
      pageTitle: "ENS بوابة الفريق — مركز الموظفين والعملاء",
      chiefFeatures: {
        workspaceMonitor: { title: "مراقب مساحة العمل",    desc: "إشراف مباشر على كل جلسة تصميم نشطة عبر جميع المشاريع." },
        teamManagement:   { title: "إدارة الفريق",          desc: "تعيين مديري المشاريع وتتبع أعباء العمل وإدارة الصلاحيات." },
        clientPortfolio:  { title: "محفظة العملاء",         desc: "عرض كامل لجميع حسابات العملاء وجهات الاتصال والعقود النشطة." },
        analytics:        { title: "التحليلات والتقارير",   desc: "مؤشرات أداء المشاريع ومعدلات الموافقة ولوحات الإيرادات." },
        approvalGateway:  { title: "بوابة الموافقة",        desc: "الموافقة الهيكلية والتصميمية النهائية قبل الإنتاج." },
        commsHub:         { title: "مركز الاتصالات",        desc: "رسائل مركزية بين العملاء ومديري المشاريع والمقاولين." }
      },
      pmFeatures: {
        boothWorkspace: { title: "مساحة عمل ثلاثية الأبعاد", desc: "محرر Octanorm/Maxima الكامل مع تصميم تعاوني في الوقت الفعلي." },
        clientMgmt:     { title: "إدارة العملاء",            desc: "إدارة الموجزات والجهات والجلسات التفاعلية لكل مشروع." },
        taskTracker:    { title: "متتبع المهام",              desc: "لوح كانبان يغطي مراحل الإنتاج والتصميم والتسليم." },
        pipeline:       { title: "خط أنابيب المشاريع",      desc: "تتبع جميع المشاريع النشطة والقادمة مع الجداول الزمنية." },
        requestMgmt:    { title: "إدارة الطلبات",            desc: "معالجة طلبات التغيير وسجلات المراجعة وسلاسل الموافقة." },
        messaging:      { title: "المراسلة",                 desc: "رسائل مباشرة وجماعية مع العملاء والمكتب الرئيسي." }
      },
      workflowSteps: {
        brief:     { title: "موجز العميل",       desc: "يستلم الرئيس موجز المعرض ويسنده إلى مدير مشروع." },
        workspace: { title: "إعداد مساحة العمل", desc: "يُنشئ مدير المشروع المشروع ويضبط أبعاد وأنظمة الجناح." },
        design:    { title: "التصميم ثلاثي الأبعاد", desc: "يبني مدير المشروع الجناح في مساحة العمل باستخدام مكتبات هيكلية." },
        review:    { title: "مراجعة الرئيس",     desc: "يراقب الرئيس التقدم ويقدم توجيهات هيكلية." },
        signoff:   { title: "موافقة العميل",     desc: "يراجع العميل التصميم ويقدم طلبات التغيير." },
        approval:  { title: "الموافقة النهائية", desc: "يوافق الرئيس على التصميم النهائي ويُطلقه للإنتاج." },
        export:    { title: "تصدير الإنتاج",     desc: "يصدر مدير المشروع الوثائق وقوائم القطع والجداول." }
      }
    }
  },
  tr: {
    home: { pageTitle: "ENS — Fuar ve Stand Tasarım Platformu" },
    team: {
      pageTitle: "ENS Ekip Portalı — Personel ve Müşteri Merkezi",
      chiefFeatures: {
        workspaceMonitor: { title: "Çalışma Alanı Monitörü", desc: "Tüm projelerdeki her aktif tasarım oturumunu canlı olarak izleme." },
        teamManagement:   { title: "Ekip Yönetimi",           desc: "Proje yöneticileri atama, iş yüklerini takip etme ve erişimleri yönetme." },
        clientPortfolio:  { title: "Müşteri Portföyü",        desc: "Tüm müşteri hesapları, kişiler ve aktif sözleşmelerin tam görünümü." },
        analytics:        { title: "Analizler ve Raporlar",   desc: "Proje KPI'ları, onay süreleri ve gelir gösterge panelleri." },
        approvalGateway:  { title: "Onay Portalı",            desc: "Üretime geçmeden önce nihai yapısal ve tasarım onayı." },
        commsHub:         { title: "İletişim Merkezi",        desc: "Müşteriler, PM'ler ve taşeronlar arasında merkezi mesajlaşma." }
      },
      pmFeatures: {
        boothWorkspace: { title: "3D Stand Çalışma Alanı", desc: "Gerçek zamanlı işbirlikçi tasarım ile tam Octanorm/Maxima editörü." },
        clientMgmt:     { title: "Müşteri Yönetimi",       desc: "Proje başına brief, kişi ve canlı geri bildirim oturumlarını yönetme." },
        taskTracker:    { title: "Görev Takibi",            desc: "Üretim, tasarım ve teslimat aşamalarını kapsayan Kanban panosu." },
        pipeline:       { title: "Proje Boru Hattı",       desc: "Tüm aktif ve yaklaşan projeleri kilometre taşı zaman çizelgeleriyle takip etme." },
        requestMgmt:    { title: "Talep Yönetimi",         desc: "Değişiklik talepleri, revizyon günlükleri ve onay zincirlerini yönetme." },
        messaging:      { title: "Mesajlaşma",              desc: "Müşteriler ve ana ofisle doğrudan ve grup mesajlaşması." }
      },
      workflowSteps: {
        brief:     { title: "Müşteri Brifing",   desc: "Chief fuar briefini alır ve bir Proje Yöneticisine atar." },
        workspace: { title: "Çalışma Alanı Kurulum", desc: "PM projeyi oluşturur ve stand boyutlarını ve sistemini yapılandırır." },
        design:    { title: "3D Tasarım",         desc: "PM yapısal kütüphaneleri kullanarak canlı çalışma alanında standı inşa eder." },
        review:    { title: "Chief İncelemesi",   desc: "Chief ilerlemeyi izler ve yapısal rehberlik sağlar." },
        signoff:   { title: "Müşteri Onayı",     desc: "Müşteri tasarımı inceler ve değişiklik talepleri sunar." },
        approval:  { title: "Nihai Onay",        desc: "Chief nihai tasarımı onaylar ve üretime serbest bırakır." },
        export:    { title: "Üretim Dışa Aktarımı", desc: "PM belgeleri, kesim listelerini ve bileşen programlarını dışa aktarır." }
      }
    }
  }
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const merged = deepMerge(existing, data);
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Updated ${lang}.json`);
}

console.log('Done — pageTitle and team feature keys added to all 11 locales.');
