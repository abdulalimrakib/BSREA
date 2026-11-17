import { Router } from "express";
import { sendContactMessage } from "../controllers/contact.controller";
import { asyncHandler } from "../utils/response";

/*--/api/v1/contact (the contact form; rate-limited in app.ts)--*/

const router = Router();

router.post("/", asyncHandler(sendContactMessage));

export default router;
