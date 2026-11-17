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
    response = await fetch(`${API_URL}${path}`, options);
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

/*--The API functions--*/

export type ContactMessage = { name: string; email: string; phone?: string; message: string; website?: string };

/*--Send the contact form. On bad input the ApiError's `data` is { field: "what is wrong" }.--*/
export const sendContactMessage = (message: ContactMessage) =>
  request<{ id: string }>("/api/v1/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

/*--Membership application (multipart form with documents). On bad input `data` is { field: "what is wrong" }.--*/
export const submitApplication = (form: FormData) => request<{ reference: string }>("/api/v1/applications", { method: "POST", body: form });

export type VerifiedCertificate = {
  type: "membership" | "noc";
  number: string;
  company: string;
  membershipType: string;
  validFrom: string;
  validUntil: string;
  issuedAt: string;
  status: "valid" | "expired" | "revoked";
  revokedAt: string | null;
};

/*--Look up a certificate by the code in its QR code--*/
export const verifyCertificate = (code: string) => request<VerifiedCertificate>(`/api/v1/verify/${encodeURIComponent(code)}`);
