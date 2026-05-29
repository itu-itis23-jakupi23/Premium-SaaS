const fs = require("fs"), path = require("path");
const base = path.join(__dirname, "../src/i18n/locales");

const en = JSON.parse(fs.readFileSync(path.join(base, "en.json"), "utf8"));
en.notFound = {
  title: "404 – Page Not Found",
  badge: "Page not found",
  heading: "This booth doesn't exist",
  body: "The page you're looking for has either moved, been removed, or never existed. Let's get you back to the platform.",
  backHome: "Back to Home",
  goBack: "Go Back",
  links: { home: "Home", staffPortal: "Staff Portal", login: "Log In", signUp: "Sign Up" }
};
fs.writeFileSync(path.join(base, "en.json"), JSON.stringify(en, null, 2), "utf8");
console.log("en OK");

const t = {
  de: { title:"404 – Seite nicht gefunden", badge:"Seite nicht gefunden", heading:"Diese Seite existiert nicht", body:"Die gesuchte Seite wurde möglicherweise verschoben, entfernt oder hat nie existiert. Kehren Sie zur Plattform zurück.", backHome:"Zur Startseite", goBack:"Zurück", links:{home:"Startseite",staffPortal:"Mitarbeiterportal",login:"Anmelden",signUp:"Registrieren"} },
  fr: { title:"404 – Page introuvable", badge:"Page introuvable", heading:"Ce stand n'existe pas", body:"La page que vous recherchez a peut-être été déplacée, supprimée ou n'a jamais existé. Retournons sur la plateforme.", backHome:"Retour à l'accueil", goBack:"Retour", links:{home:"Accueil",staffPortal:"Portail équipe",login:"Connexion",signUp:"Inscription"} },
  es: { title:"404 – Página no encontrada", badge:"Página no encontrada", heading:"Este stand no existe", body:"La página que buscas ha sido movida, eliminada o nunca existió. Volvamos a la plataforma.", backHome:"Volver al inicio", goBack:"Regresar", links:{home:"Inicio",staffPortal:"Portal de equipo",login:"Iniciar sesión",signUp:"Registrarse"} },
  it: { title:"404 – Pagina non trovata", badge:"Pagina non trovata", heading:"Questo stand non esiste", body:"La pagina che stai cercando è stata spostata, rimossa o non è mai esistita. Torniamo alla piattaforma.", backHome:"Torna alla home", goBack:"Indietro", links:{home:"Home",staffPortal:"Portale staff",login:"Accedi",signUp:"Registrati"} },
  pt: { title:"404 – Página não encontrada", badge:"Página não encontrada", heading:"Este estande não existe", body:"A página que você procura foi movida, removida ou nunca existiu. Vamos voltar para a plataforma.", backHome:"Voltar ao início", goBack:"Voltar", links:{home:"Início",staffPortal:"Portal da equipe",login:"Entrar",signUp:"Cadastrar"} },
  nl: { title:"404 – Pagina niet gevonden", badge:"Pagina niet gevonden", heading:"Deze stand bestaat niet", body:"De pagina die u zoekt is mogelijk verplaatst, verwijderd of heeft nooit bestaan. Laten we u terugbrengen naar het platform.", backHome:"Terug naar home", goBack:"Ga terug", links:{home:"Home",staffPortal:"Medewerkersportaal",login:"Inloggen",signUp:"Registreren"} },
  zh: { title:"404 – 页面未找到", badge:"页面未找到", heading:"该展位不存在", body:"您要找的页面可能已移动、删除或从未存在过。让我们带您回到平台。", backHome:"返回首页", goBack:"返回", links:{home:"首页",staffPortal:"员工门户",login:"登录",signUp:"注册"} },
  ja: { title:"404 – ページが見つかりません", badge:"ページが見つかりません", heading:"このブースは存在しません", body:"お探しのページは移動、削除されたか、存在しなかった可能性があります。プラットフォームに戻りましょう。", backHome:"ホームに戻る", goBack:"戻る", links:{home:"ホーム",staffPortal:"スタッフポータル",login:"ログイン",signUp:"サインアップ"} },
  ar: { title:"404 – الصفحة غير موجودة", badge:"الصفحة غير موجودة", heading:"هذا الجناح غير موجود", body:"الصفحة التي تبحث عنها ربما انتقلت أو أُزيلت أو لم تكن موجودة أصلاً. دعنا نعود إلى المنصة.", backHome:"العودة إلى الرئيسية", goBack:"رجوع", links:{home:"الرئيسية",staffPortal:"بوابة الموظفين",login:"تسجيل الدخول",signUp:"إنشاء حساب"} },
  tr: { title:"404 – Sayfa Bulunamadı", badge:"Sayfa bulunamadı", heading:"Bu stand mevcut değil", body:"Aradığınız sayfa taşınmış, kaldırılmış ya da hiç var olmamış olabilir. Sizi platforma geri götürelim.", backHome:"Ana Sayfaya Dön", goBack:"Geri Git", links:{home:"Ana Sayfa",staffPortal:"Personel Portalı",login:"Giriş Yap",signUp:"Kaydol"} }
};

for (const [lang, vals] of Object.entries(t)) {
  const filePath = path.join(base, lang + ".json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.notFound = vals;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(lang + " OK");
}
