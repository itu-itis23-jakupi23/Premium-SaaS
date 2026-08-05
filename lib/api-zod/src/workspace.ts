import { z } from "zod";

export const workspaceBoothSchema = z.object({
  width: z.number().min(1).max(100),
  depth: z.number().min(1).max(100),
  height: z.number().min(1.5).max(12),
  system: z.enum(["octanorm", "maxima"]),
  companyName: z.string().min(1).max(80),
  openFront: z.boolean(),
  openBack: z.boolean(),
  openLeft: z.boolean(),
  openRight: z.boolean(),
  fasciaEnabled: z.boolean().optional(),
  fasciaOption: z.enum(["classic", "full", "custom"]).optional(),
});

export const workspacePlacedItemSchema = z.object({
  id: z.string().min(1),
  catalogId: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  qty: z.number().int().min(1).max(999),
  w: z.number().positive(),
  d: z.number().positive(),
  h: z.number().positive(),
  color: z.string().min(1),
  weight: z.number().min(0),
  x: z.number().optional(),
  z: z.number().optional(),
  rotation: z.number().optional(),
  rotationX: z.number().optional(),
  rotationY: z.number().optional(),
  rotationZ: z.number().optional(),
  locked: z.boolean().optional(),
  kind: z.enum(["furniture", "light", "structure", "fascia", "asset"]).optional(),
  shape: z.string().optional(),
  modelUrl: z.string().optional(),
  source: z.string().optional(),
});

export const workspaceRoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  x: z.number(),
  z: z.number(),
  hasDoor: z.boolean(),
  hasCeiling: z.boolean(),
  doorSide: z.enum(["front", "back", "left", "right"]).optional(),
  doorWidth: z.number().min(0.55).max(1.4).optional(),
  doorPosition: z.enum(["left", "center", "right"]),
  doorSwing: z.enum(["left-in", "right-in", "left-out", "right-out"]),
  doorOpen: z.boolean(),
  wallFinish: z.enum(["white", "frosted", "glass", "dark"]).optional(),
  floorColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  locked: z.boolean().optional(),
  // 512 KB max per room — keep workspace JSON small; large images belong in /documents/upload
  designImageUrl: z.string().regex(/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i).max(512_000).optional(),
  designImageName: z.string().max(80).optional(),
  designOpacity: z.number().min(0.15).max(1).optional(),
  designWall: z.enum(["front", "back", "left", "right"]).optional(),
  designFit: z.enum(["cover", "contain", "stretch"]).optional(),
});

export const workspaceNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  color: z.string().min(1),
  createdAt: z.string().min(1),
});

export const workspaceStateSchema = z.object({
  booth: workspaceBoothSchema,
  themeIdx: z.number().int().min(0).max(3),
  wallFinishIdx: z.number().int().min(0).max(3).optional(),
  frameFinishIdx: z.number().int().min(0).max(3).optional(),
  fasciaFinishIdx: z.number().int().min(0).max(3).optional(),
  carpetIdx: z.number().int().min(0).max(5),
  lightingPreset: z.enum(["neutral", "exhibition", "accent", "spotlight", "ambient"]).optional(),
  placedItems: z.array(workspacePlacedItemSchema),
  rooms: z.array(workspaceRoomSchema).optional(),
  notes: z.array(workspaceNoteSchema),
  // Canonical quote (USD cents) computed by the PM workspace BOM model; the
  // server stores this on each version so every portal shows the same number.
  quoteTotalCents: z.number().int().min(0).max(500_000_000).optional(),
});

export const workspaceInputSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  workspace: workspaceStateSchema,
});

export type WorkspaceStateInput = z.infer<typeof workspaceStateSchema>;
export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
