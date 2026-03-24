import { V2Nav } from "@/components/v2/v2-nav";
import { V2Hero } from "@/components/v2/v2-hero";
import { V2TrustBar } from "@/components/v2/v2-trust-bar";
import { V2Integrations } from "@/components/v2/v2-integrations";
import { V2DemoPlayer } from "@/components/v2/v2-demo-player";
import { V2ProductModules } from "@/components/v2/v2-product-modules";
import { V2ForDevelopers } from "@/components/v2/v2-for-developers";
import { V2Demos } from "@/components/v2/v2-demos";
import { V2ForCompliance } from "@/components/v2/v2-for-compliance";
import { V2Pricing } from "@/components/v2/v2-pricing";
import { V2SecurityDeploy } from "@/components/v2/v2-security-deploy";
import { V2FinalCTA } from "@/components/v2/v2-final-cta";
import { V2Footer } from "@/components/v2/v2-footer";

export default function LandingPage() {
  return (
    <>
      <V2Nav />
      <main>
        <V2Hero />
        <V2Integrations />
        <V2DemoPlayer />
        <V2ProductModules />
        <V2ForDevelopers />
        <V2Demos />
        <V2TrustBar />
        <V2ForCompliance />
        <V2Pricing />
        <V2SecurityDeploy />
        <V2FinalCTA />
      </main>
      <V2Footer />
    </>
  );
}
