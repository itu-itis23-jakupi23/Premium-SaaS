import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isoDate = z.string().regex(ISO_DATE_REGEX, "Must be a valid date (YYYY-MM-DD)");
const uuid = z.string().regex(UUID_REGEX, "Must be a valid UUID");
const boothSystem = z.enum(["octanorm", "maxima", "custom"]);
const pipelineStage = z.enum(["intake", "design", "review", "production", "closed"]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(180),
  client: z.string().min(1, "Client name is required").max(180),
  clientId: uuid.nullable().default(null),
  managerId: uuid.nullable().default(null),
  system: boothSystem.default("octanorm"),
  widthM: z.number({ required_error: "Width is required" }).min(1).max(100),
  depthM: z.number({ required_error: "Depth is required" }).min(1).max(100),
  deadline: isoDate.nullable().default(null),
  exhibition: z.string().max(180).nullable().default(null),
  description: z.string().max(2000).default(""),
});

export const updateProjectSchema = createProjectSchema.extend({
  managerId: z.union([uuid, z.literal("unassigned")]).nullable().optional(),
});

export const pipelineStageSchema = z.object({
  stage: pipelineStage,
});

export const createClientSchema = z.object({
  companyName: z.string().min(1, "Client company name is required").max(180),
  contactName: z.string().min(1).max(160).nullable().default(null),
  contactEmail: z.string().email("Valid contact email is required").max(255).nullable().default(null),
  exhibition: z.string().max(180).nullable().default(null),
});

export const updateClientSchema = z.object({
  companyName: z.string().min(1, "Client company name is required").max(180),
  contactName: z.string().min(1, "Client contact name is required").max(160),
  contactEmail: z.string().email("Valid contact email is required").max(255).nullable().default(null),
  exhibition: z.string().max(180).nullable().default(null),
});

const assignmentRow = z.object({
  clientId: uuid,
  managerId: uuid.nullable(),
});

const projectAssignmentRow = z.object({
  projectId: uuid,
  managerId: uuid.nullable(),
});

export const assignmentsSchema = z.object({
  clientAssignments: z.array(assignmentRow).default([]),
  projectAssignments: z.array(projectAssignmentRow).default([]),
  cascadeClientProjects: z.boolean().default(false),
  reason: z.string().max(500).nullable().default(null),
  confirmOverCapacity: z.boolean().default(false),
  overrideReason: z.string().max(500).nullable().default(null),
});

export const inviteManagerSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email is required").max(255),
});

export const pmCapacityLimitSchema = z.object({
  limit: z.number().int().min(1).max(999).nullable(),
});

export const pmTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(180),
  projectId: uuid,
  status: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  deadline: isoDate.nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
});

export const pmTaskPatchSchema = pmTaskSchema.partial().omit({ projectId: true });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type AssignmentsInput = z.infer<typeof assignmentsSchema>;
export type InviteManagerInput = z.infer<typeof inviteManagerSchema>;
export type PmCapacityLimitInput = z.infer<typeof pmCapacityLimitSchema>;
export type PmTaskInput = z.infer<typeof pmTaskSchema>;
export type PmTaskPatch = z.infer<typeof pmTaskPatchSchema>;
