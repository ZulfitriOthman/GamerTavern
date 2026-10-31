import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import FlightScene from "./FlightScene";

function DroneExperience({ reducedMotion }) {
  const pointerRef = useRef({ x: 0, y: 0 });
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  };

  return (
    <div className="h-full w-full" onPointerMove={handlePointerMove}>
      <Canvas
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 1, 4.6], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        shadows={!isMobile}
      >
        <FlightScene reducedMotion={reducedMotion} isMobile={isMobile} pointerRef={pointerRef} />
      </Canvas>
    </div>
  );
}

export default DroneExperience;
