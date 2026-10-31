import { useState } from "react";
import ZoomPanViewport from "./ZoomPanViewport.jsx";
import { CATEGORY_THEME } from "./seatMapTheme.js";

// Non-interactive wayfinding geometry — stage, wings, FOH, aisles, entrances, exits,
// egress. Never a selection target.
function LayoutElement({ element }) {
  const isStage = element.type === "stage";
  const isPath = element.type === "aisle" || element.type === "egress";
  return (
    <g>
      <rect
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rx={isPath ? 4 : 10}
        className={isStage ? "fill-white/10 stroke-white/20" : "fill-white/[0.04] stroke-white/10"}
        strokeWidth={1}
      />
      {element.label ? (
        <text
          x={element.x + element.width / 2}
          y={element.y + element.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className={isStage ? "fill-amber-50/80" : "fill-amber-50/40"}
          style={{ fontSize: isStage ? 22 : 11, letterSpacing: isStage ? 4 : 1 }}
        >
          {element.label}
        </text>
      ) : null}
    </g>
  );
}

// One selectable zone (GA or a reserved section). Click/tap is the primary
// interaction and always enters the zone immediately (matches the product
// requirement that tap must be primary, not a two-step hover-then-tap affordance);
// hover is a desktop-only bonus preview, handled by the parent.
function Zone({ zone, isHovered, onEnter, onHover }) {
  const theme = CATEGORY_THEME[zone.category];
  const subtitle = zone.category === "general_admission" ? "General Admission" : `${theme.label} · ${zone.capacity} seats`;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${zone.label} — ${subtitle}`}
      className="cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      onMouseEnter={() => onHover(zone.key)}
      onFocus={() => onHover(zone.key)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onEnter(zone)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEnter(zone);
        }
      }}
    >
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        rx={12}
        className={[theme.fillClass, isHovered ? theme.activeStrokeClass : theme.strokeClass, "transition-colors duration-150"].join(" ")}
        strokeWidth={isHovered ? 2.5 : 1.5}
      />
      <text x={zone.x + zone.width / 2} y={zone.y + zone.height / 2 - 12} textAnchor="middle" className="fill-amber-50" style={{ fontSize: 22, fontWeight: 600 }}>
        {zone.label}
      </text>
      <text x={zone.x + zone.width / 2} y={zone.y + zone.height / 2 + 16} textAnchor="middle" className={theme.textClass} style={{ fontSize: 14 }}>
        {subtitle}
      </text>
    </g>
  );
}

// Venue overview — section/GA polygons only, no individual seats (see performance
// note in SeatMap.jsx: up to 1,560 seats never render at this level).
export default function VenueMap({ venue, onEnterZone }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const zones = [venue.ga, ...venue.sections];
  const hovered = zones.find((zone) => zone.key === hoveredKey) || null;

  return (
    <div>
      <ZoomPanViewport className="aspect-[1120/1020]">
        <svg viewBox={`0 0 ${venue.canvasWidth} ${venue.canvasHeight}`} role="img" aria-label={`${venue.name} — venue overview, tap a section to select seats`} className="w-full max-w-3xl">
          {venue.elements.map((element, index) => (
            <LayoutElement key={index} element={element} />
          ))}
          {zones.map((zone) => (
            <Zone key={zone.key} zone={zone} isHovered={hoveredKey === zone.key} onEnter={onEnterZone} onHover={setHoveredKey} />
          ))}
        </svg>
      </ZoomPanViewport>

      <p className="mt-3 min-h-[1.25rem] text-center text-xs text-amber-50/45">
        {hovered ? `${hovered.label} — ${hovered.category === "general_admission" ? "General Admission" : `${CATEGORY_THEME[hovered.category].label} · ${hovered.capacity} seats`}` : "Tap a section to select seats, or Standing Floor for general admission."}
      </p>
    </div>
  );
}
