import { Router } from "express";
import { submitApplication } from "../controllers/applications.controller";
import { applyLimiter } from "../middleware/security";
import { parseApplicationUpload } from "../middleware/upload";
import { asyncHandler } from "../utils/response";

/*--/api/v1/applications: public membership application--*/

const router = Router();

router.post("/", applyLimiter, parseApplicationUpload, asyncHandler(submitApplication));

export default router;
