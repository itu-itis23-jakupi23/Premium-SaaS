import { useCallback, useEffect, useState } from "react";

/**
 * Account administration.
 *
 * NOT ENABLED BY DEFAULT. The API behind this is gated on
 * ADMIN_SURFACE_ENABLED, which is set nowhere, and every endpoint answers 404
 * with the flag off. There is deliberately no navigation entry anywhere in the
 * app that points here - the page is reachable only by typing the URL, and
 * without the flag it renders an "unavailable" notice and nothing else.
 *
 * It is intentionally plain: no portal shell, no chrome. Anything more would
 * mean wiring it into a layout that has a sidebar, which is exactly the thing
 * that must not happen while the decision to enable this is still open.
 */

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  membershipStatus: string;
  disabledAt: string | null;
}

const ROLES = ["chief", "pm", "client"];
const STATUSES = ["active", "suspended", "revoked"];

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [state, setState] = useState<"loading" | "off" | "denied" | "ready" | "error">("loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const { status, body } = await call("/admin/members");
    if (status === 404) { setState("off"); return; }
    if (status === 401 || status === 403) { setState("denied"); return; }
    if (status !== 200) { setState("error"); setNote(body?.error?.message ?? "Could not load members."); return; }
    setMembers(body.members as Member[]);
    setState("ready");
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function mutate(userId: string, path: string, payload: unknown, what: string) {
    setBusy(userId + path);
    const { status, body } = await call(`/admin/members/${userId}${path}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setBusy("");
    setNote(status === 200 ? `${what} updated.` : (body?.error?.message ?? `Could not update ${what}.`));
    if (status === 200) await load();
  }

  if (state === "loading") return <main style={wrap}><p>Loading…</p></main>;
  if (state === "off") {
    return (
      <main style={wrap}>
        <h1 style={h1}>Account administration</h1>
        <p style={muted}>
          This surface is not enabled. It is gated on <code>ADMIN_SURFACE_ENABLED</code>,
          which is not set in this environment.
        </p>
      </main>
    );
  }
  if (state === "denied") {
    return (
      <main style={wrap}>
        <h1 style={h1}>Account administration</h1>
        <p style={muted}>You do not have permission to view this page.</p>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1 style={h1}>Account administration</h1>
      <p style={muted}>
        Role changes, account disabling and membership suspension. Every action here
        is recorded against your account.
      </p>
      {note && <p role="status" style={{ ...muted, color: "#1d4ed8" }}>{note}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              {["Person", "Role", "Account", "Membership"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.userId}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={muted}>{m.email}</div>
                </td>
                <td style={td}>
                  {["admin", "owner"].includes(m.role) ? (
                    <span style={muted}>{m.role} (not changeable here)</span>
                  ) : (
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      disabled={busy === m.userId + "/role"}
                      onChange={(e) => void mutate(m.userId, "/role", { role: e.target.value }, "Role")}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td style={td}>
                  <button
                    aria-label={`${m.disabledAt ? "Enable" : "Disable"} the account for ${m.email}`}
                    disabled={busy === m.userId + "/disabled"}
                    onClick={() => void mutate(m.userId, "/disabled", { disabled: !m.disabledAt }, "Account")}
                  >
                    {m.disabledAt ? "Enable" : "Disable"}
                  </button>
                </td>
                <td style={td}>
                  <select
                    aria-label={`Membership status for ${m.email}`}
                    value={m.membershipStatus}
                    disabled={busy === m.userId + "/membership"}
                    onChange={(e) => void mutate(m.userId, "/membership", { status: e.target.value }, "Membership")}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: 32, fontFamily: "system-ui, sans-serif" };
const h1: React.CSSProperties = { fontSize: 22, marginBottom: 8 };
const muted: React.CSSProperties = { fontSize: 13, color: "#626b76", margin: "4px 0" };
const th: React.CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "#626b76", borderBottom: "1px solid #d8dde2", padding: "8px 10px" };
const td: React.CSSProperties = { borderBottom: "1px solid #eef1f4", padding: "10px", verticalAlign: "top", fontSize: 14 };
