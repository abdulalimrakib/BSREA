import { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import rateLimit, { type Options } from "express-rate-limit";
import envConfig from "../config/env.config";
import { sendResponse } from "../utils/response";

/*--Security headers. The API only returns JSON and files, so the strictest content policy is fine.--*/
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
  hsts: envConfig.isProduction
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
});

/*--Never let browsers or proxies keep a copy of API answers (they may hold personal data)--*/
export const noStore = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
};

/*--Changes (POST, PUT, PATCH, DELETE) must come from one of our own websites.
  Together with SameSite=Strict cookies this stops other sites from acting as a logged-in staff member (CSRF).--*/
export const sameOriginWrites = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !envConfig.CORS_ORIGINS.includes(origin))
    return sendResponse(res, 403, "Request blocked: unknown origin");
  // Browsers always send Origin on cross-site POSTs; requests without one come from servers/tests, which need no cookie protection
  next();
};

const limiter = (options: Partial<Options>) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => envConfig.NODE_ENV === "test",
    handler: (req, res) =>
      sendResponse(
        res,
        429,
        "Too many requests. Please wait a while and try again.",
      ),
    ...options,
  });

// Whole API: generous
export const apiLimiter = limiter({ windowMs: 60_000, limit: 300 });
// Staff login: 10 tries per 15 minutes per IP (accounts also lock after 5 wrong passwords)
export const loginLimiter = limiter({ windowMs: 15 * 60_000, limit: 10 });
// Membership applications: 5 per hour per IP. Forms sent back for typing mistakes (400) don't count;
// accepted ones and ones refused as duplicates (409) do, so the form can't be used to probe for members.
export const applyLimiter = limiter({
  windowMs: 60 * 60_000,
  limit: 5,
  skipFailedRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 400,
});
// Contact form: 10 per hour per IP
export const contactLimiter = limiter({ windowMs: 60 * 60_000, limit: 10 });
// Certificate verification: 30 per 10 minutes per IP (stops guessing codes)
export const verifyLimiter = limiter({ windowMs: 10 * 60_000, limit: 30 });
