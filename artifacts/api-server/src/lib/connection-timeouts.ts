import type { Server } from "node:http";

/**
 * How long an idle keep-alive connection is held open.
 *
 * Node closes one after five seconds by default, and that default is the
 * source of a connection reset that looks like a network fault and is not. A
 * client that pools connections - a browser, a load balancer, nginx with an
 * upstream keepalive block, Playwright's request context - can put a request
 * onto a connection at the same instant the server's idle timer fires. The
 * request is already written when the FIN arrives, so it is never answered
 * and never retried: the caller sees ECONNRESET, with nothing wrong at either
 * end and nothing in the logs. The e2e suite hit exactly this.
 *
 * The rule is that the server must hold a connection open for longer than
 * whatever is in front of it, so the proxy is always the side that decides to
 * close. 65 seconds clears the common 60-second idle timeouts (AWS ALB and
 * nginx's `keepalive_timeout` both default there) with a margin.
 *
 * nginx in this repo opens a fresh upstream connection per request today - it
 * sets `proxy_http_version 1.1` but no `upstream … keepalive` block - so this
 * is not currently fixing a live production fault. It stops one appearing the
 * day that block is added, or anything else that pools connections is put in
 * front.
 */
export const DEFAULT_KEEP_ALIVE_MS = 65_000;

/**
 * The headers timeout must be the larger of the two.
 *
 * It bounds how long a request may take to finish sending its headers, and
 * the clock starts when the connection is accepted. Set it below
 * keepAliveTimeout and a connection can be torn down mid-headers, which
 * reintroduces the same unexplained reset this exists to remove.
 */
export const HEADERS_TIMEOUT_MARGIN_MS = 1_000;

export function resolveKeepAliveMs(raw: string | undefined): number {
  // Blank means unset, not zero - `Number("")` is 0, and a `KEEP_ALIVE_MS=`
  // left in a .env would otherwise disable keep-alive entirely rather than
  // fall back to the default. Same trap as SHUTDOWN_GRACE_MS.
  const text = String(raw ?? "").trim();
  if (!text) return DEFAULT_KEEP_ALIVE_MS;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return DEFAULT_KEEP_ALIVE_MS;
  // Anything under a second is indistinguishable from switching keep-alive
  // off, which is the fault rather than the fix.
  return Math.max(1_000, parsed);
}

/** Apply both timeouts, keeping headersTimeout strictly the larger. */
export function applyConnectionTimeouts(
  server: Pick<Server, "keepAliveTimeout" | "headersTimeout">,
  keepAliveMs: number = DEFAULT_KEEP_ALIVE_MS,
): { keepAliveTimeout: number; headersTimeout: number } {
  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = keepAliveMs + HEADERS_TIMEOUT_MARGIN_MS;
  return { keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout };
}
