import type { Metadata } from "next";
import MemberTable from "@/components/members/member-table";
import {
  Container,
  PageBanner,
  SectionHeading,
} from "@/components/site/blocks";
import { getMembers } from "@/lib/content";

export const metadata: Metadata = { title: "Member Directory" };

export default function MemberDirectoryPage() {
  return (
    <>
      <PageBanner
        title="Member Directory"
        image="/uploads/2025/04/acceptance-of-new-members-into-the-ranks-.jpg"
      />
      <section className="py-16 md:py-24">
        <Container>
          <SectionHeading
            eyebrow="Our Members"
            title={`${getMembers().length} companies driving clean energy`}
            className="mb-10"
          />
          <MemberTable members={getMembers()} />
        </Container>
      </section>
    </>
  );
}
