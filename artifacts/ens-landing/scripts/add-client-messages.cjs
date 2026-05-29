/**
 * add-client-messages.cjs
 * Adds client.messages.* keys to all 11 locale files.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const TRANSLATIONS = {
  en: {
    pageTitle: "Messages | ENS",
    title: "Messages",
    breadcrumbDashboard: "Dashboard",
    searchPlaceholder: "Search messages...",
    contactListLabel: "Conversations",
    supportManager: "Support Manager",
    activeNow: "Active Now",
    justNow: "Just now",
    threadLabel: "Message thread",
    avatarYou: "YC",
    avatarPm: "PM",
    inputPlaceholder: "Type your message...",
    actions: {
      phone: "Start phone call",
      video: "Start video call",
      more: "More options",
      attach: "Attach file",
      send: "Send message",
    },
  },
  de: {
    pageTitle: "Nachrichten | ENS",
    title: "Nachrichten",
    breadcrumbDashboard: "Dashboard",
    searchPlaceholder: "Nachrichten suchen...",
    contactListLabel: "Gespräche",
    supportManager: "Support-Manager",
    activeNow: "Jetzt aktiv",
    justNow: "Gerade eben",
    threadLabel: "Nachrichtenthread",
    avatarYou: "ICH",
    avatarPm: "PM",
    inputPlaceholder: "Nachricht eingeben...",
    actions: {
      phone: "Anruf starten",
      video: "Videoanruf starten",
      more: "Weitere Optionen",
      attach: "Datei anhängen",
      send: "Nachricht senden",
    },
  },
  fr: {
    pageTitle: "Messages | ENS",
    title: "Messages",
    breadcrumbDashboard: "Tableau de bord",
    searchPlaceholder: "Rechercher des messages...",
    contactListLabel: "Conversations",
    supportManager: "Responsable support",
    activeNow: "Actif maintenant",
    justNow: "À l'instant",
    threadLabel: "Fil de messages",
    avatarYou: "MOI",
    avatarPm: "CP",
    inputPlaceholder: "Tapez votre message...",
    actions: {
      phone: "Démarrer un appel",
      video: "Démarrer un appel vidéo",
      more: "Plus d'options",
      attach: "Joindre un fichier",
      send: "Envoyer le message",
    },
  },
  es: {
    pageTitle: "Mensajes | ENS",
    title: "Mensajes",
    breadcrumbDashboard: "Panel",
    searchPlaceholder: "Buscar mensajes...",
    contactListLabel: "Conversaciones",
    supportManager: "Gestor de soporte",
    activeNow: "Activo ahora",
    justNow: "Ahora mismo",
    threadLabel: "Hilo de mensajes",
    avatarYou: "YO",
    avatarPm: "DP",
    inputPlaceholder: "Escribe tu mensaje...",
    actions: {
      phone: "Iniciar llamada",
      video: "Iniciar videollamada",
      more: "Más opciones",
      attach: "Adjuntar archivo",
      send: "Enviar mensaje",
    },
  },
  it: {
    pageTitle: "Messaggi | ENS",
    title: "Messaggi",
    breadcrumbDashboard: "Dashboard",
    searchPlaceholder: "Cerca messaggi...",
    contactListLabel: "Conversazioni",
    supportManager: "Responsabile supporto",
    activeNow: "Attivo ora",
    justNow: "Proprio ora",
    threadLabel: "Thread messaggi",
    avatarYou: "IO",
    avatarPm: "PM",
    inputPlaceholder: "Scrivi il tuo messaggio...",
    actions: {
      phone: "Avvia chiamata",
      video: "Avvia videochiamata",
      more: "Altre opzioni",
      attach: "Allega file",
      send: "Invia messaggio",
    },
  },
  pt: {
    pageTitle: "Mensagens | ENS",
    title: "Mensagens",
    breadcrumbDashboard: "Painel",
    searchPlaceholder: "Pesquisar mensagens...",
    contactListLabel: "Conversas",
    supportManager: "Gerente de suporte",
    activeNow: "Ativo agora",
    justNow: "Agora mesmo",
    threadLabel: "Conversa",
    avatarYou: "EU",
    avatarPm: "GP",
    inputPlaceholder: "Digite sua mensagem...",
    actions: {
      phone: "Iniciar chamada",
      video: "Iniciar videochamada",
      more: "Mais opções",
      attach: "Anexar arquivo",
      send: "Enviar mensagem",
    },
  },
  nl: {
    pageTitle: "Berichten | ENS",
    title: "Berichten",
    breadcrumbDashboard: "Dashboard",
    searchPlaceholder: "Berichten zoeken...",
    contactListLabel: "Gesprekken",
    supportManager: "Supportmanager",
    activeNow: "Nu actief",
    justNow: "Zojuist",
    threadLabel: "Berichtthread",
    avatarYou: "IK",
    avatarPm: "PM",
    inputPlaceholder: "Typ uw bericht...",
    actions: {
      phone: "Bellen starten",
      video: "Videogesprek starten",
      more: "Meer opties",
      attach: "Bestand bijvoegen",
      send: "Bericht verzenden",
    },
  },
  zh: {
    pageTitle: "消息 | ENS",
    title: "消息",
    breadcrumbDashboard: "仪表板",
    searchPlaceholder: "搜索消息...",
    contactListLabel: "对话",
    supportManager: "支持经理",
    activeNow: "当前在线",
    justNow: "刚刚",
    threadLabel: "消息记录",
    avatarYou: "我",
    avatarPm: "PM",
    inputPlaceholder: "输入您的消息...",
    actions: {
      phone: "开始通话",
      video: "开始视频通话",
      more: "更多选项",
      attach: "附加文件",
      send: "发送消息",
    },
  },
  ja: {
    pageTitle: "メッセージ | ENS",
    title: "メッセージ",
    breadcrumbDashboard: "ダッシュボード",
    searchPlaceholder: "メッセージを検索...",
    contactListLabel: "会話",
    supportManager: "サポートマネージャー",
    activeNow: "オンライン",
    justNow: "たった今",
    threadLabel: "メッセージスレッド",
    avatarYou: "私",
    avatarPm: "PM",
    inputPlaceholder: "メッセージを入力...",
    actions: {
      phone: "通話を開始",
      video: "ビデオ通話を開始",
      more: "その他のオプション",
      attach: "ファイルを添付",
      send: "メッセージを送信",
    },
  },
  ar: {
    pageTitle: "الرسائل | ENS",
    title: "الرسائل",
    breadcrumbDashboard: "لوحة التحكم",
    searchPlaceholder: "البحث في الرسائل...",
    contactListLabel: "المحادثات",
    supportManager: "مدير الدعم",
    activeNow: "متصل الآن",
    justNow: "الآن",
    threadLabel: "سلسلة الرسائل",
    avatarYou: "أنا",
    avatarPm: "م.م",
    inputPlaceholder: "اكتب رسالتك...",
    actions: {
      phone: "بدء مكالمة",
      video: "بدء مكالمة فيديو",
      more: "المزيد من الخيارات",
      attach: "إرفاق ملف",
      send: "إرسال الرسالة",
    },
  },
  tr: {
    pageTitle: "Mesajlar | ENS",
    title: "Mesajlar",
    breadcrumbDashboard: "Gösterge Paneli",
    searchPlaceholder: "Mesaj ara...",
    contactListLabel: "Konuşmalar",
    supportManager: "Destek Müdürü",
    activeNow: "Şu an aktif",
    justNow: "Az önce",
    threadLabel: "Mesaj dizisi",
    avatarYou: "BEN",
    avatarPm: "PM",
    inputPlaceholder: "Mesajınızı yazın...",
    actions: {
      phone: "Aramayı başlat",
      video: "Görüntülü aramayı başlat",
      more: "Daha fazla seçenek",
      attach: "Dosya ekle",
      send: "Mesaj gönder",
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
  if (!json.client.messages) json.client.messages = {};

  json.client.messages = deepMerge(json.client.messages, keys);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
