import type { Metadata } from "next";
import CertificateCheck from "@/components/membership/certificate-check";
import { Container } from "@/components/site/blocks";

export const metadata: Metadata = {
  title: "Certificate Verification",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ code: string }> };

/*--The page a certificate's QR code opens--*/
export default async function VerifyCodePage({ params }: Props) {
  const { code } = await params;
  return (
    <section className="bg-gradient-to-b from-brand-mint/50 to-brand-snow py-16 md:py-24">
      <Container className="max-w-[720px]">
        <h1 className="mb-10 text-center text-4xl md:text-5xl">
          Certificate Verification
        </h1>
        <CertificateCheck code={code} />
        <p className="mt-6 text-center text-xs text-brand-gray">
          Only the details printed on the certificate are shown here. Each
          check is recorded (without personal details) so BSREA notices
          cancelled certificates that are still in use. For questions, contact
          the BSREA secretariat.
        </p>
      </Container>
    </section>
  );
}
