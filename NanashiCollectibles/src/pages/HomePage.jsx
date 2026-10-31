import Hero from "./home/Hero.jsx";
import CapabilityGrid from "./home/CapabilityGrid.jsx";
import RvsSection from "./home/RvsSection.jsx";
import ShopSection from "./home/ShopSection.jsx";
import ServicesSection from "./home/ServicesSection.jsx";
import TcgSection from "./home/TcgSection.jsx";
import WhyNanashi from "./home/WhyNanashi.jsx";
import MerchantCta from "./home/MerchantCta.jsx";
import FinalCta from "./home/FinalCta.jsx";

export default function HomePage() {
  return (
    <>
      <Hero />
      <CapabilityGrid />
      <RvsSection />
      <ShopSection />
      <ServicesSection />
      <TcgSection />
      <WhyNanashi />
      <MerchantCta />
      <FinalCta />
    </>
  );
}
