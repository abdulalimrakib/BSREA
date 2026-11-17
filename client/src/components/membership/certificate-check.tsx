"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, CircleAlert, CircleX } from "lucide-react";
import {
  ApiError,
  verifyCertificate,
  type VerifiedCertificate,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

/*--Shows the result of checking a certificate code--*/
export default function CertificateCheck({ code }: { code: string }) {
  const [result, setResult] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyCertificate(code)
      .then(setResult)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.statusCode === 404
            ? "not-found"
            : e instanceof Error
              ? e.message
              : "Something went wrong",
        ),
      );
  }, [code]);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center sm:p-10"
      >
        <CircleX className="mx-auto size-14 text-red-600" aria-hidden="true" />
        <h2 className="mt-4 text-3xl text-red-700">
          {error === "not-found"
            ? "Not a BSREA certificate"
            : "Could not check the certificate"}
        </h2>
        <p className="mt-2 text-sm text-red-700">
          {error === "not-found"
            ? "No certificate matches this code. The certificate may be forged; please contact BSREA."
            : error}
        </p>
      </div>
    );
  }
  if (!result) return <p className="py-10 text-center text-sm">Checking…</p>;

  const states = {
    valid: {
      Icon: BadgeCheck,
      title: "Valid certificate",
      box: "border-brand-green/30 bg-gradient-to-b from-brand-mint to-white",
      text: "text-brand-green",
    },
    expired: {
      Icon: CircleAlert,
      title: "Expired certificate",
      box: "border-amber-300 bg-gradient-to-b from-amber-50 to-white",
      text: "text-amber-700",
    },
    revoked: {
      Icon: CircleX,
      title: "Revoked certificate",
      box: "border-red-300 bg-gradient-to-b from-red-50 to-white",
      text: "text-red-700",
    },
  } as const;
  const s = states[result.status];

  return (
    <div
      className={`rounded-[2rem] border p-8 shadow-[var(--shadow-soft)] sm:p-10 ${s.box}`}
      role="status"
    >
      <div className="text-center">
        <s.Icon className={`mx-auto size-14 ${s.text}`} aria-hidden="true" />
        <h2 className={`mt-4 text-3xl ${s.text}`}>{s.title}</h2>
        {result.status === "revoked" && (
          <p className="mt-1 text-sm text-red-700">
            This certificate was cancelled by BSREA
            {result.revokedAt ? ` on ${formatDate(result.revokedAt)}` : ""} and
            is no longer valid.
          </p>
        )}
      </div>
      <dl className="mx-auto mt-8 grid max-w-[520px] grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="font-semibold text-brand-navy">Certificate</dt>
        <dd>
          {result.type === "membership"
            ? "Membership Certificate"
            : "No Objection Certificate"}
        </dd>
        <dt className="font-semibold text-brand-navy">Number</dt>
        <dd className="font-mono">{result.number}</dd>
        <dt className="font-semibold text-brand-navy">Company</dt>
        <dd className="font-semibold">{result.company}</dd>
        {result.type === "membership" && (
          <>
            <dt className="font-semibold text-brand-navy">Membership</dt>
            <dd className="capitalize">{result.membershipType} member</dd>
          </>
        )}
        <dt className="font-semibold text-brand-navy">Valid</dt>
        <dd>
          {formatDate(result.validFrom)} – {formatDate(result.validUntil)}
        </dd>
        <dt className="font-semibold text-brand-navy">Issued</dt>
        <dd>{formatDate(result.issuedAt)}</dd>
      </dl>
    </div>
  );
}
