const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "../src/i18n/locales");

const en = JSON.parse(fs.readFileSync(path.join(base, "en.json"), "utf8"));
en.pm.messages = {
  title: "Messages",
  unread: "{{count}} unread",
  justNow: "just now",
  loadContactsError: "Could not load contacts.",
  loadMessagesError: "Could not load messages.",
  sendError: "Could not send message.",
  searchPlaceholder: "Search contacts…",
  loadingContacts: "Loading contacts…",
  noContacts: "No contacts found.",
  chiefPortal: "Chief portal",
  noMessages: "No messages yet. Send the first one!",
  selectContact: "Select a contact to start messaging.",
  inputPlaceholder: "Type a message…",
  enterToSend: "Press Enter to send",
  toast: {
    callStarted: "Starting call with {{name}}…",
    videoReady: "Opening video with {{name}}…",
    optionsOpened: "Options menu opened.",
    attachmentOpened: "Attachment picker opened."
  },
  actions: {
    call: "Start voice call",
    video: "Start video call",
    more: "More options",
    attach: "Attach file",
    send: "Send message"
  }
};
fs.writeFileSync(path.join(base, "en.json"), JSON.stringify(en, null, 2), "utf8");
console.log("en OK");

const t = {
  de: { title:"Nachrichten", unread:"{{count}} ungelesen", justNow:"gerade eben", loadContactsError:"Kontakte konnten nicht geladen werden.", loadMessagesError:"Nachrichten konnten nicht geladen werden.", sendError:"Nachricht konnte nicht gesendet werden.", searchPlaceholder:"Kontakte suchen…", loadingContacts:"Kontakte werden geladen…", noContacts:"Keine Kontakte gefunden.", chiefPortal:"Chef-Portal", noMessages:"Noch keine Nachrichten. Senden Sie die erste!", selectContact:"Kontakt auswählen, um zu schreiben.", inputPlaceholder:"Nachricht eingeben…", enterToSend:"Enter zum Senden", toast:{callStarted:"Anruf mit {{name}} wird gestartet…",videoReady:"Video mit {{name}} wird geöffnet…",optionsOpened:"Optionsmenü geöffnet.",attachmentOpened:"Dateiauswahl geöffnet."}, actions:{call:"Sprachanruf starten",video:"Videoanruf starten",more:"Weitere Optionen",attach:"Datei anhängen",send:"Nachricht senden"} },
  fr: { title:"Messages", unread:"{{count}} non lu(s)", justNow:"à l'instant", loadContactsError:"Impossible de charger les contacts.", loadMessagesError:"Impossible de charger les messages.", sendError:"Impossible d'envoyer le message.", searchPlaceholder:"Rechercher des contacts…", loadingContacts:"Chargement des contacts…", noContacts:"Aucun contact trouvé.", chiefPortal:"Portail chef", noMessages:"Pas encore de messages. Envoyez le premier !", selectContact:"Sélectionnez un contact pour commencer.", inputPlaceholder:"Saisir un message…", enterToSend:"Appuyez sur Entrée pour envoyer", toast:{callStarted:"Appel en cours avec {{name}}…",videoReady:"Ouverture de la vidéo avec {{name}}…",optionsOpened:"Menu d'options ouvert.",attachmentOpened:"Sélecteur de pièce jointe ouvert."}, actions:{call:"Démarrer un appel vocal",video:"Démarrer un appel vidéo",more:"Plus d'options",attach:"Joindre un fichier",send:"Envoyer le message"} },
  es: { title:"Mensajes", unread:"{{count}} sin leer", justNow:"ahora mismo", loadContactsError:"No se pudieron cargar los contactos.", loadMessagesError:"No se pudieron cargar los mensajes.", sendError:"No se pudo enviar el mensaje.", searchPlaceholder:"Buscar contactos…", loadingContacts:"Cargando contactos…", noContacts:"No se encontraron contactos.", chiefPortal:"Portal del jefe", noMessages:"Aún no hay mensajes. ¡Envía el primero!", selectContact:"Selecciona un contacto para empezar.", inputPlaceholder:"Escribe un mensaje…", enterToSend:"Pulsa Enter para enviar", toast:{callStarted:"Iniciando llamada con {{name}}…",videoReady:"Abriendo vídeo con {{name}}…",optionsOpened:"Menú de opciones abierto.",attachmentOpened:"Selector de archivos abierto."}, actions:{call:"Iniciar llamada de voz",video:"Iniciar videollamada",more:"Más opciones",attach:"Adjuntar archivo",send:"Enviar mensaje"} },
  it: { title:"Messaggi", unread:"{{count}} non letti", justNow:"adesso", loadContactsError:"Impossibile caricare i contatti.", loadMessagesError:"Impossibile caricare i messaggi.", sendError:"Impossibile inviare il messaggio.", searchPlaceholder:"Cerca contatti…", loadingContacts:"Caricamento contatti…", noContacts:"Nessun contatto trovato.", chiefPortal:"Portale capo", noMessages:"Nessun messaggio ancora. Invia il primo!", selectContact:"Seleziona un contatto per iniziare.", inputPlaceholder:"Scrivi un messaggio…", enterToSend:"Premi Invio per inviare", toast:{callStarted:"Avvio chiamata con {{name}}…",videoReady:"Apertura video con {{name}}…",optionsOpened:"Menu opzioni aperto.",attachmentOpened:"Selettore allegati aperto."}, actions:{call:"Avvia chiamata vocale",video:"Avvia videochiamata",more:"Altre opzioni",attach:"Allega file",send:"Invia messaggio"} },
  pt: { title:"Mensagens", unread:"{{count}} não lida(s)", justNow:"agora mesmo", loadContactsError:"Não foi possível carregar os contatos.", loadMessagesError:"Não foi possível carregar as mensagens.", sendError:"Não foi possível enviar a mensagem.", searchPlaceholder:"Buscar contatos…", loadingContacts:"Carregando contatos…", noContacts:"Nenhum contato encontrado.", chiefPortal:"Portal do chefe", noMessages:"Ainda sem mensagens. Envie a primeira!", selectContact:"Selecione um contato para começar.", inputPlaceholder:"Digite uma mensagem…", enterToSend:"Pressione Enter para enviar", toast:{callStarted:"Iniciando chamada com {{name}}…",videoReady:"Abrindo vídeo com {{name}}…",optionsOpened:"Menu de opções aberto.",attachmentOpened:"Seletor de arquivos aberto."}, actions:{call:"Iniciar chamada de voz",video:"Iniciar videochamada",more:"Mais opções",attach:"Anexar arquivo",send:"Enviar mensagem"} },
  nl: { title:"Berichten", unread:"{{count}} ongelezen", justNow:"zojuist", loadContactsError:"Contacten konden niet worden geladen.", loadMessagesError:"Berichten konden niet worden geladen.", sendError:"Bericht kon niet worden verzonden.", searchPlaceholder:"Contacten zoeken…", loadingContacts:"Contacten laden…", noContacts:"Geen contacten gevonden.", chiefPortal:"Chefportaal", noMessages:"Nog geen berichten. Stuur de eerste!", selectContact:"Selecteer een contact om te beginnen.", inputPlaceholder:"Typ een bericht…", enterToSend:"Druk op Enter om te verzenden", toast:{callStarted:"Gesprek starten met {{name}}…",videoReady:"Video openen met {{name}}…",optionsOpened:"Optiemenu geopend.",attachmentOpened:"Bestandsselectie geopend."}, actions:{call:"Spraakgesprek starten",video:"Videogesprek starten",more:"Meer opties",attach:"Bestand bijvoegen",send:"Bericht verzenden"} },
  zh: { title:"消息", unread:"{{count}} 条未读", justNow:"刚刚", loadContactsError:"无法加载联系人。", loadMessagesError:"无法加载消息。", sendError:"无法发送消息。", searchPlaceholder:"搜索联系人…", loadingContacts:"正在加载联系人…", noContacts:"未找到联系人。", chiefPortal:"首席门户", noMessages:"暂无消息，发送第一条吧！", selectContact:"选择联系人开始聊天。", inputPlaceholder:"输入消息…", enterToSend:"按 Enter 发送", toast:{callStarted:"正在与 {{name}} 通话…",videoReady:"正在与 {{name}} 开启视频…",optionsOpened:"选项菜单已打开。",attachmentOpened:"附件选择器已打开。"}, actions:{call:"开始语音通话",video:"开始视频通话",more:"更多选项",attach:"附加文件",send:"发送消息"} },
  ja: { title:"メッセージ", unread:"{{count}} 件未読", justNow:"たった今", loadContactsError:"連絡先を読み込めませんでした。", loadMessagesError:"メッセージを読み込めませんでした。", sendError:"メッセージを送信できませんでした。", searchPlaceholder:"連絡先を検索…", loadingContacts:"連絡先を読み込み中…", noContacts:"連絡先が見つかりません。", chiefPortal:"チーフポータル", noMessages:"メッセージがありません。最初のメッセージを送りましょう！", selectContact:"連絡先を選択してメッセージを開始。", inputPlaceholder:"メッセージを入力…", enterToSend:"Enterで送信", toast:{callStarted:"{{name}} との通話を開始中…",videoReady:"{{name}} とのビデオを開始中…",optionsOpened:"オプションメニューを開きました。",attachmentOpened:"添付ファイル選択を開きました。"}, actions:{call:"音声通話を開始",video:"ビデオ通話を開始",more:"その他のオプション",attach:"ファイルを添付",send:"メッセージを送信"} },
  ar: { title:"الرسائل", unread:"{{count}} غير مقروءة", justNow:"الآن", loadContactsError:"تعذر تحميل جهات الاتصال.", loadMessagesError:"تعذر تحميل الرسائل.", sendError:"تعذر إرسال الرسالة.", searchPlaceholder:"البحث في جهات الاتصال…", loadingContacts:"جار تحميل جهات الاتصال…", noContacts:"لم يتم العثور على جهات اتصال.", chiefPortal:"بوابة الرئيس", noMessages:"لا توجد رسائل بعد. أرسل الأولى!", selectContact:"اختر جهة اتصال للبدء.", inputPlaceholder:"اكتب رسالة…", enterToSend:"اضغط Enter للإرسال", toast:{callStarted:"جار بدء مكالمة مع {{name}}…",videoReady:"جار فتح الفيديو مع {{name}}…",optionsOpened:"تم فتح قائمة الخيارات.",attachmentOpened:"تم فتح منتقي المرفقات."}, actions:{call:"بدء مكالمة صوتية",video:"بدء مكالمة مرئية",more:"خيارات إضافية",attach:"إرفاق ملف",send:"إرسال الرسالة"} },
  tr: { title:"Mesajlar", unread:"{{count}} okunmamış", justNow:"az önce", loadContactsError:"Kişiler yüklenemedi.", loadMessagesError:"Mesajlar yüklenemedi.", sendError:"Mesaj gönderilemedi.", searchPlaceholder:"Kişi ara…", loadingContacts:"Kişiler yükleniyor…", noContacts:"Kişi bulunamadı.", chiefPortal:"Şef portalı", noMessages:"Henüz mesaj yok. İlkini siz gönderin!", selectContact:"Mesajlaşmaya başlamak için bir kişi seçin.", inputPlaceholder:"Mesaj yazın…", enterToSend:"Göndermek için Enter'a basın", toast:{callStarted:"{{name}} ile arama başlatılıyor…",videoReady:"{{name}} ile video açılıyor…",optionsOpened:"Seçenekler menüsü açıldı.",attachmentOpened:"Dosya seçici açıldı."}, actions:{call:"Sesli arama başlat",video:"Görüntülü arama başlat",more:"Daha fazla seçenek",attach:"Dosya ekle",send:"Mesaj gönder"} }
};

for (const [lang, vals] of Object.entries(t)) {
  const filePath = path.join(base, lang + ".json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!data.pm) data.pm = {};
  data.pm.messages = vals;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(lang + " OK");
}
