import { PORTAL_MODE, type PortalMode } from "./portal";

interface PortalUrlOptions {
  configuredBaseUrl?: string;
  currentOrigin?: string;
  portalMode: PortalMode;
  development: boolean;
}

/** A client link must not send a customer into a separate staff-only build. */
export function resolveClientPortalUrl(path: string, options: PortalUrlOptions): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  let base = options.configuredBaseUrl?.trim();
  try {
    if (!base) {
      if (!options.currentOrigin) return null;
      const current = new URL(options.currentOrigin);
      if (options.portalMode === "staff") {
        if (!options.development || !["localhost", "127.0.0.1"].includes(current.hostname) || current.port !== "5174") return null;
        current.port = "5175";
      }
      base = current.origin;
    }
    const parsed = new URL(base);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const url = new URL(path.slice(1), `${parsed.href.replace(/\/+$/, "")}/`);
    return url.origin === parsed.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

export function clientPortalUrl(path: string): string | null {
  return resolveClientPortalUrl(path, {
    configuredBaseUrl: import.meta.env.VITE_CLIENT_APP_URL,
    currentOrigin: typeof window === "undefined" ? undefined : window.location.origin,
    portalMode: PORTAL_MODE,
    development: import.meta.env.DEV,
  });
}
