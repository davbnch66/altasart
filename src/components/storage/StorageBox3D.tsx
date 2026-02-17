import { useRef, useState, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

const BOX_W = 1.84;
const BOX_H = 1.84;
const BOX_D = 1.84;

const statusColors: Record<string, string> = {
  libre: "#4ade80",
  occupe: "#60a5fa",
  reserve: "#facc15",
};

interface StorageBox3DProps {
  position: [number, number, number];
  status: string;
  isSelected: boolean;
  onClick: () => void;
}

export const StorageBox3D = ({
  position,
  status,
  isSelected,
  onClick,
}: StorageBox3DProps) => {
  const [hovered, setHovered] = useState(false);

  const baseColor = statusColors[status] || "#94a3b8";
  const color = isSelected ? "#f97316" : hovered ? "#e2e8f0" : baseColor;

  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D)), []);

  return (
    <group position={position}>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      >
        <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
        <meshLambertMaterial
          color={color}
          transparent
          opacity={status === "libre" ? 0.25 : 0.8}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={isSelected ? "#f97316" : "#475569"} />
      </lineSegments>
    </group>
  );
};
