import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "owner",
  "chief",
  "pm",
  "client",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "lead",
  "pending_approval",
  "active",
  "inactive",
  "archived",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "planning",
  "in_design",
  "client_review",
  "revision",
  "approved",
  "delayed",
  "in_production",
  "completed",
  "cancelled",
  "archived",
]);

export const projectHealthEnum = pgEnum("project_health", [
  "on_track",
  "at_risk",
  "blocked",
  "delayed",
]);

export const boothSystemEnum = pgEnum("booth_system", [
  "octanorm",
  "maxima",
  "custom",
]);

export const boothTypeEnum = pgEnum("booth_type", [
  "inline",
  "corner",
  "peninsula",
  "island",
]);

export const boothVersionStatusEnum = pgEnum("booth_version_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "revision_requested",
  "locked",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "revision_requested",
  "cancelled",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "contract",
  "proposal",
  "invoice",
  "render",
  "asset",
  "export",
  "other",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "unpaid",
  "incomplete",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const fileVisibilityEnum = pgEnum("file_visibility", [
  "internal",
  "client_visible",
  "public_link",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    website: varchar("website", { length: 255 }),
    logoUrl: text("logo_url"),
    brandColor: varchar("brand_color", { length: 32 }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Europe/Istanbul"),
    plan: varchar("plan", { length: 40 }).notNull().default("starter"),
    seatLimit: integer("seat_limit").notNull().default(5),
    activeProjectLimit: integer("active_project_limit").notNull().default(10),
    storageLimitMb: integer("storage_limit_mb").notNull().default(10_240),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    role: userRoleEnum("role").notNull().default("client"),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    pmCapacityLimit: integer("pm_capacity_limit"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.organizationId, table.userId] }),
    orgRoleIdx: index("memberships_org_role_idx").on(table.organizationId, table.role),
    userIdx: index("memberships_user_idx").on(table.userId),
  }),
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgEmailIdx: index("invitations_org_email_idx").on(table.organizationId, table.email),
    tokenIdx: uniqueIndex("invitations_token_hash_idx").on(table.tokenHash),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 80 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_refresh_token_hash_idx").on(table.refreshTokenHash),
    userActiveIdx: index("sessions_user_active_idx").on(table.userId, table.revokedAt),
  }),
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
    tokenLookupIdx: index("idx_prt_token_hash").on(table.tokenHash),
    userIdx: index("idx_prt_user_id").on(table.userId),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: varchar("company_name", { length: 180 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    status: clientStatusEnum("status").notNull().default("lead"),
    assignedPmUserId: uuid("assigned_pm_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    billingCustomerId: varchar("billing_customer_id", { length: 120 }),
    workspaceEditorSubscriptionActive: boolean("workspace_editor_subscription_active").notNull().default(false),
    workspaceEditorSubscriptionPlan: varchar("workspace_editor_subscription_plan", { length: 40 }),
    workspaceEditorSubscriptionStatus: varchar("workspace_editor_subscription_status", { length: 40 }).notNull().default("inactive"),
    workspaceEditorExtraRevisionRounds: integer("workspace_editor_extra_revision_rounds").notNull().default(0),
    workspaceEditorSubscriptionReference: varchar("workspace_editor_subscription_reference", { length: 120 }),
    workspaceEditorSubscriptionUpdatedAt: timestamp("workspace_editor_subscription_updated_at", { withTimezone: true }),
    intakeExhibitionName: varchar("intake_exhibition_name", { length: 180 }),
    intakeBoothSizeSqm: numeric("intake_booth_size_sqm", { precision: 8, scale: 2 }),
    intakeCity: varchar("intake_city", { length: 120 }),
    intakeDeadlineAt: timestamp("intake_deadline_at", { withTimezone: true }),
    intakePreferredSystem: boothSystemEnum("intake_preferred_system"),
    intakeNotes: text("intake_notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgCompanyIdx: index("clients_org_company_idx").on(table.organizationId, table.companyName),
    orgEmailIdx: index("clients_org_email_idx").on(table.organizationId, table.contactEmail),
    // Partial unique index: within one org, no two active clients may share a contact_email.
    // Uses lower() expression and WHERE deleted_at IS NULL — defined in migration 0009.
    orgEmailUniqueIdx: uniqueIndex("clients_org_email_unique")
      .on(table.organizationId, sql`lower(${table.contactEmail})`)
      .where(sql`${table.deletedAt} IS NULL`),
    assignedPmIdx: index("clients_assigned_pm_idx").on(table.assignedPmUserId),
    orgAssignedPmUpdatedIdx: index("clients_org_assigned_pm_updated_idx").on(table.organizationId, table.assignedPmUserId, table.updatedAt),
    orgStatusUpdatedIdx: index("clients_org_status_updated_idx").on(table.organizationId, table.status, table.updatedAt),
    orgUpdatedIdx: index("clients_org_updated_idx").on(table.organizationId, table.updatedAt),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    assignedPmUserId: uuid("assigned_pm_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 180 }).notNull(),
    exhibitionName: varchar("exhibition_name", { length: 180 }),
    venue: varchar("venue", { length: 180 }),
    city: varchar("city", { length: 120 }),
    country: varchar("country", { length: 120 }),
    status: projectStatusEnum("status").notNull().default("planning"),
    health: projectHealthEnum("health").notNull().default("on_track"),
    budgetCents: integer("budget_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgStatusIdx: index("projects_org_status_idx").on(table.organizationId, table.status),
    orgStatusUpdatedIdx: index("projects_org_status_updated_idx").on(table.organizationId, table.status, table.updatedAt),
    orgUpdatedIdx: index("projects_org_updated_idx").on(table.organizationId, table.updatedAt),
    orgHealthUpdatedIdx: index("projects_org_health_updated_idx").on(table.organizationId, table.health, table.updatedAt),
    clientIdx: index("projects_client_idx").on(table.clientId),
    pmIdx: index("projects_pm_idx").on(table.assignedPmUserId),
    orgPmUpdatedIdx: index("projects_org_pm_updated_idx").on(table.organizationId, table.assignedPmUserId, table.updatedAt),
    orgPmDeadlineIdx: index("projects_org_pm_deadline_idx").on(table.organizationId, table.assignedPmUserId, table.deadlineAt),
    deadlineIdx: index("projects_deadline_idx").on(table.deadlineAt),
  }),
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
    userIdx: index("project_members_user_idx").on(table.userId),
    userProjectIdx: index("project_members_user_project_idx").on(table.userId, table.projectId),
    projectRoleIdx: index("project_members_project_role_idx").on(table.projectId, table.role),
  }),
);

export const assignmentTargetEnum = pgEnum("assignment_target", [
  "project_pm",
  "client_pm",
]);

export const projectAssignmentHistory = pgTable(
  "project_assignment_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    targetType: assignmentTargetEnum("target_type").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    previousPmUserId: uuid("previous_pm_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    newPmUserId: uuid("new_pm_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgCreatedIdx: index("project_assignment_history_org_created_idx").on(table.organizationId, table.createdAt),
    projectIdx: index("project_assignment_history_project_idx").on(table.projectId, table.createdAt),
    clientIdx: index("project_assignment_history_client_idx").on(table.clientId, table.createdAt),
  }),
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("milestones_project_idx").on(table.projectId, table.sortOrder),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgStatusIdx: index("tasks_org_status_idx").on(table.organizationId, table.status),
    projectIdx: index("tasks_project_idx").on(table.projectId),
    assigneeIdx: index("tasks_assignee_idx").on(table.assignedToUserId),
    orgAssigneeStatusDueIdx: index("tasks_org_assignee_status_due_idx").on(table.organizationId, table.assignedToUserId, table.status, table.dueAt),
    orgProjectStatusUpdatedIdx: index("tasks_org_project_status_updated_idx").on(table.organizationId, table.projectId, table.status, table.updatedAt),
  }),
);

export const boothDesigns = pgTable(
  "booth_designs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull().default("Main booth design"),
    boothSystem: boothSystemEnum("booth_system").notNull().default("octanorm"),
    boothType: boothTypeEnum("booth_type").notNull().default("inline"),
    widthMm: integer("width_mm").notNull(),
    depthMm: integer("depth_mm").notNull(),
    heightMm: integer("height_mm").notNull(),
    gridSizeMm: integer("grid_size_mm").notNull().default(1000),
    units: varchar("units", { length: 16 }).notNull().default("metric"),
    currentVersionNumber: integer("current_version_number").notNull().default(1),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdx: index("booth_designs_project_idx").on(table.projectId),
    projectUpdatedIdx: index("booth_designs_project_updated_idx").on(table.projectId, table.updatedAt),
    orgIdx: index("booth_designs_org_idx").on(table.organizationId),
  }),
);

export const boothVersions = pgTable(
  "booth_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    designId: uuid("design_id")
      .notNull()
      .references(() => boothDesigns.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: boothVersionStatusEnum("status").notNull().default("draft"),
    title: varchar("title", { length: 180 }).notNull(),
    layoutJson: jsonb("layout_json").$type<Record<string, unknown>>().notNull(),
    snapshotUrl: text("snapshot_url"),
    assetSummary: jsonb("asset_summary").$type<Record<string, unknown>>().notNull().default({}),
    costEstimateCents: integer("cost_estimate_cents").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    designVersionIdx: uniqueIndex("booth_versions_design_version_idx").on(
      table.designId,
      table.versionNumber,
    ),
    orgStatusIdx: index("booth_versions_org_status_idx").on(table.organizationId, table.status),
    projectIdx: index("booth_versions_project_idx").on(table.projectId),
  }),
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    boothVersionId: uuid("booth_version_id")
      .notNull()
      .references(() => boothVersions.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    respondedByUserId: uuid("responded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: approvalStatusEnum("status").notNull().default("requested"),
    message: text("message"),
    responseNote: text("response_note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
  },
  (table) => ({
    orgStatusIdx: index("approvals_org_status_idx").on(table.organizationId, table.status),
    orgStatusRequestedIdx: index("approvals_org_status_requested_idx").on(table.organizationId, table.status, table.requestedAt),
    orgProjectStatusRequestedIdx: index("approvals_org_project_status_requested_idx").on(table.organizationId, table.projectId, table.status, table.requestedAt),
    projectIdx: index("approvals_project_idx").on(table.projectId),
    versionIdx: index("approvals_version_idx").on(table.boothVersionId),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    boothVersionId: uuid("booth_version_id").references(() => boothVersions.id, {
      onDelete: "cascade",
    }),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    parentCommentId: uuid("parent_comment_id"),
    body: text("body").notNull(),
    pin: jsonb("pin").$type<{ x: number; y: number; z?: number; objectId?: string }>(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdx: index("comments_project_idx").on(table.projectId, table.createdAt),
    versionIdx: index("comments_version_idx").on(table.boothVersionId),
    authorIdx: index("comments_author_idx").on(table.authorUserId),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: documentKindEnum("kind").notNull().default("other"),
    visibility: fileVisibilityEnum("visibility").notNull().default("internal"),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageBucket: varchar("storage_bucket", { length: 120 }).notNull(),
    storageKey: text("storage_key").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgKindIdx: index("documents_org_kind_idx").on(table.organizationId, table.kind),
    projectIdx: index("documents_project_idx").on(table.projectId),
    storageIdx: uniqueIndex("documents_storage_idx").on(table.storageBucket, table.storageKey),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
    stripePriceId: varchar("stripe_price_id", { length: 120 }),
    plan: varchar("plan", { length: 40 }).notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    seatsIncluded: integer("seats_included").notNull().default(5),
    activeProjectsIncluded: integer("active_projects_included").notNull().default(10),
    storageIncludedMb: integer("storage_included_mb").notNull().default(10_240),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("subscriptions_org_idx").on(table.organizationId),
    stripeSubscriptionIdx: uniqueIndex("subscriptions_stripe_subscription_idx").on(
      table.stripeSubscriptionId,
    ),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgNumberIdx: uniqueIndex("invoices_org_number_idx").on(
      table.organizationId,
      table.invoiceNumber,
    ),
    orgStatusIdx: index("invoices_org_status_idx").on(table.organizationId, table.status),
  }),
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgCreatedIdx: index("activity_events_org_created_idx").on(table.organizationId, table.createdAt),
    projectIdx: index("activity_events_project_idx").on(table.projectId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.readAt),
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
    orgCreatedIdx: index("notifications_org_created_idx").on(table.organizationId, table.createdAt),
  }),
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  clients: many(clients),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  assignedClients: many(clients),
  assignedProjects: many(projects),
  comments: many(comments),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  assignedPm: one(users, {
    fields: [clients.assignedPmUserId],
    references: [users.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  assignedPm: one(users, {
    fields: [projects.assignedPmUserId],
    references: [users.id],
  }),
  boothDesigns: many(boothDesigns),
  approvals: many(approvals),
  comments: many(comments),
}));

export const boothDesignsRelations = relations(boothDesigns, ({ one, many }) => ({
  project: one(projects, {
    fields: [boothDesigns.projectId],
    references: [projects.id],
  }),
  versions: many(boothVersions),
}));

export const boothVersionsRelations = relations(boothVersions, ({ one, many }) => ({
  design: one(boothDesigns, {
    fields: [boothVersions.designId],
    references: [boothDesigns.id],
  }),
  project: one(projects, {
    fields: [boothVersions.projectId],
    references: [projects.id],
  }),
  approvals: many(approvals),
  comments: many(comments),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  project: one(projects, {
    fields: [approvals.projectId],
    references: [projects.id],
  }),
  boothVersion: one(boothVersions, {
    fields: [approvals.boothVersionId],
    references: [boothVersions.id],
  }),
}));

export const selectOrganizationSchema = createSelectSchema(organizations);
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  deletedAt: true,
});

export const insertBoothVersionSchema = createInsertSchema(boothVersions).omit({
  id: true,
  createdAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type BoothVersion = typeof boothVersions.$inferSelect;
export type NewBoothVersion = typeof boothVersions.$inferInsert;

export const databaseHeartbeat = sql`select 1 as ok`;
