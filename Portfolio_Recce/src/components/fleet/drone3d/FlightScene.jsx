import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Line } from "@react-three/drei";
import * as THREE from "three";
import DroneRig from "./DroneRig";

const HOVER_POINT = new THREE.Vector3(0, 0.35, 0);
const FLIGHT_DURATION = 4.4;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function buildCurve(isMobile) {
  const points = isMobile
    ? [
        new THREE.Vector3(-3.2, 1.1, -5.2),
        new THREE.Vector3(-1.2, 0.5, -1.8),
        new THREE.Vector3(0.4, 0.6, -1.2),
        HOVER_POINT.clone(),
      ]
    : [
        new THREE.Vector3(-4.6, 1.4, -6.5),
        new THREE.Vector3(-2.6, 0.9, -3.6),
        new THREE.Vector3(-0.6, 0.25, -0.7),
        new THREE.Vector3(1.7, 0.95, -2.3),
        new THREE.Vector3(0.7, 0.55, -1.6),
        HOVER_POINT.clone(),
      ];
  return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
}

function FlightScene({ reducedMotion, isMobile, pointerRef }) {
  const { camera } = useThree();
  const droneRef = useRef(null);
  const lineMaterialRef = useRef(null);
  const [flightDone, setFlightDone] = useState(reducedMotion);

  const curve = useMemo(() => buildCurve(isMobile), [isMobile]);
  const linePoints = useMemo(() => curve.getPoints(40), [curve]);

  const clockRef = useRef(0);
  const yawRef = useRef(0);
  const rollRef = useRef(0);
  const pitchRef = useRef(0);
  const prevPointRef = useRef(curve.getPoint(0).clone());
  const lookTargetRef = useRef(HOVER_POINT.clone());

  useFrame((state, rawDelta) => {
    if (!droneRef.current) return;
    const delta = Math.min(rawDelta, 1 / 30);
    const t = state.clock.elapsedTime;

    if (reducedMotion) {
      droneRef.current.position.copy(HOVER_POINT);
      droneRef.current.position.y += Math.sin(t * 0.6) * 0.015;
      droneRef.current.rotation.set(Math.sin(t * 0.35) * 0.01, Math.sin(t * 0.15) * 0.02, Math.sin(t * 0.4) * 0.012);

      const desiredCam = new THREE.Vector3(1.6, 0.9, 3.2);
      camera.position.lerp(desiredCam, 0.03);
      lookTargetRef.current.lerp(HOVER_POINT, 0.05);
      camera.lookAt(lookTargetRef.current);
      return;
    }

    clockRef.current += delta;
    const rawT = Math.min(clockRef.current / FLIGHT_DURATION, 1);
    const easedT = easeInOutCubic(rawT);
    const sampleT = Math.min(easedT, 0.999);

    const point = curve.getPointAt(sampleT);
    const tangent = curve.getTangentAt(sampleT).normalize();

    droneRef.current.position.copy(point);

    const speed = point.distanceTo(prevPointRef.current) / Math.max(delta, 0.0001);
    prevPointRef.current.copy(point);

    const targetYaw = Math.atan2(tangent.x, tangent.z);
    const yawDiff = THREE.MathUtils.euclideanModulo(targetYaw - yawRef.current + Math.PI, Math.PI * 2) - Math.PI;
    yawRef.current += yawDiff * 0.08;

    const turnRate = rawT < 1 ? yawDiff / Math.max(delta, 0.0001) : 0;
    const targetRoll = THREE.MathUtils.clamp(-turnRate * 0.1, -0.4, 0.4);
    rollRef.current = THREE.MathUtils.lerp(rollRef.current, rawT < 1 ? targetRoll : 0, 0.06);

    const speedFactor = THREE.MathUtils.clamp(speed / 6, 0, 1);
    const targetPitch = rawT < 0.96 ? -speedFactor * 0.2 : 0;
    pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, targetPitch, 0.06);

    if (rawT >= 1) {
      droneRef.current.position.y += Math.sin(t * 0.9) * 0.02;
      droneRef.current.rotation.set(
        pitchRef.current + Math.sin(t * 0.35) * 0.006,
        yawRef.current + Math.sin(t * 0.2) * 0.01,
        rollRef.current + Math.sin(t * 0.5) * 0.008
      );
      if (!flightDone) setFlightDone(true);
    } else {
      droneRef.current.rotation.set(pitchRef.current, yawRef.current, rollRef.current);
    }

    if (lineMaterialRef.current) {
      lineMaterialRef.current.opacity = THREE.MathUtils.lerp(0.22, 0, Math.min(rawT * 1.4, 1));
    }

    const camFollow = rawT < 1 ? 0.022 : 0.02;
    const desiredCamPos =
      rawT < 1
        ? new THREE.Vector3(point.x + 1.1, point.y + 0.85, point.z + 3.1)
        : new THREE.Vector3(
            1.6 + (pointerRef?.current?.x ?? 0) * 0.35,
            0.9 + (pointerRef?.current?.y ?? 0) * 0.18,
            3.2
          );
    camera.position.lerp(desiredCamPos, camFollow);
    lookTargetRef.current.lerp(rawT < 1 ? point : HOVER_POINT, 0.06);
    camera.lookAt(lookTargetRef.current);
  });

  return (
    <>
      <ambientLight intensity={0.55} color="#8fd9ff" />
      <directionalLight position={[3, 4, 2]} intensity={1.15} castShadow={!isMobile} />
      <pointLight position={[-2.2, 0.6, -1.8]} intensity={0.7} color="#27d2ff" />

      <fog attach="fog" args={["#0a0f15", 4, 13]} />

      <group ref={droneRef}>
        <DroneRig />
      </group>

      {!flightDone && (
        <Line
          points={linePoints}
          color="#27d2ff"
          transparent
          opacity={0.22}
          lineWidth={1}
          ref={(line) => {
            if (line?.material) lineMaterialRef.current = line.material;
          }}
        />
      )}

      {!isMobile && (
        <ContactShadows position={[0, -0.42, 0]} opacity={0.3} scale={4} blur={2.2} far={1.1} />
      )}

      <gridHelper args={[16, 16, "#1c3a4a", "#0f1a24"]} position={[0, -0.55, 0]} />
    </>
  );
}

export default FlightScene;
