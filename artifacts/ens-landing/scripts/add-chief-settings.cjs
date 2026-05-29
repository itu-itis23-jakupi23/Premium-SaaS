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
    chief: {
      settings: {
        pageTitle: "Settings | ENS",
        title: "Settings",
        breadcrumb: "Settings",
        export: "Export",
        reset: "Reset",
        tabs: { profile: "Profile", notifications: "Notifications", security: "Security", appearance: "Appearance" },
        profile: {
          title: "Profile Information",
          description: "Update your personal and professional details",
          unsaved: "Unsaved",
          changeAvatar: "Change Avatar",
          uploadPicture: "Upload Picture",
          fullName: "Full Name",
          emailLabel: "Email Address",
          roleLabel: "Role",
          phone: "Phone Number",
          phonePlaceholder: "+1 (555) 000-0000",
          revert: "Revert",
          saveChanges: "Save Changes",
          avatarDialog: { title: "Change Avatar", description: "Choose a local avatar style for this account profile.", cancel: "Cancel", apply: "Apply Avatar" },
          avatarTones: { primary: "Primary", blue: "Blue", green: "Green", amber: "Amber" },
          validation: { nameRequired: "Name is required", emailInvalid: "Enter a valid email", phoneInvalid: "Enter a valid phone number" },
          toast: { saved: "Profile changes saved", reverted: "Profile changes reverted", avatarUpdated: "Avatar updated", pictureSelected: "Profile picture selected", loadError: "Settings could not be loaded", saveError: "Profile could not be saved", avatarError: "Avatar could not be saved", imageTypeError: "Choose an image file", imageSizeError: "Choose an image under 1.5 MB" }
        },
        notifications: {
          title: "Email Notifications",
          description: "Configure which updates you want to receive via email",
          enabledCount: "{{count}}/4 enabled",
          items: {
            assignments: { title: "New Project Assignments", desc: "Get notified when a new project is created and assigned." },
            milestones: { title: "Project Milestones", desc: "Alerts for completed stages or approval requests." },
            reports: { title: "Manager Activity Reports", desc: "Weekly summary of manager performance and workload." },
            system: { title: "System Alerts", desc: "Critical updates and security notifications." }
          },
          enableAll: "Enable All",
          criticalOnly: "Critical Only",
          savePreferences: "Save Preferences",
          toast: { saved: "Notification preferences saved", allEnabled: "All notifications enabled", criticalOnly: "Only system alerts remain enabled", saveError: "Notifications could not be saved" }
        },
        security: {
          title: "Security Settings",
          description: "Manage your password and account security",
          currentPassword: "Current Password",
          newPassword: "New Password",
          confirmNewPassword: "Confirm New Password",
          updatePassword: "Update Password",
          strengthPrefix: "Strength:",
          passwordStrength: { empty: "Empty", weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" },
          twoFactor: { title: "Two-Factor Authentication", description: "Use a verification code for sensitive account actions.", enabled: "Enabled", disabled: "Disabled", newCodes: "New Recovery Codes", disable: "Disable 2FA", enable: "Enable 2FA" },
          twoFactorDialog: { title: "Enable Two-Factor Authentication", description: "Open your authenticator app, scan the QR code, then enter the 6-digit verification code below.", qrPlaceholder: "QR code would appear here in production", showCode: "Show demo verification code", hideCode: "Hide demo code", demoLabel: "Demo code", codeLabel: "Verification Code", codePlaceholder: "Enter 6-digit code", cancel: "Cancel", verify: "Verify & Enable" },
          recoveryCodes: { title: "Recovery Codes", copyAll: "Copy All", description: "Save these codes somewhere safe. Each code can only be used once." },
          sessions: { title: "Active Sessions", description: "Review devices currently signed into this account.", signOutOthers: "Sign Out Others", signOut: "Sign Out", current: "current" },
          toast: {
            passwordSaved: "Password update saved",
            twoFactorEnabled: "Two-factor authentication enabled",
            twoFactorDisabled: "Two-factor authentication disabled",
            codesRegenerated: "Recovery codes regenerated",
            codesCopied: "Recovery codes copied to clipboard",
            sessionSignedOut: "{{device}} signed out",
            sessionsSignedOut_one: "{{count}} session signed out",
            sessionsSignedOut_other: "{{count}} sessions signed out",
            passwordAllFields: "Fill all password fields",
            passwordMismatch: "New passwords do not match",
            passwordWeak: "Use a stronger password",
            passwordSame: "New password must be different",
            passwordError: "Password could not be updated",
            twoFactorWrongCode: "Incorrect verification code — check your authenticator app",
            twoFactorSetupError: "Two-factor setup could not be saved",
            twoFactorDisableError: "Two-factor status could not be saved",
            twoFactorRequired: "Enable 2FA before generating recovery codes",
            codesError: "Recovery codes could not be saved",
            clipboardError: "Could not copy to clipboard — please copy the codes manually",
            sessionError: "Session could not be signed out",
            sessionsError: "Sessions could not be signed out",
            noOtherSessions: "No other sessions to sign out"
          }
        },
        appearance: {
          title: "Display Settings",
          description: "Customize the look and feel of your dashboard",
          themeMode: "Theme Mode",
          themeModeDesc: "Switch between light, dark, and system themes.",
          light: "Light",
          dark: "Dark",
          system: "System",
          compactView: "Compact View",
          compactViewDesc: "Reduce spacing in tables and lists.",
          language: "Language",
          languageDesc: "Select your preferred display language.",
          resetDisplay: "Reset Display",
          saveDisplay: "Save Display Settings",
          toast: { saved: "Display settings saved", reset: "Display settings reset", saveError: "Display settings could not be saved" }
        },
        resetDialog: { title: "Reset Settings", description: "This restores local account settings to the default demo values.", cancel: "Cancel", confirm: "Reset Settings" },
        toast: { exported: "Settings exported", restored: "Settings restored to defaults", restoredLocal: "Local settings restored to defaults" }
      }
    }
  },
  de: {
    chief: {
      settings: {
        pageTitle: "Einstellungen | ENS",
        title: "Einstellungen",
        breadcrumb: "Einstellungen",
        export: "Exportieren",
        reset: "Zurücksetzen",
        tabs: { profile: "Profil", notifications: "Benachrichtigungen", security: "Sicherheit", appearance: "Darstellung" },
        profile: {
          title: "Profilinformationen",
          description: "Persönliche und berufliche Daten aktualisieren",
          unsaved: "Ungespeichert",
          changeAvatar: "Avatar ändern",
          uploadPicture: "Bild hochladen",
          fullName: "Vollständiger Name",
          emailLabel: "E-Mail-Adresse",
          roleLabel: "Rolle",
          phone: "Telefonnummer",
          phonePlaceholder: "+49 (555) 000-0000",
          revert: "Verwerfen",
          saveChanges: "Änderungen speichern",
          avatarDialog: { title: "Avatar ändern", description: "Lokalen Avatar-Stil für dieses Profil auswählen.", cancel: "Abbrechen", apply: "Avatar übernehmen" },
          avatarTones: { primary: "Primär", blue: "Blau", green: "Grün", amber: "Bernstein" },
          validation: { nameRequired: "Name ist erforderlich", emailInvalid: "Gültige E-Mail-Adresse eingeben", phoneInvalid: "Gültige Telefonnummer eingeben" },
          toast: { saved: "Profiländerungen gespeichert", reverted: "Profiländerungen verworfen", avatarUpdated: "Avatar aktualisiert", pictureSelected: "Profilbild ausgewählt", loadError: "Einstellungen konnten nicht geladen werden", saveError: "Profil konnte nicht gespeichert werden", avatarError: "Avatar konnte nicht gespeichert werden", imageTypeError: "Bilddatei auswählen", imageSizeError: "Bild unter 1,5 MB auswählen" }
        },
        notifications: {
          title: "E-Mail-Benachrichtigungen",
          description: "Gewünschte Updates per E-Mail konfigurieren",
          enabledCount: "{{count}}/4 aktiviert",
          items: {
            assignments: { title: "Neue Projektzuweisungen", desc: "Benachrichtigung bei neuen Projektzuweisungen." },
            milestones: { title: "Projektmeilensteine", desc: "Benachrichtigungen für abgeschlossene Phasen oder Genehmigungsanfragen." },
            reports: { title: "Manager-Aktivitätsberichte", desc: "Wöchentliche Zusammenfassung der Manager-Leistung." },
            system: { title: "Systembenachrichtigungen", desc: "Wichtige Updates und Sicherheitshinweise." }
          },
          enableAll: "Alle aktivieren",
          criticalOnly: "Nur Kritisch",
          savePreferences: "Einstellungen speichern",
          toast: { saved: "Benachrichtigungseinstellungen gespeichert", allEnabled: "Alle Benachrichtigungen aktiviert", criticalOnly: "Nur Systembenachrichtigungen aktiv", saveError: "Benachrichtigungen konnten nicht gespeichert werden" }
        },
        security: {
          title: "Sicherheitseinstellungen",
          description: "Passwort und Kontosicherheit verwalten",
          currentPassword: "Aktuelles Passwort",
          newPassword: "Neues Passwort",
          confirmNewPassword: "Neues Passwort bestätigen",
          updatePassword: "Passwort aktualisieren",
          strengthPrefix: "Stärke:",
          passwordStrength: { empty: "Leer", weak: "Schwach", fair: "Mäßig", good: "Gut", strong: "Stark" },
          twoFactor: { title: "Zwei-Faktor-Authentifizierung", description: "Verifizierungscode für sensible Aktionen verwenden.", enabled: "Aktiviert", disabled: "Deaktiviert", newCodes: "Neue Wiederherstellungscodes", disable: "2FA deaktivieren", enable: "2FA aktivieren" },
          twoFactorDialog: { title: "Zwei-Faktor-Authentifizierung aktivieren", description: "Authenticator-App öffnen, QR-Code scannen und 6-stelligen Code eingeben.", qrPlaceholder: "QR-Code erscheint hier in der Produktion", showCode: "Demo-Code anzeigen", hideCode: "Demo-Code ausblenden", demoLabel: "Demo-Code", codeLabel: "Verifizierungscode", codePlaceholder: "6-stelligen Code eingeben", cancel: "Abbrechen", verify: "Verifizieren & aktivieren" },
          recoveryCodes: { title: "Wiederherstellungscodes", copyAll: "Alle kopieren", description: "Diese Codes sicher aufbewahren. Jeder Code kann nur einmal verwendet werden." },
          sessions: { title: "Aktive Sitzungen", description: "Aktuell angemeldete Geräte überprüfen.", signOutOthers: "Andere abmelden", signOut: "Abmelden", current: "aktuell" },
          toast: {
            passwordSaved: "Passwort aktualisiert",
            twoFactorEnabled: "Zwei-Faktor-Authentifizierung aktiviert",
            twoFactorDisabled: "Zwei-Faktor-Authentifizierung deaktiviert",
            codesRegenerated: "Wiederherstellungscodes neu generiert",
            codesCopied: "Wiederherstellungscodes kopiert",
            sessionSignedOut: "{{device}} abgemeldet",
            sessionsSignedOut_one: "{{count}} Sitzung abgemeldet",
            sessionsSignedOut_other: "{{count}} Sitzungen abgemeldet",
            passwordAllFields: "Alle Passwortfelder ausfüllen",
            passwordMismatch: "Neue Passwörter stimmen nicht überein",
            passwordWeak: "Stärkeres Passwort verwenden",
            passwordSame: "Neues Passwort muss sich unterscheiden",
            passwordError: "Passwort konnte nicht aktualisiert werden",
            twoFactorWrongCode: "Falscher Code — Authenticator-App prüfen",
            twoFactorSetupError: "2FA-Setup konnte nicht gespeichert werden",
            twoFactorDisableError: "2FA-Status konnte nicht gespeichert werden",
            twoFactorRequired: "2FA zuerst aktivieren",
            codesError: "Wiederherstellungscodes konnten nicht gespeichert werden",
            clipboardError: "Kopieren fehlgeschlagen — Codes manuell kopieren",
            sessionError: "Sitzung konnte nicht abgemeldet werden",
            sessionsError: "Sitzungen konnten nicht abgemeldet werden",
            noOtherSessions: "Keine weiteren Sitzungen"
          }
        },
        appearance: {
          title: "Anzeigeeinstellungen",
          description: "Aussehen und Bedienung des Dashboards anpassen",
          themeMode: "Designmodus",
          themeModeDesc: "Zwischen hell, dunkel und System wechseln.",
          light: "Hell",
          dark: "Dunkel",
          system: "System",
          compactView: "Kompakte Ansicht",
          compactViewDesc: "Abstände in Tabellen und Listen reduzieren.",
          language: "Sprache",
          languageDesc: "Anzeigesprache auswählen.",
          resetDisplay: "Anzeige zurücksetzen",
          saveDisplay: "Anzeigeeinstellungen speichern",
          toast: { saved: "Anzeigeeinstellungen gespeichert", reset: "Anzeigeeinstellungen zurückgesetzt", saveError: "Anzeigeeinstellungen konnten nicht gespeichert werden" }
        },
        resetDialog: { title: "Einstellungen zurücksetzen", description: "Lokale Kontoeinstellungen auf Standardwerte zurücksetzen.", cancel: "Abbrechen", confirm: "Einstellungen zurücksetzen" },
        toast: { exported: "Einstellungen exportiert", restored: "Einstellungen auf Standard zurückgesetzt", restoredLocal: "Lokale Einstellungen zurückgesetzt" }
      }
    }
  },
  fr: {
    chief: {
      settings: {
        pageTitle: "Paramètres | ENS",
        title: "Paramètres",
        breadcrumb: "Paramètres",
        export: "Exporter",
        reset: "Réinitialiser",
        tabs: { profile: "Profil", notifications: "Notifications", security: "Sécurité", appearance: "Apparence" },
        profile: {
          title: "Informations du profil",
          description: "Mettre à jour vos informations personnelles et professionnelles",
          unsaved: "Non enregistré",
          changeAvatar: "Changer l'avatar",
          uploadPicture: "Télécharger une image",
          fullName: "Nom complet",
          emailLabel: "Adresse e-mail",
          roleLabel: "Rôle",
          phone: "Numéro de téléphone",
          phonePlaceholder: "+33 (555) 000-0000",
          revert: "Annuler",
          saveChanges: "Enregistrer les modifications",
          avatarDialog: { title: "Changer l'avatar", description: "Choisir un style d'avatar pour ce profil.", cancel: "Annuler", apply: "Appliquer l'avatar" },
          avatarTones: { primary: "Primaire", blue: "Bleu", green: "Vert", amber: "Ambre" },
          validation: { nameRequired: "Le nom est requis", emailInvalid: "Entrez un e-mail valide", phoneInvalid: "Entrez un numéro de téléphone valide" },
          toast: { saved: "Modifications du profil enregistrées", reverted: "Modifications du profil annulées", avatarUpdated: "Avatar mis à jour", pictureSelected: "Photo de profil sélectionnée", loadError: "Impossible de charger les paramètres", saveError: "Impossible d'enregistrer le profil", avatarError: "Impossible d'enregistrer l'avatar", imageTypeError: "Choisir un fichier image", imageSizeError: "Choisir une image de moins de 1,5 Mo" }
        },
        notifications: {
          title: "Notifications par e-mail",
          description: "Configurer les mises à jour à recevoir par e-mail",
          enabledCount: "{{count}}/4 activées",
          items: {
            assignments: { title: "Nouvelles affectations de projet", desc: "Être notifié lors d'une nouvelle affectation." },
            milestones: { title: "Jalons de projet", desc: "Alertes pour les étapes terminées ou les demandes d'approbation." },
            reports: { title: "Rapports d'activité des managers", desc: "Résumé hebdomadaire des performances des managers." },
            system: { title: "Alertes système", desc: "Mises à jour critiques et notifications de sécurité." }
          },
          enableAll: "Tout activer",
          criticalOnly: "Critiques seulement",
          savePreferences: "Enregistrer les préférences",
          toast: { saved: "Préférences de notification enregistrées", allEnabled: "Toutes les notifications activées", criticalOnly: "Seules les alertes système sont actives", saveError: "Impossible d'enregistrer les notifications" }
        },
        security: {
          title: "Paramètres de sécurité",
          description: "Gérer votre mot de passe et la sécurité du compte",
          currentPassword: "Mot de passe actuel",
          newPassword: "Nouveau mot de passe",
          confirmNewPassword: "Confirmer le nouveau mot de passe",
          updatePassword: "Mettre à jour le mot de passe",
          strengthPrefix: "Force :",
          passwordStrength: { empty: "Vide", weak: "Faible", fair: "Moyen", good: "Bon", strong: "Fort" },
          twoFactor: { title: "Authentification à deux facteurs", description: "Utiliser un code de vérification pour les actions sensibles.", enabled: "Activée", disabled: "Désactivée", newCodes: "Nouveaux codes de récupération", disable: "Désactiver 2FA", enable: "Activer 2FA" },
          twoFactorDialog: { title: "Activer l'authentification à deux facteurs", description: "Ouvrez votre application d'authentification, scannez le QR code, puis entrez le code à 6 chiffres.", qrPlaceholder: "Le QR code apparaîtra ici en production", showCode: "Afficher le code de démonstration", hideCode: "Masquer le code", demoLabel: "Code démo", codeLabel: "Code de vérification", codePlaceholder: "Entrez le code à 6 chiffres", cancel: "Annuler", verify: "Vérifier & activer" },
          recoveryCodes: { title: "Codes de récupération", copyAll: "Tout copier", description: "Conservez ces codes en lieu sûr. Chaque code ne peut être utilisé qu'une seule fois." },
          sessions: { title: "Sessions actives", description: "Vérifier les appareils connectés à ce compte.", signOutOthers: "Déconnecter les autres", signOut: "Déconnecter", current: "actuel" },
          toast: {
            passwordSaved: "Mot de passe mis à jour",
            twoFactorEnabled: "Authentification à deux facteurs activée",
            twoFactorDisabled: "Authentification à deux facteurs désactivée",
            codesRegenerated: "Codes de récupération régénérés",
            codesCopied: "Codes de récupération copiés",
            sessionSignedOut: "{{device}} déconnecté",
            sessionsSignedOut_one: "{{count}} session déconnectée",
            sessionsSignedOut_other: "{{count}} sessions déconnectées",
            passwordAllFields: "Remplir tous les champs",
            passwordMismatch: "Les nouveaux mots de passe ne correspondent pas",
            passwordWeak: "Utiliser un mot de passe plus fort",
            passwordSame: "Le nouveau mot de passe doit être différent",
            passwordError: "Impossible de mettre à jour le mot de passe",
            twoFactorWrongCode: "Code incorrect — vérifiez votre application",
            twoFactorSetupError: "Impossible d'enregistrer la configuration 2FA",
            twoFactorDisableError: "Impossible d'enregistrer le statut 2FA",
            twoFactorRequired: "Activez d'abord la 2FA",
            codesError: "Impossible d'enregistrer les codes de récupération",
            clipboardError: "Impossible de copier — copiez les codes manuellement",
            sessionError: "Impossible de déconnecter la session",
            sessionsError: "Impossible de déconnecter les sessions",
            noOtherSessions: "Aucune autre session à déconnecter"
          }
        },
        appearance: {
          title: "Paramètres d'affichage",
          description: "Personnaliser l'apparence de votre tableau de bord",
          themeMode: "Mode thème",
          themeModeDesc: "Basculer entre les thèmes clair, sombre et système.",
          light: "Clair",
          dark: "Sombre",
          system: "Système",
          compactView: "Vue compacte",
          compactViewDesc: "Réduire l'espacement dans les tableaux et les listes.",
          language: "Langue",
          languageDesc: "Sélectionner la langue d'affichage.",
          resetDisplay: "Réinitialiser l'affichage",
          saveDisplay: "Enregistrer les paramètres d'affichage",
          toast: { saved: "Paramètres d'affichage enregistrés", reset: "Paramètres d'affichage réinitialisés", saveError: "Impossible d'enregistrer les paramètres d'affichage" }
        },
        resetDialog: { title: "Réinitialiser les paramètres", description: "Restaure les paramètres locaux aux valeurs par défaut.", cancel: "Annuler", confirm: "Réinitialiser" },
        toast: { exported: "Paramètres exportés", restored: "Paramètres restaurés par défaut", restoredLocal: "Paramètres locaux restaurés" }
      }
    }
  },
  es: {
    chief: {
      settings: {
        pageTitle: "Configuración | ENS",
        title: "Configuración",
        breadcrumb: "Configuración",
        export: "Exportar",
        reset: "Restablecer",
        tabs: { profile: "Perfil", notifications: "Notificaciones", security: "Seguridad", appearance: "Apariencia" },
        profile: {
          title: "Información del perfil",
          description: "Actualizar los datos personales y profesionales",
          unsaved: "Sin guardar",
          changeAvatar: "Cambiar avatar",
          uploadPicture: "Subir imagen",
          fullName: "Nombre completo",
          emailLabel: "Correo electrónico",
          roleLabel: "Rol",
          phone: "Número de teléfono",
          phonePlaceholder: "+34 (555) 000-0000",
          revert: "Revertir",
          saveChanges: "Guardar cambios",
          avatarDialog: { title: "Cambiar avatar", description: "Elegir un estilo de avatar para este perfil.", cancel: "Cancelar", apply: "Aplicar avatar" },
          avatarTones: { primary: "Principal", blue: "Azul", green: "Verde", amber: "Ámbar" },
          validation: { nameRequired: "El nombre es obligatorio", emailInvalid: "Introduce un correo válido", phoneInvalid: "Introduce un teléfono válido" },
          toast: { saved: "Cambios de perfil guardados", reverted: "Cambios de perfil revertidos", avatarUpdated: "Avatar actualizado", pictureSelected: "Foto de perfil seleccionada", loadError: "No se pudieron cargar los ajustes", saveError: "No se pudo guardar el perfil", avatarError: "No se pudo guardar el avatar", imageTypeError: "Selecciona un archivo de imagen", imageSizeError: "Selecciona una imagen de menos de 1,5 MB" }
        },
        notifications: {
          title: "Notificaciones por correo",
          description: "Configurar qué actualizaciones recibir por correo",
          enabledCount: "{{count}}/4 activadas",
          items: {
            assignments: { title: "Nuevas asignaciones de proyectos", desc: "Notificación al crear y asignar un nuevo proyecto." },
            milestones: { title: "Hitos del proyecto", desc: "Alertas para etapas completadas o solicitudes de aprobación." },
            reports: { title: "Informes de actividad de managers", desc: "Resumen semanal del rendimiento de los managers." },
            system: { title: "Alertas del sistema", desc: "Actualizaciones críticas y notificaciones de seguridad." }
          },
          enableAll: "Activar todo",
          criticalOnly: "Solo críticas",
          savePreferences: "Guardar preferencias",
          toast: { saved: "Preferencias de notificación guardadas", allEnabled: "Todas las notificaciones activadas", criticalOnly: "Solo alertas del sistema activas", saveError: "No se pudieron guardar las notificaciones" }
        },
        security: {
          title: "Configuración de seguridad",
          description: "Gestionar la contraseña y la seguridad de la cuenta",
          currentPassword: "Contraseña actual",
          newPassword: "Nueva contraseña",
          confirmNewPassword: "Confirmar nueva contraseña",
          updatePassword: "Actualizar contraseña",
          strengthPrefix: "Fortaleza:",
          passwordStrength: { empty: "Vacía", weak: "Débil", fair: "Regular", good: "Buena", strong: "Fuerte" },
          twoFactor: { title: "Autenticación de dos factores", description: "Usar código de verificación para acciones sensibles.", enabled: "Activada", disabled: "Desactivada", newCodes: "Nuevos códigos de recuperación", disable: "Desactivar 2FA", enable: "Activar 2FA" },
          twoFactorDialog: { title: "Activar autenticación de dos factores", description: "Abre tu aplicación de autenticación, escanea el código QR e introduce el código de 6 dígitos.", qrPlaceholder: "El código QR aparecerá aquí en producción", showCode: "Mostrar código de demostración", hideCode: "Ocultar código", demoLabel: "Código demo", codeLabel: "Código de verificación", codePlaceholder: "Introduce el código de 6 dígitos", cancel: "Cancelar", verify: "Verificar y activar" },
          recoveryCodes: { title: "Códigos de recuperación", copyAll: "Copiar todo", description: "Guarda estos códigos en un lugar seguro. Cada código solo puede usarse una vez." },
          sessions: { title: "Sesiones activas", description: "Revisar los dispositivos conectados a esta cuenta.", signOutOthers: "Cerrar otras sesiones", signOut: "Cerrar sesión", current: "actual" },
          toast: {
            passwordSaved: "Contraseña actualizada",
            twoFactorEnabled: "Autenticación de dos factores activada",
            twoFactorDisabled: "Autenticación de dos factores desactivada",
            codesRegenerated: "Códigos de recuperación regenerados",
            codesCopied: "Códigos de recuperación copiados",
            sessionSignedOut: "{{device}} desconectado",
            sessionsSignedOut_one: "{{count}} sesión cerrada",
            sessionsSignedOut_other: "{{count}} sesiones cerradas",
            passwordAllFields: "Rellena todos los campos",
            passwordMismatch: "Las contraseñas no coinciden",
            passwordWeak: "Usa una contraseña más segura",
            passwordSame: "La nueva contraseña debe ser diferente",
            passwordError: "No se pudo actualizar la contraseña",
            twoFactorWrongCode: "Código incorrecto — comprueba tu aplicación",
            twoFactorSetupError: "No se pudo guardar la configuración 2FA",
            twoFactorDisableError: "No se pudo guardar el estado 2FA",
            twoFactorRequired: "Activa primero la 2FA",
            codesError: "No se pudieron guardar los códigos de recuperación",
            clipboardError: "No se pudo copiar — copia los códigos manualmente",
            sessionError: "No se pudo cerrar la sesión",
            sessionsError: "No se pudieron cerrar las sesiones",
            noOtherSessions: "No hay otras sesiones"
          }
        },
        appearance: {
          title: "Configuración de pantalla",
          description: "Personalizar el aspecto del panel de control",
          themeMode: "Modo de tema",
          themeModeDesc: "Cambiar entre temas claro, oscuro y del sistema.",
          light: "Claro",
          dark: "Oscuro",
          system: "Sistema",
          compactView: "Vista compacta",
          compactViewDesc: "Reducir el espaciado en tablas y listas.",
          language: "Idioma",
          languageDesc: "Seleccionar el idioma de visualización.",
          resetDisplay: "Restablecer pantalla",
          saveDisplay: "Guardar configuración de pantalla",
          toast: { saved: "Configuración de pantalla guardada", reset: "Configuración de pantalla restablecida", saveError: "No se pudo guardar la configuración de pantalla" }
        },
        resetDialog: { title: "Restablecer configuración", description: "Restaura los ajustes locales a los valores predeterminados.", cancel: "Cancelar", confirm: "Restablecer" },
        toast: { exported: "Configuración exportada", restored: "Configuración restaurada a valores predeterminados", restoredLocal: "Configuración local restaurada" }
      }
    }
  },
  it: {
    chief: {
      settings: {
        pageTitle: "Impostazioni | ENS",
        title: "Impostazioni",
        breadcrumb: "Impostazioni",
        export: "Esporta",
        reset: "Ripristina",
        tabs: { profile: "Profilo", notifications: "Notifiche", security: "Sicurezza", appearance: "Aspetto" },
        profile: {
          title: "Informazioni profilo",
          description: "Aggiorna i tuoi dati personali e professionali",
          unsaved: "Non salvato",
          changeAvatar: "Cambia avatar",
          uploadPicture: "Carica immagine",
          fullName: "Nome completo",
          emailLabel: "Indirizzo e-mail",
          roleLabel: "Ruolo",
          phone: "Numero di telefono",
          phonePlaceholder: "+39 (555) 000-0000",
          revert: "Annulla",
          saveChanges: "Salva modifiche",
          avatarDialog: { title: "Cambia avatar", description: "Scegli uno stile di avatar per questo profilo.", cancel: "Annulla", apply: "Applica avatar" },
          avatarTones: { primary: "Principale", blue: "Blu", green: "Verde", amber: "Ambra" },
          validation: { nameRequired: "Il nome è obbligatorio", emailInvalid: "Inserisci un'e-mail valida", phoneInvalid: "Inserisci un numero di telefono valido" },
          toast: { saved: "Modifiche al profilo salvate", reverted: "Modifiche al profilo annullate", avatarUpdated: "Avatar aggiornato", pictureSelected: "Foto profilo selezionata", loadError: "Impossibile caricare le impostazioni", saveError: "Impossibile salvare il profilo", avatarError: "Impossibile salvare l'avatar", imageTypeError: "Scegli un file immagine", imageSizeError: "Scegli un'immagine sotto 1,5 MB" }
        },
        notifications: {
          title: "Notifiche via e-mail",
          description: "Configura gli aggiornamenti da ricevere via e-mail",
          enabledCount: "{{count}}/4 attive",
          items: {
            assignments: { title: "Nuove assegnazioni di progetto", desc: "Notifica quando un progetto viene creato e assegnato." },
            milestones: { title: "Milestone di progetto", desc: "Avvisi per fasi completate o richieste di approvazione." },
            reports: { title: "Report attività manager", desc: "Riepilogo settimanale delle prestazioni dei manager." },
            system: { title: "Avvisi di sistema", desc: "Aggiornamenti critici e notifiche di sicurezza." }
          },
          enableAll: "Attiva tutto",
          criticalOnly: "Solo critiche",
          savePreferences: "Salva preferenze",
          toast: { saved: "Preferenze notifiche salvate", allEnabled: "Tutte le notifiche attivate", criticalOnly: "Solo avvisi di sistema attivi", saveError: "Impossibile salvare le notifiche" }
        },
        security: {
          title: "Impostazioni di sicurezza",
          description: "Gestisci la password e la sicurezza dell'account",
          currentPassword: "Password attuale",
          newPassword: "Nuova password",
          confirmNewPassword: "Conferma nuova password",
          updatePassword: "Aggiorna password",
          strengthPrefix: "Forza:",
          passwordStrength: { empty: "Vuota", weak: "Debole", fair: "Discreta", good: "Buona", strong: "Forte" },
          twoFactor: { title: "Autenticazione a due fattori", description: "Usa un codice di verifica per azioni sensibili.", enabled: "Attiva", disabled: "Disattiva", newCodes: "Nuovi codici di recupero", disable: "Disabilita 2FA", enable: "Abilita 2FA" },
          twoFactorDialog: { title: "Abilita autenticazione a due fattori", description: "Apri l'app di autenticazione, scansiona il QR code e inserisci il codice a 6 cifre.", qrPlaceholder: "Il QR code apparirà qui in produzione", showCode: "Mostra codice demo", hideCode: "Nascondi codice", demoLabel: "Codice demo", codeLabel: "Codice di verifica", codePlaceholder: "Inserisci il codice a 6 cifre", cancel: "Annulla", verify: "Verifica e abilita" },
          recoveryCodes: { title: "Codici di recupero", copyAll: "Copia tutti", description: "Salva questi codici in un posto sicuro. Ogni codice può essere usato una sola volta." },
          sessions: { title: "Sessioni attive", description: "Controlla i dispositivi connessi a questo account.", signOutOthers: "Disconnetti gli altri", signOut: "Disconnetti", current: "attuale" },
          toast: {
            passwordSaved: "Password aggiornata",
            twoFactorEnabled: "Autenticazione a due fattori abilitata",
            twoFactorDisabled: "Autenticazione a due fattori disabilitata",
            codesRegenerated: "Codici di recupero rigenerati",
            codesCopied: "Codici di recupero copiati",
            sessionSignedOut: "{{device}} disconnesso",
            sessionsSignedOut_one: "{{count}} sessione disconnessa",
            sessionsSignedOut_other: "{{count}} sessioni disconnesse",
            passwordAllFields: "Compila tutti i campi",
            passwordMismatch: "Le nuove password non coincidono",
            passwordWeak: "Usa una password più sicura",
            passwordSame: "La nuova password deve essere diversa",
            passwordError: "Impossibile aggiornare la password",
            twoFactorWrongCode: "Codice errato — controlla la tua app",
            twoFactorSetupError: "Impossibile salvare la configurazione 2FA",
            twoFactorDisableError: "Impossibile salvare lo stato 2FA",
            twoFactorRequired: "Abilita prima la 2FA",
            codesError: "Impossibile salvare i codici di recupero",
            clipboardError: "Copia non riuscita — copia i codici manualmente",
            sessionError: "Impossibile disconnettere la sessione",
            sessionsError: "Impossibile disconnettere le sessioni",
            noOtherSessions: "Nessun'altra sessione"
          }
        },
        appearance: {
          title: "Impostazioni di visualizzazione",
          description: "Personalizza l'aspetto della dashboard",
          themeMode: "Modalità tema",
          themeModeDesc: "Passa tra i temi chiaro, scuro e di sistema.",
          light: "Chiaro",
          dark: "Scuro",
          system: "Sistema",
          compactView: "Vista compatta",
          compactViewDesc: "Riduci la spaziatura in tabelle e liste.",
          language: "Lingua",
          languageDesc: "Seleziona la lingua di visualizzazione.",
          resetDisplay: "Ripristina visualizzazione",
          saveDisplay: "Salva impostazioni di visualizzazione",
          toast: { saved: "Impostazioni di visualizzazione salvate", reset: "Impostazioni di visualizzazione ripristinate", saveError: "Impossibile salvare le impostazioni di visualizzazione" }
        },
        resetDialog: { title: "Ripristina impostazioni", description: "Ripristina le impostazioni locali ai valori predefiniti.", cancel: "Annulla", confirm: "Ripristina" },
        toast: { exported: "Impostazioni esportate", restored: "Impostazioni ripristinate ai valori predefiniti", restoredLocal: "Impostazioni locali ripristinate" }
      }
    }
  },
  pt: {
    chief: {
      settings: {
        pageTitle: "Configurações | ENS",
        title: "Configurações",
        breadcrumb: "Configurações",
        export: "Exportar",
        reset: "Redefinir",
        tabs: { profile: "Perfil", notifications: "Notificações", security: "Segurança", appearance: "Aparência" },
        profile: {
          title: "Informações do perfil",
          description: "Atualizar dados pessoais e profissionais",
          unsaved: "Não salvo",
          changeAvatar: "Alterar avatar",
          uploadPicture: "Enviar imagem",
          fullName: "Nome completo",
          emailLabel: "Endereço de e-mail",
          roleLabel: "Função",
          phone: "Número de telefone",
          phonePlaceholder: "+55 (555) 000-0000",
          revert: "Reverter",
          saveChanges: "Salvar alterações",
          avatarDialog: { title: "Alterar avatar", description: "Escolher um estilo de avatar para este perfil.", cancel: "Cancelar", apply: "Aplicar avatar" },
          avatarTones: { primary: "Primário", blue: "Azul", green: "Verde", amber: "Âmbar" },
          validation: { nameRequired: "O nome é obrigatório", emailInvalid: "Insira um e-mail válido", phoneInvalid: "Insira um número de telefone válido" },
          toast: { saved: "Alterações do perfil salvas", reverted: "Alterações do perfil revertidas", avatarUpdated: "Avatar atualizado", pictureSelected: "Foto de perfil selecionada", loadError: "Não foi possível carregar as configurações", saveError: "Não foi possível salvar o perfil", avatarError: "Não foi possível salvar o avatar", imageTypeError: "Escolha um arquivo de imagem", imageSizeError: "Escolha uma imagem menor que 1,5 MB" }
        },
        notifications: {
          title: "Notificações por e-mail",
          description: "Configurar quais atualizações receber por e-mail",
          enabledCount: "{{count}}/4 ativadas",
          items: {
            assignments: { title: "Novas atribuições de projeto", desc: "Ser notificado quando um projeto for criado e atribuído." },
            milestones: { title: "Marcos do projeto", desc: "Alertas para etapas concluídas ou solicitações de aprovação." },
            reports: { title: "Relatórios de atividade dos gerentes", desc: "Resumo semanal do desempenho dos gerentes." },
            system: { title: "Alertas do sistema", desc: "Atualizações críticas e notificações de segurança." }
          },
          enableAll: "Ativar tudo",
          criticalOnly: "Somente críticas",
          savePreferences: "Salvar preferências",
          toast: { saved: "Preferências de notificação salvas", allEnabled: "Todas as notificações ativadas", criticalOnly: "Somente alertas do sistema ativos", saveError: "Não foi possível salvar as notificações" }
        },
        security: {
          title: "Configurações de segurança",
          description: "Gerenciar senha e segurança da conta",
          currentPassword: "Senha atual",
          newPassword: "Nova senha",
          confirmNewPassword: "Confirmar nova senha",
          updatePassword: "Atualizar senha",
          strengthPrefix: "Força:",
          passwordStrength: { empty: "Vazia", weak: "Fraca", fair: "Razoável", good: "Boa", strong: "Forte" },
          twoFactor: { title: "Autenticação de dois fatores", description: "Usar código de verificação para ações sensíveis.", enabled: "Ativada", disabled: "Desativada", newCodes: "Novos códigos de recuperação", disable: "Desativar 2FA", enable: "Ativar 2FA" },
          twoFactorDialog: { title: "Ativar autenticação de dois fatores", description: "Abra o app de autenticação, escaneie o QR code e insira o código de 6 dígitos.", qrPlaceholder: "O QR code aparecerá aqui em produção", showCode: "Mostrar código de demonstração", hideCode: "Ocultar código", demoLabel: "Código demo", codeLabel: "Código de verificação", codePlaceholder: "Inserir código de 6 dígitos", cancel: "Cancelar", verify: "Verificar e ativar" },
          recoveryCodes: { title: "Códigos de recuperação", copyAll: "Copiar tudo", description: "Guarde estes códigos em local seguro. Cada código só pode ser usado uma vez." },
          sessions: { title: "Sessões ativas", description: "Revisar dispositivos conectados a esta conta.", signOutOthers: "Sair de outras sessões", signOut: "Sair", current: "atual" },
          toast: {
            passwordSaved: "Senha atualizada",
            twoFactorEnabled: "Autenticação de dois fatores ativada",
            twoFactorDisabled: "Autenticação de dois fatores desativada",
            codesRegenerated: "Códigos de recuperação regenerados",
            codesCopied: "Códigos de recuperação copiados",
            sessionSignedOut: "{{device}} desconectado",
            sessionsSignedOut_one: "{{count}} sessão encerrada",
            sessionsSignedOut_other: "{{count}} sessões encerradas",
            passwordAllFields: "Preencha todos os campos",
            passwordMismatch: "As novas senhas não coincidem",
            passwordWeak: "Use uma senha mais forte",
            passwordSame: "A nova senha deve ser diferente",
            passwordError: "Não foi possível atualizar a senha",
            twoFactorWrongCode: "Código incorreto — verifique seu app",
            twoFactorSetupError: "Não foi possível salvar a configuração 2FA",
            twoFactorDisableError: "Não foi possível salvar o status 2FA",
            twoFactorRequired: "Ative primeiro a 2FA",
            codesError: "Não foi possível salvar os códigos de recuperação",
            clipboardError: "Não foi possível copiar — copie os códigos manualmente",
            sessionError: "Não foi possível encerrar a sessão",
            sessionsError: "Não foi possível encerrar as sessões",
            noOtherSessions: "Nenhuma outra sessão"
          }
        },
        appearance: {
          title: "Configurações de exibição",
          description: "Personalizar a aparência do painel",
          themeMode: "Modo de tema",
          themeModeDesc: "Alternar entre temas claro, escuro e do sistema.",
          light: "Claro",
          dark: "Escuro",
          system: "Sistema",
          compactView: "Visualização compacta",
          compactViewDesc: "Reduzir espaçamento em tabelas e listas.",
          language: "Idioma",
          languageDesc: "Selecionar o idioma de exibição.",
          resetDisplay: "Redefinir exibição",
          saveDisplay: "Salvar configurações de exibição",
          toast: { saved: "Configurações de exibição salvas", reset: "Configurações de exibição redefinidas", saveError: "Não foi possível salvar as configurações de exibição" }
        },
        resetDialog: { title: "Redefinir configurações", description: "Restaura as configurações locais aos valores padrão.", cancel: "Cancelar", confirm: "Redefinir" },
        toast: { exported: "Configurações exportadas", restored: "Configurações restauradas para os padrões", restoredLocal: "Configurações locais restauradas" }
      }
    }
  },
  nl: {
    chief: {
      settings: {
        pageTitle: "Instellingen | ENS",
        title: "Instellingen",
        breadcrumb: "Instellingen",
        export: "Exporteren",
        reset: "Resetten",
        tabs: { profile: "Profiel", notifications: "Meldingen", security: "Beveiliging", appearance: "Weergave" },
        profile: {
          title: "Profielinformatie",
          description: "Persoonlijke en professionele gegevens bijwerken",
          unsaved: "Niet opgeslagen",
          changeAvatar: "Avatar wijzigen",
          uploadPicture: "Afbeelding uploaden",
          fullName: "Volledige naam",
          emailLabel: "E-mailadres",
          roleLabel: "Rol",
          phone: "Telefoonnummer",
          phonePlaceholder: "+31 (555) 000-0000",
          revert: "Ongedaan maken",
          saveChanges: "Wijzigingen opslaan",
          avatarDialog: { title: "Avatar wijzigen", description: "Kies een avataarstijl voor dit profiel.", cancel: "Annuleren", apply: "Avatar toepassen" },
          avatarTones: { primary: "Primair", blue: "Blauw", green: "Groen", amber: "Amber" },
          validation: { nameRequired: "Naam is verplicht", emailInvalid: "Voer een geldig e-mailadres in", phoneInvalid: "Voer een geldig telefoonnummer in" },
          toast: { saved: "Profielwijzigingen opgeslagen", reverted: "Profielwijzigingen ongedaan gemaakt", avatarUpdated: "Avatar bijgewerkt", pictureSelected: "Profielfoto geselecteerd", loadError: "Instellingen konden niet worden geladen", saveError: "Profiel kon niet worden opgeslagen", avatarError: "Avatar kon niet worden opgeslagen", imageTypeError: "Kies een afbeeldingsbestand", imageSizeError: "Kies een afbeelding kleiner dan 1,5 MB" }
        },
        notifications: {
          title: "E-mailmeldingen",
          description: "Configureer welke updates u per e-mail wilt ontvangen",
          enabledCount: "{{count}}/4 ingeschakeld",
          items: {
            assignments: { title: "Nieuwe projecttoewijzingen", desc: "Melding bij een nieuwe projecttoewijzing." },
            milestones: { title: "Projectmijlpalen", desc: "Meldingen voor voltooide fasen of goedkeuringsverzoeken." },
            reports: { title: "Activiteitsrapporten managers", desc: "Wekelijks overzicht van managerprestaties." },
            system: { title: "Systeemmeldingen", desc: "Kritieke updates en beveiligingsmeldingen." }
          },
          enableAll: "Alles inschakelen",
          criticalOnly: "Alleen kritiek",
          savePreferences: "Voorkeuren opslaan",
          toast: { saved: "Meldingsvoorkeuren opgeslagen", allEnabled: "Alle meldingen ingeschakeld", criticalOnly: "Alleen systeemmeldingen actief", saveError: "Meldingen konden niet worden opgeslagen" }
        },
        security: {
          title: "Beveiligingsinstellingen",
          description: "Wachtwoord en accountbeveiliging beheren",
          currentPassword: "Huidig wachtwoord",
          newPassword: "Nieuw wachtwoord",
          confirmNewPassword: "Nieuw wachtwoord bevestigen",
          updatePassword: "Wachtwoord bijwerken",
          strengthPrefix: "Sterkte:",
          passwordStrength: { empty: "Leeg", weak: "Zwak", fair: "Redelijk", good: "Goed", strong: "Sterk" },
          twoFactor: { title: "Tweefactorauthenticatie", description: "Gebruik een verificatiecode voor gevoelige acties.", enabled: "Ingeschakeld", disabled: "Uitgeschakeld", newCodes: "Nieuwe herstelcodes", disable: "2FA uitschakelen", enable: "2FA inschakelen" },
          twoFactorDialog: { title: "Tweefactorauthenticatie inschakelen", description: "Open uw authenticatie-app, scan de QR-code en voer de 6-cijferige code in.", qrPlaceholder: "QR-code verschijnt hier in productie", showCode: "Democode weergeven", hideCode: "Code verbergen", demoLabel: "Democode", codeLabel: "Verificatiecode", codePlaceholder: "6-cijferige code invoeren", cancel: "Annuleren", verify: "Verifiëren en inschakelen" },
          recoveryCodes: { title: "Herstelcodes", copyAll: "Alles kopiëren", description: "Bewaar deze codes op een veilige plek. Elke code kan slechts één keer worden gebruikt." },
          sessions: { title: "Actieve sessies", description: "Apparaten controleren die op dit account zijn aangemeld.", signOutOthers: "Anderen afmelden", signOut: "Afmelden", current: "huidig" },
          toast: {
            passwordSaved: "Wachtwoord bijgewerkt",
            twoFactorEnabled: "Tweefactorauthenticatie ingeschakeld",
            twoFactorDisabled: "Tweefactorauthenticatie uitgeschakeld",
            codesRegenerated: "Herstelcodes opnieuw gegenereerd",
            codesCopied: "Herstelcodes gekopieerd",
            sessionSignedOut: "{{device}} afgemeld",
            sessionsSignedOut_one: "{{count}} sessie afgemeld",
            sessionsSignedOut_other: "{{count}} sessies afgemeld",
            passwordAllFields: "Vul alle wachtwoordvelden in",
            passwordMismatch: "Nieuwe wachtwoorden komen niet overeen",
            passwordWeak: "Gebruik een sterker wachtwoord",
            passwordSame: "Nieuw wachtwoord moet anders zijn",
            passwordError: "Wachtwoord kon niet worden bijgewerkt",
            twoFactorWrongCode: "Onjuiste code — controleer uw app",
            twoFactorSetupError: "2FA-configuratie kon niet worden opgeslagen",
            twoFactorDisableError: "2FA-status kon niet worden opgeslagen",
            twoFactorRequired: "Schakel eerst 2FA in",
            codesError: "Herstelcodes konden niet worden opgeslagen",
            clipboardError: "Kopiëren mislukt — kopieer de codes handmatig",
            sessionError: "Sessie kon niet worden afgemeld",
            sessionsError: "Sessies konden niet worden afgemeld",
            noOtherSessions: "Geen andere sessies"
          }
        },
        appearance: {
          title: "Weergave-instellingen",
          description: "Pas het uiterlijk van uw dashboard aan",
          themeMode: "Thememodus",
          themeModeDesc: "Schakel tussen licht, donker en systeemthema.",
          light: "Licht",
          dark: "Donker",
          system: "Systeem",
          compactView: "Compacte weergave",
          compactViewDesc: "Verminder afstand in tabellen en lijsten.",
          language: "Taal",
          languageDesc: "Selecteer de weergavetaal.",
          resetDisplay: "Weergave resetten",
          saveDisplay: "Weergave-instellingen opslaan",
          toast: { saved: "Weergave-instellingen opgeslagen", reset: "Weergave-instellingen gereset", saveError: "Weergave-instellingen konden niet worden opgeslagen" }
        },
        resetDialog: { title: "Instellingen resetten", description: "Herstelt lokale accountinstellingen naar de standaardwaarden.", cancel: "Annuleren", confirm: "Resetten" },
        toast: { exported: "Instellingen geëxporteerd", restored: "Instellingen hersteld naar standaard", restoredLocal: "Lokale instellingen hersteld" }
      }
    }
  },
  zh: {
    chief: {
      settings: {
        pageTitle: "设置 | ENS",
        title: "设置",
        breadcrumb: "设置",
        export: "导出",
        reset: "重置",
        tabs: { profile: "个人资料", notifications: "通知", security: "安全", appearance: "外观" },
        profile: {
          title: "个人资料信息",
          description: "更新个人和专业信息",
          unsaved: "未保存",
          changeAvatar: "更换头像",
          uploadPicture: "上传图片",
          fullName: "全名",
          emailLabel: "电子邮件地址",
          roleLabel: "角色",
          phone: "电话号码",
          phonePlaceholder: "+86 (555) 000-0000",
          revert: "撤销",
          saveChanges: "保存更改",
          avatarDialog: { title: "更换头像", description: "为此账户选择头像风格。", cancel: "取消", apply: "应用头像" },
          avatarTones: { primary: "主色", blue: "蓝色", green: "绿色", amber: "琥珀色" },
          validation: { nameRequired: "名称为必填项", emailInvalid: "请输入有效的电子邮件", phoneInvalid: "请输入有效的电话号码" },
          toast: { saved: "个人资料更改已保存", reverted: "个人资料更改已撤销", avatarUpdated: "头像已更新", pictureSelected: "头像已选择", loadError: "无法加载设置", saveError: "无法保存个人资料", avatarError: "无法保存头像", imageTypeError: "请选择图片文件", imageSizeError: "请选择小于1.5 MB的图片" }
        },
        notifications: {
          title: "电子邮件通知",
          description: "配置要通过电子邮件接收的更新",
          enabledCount: "{{count}}/4 已启用",
          items: {
            assignments: { title: "新项目分配", desc: "创建并分配新项目时收到通知。" },
            milestones: { title: "项目里程碑", desc: "已完成阶段或审批请求的提醒。" },
            reports: { title: "经理活动报告", desc: "每周经理绩效和工作量摘要。" },
            system: { title: "系统提醒", desc: "关键更新和安全通知。" }
          },
          enableAll: "全部启用",
          criticalOnly: "仅关键",
          savePreferences: "保存偏好",
          toast: { saved: "通知偏好已保存", allEnabled: "所有通知已启用", criticalOnly: "仅系统提醒处于活动状态", saveError: "无法保存通知" }
        },
        security: {
          title: "安全设置",
          description: "管理密码和账户安全",
          currentPassword: "当前密码",
          newPassword: "新密码",
          confirmNewPassword: "确认新密码",
          updatePassword: "更新密码",
          strengthPrefix: "强度：",
          passwordStrength: { empty: "空", weak: "弱", fair: "一般", good: "良好", strong: "强" },
          twoFactor: { title: "双重身份验证", description: "对敏感账户操作使用验证码。", enabled: "已启用", disabled: "已禁用", newCodes: "新恢复代码", disable: "禁用 2FA", enable: "启用 2FA" },
          twoFactorDialog: { title: "启用双重身份验证", description: "打开身份验证器应用，扫描二维码，然后输入6位验证码。", qrPlaceholder: "二维码将在生产环境中显示", showCode: "显示演示验证码", hideCode: "隐藏代码", demoLabel: "演示代码", codeLabel: "验证码", codePlaceholder: "输入6位代码", cancel: "取消", verify: "验证并启用" },
          recoveryCodes: { title: "恢复代码", copyAll: "全部复制", description: "将这些代码保存在安全的地方。每个代码只能使用一次。" },
          sessions: { title: "活动会话", description: "查看当前登录此账户的设备。", signOutOthers: "退出其他会话", signOut: "退出登录", current: "当前" },
          toast: {
            passwordSaved: "密码已更新",
            twoFactorEnabled: "双重身份验证已启用",
            twoFactorDisabled: "双重身份验证已禁用",
            codesRegenerated: "恢复代码已重新生成",
            codesCopied: "恢复代码已复制",
            sessionSignedOut: "{{device}} 已退出",
            sessionsSignedOut_one: "{{count}} 个会话已退出",
            sessionsSignedOut_other: "{{count}} 个会话已退出",
            passwordAllFields: "请填写所有密码字段",
            passwordMismatch: "新密码不匹配",
            passwordWeak: "请使用更强的密码",
            passwordSame: "新密码必须与旧密码不同",
            passwordError: "无法更新密码",
            twoFactorWrongCode: "验证码不正确 — 请检查您的验证器应用",
            twoFactorSetupError: "无法保存 2FA 配置",
            twoFactorDisableError: "无法保存 2FA 状态",
            twoFactorRequired: "请先启用 2FA",
            codesError: "无法保存恢复代码",
            clipboardError: "无法复制 — 请手动复制代码",
            sessionError: "无法退出会话",
            sessionsError: "无法退出会话",
            noOtherSessions: "没有其他会话"
          }
        },
        appearance: {
          title: "显示设置",
          description: "自定义仪表板的外观",
          themeMode: "主题模式",
          themeModeDesc: "在浅色、深色和系统主题之间切换。",
          light: "浅色",
          dark: "深色",
          system: "系统",
          compactView: "紧凑视图",
          compactViewDesc: "减少表格和列表中的间距。",
          language: "语言",
          languageDesc: "选择首选显示语言。",
          resetDisplay: "重置显示",
          saveDisplay: "保存显示设置",
          toast: { saved: "显示设置已保存", reset: "显示设置已重置", saveError: "无法保存显示设置" }
        },
        resetDialog: { title: "重置设置", description: "将本地账户设置恢复为默认演示值。", cancel: "取消", confirm: "重置设置" },
        toast: { exported: "设置已导出", restored: "设置已恢复为默认值", restoredLocal: "本地设置已恢复" }
      }
    }
  },
  ja: {
    chief: {
      settings: {
        pageTitle: "設定 | ENS",
        title: "設定",
        breadcrumb: "設定",
        export: "エクスポート",
        reset: "リセット",
        tabs: { profile: "プロフィール", notifications: "通知", security: "セキュリティ", appearance: "外観" },
        profile: {
          title: "プロフィール情報",
          description: "個人・職業情報を更新する",
          unsaved: "未保存",
          changeAvatar: "アバターを変更",
          uploadPicture: "画像をアップロード",
          fullName: "フルネーム",
          emailLabel: "メールアドレス",
          roleLabel: "役割",
          phone: "電話番号",
          phonePlaceholder: "+81 (555) 000-0000",
          revert: "元に戻す",
          saveChanges: "変更を保存",
          avatarDialog: { title: "アバターを変更", description: "このプロフィールのアバタースタイルを選択してください。", cancel: "キャンセル", apply: "アバターを適用" },
          avatarTones: { primary: "プライマリ", blue: "ブルー", green: "グリーン", amber: "アンバー" },
          validation: { nameRequired: "名前は必須です", emailInvalid: "有効なメールを入力してください", phoneInvalid: "有効な電話番号を入力してください" },
          toast: { saved: "プロフィールの変更を保存しました", reverted: "プロフィールの変更を元に戻しました", avatarUpdated: "アバターを更新しました", pictureSelected: "プロフィール画像を選択しました", loadError: "設定を読み込めませんでした", saveError: "プロフィールを保存できませんでした", avatarError: "アバターを保存できませんでした", imageTypeError: "画像ファイルを選択してください", imageSizeError: "1.5 MB以下の画像を選択してください" }
        },
        notifications: {
          title: "メール通知",
          description: "メールで受け取る更新を設定する",
          enabledCount: "{{count}}/4 有効",
          items: {
            assignments: { title: "新しいプロジェクト割り当て", desc: "新しいプロジェクトが作成・割り当てられたときに通知を受け取る。" },
            milestones: { title: "プロジェクトマイルストーン", desc: "完了したステージまたは承認リクエストのアラート。" },
            reports: { title: "マネージャー活動レポート", desc: "マネージャーのパフォーマンスと作業負荷の週次サマリー。" },
            system: { title: "システムアラート", desc: "重要な更新とセキュリティ通知。" }
          },
          enableAll: "すべて有効化",
          criticalOnly: "重要のみ",
          savePreferences: "設定を保存",
          toast: { saved: "通知設定を保存しました", allEnabled: "すべての通知を有効化しました", criticalOnly: "システムアラートのみ有効", saveError: "通知を保存できませんでした" }
        },
        security: {
          title: "セキュリティ設定",
          description: "パスワードとアカウントセキュリティを管理する",
          currentPassword: "現在のパスワード",
          newPassword: "新しいパスワード",
          confirmNewPassword: "新しいパスワードを確認",
          updatePassword: "パスワードを更新",
          strengthPrefix: "強度：",
          passwordStrength: { empty: "空", weak: "弱い", fair: "普通", good: "良い", strong: "強い" },
          twoFactor: { title: "二要素認証", description: "機密性の高い操作に確認コードを使用する。", enabled: "有効", disabled: "無効", newCodes: "新しいリカバリーコード", disable: "2FAを無効化", enable: "2FAを有効化" },
          twoFactorDialog: { title: "二要素認証を有効化", description: "認証アプリを開き、QRコードをスキャンして6桁のコードを入力してください。", qrPlaceholder: "本番環境ではここにQRコードが表示されます", showCode: "デモコードを表示", hideCode: "コードを非表示", demoLabel: "デモコード", codeLabel: "確認コード", codePlaceholder: "6桁のコードを入力", cancel: "キャンセル", verify: "確認して有効化" },
          recoveryCodes: { title: "リカバリーコード", copyAll: "すべてコピー", description: "これらのコードを安全な場所に保存してください。各コードは一度のみ使用可能です。" },
          sessions: { title: "アクティブセッション", description: "このアカウントにサインインしているデバイスを確認する。", signOutOthers: "他のセッションをサインアウト", signOut: "サインアウト", current: "現在" },
          toast: {
            passwordSaved: "パスワードを更新しました",
            twoFactorEnabled: "二要素認証を有効化しました",
            twoFactorDisabled: "二要素認証を無効化しました",
            codesRegenerated: "リカバリーコードを再生成しました",
            codesCopied: "リカバリーコードをコピーしました",
            sessionSignedOut: "{{device}} をサインアウトしました",
            sessionsSignedOut_one: "{{count}} 件のセッションをサインアウトしました",
            sessionsSignedOut_other: "{{count}} 件のセッションをサインアウトしました",
            passwordAllFields: "すべてのパスワードフィールドを入力してください",
            passwordMismatch: "新しいパスワードが一致しません",
            passwordWeak: "より強いパスワードを使用してください",
            passwordSame: "新しいパスワードは現在のものと異なる必要があります",
            passwordError: "パスワードを更新できませんでした",
            twoFactorWrongCode: "確認コードが正しくありません — 認証アプリを確認してください",
            twoFactorSetupError: "2FA設定を保存できませんでした",
            twoFactorDisableError: "2FAステータスを保存できませんでした",
            twoFactorRequired: "先に2FAを有効化してください",
            codesError: "リカバリーコードを保存できませんでした",
            clipboardError: "コピーできませんでした — コードを手動でコピーしてください",
            sessionError: "セッションをサインアウトできませんでした",
            sessionsError: "セッションをサインアウトできませんでした",
            noOtherSessions: "他のセッションはありません"
          }
        },
        appearance: {
          title: "表示設定",
          description: "ダッシュボードの外観をカスタマイズする",
          themeMode: "テーマモード",
          themeModeDesc: "ライト、ダーク、システムテーマを切り替える。",
          light: "ライト",
          dark: "ダーク",
          system: "システム",
          compactView: "コンパクトビュー",
          compactViewDesc: "テーブルとリストの間隔を縮小する。",
          language: "言語",
          languageDesc: "表示言語を選択する。",
          resetDisplay: "表示をリセット",
          saveDisplay: "表示設定を保存",
          toast: { saved: "表示設定を保存しました", reset: "表示設定をリセットしました", saveError: "表示設定を保存できませんでした" }
        },
        resetDialog: { title: "設定をリセット", description: "ローカルアカウント設定をデフォルト値に戻します。", cancel: "キャンセル", confirm: "設定をリセット" },
        toast: { exported: "設定をエクスポートしました", restored: "設定をデフォルトに戻しました", restoredLocal: "ローカル設定を復元しました" }
      }
    }
  },
  ar: {
    chief: {
      settings: {
        pageTitle: "الإعدادات | ENS",
        title: "الإعدادات",
        breadcrumb: "الإعدادات",
        export: "تصدير",
        reset: "إعادة تعيين",
        tabs: { profile: "الملف الشخصي", notifications: "الإشعارات", security: "الأمان", appearance: "المظهر" },
        profile: {
          title: "معلومات الملف الشخصي",
          description: "تحديث البيانات الشخصية والمهنية",
          unsaved: "غير محفوظ",
          changeAvatar: "تغيير الصورة الرمزية",
          uploadPicture: "رفع صورة",
          fullName: "الاسم الكامل",
          emailLabel: "عنوان البريد الإلكتروني",
          roleLabel: "الدور",
          phone: "رقم الهاتف",
          phonePlaceholder: "+966 (555) 000-0000",
          revert: "التراجع",
          saveChanges: "حفظ التغييرات",
          avatarDialog: { title: "تغيير الصورة الرمزية", description: "اختر نمط صورة رمزية لهذا الملف الشخصي.", cancel: "إلغاء", apply: "تطبيق الصورة الرمزية" },
          avatarTones: { primary: "أساسي", blue: "أزرق", green: "أخضر", amber: "عنبري" },
          validation: { nameRequired: "الاسم مطلوب", emailInvalid: "أدخل بريدًا إلكترونيًا صالحًا", phoneInvalid: "أدخل رقم هاتف صالحًا" },
          toast: { saved: "تم حفظ تغييرات الملف الشخصي", reverted: "تم التراجع عن تغييرات الملف الشخصي", avatarUpdated: "تم تحديث الصورة الرمزية", pictureSelected: "تم اختيار صورة الملف الشخصي", loadError: "تعذر تحميل الإعدادات", saveError: "تعذر حفظ الملف الشخصي", avatarError: "تعذر حفظ الصورة الرمزية", imageTypeError: "اختر ملف صورة", imageSizeError: "اختر صورة أقل من 1.5 ميغابايت" }
        },
        notifications: {
          title: "إشعارات البريد الإلكتروني",
          description: "تكوين التحديثات المراد استلامها عبر البريد الإلكتروني",
          enabledCount: "{{count}}/4 مفعّل",
          items: {
            assignments: { title: "تعيينات المشاريع الجديدة", desc: "الإشعار عند إنشاء مشروع جديد وتعيينه." },
            milestones: { title: "معالم المشروع", desc: "تنبيهات للمراحل المكتملة أو طلبات الموافقة." },
            reports: { title: "تقارير نشاط المديرين", desc: "ملخص أسبوعي لأداء المديرين وعبء العمل." },
            system: { title: "تنبيهات النظام", desc: "التحديثات الهامة وإشعارات الأمان." }
          },
          enableAll: "تفعيل الكل",
          criticalOnly: "الهامة فقط",
          savePreferences: "حفظ التفضيلات",
          toast: { saved: "تم حفظ تفضيلات الإشعارات", allEnabled: "تم تفعيل جميع الإشعارات", criticalOnly: "تنبيهات النظام فقط نشطة", saveError: "تعذر حفظ الإشعارات" }
        },
        security: {
          title: "إعدادات الأمان",
          description: "إدارة كلمة المرور وأمان الحساب",
          currentPassword: "كلمة المرور الحالية",
          newPassword: "كلمة المرور الجديدة",
          confirmNewPassword: "تأكيد كلمة المرور الجديدة",
          updatePassword: "تحديث كلمة المرور",
          strengthPrefix: "القوة:",
          passwordStrength: { empty: "فارغ", weak: "ضعيف", fair: "مقبول", good: "جيد", strong: "قوي" },
          twoFactor: { title: "المصادقة الثنائية", description: "استخدام رمز التحقق للإجراءات الحساسة.", enabled: "مفعّلة", disabled: "معطّلة", newCodes: "رموز استرداد جديدة", disable: "تعطيل 2FA", enable: "تفعيل 2FA" },
          twoFactorDialog: { title: "تفعيل المصادقة الثنائية", description: "افتح تطبيق المصادقة، امسح رمز QR، ثم أدخل رمز التحقق المكون من 6 أرقام.", qrPlaceholder: "سيظهر رمز QR هنا في الإنتاج", showCode: "إظهار رمز التجريبي", hideCode: "إخفاء الرمز", demoLabel: "رمز تجريبي", codeLabel: "رمز التحقق", codePlaceholder: "أدخل الرمز المكون من 6 أرقام", cancel: "إلغاء", verify: "تحقق وتفعيل" },
          recoveryCodes: { title: "رموز الاسترداد", copyAll: "نسخ الكل", description: "احفظ هذه الرموز في مكان آمن. يمكن استخدام كل رمز مرة واحدة فقط." },
          sessions: { title: "الجلسات النشطة", description: "مراجعة الأجهزة المسجلة دخولها في هذا الحساب.", signOutOthers: "تسجيل خروج الآخرين", signOut: "تسجيل الخروج", current: "الحالية" },
          toast: {
            passwordSaved: "تم تحديث كلمة المرور",
            twoFactorEnabled: "تم تفعيل المصادقة الثنائية",
            twoFactorDisabled: "تم تعطيل المصادقة الثنائية",
            codesRegenerated: "تم إعادة توليد رموز الاسترداد",
            codesCopied: "تم نسخ رموز الاسترداد",
            sessionSignedOut: "تم تسجيل خروج {{device}}",
            sessionsSignedOut_one: "تم تسجيل خروج {{count}} جلسة",
            sessionsSignedOut_other: "تم تسجيل خروج {{count}} جلسات",
            passwordAllFields: "ملء جميع حقول كلمة المرور",
            passwordMismatch: "كلمات المرور الجديدة غير متطابقة",
            passwordWeak: "استخدم كلمة مرور أقوى",
            passwordSame: "يجب أن تكون كلمة المرور الجديدة مختلفة",
            passwordError: "تعذر تحديث كلمة المرور",
            twoFactorWrongCode: "رمز التحقق غير صحيح — تحقق من تطبيق المصادقة",
            twoFactorSetupError: "تعذر حفظ إعداد 2FA",
            twoFactorDisableError: "تعذر حفظ حالة 2FA",
            twoFactorRequired: "فعّل 2FA أولاً",
            codesError: "تعذر حفظ رموز الاسترداد",
            clipboardError: "تعذر النسخ — انسخ الرموز يدوياً",
            sessionError: "تعذر تسجيل خروج الجلسة",
            sessionsError: "تعذر تسجيل خروج الجلسات",
            noOtherSessions: "لا توجد جلسات أخرى"
          }
        },
        appearance: {
          title: "إعدادات العرض",
          description: "تخصيص مظهر لوحة التحكم",
          themeMode: "وضع السمة",
          themeModeDesc: "التبديل بين السمات الفاتحة والداكنة وسمة النظام.",
          light: "فاتح",
          dark: "داكن",
          system: "النظام",
          compactView: "عرض مضغوط",
          compactViewDesc: "تقليل التباعد في الجداول والقوائم.",
          language: "اللغة",
          languageDesc: "اختيار لغة العرض المفضلة.",
          resetDisplay: "إعادة تعيين العرض",
          saveDisplay: "حفظ إعدادات العرض",
          toast: { saved: "تم حفظ إعدادات العرض", reset: "تمت إعادة تعيين إعدادات العرض", saveError: "تعذر حفظ إعدادات العرض" }
        },
        resetDialog: { title: "إعادة تعيين الإعدادات", description: "يستعيد إعدادات الحساب المحلية إلى القيم الافتراضية.", cancel: "إلغاء", confirm: "إعادة تعيين" },
        toast: { exported: "تم تصدير الإعدادات", restored: "تمت استعادة الإعدادات إلى الافتراضية", restoredLocal: "تمت استعادة الإعدادات المحلية" }
      }
    }
  },
  tr: {
    chief: {
      settings: {
        pageTitle: "Ayarlar | ENS",
        title: "Ayarlar",
        breadcrumb: "Ayarlar",
        export: "Dışa aktar",
        reset: "Sıfırla",
        tabs: { profile: "Profil", notifications: "Bildirimler", security: "Güvenlik", appearance: "Görünüm" },
        profile: {
          title: "Profil Bilgileri",
          description: "Kişisel ve mesleki bilgilerinizi güncelleyin",
          unsaved: "Kaydedilmedi",
          changeAvatar: "Avatar değiştir",
          uploadPicture: "Resim yükle",
          fullName: "Tam Ad",
          emailLabel: "E-posta Adresi",
          roleLabel: "Rol",
          phone: "Telefon Numarası",
          phonePlaceholder: "+90 (555) 000-0000",
          revert: "Geri al",
          saveChanges: "Değişiklikleri kaydet",
          avatarDialog: { title: "Avatar değiştir", description: "Bu profil için bir avatar stili seçin.", cancel: "İptal", apply: "Avatarı uygula" },
          avatarTones: { primary: "Birincil", blue: "Mavi", green: "Yeşil", amber: "Kehribar" },
          validation: { nameRequired: "Ad gereklidir", emailInvalid: "Geçerli bir e-posta girin", phoneInvalid: "Geçerli bir telefon numarası girin" },
          toast: { saved: "Profil değişiklikleri kaydedildi", reverted: "Profil değişiklikleri geri alındı", avatarUpdated: "Avatar güncellendi", pictureSelected: "Profil fotoğrafı seçildi", loadError: "Ayarlar yüklenemedi", saveError: "Profil kaydedilemedi", avatarError: "Avatar kaydedilemedi", imageTypeError: "Bir resim dosyası seçin", imageSizeError: "1,5 MB altında bir resim seçin" }
        },
        notifications: {
          title: "E-posta Bildirimleri",
          description: "E-posta ile almak istediğiniz güncellemeleri yapılandırın",
          enabledCount: "{{count}}/4 etkin",
          items: {
            assignments: { title: "Yeni Proje Atamaları", desc: "Yeni bir proje oluşturulup atandığında bildirim alın." },
            milestones: { title: "Proje Kilometre Taşları", desc: "Tamamlanan aşamalar veya onay talepleri için uyarılar." },
            reports: { title: "Yönetici Faaliyet Raporları", desc: "Yönetici performansının haftalık özeti." },
            system: { title: "Sistem Uyarıları", desc: "Kritik güncellemeler ve güvenlik bildirimleri." }
          },
          enableAll: "Tümünü etkinleştir",
          criticalOnly: "Yalnızca kritik",
          savePreferences: "Tercihleri kaydet",
          toast: { saved: "Bildirim tercihleri kaydedildi", allEnabled: "Tüm bildirimler etkinleştirildi", criticalOnly: "Yalnızca sistem uyarıları etkin", saveError: "Bildirimler kaydedilemedi" }
        },
        security: {
          title: "Güvenlik Ayarları",
          description: "Şifrenizi ve hesap güvenliğinizi yönetin",
          currentPassword: "Mevcut Şifre",
          newPassword: "Yeni Şifre",
          confirmNewPassword: "Yeni Şifreyi Onayla",
          updatePassword: "Şifreyi güncelle",
          strengthPrefix: "Güç:",
          passwordStrength: { empty: "Boş", weak: "Zayıf", fair: "Orta", good: "İyi", strong: "Güçlü" },
          twoFactor: { title: "İki Faktörlü Doğrulama", description: "Hassas hesap işlemleri için doğrulama kodu kullanın.", enabled: "Etkin", disabled: "Devre Dışı", newCodes: "Yeni Kurtarma Kodları", disable: "2FA'yı Devre Dışı Bırak", enable: "2FA'yı Etkinleştir" },
          twoFactorDialog: { title: "İki Faktörlü Doğrulamayı Etkinleştir", description: "Kimlik doğrulama uygulamanızı açın, QR kodunu tarayın ve 6 haneli kodu girin.", qrPlaceholder: "QR kodu üretimde burada görünecek", showCode: "Demo kodunu göster", hideCode: "Kodu gizle", demoLabel: "Demo kodu", codeLabel: "Doğrulama Kodu", codePlaceholder: "6 haneli kodu girin", cancel: "İptal", verify: "Doğrula ve Etkinleştir" },
          recoveryCodes: { title: "Kurtarma Kodları", copyAll: "Tümünü kopyala", description: "Bu kodları güvenli bir yerde saklayın. Her kod yalnızca bir kez kullanılabilir." },
          sessions: { title: "Aktif Oturumlar", description: "Bu hesapta oturum açık olan cihazları inceleyin.", signOutOthers: "Diğerlerini çıkış yap", signOut: "Çıkış yap", current: "mevcut" },
          toast: {
            passwordSaved: "Şifre güncellendi",
            twoFactorEnabled: "İki faktörlü doğrulama etkinleştirildi",
            twoFactorDisabled: "İki faktörlü doğrulama devre dışı bırakıldı",
            codesRegenerated: "Kurtarma kodları yeniden oluşturuldu",
            codesCopied: "Kurtarma kodları kopyalandı",
            sessionSignedOut: "{{device}} oturumu kapatıldı",
            sessionsSignedOut_one: "{{count}} oturum kapatıldı",
            sessionsSignedOut_other: "{{count}} oturum kapatıldı",
            passwordAllFields: "Tüm şifre alanlarını doldurun",
            passwordMismatch: "Yeni şifreler eşleşmiyor",
            passwordWeak: "Daha güçlü bir şifre kullanın",
            passwordSame: "Yeni şifre farklı olmalıdır",
            passwordError: "Şifre güncellenemedi",
            twoFactorWrongCode: "Hatalı doğrulama kodu — uygulamanızı kontrol edin",
            twoFactorSetupError: "2FA kurulumu kaydedilemedi",
            twoFactorDisableError: "2FA durumu kaydedilemedi",
            twoFactorRequired: "Önce 2FA'yı etkinleştirin",
            codesError: "Kurtarma kodları kaydedilemedi",
            clipboardError: "Kopyalanamadı — kodları manuel olarak kopyalayın",
            sessionError: "Oturum kapatılamadı",
            sessionsError: "Oturumlar kapatılamadı",
            noOtherSessions: "Başka oturum yok"
          }
        },
        appearance: {
          title: "Görüntü Ayarları",
          description: "Pano görünümünü özelleştirin",
          themeMode: "Tema Modu",
          themeModeDesc: "Açık, koyu ve sistem temaları arasında geçiş yapın.",
          light: "Açık",
          dark: "Koyu",
          system: "Sistem",
          compactView: "Kompakt Görünüm",
          compactViewDesc: "Tablo ve listelerdeki boşlukları azaltın.",
          language: "Dil",
          languageDesc: "Tercih edilen görüntüleme dilini seçin.",
          resetDisplay: "Görüntüyü sıfırla",
          saveDisplay: "Görüntü ayarlarını kaydet",
          toast: { saved: "Görüntü ayarları kaydedildi", reset: "Görüntü ayarları sıfırlandı", saveError: "Görüntü ayarları kaydedilemedi" }
        },
        resetDialog: { title: "Ayarları Sıfırla", description: "Yerel hesap ayarlarını varsayılan değerlere geri yükler.", cancel: "İptal", confirm: "Ayarları Sıfırla" },
        toast: { exported: "Ayarlar dışa aktarıldı", restored: "Ayarlar varsayılanlara geri yüklendi", restoredLocal: "Yerel ayarlar geri yüklendi" }
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

console.log('Done — chief.settings keys added to all 11 locales.');
