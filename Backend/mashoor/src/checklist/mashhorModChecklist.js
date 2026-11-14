// Vehicle checklists transcribed from the client's scanned document
// "MASHHOR - MOD CHECKLIST.pdf" (23 pages), checked page by page against the
// scan. Labels, numbering, punctuation and section order are kept as printed,
// including the source's own irregularities:
//   - Forklift, section 3 is numbered 3.1, 3.2, 3.4 … (there is no 3.3).
//   - Large Bus, section 4 has a number but no printed title.
//   - The Large Bus form has no "Next Servicing" line; the other three do.
//   - Battery Voltage is an empty box on the form — no unit is printed.
// Measurement fields are not marked required: the paper form does not say
// which readings are mandatory (staff can change this per template).
//
// Page map:
//   p1  Forklift checklist          p2  Forklift damage diagram
//   p3  Medium Bus (ROSA) checklist p4  Medium Bus damage diagram
//   p5  Large Bus (Ankai) checklist p6  Large Bus damage diagram
//   p7  Double Cab (Hilux) checklist p8 Double Cab damage diagram
//   p9–p23 "Summary Vehicles Checklist – MINDEF Project" fleet registers
//          (vehicle / MOD registration numbers with Remark / Action columns,
//          "Acknowledge by: Ali bin Haji Abd Rahman, Head of Operations").
//          These are lists of vehicles, not checklist templates, and are not
//          imported.

const SOURCE = 'MASHHOR - MOD CHECKLIST.pdf'

const HEADER = {
  companyName: 'MASHHOR GENERAL CONTRACTOR SDN BHD',
  subtitle: 'LEASING SERVICES FOR THE ROYAL BRUNEI ARMED FORCES AND MINISTRY OF DEFENCE PROJECT',
  showLogos: true,
}

// Mark : (/) Satisfactory   (x) Defect   (N/A) Not Applicable   (M) Missing
const LEGEND = [
  { value: '/', label: 'Satisfactory' },
  { value: 'x', label: 'Defect' },
  { value: 'N/A', label: 'Not Applicable' },
  { value: 'M', label: 'Missing' },
]

const SIGNOFF = {
  checked_by: { caption: 'MGCSB, Inspector', printedName: '' },
  agreed_by: { caption: 'MINDEF', printedName: '' },
  approved_by: { caption: 'Head of Operations', printedName: 'Ali Hj Abd Rahman' },
}

const DAMAGE_NOTE = 'Please indicate clearly on the diagram below the position of damaged, scratched or dented'

// The default project line is printed on every form; it is a default only.
const details = (model) => [
  { key: 'model', default: model, required: true },
  { key: 'mileage', default: '', required: true },
  { key: 'date', default: '', required: true },
  { key: 'location', default: '', required: true },
  { key: 'divProject', default: 'Berakas Office / MINDEF Project', required: true },
]

const TYRE = [
  { key: 'tread', label: 'Tread Depth', unit: 'MM', layout: 'axle', required: false },
  { key: 'pressure', label: 'Inflation Pressure', unit: 'PSI', layout: 'axle', required: false },
]
const VOLTAGE = [{ key: 'voltage', label: '', unit: '', layout: 'single', required: false }]

const item = (number, label, extra = {}) => ({ number, label, status: true, measurements: [], ...extra })
const group = (number, label, children) => ({
  number,
  label,
  status: false,
  measurements: [],
  children: children.map((childLabel) => ({ number: '', label: childLabel, status: true, measurements: [] })),
})

// Stable keys: <prefix>-<item number>, nested items <parent key>-<n>.
function withKeys(prefix, sections) {
  return sections.map((section, s) => ({
    ...section,
    key: `${prefix}-s${s + 1}`,
    items: section.items.map((it) => {
      const k = `${prefix}-${it.number.replace(/\.$/, '')}`
      return { ...it, key: k, children: (it.children ?? []).map((child, c) => ({ ...child, key: `${k}-${c + 1}` })) }
    }),
  }))
}

const FORKLIFT = {
  seedKey: 'mashhor-mod/forklift',
  vehicleType: 'FORKLIFT',
  name: 'MOD Vehicle Checklist — Forklift',
  diagramSeedKey: 'mashhor-mod/diagram/forklift',
  definition: {
    header: { ...HEADER, title: 'VEHICLE CHECKLIST –' },
    details: details('Forklift'),
    statusLegend: LEGEND,
    sections: withKeys('fl', [
      {
        number: '1.',
        title: 'Exterior',
        column: 1,
        items: [
          item('1.1', 'License Plate'),
          item('1.2', 'Side Mirror (Left&Right)'),
          item('1.3', 'Tire ;', { measurements: TYRE }),
          item('1.4', 'First Aid Kit'),
          item('1.5', 'Fire Extinguisher'),
          item('1.6', 'Seat Belt'),
        ],
      },
      {
        number: '2.',
        title: 'Before Turning Ignition Key (Engine)',
        column: 1,
        items: [
          item('2.1', 'Accelerator'),
          item('2.2', 'Motor Oil Level'),
          item('2.3', 'Coolant Level'),
          item('2.4', 'Brake Fluids'),
          item('2.5', 'Steering'),
          item('2.6', 'Battery Voltage', { measurements: VOLTAGE }),
          item('2.7', 'Fuel Level'),
        ],
      },
      {
        number: '3.',
        title: 'After Starting The Engine',
        column: 2,
        items: [
          item('3.1', 'Engine Start Key'),
          item('3.2', 'Hoses'),
          item('3.4', 'Hydraulic Controls'),
          item('3.5', 'Forks'),
          item('3.6', 'Foot Brake'),
          item('3.7', 'Steering Operations'),
          item('3.8', 'Horn'),
          group('3.9', 'Lights :', ['Head Light', 'Tail Light', 'Emergency Light', 'Warning Light', 'Turn Signal Indicator', 'Reverse Light', 'Brake Light']),
        ],
      },
    ]),
    footer: { remarks: true, nextServicing: true },
    signoff: SIGNOFF,
    damage: { enabled: true, note: DAMAGE_NOTE },
    source: `${SOURCE} — page 1 (checklist), page 2 (damage diagram)`,
  },
}

// Sections 1 and 2 are shared by the bus and double-cab forms, apart from the
// spelling of "Toolbox" / "Tool Box".
const exteriorSections = (toolbox) => [
  {
    number: '1.',
    title: `Exterior & Inside ${toolbox}`,
    column: 1,
    items: [
      item('1.1', 'Road Tax (Availability & Validity)'),
      item('1.2', 'License Plate'),
      item('1.3', 'Side Mirror (Left & Right)'),
      item('1.4', 'Rearview Mirror'),
      item('1.5', 'Vehicle Body (Refer to Diagram)'),
      item('1.6', 'Tire ;', { measurements: TYRE }),
      item('1.7', 'First Aid Kit'),
      item('1.8', 'Warning Triangle'),
      item('1.9', 'Fire Extinguisher'),
      item('1.10', 'Seat Belt (Driver, Front & Rear Passenger)'),
      item('1.11', 'Rear Camera'),
    ],
  },
  {
    number: '2.',
    title: 'Before Turning Ignition Key (Engine)',
    column: 1,
    items: [
      item('2.1', 'Motor Oil Level'),
      item('2.2', 'Coolant Level'),
      item('2.3', 'Brake Fluids'),
      item('2.4', 'Battery Water Level'),
      item('2.5', 'Battery Voltage', { measurements: VOLTAGE }),
      item('2.6', 'Wiper & Windshield Fluid'),
    ],
  },
]

const afterStarting = (lamps) => ({
  number: '3.',
  title: 'After Starting The Engine',
  column: 2,
  items: [
    item('3.1', 'Engine Start Key / Remote'),
    item('3.2', 'Central Lock'),
    item('3.3', 'Power Window'),
    item('3.4', 'Service Information'),
    item('3.5', 'Radio & Tape / CD Player'),
    item('3.6', 'Air Conditioner / Heater'),
    group('3.7', 'Brake Operations;', ['Hand Brake, Foot Brake & ABS']),
    item('3.8', 'Steering Operations'),
    item('3.9', 'Horn'),
    group('3.10', 'Lamps (Function) ;', lamps),
  ],
})

const MEDIUM_BUS = {
  seedKey: 'mashhor-mod/medium-bus',
  vehicleType: 'MEDIUM BUS',
  name: 'MOD Vehicle Checklist — Medium Bus (ROSA, 22 seaters)',
  diagramSeedKey: 'mashhor-mod/diagram/medium-bus',
  definition: {
    header: { ...HEADER, title: 'VEHICLE CHECKLIST –' },
    details: details('ROSA (Medium Bus 22 seaters)'),
    statusLegend: LEGEND,
    sections: withKeys('mb', [
      ...exteriorSections('Toolbox'),
      afterStarting(['Interior Light', 'Emergency Light', 'Head Light', 'Taillight', 'Turn Signal Indicator', 'Warning Light', 'Brake Light', 'Reverse Light']),
    ]),
    footer: { remarks: true, nextServicing: true },
    signoff: SIGNOFF,
    damage: { enabled: true, note: DAMAGE_NOTE },
    source: `${SOURCE} — page 3 (checklist), page 4 (damage diagram)`,
  },
}

const LARGE_BUS = {
  seedKey: 'mashhor-mod/large-bus',
  vehicleType: 'LARGE BUS',
  name: 'MOD Vehicle Checklist — Large Bus (Ankai, 45 seaters)',
  diagramSeedKey: 'mashhor-mod/diagram/large-bus',
  definition: {
    header: { ...HEADER, title: 'VEHICLE CHECKLIST –' },
    details: details('Ankai (Large Bus 45 seaters)'),
    statusLegend: LEGEND,
    sections: withKeys('lb', [
      ...exteriorSections('Tool Box'),
      afterStarting([
        'Interior Light',
        'Emergency Light',
        'Head Light',
        'Tail Light',
        'Turn Signal Indicator',
        'Warning Light',
        'Brake Light',
        'Reverse Light',
        'Parking & License Plate Light',
      ]),
      // Printed as "4." with no section title.
      { number: '4.', title: '', column: 2, items: [item('4.1', 'TV'), item('4.2', 'Microphone'), item('4.3', 'CCTV')] },
    ]),
    footer: { remarks: true, nextServicing: false },
    signoff: SIGNOFF,
    damage: { enabled: true, note: DAMAGE_NOTE },
    source: `${SOURCE} — page 5 (checklist), page 6 (damage diagram)`,
  },
}

const DOUBLE_CAB = {
  seedKey: 'mashhor-mod/double-cab-hilux',
  vehicleType: 'DOUBLE CAB HILUX',
  name: 'MOD Vehicle Checklist — Double Cab (Hilux)',
  diagramSeedKey: 'mashhor-mod/diagram/double-cab',
  definition: {
    header: { ...HEADER, title: 'VEHICLE CHECKLIST -' },
    details: details('DOUBLE CAB (HILUX)'),
    statusLegend: LEGEND,
    sections: withKeys('dc', [
      ...exteriorSections('Tool Box'),
      afterStarting([
        'Interior Light',
        'Emergency Light',
        'Head Light',
        'Tail Light',
        'Turn Signal Indicator',
        'Warning Light',
        'Brake Light',
        'Reverse Light',
        'Parking & License Plate Light',
      ]),
    ]),
    footer: { remarks: true, nextServicing: true },
    signoff: SIGNOFF,
    damage: { enabled: true, note: DAMAGE_NOTE },
    source: `${SOURCE} — page 7 (checklist), page 8 (damage diagram)`,
  },
}

// Diagrams cropped from the scanned pages (light scanner show-through removed),
// shipped in Backend/mashoor/assets/checklist-diagrams.
export const MASHHOR_MOD_DIAGRAMS = [
  { seedKey: 'mashhor-mod/diagram/forklift', name: 'Forklift', vehicleType: 'FORKLIFT', file: 'asset:forklift.jpg', source: `${SOURCE}, page 2` },
  { seedKey: 'mashhor-mod/diagram/medium-bus', name: 'Medium Bus (ROSA)', vehicleType: 'MEDIUM BUS', file: 'asset:medium-bus.jpg', source: `${SOURCE}, page 4` },
  { seedKey: 'mashhor-mod/diagram/large-bus', name: 'Large Bus (Ankai)', vehicleType: 'LARGE BUS', file: 'asset:large-bus.jpg', source: `${SOURCE}, page 6` },
  { seedKey: 'mashhor-mod/diagram/double-cab', name: 'Double Cab (Hilux)', vehicleType: 'DOUBLE CAB HILUX', file: 'asset:double-cab.jpg', source: `${SOURCE}, page 8` },
]

export const MASHHOR_MOD_TEMPLATES = [FORKLIFT, MEDIUM_BUS, LARGE_BUS, DOUBLE_CAB]
