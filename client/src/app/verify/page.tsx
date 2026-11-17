import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { Container } from "@/components/site/blocks";
import { panelClass } from "@/lib/styles";
import VerifyCodeForm from "@/components/membership/verify-code-form";

export const metadata: Metadata = { title: "Verify a Certificate" };

export default function VerifyPage() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-mint/70 to-brand-snow py-20 md:py-28">
      <div
        aria-hidden="true"
        className="absolute -top-32 right-[-10%] -z-10 size-[420px] rounded-full bg-brand-yellow/15 blur-[100px]"
      />
      <Container className="max-w-[680px] text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-white text-brand-green shadow-[var(--shadow-soft)]">
          <QrCode className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-4xl leading-tight md:text-5xl">
          Verify a BSREA Certificate
        </h1>
        <p className="mt-4 text-lg leading-8 text-brand-slate">
          Scan the QR code on a BSREA membership certificate or NOC, or type the
          verification code printed under it.
        </p>
        <div className={`mt-10 text-left ${panelClass}`}>
          <VerifyCodeForm />
        </div>
      </Container>
    </section>
  );
}
