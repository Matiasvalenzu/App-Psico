import { Nav } from "@/components/layout/nav"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/components/sections/hero"
import { PainSection } from "@/components/sections/pain"
import { TrustSection } from "@/components/sections/trust"
import { ProblemSection } from "@/components/sections/problem"
import { FeaturesBentoSection } from "@/components/sections/features-bento"
import { HowItWorksSection } from "@/components/sections/how-it-works"
import { BoletasSection } from "@/components/sections/boletas"
import { VoiceBiometricsSection } from "@/components/sections/voice-biometrics"
import { SecuritySection } from "@/components/sections/security"
import { TeamSection } from "@/components/sections/team"
import { PricingSection } from "@/components/sections/pricing"
import { FAQSection } from "@/components/sections/faq"

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <PainSection />
        <TrustSection />
        <ProblemSection />
        <FeaturesBentoSection />
        <HowItWorksSection />
        <BoletasSection />
        <VoiceBiometricsSection />
        <SecuritySection />
        <TeamSection />
        <PricingSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  )
}
