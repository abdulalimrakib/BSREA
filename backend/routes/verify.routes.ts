import { Router } from "express";
import { verifyCertificate } from "../controllers/verify.controller";
import { verifyLimiter } from "../middleware/security";

/*--/api/v1/verify: public certificate check--*/

const router = Router();

router.get("/:code", verifyLimiter, verifyCertificate);

export default router;
