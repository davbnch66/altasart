import { Suspense, useMemo, useCallback, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StorageBox3D } from "./StorageBox3D";
import * as THREE from "three";

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

const Floor = ({ width, depth }: { width: number; depth: number }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.01, depth / 2]} receiveShadow>
    <planeGeometry args={[width + 10, depth + 10]} />
    <meshLambertMaterial color="#e2e8f0" />
  </mesh>
);

const Scene = ({ units, selectedId, onSelectUnit, controlsRef }: Storage3DViewerProps & { controlsRef: React.RefObject<any> }) => {
  // Derive aisles and rows from existing units
  const { aisleIndex, rowIndex, boxes, floorSize } = useMemo(() => {
    const aisleSet = new Set<string>();
    const rowSet = new Set<string>();
    units.forEach((u) => {
      const match = u.name.match(/^([A-Z])(\d+)-N(\d+)$/);
      if (match) {
        aisleSet.add(match[1]);
        rowSet.add(match[2]);
      }
    });
    const sortedAisles = [...aisleSet].sort();
    const sortedRows = [...rowSet].sort((a, b) => Number(a) - Number(b));
    
    const aIdx: Record<string, number> = {};
    sortedAisles.forEach((a, i) => { aIdx[a] = i; });
    const rIdx: Record<string, number> = {};
    sortedRows.forEach((r, i) => { rIdx[r] = i; });

    const result: { key: string; name: string; position: [number, number, number]; unit: StorageUnit }[] = [];
    
    units.forEach((u) => {
      const match = u.name.match(/^([A-Z])(\d+)-N(\d+)$/);
      if (match) {
        const [, aisle, row, level] = match;
        const ai = aIdx[aisle] ?? 0;
        const ri = rIdx[row] ?? 0;
        const li = Number(level) - 1;
        const x = ai * (BOX_SIZE + AISLE_GAP);
        const y = li * (BOX_SIZE + GAP) + BOX_SIZE / 2;
        const z = ri * (BOX_SIZE + GAP);
        result.push({ key: u.id, name: u.name, position: [x, y, z], unit: u });
      } else {
        // Non-grid units
        const idx = result.filter((r) => !r.name.match(/^[A-Z]\d+-N\d+$/)).length;
        const x = (idx % 10) * (BOX_SIZE + AISLE_GAP);
        const y = BOX_SIZE / 2;
        const z = (sortedRows.length) * (BOX_SIZE + GAP) + 3 + Math.floor(idx / 10) * (BOX_SIZE + GAP);
        result.push({ key: u.id, name: u.name, position: [x, y, z], unit: u });
      }
    });

    const fw = sortedAisles.length * (BOX_SIZE + AISLE_GAP);
    const fd = sortedRows.length * (BOX_SIZE + GAP);

    return { aisleIndex: aIdx, rowIndex: rIdx, boxes: result, floorSize: { width: fw, depth: fd } };
  }, [units]);

  // Focus camera on selected box
  useEffect(() => {
    if (!selectedId || !controlsRef.current) return;
    const selected = boxes.find((b) => b.unit.id === selectedId);
    if (selected) {
      const target = new THREE.Vector3(...selected.position);
      controlsRef.current.target.lerp(target, 0.5);
      controlsRef.current.update();
    }
  }, [selectedId, boxes, controlsRef]);

  const handleClick = useCallback(
    (unit: StorageUnit) => {
      onSelectUnit(unit);
    },
    [onSelectUnit]
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 40, 20]} intensity={0.7} />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} />

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={100}
      />

      <Floor width={floorSize.width} depth={floorSize.depth} />

      {boxes.map((box) => (
        <StorageBox3D
          key={box.key}
          position={box.position}
          status={box.unit.status}
          isSelected={selectedId === box.unit.id}
          label={box.name}
          clientName={(box.unit.clients as any)?.name}
          onClick={() => handleClick(box.unit)}
        />
      ))}
    </>
  );
};

export const Storage3DViewer = ({ units, selectedId, onSelectUnit }: Storage3DViewerProps) => {
  const controlsRef = useRef<any>(null);

  if (units.length === 0) {
    return (
      <div className="w-full h-[600px] rounded-xl border bg-card flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Aucun box configuré. Utilisez "Gérer en masse" ou "Ajouter un box" pour créer des emplacements.</p>
      </div>
    );
  }

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
          <Scene units={units} selectedId={selectedId} onSelectUnit={onSelectUnit} controlsRef={controlsRef} />
        </Canvas>
      </Suspense>

      <div className="absolute bottom-3 left-3 flex gap-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] border shadow-sm">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#4ade80] opacity-40" /><span>Libre</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#60a5fa]" /><span>Occupé</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#facc15]" /><span>Réservé</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#f97316]" /><span>Sélectionné</span></div>
      </div>

      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-muted-foreground border">
        🖱️ Tourner · Molette: zoom · Clic droit: déplacer
      </div>
    </div>
  );
};
