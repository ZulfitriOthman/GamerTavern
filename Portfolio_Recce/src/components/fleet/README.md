# Fleet showcase components

- `DroneShowcase.jsx` — the primary-drone product card: layout, key stats,
  expandable full spec sheet. Used once in `FleetPage.jsx` for the drone
  flagged `primary: true` in `pageData.js`.
- `DroneFallback.jsx` — the interactive visual: a real studio photo with
  pointer-driven tilt/parallax, a spotlight highlight, and clickable spec
  hotspots. This is a **pseudo-3D presentation**, not a 3D model.

## Why no real 3D model

No `.glb`/`.gltf`/`.obj`/`.fbx`/`.usdz` file exists anywhere in this repo or
the wider monorepo (checked before writing any of this). Rather than fabricate
a drone model and present it as an exact DJI Mavic Air 2S, or pull an
unverified-license file from a model marketplace, this uses the real product
photo already in the project with a tilt/parallax treatment instead. That's
accurate; a guessed 3D model would not be.

## Dropping in a real `.glb` later

If Recce (or a future contributor) obtains a properly licensed, accurate
model of a drone actually in the fleet:

1. Add `@react-three/fiber` and `@react-three/drei` to `package.json` — not
   before, since nothing here uses them yet and there's no reason to ship
   the extra ~150KB+ of JS for a component that renders a fallback.
2. Create `DroneModelViewer.jsx` next to this file: a `<Canvas>` with the
   model loaded via `useGLTF`, wrapped in `React.lazy` + `Suspense` so it
   only loads when the Fleet section is actually visible (see the
   `IntersectionObserver` pattern already used for `.reveal` in `App.jsx`
   for a ready-made "is this in view" hook to reuse).
3. In `DroneShowcase.jsx`, branch on a `drone.modelSrc` field: render
   `DroneModelViewer` inside `Suspense` (fallback: `<DroneFallback />`) when
   a model path exists, otherwise keep rendering `DroneFallback` as today.
4. Keep the hotspot data (`drone.hotspots`) — it's UI data, not tied to the
   2D image, and can drive hotspots on the 3D model too.
5. Test WebGL failure explicitly (disable hardware acceleration in Chrome)
   and confirm it falls back to `DroneFallback` rather than a blank canvas.
