import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// A procedurally built, stylized quadcopter — not a scan or download of any
// specific commercial drone. No .glb/.gltf/.obj model exists in this repo or
// the wider monorepo (checked before writing this), and no license for a
// third-party drone model could be reliably verified and retrieved with the
// tools available in this environment, so this is authored geometry instead
// of an unverified download. It's presented as a generic visual
// representation, not a claim of exact DJI Mavic Air 2S geometry.
const BODY_COLOR = "#c9ced4";
const DARK_COLOR = "#1b2230";
const ACCENT_COLOR = "#27d2ff";

const ARM_LENGTH = 0.62;
const ARM_ANGLE = Math.PI / 4;

function ArmAndRotor({ angle, spinDirection, frontAccent, spinRef }) {
  const propRef = useRef(null);
  const x = Math.cos(angle) * ARM_LENGTH;
  const z = Math.sin(angle) * ARM_LENGTH;

  useFrame((_, delta) => {
    if (propRef.current) {
      propRef.current.rotation.y += spinDirection * delta * spinRef.current;
    }
  });

  return (
    <group>
      <mesh position={[x / 2, 0, z / 2]} rotation={[0, -angle, 0]}>
        <boxGeometry args={[ARM_LENGTH, 0.045, 0.05]} />
        <meshStandardMaterial color={DARK_COLOR} roughness={0.6} />
      </mesh>

      <mesh position={[x, 0.02, z]}>
        <cylinderGeometry args={[0.06, 0.07, 0.06, 12]} />
        <meshStandardMaterial color={DARK_COLOR} roughness={0.5} />
      </mesh>

      {frontAccent && (
        <mesh position={[x, 0.02, z + Math.sign(z) * 0.04]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={ACCENT_COLOR} emissive={ACCENT_COLOR} emissiveIntensity={2} />
        </mesh>
      )}

      <group ref={propRef} position={[x, 0.06, z]}>
        <mesh>
          <boxGeometry args={[0.24, 0.006, 0.02]} />
          <meshStandardMaterial color={DARK_COLOR} roughness={0.4} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.24, 0.006, 0.02]} />
          <meshStandardMaterial color={DARK_COLOR} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function DroneRig(props) {
  const spinRef = useRef(0);

  useFrame((_, delta) => {
    // Spin ramps up on mount rather than snapping to full speed instantly.
    spinRef.current = Math.min(spinRef.current + delta * 60, 42);
  });

  const arms = [
    { angle: ARM_ANGLE, spinDirection: 1, frontAccent: true },
    { angle: Math.PI - ARM_ANGLE, spinDirection: -1, frontAccent: false },
    { angle: Math.PI + ARM_ANGLE, spinDirection: 1, frontAccent: false },
    { angle: -ARM_ANGLE, spinDirection: -1, frontAccent: true },
  ];

  return (
    <group {...props}>
      <mesh>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.45} metalness={0.1} />
      </mesh>

      <mesh position={[0, -0.18, 0.12]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color={DARK_COLOR} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.18, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 12]} />
        <meshStandardMaterial color={ACCENT_COLOR} emissive={ACCENT_COLOR} emissiveIntensity={0.4} />
      </mesh>

      {arms.map((arm) => (
        <ArmAndRotor key={arm.angle} {...arm} spinRef={spinRef} />
      ))}
    </group>
  );
}

export default DroneRig;
