import { memo, useMemo } from "react";
import ZoomPanViewport from "./ZoomPanViewport.jsx";
import Seat from "./Seat.jsx";
import { CATEGORY_THEME } from "./seatMapTheme.js";
import { demoTicketTypes, formatPrice } from "./demoPricing.js";
import { seatCode, DEMO_UNAVAILABLE_SEATS, DEMO_ACCESSIBLE_SEATS } from "./demoInventory.js";

const MemoSeat = memo(Seat);

// Only mounted while a reserved section is the active view — this is the ~390-seat
// render the venue overview deliberately avoids (see SeatMap.jsx performance note).
export default function ReservedSectionView({ section, selectedCodes, onToggleSeat, onBack }) {
  const theme = CATEGORY_THEME[section.category];
  const ticketType = demoTicketTypes[section.category];

  const rows = useMemo(() => {
    return Array.from({ length: section.rows }, (_, rowIndex) =>
      Array.from({ length: section.seatsPerRow }, (_, seatIndex) => {
        const code = seatCode(section.category, section.key, rowIndex, seatIndex);
        return {
          code,
          row: rowIndex + 1,
          seatNumber: seatIndex + 1,
          unavailable: DEMO_UNAVAILABLE_SEATS.has(code),
          accessible: DEMO_ACCESSIBLE_SEATS.has(code),
        };
      })
    );
  }, [section]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded px-1 text-sm font-medium text-amber-50/70 transition-colors duration-150 hover:text-amber-50 focus-ring"
        >
          <span aria-hidden="true">←</span> Back to venue
        </button>
        <p className="text-xs text-amber-50/45">
          {section.rows} rows × {section.seatsPerRow} seats
        </p>
      </div>

      <div className="mt-3">
        <h4 className="font-display text-lg font-semibold text-amber-50">{section.label}</h4>
        <p className={["text-sm", theme.textClass].join(" ")}>
          {theme.label} Reserved Seating · {section.capacity} seats · {formatPrice(ticketType.price)} each
        </p>
      </div>

      <ZoomPanViewport className="mt-4 h-[360px] sm:h-[420px]" maxScale={2.5}>
        <div className="flex w-fit flex-col gap-1">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-1">
              <span className="w-6 shrink-0 text-right text-[10px] text-amber-50/35">R{String(rowIndex + 1).padStart(2, "0")}</span>
              <div className="flex gap-1">
                {row.map((seat) => (
                  <MemoSeat
                    key={seat.code}
                    code={seat.code}
                    sectionLabel={section.key}
                    category={section.category}
                    row={seat.row}
                    seatNumber={seat.seatNumber}
                    price={ticketType.price}
                    unavailable={seat.unavailable}
                    accessible={seat.accessible}
                    selected={selectedCodes.has(seat.code)}
                    onToggle={onToggleSeat}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ZoomPanViewport>
    </div>
  );
}
