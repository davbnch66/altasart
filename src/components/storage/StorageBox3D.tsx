import { useRef, useState } from "react";
import { ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const BOX_W = 2;
const BOX_H = 2;
const BOX_D = 2;

const statusColors: Record<string, string> = {
  libre: "#4ade80",
  occupe: "#60a5fa",
  reserve: "#facc15",
};

interface StorageBox3DProps {
  position: [number, number, number];
  label: string;
  status: string;
  clientName?: string;
  isSelected: boolean;
  onClick: () => void;
}

export const StorageBox3D = ({
  position,
  label,
  status,
  clientName,
  isSelected,
  onClick,
}: StorageBox3DProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const baseColor = statusColors[status] || "#94a3b8";
  const color = isSelected ? "#f97316" : hovered ? "#e2e8f0" : baseColor;

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group position={position}>
      {/* Wooden box */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[BOX_W * 0.92, BOX_H * 0.92, BOX_D * 0.92]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.05}
          transparent
          opacity={status === "libre" ? 0.4 : 0.85}
        />
      </mesh>

      {/* Wireframe outline */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_W * 0.92, BOX_H * 0.92, BOX_D * 0.92)]} />
        <lineBasicMaterial color={isSelected ? "#f97316" : "#64748b"} linewidth={1} />
      </lineSegments>

      {/* Label on front face */}
      <Text
        position={[0, 0, BOX_D * 0.47]}
        fontSize={0.3}
        color={isSelected ? "#fff" : "#1e293b"}
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-medium.woff"
      >
        {label}
      </Text>

      {/* Client name below label */}
      {clientName && (
        <Text
          position={[0, -0.4, BOX_D * 0.47]}
          fontSize={0.18}
          color="#475569"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.6}
        >
          {clientName}
        </Text>
      )}

      {/* Selection glow */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
};
