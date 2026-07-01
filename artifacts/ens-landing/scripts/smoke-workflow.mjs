const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");

const actors = {
  chief: {
    "x-user-id": "mock-chief",
    "x-user-name": "Owner%20Chief",
    "x-user-email": "owner@ens.test",
    "x-user-role": "chief",
    "x-user-company": "NIKA",
  },
  otherChief: {
    "x-user-id": "mock-other-chief",
    "x-user-name": "Other%20Chief",
    "x-user-email": "other-chief@ens.test",
    "x-user-role": "chief",
    "x-user-company": "Other Agency",
  },
  pm: {
    "x-user-id": "mock-pm",
    "x-user-name": "Project%20Manager",
    "x-user-email": "pm@ens.test",
    "x-user-role": "pm",
    "x-user-company": "NIKA",
  },
  client: {
    "x-user-id": "mock-client",
    "x-user-name": "Client%20Reviewer",
    "x-user-email": "client@ens.test",
    "x-user-role": "client",
    "x-user-company": "NIKA",
  },
};

const results = [];

async function main() {
  await check("health", () => request("/health"));
  await smokeRealAccountOwnership();
  await smokeLoginRateLimit();
  await smokeRealChiefAccount();
  await smokeInvitedPmAccount();

  const baseProject = await check("create smoke base project", () => request("/platform/projects", {
    method: "POST",
    actor: actors.pm,
    body: {
      name: `Smoke Base Project ${Date.now()}`,
      client: "Smoke Base Client",
      system: "Octanorm",
      widthM: 6,
      depthM: 3,
      deadline: "2026-10-01",
      exhibition: "Smoke Base Expo",
      managerId: "pm-project-manager",
    },
  }));
  const baseProjectId = baseProject.project.id;
  assert(baseProjectId, "base project should have an id");

  await check("chief assigns demo project to pm", () => request("/platform/managers/assignments", {
    method: "PUT",
    actor: actors.chief,
    body: {
      clientAssignments: [],
      projectAssignments: [{ projectId: baseProjectId, managerId: "pm-project-manager" }],
      cascadeClientProjects: false,
    },
  }));

  await check("block cross-company chief assignment", () => request("/platform/managers/assignments", {
    method: "PUT",
    actor: actors.otherChief,
    body: {
      clientAssignments: [],
      projectAssignments: [{ projectId: baseProjectId, managerId: "pm-cross-company" }],
      cascadeClientProjects: false,
    },
  }));
  const assignmentAfterCrossCompanyAttempt = await request("/platform/managers/assignment-items", { actor: actors.chief });
  assert(
    assignmentAfterCrossCompanyAttempt.projects.some((project) => project.id === baseProjectId && project.managerId === "pm-project-manager"),
    "cross-company chief should not change project manager",
  );

  await check("block pm assignment item pool", async () => {
    const response = await rawRequest("/platform/managers/assignment-items", { actor: actors.pm });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const workspace = await check("load workspace", () => request(`/platform/projects/${baseProjectId}/workspace`, { actor: actors.pm }));
  assert(workspace.project.id === baseProjectId, "workspace should load smoke base project");

  await check("block client workspace save", async () => {
    const response = await rawRequest(`/platform/projects/${baseProjectId}/workspace`, {
      method: "PUT",
      actor: actors.client,
      body: { title: "client should not save" },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  await check("pm can save workspace", () => request(`/platform/projects/${baseProjectId}/workspace`, {
    method: "PUT",
    actor: actors.pm,
    body: { title: `Smoke PM save ${new Date().toISOString()}` },
  }));

  await check("validate malformed workspace", async () => {
    const response = await rawRequest(`/platform/projects/${baseProjectId}/workspace`, {
      method: "PUT",
      actor: actors.pm,
      body: {
        workspace: {
          booth: {
            width: 0,
            depth: 3,
            height: 3,
            system: "invalid",
            companyName: "Broken Booth",
            openFront: true,
            openBack: false,
            openLeft: false,
            openRight: false,
          },
          themeIdx: 0,
          carpetIdx: 0,
          placedItems: [],
          notes: [],
        },
      },
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
  });

  await check("block pm client revision", async () => {
    const response = await rawRequest(`/platform/projects/${baseProjectId}/change-requests`, {
      method: "POST",
      actor: actors.pm,
      body: { changeText: "PM should not submit client revision" },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  await check("validate empty client revision", async () => {
    const response = await rawRequest(`/platform/projects/${baseProjectId}/change-requests`, {
      method: "POST",
      actor: actors.client,
      body: { changeText: "" },
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
  });

  const monitor = await check("chief workspace monitor", () => request("/platform/workspaces/monitor", { actor: actors.chief }));
  assert(Array.isArray(monitor.projects) && monitor.projects.length > 0, "monitor should return projects");

  await check("block pm workspace monitor", async () => {
    const response = await rawRequest("/platform/workspaces/monitor", { actor: actors.pm });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const readiness = await check("system readiness reports config", () => request("/platform/system/readiness", { actor: actors.chief }));
  assert(typeof readiness.ready === "boolean", "readiness should include ready boolean");
  assert(readiness.checks && typeof readiness.checks === "object", "readiness should include checks");

  const createdProject = await check("project creates", () => request("/platform/projects", {
    method: "POST",
    actor: actors.pm,
    body: {
      name: `Smoke Project ${Date.now()}`,
      client: "Smoke Client Company",
      system: "Octanorm",
      widthM: 6,
      depthM: 3,
      deadline: "2026-10-01",
    },
  }));
  assert(createdProject.project.id, "created project should have id");

  const updatedProject = await check("project updates", () => request(`/platform/projects/${createdProject.project.id}`, {
    method: "PUT",
    actor: actors.pm,
    body: {
      name: `${createdProject.project.name} Updated`,
      client: "Smoke Client Company",
      managerId: null,
      deadline: "2026-10-05",
      system: "Maxima",
      widthM: 9,
      depthM: 4,
      exhibition: "Smoke Expo",
      description: "Smoke project update",
    },
  }));
  assert(updatedProject.project.system === "Maxima", "project update should persist system");

  const stagedProject = await check("project stage updates", () => request(`/platform/projects/${createdProject.project.id}/pipeline-stage`, {
    method: "PUT",
    actor: actors.pm,
    body: { stage: "review" },
  }));
  assert(stagedProject.project.id === createdProject.project.id, "stage update should target created project");

  await check("client blocked from project create", async () => {
    const response = await rawRequest("/platform/projects", {
      method: "POST",
      actor: actors.client,
      body: { name: "Bad", client: "Bad", system: "Octanorm", widthM: 6, depthM: 3, deadline: null },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const createdClient = await check("client creates", () => request("/platform/clients", {
    method: "POST",
    actor: actors.pm,
    body: {
      name: "Smoke Contact",
      company: `Smoke Client ${Date.now()}`,
      email: `client.${Date.now()}@example.com`,
      exhibition: "Smoke Expo",
    },
  }));
  assert(createdClient.clients[0].id, "created client should be first in response");
  const createdClientId = createdClient.clients[0].id;

  const updatedClient = await check("client updates", () => request(`/platform/clients/${createdClientId}`, {
    method: "PUT",
    actor: actors.pm,
    body: {
      name: "Smoke Contact Updated",
      company: createdClient.clients[0].company,
      email: createdClient.clients[0].contactEmail,
      exhibition: "Smoke Expo Updated",
    },
  }));
  assert(updatedClient.clients.some((client) => client.id === createdClientId && client.exhibition === "Smoke Expo Updated"), "client update should persist");

  const statusClient = await check("client status updates", () => request(`/platform/clients/${createdClientId}/status`, {
    method: "PUT",
    actor: actors.pm,
    body: { status: "Active" },
  }));
  assert(statusClient.clients.some((client) => client.id === createdClientId && client.status === "Active"), "client status should persist");

  const deletedClient = await check("client archives", () => request(`/platform/clients/${createdClientId}`, {
    method: "DELETE",
    actor: actors.chief,
  }));
  assert(!deletedClient.clients.some((client) => client.id === createdClientId), "deleted client should be removed");

  const taskBoard = await check("task board loads", () => request("/platform/tasks", { actor: actors.pm }));
  assert(Array.isArray(taskBoard.tasks) && Array.isArray(taskBoard.projects), "task board should include tasks and projects");

  const createdTask = await check("task creates", () => request("/platform/tasks", {
    method: "POST",
    actor: actors.pm,
    body: {
      title: "Smoke task",
      projectId: baseProjectId,
      priority: "High",
      deadline: "2026-10-08",
      status: "todo",
      notes: "Smoke notes",
    },
  }));
  const task = createdTask.tasks.find((item) => item.title === "Smoke task");
  assert(task?.id, "created task should be present");

  const updatedTask = await check("task updates", () => request(`/platform/tasks/${task.id}`, {
    method: "PATCH",
    actor: actors.pm,
    body: { status: "done", notes: "Completed" },
  }));
  assert(updatedTask.tasks.some((item) => item.id === task.id && item.col === "done"), "task status should update");

  const deletedTask = await check("task deletes", () => request(`/platform/tasks/${task.id}`, {
    method: "DELETE",
    actor: actors.pm,
  }));
  assert(!deletedTask.tasks.some((item) => item.id === task.id), "deleted task should be removed");

  const requests = await check("pm requests load", () => request("/platform/requests?limit=10", { actor: actors.pm }));
  assert(Array.isArray(requests.requests), "requests should be an array");
  if (requests.requests[0]) {
    const updatedRequests = await check("pm request status updates", () => request(`/platform/requests/${requests.requests[0].id}/status?limit=10`, {
      method: "PATCH",
      actor: actors.pm,
      body: { status: "Resolved" },
    }));
    assert(updatedRequests.requests.some((item) => item.id === requests.requests[0].id && item.status === "Resolved"), "request status should update");

    const repliedRequests = await check("pm request reply creates", () => request(`/platform/requests/${requests.requests[0].id}/replies?limit=10`, {
      method: "POST",
      actor: actors.pm,
      body: { body: "Smoke reply" },
    }));
    assert(repliedRequests.requests.some((item) => item.id === requests.requests[0].id && item.comments.some((comment) => comment.text === "Smoke reply")), "request reply should persist");
  }

  await check("subscription request fails gracefully", async () => {
    const response = await rawRequest(`/platform/projects/${baseProjectId}/workspace/subscription-request`, {
      method: "POST",
      actor: actors.pm,
      body: { plan: "unlimited" },
    });
    assert(response.status === 503, `expected 503, got ${response.status}`);
    const body = await response.json();
    assert(body.code === "billing_not_configured", "subscription response should explain billing state");
  });

  const deletedProject = await check("project deletes", () => request(`/platform/projects/${createdProject.project.id}`, {
    method: "DELETE",
    actor: actors.chief,
  }));
  assert(!deletedProject.projects.some((project) => project.id === createdProject.project.id), "deleted project should be removed");

  const chiefReport = await check("chief report loads", () => request("/platform/reports/chief?range=6M", { actor: actors.chief }));
  assert(chiefReport.range === "6M", "chief report should keep requested range");
  assert(Array.isArray(chiefReport.revenueData), "chief report should include revenue data");

  const pmReport = await check("pm report loads", () => request("/platform/reports/pm?period=this_month", { actor: actors.pm }));
  assert(pmReport.period === "this_month", "pm report should keep requested period");
  assert(Array.isArray(pmReport.weeklyData), "pm report should include activity data");

  const notifications = await check("notification center loads", () => request("/platform/notifications", { actor: actors.pm }));
  assert(Array.isArray(notifications.notifications), "notifications should be an array");
  if (notifications.notifications[0]) {
    const readOne = await check("notification read persists", () => request(`/platform/notifications/${notifications.notifications[0].id}/read`, {
      method: "PATCH",
      actor: actors.pm,
      body: {},
    }));
    assert(readOne.notifications.some((notification) => notification.id === notifications.notifications[0].id && notification.read), "notification should be marked read");
  }

  const exportAudit = await check("report export audit creates notification", () => request("/platform/reports/export-audit", {
    method: "POST",
    actor: actors.chief,
    body: { report: "Chief performance", range: "6M", format: "pdf" },
  }));
  assert(exportAudit.ok === true, "report export audit should succeed");

  const calendar = await check("calendar loads", () => request("/platform/calendar", { actor: actors.pm }));
  assert(Array.isArray(calendar.events), "calendar should return events");

  const createdEvent = await check("calendar event creates", () => request("/platform/calendar/events", {
    method: "POST",
    actor: actors.pm,
    body: {
      name: "Smoke Exhibit",
      client: "Smoke Client",
      pm: "Project Manager",
      status: "Planning",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      location: "Istanbul",
      standType: "Octanorm",
    },
  }));
  assert(createdEvent.event.id, "created calendar event should have an id");

  const otherChiefCalendar = await check("block cross-company calendar event visibility", () => request("/platform/calendar", { actor: actors.otherChief }));
  assert(!otherChiefCalendar.events.some((event) => event.id === createdEvent.event.id), "other company chief should not see NIKA calendar event");

  const updatedEvent = await check("calendar event updates", () => request(`/platform/calendar/events/${createdEvent.event.id}`, {
    method: "PUT",
    actor: actors.pm,
    body: {
      ...createdEvent.event,
      name: "Smoke Exhibit Updated",
    },
  }));
  assert(updatedEvent.event.name === "Smoke Exhibit Updated", "calendar event should update");

  const deletedEvent = await check("calendar event deletes", () => request(`/platform/calendar/events/${createdEvent.event.id}`, {
    method: "DELETE",
    actor: actors.pm,
  }));
  assert(deletedEvent.ok === true, "calendar event delete should succeed");

  await check("block client to chief direct message", async () => {
    const response = await rawRequest("/platform/messages/mock-chief", {
      method: "POST",
      actor: actors.client,
      body: { body: "client should not reach chief directly" },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const linkedMessageClient = await check("link base project to message client", () => request(`/platform/projects/${baseProjectId}/client-access`, {
    method: "PUT",
    actor: actors.pm,
    body: { email: "client@ens.test", name: "Client Reviewer" },
  }));
  const messageClientId = linkedMessageClient.client.id;
  assert(messageClientId, "linked message client should have an id");

  const messageText = `Smoke project message ${Date.now()}`;
  const uploadedAttachment = await check("pm uploads message attachment", () => uploadAttachment({
    actor: actors.pm,
    name: "smoke-spec.txt",
    type: "text/plain",
    content: `Smoke attachment ${Date.now()}`,
  }));
  assert(uploadedAttachment.attachment.id, "uploaded attachment should have an id");

  const sent = await check("pm sends project-scoped message", () => request(`/platform/messages/${messageClientId}`, {
    method: "POST",
    actor: actors.pm,
    body: { body: messageText, context: { projectId: baseProjectId }, attachments: [uploadedAttachment.attachment] },
  }));
  assert(sent.message.conversationId.endsWith(`:${baseProjectId}`), "message should be scoped to the base project");
  assert(sent.message.attachments.some((attachment) => attachment.id === uploadedAttachment.attachment.id), "message should include uploaded attachment");

  await check("block message scoped to wrong project client", async () => {
    const response = await rawRequest(`/platform/messages/${messageClientId}`, {
      method: "POST",
      actor: actors.pm,
      body: { body: "wrong project scope should fail", context: { projectId: createdProject.project.id } },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const baseConversation = await check("read base project conversation", () => request(`/platform/messages/${messageClientId}?projectId=${encodeURIComponent(baseProjectId)}`, { actor: actors.pm }));
  assert(baseConversation.messages.some((message) => message.text === messageText), "base project conversation should include smoke message");

  const clientConversation = await check("client reads project message attachment", () => request(`/platform/messages/mock-pm?projectId=${encodeURIComponent(baseProjectId)}`, { actor: actors.client }));
  assert(clientConversation.messages.some((message) => message.attachments?.some((attachment) => attachment.id === uploadedAttachment.attachment.id)), "client should see PM attachment");

  await check("client downloads project attachment", async () => {
    const response = await rawRequest(`/platform/messages/attachments/${uploadedAttachment.attachment.id}`, { actor: actors.client });
    assert(response.status === 200, `expected 200, got ${response.status}`);
    assert((await response.text()).startsWith("Smoke attachment"), "downloaded attachment should match uploaded content");
  });

  await check("chief cannot download private project attachment", async () => {
    const response = await rawRequest(`/platform/messages/attachments/${uploadedAttachment.attachment.id}`, { actor: actors.chief });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const clientAttachment = await check("client uploads message attachment", () => uploadAttachment({
    actor: actors.client,
    name: "client-revision-note.txt",
    type: "text/plain",
    content: `Client attachment ${Date.now()}`,
  }));
  const clientSent = await check("client sends project attachment to pm", () => request("/platform/messages/mock-pm", {
    method: "POST",
    actor: actors.client,
    body: { body: "Client document attached", context: { projectId: baseProjectId }, attachments: [clientAttachment.attachment] },
  }));
  assert(clientSent.message.attachments.some((attachment) => attachment.id === clientAttachment.attachment.id), "client message should include uploaded attachment");

  const pmConversationAfterClientAttachment = await check("pm reads client project attachment", () => request(`/platform/messages/${messageClientId}?projectId=${encodeURIComponent(baseProjectId)}`, { actor: actors.pm }));
  assert(pmConversationAfterClientAttachment.messages.some((message) => message.attachments?.some((attachment) => attachment.id === clientAttachment.attachment.id)), "PM should see client attachment");

  await check("pm downloads client project attachment", async () => {
    const response = await rawRequest(`/platform/messages/attachments/${clientAttachment.attachment.id}`, { actor: actors.pm });
    assert(response.status === 200, `expected 200, got ${response.status}`);
    assert((await response.text()).startsWith("Client attachment"), "downloaded client attachment should match uploaded content");
  });

  await check("block unknown project conversation", async () => {
    const response = await rawRequest(`/platform/messages/${messageClientId}?projectId=p2`, { actor: actors.pm });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const failed = results.filter((result) => result.status === "failed");
  for (const result of results) {
    console.log(`${result.status === "passed" ? "PASS" : "FAIL"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  if (failed.length) {
    process.exitCode = 1;
    return;
  }
  console.log(`Workflow smoke passed: ${results.length} checks`);
}

async function smokeRealAccountOwnership() {
  const email = `smoke.${Date.now()}@example.com`;
  const password = "SmokePass2026";
  const jar = {};
  const signup = await check("real account signup", () => request("/auth/signup", {
    method: "POST",
    jar,
    body: {
      name: "Smoke Client",
      company: "Smoke Test Company",
      exhibition: "Smoke Expo 2026",
      boothWidthM: 6,
      boothDepthM: 3,
      preferredSystem: "Octanorm",
      venueCity: "Istanbul",
      targetDate: "2026-09-01",
      intakeNotes: "Smoke workflow registration intake.",
      email,
      password,
      organizationSlug: "ens-demo-agency",
    },
  }));
  assert(signup.user.email === email, "signup should return the created account");
  assert(signup.user.role === "client", "public signup should create a client account");

  const me = await check("real account session me", () => request("/auth/me", { jar }));
  assert(me.user.email === email, "me should return the signed-in account");

  await check("real account logout", () => rawRequest("/auth/logout", { method: "POST", jar }));
  await check("logged out me rejected", async () => {
    const response = await rawRequest("/auth/me", { jar });
    assert(response.status === 401, `expected 401, got ${response.status}`);
  });

  const login = await check("real account login", () => request("/auth/login", {
    method: "POST",
    jar,
    body: { email, password, organizationSlug: "ens-demo-agency" },
  }));
  assert(login.user.email === email, "login should return the created account");

  const settings = await check("real account settings load", () => request("/platform/account/settings", { jar }));
  assert(settings.profile.email === email, "settings should return signed-in profile");

  const updatedSettings = await check("real account settings save", () => request("/platform/account/settings", {
    method: "PUT",
    jar,
    body: {
      profile: { phone: "+90 555 010 2026" },
      notifications: { assignments: true, reports: true },
      appearance: { theme: "system", compact: true, language: "en" },
    },
  }));
  assert(updatedSettings.profile.phone === "+90 555 010 2026", "settings should persist profile phone");
  assert(updatedSettings.notifications.reports === true, "settings should persist notification preferences");
  assert(updatedSettings.appearance.compact === true, "settings should persist appearance preferences");

  const sessions = await check("real account sessions list", () => request("/platform/account/sessions", { jar }));
  assert(sessions.sessions.some((session) => session.current), "sessions should include the current browser session");

  await check("real account wrong password rejected", async () => {
    const response = await rawRequest("/platform/account/password", {
      method: "PUT",
      jar,
      body: { currentPassword: "WrongPassword2026", newPassword: "SmokePass2027" },
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  await check("session role beats spoofed header", async () => {
    const response = await rawRequest("/platform/projects/p1/workspace", {
      method: "PUT",
      jar,
      actor: actors.pm,
      body: { title: "spoofed pm header should not pass" },
    });
    assert(response.status === 403 || response.status === 404, `expected 403/404, got ${response.status}`);
  });

  const smokeProject = await check("pm creates project for ownership smoke", () => request("/platform/projects", {
    method: "POST",
    actor: actors.pm,
    body: {
      name: `Smoke Ownership Project ${Date.now()}`,
      client: "Unassigned client",
      system: "Octanorm",
      widthM: 6,
      depthM: 3,
      deadline: "2026-09-01",
      exhibition: "Smoke Expo 2026",
      managerId: "pm-project-manager",
    },
  }));
  assert(smokeProject.project.id, "ownership smoke project should have an id");

  await check("unlinked client cannot read project", async () => {
    const response = await rawRequest(`/platform/projects/${smokeProject.project.id}/workspace`, { jar });
    assert(response.status === 403 || response.status === 404, `expected 403/404, got ${response.status}`);
  });

  await check("pm links client to project", () => request(`/platform/projects/${smokeProject.project.id}/client-access`, {
    method: "PUT",
    actor: actors.pm,
    body: { email, name: "Smoke Client" },
  }));

  const ownedWorkspace = await check("linked client can read project", () => request(`/platform/projects/${smokeProject.project.id}/workspace`, { jar }));
  assert(ownedWorkspace.project.id === smokeProject.project.id, "linked client should read assigned project");
}

async function smokeRealChiefAccount() {
  const email = `smoke.chief.${Date.now()}@example.com`;
  const password = "ChiefSmokePass2026";
  const jar = {};
  const signup = await check("real chief bootstrap", () => request("/auth/bootstrap-chief", {
    method: "POST",
    jar,
    body: {
      name: "Smoke Chief",
      company: "Smoke Test Agency",
      email,
      password,
      organizationSlug: "ens-demo-agency",
    },
  }));
  assert(signup.user.email === email, "chief bootstrap should return created chief email");
  assert(signup.user.role === "chief", "chief bootstrap should create chief role");

  await check("real chief logout", () => rawRequest("/auth/logout", { method: "POST", jar }));
  const login = await check("real chief login", () => request("/auth/login", {
    method: "POST",
    jar,
    body: { email, password, organizationSlug: "ens-demo-agency" },
  }));
  assert(login.user.email === email, "chief login should return created chief account");
  assert(login.user.role === "chief", "chief login should keep chief role");
}

async function smokeLoginRateLimit() {
  const email = `locked.${Date.now()}@example.com`;
  for (let i = 0; i < 5; i += 1) {
    const response = await rawRequest("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPassword2026", organizationSlug: "ens-demo-agency" },
    });
    assert(response.status === 401, `expected failed login 401, got ${response.status}`);
  }
  await check("login rate limit locks bad attempts", async () => {
    const response = await rawRequest("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPassword2026", organizationSlug: "ens-demo-agency" },
    });
    assert(response.status === 429, `expected 429, got ${response.status}`);
  });
}

async function smokeInvitedPmAccount() {
  const email = `smoke.pm.${Date.now()}@example.com`;
  const password = "PmSmokePass2026";
  const jar = {};
  const invite = await check("chief invites real pm", () => request("/platform/managers/invitations", {
    method: "POST",
    actor: actors.chief,
    body: {
      name: "Smoke PM",
      email,
    },
  }));
  assert(invite.invitation.email === email, "invitation should use PM email");
  assert(invite.invitation.token, "invitation should expose token for local/dev acceptance");
  assert(["pending", "sent", "failed"].includes(invite.invitation.emailStatus), "invitation should expose email delivery status");

  await check("block pm invite resend", async () => {
    const response = await rawRequest(`/platform/managers/invitations/${invite.invitation.id}/resend`, {
      method: "POST",
      actor: actors.pm,
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  await check("block pm invite revoke", async () => {
    const response = await rawRequest(`/platform/managers/invitations/${invite.invitation.id}`, {
      method: "DELETE",
      actor: actors.pm,
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  const validation = await check("pm invite validates", () => request(`/platform/managers/invitations/validate?token=${encodeURIComponent(invite.invitation.token)}`));
  assert(validation.email === email, "invitation validation should return invited email");

  await check("pm accepts invite into auth account", () => request("/platform/managers/invitations/accept", {
    method: "POST",
    body: {
      token: invite.invitation.token,
      name: "Smoke PM",
      password,
    },
  }));

  const login = await check("invited pm can login", () => request("/auth/login", {
    method: "POST",
    jar,
    body: { email, password, organizationSlug: "ens-demo-agency" },
  }));
  assert(login.user.email === email, "PM login should return invited PM email");
  assert(login.user.role === "pm", "invited account should have PM role");
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
    ...(options.actor ?? {}),
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

async function uploadAttachment({ actor, name, type, content }) {
  const response = await rawRequest("/platform/messages/attachments", {
    method: "POST",
    actor,
    headers: {
      "content-type": type,
      "x-file-name": encodeURIComponent(name),
    },
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
    console.log(`${result.status === "passed" ? "PASS" : "FAIL"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  process.exit(1);
});
