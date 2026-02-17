import { Suspense, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Grid, Text } from "@react-three/drei";
import { StorageBox3D } from "./StorageBox3D";

const ROWS = 5;
const AISLES = 20;
const LEVELS = 3;
const BOX_SIZE = 2;
const GAP = 0.15;
const AISLE_GAP = 1.2; // extra gap between aisles for walking

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

// Generate a grid position mapping: name -> { row, aisle, level }
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

// Build a lookup from unit name -> unit data
const buildUnitLookup = (units: StorageUnit[]) => {
  const lookup: Record<string, StorageUnit> = {};
  units.forEach((u) => {
    lookup[u.name] = u;
  });
  return lookup;
};

const FloorGrid = () => (
  <Grid
    args={[200, 200]}
    position={[0, -0.01, 0]}
    cellSize={2}
    cellThickness={0.5}
    cellColor="#94a3b8"
    sectionSize={10}
    sectionThickness={1}
    sectionColor="#64748b"
    fadeDistance={120}
    fadeStrength={1}
    followCamera={false}
  />
);

const AisleLabels = () => {
  const labels = [];
  for (let aisle = 0; aisle < AISLES; aisle++) {
    const x = aisle * (BOX_SIZE + AISLE_GAP);
    labels.push(
      <Text
        key={`aisle-${aisle}`}
        position={[x, 0.05, -(BOX_SIZE + GAP) * 0.5 - 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.6}
        color="#475569"
        anchorX="center"
        anchorY="middle"
      >
        Allée {String.fromCharCode(65 + aisle)}
      </Text>
    );
  }
  return <>{labels}</>;
};

const Scene = ({ units, selectedId, onSelectUnit }: Storage3DViewerProps) => {
  const unitLookup = useMemo(() => buildUnitLookup(units), [units]);

  const boxes = useMemo(() => {
    const result: {
      key: string;
      name: string;
      position: [number, number, number];
      unit: StorageUnit | null;
    }[] = [];

    Object.entries(gridMap).forEach(([name, { row, aisle, level }]) => {
      const x = aisle * (BOX_SIZE + AISLE_GAP);
      const y = level * (BOX_SIZE + GAP) + BOX_SIZE / 2;
      const z = row * (BOX_SIZE + GAP);

      result.push({
        key: name,
        name,
        position: [x, y, z],
        unit: unitLookup[name] || null,
      });
    });

    return result;
  }, [unitLookup]);

  const handleClick = useCallback(
    (unit: StorageUnit | null, name: string) => {
      if (unit) {
        onSelectUnit(unit);
      } else {
        // Empty box - create a virtual unit to show position info
        onSelectUnit({
          id: "",
          name,
          status: "libre",
        });
      }
    },
    [onSelectUnit]
  );

  return (
    <>
      <PerspectiveCamera makeDefault position={[25, 20, 35]} fov={50} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={100}
        target={[19, 3, 4]}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 40, 20]} intensity={0.8} castShadow />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} />

      <Environment preset="warehouse" background={false} />

      <FloorGrid />
      <AisleLabels />

      {/* Boxes */}
      {boxes.map((box) => (
        <StorageBox3D
          key={box.key}
          position={box.position}
          label={box.name}
          status={box.unit?.status || "libre"}
          clientName={(box.unit?.clients as any)?.name}
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
        <Canvas shadows>
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

      {/* Controls hint */}
      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-muted-foreground border">
        🖱️ Clic gauche: tourner · Molette: zoom · Clic droit: déplacer
      </div>
    </div>
  );
};
