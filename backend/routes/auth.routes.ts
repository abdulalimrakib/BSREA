import { Router } from "express";
import { changePassword, disableTwoFactor, enableTwoFactor, login, logout, me, setupTwoFactor } from "../controllers/auth.controller";
import { requireLogin } from "../middleware/auth";
import { loginLimiter } from "../middleware/security";
import { asyncHandler } from "../utils/response";

/*--/api/v1/auth: staff login and logout--*/

const router = Router();

router.post("/login", loginLimiter, asyncHandler(login));
router.post("/logout", logout);
// These work before two-factor login is set up, so a new staff member can reach the set-up screen
router.get("/me", requireLogin, me);
router.post("/change-password", requireLogin, asyncHandler(changePassword));
router.post("/two-factor/setup", requireLogin, loginLimiter, asyncHandler(setupTwoFactor));
router.post("/two-factor/enable", requireLogin, loginLimiter, enableTwoFactor);
router.post("/two-factor/disable", requireLogin, loginLimiter, disableTwoFactor);

export default router;
