import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Stage } from "@react-three/drei";

// Map resource names (or keywords) to model file paths
const MODEL_MAP: Record<string, string> = {
  k1000: "/models/K1000.glb",
  k1003: "/models/K1003.glb",
  "mk73 ouverte": "/models/MK73-ouverte.glb",
  "mk73 patin": "/models/MK73-patin.glb",
  mk73: "/models/MK73-ouverte.glb",
  cbdg: "/models/CBDG.glb",
};

export function getModelPath(resourceName: string): string | null {
  const lower = resourceName.toLowerCase();
  for (const [key, path] of Object.entries(MODEL_MAP)) {
    if (lower.includes(key)) return path;
  }
  return null;
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
  const modelPath = getModelPath(resourceName);
  const controlsRef = useRef<any>(null);

  if (!modelPath) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-xl border text-sm text-muted-foreground ${className}`}>
        Aucun modèle 3D disponible pour cet engin
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-card overflow-hidden relative ${className}`}>
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
          <ModelScene url={modelPath} />
        </Canvas>
      </Suspense>
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground border">
        🖱️ Tourner · Molette: zoom
      </div>
    </div>
  );
}
