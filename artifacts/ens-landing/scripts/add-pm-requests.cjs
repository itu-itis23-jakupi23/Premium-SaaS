const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "../src/i18n/locales");

const en = JSON.parse(fs.readFileSync(path.join(base, "en.json"), "utf8"));
en.pm.requests = {
  title: "Revision Requests",
  pendingBadge: "{{count}} Pending",
  justNow: "just now",
  pmInitials: "PM",
  replyCount: "{{count}} replies",
  replyPlaceholder: "Add a reply…",
  noMatch: "No requests match this filter.",
  filter: { all: "All" },
  status: { pending: "Pending", inProgress: "In Progress", resolved: "Resolved", declined: "Declined" },
  priority: { high: "High", medium: "Medium", low: "Low" },
  actions: {
    start: "Start",
    decline: "Decline",
    resolve: "Resolve",
    reply: "Reply",
    sendReply: "Send reply",
    expand: "Show replies",
    collapse: "Hide replies"
  },
  toast: {
    started: "Request started",
    declined: "Request declined",
    resolved: "Request resolved",
    pending: "Request set to pending",
    replySent: "Reply sent"
  }
};
fs.writeFileSync(path.join(base, "en.json"), JSON.stringify(en, null, 2), "utf8");
console.log("en OK");

const t = {
  de: { title:"Änderungsanfragen", pendingBadge:"{{count}} ausstehend", justNow:"gerade eben", pmInitials:"PM", replyCount:"{{count}} Antworten", replyPlaceholder:"Antwort hinzufügen…", noMatch:"Keine Anfragen entsprechen diesem Filter.", filter:{all:"Alle"}, status:{pending:"Ausstehend",inProgress:"In Bearbeitung",resolved:"Gelöst",declined:"Abgelehnt"}, priority:{high:"Hoch",medium:"Mittel",low:"Niedrig"}, actions:{start:"Starten",decline:"Ablehnen",resolve:"Lösen",reply:"Antworten",sendReply:"Antwort senden",expand:"Antworten anzeigen",collapse:"Antworten verbergen"}, toast:{started:"Anfrage gestartet",declined:"Anfrage abgelehnt",resolved:"Anfrage gelöst",pending:"Anfrage ausstehend gesetzt",replySent:"Antwort gesendet"} },
  fr: { title:"Demandes de révision", pendingBadge:"{{count}} en attente", justNow:"à l'instant", pmInitials:"PM", replyCount:"{{count}} réponses", replyPlaceholder:"Ajouter une réponse…", noMatch:"Aucune demande ne correspond à ce filtre.", filter:{all:"Toutes"}, status:{pending:"En attente",inProgress:"En cours",resolved:"Résolu",declined:"Refusé"}, priority:{high:"Élevée",medium:"Moyenne",low:"Faible"}, actions:{start:"Démarrer",decline:"Refuser",resolve:"Résoudre",reply:"Répondre",sendReply:"Envoyer la réponse",expand:"Afficher les réponses",collapse:"Masquer les réponses"}, toast:{started:"Demande démarrée",declined:"Demande refusée",resolved:"Demande résolue",pending:"Demande en attente",replySent:"Réponse envoyée"} },
  es: { title:"Solicitudes de revisión", pendingBadge:"{{count}} pendiente(s)", justNow:"ahora mismo", pmInitials:"PM", replyCount:"{{count}} respuestas", replyPlaceholder:"Añadir una respuesta…", noMatch:"Ninguna solicitud coincide con este filtro.", filter:{all:"Todas"}, status:{pending:"Pendiente",inProgress:"En progreso",resolved:"Resuelto",declined:"Rechazado"}, priority:{high:"Alta",medium:"Media",low:"Baja"}, actions:{start:"Iniciar",decline:"Rechazar",resolve:"Resolver",reply:"Responder",sendReply:"Enviar respuesta",expand:"Mostrar respuestas",collapse:"Ocultar respuestas"}, toast:{started:"Solicitud iniciada",declined:"Solicitud rechazada",resolved:"Solicitud resuelta",pending:"Solicitud pendiente",replySent:"Respuesta enviada"} },
  it: { title:"Richieste di revisione", pendingBadge:"{{count}} in attesa", justNow:"adesso", pmInitials:"PM", replyCount:"{{count}} risposte", replyPlaceholder:"Aggiungi una risposta…", noMatch:"Nessuna richiesta corrisponde a questo filtro.", filter:{all:"Tutte"}, status:{pending:"In attesa",inProgress:"In corso",resolved:"Risolto",declined:"Rifiutato"}, priority:{high:"Alta",medium:"Media",low:"Bassa"}, actions:{start:"Avvia",decline:"Rifiuta",resolve:"Risolvi",reply:"Rispondi",sendReply:"Invia risposta",expand:"Mostra risposte",collapse:"Nascondi risposte"}, toast:{started:"Richiesta avviata",declined:"Richiesta rifiutata",resolved:"Richiesta risolta",pending:"Richiesta in attesa",replySent:"Risposta inviata"} },
  pt: { title:"Solicitações de revisão", pendingBadge:"{{count}} pendente(s)", justNow:"agora mesmo", pmInitials:"PM", replyCount:"{{count}} respostas", replyPlaceholder:"Adicionar uma resposta…", noMatch:"Nenhuma solicitação corresponde a este filtro.", filter:{all:"Todas"}, status:{pending:"Pendente",inProgress:"Em andamento",resolved:"Resolvido",declined:"Recusado"}, priority:{high:"Alta",medium:"Média",low:"Baixa"}, actions:{start:"Iniciar",decline:"Recusar",resolve:"Resolver",reply:"Responder",sendReply:"Enviar resposta",expand:"Mostrar respostas",collapse:"Ocultar respostas"}, toast:{started:"Solicitação iniciada",declined:"Solicitação recusada",resolved:"Solicitação resolvida",pending:"Solicitação pendente",replySent:"Resposta enviada"} },
  nl: { title:"Revisieaanvragen", pendingBadge:"{{count}} in behandeling", justNow:"zojuist", pmInitials:"PM", replyCount:"{{count}} reacties", replyPlaceholder:"Voeg een reactie toe…", noMatch:"Geen aanvragen komen overeen met dit filter.", filter:{all:"Alle"}, status:{pending:"In behandeling",inProgress:"In uitvoering",resolved:"Opgelost",declined:"Afgewezen"}, priority:{high:"Hoog",medium:"Gemiddeld",low:"Laag"}, actions:{start:"Starten",decline:"Afwijzen",resolve:"Oplossen",reply:"Reageren",sendReply:"Reactie verzenden",expand:"Reacties tonen",collapse:"Reacties verbergen"}, toast:{started:"Aanvraag gestart",declined:"Aanvraag afgewezen",resolved:"Aanvraag opgelost",pending:"Aanvraag in behandeling",replySent:"Reactie verzonden"} },
  zh: { title:"修改申请", pendingBadge:"{{count}} 待处理", justNow:"刚刚", pmInitials:"PM", replyCount:"{{count}} 条回复", replyPlaceholder:"添加回复…", noMatch:"没有申请符合此筛选条件。", filter:{all:"全部"}, status:{pending:"待处理",inProgress:"进行中",resolved:"已解决",declined:"已拒绝"}, priority:{high:"高",medium:"中",low:"低"}, actions:{start:"开始",decline:"拒绝",resolve:"解决",reply:"回复",sendReply:"发送回复",expand:"显示回复",collapse:"隐藏回复"}, toast:{started:"申请已开始",declined:"申请已拒绝",resolved:"申请已解决",pending:"申请设为待处理",replySent:"回复已发送"} },
  ja: { title:"修正依頼", pendingBadge:"{{count}} 件保留中", justNow:"たった今", pmInitials:"PM", replyCount:"{{count}} 件の返信", replyPlaceholder:"返信を追加…", noMatch:"このフィルターに一致する依頼はありません。", filter:{all:"すべて"}, status:{pending:"保留中",inProgress:"進行中",resolved:"解決済み",declined:"却下"}, priority:{high:"高",medium:"中",low:"低"}, actions:{start:"開始",decline:"却下",resolve:"解決",reply:"返信",sendReply:"返信を送信",expand:"返信を表示",collapse:"返信を非表示"}, toast:{started:"依頼を開始しました",declined:"依頼を却下しました",resolved:"依頼を解決しました",pending:"依頼を保留に設定しました",replySent:"返信を送信しました"} },
  ar: { title:"طلبات المراجعة", pendingBadge:"{{count}} معلق", justNow:"الآن", pmInitials:"PM", replyCount:"{{count}} ردود", replyPlaceholder:"أضف رداً…", noMatch:"لا توجد طلبات تطابق هذا التصفية.", filter:{all:"الكل"}, status:{pending:"معلق",inProgress:"قيد التنفيذ",resolved:"تم الحل",declined:"مرفوض"}, priority:{high:"عالية",medium:"متوسطة",low:"منخفضة"}, actions:{start:"بدء",decline:"رفض",resolve:"حل",reply:"رد",sendReply:"إرسال الرد",expand:"عرض الردود",collapse:"إخفاء الردود"}, toast:{started:"تم بدء الطلب",declined:"تم رفض الطلب",resolved:"تم حل الطلب",pending:"تم تعيين الطلب معلقاً",replySent:"تم إرسال الرد"} },
  tr: { title:"Revizyon Talepleri", pendingBadge:"{{count}} bekleyen", justNow:"az önce", pmInitials:"PM", replyCount:"{{count}} yanıt", replyPlaceholder:"Yanıt ekle…", noMatch:"Bu filtreyle eşleşen talep yok.", filter:{all:"Tümü"}, status:{pending:"Bekliyor",inProgress:"Devam Ediyor",resolved:"Çözüldü",declined:"Reddedildi"}, priority:{high:"Yüksek",medium:"Orta",low:"Düşük"}, actions:{start:"Başlat",decline:"Reddet",resolve:"Çöz",reply:"Yanıtla",sendReply:"Yanıt gönder",expand:"Yanıtları göster",collapse:"Yanıtları gizle"}, toast:{started:"Talep başlatıldı",declined:"Talep reddedildi",resolved:"Talep çözüldü",pending:"Talep beklemede ayarlandı",replySent:"Yanıt gönderildi"} }
};

for (const [lang, vals] of Object.entries(t)) {
  const filePath = path.join(base, lang + ".json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.pm) data.pm = {};
  data.pm.requests = vals;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(lang + " OK");
}
