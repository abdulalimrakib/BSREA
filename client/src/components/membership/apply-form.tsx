"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CheckCircle2, Lock, Upload } from "lucide-react";
import { ApiError, submitApplication } from "@/lib/api";
import { DemoFormNotice } from "@/components/site/demo-banner";
import { cn } from "@/lib/utils";
import { fieldClass, panelClass, primaryButtonClass } from "@/lib/styles";

/*--Online membership application. The backend checks everything again; these checks only save a round trip.--*/

// The fee receipt can be made optional while the process is being tested (set NEXT_PUBLIC_PAYMENT_REQUIRED=0 when
// building, together with PAYMENT_RECEIPT_REQUIRED=0 in backend/.env)
const PAYMENT_REQUIRED = process.env.NEXT_PUBLIC_PAYMENT_REQUIRED !== "0";

const DOCUMENTS = [
  { name: "trade_license", label: "Trade Licence", required: true },
  {
    name: "tax_acknowledgement",
    label: "Tax Submission Acknowledgement (Company & Applicant)",
    required: true,
  },
  { name: "bin_certificate", label: "BIN Certificate", required: true },
  {
    name: "applicant_id",
    label: "NID or Passport (Applicant)",
    required: true,
  },
  {
    name: "applicant_photo",
    label: "Passport-size Photo (Applicant)",
    required: true,
  },
  {
    name: "payment_receipt",
    label: PAYMENT_REQUIRED
      ? "Pay Order or Fund Transfer Receipt"
      : "Pay Order or Fund Transfer Receipt (optional during testing)",
    required: PAYMENT_REQUIRED,
  },
  {
    name: "memorandum",
    label: "Memorandum and Articles of Association",
    required: false,
  },
  {
    name: "incorporation_certificate",
    label: "Certificate of Incorporation",
    required: false,
  },
  { name: "visiting_card", label: "Visiting Card", required: false },
  { name: "other", label: "Other Relevant Certificate", required: false },
];

const MAX_MB = 5;
const input = fieldClass;

function Field({
  label,
  name,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-sm font-semibold text-brand-navy"
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-brand-gray">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ApplyForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [origin, setOrigin] = useState("local");
  const alertRef = useRef<HTMLDivElement>(null);

  // Errors are shown at the top of the form, but the visitor is at the Submit button: take them there
  useEffect(() => {
    if (!message || !alertRef.current) return;
    alertRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    alertRef.current.focus({ preventScroll: true });
  }, [message]);

  const text = (
    name: string,
    label: string,
    opts: {
      required?: boolean;
      type?: string;
      hint?: string;
      max?: number;
      autoComplete?: string;
    } = {},
  ) => (
    <Field
      label={label}
      name={name}
      error={errors[name]}
      required={opts.required ?? true}
      hint={opts.hint}
    >
      <input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        required={opts.required ?? true}
        maxLength={opts.max ?? 150}
        autoComplete={opts.autoComplete ?? "off"}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className={input}
      />
    </Field>
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    // Quick checks before uploading
    const local: Record<string, string> = {};
    for (const doc of DOCUMENTS) {
      const file = form.get(doc.name);
      if (file instanceof File && file.size > MAX_MB * 1024 * 1024)
        local[doc.name] = `The file must be ${MAX_MB} MB or smaller`;
      if (file instanceof File && file.size === 0) form.delete(doc.name);
    }
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Please check the highlighted fields.");
      return;
    }

    setSending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await submitApplication(form);
      setReference(result.reference);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.data &&
        typeof error.data === "object"
      )
        setErrors(error.data as Record<string, string>);
      setMessage(null);
      setTimeout(
        () =>
          setMessage(
            error instanceof Error
              ? error.message
              : "The application could not be sent. Please try again.",
          ),
        0,
      );
    } finally {
      setSending(false);
    }
  };

  if (reference) {
    return (
      <div className={`text-center ${panelClass}`} role="status">
        <CheckCircle2
          className="mx-auto size-14 text-brand-green"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-2xl font-bold">Application received</h2>
        <p className="mt-3 text-[15px]">
          Your reference number is{" "}
          <strong className="font-mono text-lg text-brand-navy">
            {reference}
          </strong>
        </p>
        <p className="mx-auto mt-3 max-w-[520px] text-sm leading-6">
          Please keep this number. The BSREA secretariat will review your
          application and documents and contact you by email or phone.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-10"
      encType="multipart/form-data"
    >
      <DemoFormNotice />
      {message && (
        <div
          ref={alertRef}
          id="apply-error"
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 outline-none"
        >
          {message}
        </div>
      )}

      <fieldset className="space-y-5">
        <legend className="mb-5 font-serif text-2xl font-semibold text-brand-navy">
          1. Membership
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Company is"
            name="origin"
            error={errors.origin}
            required
          >
            <select
              id="origin"
              name="origin"
              className={input}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              <option value="local">Local (Bangladesh)</option>
              <option value="foreign">Foreign</option>
            </select>
          </Field>
          <Field
            label="Membership type"
            name="membershipType"
            error={errors.membershipType}
            required
          >
            <select
              id="membershipType"
              name="membershipType"
              className={input}
              defaultValue="general"
            >
              <option value="general">
                General Member{" "}
                {origin === "local"
                  ? "(BDT 25,000 + BDT 15,000/year)"
                  : "(USD 1,000 + USD 500/year)"}
              </option>
              {origin === "local" && (
                <option value="associate">
                  Associate Member (BDT 20,000 + BDT 10,000/year)
                </option>
              )}
            </select>
          </Field>
        </div>
        <p className="text-xs text-brand-gray">
          Fees are exclusive of VAT and tax.
        </p>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-5 font-serif text-2xl font-semibold text-brand-navy">
          2. Company
        </legend>
        {text("company", "Company name", { autoComplete: "organization" })}
        <div className="grid gap-5 sm:grid-cols-3">
          {text("tradeLicenseNo", "Trade licence number", { max: 40 })}
          {text("binNo", "BIN", { max: 40 })}
          {text("tinNo", "TIN", { required: false, max: 40 })}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("companyEmail", "Company email", {
            type: "email",
            autoComplete: "email",
          })}
          {text("companyPhone", "Company phone", {
            type: "tel",
            max: 30,
            autoComplete: "tel",
          })}
        </div>
        <Field
          label="Company address"
          name="address"
          error={errors.address}
          required
        >
          <textarea
            id="address"
            name="address"
            rows={2}
            maxLength={300}
            required
            aria-invalid={!!errors.address}
            className={input}
          />
        </Field>
        {text("website", "Website", {
          required: false,
          type: "url",
          hint: "Starting with https://",
          max: 200,
        })}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-5 font-serif text-2xl font-semibold text-brand-navy">
          3. Applicant
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("applicantName", "Full name", {
            max: 100,
            autoComplete: "name",
          })}
          {text("applicantDesignation", "Designation", {
            max: 100,
            autoComplete: "organization-title",
          })}
          {text("applicantEmail", "Email", {
            type: "email",
            autoComplete: "email",
          })}
          {text("applicantMobile", "Mobile", {
            type: "tel",
            max: 30,
            autoComplete: "tel",
          })}
        </div>
        {text("applicantNid", "NID or passport number", {
          max: 40,
          hint: "Stored encrypted. Only authorised BSREA staff can see it.",
        })}
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-5 font-serif text-2xl font-semibold text-brand-navy">
          4. Contact person (if different)
        </legend>
        <div className="grid gap-5 sm:grid-cols-3">
          {text("contactName", "Name", { required: false, max: 100 })}
          {text("contactMobile", "Mobile", {
            required: false,
            type: "tel",
            max: 30,
          })}
          {text("contactEmail", "Email", { required: false, type: "email" })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xl font-bold text-brand-navy">
          5. Documents
        </legend>
        <p className="mb-5 text-sm">PDF, JPG or PNG, up to {MAX_MB} MB each.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {DOCUMENTS.map((doc) => (
            <div
              key={doc.name}
              className={cn(
                "rounded-2xl border bg-white p-4 transition-colors",
                errors[doc.name]
                  ? "border-red-400"
                  : "border-brand-navy/10 hover:border-brand-green/40",
              )}
            >
              <label
                htmlFor={doc.name}
                className="flex items-center gap-2 text-sm font-semibold text-brand-navy"
              >
                <Upload
                  className="size-4 text-brand-green"
                  aria-hidden="true"
                />
                {doc.label}
                {doc.required && <span className="text-red-600">*</span>}
              </label>
              <input
                id={doc.name}
                name={doc.name}
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                required={doc.required}
                aria-invalid={!!errors[doc.name]}
                className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-brand-mint file:px-4 file:py-1.5 file:font-medium file:text-brand-green hover:file:bg-brand-green hover:file:text-white file:transition-colors"
              />
              {errors[doc.name] && (
                <p className="mt-1 text-xs text-red-600">{errors[doc.name]}</p>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {/* Spam trap: people never see or fill this field */}
      <input
        type="text"
        name="website2"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="space-y-5 border-t border-brand-navy/10 pt-8">
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            name="declaration"
            value="yes"
            required
            className="mt-1 size-4 accent-brand-green"
          />
          <span>
            I confirm that the information and documents I have given are true
            and correct, and I agree that BSREA may use them to process this
            application.
            {errors.declaration && (
              <span className="block text-xs text-red-600">
                {errors.declaration}
              </span>
            )}
          </span>
        </label>
        <p className="flex items-center gap-2 text-xs text-brand-gray">
          <Lock className="size-3.5" aria-hidden="true" /> Your ID numbers and
          documents are encrypted and are only seen by authorised BSREA staff.
        </p>
        <button type="submit" disabled={sending} className={primaryButtonClass}>
          {sending ? "Sending…" : "Submit Application"}
        </button>
      </div>
    </form>
  );
}
