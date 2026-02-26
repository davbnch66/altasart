import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center } from "@react-three/drei";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Download, Image, RotateCcw, Maximize2, X, Video, Hand, Move, Save, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { ARLiveCamera } from "./ARLiveCamera";
import * as THREE from "three";

const AVAILABLE_MODELS = [
  { key: "k1000", label: "K1000", path: "/models/K1000.glb" },
  { key: "k1003", label: "K1003", path: "/models/K1003.glb" },
  { key: "mk73-ouverte", label: "MK73 Ouverte", path: "/models/MK73-ouverte.glb" },
  { key: "mk73-patin", label: "MK73 Patin", path: "/models/MK73-patin.glb" },
  { key: "cbdg", label: "CBDG", path: "/models/CBDG.glb" },
];

interface ARPhotoOverlayProps {
  open: boolean;
  onClose: () => void;
  initialPhotoUrl?: string;
  initialPhotoFile?: File;
  initialModel?: string;
  onExport?: (blob: Blob) => void;
  onSaveOriginal?: (file: File) => void;
}

/**
 * Improved DraggableModel with raycasting-based drag on a virtual ground plane.
 * - "move" mode: drag on X/Z plane via raycasting (much more precise than pixel deltas)
 * - "rotate": horizontal drag rotates Y axis
 * - "scale": vertical drag scales
 * - Supports touch with pointer events natively
 */
function DraggableModel({ url, scale, position, rotation, onPositionChange, onRotationChange, onScaleChange, dragMode }: {
  url: string;
  scale: number;
  position: [number, number, number];
  rotation: number;
  onPositionChange: (pos: [number, number, number]) => void;
  onRotationChange: (rot: number) => void;
  onScaleChange: (s: number) => void;
  dragMode: "move" | "rotate" | "scale";
}) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOffset = useRef<THREE.Vector3>(new THREE.Vector3());
  const { camera, gl, size } = useThree();

  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const intersectPoint = useRef(new THREE.Vector3());

  const clonedScene = scene.clone(true);

  // Convert screen coords to normalized device coords and raycast to ground plane
  const screenToGround = useCallback((clientX: number, clientY: number): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hit = raycaster.current.ray.intersectPlane(groundPlane.current, intersectPoint.current);
    return hit ? hit.clone() : null;
  }, [camera, gl]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    gl.domElement.style.cursor = "grabbing";

    // For move mode, compute offset between raycast hit and model position
    if (dragMode === "move") {
      const hit = screenToGround(e.clientX, e.clientY);
      if (hit) {
        dragOffset.current.set(position[0] - hit.x, 0, position[2] - hit.z);
      }
    }

    // Capture pointer for reliable drag across canvas
    (e.nativeEvent.target as HTMLElement)?.setPointerCapture?.(e.nativeEvent.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;

    if (dragMode === "move") {
      // Raycast-based movement — much more intuitive than pixel deltas
      const hit = screenToGround(e.clientX, e.clientY);
      if (hit) {
        onPositionChange([
          hit.x + dragOffset.current.x,
          position[1],
          hit.z + dragOffset.current.z,
        ]);
      }
    } else {
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };

      if (dragMode === "rotate") {
        onRotationChange(rotation + dx * 0.015);
      } else if (dragMode === "scale") {
        const delta = -dy * 0.015;
        onScaleChange(Math.max(0.05, Math.min(10, scale + delta)));
      }
    }
  }, [dragMode, position, rotation, scale, onPositionChange, onRotationChange, onScaleChange, screenToGround]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    gl.domElement.style.cursor = "grab";
  }, [gl]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [gl, handlePointerMove, handlePointerUp]);

  return (
    <group
      ref={ref}
      position={position}
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
      onPointerDown={handlePointerDown}
      onPointerOver={() => { gl.domElement.style.cursor = "grab"; }}
      onPointerOut={() => { if (!dragging.current) gl.domElement.style.cursor = "auto"; }}
    >
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
}

function SceneContent({ modelUrl, modelScale, modelPosition, modelRotation, onPositionChange, onRotationChange, onScaleChange, dragMode, orbitEnabled, showGrid }: {
  modelUrl: string;
  modelScale: number;
  modelPosition: [number, number, number];
  modelRotation: number;
  onPositionChange: (pos: [number, number, number]) => void;
  onRotationChange: (rot: number) => void;
  onScaleChange: (s: number) => void;
  dragMode: "move" | "rotate" | "scale";
  orbitEnabled: boolean;
  showGrid: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />
      <OrbitControls
        enableRotate={orbitEnabled && dragMode !== "move"}
        enableZoom
        enablePan={orbitEnabled && dragMode !== "move"}
      />
      <DraggableModel
        url={modelUrl}
        scale={modelScale}
        position={modelPosition}
        rotation={modelRotation}
        onPositionChange={onPositionChange}
        onRotationChange={onRotationChange}
        onScaleChange={onScaleChange}
        dragMode={dragMode}
      />
      {showGrid && <gridHelper args={[50, 50, "#888888", "#444444"]} position={[0, -0.01, 0]} />}
    </>
  );
}

export function ARPhotoOverlay({ open, onClose, initialPhotoUrl, initialPhotoFile, initialModel, onExport, onSaveOriginal }: ARPhotoOverlayProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl || null);
  const [selectedModel, setSelectedModel] = useState(initialModel || AVAILABLE_MODELS[0].key);
  const [modelScale, setModelScale] = useState(1);
  const [modelRotation, setModelRotation] = useState(0);
  const [modelPosition, setModelPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [exporting, setExporting] = useState(false);
  const [dragMode, setDragMode] = useState<"move" | "rotate" | "scale">("move");
  const [showCrane, setShowCrane] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLiveCamera, setShowLiveCamera] = useState(false);

  const modelInfo = AVAILABLE_MODELS.find((m) => m.key === selectedModel) || AVAILABLE_MODELS[0];

  useEffect(() => {
    if (open) {
      if (initialPhotoFile) {
        setPhotoUrl(URL.createObjectURL(initialPhotoFile));
      } else {
        setPhotoUrl(initialPhotoUrl || null);
      }
      setSelectedModel(initialModel || AVAILABLE_MODELS[0].key);
      setModelScale(1);
      setModelRotation(0);
      setModelPosition([0, 0, 0]);
      setShowCrane(!initialPhotoFile);
    }
  }, [open, initialPhotoUrl, initialPhotoFile, initialModel]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  };

  const handleExport = useCallback(async () => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const canvas = containerRef.current.querySelector("canvas");
      if (!canvas) throw new Error("Canvas not found");
      const compositeCanvas = document.createElement("canvas");
      const ctx = compositeCanvas.getContext("2d")!;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      compositeCanvas.width = width * 2;
      compositeCanvas.height = height * 2;
      ctx.scale(2, 2);
      if (photoUrl) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = photoUrl;
        });
        ctx.drawImage(img, 0, 0, width, height);
      } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(canvas, 0, 0, width, height);
      compositeCanvas.toBlob((blob) => {
        if (!blob) return;
        if (onExport) {
          onExport(blob);
          toast.success("Photo avec grue sauvegardée");
        } else {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `ar-projection-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          toast.success("Image téléchargée");
        }
        setExporting(false);
        onClose();
      }, "image/png");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export");
      setExporting(false);
    }
  }, [photoUrl, onExport, onClose]);

  const handleReset = () => {
    setModelScale(1);
    setModelRotation(0);
    setModelPosition([0, 0, 0]);
  };

  // Height adjustment buttons
  const adjustHeight = (delta: number) => {
    setModelPosition((prev) => [prev[0], Math.max(-10, Math.min(20, prev[1] + delta)), prev[2]]);
  };

  const dragModes = [
    { key: "move" as const, icon: Move, label: "Déplacer" },
    { key: "rotate" as const, icon: RotateCcw, label: "Tourner" },
    { key: "scale" as const, icon: Maximize2, label: "Taille" },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
          {onSaveOriginal && initialPhotoFile && (
            <Button variant="outline" size="sm" onClick={() => { onSaveOriginal(initialPhotoFile); onClose(); }} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Sans grue
            </Button>
          )}

          {!showCrane ? (
            <Button variant="default" size="sm" onClick={() => setShowCrane(true)} className="gap-1.5">
              <Image className="h-3.5 w-3.5" />
              Ajouter une grue
            </Button>
          ) : (
            <>
              {!initialPhotoFile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                    <Image className="h-3.5 w-3.5" />
                    {photoUrl ? "Changer photo" : "Charger photo"}
                  </Button>
                </>
              )}

              <Button variant="outline" size="sm" onClick={() => setShowLiveCamera(true)} className="gap-1.5">
                <Video className="h-3.5 w-3.5" />Caméra live
              </Button>

              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </Button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {showCrane && (
              <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Export…" : "Sauvegarder avec grue"}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Controls bar */}
        {showCrane && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 text-xs flex-wrap">
          {/* Drag mode toggle */}
          <div className="flex items-center gap-0.5 bg-background rounded-lg p-0.5 border">
            {dragModes.map((m) => (
              <button
                key={m.key}
                onClick={() => setDragMode(m.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  dragMode === m.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <m.icon className="h-3 w-3" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Height buttons — always visible, quick adjust */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => adjustHeight(0.5)}
              title="Monter"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => adjustHeight(-0.5)}
              title="Descendre"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground w-6 text-center">
              {modelPosition[1].toFixed(1)}
            </span>
          </div>

          {/* Sliders */}
          <div className="flex items-center gap-2 min-w-0 ml-auto flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] shrink-0">Échelle</Label>
              <Slider
                value={[modelScale]}
                onValueChange={([v]) => setModelScale(v)}
                min={0.05}
                max={5}
                step={0.05}
                className="w-16 sm:w-20"
              />
              <span className="text-muted-foreground text-[10px] w-6 text-right">{modelScale.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] shrink-0">Rotation</Label>
              <Slider
                value={[modelRotation]}
                onValueChange={([v]) => setModelRotation(v)}
                min={-Math.PI}
                max={Math.PI}
                step={0.05}
                className="w-16 sm:w-20"
              />
              <span className="text-muted-foreground text-[10px] w-6 text-right">{Math.round((modelRotation * 180) / Math.PI)}°</span>
            </div>
          </div>
        </div>
        )}

        {/* Viewport */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Photo de chantier"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {showCrane && (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <div className="text-sm text-muted-foreground animate-pulse">Chargement du modèle…</div>
              </div>
            }
          >
            <Canvas
              camera={{ position: [15, 10, 15], fov: 45 }}
              style={{ position: "absolute", inset: 0, background: photoUrl ? "transparent" : "#1a1a2e" }}
              gl={{ preserveDrawingBuffer: true, alpha: true }}
              touch-action="none"
            >
              <SceneContent
                modelUrl={modelInfo.path}
                modelScale={modelScale}
                modelPosition={modelPosition}
                modelRotation={modelRotation}
                onPositionChange={setModelPosition}
                onRotationChange={setModelRotation}
                onScaleChange={setModelScale}
                dragMode={dragMode}
                orbitEnabled={true}
                showGrid={!photoUrl}
              />
            </Canvas>
          </Suspense>
          )}

          {/* Mobile hint overlay — shown briefly */}
          {showCrane && (
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none sm:hidden">
              <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center text-[10px] text-muted-foreground border">
                <Hand className="h-3 w-3 inline mr-1" />
                Glissez la grue pour la déplacer · Utilisez les boutons ↑↓ pour la hauteur
              </div>
            </div>
          )}

          {!photoUrl && !showCrane && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-muted/20">
              <div className="text-center space-y-2 opacity-50">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucune photo chargée</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <ARLiveCamera open={showLiveCamera} onClose={() => setShowLiveCamera(false)} initialModel={selectedModel} />
    </>
  );
}