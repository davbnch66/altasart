import { useState, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
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
  label: string;
  clientName?: string;
  onClick: () => void;
}

export const StorageBox3D = ({
  position,
  status,
  isSelected,
  label,
  clientName,
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

      {/* Tooltip on hover */}
      {hovered && !isSelected && (
        <Html position={[0, BOX_H / 2 + 0.3, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
          <div style={{
            background: "rgba(0,0,0,0.85)", color: "#fff", borderRadius: 6,
            padding: "4px 8px", fontSize: 11, whiteSpace: "nowrap", fontFamily: "sans-serif",
          }}>
            <strong>{label}</strong>
            {clientName && <span style={{ opacity: 0.7, marginLeft: 4 }}>· {clientName}</span>}
          </div>
        </Html>
      )}

      {/* Label on selected */}
      {isSelected && (
        <Html position={[0, BOX_H / 2 + 0.3, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
          <div style={{
            background: "#f97316", color: "#fff", borderRadius: 6,
            padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap", fontWeight: 600, fontFamily: "sans-serif",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            {label}
            {clientName && <span style={{ opacity: 0.8, marginLeft: 4, fontWeight: 400 }}>· {clientName}</span>}
          </div>
        </Html>
      )}
    </group>
  );
};
