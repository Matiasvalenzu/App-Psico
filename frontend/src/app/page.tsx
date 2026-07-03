import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/sections/hero";
import { TrustSection } from "@/components/sections/trust";
import { ProblemSection } from "@/components/sections/problem";
import { FeaturesBentoSection } from "@/components/sections/features-bento";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { VoiceBiometricsSection } from "@/components/sections/voice-biometrics";
import { SecuritySection } from "@/components/sections/security";
import { PricingSection } from "@/components/sections/pricing";
import { FAQSection } from "@/components/sections/faq";
import { CTAFinalSection } from "@/components/sections/cta-final";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <TrustSection />
        <ProblemSection />
        <FeaturesBentoSection />
        <HowItWorksSection />
        <VoiceBiometricsSection />
        <SecuritySection />
        <PricingSection />
        <FAQSection />
        <CTAFinalSection />
      </main>
      <Footer />
    </>
  );
}
