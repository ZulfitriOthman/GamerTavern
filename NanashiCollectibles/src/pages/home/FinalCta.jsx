import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import { site } from "../../config/site.js";

export default function FinalCta() {
  return (
    <Section tone="muted" spacing="md" className="pb-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <BlurFade inView>
          <SectionHeading
            align="center"
            eyebrow="About Nanashi"
            title="One platform, several communities"
            description={`${site.name} connects a TCG and collectibles shop, professional drone and software services, and RVS esports under one roof — built to grow one module at a time.`}
          />
        </BlurFade>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button to="/contact">Get in touch</Button>
          <Button to="/about" variant="secondary">
            Learn more about us
          </Button>
        </div>
      </div>
    </Section>
  );
}
