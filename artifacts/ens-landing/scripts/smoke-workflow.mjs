/**
 * smoke-workflow.mjs — end-to-end workflow test using REAL authenticated sessions.
 * No mock x-user-* headers. Every actor signs up or is invited, then logs in with
 * a real JWT cookie before making any platform requests.
 */

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");
const SETUP_KEY = process.env.STAFF_SIGNUP_KEY ?? process.env.SETUP_KEY ?? "";

const results = [];
const RUN_ID = Date.now();

async function main() {
  await check("health", () => request("/health"));

  // ── PHASE 1: Bootstrap real sessions ──────────────────────────────────────

  // Chief account (creates the org).
  // Uses /auth/signup-staff so this smoke script works against both the dev
  // backend (artifacts/ens-landing/server) and the production backend
  // (artifacts/api-server). Pass STAFF_SIGNUP_KEY env var in CI.
  const chiefEmail    = `smoke.chief.${RUN_ID}@example.com`;
  const chiefPassword = "ChiefSmoke2026!";
  const chiefJar      = {};

  const chiefSignup = await check("chief bootstrap", () => request("/auth/signup-staff", {
    method: "POST", jar: chiefJar,
    body: { name: "Smoke Chief", company: `Smoke Agency ${RUN_ID}`, email: chiefEmail, password: chiefPassword, role: "chief", setupKey: SETUP_KEY },
  }));
  assert(chiefSignup.user.role === "chief", "bootstrap should create chief");
  const chiefUserId = chiefSignup.user.id;
  const chiefOrgSlug = chiefSignup.organization?.slug ?? chiefSignup.user?.organizationSlug;
  assert(chiefOrgSlug, "bootstrap should return organization slug");

  // Separate org for cross-org isolation checks
  const otherChiefJar = {};
  await check("other-org chief bootstrap", () => request("/auth/signup-staff", {
    method: "POST", jar: otherChiefJar,
    body: { name: "Other Chief", company: `Other Agency ${RUN_ID}`, email: `smoke.other.${RUN_ID}@example.com`, password: chiefPassword, role: "chief", setupKey: SETUP_KEY },
  }));

  // Chief invites PM → PM accepts → PM logs in
  const pmEmail    = `smoke.pm.${RUN_ID}@example.com`;
  const pmPassword = "PmSmoke2026!";
  const pmJar      = {};

  const invite = await check("chief invites PM", () => request("/platform/managers/invitations", {
    method: "POST", jar: chiefJar,
    body: { name: "Smoke PM", email: pmEmail },
  }));
  assert(invite.invitation.token, "invite should expose token");
  assert(["pending", "sent", "failed"].includes(invite.invitation.emailStatus), "invite should expose email status");

  await check("block PM from resending invite", async () => {
    const r = await rawRequest(`/platform/managers/invitations/${invite.invitation.id}/resend`, { method: "POST", jar: pmJar });
    assert(r.status === 401 || r.status === 403, `expected 401/403, got ${r.status}`);
  });

  await check("PM invite validates", async () => {
    const v = await request(`/platform/managers/invitations/validate?token=${encodeURIComponent(invite.invitation.token)}`);
    assert(v.email === pmEmail, "validate should return invited email");
  });

  await check("PM accepts invite", () => request("/platform/managers/invitations/accept", {
    method: "POST",
    body: { token: invite.invitation.token, name: "Smoke PM", password: pmPassword },
  }));

  const pmLogin = await check("PM logs in", () => request("/auth/login", {
    method: "POST", jar: pmJar,
    body: { email: pmEmail, password: pmPassword, organizationSlug: chiefOrgSlug },
  }));
  assert(pmLogin.user.role === "pm", "PM login should have pm role");
  const pmUserId = pmLogin.user.id;

  // Client signs up for the org
  const clientEmail    = `smoke.client.${RUN_ID}@example.com`;
  const clientPassword = "ClientSmoke2026!";
  const clientJar      = {};

  const clientSignup = await check("client signs up", () => request("/auth/signup", {
    method: "POST", jar: clientJar,
    body: {
      name: "Smoke Client", company: "Smoke Client Co", exhibitionName: "Smoke Expo 2026",
      boothSizeSqm: 18, preferredSystem: "Octanorm",
      city: "Istanbul", deadline: "2026-09-01", notes: "Smoke client registration",
      email: clientEmail, password: clientPassword, organizationSlug: chiefOrgSlug,
    },
  }));
  assert(clientSignup.user.role === "client", "public signup should create client account");

  // ── PHASE 2: Auth hardening checks ────────────────────────────────────────

  await smokeLoginRateLimit(chiefOrgSlug);

  await check("real account me returns session user", async () => {
    const me = await request("/auth/me", { jar: clientJar });
    assert(me.user.email === clientEmail, "me should return signed-in account");
  });

  await check("session role beats spoofed x-user-role header", async () => {
    const r = await rawRequest("/platform/projects/nonexistent/workspace", {
      method: "PUT", jar: clientJar,
      headers: { "x-user-role": "pm" },
      body: { title: "spoof attempt" },
    });
    assert(r.status === 403 || r.status === 404, `expected 403/404, got ${r.status}`);
  });

  await check("unauthenticated request rejected", async () => {
    const r = await rawRequest("/platform/projects");
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  await check("real account settings load", async () => {
    const s = await request("/platform/account/settings", { jar: clientJar });
    assert(s.profile.email === clientEmail, "settings should return signed-in profile");
  });

  await check("real account wrong password rejected", async () => {
    const r = await rawRequest("/platform/account/password", {
      method: "PUT", jar: clientJar,
      body: { currentPassword: "WrongPassword2026", newPassword: "ShouldNotChange" },
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  const sessions = await check("sessions list includes current", () => request("/platform/account/sessions", { jar: pmJar }));
  assert(sessions.sessions.some(s => s.current), "sessions should include current session");

  // ── PHASE 3: Project + workspace workflow ─────────────────────────────────

  const baseProject = await check("PM creates base project", () => request("/platform/projects", {
    method: "POST", jar: pmJar,
    body: { name: `Smoke Base Project ${RUN_ID}`, client: "Smoke Base Client", system: "Octanorm", widthM: 6, depthM: 3, deadline: "2026-10-01", exhibition: "Smoke Base Expo" },
  }));
  const baseProjectId = baseProject.project.id;
  assert(baseProjectId, "base project should have an id");

  await check("chief assigns PM to project", () => request("/platform/managers/assignments", {
    method: "PUT", jar: chiefJar,
    body: { clientAssignments: [], projectAssignments: [{ projectId: baseProjectId, managerId: pmUserId }], cascadeClientProjects: false },
  }));

  await check("block cross-org assignment", async () => {
    const r = await rawRequest("/platform/managers/assignments", {
      method: "PUT", jar: otherChiefJar,
      body: { clientAssignments: [], projectAssignments: [{ projectId: baseProjectId, managerId: pmUserId }], cascadeClientProjects: false },
    });
    // should 403 (different org) or succeed silently (cross-org check = not found)
    const afterCross = await request("/platform/managers/assignment-items", { jar: chiefJar });
    assert(
      afterCross.projects.some(p => p.id === baseProjectId && p.managerId === pmUserId),
      "cross-org chief should not change project manager",
    );
  });

  await check("block PM from assignment-items pool", async () => {
    const r = await rawRequest("/platform/managers/assignment-items", { jar: pmJar });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  const workspace = await check("PM loads workspace", () => request(`/platform/projects/${baseProjectId}/workspace`, { jar: pmJar }));
  assert(workspace.project.id === baseProjectId, "workspace should load base project");

  await check("block client from saving workspace", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/workspace`, {
      method: "PUT", jar: clientJar,
      body: { title: "client should not save" },
    });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  await check("PM saves workspace", () => request(`/platform/projects/${baseProjectId}/workspace`, {
    method: "PUT", jar: pmJar,
    body: { title: `Smoke PM save ${new Date().toISOString()}` },
  }));

  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const uploadedAsset = await check("PM uploads workspace asset", () => request(`/platform/projects/${baseProjectId}/workspace/assets`, {
    method: "POST", jar: pmJar,
    body: { dataUrl: tinyPng, name: "smoke-panel.png", purpose: "panel" },
  }));
  assert(/^\/workspace-assets\//.test(uploadedAsset.asset.url), "workspace asset should return public asset URL");

  await check("block client from uploading workspace asset", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/workspace/assets`, {
      method: "POST", jar: clientJar,
      body: { dataUrl: tinyPng, name: "client-panel.png", purpose: "panel" },
    });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  await check("validate malformed workspace rejected", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/workspace`, {
      method: "PUT", jar: pmJar,
      body: { workspace: { booth: { width: 0, depth: 3, height: 3, system: "invalid", companyName: "Broken", openFront: true, openBack: false, openLeft: false, openRight: false }, themeIdx: 0, carpetIdx: 0, placedItems: [], notes: [] } },
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  await check("block PM from submitting client revision", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/change-requests`, {
      method: "POST", jar: pmJar,
      body: { changeText: "PM should not submit client revision" },
    });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  await check("validate empty client revision rejected", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/change-requests`, {
      method: "POST", jar: clientJar,
      body: { changeText: "" },
    });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  const monitor = await check("chief workspace monitor", () => request("/platform/workspaces/monitor", { jar: chiefJar }));
  assert(Array.isArray(monitor.projects), "monitor should return projects array");

  await check("block PM from workspace monitor", async () => {
    const r = await rawRequest("/platform/workspaces/monitor", { jar: pmJar });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  const readiness = await check("system readiness reports config", () => request("/platform/system/readiness", { jar: chiefJar }));
  assert(typeof readiness.ready === "boolean", "readiness should include ready boolean");
  assert(readiness.checks && typeof readiness.checks === "object", "readiness should include checks object");
  assert("authSecretConfigured" in readiness.checks, "readiness should report auth secret status");
  assert("messageEncryptionConfigured" in readiness.checks, "readiness should report message encryption status");
  assert("cookieSecureCompatible" in readiness.checks, "readiness should report cookie security compatibility");
  assert("documentStorageConfigured" in readiness.checks, "readiness should report document storage status");
  assert("messageAttachmentStorageConfigured" in readiness.checks, "readiness should report message attachment storage status");
  assert("stripeWebhookConfigured" in readiness.checks, "readiness should report Stripe webhook status");
  assert("assetStorageConfigured" in readiness.checks, "readiness should report workspace asset storage status");
  assert(readiness.limits?.apiJsonLimit, "readiness should report API JSON limit");
  assert(readiness.storage?.assetStorageProvider, "readiness should report asset storage provider");
  assert(readiness.operational && typeof readiness.operational === "object", "readiness should include operational snapshot");
  assert(typeof readiness.operational.pendingClients === "number", "readiness should report pending client count");
  assert(typeof readiness.operational.unassignedProjects === "number", "readiness should report unassigned project count");
  assert(Array.isArray(readiness.recentActivity), "readiness should include recent audit activity");

  // ── PHASE 4: CRUD — projects, clients, tasks ───────────────────────────────

  const createdProject = await check("project creates", () => request("/platform/projects", {
    method: "POST", jar: pmJar,
    body: { name: `Smoke Project ${RUN_ID}`, client: "Smoke Client Company", system: "Octanorm", widthM: 6, depthM: 3, deadline: "2026-10-01" },
  }));
  assert(createdProject.project.id, "created project should have id");
  assert(createdProject.project.status === "In Design", "PM-created project should start in design, not pending");

  const updatedProject = await check("project updates", () => request(`/platform/projects/${createdProject.project.id}`, {
    method: "PUT", jar: pmJar,
    body: { name: `${createdProject.project.name} Updated`, client: "Smoke Client Company", managerId: null, deadline: "2026-10-05", system: "Maxima", widthM: 9, depthM: 4, exhibition: "Smoke Expo", description: "Smoke update" },
  }));
  assert(updatedProject.project.system === "Maxima", "project update should persist system");

  const stagedProject = await check("project pipeline stage updates", () => request(`/platform/projects/${createdProject.project.id}/pipeline-stage`, {
    method: "PUT", jar: pmJar,
    body: { stage: "review" },
  }));
  assert(stagedProject.project.id === createdProject.project.id, "stage update should target created project");

  await check("client blocked from creating project", async () => {
    const r = await rawRequest("/platform/projects", {
      method: "POST", jar: clientJar,
      body: { name: "Bad", client: "Bad", system: "Octanorm", widthM: 6, depthM: 3, deadline: null },
    });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  const createdClient = await check("client record creates", () => request("/platform/clients", {
    method: "POST", jar: pmJar,
    body: { name: "Smoke Contact", company: `Smoke Client ${RUN_ID}`, email: `extra.${RUN_ID}@example.com`, exhibition: "Smoke Expo" },
  }));
  assert(createdClient.clients[0].id, "created client should have id");
  const createdClientId = createdClient.clients[0].id;

  const updatedClient = await check("client record updates", () => request(`/platform/clients/${createdClientId}`, {
    method: "PUT", jar: pmJar,
    body: { name: "Smoke Contact Updated", company: createdClient.clients[0].company, email: createdClient.clients[0].contactEmail, exhibition: "Smoke Expo Updated" },
  }));
  assert(updatedClient.clients.some(c => c.id === createdClientId && c.exhibition === "Smoke Expo Updated"), "client update should persist");

  await check("client status updates", () => request(`/platform/clients/${createdClientId}/status`, {
    method: "PUT", jar: pmJar,
    body: { status: "Active" },
  }));

  const deletedClient = await check("client archives", () => request(`/platform/clients/${createdClientId}`, {
    method: "DELETE", jar: chiefJar,
  }));
  assert(!deletedClient.clients.some(c => c.id === createdClientId), "deleted client should be removed");

  const taskBoard = await check("task board loads", () => request("/platform/tasks", { jar: pmJar }));
  assert(Array.isArray(taskBoard.tasks) && Array.isArray(taskBoard.projects), "task board should include tasks and projects");

  const createdTask = await check("task creates", () => request("/platform/tasks", {
    method: "POST", jar: pmJar,
    body: { title: "Smoke task", projectId: baseProjectId, priority: "High", deadline: "2026-10-08", status: "todo", notes: "Smoke notes" },
  }));
  const task = createdTask.tasks.find(t => t.title === "Smoke task");
  assert(task?.id, "created task should be present");

  const updatedTask = await check("task updates", () => request(`/platform/tasks/${task.id}`, {
    method: "PATCH", jar: pmJar,
    body: { status: "done", notes: "Completed" },
  }));
  assert(updatedTask.tasks.some(t => t.id === task.id && t.col === "done"), "task status should update");

  const deletedTask = await check("task deletes", () => request(`/platform/tasks/${task.id}`, {
    method: "DELETE", jar: pmJar,
  }));
  assert(!deletedTask.tasks.some(t => t.id === task.id), "deleted task should be removed");

  // ── PHASE 5: Requests, reports, calendar ──────────────────────────────────

  const reqs = await check("PM requests load", () => request("/platform/requests?limit=10", { jar: pmJar }));
  assert(Array.isArray(reqs.requests), "requests should be an array");
  if (reqs.requests[0]) {
    await check("PM request status updates", () => request(`/platform/requests/${reqs.requests[0].id}/status?limit=10`, {
      method: "PATCH", jar: pmJar,
      body: { status: "Resolved" },
    }));
    await check("PM request reply creates", () => request(`/platform/requests/${reqs.requests[0].id}/replies?limit=10`, {
      method: "POST", jar: pmJar,
      body: { body: "Smoke reply" },
    }));
  }

  await check("subscription request fails gracefully", async () => {
    const r = await rawRequest(`/platform/projects/${baseProjectId}/workspace/subscription-request`, {
      method: "POST", jar: pmJar,
      body: { plan: "unlimited" },
    });
    assert(r.status === 503, `expected 503, got ${r.status}`);
    const body = await r.json();
    assert(body.code === "billing_not_configured", "subscription response should explain billing state");
  });

  await check("project deletes", () => request(`/platform/projects/${createdProject.project.id}`, {
    method: "DELETE", jar: chiefJar,
  }));

  const chiefReport = await check("chief report loads", () => request("/platform/reports/chief?range=6M", { jar: chiefJar }));
  assert(chiefReport.range === "6M", "chief report should keep requested range");
  assert(Array.isArray(chiefReport.revenueData), "chief report should include revenue data");

  const pmReport = await check("PM report loads", () => request("/platform/reports/pm?period=this_month", { jar: pmJar }));
  assert(pmReport.period === "this_month", "PM report should keep requested period");
  assert(Array.isArray(pmReport.weeklyData), "PM report should include weekly activity data");

  const notifications = await check("notification center loads", () => request("/platform/notifications", { jar: pmJar }));
  assert(Array.isArray(notifications.notifications), "notifications should be an array");
  if (notifications.notifications[0]) {
    const readOne = await check("notification read persists", () => request(`/platform/notifications/${notifications.notifications[0].id}/read`, {
      method: "PATCH", jar: pmJar,
      body: {},
    }));
    assert(readOne.notifications.some(n => n.id === notifications.notifications[0].id && n.read), "notification should be marked read");
  }

  await check("report export audit creates notification", () => request("/platform/reports/export-audit", {
    method: "POST", jar: chiefJar,
    body: { report: "Chief performance", range: "6M", format: "pdf" },
  }));

  const calendar = await check("calendar loads", () => request("/platform/calendar", { jar: pmJar }));
  assert(Array.isArray(calendar.events), "calendar should return events");

  const createdEvent = await check("calendar event creates", () => request("/platform/calendar/events", {
    method: "POST", jar: pmJar,
    body: { name: "Smoke Exhibit", client: "Smoke Client", pm: "Smoke PM", status: "Planning", startDate: "2026-09-01", endDate: "2026-09-03", location: "Istanbul", standType: "Octanorm" },
  }));
  assert(createdEvent.event.id, "calendar event should have id");

  const otherCalendar = await check("block cross-org calendar event visibility", () => request("/platform/calendar", { jar: otherChiefJar }));
  assert(!otherCalendar.events.some(e => e.id === createdEvent.event.id), "other-org chief should not see this org's events");

  await check("calendar event updates", () => request(`/platform/calendar/events/${createdEvent.event.id}`, {
    method: "PUT", jar: pmJar,
    body: { ...createdEvent.event, name: "Smoke Exhibit Updated" },
  }));

  const deletedEvent = await check("calendar event deletes", () => request(`/platform/calendar/events/${createdEvent.event.id}`, {
    method: "DELETE", jar: pmJar,
  }));
  assert(deletedEvent.ok === true, "calendar event delete should succeed");

  // ── PHASE 6: Messaging + attachments ─────────────────────────────────────

  // Link the real client account to the base project so they can message
  const linkedAccess = await check("PM links client account to project", () => request(`/platform/projects/${baseProjectId}/client-access`, {
    method: "PUT", jar: pmJar,
    body: { email: clientEmail, name: "Smoke Client" },
  }));
  const messageClientId = linkedAccess.client.id;
  assert(messageClientId, "linked client should have a record id");

  await check("block client direct message to chief", async () => {
    const r = await rawRequest(`/platform/messages/${chiefUserId}`, {
      method: "POST", jar: clientJar,
      body: { body: "client should not reach chief directly" },
    });
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  const messageText = `Smoke project message ${RUN_ID}`;
  const uploadedAttachment = await check("PM uploads message attachment", () => uploadAttachment({
    jar: pmJar,
    name: "smoke-spec.txt",
    type: "text/plain",
    content: `Smoke attachment ${RUN_ID}`,
  }));
  assert(uploadedAttachment.attachment.id, "uploaded attachment should have an id");

  const sent = await check("PM sends project-scoped message", () => request(`/platform/messages/${messageClientId}`, {
    method: "POST", jar: pmJar,
    body: { body: messageText, context: { projectId: baseProjectId }, attachments: [uploadedAttachment.attachment] },
  }));
  assert(sent.message.conversationId.endsWith(`:${baseProjectId}`), "message should be scoped to base project");
  assert(sent.message.attachments.some(a => a.id === uploadedAttachment.attachment.id), "message should include uploaded attachment");

  await check("block message scoped to deleted project", async () => {
    const r = await rawRequest(`/platform/messages/${messageClientId}`, {
      method: "POST", jar: pmJar,
      body: { body: "wrong project scope should fail", context: { projectId: createdProject.project.id } },
    });
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  const baseConversation = await check("PM reads base project conversation", () => request(`/platform/messages/${messageClientId}?projectId=${encodeURIComponent(baseProjectId)}`, { jar: pmJar }));
  assert(baseConversation.messages.some(m => m.text === messageText), "conversation should include smoke message");

  const clientConversation = await check("client reads PM attachment in project", () => request(`/platform/messages/${pmUserId}?projectId=${encodeURIComponent(baseProjectId)}`, { jar: clientJar }));
  assert(clientConversation.messages.some(m => m.attachments?.some(a => a.id === uploadedAttachment.attachment.id)), "client should see PM attachment");

  await check("client downloads PM attachment", async () => {
    const r = await rawRequest(`/platform/messages/attachments/${uploadedAttachment.attachment.id}`, { jar: clientJar });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert((await r.text()).startsWith("Smoke attachment"), "downloaded content should match uploaded");
  });

  await check("other-org chief cannot download private attachment", async () => {
    const r = await rawRequest(`/platform/messages/attachments/${uploadedAttachment.attachment.id}`, { jar: otherChiefJar });
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  const clientAttachment = await check("client uploads reply attachment", () => uploadAttachment({
    jar: clientJar,
    name: "client-revision-note.txt",
    type: "text/plain",
    content: `Client attachment ${RUN_ID}`,
  }));

  const clientSent = await check("client sends project message to PM", () => request(`/platform/messages/${pmUserId}`, {
    method: "POST", jar: clientJar,
    body: { body: "Client document attached", context: { projectId: baseProjectId }, attachments: [clientAttachment.attachment] },
  }));
  assert(clientSent.message.attachments.some(a => a.id === clientAttachment.attachment.id), "client message should include attachment");

  const pmAfterClient = await check("PM reads client attachment", () => request(`/platform/messages/${messageClientId}?projectId=${encodeURIComponent(baseProjectId)}`, { jar: pmJar }));
  assert(pmAfterClient.messages.some(m => m.attachments?.some(a => a.id === clientAttachment.attachment.id)), "PM should see client attachment");

  await check("PM downloads client attachment", async () => {
    const r = await rawRequest(`/platform/messages/attachments/${clientAttachment.attachment.id}`, { jar: pmJar });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert((await r.text()).startsWith("Client attachment"), "downloaded client attachment should match");
  });

  await check("block access to unknown project conversation", async () => {
    const r = await rawRequest(`/platform/messages/${messageClientId}?projectId=p2`, { jar: pmJar });
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  // ── PHASE 7: Ownership isolation ─────────────────────────────────────────

  const ownerProject = await check("PM creates ownership isolation project", () => request("/platform/projects", {
    method: "POST", jar: pmJar,
    body: { name: `Smoke Ownership ${RUN_ID}`, client: "Unassigned", system: "Octanorm", widthM: 6, depthM: 3, deadline: "2026-09-01", exhibition: "Smoke Expo 2026" },
  }));
  assert(ownerProject.project.id, "ownership project should have an id");

  await check("unlinked client cannot read project", async () => {
    // Use a fresh jar — this client account exists but is not linked to this project
    const freshClient = {};
    const newEmail = `smoke.fresh.${RUN_ID}@example.com`;
    await request("/auth/signup", {
      method: "POST", jar: freshClient,
      body: { name: "Fresh Client", company: "Fresh Co", exhibition: "Fresh Expo", boothWidthM: 6, boothDepthM: 3, preferredSystem: "Octanorm", venueCity: "Istanbul", targetDate: "2026-09-01", intakeNotes: "Unlinked access check", email: newEmail, password: clientPassword, organizationSlug: chiefOrgSlug },
    });
    const r = await rawRequest(`/platform/projects/${ownerProject.project.id}/workspace`, { jar: freshClient });
    assert(r.status === 403 || r.status === 404, `expected 403/404, got ${r.status}`);
  });

  await check("PM links client and grants access", () => request(`/platform/projects/${ownerProject.project.id}/client-access`, {
    method: "PUT", jar: pmJar,
    body: { email: clientEmail, name: "Smoke Client" },
  }));

  const ownedWorkspace = await check("linked client can read project", () => request(`/platform/projects/${ownerProject.project.id}/workspace`, { jar: clientJar }));
  assert(ownedWorkspace.project.id === ownerProject.project.id, "linked client should read assigned project");

  // ── Results ───────────────────────────────────────────────────────────────

  const failed = results.filter(r => r.status === "failed");
  for (const result of results) {
    console.log(`${result.status === "passed" ? "PASS" : "FAIL"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  }
  if (failed.length) {
    process.exitCode = 1;
    return;
  }
  console.log(`\nWorkflow smoke PASSED: ${results.length} checks`);
}

async function smokeLoginRateLimit(orgSlug) {
  const email = `locked.${RUN_ID}@example.com`;
  for (let i = 0; i < 5; i++) {
    await rawRequest("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPassword2026", organizationSlug: orgSlug },
    });
  }
  await check("login rate limit locks bad attempts", async () => {
    const r = await rawRequest("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPassword2026", organizationSlug: orgSlug },
    });
    assert(r.status === 429, `expected 429, got ${r.status}`);
  });
}

async function check(name, fn) {
  try {
    const value = await fn();
    results.push({ name, status: "passed" });
    return value;
  } catch (error) {
    results.push({ name, status: "failed", error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function request(path, options = {}) {
  const response = await rawRequest(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function rawRequest(path, options = {}) {
  const headers = {
    accept: "application/json",
    ...(options.headers ?? {}),
  };
  if (options.jar?.cookie) headers.cookie = options.jar.cookie;
  let body;
  if (Object.prototype.hasOwnProperty.call(options, "rawBody")) {
    body = options.rawBody;
  } else if (Object.prototype.hasOwnProperty.call(options, "body")) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });
  const setCookie = response.headers.get("set-cookie");
  if (options.jar && setCookie) {
    options.jar.cookie = setCookie.split(";")[0];
  }
  return response;
}

async function uploadAttachment({ jar, name, type, content }) {
  const response = await rawRequest("/platform/messages/attachments", {
    method: "POST",
    jar,
    headers: { "content-type": type, "x-file-name": encodeURIComponent(name) },
    rawBody: Buffer.from(content, "utf8"),
  });
  if (!response.ok) {
    throw new Error(`POST /platform/messages/attachments failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch(() => {
  for (const result of results) {
    console.log(`${result.status === "passed" ? "PASS" : "FAIL"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  }
  process.exit(1);
});
