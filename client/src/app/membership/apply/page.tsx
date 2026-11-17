import type { Metadata } from "next";
import Link from "next/link";
import ApplyForm from "@/components/membership/apply-form";
import { Container, PageHeader } from "@/components/site/blocks";
import { panelClass } from "@/lib/styles";

export const metadata: Metadata = { title: "Apply for Membership" };

export default function ApplyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Membership"
        title="Apply for Membership"
        intro={
          <p>
            Fill in this form and upload your documents to apply for BSREA
            membership. See{" "}
            <Link
              href="/eligibility-membership-form"
              className="font-medium text-brand-green underline underline-offset-4"
            >
              eligibility and fees
            </Link>{" "}
            first. Fields marked <span className="text-red-600">*</span> are
            required.
          </p>
        }
      />
      <section className="py-12 md:py-16">
        <Container className="max-w-[920px]">
          <div className={panelClass}>
            <ApplyForm />
          </div>
        </Container>
      </section>
    </>
  );
}
