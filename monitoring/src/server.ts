import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { config, ROOT } from "./config.ts";
import { deliver } from "./alerts.ts";
import { checkPassword, createSession, endSession, hasPassword, loginBlocked, loginFailed, loginSucceeded, validSession } from "./auth.ts";
import { startCollector } from "./collector.ts";
import { buildPage, PAGES, RANGES, type PageKey, type RangeKey } from "./dashboard.ts";
import { unban } from "./security.ts";

/*--The monitoring dashboard: one small process that collects the numbers (collector.ts) and shows them.
  Listens on this machine only; nginx serves it at its own address with HTTPS (deploy/nginx-monitor.conf).

    GET  /, /traffic, /performance, /server, /security, /uptime, /membership     the dashboard pages (login needed)
    GET  /login, POST /login  sign in;  POST /logout  sign out
    GET  /api/page/<page>     one page's numbers for a time range (?range=1h|24h|7d|30d|90d|1y)
    POST /api/unblock         unblock an address the attack protection blocked ({ "ip": "..." })
    POST /api/test-alert      send a test message to ALERT_WEBHOOK_URL
    GET  /healthz             "ok", for an outside uptime monitor--*/

const PUBLIC = path.join(ROOT, "public");
const COOKIE = "bsrea_monitor";
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
// Files anyone may load (the login page needs them); everything else needs a login
const OPEN_FILES = new Set(["/login.html", "/style.css", "/login.js", "/favicon.svg"]);

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  // Send the address to this site only (never to others); "no-referrer" makes browsers send Origin: null on form posts
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const cookieOf = (req: http.IncomingMessage) => {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE && value && /^[\w-]+$/.test(value)) return value;
  }
  return undefined;
};

// nginx adds the visitor's address last in X-Forwarded-For; only nginx can connect, so it can be trusted
const clientIp = (req: http.IncomingMessage) =>
  String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? req.socket.remoteAddress ?? "?";

/*--A form or button on this site, not another website, sent this request.
  Browsers set Sec-Fetch-Site themselves (a page can't fake it), so it decides when present. Origin is the
  fallback for older browsers; it can be "null" for a form post, which is not proof either way.--*/
export const sameOrigin = (req: http.IncomingMessage) => {
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined) return site === "same-origin";
  const origin = req.headers.origin;
  if (!origin || origin === "null") return true; // no browser signal at all: the SameSite=Strict cookie still protects
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

const send = (res: http.ServerResponse, status: number, body: string | Buffer, type = "text/plain; charset=utf-8", extra: Record<string, string> = {}) => {
  res.writeHead(status, { ...securityHeaders, "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(body);
};
const redirect = (res: http.ServerResponse, to: string, extra: Record<string, string> = {}) => {
  res.writeHead(303, { ...securityHeaders, Location: to, "Cache-Control": "no-store", ...extra });
  res.end();
};

const readBody = (req: http.IncomingMessage, limit = 4096) =>
  new Promise<string>((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const serveFile = (res: http.ServerResponse, urlPath: string) => {
  const file = path.join(PUBLIC, path.normalize(urlPath === "/" ? "/index.html" : urlPath));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "Not found");
  send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] ?? "application/octet-stream", { "Cache-Control": "no-cache" });
};

const sessionCookie = (token: string, maxAge: number) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.COOKIE_SECURE ? "; Secure" : ""}`;

export const handle = async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = `${req.method} ${url.pathname}`;

  if (route === "GET /healthz") return send(res, 200, "ok");
  if (route === "GET /login") return serveFile(res, "/login.html");
  if (route === "GET /api/login-status") return send(res, 200, JSON.stringify({ passwordSet: hasPassword() }), "application/json");

  if (route === "POST /login") {
    if (!sameOrigin(req)) return send(res, 403, "Request blocked");
    const ip = clientIp(req);
    if (loginBlocked(ip)) return redirect(res, "/login?error=wait");
    const password = new URLSearchParams(await readBody(req)).get("password") ?? "";
    if (!hasPassword()) return redirect(res, "/login?error=nopassword");
    if (!password || !checkPassword(password)) {
      loginFailed(ip);
      return redirect(res, "/login?error=wrong");
    }
    loginSucceeded(ip);
    return redirect(res, "/", { "Set-Cookie": sessionCookie(createSession(), config.SESSION_HOURS * 3600) });
  }

  const loggedIn = validSession(cookieOf(req));

  if (route === "POST /logout") {
    if (!sameOrigin(req)) return send(res, 403, "Request blocked");
    endSession(cookieOf(req));
    return redirect(res, "/login", { "Set-Cookie": sessionCookie("", 0) });
  }

  if (url.pathname.startsWith("/api/")) {
    if (!loggedIn) return send(res, 401, JSON.stringify({ error: "Please sign in again" }), "application/json");
    const pageMatch = url.pathname.match(/^\/api\/page\/([a-z]+)$/);
    if (req.method === "GET" && pageMatch) {
      const page = pageMatch[1] as PageKey;
      const key = url.searchParams.get("range") ?? "24h";
      if (!PAGES.includes(page)) return send(res, 404, JSON.stringify({ error: "Unknown page" }), "application/json");
      if (!(key in RANGES)) return send(res, 400, JSON.stringify({ error: "Unknown range" }), "application/json");
      return send(res, 200, JSON.stringify(buildPage(page, key as RangeKey)), "application/json");
    }
    if (route === "POST /api/unblock") {
      if (!sameOrigin(req)) return send(res, 403, "Request blocked");
      let ip = "";
      try {
        ip = String((JSON.parse(await readBody(req)) as { ip?: unknown }).ip ?? "");
      } catch {
        // not JSON
      }
      if (!ip) return send(res, 400, JSON.stringify({ error: "Which address?" }), "application/json");
      try {
        const done = await unban(ip);
        return send(res, done ? 200 : 404, JSON.stringify(done ? { message: `${ip} is unblocked` } : { error: "That address is not blocked" }), "application/json");
      } catch {
        return send(res, 500, JSON.stringify({ error: "Unblocked here, but nginx could not be reloaded: run sudo nginx -t on the server" }), "application/json");
      }
    }
    if (route === "POST /api/test-alert") {
      if (!sameOrigin(req)) return send(res, 403, "Request blocked");
      if (!config.ALERT_WEBHOOK_URL) return send(res, 400, JSON.stringify({ error: "ALERT_WEBHOOK_URL is not set in monitoring/.env" }), "application/json");
      const ok = await deliver("BSREA test alert", "Alerts from the monitoring dashboard reach you. Nothing is wrong.", false);
      return send(res, ok ? 200 : 502, JSON.stringify(ok ? { message: "Test alert sent" } : { error: "The alert service did not accept the message" }), "application/json");
    }
    return send(res, 404, JSON.stringify({ error: "Not found" }), "application/json");
  }

  if (req.method !== "GET") return send(res, 405, "Method not allowed");
  if (OPEN_FILES.has(url.pathname)) return serveFile(res, url.pathname);
  if (!loggedIn) return redirect(res, "/login");
  // Every page is the same app; it shows the page named in the address
  if (url.pathname === "/" || PAGES.includes(url.pathname.slice(1) as PageKey)) return serveFile(res, "/index.html");
  return serveFile(res, url.pathname);
};

export const createServer = () =>
  http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) send(res, 500, "Something went wrong");
      else res.end();
    });
  });

/*--Start listening and collecting. Called by src/start.ts (PM2 and "npm start"); tests use createServer() alone.--*/
export const start = () => {
  const server = createServer();
  server.listen(config.PORT, config.HOST, () => {
    console.log(`BSREA monitoring dashboard on http://${config.HOST}:${config.PORT}`);
    if (!hasPassword()) console.log('No password yet: run "npm run set-password" before signing in');
  });
  if (process.env.COLLECT !== "0") startCollector();
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
};
