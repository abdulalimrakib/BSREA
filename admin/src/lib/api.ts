/*--Talking to the backend--*/
// Every page uses these functions instead of calling fetch() itself, so the backend address and the
// error handling live in one place.
//
// Every backend answer looks like { success, message, statusCode, data }. `request` gives back `data`,
// or throws an ApiError with a message that can be shown to the user as it is.

// Set it to an empty value in production: nginx serves the API under /api on the same website.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/*--An error with a message that can be shown to the user--*/
export class ApiError extends Error {
  statusCode: number; // 0 = the backend could not be reached
  data: unknown;

  constructor(message: string, statusCode: number, data: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

/*--Send one request to the backend and give back its `data`--*/
export const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { credentials: "include", cache: "no-store", ...options });
  } catch {
    throw new ApiError(
      API_URL
        ? `The backend can't be reached at ${API_URL}. Is it running? (cd backend && npm run dev)`
        : "The server can't be reached right now. Please check your connection and try again.",
      0,
    );
  }

  let body: { success?: boolean; message?: string; statusCode?: number; data?: unknown };
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`The backend gave an answer that can't be read (error ${response.status})`, response.status);
  }
  if (!response.ok || !body.success) {
    throw new ApiError(body.message || `The backend answered with error ${response.status}`, response.status, body.data ?? null);
  }
  return body.data as T;
};

/*--Turn { page: 2, status: "" } into "?page=2" (empty values are left out)--*/
export const queryString = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && String(value).trim() !== "") params.set(name, String(value).trim());
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

/*--Send JSON--*/
const post = <T>(path: string, body: unknown = {}) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/*--The API functions--*/

export type Role = "admin" | "approver" | "staff";
export type Staff = { id: number; email: string; name: string; role: Role; twoFactor: boolean; twoFactorRequired: boolean };

// `code` is the 6-digit code from the authenticator app, once two-factor login is on
export const login = (email: string, password: string, code?: string) => post<Staff>("/api/v1/auth/login", { email, password, code });
export const logout = () => post<null>("/api/v1/auth/logout");
export const getMe = () => request<Staff>("/api/v1/auth/me");
export const changePassword = (currentPassword: string, newPassword: string) => post<null>("/api/v1/auth/change-password", { currentPassword, newPassword });
export const setupTwoFactor = (password: string) => post<{ secret: string; qr: string }>("/api/v1/auth/two-factor/setup", { password });
export const enableTwoFactor = (code: string) => post<null>("/api/v1/auth/two-factor/enable", { code });
export const disableTwoFactor = (password: string, code: string) => post<null>("/api/v1/auth/two-factor/disable", { password, code });

export type Summary = { applicationsOpen: number; applicationsFlagged: number; members: number; certificatesValid: number };
export const getSummary = () => request<Summary>("/api/v1/admin/summary");

export type DuplicateMatch = {
  level: "block" | "review";
  field: string;
  match: "exact" | "similar";
  against: "member" | "application";
  id: number;
  label: string;
  score?: number;
};

export type ApplicationListItem = {
  id: number;
  reference: string;
  status: "submitted" | "under_review" | "approved" | "rejected";
  membership_type: string;
  origin: string;
  company: string;
  applicant_name: string;
  created_at: string;
  flags: number;
  duplicatesChecked: boolean;
};
export const getApplications = (status: string) => request<ApplicationListItem[]>(`/api/v1/admin/applications${queryString({ status })}`);

export type ApplicationDetail = {
  id: number;
  reference: string;
  status: ApplicationListItem["status"];
  membershipType: string;
  origin: string;
  company: string;
  tradeLicenseNo: string;
  binNo: string;
  tinNo: string | null;
  applicantNid: string;
  companyEmail: string;
  companyPhone: string;
  address: string;
  website: string | null;
  applicantName: string;
  applicantDesignation: string;
  applicantEmail: string;
  applicantMobile: string;
  contactName: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionNote: string | null;
  memberId: number | null;
  duplicatesAtSubmission: DuplicateMatch[];
  duplicatesNow: DuplicateMatch[];
  duplicatesCheckedBy: string | null;
  documents: { id: number; kind: string; label: string; original_name: string; mime: string; size: number }[];
};
export const getApplication = (id: number) => request<ApplicationDetail>(`/api/v1/admin/applications/${id}`);
export const revealField = (id: number, field: "tradeLicenseNo" | "binNo" | "tinNo" | "applicantNid") =>
  post<{ value: string | null }>(`/api/v1/admin/applications/${id}/reveal`, { field });
export const documentUrl = (id: number, docId: number) => `${API_URL}/api/v1/admin/applications/${id}/documents/${docId}`;
export const startReview = (id: number) => post<null>(`/api/v1/admin/applications/${id}/start-review`);
export const markDuplicatesChecked = (id: number, note: string) => post<null>(`/api/v1/admin/applications/${id}/duplicates-checked`, { note });
export const approveApplication = (id: number, note: string) => post<{ memberId: number; certificateId: number }>(`/api/v1/admin/applications/${id}/approve`, { note });
export const rejectApplication = (id: number, reason: string) => post<null>(`/api/v1/admin/applications/${id}/reject`, { reason });

export type Member = {
  id: number;
  member_no: string;
  company: string;
  contact_name: string;
  designation: string;
  mobile: string;
  email: string;
  membership_type: string;
  status: string;
  source: string;
  joined_at: string;
  valid_certificates: number;
};
export const getMembers = (q: string) => request<Member[]>(`/api/v1/admin/members${queryString({ q })}`);
export type DuplicateGroup = { reason: string; score?: number; members: { id: number; member_no: string; company: string }[] };
export const getMemberDuplicates = () => request<DuplicateGroup[]>("/api/v1/admin/members/duplicates");
export const issueCertificate = (memberId: number) => post<{ id: number }>(`/api/v1/admin/members/${memberId}/certificates`);

export type Certificate = {
  id: number;
  type: string;
  number: string;
  verifyCode: string;
  company: string;
  membership_type: string;
  valid_from: string;
  valid_until: string;
  status: string;
  state: "valid" | "expired" | "revoked";
  revoked_reason: string | null;
  created_at: string;
};
export const getCertificates = () => request<Certificate[]>("/api/v1/admin/certificates");
export const certificatePdfUrl = (id: number) => `${API_URL}/api/v1/admin/certificates/${id}/pdf`;
export const revokeCertificate = (id: number, reason: string) => post<null>(`/api/v1/admin/certificates/${id}/revoke`, { reason });

export type StaffAccount = Pick<Staff, "id" | "email" | "name" | "role"> & { is_active: number; totp_enabled: number; last_login_at: string | null; created_at: string };
export const getStaff = () => request<StaffAccount[]>("/api/v1/admin/staff");
export const createStaff = (data: { email: string; name: string; role: Role; password: string }) => post<{ id: number }>("/api/v1/admin/staff", data);
export const deactivateStaff = (id: number) => post<null>(`/api/v1/admin/staff/${id}/deactivate`);
export const resetStaffTwoFactor = (id: number) => post<null>(`/api/v1/admin/staff/${id}/reset-two-factor`);

export type AuditEntry = { id: number; at: string; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; ip: string | null; details: string | null };
export const getAuditLog = () => request<AuditEntry[]>("/api/v1/admin/audit-log");

