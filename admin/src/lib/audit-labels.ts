/*--Plain-English wording for the action codes the backend writes to the activity (audit) log--*/

export type AuditCategory = "login" | "application" | "certificate" | "staff";
export type AuditTone = "normal" | "warn" | "danger";

const actions: Record<string, { text: string; category: AuditCategory; tone?: AuditTone }> = {
  "login.success": { text: "Logged in", category: "login" },
  "login.failed": { text: "Failed to log in (wrong email or password)", category: "login", tone: "warn" },
  "login.wrong_code": { text: "Failed to log in (wrong authenticator code)", category: "login", tone: "warn" },
  "login.locked": { text: "Tried to log in while the account was locked", category: "login", tone: "danger" },
  "login.locked_now": { text: "Account locked after too many failed logins", category: "login", tone: "danger" },
  logout: { text: "Logged out", category: "login" },
  "password.changed": { text: "Changed their password", category: "staff" },
  "password.reset_from_server": { text: "Password reset on the server", category: "staff", tone: "warn" },
  "two_factor.setup_started": { text: "Started setting up phone login (two-factor)", category: "staff" },
  "two_factor.enabled": { text: "Turned on phone login (two-factor)", category: "staff" },
  "two_factor.disabled": { text: "Turned off phone login (two-factor)", category: "staff", tone: "warn" },
  "two_factor.reset": { text: "Reset someone's phone login (two-factor)", category: "staff", tone: "warn" },
  "staff.created": { text: "Added a staff account", category: "staff" },
  "staff.deactivated": { text: "Deactivated a staff account", category: "staff", tone: "warn" },
  "application.submitted": { text: "New application sent from the website", category: "application" },
  "application.viewed": { text: "Opened an application", category: "application" },
  "application.review_started": { text: "Started reviewing an application", category: "application" },
  "application.duplicates_checked": { text: "Confirmed possible duplicates are different companies", category: "application" },
  "application.approved": { text: "Approved an application", category: "application" },
  "application.rejected": { text: "Rejected an application", category: "application" },
  "application.blocked_duplicate": { text: "Website blocked an application that copied an existing member", category: "application", tone: "warn" },
  "application.virus_found": { text: "Website refused an uploaded file that contained a virus", category: "application", tone: "danger" },
  "application.revealed_id": { text: "Showed a full ID number (trade licence, BIN, TIN or NID)", category: "application", tone: "warn" },
  "document.downloaded": { text: "Downloaded an applicant's document", category: "application" },
  "certificate.issued": { text: "Issued a certificate", category: "certificate" },
  "certificate.revoked": { text: "Cancelled a certificate", category: "certificate", tone: "warn" },
  "certificate.downloaded": { text: "Downloaded a certificate PDF", category: "certificate" },
};

const fallbackCategory = (action: string): AuditCategory =>
  action.startsWith("certificate") ? "certificate" : action.startsWith("application") || action.startsWith("document") ? "application" : action.startsWith("login") ? "login" : "staff";

/*--"login.locked_now" → { text: "Account locked after too many failed logins", … }. Unknown codes are shown as they are.--*/
export const describeAction = (action: string): { text: string; category: AuditCategory; tone: AuditTone } => {
  const known = actions[action];
  if (known) return { tone: "normal", ...known };
  return {
    text: action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()),
    category: fallbackCategory(action),
    tone: /failed|locked|blocked|revoked|revealed|virus/.test(action) ? "warn" : "normal",
  };
};
