import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const workspaceAssetDir = path.resolve(process.env.WORKSPACE_ASSET_DIR || path.resolve(__dirname, "../.dev-data/workspace-assets"));

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export interface WorkspaceAssetInput {
  projectId: string;
  dataUrl: string;
  originalName?: string;
  purpose?: string;
}

export async function saveWorkspaceAsset(input: WorkspaceAssetInput) {
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif|svg\+xml));base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error("Only base64 image data URLs are supported.");
  }
  const mimeType = match[1].toLowerCase();
  const ext = MIME_EXT[mimeType];
  if (!ext) {
    throw new Error("Unsupported image type.");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5_000_000) {
    throw new Error("Image must be under 5 MB.");
  }
  const projectSlug = safeSegment(input.projectId);
  const purposeSlug = safeSegment(input.purpose || "workspace");
  const assetId = `asset-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const fileName = `${purposeSlug}-${assetId}.${ext}`;
  const targetDir = path.join(workspaceAssetDir, projectSlug);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, fileName), buffer);
  return {
    id: assetId,
    url: `/workspace-assets/${encodeURIComponent(projectSlug)}/${encodeURIComponent(fileName)}`,
    mimeType,
    size: buffer.length,
    originalName: input.originalName || fileName,
  };
}

function safeSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}
