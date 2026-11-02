import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "../../hooks/useReducedMotion";

// Inner 3D Scene Components
function ResearchNodeCore({ mouse }: { mouse: React.MutableRefObject<[number, number]> }) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  // Generate scientific node positions
  const { nodePositions, linePositions } = useMemo(() => {
    const count = 38;
    const positions: [number, number, number][] = [];
    const radius = 1.75;

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = radius * (0.85 + Math.random() * 0.28);
      positions.push([
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi),
      ]);
    }

    // Connect close neighbors
    const lines: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        const dz = positions[i][2] - positions[j][2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1.45) {
          lines.push(...positions[i], ...positions[j]);
        }
      }
    }

    return {
      nodePositions: positions,
      linePositions: new Float32Array(lines),
    };
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Slow rotation
    groupRef.current.rotation.y += delta * 0.15;
    groupRef.current.rotation.x += delta * 0.05;

    // Subtle mouse tilt
    const targetX = mouse.current[1] * 0.3;
    const targetY = mouse.current[0] * 0.3;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.05);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.05);

    // Orbital rings spin opposite
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.2;
      ring1Ref.current.rotation.x += delta * 0.1;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 0.25;
      ring2Ref.current.rotation.y += delta * 0.15;
    }

    // Gentle breathing pulse for core
    if (coreRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.04;
      coreRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central Geometric Research Nucleus */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial
          color="#10b981"
          wireframe
          emissive="#00ff88"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Inner Glowing Crystal Core */}
      <mesh>
        <octahedronGeometry args={[0.55, 0]} />
        <meshBasicMaterial color="#00ff88" wireframe />
      </mesh>

      {/* Orbital Scientific Rings - Scaled to preserve visual clearance */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[2.05, 0.015, 16, 120]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.45} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[2.35, 0.012, 16, 120]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
      </mesh>

      {/* Floating Network Nodes */}
      {nodePositions.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial
            color={idx % 3 === 0 ? "#00ff88" : idx % 3 === 1 ? "#38bdf8" : "#a7f3d0"}
            emissive={idx % 3 === 0 ? "#00ff88" : "#38bdf8"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      {/* Interconnecting Research Lines */}
      {linePositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#10b981" transparent opacity={0.22} />
        </lineSegments>
      )}
    </group>
  );
}

// Fallback CSS/SVG Visualizer when WebGL or 3D is not active
const Fallback2DVisual: React.FC = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-72 h-72 rounded-full border border-emerald-500/30 flex items-center justify-center animate-spin-slow">
        <div className="w-56 h-56 rounded-full border border-cyan-500/30 border-dashed animate-reverse" />
        <div className="absolute w-40 h-40 rounded-full border border-emerald-400/50 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-300 shadow-neon-green flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />
    </div>
  );
};

export const HeroResearchScene: React.FC<{ className?: string }> = ({ className = "" }) => {
  const reducedMotion = useReducedMotion();
  const [hasWebGL, setHasWebGL] = useState(true);
  const mouse = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.current = [x, y];
  };

  if (!hasWebGL || reducedMotion) {
    return (
      <div className={`relative ${className}`}>
        <Fallback2DVisual />
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      onPointerMove={handlePointerMove}
      aria-label="Interactive 3D Scientific Knowledge Network"
    >
      <Canvas
        camera={{ position: [0, 0, 8.8], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ pointerEvents: "auto", width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#00ff88" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#06b6d4" />
        <spotLight position={[0, 8, 4]} intensity={1.5} color="#ffffff" angle={0.6} />

        <ResearchNodeCore mouse={mouse} />
      </Canvas>
      {/* Subtle depth gradient glow behind the canvas */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40" />
    </div>
  );
};
