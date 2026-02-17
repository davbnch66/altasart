import { Suspense, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StorageBox3D } from "./StorageBox3D";

const ROWS = 5;
const AISLES = 20;
const LEVELS = 3;
const BOX_SIZE = 2;
const GAP = 0.15;
const AISLE_GAP = 1.2;

interface StorageUnit {
  id: string;
  name: string;
  status: string;
  location?: string;
  client_id?: string;
  clients?: { name: string } | null;
  monthly_rate?: number;
  start_date?: string;
  end_date?: string;
  size_m2?: number;
  volume_m3?: number;
  notes?: string;
}

interface Storage3DViewerProps {
  units: StorageUnit[];
  selectedId: string | null;
  onSelectUnit: (unit: StorageUnit | null) => void;
}

const generateGridMap = () => {
  const map: Record<string, { row: number; aisle: number; level: number }> = {};
  for (let level = 0; level < LEVELS; level++) {
    for (let aisle = 0; aisle < AISLES; aisle++) {
      for (let row = 0; row < ROWS; row++) {
        const name = `${String.fromCharCode(65 + aisle)}${row + 1}-N${level + 1}`;
        map[name] = { row, aisle, level };
      }
    }
  }
  return map;
};

const gridMap = generateGridMap();

const buildUnitLookup = (units: StorageUnit[]) => {
  const lookup: Record<string, StorageUnit> = {};
  units.forEach((u) => { lookup[u.name] = u; });
  return lookup;
};

const Floor = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30, -0.01, 5]} receiveShadow>
    <planeGeometry args={[80, 20]} />
    <meshLambertMaterial color="#e2e8f0" />
  </mesh>
);

const Scene = ({ units, selectedId, onSelectUnit }: Storage3DViewerProps) => {
  const unitLookup = useMemo(() => buildUnitLookup(units), [units]);

  const boxes = useMemo(() => {
    const result: { key: string; name: string; position: [number, number, number]; unit: StorageUnit | null }[] = [];
    Object.entries(gridMap).forEach(([name, { row, aisle, level }]) => {
      const x = aisle * (BOX_SIZE + AISLE_GAP);
      const y = level * (BOX_SIZE + GAP) + BOX_SIZE / 2;
      const z = row * (BOX_SIZE + GAP);
      result.push({ key: name, name, position: [x, y, z], unit: unitLookup[name] || null });
    });
    return result;
  }, [unitLookup]);

  const handleClick = useCallback(
    (unit: StorageUnit | null, name: string) => {
      onSelectUnit(unit || { id: "", name, status: "libre" });
    },
    [onSelectUnit]
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 40, 20]} intensity={0.7} />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={100}
      />

      <Floor />

      {boxes.map((box) => (
        <StorageBox3D
          key={box.key}
          position={box.position}
          status={box.unit?.status || "libre"}
          isSelected={selectedId === (box.unit?.id || box.name)}
          onClick={() => handleClick(box.unit, box.name)}
        />
      ))}
    </>
  );
};

export const Storage3DViewer = ({ units, selectedId, onSelectUnit }: Storage3DViewerProps) => {
  return (
    <div className="w-full h-[600px] rounded-xl border bg-card overflow-hidden relative">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <div className="text-sm text-muted-foreground animate-pulse">Chargement du plan 3D...</div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [25, 20, 35], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene units={units} selectedId={selectedId} onSelectUnit={onSelectUnit} />
        </Canvas>
      </Suspense>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] border shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#4ade80] opacity-40" />
          <span>Libre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#60a5fa]" />
          <span>Occupé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#facc15]" />
          <span>Réservé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[#f97316]" />
          <span>Sélectionné</span>
        </div>
      </div>

      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-muted-foreground border">
        🖱️ Tourner · Molette: zoom · Clic droit: déplacer
      </div>
    </div>
  );
};
