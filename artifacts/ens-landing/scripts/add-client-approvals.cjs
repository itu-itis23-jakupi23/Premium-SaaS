/**
 * add-client-approvals.cjs
 * Adds client.approvals.* keys to all 11 locale files.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const TRANSLATIONS = {
  en: {
    pageTitle: "Approvals | ENS",
    title: "Approvals",
    breadcrumbDashboard: "Dashboard",
    awaitingReview: "{{count}} Awaiting Your Review",
    filterGroup: "Filter approvals",
    filterByStatus: "Filter by {{status}}",
    justNow: "Just now",
    emptyState: "No approvals here.",
    toggleDetails: "Toggle details for {{title}}",
    commentPlaceholder: "Leave a comment for your PM…",
    sendComment: "Send comment",
    status: {
      Pending: "Pending",
      Approved: "Approved",
      Rejected: "Rejected",
    },
    filter: {
      all: "All",
    },
    actions: {
      approve: "Approve",
      requestChanges: "Request Changes",
      viewDetails: "View Details",
    },
    toast: {
      approved: "✓ Design approved — PM notified",
      rejected: "Changes requested — PM notified",
      commentSent: "Comment sent to PM",
    },
    badge: {
      me: "ME",
      pm: "PM",
    },
    comments_one: "{{count}} comment",
    comments_other: "{{count}} comments",
    confirm: {
      approveTitle: "Approve This Design?",
      rejectTitle: "Request Changes?",
      approveBody:
        "Your PM will be notified and this version will be marked as approved.",
      rejectBody: "Your PM will be notified and will address your feedback.",
      cancel: "Cancel",
      confirmApprove: "Yes, Approve",
      confirmReject: "Yes, Request Changes",
    },
  },
  de: {
    pageTitle: "Genehmigungen | ENS",
    title: "Genehmigungen",
    breadcrumbDashboard: "Dashboard",
    awaitingReview: "{{count}} Warten auf Ihre Überprüfung",
    filterGroup: "Genehmigungen filtern",
    filterByStatus: "Nach {{status}} filtern",
    justNow: "Gerade eben",
    emptyState: "Keine Genehmigungen hier.",
    toggleDetails: "Details für {{title}} umschalten",
    commentPlaceholder: "Hinterlassen Sie einen Kommentar für Ihren PM…",
    sendComment: "Kommentar senden",
    status: {
      Pending: "Ausstehend",
      Approved: "Genehmigt",
      Rejected: "Abgelehnt",
    },
    filter: {
      all: "Alle",
    },
    actions: {
      approve: "Genehmigen",
      requestChanges: "Änderungen anfordern",
      viewDetails: "Details anzeigen",
    },
    toast: {
      approved: "✓ Design genehmigt — PM benachrichtigt",
      rejected: "Änderungen angefordert — PM benachrichtigt",
      commentSent: "Kommentar an PM gesendet",
    },
    badge: {
      me: "ICH",
      pm: "PM",
    },
    comments_one: "{{count}} Kommentar",
    comments_other: "{{count}} Kommentare",
    confirm: {
      approveTitle: "Dieses Design genehmigen?",
      rejectTitle: "Änderungen anfordern?",
      approveBody:
        "Ihr PM wird benachrichtigt und diese Version als genehmigt markiert.",
      rejectBody:
        "Ihr PM wird benachrichtigt und Ihr Feedback berücksichtigen.",
      cancel: "Abbrechen",
      confirmApprove: "Ja, genehmigen",
      confirmReject: "Ja, Änderungen anfordern",
    },
  },
  fr: {
    pageTitle: "Approbations | ENS",
    title: "Approbations",
    breadcrumbDashboard: "Tableau de bord",
    awaitingReview: "{{count}} en attente de votre révision",
    filterGroup: "Filtrer les approbations",
    filterByStatus: "Filtrer par {{status}}",
    justNow: "À l'instant",
    emptyState: "Aucune approbation ici.",
    toggleDetails: "Basculer les détails pour {{title}}",
    commentPlaceholder: "Laisser un commentaire à votre chef de projet…",
    sendComment: "Envoyer le commentaire",
    status: {
      Pending: "En attente",
      Approved: "Approuvé",
      Rejected: "Rejeté",
    },
    filter: {
      all: "Tous",
    },
    actions: {
      approve: "Approuver",
      requestChanges: "Demander des modifications",
      viewDetails: "Voir les détails",
    },
    toast: {
      approved: "✓ Design approuvé — chef de projet notifié",
      rejected: "Modifications demandées — chef de projet notifié",
      commentSent: "Commentaire envoyé au chef de projet",
    },
    badge: {
      me: "MOI",
      pm: "CP",
    },
    comments_one: "{{count}} commentaire",
    comments_other: "{{count}} commentaires",
    confirm: {
      approveTitle: "Approuver ce design ?",
      rejectTitle: "Demander des modifications ?",
      approveBody:
        "Votre chef de projet sera notifié et cette version sera marquée comme approuvée.",
      rejectBody:
        "Votre chef de projet sera notifié et prendra en compte vos retours.",
      cancel: "Annuler",
      confirmApprove: "Oui, approuver",
      confirmReject: "Oui, demander des modifications",
    },
  },
  es: {
    pageTitle: "Aprobaciones | ENS",
    title: "Aprobaciones",
    breadcrumbDashboard: "Panel",
    awaitingReview: "{{count}} esperando su revisión",
    filterGroup: "Filtrar aprobaciones",
    filterByStatus: "Filtrar por {{status}}",
    justNow: "Ahora mismo",
    emptyState: "No hay aprobaciones aquí.",
    toggleDetails: "Alternar detalles de {{title}}",
    commentPlaceholder: "Deja un comentario a tu director de proyecto…",
    sendComment: "Enviar comentario",
    status: {
      Pending: "Pendiente",
      Approved: "Aprobado",
      Rejected: "Rechazado",
    },
    filter: {
      all: "Todos",
    },
    actions: {
      approve: "Aprobar",
      requestChanges: "Solicitar cambios",
      viewDetails: "Ver detalles",
    },
    toast: {
      approved: "✓ Diseño aprobado — director notificado",
      rejected: "Cambios solicitados — director notificado",
      commentSent: "Comentario enviado al director",
    },
    badge: {
      me: "YO",
      pm: "DP",
    },
    comments_one: "{{count}} comentario",
    comments_other: "{{count}} comentarios",
    confirm: {
      approveTitle: "¿Aprobar este diseño?",
      rejectTitle: "¿Solicitar cambios?",
      approveBody:
        "Se notificará a su director y esta versión quedará marcada como aprobada.",
      rejectBody:
        "Se notificará a su director, quien atenderá sus comentarios.",
      cancel: "Cancelar",
      confirmApprove: "Sí, aprobar",
      confirmReject: "Sí, solicitar cambios",
    },
  },
  it: {
    pageTitle: "Approvazioni | ENS",
    title: "Approvazioni",
    breadcrumbDashboard: "Dashboard",
    awaitingReview: "{{count}} in attesa della tua revisione",
    filterGroup: "Filtra approvazioni",
    filterByStatus: "Filtra per {{status}}",
    justNow: "Proprio ora",
    emptyState: "Nessuna approvazione qui.",
    toggleDetails: "Mostra/nascondi dettagli per {{title}}",
    commentPlaceholder: "Lascia un commento al tuo PM…",
    sendComment: "Invia commento",
    status: {
      Pending: "In attesa",
      Approved: "Approvato",
      Rejected: "Rifiutato",
    },
    filter: {
      all: "Tutti",
    },
    actions: {
      approve: "Approva",
      requestChanges: "Richiedi modifiche",
      viewDetails: "Visualizza dettagli",
    },
    toast: {
      approved: "✓ Design approvato — PM notificato",
      rejected: "Modifiche richieste — PM notificato",
      commentSent: "Commento inviato al PM",
    },
    badge: {
      me: "IO",
      pm: "PM",
    },
    comments_one: "{{count}} commento",
    comments_other: "{{count}} commenti",
    confirm: {
      approveTitle: "Approvare questo design?",
      rejectTitle: "Richiedere modifiche?",
      approveBody:
        "Il tuo PM sarà notificato e questa versione sarà contrassegnata come approvata.",
      rejectBody: "Il tuo PM sarà notificato e gestirà il tuo feedback.",
      cancel: "Annulla",
      confirmApprove: "Sì, approva",
      confirmReject: "Sì, richiedi modifiche",
    },
  },
  pt: {
    pageTitle: "Aprovações | ENS",
    title: "Aprovações",
    breadcrumbDashboard: "Painel",
    awaitingReview: "{{count}} aguardando sua revisão",
    filterGroup: "Filtrar aprovações",
    filterByStatus: "Filtrar por {{status}}",
    justNow: "Agora mesmo",
    emptyState: "Nenhuma aprovação aqui.",
    toggleDetails: "Alternar detalhes de {{title}}",
    commentPlaceholder: "Deixe um comentário para seu gerente de projeto…",
    sendComment: "Enviar comentário",
    status: {
      Pending: "Pendente",
      Approved: "Aprovado",
      Rejected: "Rejeitado",
    },
    filter: {
      all: "Todos",
    },
    actions: {
      approve: "Aprovar",
      requestChanges: "Solicitar alterações",
      viewDetails: "Ver detalhes",
    },
    toast: {
      approved: "✓ Design aprovado — gerente notificado",
      rejected: "Alterações solicitadas — gerente notificado",
      commentSent: "Comentário enviado ao gerente",
    },
    badge: {
      me: "EU",
      pm: "GP",
    },
    comments_one: "{{count}} comentário",
    comments_other: "{{count}} comentários",
    confirm: {
      approveTitle: "Aprovar este design?",
      rejectTitle: "Solicitar alterações?",
      approveBody:
        "Seu gerente será notificado e esta versão será marcada como aprovada.",
      rejectBody: "Seu gerente será notificado e atenderá ao seu feedback.",
      cancel: "Cancelar",
      confirmApprove: "Sim, aprovar",
      confirmReject: "Sim, solicitar alterações",
    },
  },
  nl: {
    pageTitle: "Goedkeuringen | ENS",
    title: "Goedkeuringen",
    breadcrumbDashboard: "Dashboard",
    awaitingReview: "{{count}} wacht op uw beoordeling",
    filterGroup: "Goedkeuringen filteren",
    filterByStatus: "Filteren op {{status}}",
    justNow: "Zojuist",
    emptyState: "Geen goedkeuringen hier.",
    toggleDetails: "Details voor {{title}} in-/uitklappen",
    commentPlaceholder: "Laat een reactie achter voor uw PM…",
    sendComment: "Opmerking versturen",
    status: {
      Pending: "In behandeling",
      Approved: "Goedgekeurd",
      Rejected: "Afgewezen",
    },
    filter: {
      all: "Alle",
    },
    actions: {
      approve: "Goedkeuren",
      requestChanges: "Wijzigingen aanvragen",
      viewDetails: "Details bekijken",
    },
    toast: {
      approved: "✓ Ontwerp goedgekeurd — PM op de hoogte",
      rejected: "Wijzigingen aangevraagd — PM op de hoogte",
      commentSent: "Reactie verzonden naar PM",
    },
    badge: {
      me: "IK",
      pm: "PM",
    },
    comments_one: "{{count}} reactie",
    comments_other: "{{count}} reacties",
    confirm: {
      approveTitle: "Dit ontwerp goedkeuren?",
      rejectTitle: "Wijzigingen aanvragen?",
      approveBody:
        "Uw PM wordt op de hoogte gesteld en deze versie wordt als goedgekeurd gemarkeerd.",
      rejectBody:
        "Uw PM wordt op de hoogte gesteld en zal uw feedback verwerken.",
      cancel: "Annuleren",
      confirmApprove: "Ja, goedkeuren",
      confirmReject: "Ja, wijzigingen aanvragen",
    },
  },
  zh: {
    pageTitle: "审批 | ENS",
    title: "审批",
    breadcrumbDashboard: "仪表板",
    awaitingReview: "{{count}} 个待您审核",
    filterGroup: "筛选审批",
    filterByStatus: "按{{status}}筛选",
    justNow: "刚刚",
    emptyState: "暂无审批记录。",
    toggleDetails: "切换{{title}}的详情",
    commentPlaceholder: "给您的项目经理留言…",
    sendComment: "发送评论",
    status: {
      Pending: "待审核",
      Approved: "已批准",
      Rejected: "已拒绝",
    },
    filter: {
      all: "全部",
    },
    actions: {
      approve: "批准",
      requestChanges: "请求修改",
      viewDetails: "查看详情",
    },
    toast: {
      approved: "✓ 设计已批准 — 项目经理已通知",
      rejected: "已请求修改 — 项目经理已通知",
      commentSent: "评论已发送给项目经理",
    },
    badge: {
      me: "我",
      pm: "PM",
    },
    comments_one: "{{count}} 条评论",
    comments_other: "{{count}} 条评论",
    confirm: {
      approveTitle: "批准此设计？",
      rejectTitle: "请求修改？",
      approveBody: "您的项目经理将收到通知，此版本将标记为已批准。",
      rejectBody: "您的项目经理将收到通知并处理您的反馈。",
      cancel: "取消",
      confirmApprove: "是，批准",
      confirmReject: "是，请求修改",
    },
  },
  ja: {
    pageTitle: "承認 | ENS",
    title: "承認",
    breadcrumbDashboard: "ダッシュボード",
    awaitingReview: "{{count}}件がレビュー待ち",
    filterGroup: "承認のフィルター",
    filterByStatus: "{{status}}でフィルター",
    justNow: "たった今",
    emptyState: "承認はありません。",
    toggleDetails: "{{title}}の詳細を切り替え",
    commentPlaceholder: "プロジェクトマネージャーにコメントを残す…",
    sendComment: "コメントを送信",
    status: {
      Pending: "保留中",
      Approved: "承認済み",
      Rejected: "却下",
    },
    filter: {
      all: "すべて",
    },
    actions: {
      approve: "承認",
      requestChanges: "変更をリクエスト",
      viewDetails: "詳細を見る",
    },
    toast: {
      approved: "✓ デザインが承認されました — PMに通知済み",
      rejected: "変更がリクエストされました — PMに通知済み",
      commentSent: "PMにコメントを送信しました",
    },
    badge: {
      me: "私",
      pm: "PM",
    },
    comments_one: "{{count}}件のコメント",
    comments_other: "{{count}}件のコメント",
    confirm: {
      approveTitle: "このデザインを承認しますか？",
      rejectTitle: "変更をリクエストしますか？",
      approveBody:
        "PMに通知が届き、このバージョンが承認済みとしてマークされます。",
      rejectBody: "PMに通知が届き、フィードバックが対応されます。",
      cancel: "キャンセル",
      confirmApprove: "はい、承認する",
      confirmReject: "はい、変更をリクエストする",
    },
  },
  ar: {
    pageTitle: "الموافقات | ENS",
    title: "الموافقات",
    breadcrumbDashboard: "لوحة التحكم",
    awaitingReview: "{{count}} بانتظار مراجعتك",
    filterGroup: "تصفية الموافقات",
    filterByStatus: "تصفية حسب {{status}}",
    justNow: "الآن",
    emptyState: "لا توجد موافقات هنا.",
    toggleDetails: "تبديل تفاصيل {{title}}",
    commentPlaceholder: "اترك تعليقاً لمدير مشروعك…",
    sendComment: "إرسال التعليق",
    status: {
      Pending: "قيد الانتظار",
      Approved: "تمت الموافقة",
      Rejected: "مرفوض",
    },
    filter: {
      all: "الكل",
    },
    actions: {
      approve: "موافقة",
      requestChanges: "طلب تغييرات",
      viewDetails: "عرض التفاصيل",
    },
    toast: {
      approved: "✓ تمت الموافقة على التصميم — تم إخطار مدير المشروع",
      rejected: "تم طلب تغييرات — تم إخطار مدير المشروع",
      commentSent: "تم إرسال التعليق إلى مدير المشروع",
    },
    badge: {
      me: "أنا",
      pm: "م.م",
    },
    comments_one: "{{count}} تعليق",
    comments_other: "{{count}} تعليقات",
    confirm: {
      approveTitle: "الموافقة على هذا التصميم؟",
      rejectTitle: "طلب تغييرات؟",
      approveBody:
        "سيتم إخطار مدير مشروعك وتمييز هذا الإصدار على أنه معتمد.",
      rejectBody: "سيتم إخطار مدير مشروعك وسيتعامل مع ملاحظاتك.",
      cancel: "إلغاء",
      confirmApprove: "نعم، موافقة",
      confirmReject: "نعم، طلب تغييرات",
    },
  },
  tr: {
    pageTitle: "Onaylar | ENS",
    title: "Onaylar",
    breadcrumbDashboard: "Gösterge Paneli",
    awaitingReview: "{{count}} incelemenizi bekliyor",
    filterGroup: "Onayları filtrele",
    filterByStatus: "{{status}} ile filtrele",
    justNow: "Az önce",
    emptyState: "Burada onay yok.",
    toggleDetails: "{{title}} için ayrıntıları değiştir",
    commentPlaceholder: "Proje yöneticinize yorum bırakın…",
    sendComment: "Yorum gönder",
    status: {
      Pending: "Bekliyor",
      Approved: "Onaylandı",
      Rejected: "Reddedildi",
    },
    filter: {
      all: "Tümü",
    },
    actions: {
      approve: "Onayla",
      requestChanges: "Değişiklik İste",
      viewDetails: "Ayrıntıları Gör",
    },
    toast: {
      approved: "✓ Tasarım onaylandı — PM bildirildi",
      rejected: "Değişiklikler istendi — PM bildirildi",
      commentSent: "Yorum PM'e gönderildi",
    },
    badge: {
      me: "BEN",
      pm: "PM",
    },
    comments_one: "{{count}} yorum",
    comments_other: "{{count}} yorum",
    confirm: {
      approveTitle: "Bu Tasarımı Onayla?",
      rejectTitle: "Değişiklik İste?",
      approveBody: "PM'iniz bilgilendirilecek ve bu sürüm onaylı olarak işaretlenecek.",
      rejectBody: "PM'iniz bilgilendirilecek ve geri bildiriminizi ele alacak.",
      cancel: "İptal",
      confirmApprove: "Evet, Onayla",
      confirmReject: "Evet, Değişiklik İste",
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
  if (!json.client.approvals) json.client.approvals = {};

  json.client.approvals = deepMerge(json.client.approvals, keys);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
