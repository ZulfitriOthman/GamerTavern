import { useState } from "react";

function detectWebgl() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

// Lazy initializer runs once on first render, synchronously, before paint —
// no flash of a broken canvas while an effect catches up.
function useWebglSupport() {
  const [supported] = useState(detectWebgl);
  return supported;
}

export default useWebglSupport;
