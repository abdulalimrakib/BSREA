import envConfig from "./config/env.config";

import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFound } from "./middleware/error.handler";
import { apiLimiter, contactLimiter, noStore, sameOriginWrites, securityHeaders } from "./middleware/security";
import { loadSession } from "./middleware/auth";
import contactRoutes from "./routes/contact.routes";
import applicationRoutes from "./routes/applications.routes";
import verifyRoutes from "./routes/verify.routes";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";

const app = express();

app.disable("x-powered-by");
// Behind a reverse proxy (nginx, a load balancer) set TRUST_PROXY=1 so rate limits see the real visitor IP
app.set("trust proxy", Number(process.env.TRUST_PROXY) || false);

app.use(securityHeaders);
app.use(
  cors({
    origin: envConfig.CORS_ORIGINS,
    credentials: true, // the admin panel sends its session cookie
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/*--API routes--*/
app.use("/api", noStore, apiLimiter, sameOriginWrites, loadSession);
app.use("/api/v1/contact", contactLimiter, contactRoutes);
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/verify", verifyRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
