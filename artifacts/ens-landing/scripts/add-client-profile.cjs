/**
 * add-client-profile.cjs
 * Adds client.profile.* keys to all 11 locale files.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/i18n/locales");

const TRANSLATIONS = {
  en: {
    pageTitle: "Profile Settings | ENS",
    title: "Profile Settings",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProfile: "Profile",
    tab: {
      profile: "Personal Info",
      company: "Company",
      notifications: "Notifications",
      security: "Security",
    },
    personalInfo: {
      heading: "Personal Information",
      description: "Update your personal details and how we can reach you.",
    },
    company: {
      heading: "Company Information",
      description: "Manage your company details and exhibition profile.",
    },
    avatar: {
      heading: "Profile Picture",
      hint: "JPG, GIF or PNG. Max size 1.5MB.",
      uploadNew: "Upload New",
      remove: "Remove",
      changeBtn: "Change profile picture",
    },
    field: {
      name: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      companyName: "Company Name",
      industry: "Industry",
      website: "Website",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmPassword: "Confirm New Password",
    },
    btn: {
      saveChanges: "Save Changes",
      updateCompany: "Update Company Info",
      updatePassword: "Update Password",
    },
    notifications: {
      heading: "Notification Preferences",
      description: "Choose how you want to be notified about project updates.",
      enabled: "Enabled",
      disabled: "Disabled",
      milestones: {
        title: "Project Milestones",
        desc: "Get notified when a stage is completed.",
      },
      assignments: {
        title: "New Messages",
        desc: "Get notified when your PM sends a message.",
      },
      reports: {
        title: "Revision Requests",
        desc: "Get notified when a new design version is ready.",
      },
      system: {
        title: "Security Alerts",
        desc: "Get notified about account logins.",
      },
    },
    security: {
      heading: "Security",
      description: "Manage your password and account security settings.",
    },
    dangerZone: {
      heading: "Danger Zone",
      description:
        "Once you delete your account, there is no going back. Please be certain.",
      deleteBtn: "Delete Account",
    },
    validation: {
      nameMin: "Name must be at least 2 characters",
      emailInvalid: "Invalid email address",
      companyNameRequired: "Company name is required",
      websiteInvalid: "Invalid URL",
    },
    toast: {
      profileSaved: "Profile changes saved",
      profileError: "Profile could not be saved",
      profileLoadError: "Profile settings could not be loaded",
      companySaved: "Company information saved",
      avatarUpdated: "Profile picture updated",
      avatarRemoved: "Profile picture removed",
      avatarError: "Profile picture could not be saved",
      avatarRemoveError: "Profile picture could not be removed",
      avatarNotImage: "Choose an image file",
      avatarTooLarge: "Choose an image under 1.5 MB",
      imageReadError: "Image could not be read",
      notificationError: "Notification setting could not be saved",
      passwordUpdated: "Password update saved",
      passwordError: "Password could not be updated",
      passwordFillAll: "Fill all password fields",
      passwordMismatch: "New passwords do not match",
      passwordTooShort: "Password must be at least 8 characters",
      deleteQueued: "Account deletion request queued",
    },
  },
  de: {
    pageTitle: "Profileinstellungen | ENS",
    title: "Profileinstellungen",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProfile: "Profil",
    tab: {
      profile: "Persönliche Daten",
      company: "Unternehmen",
      notifications: "Benachrichtigungen",
      security: "Sicherheit",
    },
    personalInfo: {
      heading: "Persönliche Informationen",
      description: "Aktualisieren Sie Ihre persönlichen Daten und Kontaktinformationen.",
    },
    company: {
      heading: "Unternehmensinformationen",
      description: "Verwalten Sie Ihre Unternehmensdaten und Ihr Messeprofil.",
    },
    avatar: {
      heading: "Profilbild",
      hint: "JPG, GIF oder PNG. Maximale Größe 1,5 MB.",
      uploadNew: "Neu hochladen",
      remove: "Entfernen",
      changeBtn: "Profilbild ändern",
    },
    field: {
      name: "Vollständiger Name",
      email: "E-Mail-Adresse",
      phone: "Telefonnummer",
      companyName: "Unternehmensname",
      industry: "Branche",
      website: "Website",
      currentPassword: "Aktuelles Passwort",
      newPassword: "Neues Passwort",
      confirmPassword: "Neues Passwort bestätigen",
    },
    btn: {
      saveChanges: "Änderungen speichern",
      updateCompany: "Unternehmensdaten aktualisieren",
      updatePassword: "Passwort aktualisieren",
    },
    notifications: {
      heading: "Benachrichtigungseinstellungen",
      description: "Wählen Sie, wie Sie über Projektaktualisierungen informiert werden möchten.",
      enabled: "Aktiviert",
      disabled: "Deaktiviert",
      milestones: {
        title: "Projekt-Meilensteine",
        desc: "Benachrichtigung, wenn eine Phase abgeschlossen ist.",
      },
      assignments: {
        title: "Neue Nachrichten",
        desc: "Benachrichtigung, wenn Ihr PM eine Nachricht sendet.",
      },
      reports: {
        title: "Revisionsanfragen",
        desc: "Benachrichtigung, wenn eine neue Designversion bereit ist.",
      },
      system: {
        title: "Sicherheitswarnungen",
        desc: "Benachrichtigung bei Kontoanmeldungen.",
      },
    },
    security: {
      heading: "Sicherheit",
      description: "Verwalten Sie Ihr Passwort und Ihre Kontosicherheitseinstellungen.",
    },
    dangerZone: {
      heading: "Gefahrenzone",
      description: "Wenn Sie Ihr Konto löschen, gibt es kein Zurück. Bitte seien Sie sicher.",
      deleteBtn: "Konto löschen",
    },
    validation: {
      nameMin: "Name muss mindestens 2 Zeichen lang sein",
      emailInvalid: "Ungültige E-Mail-Adresse",
      companyNameRequired: "Unternehmensname ist erforderlich",
      websiteInvalid: "Ungültige URL",
    },
    toast: {
      profileSaved: "Profiländerungen gespeichert",
      profileError: "Profil konnte nicht gespeichert werden",
      profileLoadError: "Profileinstellungen konnten nicht geladen werden",
      companySaved: "Unternehmensdaten gespeichert",
      avatarUpdated: "Profilbild aktualisiert",
      avatarRemoved: "Profilbild entfernt",
      avatarError: "Profilbild konnte nicht gespeichert werden",
      avatarRemoveError: "Profilbild konnte nicht entfernt werden",
      avatarNotImage: "Wählen Sie eine Bilddatei",
      avatarTooLarge: "Wählen Sie ein Bild unter 1,5 MB",
      imageReadError: "Bild konnte nicht gelesen werden",
      notificationError: "Benachrichtigungseinstellung konnte nicht gespeichert werden",
      passwordUpdated: "Passwortaktualisierung gespeichert",
      passwordError: "Passwort konnte nicht aktualisiert werden",
      passwordFillAll: "Füllen Sie alle Passwortfelder aus",
      passwordMismatch: "Neue Passwörter stimmen nicht überein",
      passwordTooShort: "Passwort muss mindestens 8 Zeichen lang sein",
      deleteQueued: "Kontolöschungsanfrage gestellt",
    },
  },
  fr: {
    pageTitle: "Paramètres du profil | ENS",
    title: "Paramètres du profil",
    breadcrumbDashboard: "Tableau de bord",
    breadcrumbProfile: "Profil",
    tab: {
      profile: "Infos personnelles",
      company: "Entreprise",
      notifications: "Notifications",
      security: "Sécurité",
    },
    personalInfo: {
      heading: "Informations personnelles",
      description: "Mettez à jour vos coordonnées et comment vous contacter.",
    },
    company: {
      heading: "Informations sur l'entreprise",
      description: "Gérez les informations de votre entreprise et votre profil d'exposition.",
    },
    avatar: {
      heading: "Photo de profil",
      hint: "JPG, GIF ou PNG. Taille max 1,5 Mo.",
      uploadNew: "Téléverser une nouvelle photo",
      remove: "Supprimer",
      changeBtn: "Modifier la photo de profil",
    },
    field: {
      name: "Nom complet",
      email: "Adresse e-mail",
      phone: "Numéro de téléphone",
      companyName: "Nom de l'entreprise",
      industry: "Secteur d'activité",
      website: "Site web",
      currentPassword: "Mot de passe actuel",
      newPassword: "Nouveau mot de passe",
      confirmPassword: "Confirmer le nouveau mot de passe",
    },
    btn: {
      saveChanges: "Enregistrer les modifications",
      updateCompany: "Mettre à jour les infos entreprise",
      updatePassword: "Mettre à jour le mot de passe",
    },
    notifications: {
      heading: "Préférences de notification",
      description: "Choisissez comment vous souhaitez être informé des mises à jour du projet.",
      enabled: "Activé",
      disabled: "Désactivé",
      milestones: {
        title: "Jalons du projet",
        desc: "Soyez notifié lorsqu'une étape est complétée.",
      },
      assignments: {
        title: "Nouveaux messages",
        desc: "Soyez notifié lorsque votre chef de projet envoie un message.",
      },
      reports: {
        title: "Demandes de révision",
        desc: "Soyez notifié lorsqu'une nouvelle version du design est prête.",
      },
      system: {
        title: "Alertes de sécurité",
        desc: "Soyez notifié des connexions à votre compte.",
      },
    },
    security: {
      heading: "Sécurité",
      description: "Gérez votre mot de passe et vos paramètres de sécurité.",
    },
    dangerZone: {
      heading: "Zone dangereuse",
      description: "Une fois votre compte supprimé, il n'y a pas de retour en arrière. Soyez certain.",
      deleteBtn: "Supprimer le compte",
    },
    validation: {
      nameMin: "Le nom doit comporter au moins 2 caractères",
      emailInvalid: "Adresse e-mail invalide",
      companyNameRequired: "Le nom de l'entreprise est requis",
      websiteInvalid: "URL invalide",
    },
    toast: {
      profileSaved: "Modifications du profil enregistrées",
      profileError: "Impossible d'enregistrer le profil",
      profileLoadError: "Impossible de charger les paramètres du profil",
      companySaved: "Informations entreprise enregistrées",
      avatarUpdated: "Photo de profil mise à jour",
      avatarRemoved: "Photo de profil supprimée",
      avatarError: "Impossible d'enregistrer la photo de profil",
      avatarRemoveError: "Impossible de supprimer la photo de profil",
      avatarNotImage: "Choisissez un fichier image",
      avatarTooLarge: "Choisissez une image de moins de 1,5 Mo",
      imageReadError: "Impossible de lire l'image",
      notificationError: "Impossible d'enregistrer le paramètre de notification",
      passwordUpdated: "Mot de passe mis à jour",
      passwordError: "Impossible de mettre à jour le mot de passe",
      passwordFillAll: "Remplissez tous les champs du mot de passe",
      passwordMismatch: "Les nouveaux mots de passe ne correspondent pas",
      passwordTooShort: "Le mot de passe doit comporter au moins 8 caractères",
      deleteQueued: "Demande de suppression de compte enregistrée",
    },
  },
  es: {
    pageTitle: "Configuración de perfil | ENS",
    title: "Configuración de perfil",
    breadcrumbDashboard: "Panel",
    breadcrumbProfile: "Perfil",
    tab: {
      profile: "Información personal",
      company: "Empresa",
      notifications: "Notificaciones",
      security: "Seguridad",
    },
    personalInfo: {
      heading: "Información personal",
      description: "Actualice sus datos personales y cómo podemos contactarle.",
    },
    company: {
      heading: "Información de la empresa",
      description: "Gestione los datos de su empresa y perfil de exposición.",
    },
    avatar: {
      heading: "Foto de perfil",
      hint: "JPG, GIF o PNG. Tamaño máximo 1,5 MB.",
      uploadNew: "Subir nueva foto",
      remove: "Eliminar",
      changeBtn: "Cambiar foto de perfil",
    },
    field: {
      name: "Nombre completo",
      email: "Dirección de correo",
      phone: "Número de teléfono",
      companyName: "Nombre de la empresa",
      industry: "Sector",
      website: "Sitio web",
      currentPassword: "Contraseña actual",
      newPassword: "Nueva contraseña",
      confirmPassword: "Confirmar nueva contraseña",
    },
    btn: {
      saveChanges: "Guardar cambios",
      updateCompany: "Actualizar datos empresa",
      updatePassword: "Actualizar contraseña",
    },
    notifications: {
      heading: "Preferencias de notificación",
      description: "Elija cómo desea recibir notificaciones sobre las actualizaciones del proyecto.",
      enabled: "Activado",
      disabled: "Desactivado",
      milestones: {
        title: "Hitos del proyecto",
        desc: "Reciba una notificación cuando se complete una etapa.",
      },
      assignments: {
        title: "Nuevos mensajes",
        desc: "Reciba una notificación cuando su director envíe un mensaje.",
      },
      reports: {
        title: "Solicitudes de revisión",
        desc: "Reciba una notificación cuando haya una nueva versión del diseño.",
      },
      system: {
        title: "Alertas de seguridad",
        desc: "Reciba una notificación sobre los inicios de sesión en su cuenta.",
      },
    },
    security: {
      heading: "Seguridad",
      description: "Gestione su contraseña y la configuración de seguridad de su cuenta.",
    },
    dangerZone: {
      heading: "Zona de peligro",
      description: "Una vez que elimine su cuenta, no hay vuelta atrás. Por favor, esté seguro.",
      deleteBtn: "Eliminar cuenta",
    },
    validation: {
      nameMin: "El nombre debe tener al menos 2 caracteres",
      emailInvalid: "Dirección de correo inválida",
      companyNameRequired: "El nombre de la empresa es obligatorio",
      websiteInvalid: "URL inválida",
    },
    toast: {
      profileSaved: "Cambios de perfil guardados",
      profileError: "No se pudo guardar el perfil",
      profileLoadError: "No se pudieron cargar los ajustes del perfil",
      companySaved: "Información de empresa guardada",
      avatarUpdated: "Foto de perfil actualizada",
      avatarRemoved: "Foto de perfil eliminada",
      avatarError: "No se pudo guardar la foto de perfil",
      avatarRemoveError: "No se pudo eliminar la foto de perfil",
      avatarNotImage: "Elija un archivo de imagen",
      avatarTooLarge: "Elija una imagen de menos de 1,5 MB",
      imageReadError: "No se pudo leer la imagen",
      notificationError: "No se pudo guardar la configuración de notificación",
      passwordUpdated: "Contraseña actualizada",
      passwordError: "No se pudo actualizar la contraseña",
      passwordFillAll: "Complete todos los campos de contraseña",
      passwordMismatch: "Las nuevas contraseñas no coinciden",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
      deleteQueued: "Solicitud de eliminación de cuenta registrada",
    },
  },
  it: {
    pageTitle: "Impostazioni profilo | ENS",
    title: "Impostazioni profilo",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProfile: "Profilo",
    tab: {
      profile: "Info personali",
      company: "Azienda",
      notifications: "Notifiche",
      security: "Sicurezza",
    },
    personalInfo: {
      heading: "Informazioni personali",
      description: "Aggiorna i tuoi dati personali e come contattarti.",
    },
    company: {
      heading: "Informazioni aziendali",
      description: "Gestisci i dati della tua azienda e il profilo fieristico.",
    },
    avatar: {
      heading: "Foto del profilo",
      hint: "JPG, GIF o PNG. Dimensione massima 1,5 MB.",
      uploadNew: "Carica nuova",
      remove: "Rimuovi",
      changeBtn: "Cambia foto profilo",
    },
    field: {
      name: "Nome completo",
      email: "Indirizzo email",
      phone: "Numero di telefono",
      companyName: "Nome azienda",
      industry: "Settore",
      website: "Sito web",
      currentPassword: "Password attuale",
      newPassword: "Nuova password",
      confirmPassword: "Conferma nuova password",
    },
    btn: {
      saveChanges: "Salva modifiche",
      updateCompany: "Aggiorna dati aziendali",
      updatePassword: "Aggiorna password",
    },
    notifications: {
      heading: "Preferenze di notifica",
      description: "Scegli come vuoi essere notificato degli aggiornamenti del progetto.",
      enabled: "Attivato",
      disabled: "Disattivato",
      milestones: {
        title: "Milestone del progetto",
        desc: "Notifica quando una fase è completata.",
      },
      assignments: {
        title: "Nuovi messaggi",
        desc: "Notifica quando il tuo PM invia un messaggio.",
      },
      reports: {
        title: "Richieste di revisione",
        desc: "Notifica quando una nuova versione del design è pronta.",
      },
      system: {
        title: "Avvisi di sicurezza",
        desc: "Notifica sugli accessi all'account.",
      },
    },
    security: {
      heading: "Sicurezza",
      description: "Gestisci la password e le impostazioni di sicurezza dell'account.",
    },
    dangerZone: {
      heading: "Zona pericolosa",
      description: "Una volta eliminato l'account, non c'è ritorno. Assicurati di volerlo fare.",
      deleteBtn: "Elimina account",
    },
    validation: {
      nameMin: "Il nome deve contenere almeno 2 caratteri",
      emailInvalid: "Indirizzo email non valido",
      companyNameRequired: "Il nome dell'azienda è obbligatorio",
      websiteInvalid: "URL non valido",
    },
    toast: {
      profileSaved: "Modifiche al profilo salvate",
      profileError: "Impossibile salvare il profilo",
      profileLoadError: "Impossibile caricare le impostazioni del profilo",
      companySaved: "Dati aziendali salvati",
      avatarUpdated: "Foto del profilo aggiornata",
      avatarRemoved: "Foto del profilo rimossa",
      avatarError: "Impossibile salvare la foto del profilo",
      avatarRemoveError: "Impossibile rimuovere la foto del profilo",
      avatarNotImage: "Scegli un file immagine",
      avatarTooLarge: "Scegli un'immagine di meno di 1,5 MB",
      imageReadError: "Impossibile leggere l'immagine",
      notificationError: "Impossibile salvare l'impostazione di notifica",
      passwordUpdated: "Password aggiornata",
      passwordError: "Impossibile aggiornare la password",
      passwordFillAll: "Compila tutti i campi password",
      passwordMismatch: "Le nuove password non corrispondono",
      passwordTooShort: "La password deve contenere almeno 8 caratteri",
      deleteQueued: "Richiesta di eliminazione account inviata",
    },
  },
  pt: {
    pageTitle: "Configurações de perfil | ENS",
    title: "Configurações de perfil",
    breadcrumbDashboard: "Painel",
    breadcrumbProfile: "Perfil",
    tab: {
      profile: "Informações pessoais",
      company: "Empresa",
      notifications: "Notificações",
      security: "Segurança",
    },
    personalInfo: {
      heading: "Informações pessoais",
      description: "Atualize seus dados pessoais e como podemos entrar em contato.",
    },
    company: {
      heading: "Informações da empresa",
      description: "Gerencie os dados da sua empresa e perfil de exposição.",
    },
    avatar: {
      heading: "Foto de perfil",
      hint: "JPG, GIF ou PNG. Tamanho máximo 1,5 MB.",
      uploadNew: "Enviar nova foto",
      remove: "Remover",
      changeBtn: "Alterar foto de perfil",
    },
    field: {
      name: "Nome completo",
      email: "Endereço de e-mail",
      phone: "Número de telefone",
      companyName: "Nome da empresa",
      industry: "Setor",
      website: "Site",
      currentPassword: "Senha atual",
      newPassword: "Nova senha",
      confirmPassword: "Confirmar nova senha",
    },
    btn: {
      saveChanges: "Salvar alterações",
      updateCompany: "Atualizar dados da empresa",
      updatePassword: "Atualizar senha",
    },
    notifications: {
      heading: "Preferências de notificação",
      description: "Escolha como deseja ser notificado sobre as atualizações do projeto.",
      enabled: "Ativado",
      disabled: "Desativado",
      milestones: {
        title: "Marcos do projeto",
        desc: "Seja notificado quando uma etapa for concluída.",
      },
      assignments: {
        title: "Novas mensagens",
        desc: "Seja notificado quando seu gerente enviar uma mensagem.",
      },
      reports: {
        title: "Solicitações de revisão",
        desc: "Seja notificado quando uma nova versão do design estiver pronta.",
      },
      system: {
        title: "Alertas de segurança",
        desc: "Seja notificado sobre logins na sua conta.",
      },
    },
    security: {
      heading: "Segurança",
      description: "Gerencie sua senha e as configurações de segurança da conta.",
    },
    dangerZone: {
      heading: "Zona de perigo",
      description: "Depois de excluir sua conta, não há como voltar atrás. Tenha certeza.",
      deleteBtn: "Excluir conta",
    },
    validation: {
      nameMin: "O nome deve ter pelo menos 2 caracteres",
      emailInvalid: "Endereço de e-mail inválido",
      companyNameRequired: "O nome da empresa é obrigatório",
      websiteInvalid: "URL inválido",
    },
    toast: {
      profileSaved: "Alterações de perfil salvas",
      profileError: "Não foi possível salvar o perfil",
      profileLoadError: "Não foi possível carregar as configurações do perfil",
      companySaved: "Informações da empresa salvas",
      avatarUpdated: "Foto de perfil atualizada",
      avatarRemoved: "Foto de perfil removida",
      avatarError: "Não foi possível salvar a foto de perfil",
      avatarRemoveError: "Não foi possível remover a foto de perfil",
      avatarNotImage: "Escolha um arquivo de imagem",
      avatarTooLarge: "Escolha uma imagem com menos de 1,5 MB",
      imageReadError: "Não foi possível ler a imagem",
      notificationError: "Não foi possível salvar a configuração de notificação",
      passwordUpdated: "Senha atualizada",
      passwordError: "Não foi possível atualizar a senha",
      passwordFillAll: "Preencha todos os campos de senha",
      passwordMismatch: "As novas senhas não coincidem",
      passwordTooShort: "A senha deve ter pelo menos 8 caracteres",
      deleteQueued: "Solicitação de exclusão de conta registrada",
    },
  },
  nl: {
    pageTitle: "Profielinstellingen | ENS",
    title: "Profielinstellingen",
    breadcrumbDashboard: "Dashboard",
    breadcrumbProfile: "Profiel",
    tab: {
      profile: "Persoonlijke info",
      company: "Bedrijf",
      notifications: "Meldingen",
      security: "Beveiliging",
    },
    personalInfo: {
      heading: "Persoonlijke informatie",
      description: "Werk uw persoonlijke gegevens en contactinformatie bij.",
    },
    company: {
      heading: "Bedrijfsinformatie",
      description: "Beheer uw bedrijfsgegevens en beursprofiel.",
    },
    avatar: {
      heading: "Profielfoto",
      hint: "JPG, GIF of PNG. Maximale grootte 1,5 MB.",
      uploadNew: "Nieuwe foto uploaden",
      remove: "Verwijderen",
      changeBtn: "Profielfoto wijzigen",
    },
    field: {
      name: "Volledige naam",
      email: "E-mailadres",
      phone: "Telefoonnummer",
      companyName: "Bedrijfsnaam",
      industry: "Sector",
      website: "Website",
      currentPassword: "Huidig wachtwoord",
      newPassword: "Nieuw wachtwoord",
      confirmPassword: "Nieuw wachtwoord bevestigen",
    },
    btn: {
      saveChanges: "Wijzigingen opslaan",
      updateCompany: "Bedrijfsinfo bijwerken",
      updatePassword: "Wachtwoord bijwerken",
    },
    notifications: {
      heading: "Meldingsvoorkeuren",
      description: "Kies hoe u op de hoogte wilt worden gesteld van projectupdates.",
      enabled: "Ingeschakeld",
      disabled: "Uitgeschakeld",
      milestones: {
        title: "Projectmijlpalen",
        desc: "Ontvang een melding wanneer een fase is voltooid.",
      },
      assignments: {
        title: "Nieuwe berichten",
        desc: "Ontvang een melding wanneer uw PM een bericht stuurt.",
      },
      reports: {
        title: "Revisieaanvragen",
        desc: "Ontvang een melding wanneer een nieuwe designversie klaar is.",
      },
      system: {
        title: "Beveiligingswaarschuwingen",
        desc: "Ontvang een melding over accountaanmeldingen.",
      },
    },
    security: {
      heading: "Beveiliging",
      description: "Beheer uw wachtwoord en accountbeveiligingsinstellingen.",
    },
    dangerZone: {
      heading: "Gevaarlijke zone",
      description: "Zodra u uw account verwijdert, is er geen weg terug. Wees zeker.",
      deleteBtn: "Account verwijderen",
    },
    validation: {
      nameMin: "Naam moet minimaal 2 tekens bevatten",
      emailInvalid: "Ongeldig e-mailadres",
      companyNameRequired: "Bedrijfsnaam is vereist",
      websiteInvalid: "Ongeldige URL",
    },
    toast: {
      profileSaved: "Profielwijzigingen opgeslagen",
      profileError: "Profiel kon niet worden opgeslagen",
      profileLoadError: "Profielinstellingen konden niet worden geladen",
      companySaved: "Bedrijfsinformatie opgeslagen",
      avatarUpdated: "Profielfoto bijgewerkt",
      avatarRemoved: "Profielfoto verwijderd",
      avatarError: "Profielfoto kon niet worden opgeslagen",
      avatarRemoveError: "Profielfoto kon niet worden verwijderd",
      avatarNotImage: "Kies een afbeeldingsbestand",
      avatarTooLarge: "Kies een afbeelding kleiner dan 1,5 MB",
      imageReadError: "Afbeelding kon niet worden gelezen",
      notificationError: "Meldingsinstelling kon niet worden opgeslagen",
      passwordUpdated: "Wachtwoord bijgewerkt",
      passwordError: "Wachtwoord kon niet worden bijgewerkt",
      passwordFillAll: "Vul alle wachtwoordvelden in",
      passwordMismatch: "Nieuwe wachtwoorden komen niet overeen",
      passwordTooShort: "Wachtwoord moet minimaal 8 tekens bevatten",
      deleteQueued: "Accountverwijderingsverzoek ingediend",
    },
  },
  zh: {
    pageTitle: "个人资料设置 | ENS",
    title: "个人资料设置",
    breadcrumbDashboard: "仪表板",
    breadcrumbProfile: "个人资料",
    tab: {
      profile: "个人信息",
      company: "公司",
      notifications: "通知",
      security: "安全",
    },
    personalInfo: {
      heading: "个人信息",
      description: "更新您的个人详情和联系方式。",
    },
    company: {
      heading: "公司信息",
      description: "管理您的公司详情和展览资料。",
    },
    avatar: {
      heading: "头像",
      hint: "JPG、GIF 或 PNG。最大尺寸 1.5MB。",
      uploadNew: "上传新头像",
      remove: "删除",
      changeBtn: "更改头像",
    },
    field: {
      name: "全名",
      email: "电子邮件地址",
      phone: "电话号码",
      companyName: "公司名称",
      industry: "行业",
      website: "网站",
      currentPassword: "当前密码",
      newPassword: "新密码",
      confirmPassword: "确认新密码",
    },
    btn: {
      saveChanges: "保存更改",
      updateCompany: "更新公司信息",
      updatePassword: "更新密码",
    },
    notifications: {
      heading: "通知偏好",
      description: "选择您希望如何接收项目更新通知。",
      enabled: "已启用",
      disabled: "已禁用",
      milestones: {
        title: "项目里程碑",
        desc: "阶段完成时收到通知。",
      },
      assignments: {
        title: "新消息",
        desc: "项目经理发送消息时收到通知。",
      },
      reports: {
        title: "修订请求",
        desc: "新设计版本准备好时收到通知。",
      },
      system: {
        title: "安全提醒",
        desc: "账户登录时收到通知。",
      },
    },
    security: {
      heading: "安全",
      description: "管理您的密码和账户安全设置。",
    },
    dangerZone: {
      heading: "危险区域",
      description: "一旦您删除账户，将无法恢复。请确认。",
      deleteBtn: "删除账户",
    },
    validation: {
      nameMin: "姓名至少需要2个字符",
      emailInvalid: "无效的电子邮件地址",
      companyNameRequired: "公司名称为必填项",
      websiteInvalid: "无效的URL",
    },
    toast: {
      profileSaved: "个人资料更改已保存",
      profileError: "无法保存个人资料",
      profileLoadError: "无法加载个人资料设置",
      companySaved: "公司信息已保存",
      avatarUpdated: "头像已更新",
      avatarRemoved: "头像已删除",
      avatarError: "无法保存头像",
      avatarRemoveError: "无法删除头像",
      avatarNotImage: "请选择图片文件",
      avatarTooLarge: "请选择小于1.5MB的图片",
      imageReadError: "无法读取图片",
      notificationError: "无法保存通知设置",
      passwordUpdated: "密码已更新",
      passwordError: "无法更新密码",
      passwordFillAll: "请填写所有密码字段",
      passwordMismatch: "新密码不匹配",
      passwordTooShort: "密码至少需要8个字符",
      deleteQueued: "账户删除请求已提交",
    },
  },
  ja: {
    pageTitle: "プロフィール設定 | ENS",
    title: "プロフィール設定",
    breadcrumbDashboard: "ダッシュボード",
    breadcrumbProfile: "プロフィール",
    tab: {
      profile: "個人情報",
      company: "会社",
      notifications: "通知",
      security: "セキュリティ",
    },
    personalInfo: {
      heading: "個人情報",
      description: "個人情報と連絡先を更新してください。",
    },
    company: {
      heading: "会社情報",
      description: "会社の詳細と展示会プロフィールを管理してください。",
    },
    avatar: {
      heading: "プロフィール写真",
      hint: "JPG、GIFまたはPNG。最大サイズ1.5MB。",
      uploadNew: "新しい写真をアップロード",
      remove: "削除",
      changeBtn: "プロフィール写真を変更",
    },
    field: {
      name: "氏名",
      email: "メールアドレス",
      phone: "電話番号",
      companyName: "会社名",
      industry: "業種",
      website: "ウェブサイト",
      currentPassword: "現在のパスワード",
      newPassword: "新しいパスワード",
      confirmPassword: "新しいパスワードを確認",
    },
    btn: {
      saveChanges: "変更を保存",
      updateCompany: "会社情報を更新",
      updatePassword: "パスワードを更新",
    },
    notifications: {
      heading: "通知設定",
      description: "プロジェクトの更新をどのように通知するか選択してください。",
      enabled: "有効",
      disabled: "無効",
      milestones: {
        title: "プロジェクトマイルストーン",
        desc: "フェーズが完了したときに通知を受け取ります。",
      },
      assignments: {
        title: "新しいメッセージ",
        desc: "PMがメッセージを送ったときに通知を受け取ります。",
      },
      reports: {
        title: "修正リクエスト",
        desc: "新しいデザインバージョンが準備できたときに通知を受け取ります。",
      },
      system: {
        title: "セキュリティアラート",
        desc: "アカウントへのログインについて通知を受け取ります。",
      },
    },
    security: {
      heading: "セキュリティ",
      description: "パスワードとアカウントのセキュリティ設定を管理してください。",
    },
    dangerZone: {
      heading: "危険ゾーン",
      description: "アカウントを削除すると、元に戻せません。よくご確認ください。",
      deleteBtn: "アカウントを削除",
    },
    validation: {
      nameMin: "名前は2文字以上である必要があります",
      emailInvalid: "無効なメールアドレス",
      companyNameRequired: "会社名は必須です",
      websiteInvalid: "無効なURL",
    },
    toast: {
      profileSaved: "プロフィールの変更を保存しました",
      profileError: "プロフィールを保存できませんでした",
      profileLoadError: "プロフィール設定を読み込めませんでした",
      companySaved: "会社情報を保存しました",
      avatarUpdated: "プロフィール写真を更新しました",
      avatarRemoved: "プロフィール写真を削除しました",
      avatarError: "プロフィール写真を保存できませんでした",
      avatarRemoveError: "プロフィール写真を削除できませんでした",
      avatarNotImage: "画像ファイルを選択してください",
      avatarTooLarge: "1.5MB未満の画像を選択してください",
      imageReadError: "画像を読み込めませんでした",
      notificationError: "通知設定を保存できませんでした",
      passwordUpdated: "パスワードを更新しました",
      passwordError: "パスワードを更新できませんでした",
      passwordFillAll: "すべてのパスワードフィールドを入力してください",
      passwordMismatch: "新しいパスワードが一致しません",
      passwordTooShort: "パスワードは8文字以上である必要があります",
      deleteQueued: "アカウント削除リクエストを受け付けました",
    },
  },
  ar: {
    pageTitle: "إعدادات الملف الشخصي | ENS",
    title: "إعدادات الملف الشخصي",
    breadcrumbDashboard: "لوحة التحكم",
    breadcrumbProfile: "الملف الشخصي",
    tab: {
      profile: "المعلومات الشخصية",
      company: "الشركة",
      notifications: "الإشعارات",
      security: "الأمان",
    },
    personalInfo: {
      heading: "المعلومات الشخصية",
      description: "قم بتحديث بياناتك الشخصية وطرق التواصل معك.",
    },
    company: {
      heading: "معلومات الشركة",
      description: "إدارة بيانات شركتك وملف المعرض.",
    },
    avatar: {
      heading: "صورة الملف الشخصي",
      hint: "JPG أو GIF أو PNG. الحد الأقصى للحجم 1.5 ميجابايت.",
      uploadNew: "رفع صورة جديدة",
      remove: "إزالة",
      changeBtn: "تغيير صورة الملف الشخصي",
    },
    field: {
      name: "الاسم الكامل",
      email: "عنوان البريد الإلكتروني",
      phone: "رقم الهاتف",
      companyName: "اسم الشركة",
      industry: "القطاع",
      website: "الموقع الإلكتروني",
      currentPassword: "كلمة المرور الحالية",
      newPassword: "كلمة المرور الجديدة",
      confirmPassword: "تأكيد كلمة المرور الجديدة",
    },
    btn: {
      saveChanges: "حفظ التغييرات",
      updateCompany: "تحديث معلومات الشركة",
      updatePassword: "تحديث كلمة المرور",
    },
    notifications: {
      heading: "تفضيلات الإشعارات",
      description: "اختر كيفية تلقي إشعارات تحديثات المشروع.",
      enabled: "مفعّل",
      disabled: "معطّل",
      milestones: {
        title: "معالم المشروع",
        desc: "تلقّ إشعاراً عند اكتمال مرحلة.",
      },
      assignments: {
        title: "رسائل جديدة",
        desc: "تلقّ إشعاراً عند إرسال مدير المشروع رسالة.",
      },
      reports: {
        title: "طلبات المراجعة",
        desc: "تلقّ إشعاراً عند توفر إصدار تصميم جديد.",
      },
      system: {
        title: "تنبيهات الأمان",
        desc: "تلقّ إشعاراً عند تسجيل الدخول إلى الحساب.",
      },
    },
    security: {
      heading: "الأمان",
      description: "إدارة كلمة المرور وإعدادات أمان الحساب.",
    },
    dangerZone: {
      heading: "منطقة الخطر",
      description: "بمجرد حذف حسابك، لا يمكن التراجع. يرجى التأكد.",
      deleteBtn: "حذف الحساب",
    },
    validation: {
      nameMin: "يجب أن يحتوي الاسم على حرفين على الأقل",
      emailInvalid: "عنوان بريد إلكتروني غير صالح",
      companyNameRequired: "اسم الشركة مطلوب",
      websiteInvalid: "عنوان URL غير صالح",
    },
    toast: {
      profileSaved: "تم حفظ تغييرات الملف الشخصي",
      profileError: "تعذر حفظ الملف الشخصي",
      profileLoadError: "تعذر تحميل إعدادات الملف الشخصي",
      companySaved: "تم حفظ معلومات الشركة",
      avatarUpdated: "تم تحديث صورة الملف الشخصي",
      avatarRemoved: "تمت إزالة صورة الملف الشخصي",
      avatarError: "تعذر حفظ صورة الملف الشخصي",
      avatarRemoveError: "تعذر إزالة صورة الملف الشخصي",
      avatarNotImage: "اختر ملف صورة",
      avatarTooLarge: "اختر صورة أقل من 1.5 ميجابايت",
      imageReadError: "تعذر قراءة الصورة",
      notificationError: "تعذر حفظ إعداد الإشعار",
      passwordUpdated: "تم تحديث كلمة المرور",
      passwordError: "تعذر تحديث كلمة المرور",
      passwordFillAll: "أكمل جميع حقول كلمة المرور",
      passwordMismatch: "كلمتا المرور الجديدتان غير متطابقتين",
      passwordTooShort: "يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل",
      deleteQueued: "تم تسجيل طلب حذف الحساب",
    },
  },
  tr: {
    pageTitle: "Profil Ayarları | ENS",
    title: "Profil Ayarları",
    breadcrumbDashboard: "Gösterge Paneli",
    breadcrumbProfile: "Profil",
    tab: {
      profile: "Kişisel Bilgiler",
      company: "Şirket",
      notifications: "Bildirimler",
      security: "Güvenlik",
    },
    personalInfo: {
      heading: "Kişisel Bilgiler",
      description: "Kişisel bilgilerinizi ve iletişim bilgilerinizi güncelleyin.",
    },
    company: {
      heading: "Şirket Bilgileri",
      description: "Şirket bilgilerinizi ve fuar profilinizi yönetin.",
    },
    avatar: {
      heading: "Profil Fotoğrafı",
      hint: "JPG, GIF veya PNG. Maksimum boyut 1,5 MB.",
      uploadNew: "Yeni Fotoğraf Yükle",
      remove: "Kaldır",
      changeBtn: "Profil fotoğrafını değiştir",
    },
    field: {
      name: "Tam Ad",
      email: "E-posta Adresi",
      phone: "Telefon Numarası",
      companyName: "Şirket Adı",
      industry: "Sektör",
      website: "Web Sitesi",
      currentPassword: "Mevcut Şifre",
      newPassword: "Yeni Şifre",
      confirmPassword: "Yeni Şifreyi Onayla",
    },
    btn: {
      saveChanges: "Değişiklikleri Kaydet",
      updateCompany: "Şirket Bilgilerini Güncelle",
      updatePassword: "Şifreyi Güncelle",
    },
    notifications: {
      heading: "Bildirim Tercihleri",
      description: "Proje güncellemeleri hakkında nasıl bildirim almak istediğinizi seçin.",
      enabled: "Etkin",
      disabled: "Devre dışı",
      milestones: {
        title: "Proje Kilometre Taşları",
        desc: "Bir aşama tamamlandığında bildirim alın.",
      },
      assignments: {
        title: "Yeni Mesajlar",
        desc: "PM'iniz mesaj gönderdiğinde bildirim alın.",
      },
      reports: {
        title: "Revizyon İstekleri",
        desc: "Yeni bir tasarım versiyonu hazır olduğunda bildirim alın.",
      },
      system: {
        title: "Güvenlik Uyarıları",
        desc: "Hesap girişleri hakkında bildirim alın.",
      },
    },
    security: {
      heading: "Güvenlik",
      description: "Şifrenizi ve hesap güvenliği ayarlarınızı yönetin.",
    },
    dangerZone: {
      heading: "Tehlikeli Bölge",
      description: "Hesabınızı sildikten sonra geri dönüş yoktur. Lütfen emin olun.",
      deleteBtn: "Hesabı Sil",
    },
    validation: {
      nameMin: "Ad en az 2 karakter olmalıdır",
      emailInvalid: "Geçersiz e-posta adresi",
      companyNameRequired: "Şirket adı gereklidir",
      websiteInvalid: "Geçersiz URL",
    },
    toast: {
      profileSaved: "Profil değişiklikleri kaydedildi",
      profileError: "Profil kaydedilemedi",
      profileLoadError: "Profil ayarları yüklenemedi",
      companySaved: "Şirket bilgileri kaydedildi",
      avatarUpdated: "Profil fotoğrafı güncellendi",
      avatarRemoved: "Profil fotoğrafı kaldırıldı",
      avatarError: "Profil fotoğrafı kaydedilemedi",
      avatarRemoveError: "Profil fotoğrafı kaldırılamadı",
      avatarNotImage: "Bir resim dosyası seçin",
      avatarTooLarge: "1,5 MB'tan küçük bir resim seçin",
      imageReadError: "Resim okunamadı",
      notificationError: "Bildirim ayarı kaydedilemedi",
      passwordUpdated: "Şifre güncellendi",
      passwordError: "Şifre güncellenemedi",
      passwordFillAll: "Tüm şifre alanlarını doldurun",
      passwordMismatch: "Yeni şifreler eşleşmiyor",
      passwordTooShort: "Şifre en az 8 karakter olmalıdır",
      deleteQueued: "Hesap silme isteği alındı",
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
  if (!json.client.profile) json.client.profile = {};

  json.client.profile = deepMerge(json.client.profile, keys);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  OK    ${lang}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
