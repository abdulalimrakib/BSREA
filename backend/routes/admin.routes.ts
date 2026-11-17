import { Router } from "express";
import { requireStaff } from "../middleware/auth";
import { asyncHandler } from "../utils/response";
import { getAuditLog, getSummary } from "../controllers/admin/dashboard.controller";
import {
  approveApplication,
  downloadDocument,
  getApplication,
  listApplications,
  markDuplicatesChecked,
  rejectApplication,
  revealApplicationField,
  startReview,
} from "../controllers/admin/applications.controller";
import { issueMemberCertificate, listMemberDuplicates, listMembers } from "../controllers/admin/members.controller";
import { downloadCertificatePdf, listCertificates, revokeCertificate } from "../controllers/admin/certificates.controller";
import { createStaff, deactivateStaff, listStaff, resetTwoFactor } from "../controllers/admin/staff.controller";

/*--/api/v1/admin: staff-only API. Every route needs a logged-in staff member; changes are written to the audit log.

  Roles:
    staff     review applications, mark duplicates as checked, view members and certificates
    approver  everything staff can do + approve/reject applications, issue/revoke certificates, see full ID numbers
    admin     everything + staff accounts and the audit log--*/

const router = Router();
router.use(requireStaff());

const approvers = requireStaff("admin", "approver");
const adminOnly = requireStaff("admin");

router.get("/summary", getSummary);

router.get("/applications", listApplications);
router.get("/applications/:id", getApplication);
router.post("/applications/:id/reveal", approvers, revealApplicationField);
router.get("/applications/:id/documents/:docId", downloadDocument);
router.post("/applications/:id/start-review", startReview);
router.post("/applications/:id/duplicates-checked", markDuplicatesChecked);
router.post("/applications/:id/approve", approvers, approveApplication);
router.post("/applications/:id/reject", approvers, rejectApplication);

router.get("/members", listMembers);
router.get("/members/duplicates", listMemberDuplicates);
router.post("/members/:id/certificates", approvers, issueMemberCertificate);

router.get("/certificates", listCertificates);
router.get("/certificates/:id/pdf", asyncHandler(downloadCertificatePdf));
router.post("/certificates/:id/revoke", approvers, revokeCertificate);

router.get("/staff", adminOnly, listStaff);
router.post("/staff", adminOnly, createStaff);
router.post("/staff/:id/deactivate", adminOnly, deactivateStaff);
router.post("/staff/:id/reset-two-factor", adminOnly, resetTwoFactor);

router.get("/audit-log", adminOnly, getAuditLog);

export default router;
