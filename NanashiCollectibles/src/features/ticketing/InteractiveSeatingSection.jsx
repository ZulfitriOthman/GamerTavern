import { useState } from "react";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import SeatMap from "./SeatMap.jsx";
import { demoVenue, reservedCapacity, totalCapacity } from "./demoVenue.js";

// Section demonstrating the ticketing platform's seating capability on the B2B
// /services/ticketing page — a showcase, not the customer ticket-purchase flow (see
// SeatMap.jsx). Pulled out of ServiceDetailPage (rather than folded into its generic
// "what this covers" list) because it's genuinely ticketing-specific, interactive
// markup that no other service page needs.
export default function InteractiveSeatingSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Section spacing="md">
      <SectionHeading
        eyebrow="Interactive Seating"
        title="Design your venue around the way your event actually works."
        description="Reserved seating, general admission, accessible positions, aisles and capacity can be configured around your venue layout."
      />

      <Card variant="elevated" className="mt-8 p-0">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-amber-50">{demoVenue.name}</h3>
            <p className="mt-1 text-sm text-amber-50/60">{totalCapacity.toLocaleString()} total capacity</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-amber-50/40">Reserved</p>
              <p className="text-sm font-semibold text-amber-50">{reservedCapacity.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-amber-50/40">General Admission</p>
              <p className="text-sm font-semibold text-amber-50">{demoVenue.ga.capacity.toLocaleString()}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-amber-50/70 transition-colors duration-150 hover:text-amber-50 focus-ring"
            >
              Expand
            </button>
          </div>
        </div>

        <div className="p-5">
          <SeatMap venue={demoVenue} mode="demo" />
        </div>
      </Card>

      <Card variant="elevated" className="mt-4 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-lg font-semibold text-amber-50">Need a custom seating layout?</h3>
          <p className="mt-1.5 max-w-lg text-sm text-amber-50/65">
            We can configure sections, capacity and ticket categories around your venue.
          </p>
        </div>
        <Button to="/contact" size="md" className="shrink-0">
          Talk to us
        </Button>
      </Card>

      <Modal open={expanded} onClose={() => setExpanded(false)} title={demoVenue.name} size="xl">
        <SeatMap venue={demoVenue} mode="demo" />
      </Modal>
    </Section>
  );
}
