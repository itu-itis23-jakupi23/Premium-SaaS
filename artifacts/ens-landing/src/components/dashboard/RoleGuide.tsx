import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const steps = {
  client: [["client.nav.projects", "/client/projects"], ["client.nav.workspace", "/client/workspace"], ["client.nav.messages", "/client/messages"]],
  pm: [["pm.nav.myClients", "/pm/clients"], ["pm.nav.projects", "/pm/projects"], ["pm.nav.tasks", "/pm/tasks"]],
  chief: [["chief.nav.clients", "/chief/clients"], ["chief.nav.managers", "/chief/managers"], ["chief.nav.projects", "/chief/projects"]],
} as const;

export function RoleGuide({ role }: { role: keyof typeof steps }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const preferenceKey = `ens-role-guide:v1:${user?.id ?? "guest"}:${role}`;
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== "collapsed"; } catch { return true; }
  });
  return (
    <details className="mb-5 rounded-xl border bg-card p-4 print:hidden" open={isOpen} onToggle={(event) => {
      const open = event.currentTarget.open;
      setIsOpen(open);
      try { localStorage.setItem(preferenceKey, open ? "expanded" : "collapsed"); } catch { /* Storage is optional. */ }
    }}>
      <summary className="min-h-11 cursor-pointer font-semibold">{t("experience.guide")}</summary>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{t(`experience.${role}Guide`)}</p>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps[role].map(([label, href], index) => (
          <li key={href}><Button asChild variant="outline" className="h-auto min-h-11 w-full justify-start whitespace-normal text-start"><Link href={href}><span className="me-2 text-muted-foreground">{index + 1}.</span>{t(label)}</Link></Button></li>
        ))}
      </ol>
    </details>
  );
}
