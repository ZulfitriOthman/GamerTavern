import ServiceDetailPage from "./ServiceDetailPage.jsx";
import InteractiveSeatingSection from "../../features/ticketing/InteractiveSeatingSection.jsx";

export default function TicketingServicePage() {
  return (
    <ServiceDetailPage serviceKey="ticketing">
      <InteractiveSeatingSection />
    </ServiceDetailPage>
  );
}
