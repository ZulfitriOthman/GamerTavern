import mavicImage from "../../assets/images/drone-mavic-air-2s.jpg";
import speedybeeImage from "../../assets/images/drone-speedybee-master-5-v2.jpg";

// Highlight clips are web-optimized exports (H.264, 1080p, faststart) generated
// from the raw camera masters in assets/videos/ (kept out of git, source archive
// only). See assets/videos/web/README.md for how these were produced.
import jameClip from "../../assets/videos/web/jame-hassanil-bolkiah-mosque.mp4";
import jamePoster from "../../assets/images/poster-jame-hassanil-bolkiah-mosque.jpg";
import kampongAyerClip from "../../assets/videos/web/kampong-ayer.mp4";
import kampongAyerPoster from "../../assets/images/poster-kampong-ayer.jpg";
import hyperlapseRoundaboutClip from "../../assets/videos/web/hyperlapse-roundabout.mp4";
import hyperlapseRoundaboutPoster from "../../assets/images/poster-hyperlapse-roundabout.jpg";
import hyperlapseOrbitClip from "../../assets/videos/web/hyperlapse-orbit.mp4";
import hyperlapseOrbitPoster from "../../assets/images/poster-hyperlapse-orbit.jpg";
import tekoClip from "../../assets/videos/web/teko-roundabout.mp4";
import tekoPoster from "../../assets/images/poster-teko-roundabout.jpg";

export const fleet = [
  {
    id: "mavic-air-2s",
    name: "DJI Mavic Air 2S",
    role: "Versatile Aerial Cinematography Drone",
    tagline: "Cinematic aerial platform",
    primary: true,
    image: mavicImage,
    imageAlt: "DJI Mavic Air 2S drone, studio product shot",
    keyStats: [
      { value: "5.4K", label: "Video" },
      { value: "1-inch", label: "Sensor" },
    ],
    specs: [
      { label: "Camera", value: "5.4K video / 20MP photos" },
      { label: "Sensor", value: "1-inch CMOS" },
      { label: "Flight Time", value: "up to 31 minutes" },
      { label: "Wind Resistance", value: "up to 36 kph" },
      { label: "Use Cases", value: "real estate, events, general aerials" },
      { label: "Special Features", value: "obstacle sensing, intelligent flight modes" },
      { label: "Portability", value: "compact foldable design" },
      { label: "Safety", value: "GPS return-to-home" },
    ],
    // Approximate marker positions (% of image width/height) over the studio
    // product photo — visual pointers to the relevant area, not engineering-
    // precise coordinates. Each references a real spec label above, no new claims.
    hotspots: [
      { id: "sensor", label: "Camera & Sensor", specLabel: "Sensor", top: 70, left: 49 },
      { id: "features", label: "Obstacle Sensing", specLabel: "Special Features", top: 42, left: 49 },
      { id: "flight-time", label: "Flight Time", specLabel: "Flight Time", top: 27, left: 50 },
    ],
  },
  {
    id: "speedybee-master-5",
    name: "FPV SpeedyBee Master 5 V2",
    role: "High-Speed FPV Racing and Dynamic Cinematic Drone",
    tagline: "Freestyle & racing platform",
    primary: false,
    image: speedybeeImage,
    imageAlt: "FPV SpeedyBee Master 5 V2 drone packed with its LiPo-safe case",
    keyStats: [
      { value: "4K", label: "Video" },
      { value: "15 min", label: "Flight Time" },
    ],
    specs: [
      { label: "Camera", value: "4K video / 12MP photos" },
      { label: "Flight Time", value: "up to 15 minutes" },
      { label: "Wind Resistance", value: "up to 20 kph" },
      { label: "Use Cases", value: "FPV racing, dynamic cinematic shots" },
      { label: "Special Features", value: "first-person view (FPV) flight, agile maneuvering" },
      { label: "Portability", value: "compact and lightweight" },
      { label: "Safety", value: "failsafe return-to-home on signal loss" },
    ],
  },
];

export const highlights = [
  {
    src: jameClip,
    poster: jamePoster,
    caption: "Jame' Asr Hassanil Bolkiah Mosque",
    location: "Bandar Seri Begawan",
    description: "An aerial pass over the Jame' Asr Hassanil Bolkiah Mosque, one of Brunei's landmark buildings.",
  },
  {
    src: kampongAyerClip,
    poster: kampongAyerPoster,
    caption: "Kampong Ayer",
    location: "Bandar Seri Begawan",z 
    description: "An aerial pass over Kampong Ayer, the historic stilt settlement on the Brunei River.",
  },
  {
    src: hyperlapseRoundaboutClip,
    poster: hyperlapseRoundaboutPoster,
    caption: "City Roundabout Hyperlapse",
    location: "Bandar Seri Begawan",
    description: "A hyperlapse sequence capturing traffic flow and city movement from above.",
  },
  {
    src: hyperlapseOrbitClip,
    poster: hyperlapseOrbitPoster,
    caption: "Orbit Hyperlapse",
    location: "Brunei",
    description: "A rotating orbit hyperlapse used to show scale and layout around a fixed point of interest.",
  },
  {
    src: tekoClip,
    poster: tekoPoster,
    caption: "Teko Roundabout",
    location: "Bandar Seri Begawan",
    description: "A hyperlapse study of the Teko (teapot) roundabout, one of Bandar Seri Begawan's landmark intersections.",
  },
];

// Permanent player at the top of the Work page. No dedicated featured cut exists
// yet, so this temporarily reuses the first highlight clip — swap src/poster/copy
// here once a final featured film is delivered. WorkPage hides whichever highlight
// shares this src from the Highlight Reels grid, so it isn't shown twice.
export const featuredFilm = {
  ...highlights[0],
  title: highlights[0].caption,
};

export const services = [
  {
    category: "Media Production",
    items: [
      {
        title: "Pre-Flight Planning",
        copy: "Location scouting, airspace checks, weather assessment, and mission design.",
      },
      {
        title: "Aerial Capture",
        copy: "Smooth, stable footage and high-resolution images with safe, compliant operation.",
      },
      {
        title: "Post Production",
        copy: "Color grading, shot selection, and export for social, broadcast, or internal reporting.",
      },
      {
        title: "Cinematic FPV Flythroughs",
        copy: "Dynamic interior and exterior one-take flights for hotels, venues, gyms, and branded spaces.",
      },
      {
        title: "Event Aerial Coverage",
        copy: "Concerts, festivals, sports, and private events covered with safe perimeter-aware flight operations.",
      },
      {
        title: "Tourism and Destination Content",
        copy: "Showcase videos and social-ready reels for resorts, attractions, and city marketing campaigns.",
      },
      {
        title: "Brand Commercial Production",
        copy: "Storyboard-driven aerial footage integrated into ads, launch videos, and campaign assets.",
      },
      {
        title: "Automotive Rolling Shots",
        copy: "Controlled chase footage and cinematic reveal angles for dealerships, collectors, and automotive media.",
      },
      {
        title: "Live Event Streaming Feeds",
        copy: "Aerial video feed integration support for productions requiring real-time overhead angles.",
      },
    ],
  },
  {
    category: "Property & Infrastructure",
    items: [
      {
        title: "Real Estate Photo and Video",
        copy: "Property flyovers, neighborhood context shots, and polished listing visuals for residential and commercial spaces.",
      },
      {
        title: "Construction Progress Monitoring",
        copy: "Recurring site captures to track milestones, document changes, and support stakeholder reporting.",
      },
      {
        title: "Roof and Facade Inspections",
        copy: "Close visual checks for shingles, flashing, drainage, and exterior surfaces without risky manual climbs.",
      },
      {
        title: "Infrastructure Inspection",
        copy: "Aerial review support for bridges, towers, and utility corridors with clear visual documentation.",
      },
      {
        title: "Marina and Waterfront Coverage",
        copy: "Boat, shoreline, and coastal visual packages for tourism, real estate, and promotional use.",
      },
    ],
  },
  {
    category: "Mapping & Data",
    items: [
      {
        title: "Solar Panel Inspection",
        copy: "Panel condition surveys and hotspot scouting support to identify performance-impacting issues quickly.",
      },
      {
        title: "Land and Property Mapping",
        copy: "Orthomosaic-ready capture workflows for acreage overviews, planning, and site documentation.",
      },
      {
        title: "Volumetric Stockpile Estimates",
        copy: "Aerial data capture support for aggregate, soil, and material stock analysis workflows.",
      },
      {
        title: "Agriculture Field Surveys",
        copy: "Field pattern and crop-condition overview captures for farm planning and seasonal reporting.",
      },
    ],
  },
  {
    category: "Specialized & Response",
    items: [
      {
        title: "Insurance Claim Documentation",
        copy: "Post-storm and incident visual evidence capture to support faster claim reviews and records.",
      },
      {
        title: "Emergency Response Overwatch",
        copy: "Rapid situational aerial views to support command teams during drills and live incident coordination.",
      },
      {
        title: "Search Area Recon Support",
        copy: "Structured sweep footage for large-area visual review in support of ground response teams.",
      },
      {
        title: "Night Operation Capture",
        copy: "Low-light and twilight operations performed under compliant procedures for specialized visual needs.",
      },
      {
        title: "Training and Consultation",
        copy: "Operational workflow consulting, content strategy guidance, and mission planning best-practice sessions.",
      },
    ],
  },
];
