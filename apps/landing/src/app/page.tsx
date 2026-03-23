import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ProblemStatement } from "@/components/problem-statement";
import { FourPrimitives } from "@/components/four-primitives";
import { ApprovalDemo } from "@/components/approval-demo";
import { ComparisonTable } from "@/components/comparison-table";
import { UseCases } from "@/components/use-cases";
import { Standards } from "@/components/standards";
import { DemoGallery } from "@/components/demo-gallery";
import { Pricing } from "@/components/pricing";
import { OpenSource } from "@/components/open-source";
import { CTAFooter } from "@/components/cta-footer";
import { Footer } from "@/components/footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <DemoGallery />
        <ProblemStatement />
        <FourPrimitives />
        <ApprovalDemo />
        <ComparisonTable />
        <UseCases />
        <Standards />
        <Pricing />
        <OpenSource />
        <CTAFooter />
      </main>
      <Footer />
    </>
  );
}
