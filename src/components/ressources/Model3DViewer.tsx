import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Stage } from "@react-three/drei";

export interface ModelVariant {
  key: string;
  label: string;
  path: string;
}

// All available models with variants
const ALL_MODELS: ModelVariant[] = [
  { key: "k1000", label: "K1000", path: "/models/K1000.glb" },
  { key: "k1003", label: "K1003", path: "/models/K1003.glb" },
  { key: "mk73-ouverte", label: "MK73 Ouverte", path: "/models/MK73-ouverte.glb" },
  { key: "mk73-patin", label: "MK73 Patin", path: "/models/MK73-patin.glb" },
  { key: "cbdg", label: "CBDG", path: "/models/CBDG.glb" },
];

/** Returns all model variants matching a resource name */
export function getModelVariants(resourceName: string): ModelVariant[] {
  const lower = resourceName.toLowerCase();
  // Exact sub-model match first
  if (lower.includes("mk73") && lower.includes("patin")) return ALL_MODELS.filter((m) => m.key === "mk73-patin");
  if (lower.includes("mk73") && lower.includes("ouverte")) return ALL_MODELS.filter((m) => m.key === "mk73-ouverte");
  // Generic MK73 → show both variants
  if (lower.includes("mk73")) return ALL_MODELS.filter((m) => m.key.startsWith("mk73"));
  // Other models
  if (lower.includes("k1000")) return ALL_MODELS.filter((m) => m.key === "k1000");
  if (lower.includes("k1003")) return ALL_MODELS.filter((m) => m.key === "k1003");
  if (lower.includes("cbdg")) return ALL_MODELS.filter((m) => m.key === "cbdg");
  return [];
}

/** Legacy helper — returns first match */
export function getModelPath(resourceName: string): string | null {
  const variants = getModelVariants(resourceName);
  return variants.length > 0 ? variants[0].path : null;
}

function ModelScene({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Stage environment="city" intensity={0.5} adjustCamera>
      <Center>
        <primitive object={scene} />
      </Center>
    </Stage>
  );
}

interface Model3DViewerProps {
  resourceName: string;
  className?: string;
}

export function Model3DViewer({ resourceName, className = "" }: Model3DViewerProps) {
  const variants = getModelVariants(resourceName);
  const [activeVariant, setActiveVariant] = useState(0);
  const controlsRef = useRef<any>(null);

  if (variants.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-xl border text-sm text-muted-foreground ${className}`}>
        Aucun modèle 3D disponible pour cet engin
      </div>
    );
  }

  const currentModel = variants[activeVariant] || variants[0];

  return (
    <div className={`rounded-xl border bg-card overflow-hidden relative ${className}`}>
      {/* Variant selector */}
      {variants.length > 1 && (
        <div className="absolute top-2 left-2 z-10 flex gap-1 bg-background/90 backdrop-blur-sm rounded-lg p-1 border">
          {variants.map((v, i) => (
            <button
              key={v.key}
              onClick={() => setActiveVariant(i)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                i === activeVariant
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <div className="text-sm text-muted-foreground animate-pulse">Chargement du modèle 3D…</div>
          </div>
        }
      >
        <Canvas camera={{ position: [8, 5, 8], fov: 45 }} style={{ width: "100%", height: "100%" }}>
          <OrbitControls
            ref={controlsRef}
            enablePan
            enableZoom
            enableRotate
            maxPolarAngle={Math.PI / 2}
            minDistance={2}
            maxDistance={50}
          />
          <ModelScene url={currentModel.path} />
        </Canvas>
      </Suspense>
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground border">
        🖱️ Tourner · Molette: zoom
      </div>
    </div>
  );
}
