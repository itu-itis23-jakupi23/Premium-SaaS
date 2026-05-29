import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const BINARY_MAGIC = Buffer.from("ensmsgbin1", "utf8");

export function encryptMessageBody(body: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", messageEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptMessageBody(body: string) {
  if (!body.startsWith(PREFIX)) return body;

  try {
    const [ivRaw, tagRaw, ciphertextRaw] = body.slice(PREFIX.length).split(".");
    if (!ivRaw || !tagRaw || !ciphertextRaw) return "[Encrypted message unavailable]";

    const decipher = createDecipheriv("aes-256-gcm", messageEncryptionKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return "[Encrypted message unavailable]";
  }
}

export function encryptMessageBytes(bytes: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", messageEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([BINARY_MAGIC, iv, tag, ciphertext]);
}

export function decryptMessageBytes(bytes: Buffer) {
  if (!bytes.subarray(0, BINARY_MAGIC.length).equals(BINARY_MAGIC)) return bytes;

  const ivStart = BINARY_MAGIC.length;
  const tagStart = ivStart + 12;
  const ciphertextStart = tagStart + 16;
  const iv = bytes.subarray(ivStart, tagStart);
  const tag = bytes.subarray(tagStart, ciphertextStart);
  const ciphertext = bytes.subarray(ciphertextStart);

  const decipher = createDecipheriv("aes-256-gcm", messageEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function messageEncryptionKey() {
  const configured = process.env.MESSAGE_ENCRYPTION_KEY;

  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("MESSAGE_ENCRYPTION_KEY environment variable is required in production.");
  }

  const source = configured ?? process.env.AUTH_SECRET ?? "ens-local-message-encryption-key";

  if (source.startsWith("base64:")) {
    const key = Buffer.from(source.slice("base64:".length), "base64");
    if (key.length !== 32) {
      throw new Error("MESSAGE_ENCRYPTION_KEY base64 value must decode to 32 bytes.");
    }
    return key;
  }

  return createHash("sha256").update(source).digest();
}
