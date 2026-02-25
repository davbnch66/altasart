import { useState, useRef, useCallback, Suspense, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center } from "@react-three/drei";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Download, Image, RotateCcw, Move, Maximize2, X, Upload, Video } from "lucide-react";
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
  initialModel?: string;
  onExport?: (blob: Blob) => void;
}

function DraggableModel({ url, scale, position, rotation }: {
  url: string;
  scale: number;
  position: [number, number, number];
  rotation: number;
}) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  // Clone scene to avoid issues with reuse
  const clonedScene = scene.clone(true);

  return (
    <group ref={ref} position={position} rotation={[0, rotation, 0]} scale={[scale, scale, scale]}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
}

function SceneContent({ modelUrl, modelScale, modelPosition, modelRotation }: {
  modelUrl: string;
  modelScale: number;
  modelPosition: [number, number, number];
  modelRotation: number;
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} />
      <directionalLight position={[-5, 10, -5]} intensity={0.3} />
      <OrbitControls enableRotate enableZoom enablePan />
      <DraggableModel
        url={modelUrl}
        scale={modelScale}
        position={modelPosition}
        rotation={modelRotation}
      />
      {/* Ground grid for reference */}
      <gridHelper args={[50, 50, "#888888", "#444444"]} position={[0, -0.01, 0]} />
    </>
  );
}

export function ARPhotoOverlay({ open, onClose, initialPhotoUrl, initialModel, onExport }: ARPhotoOverlayProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl || null);
  const [selectedModel, setSelectedModel] = useState(initialModel || AVAILABLE_MODELS[0].key);
  const [modelScale, setModelScale] = useState(1);
  const [modelRotation, setModelRotation] = useState(0);
  const [modelPosition, setModelPosition] = useState<[number, number, number]>([0, 0, 0]);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLiveCamera, setShowLiveCamera] = useState(false);

  const modelInfo = AVAILABLE_MODELS.find((m) => m.key === selectedModel) || AVAILABLE_MODELS[0];

  // Reset state when reopening
  useEffect(() => {
    if (open) {
      setPhotoUrl(initialPhotoUrl || null);
      setSelectedModel(initialModel || AVAILABLE_MODELS[0].key);
      setModelScale(1);
      setModelRotation(0);
      setModelPosition([0, 0, 0]);
    }
  }, [open, initialPhotoUrl, initialModel]);

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
      // Find the canvas inside the container
      const canvas = containerRef.current.querySelector("canvas");
      if (!canvas) throw new Error("Canvas not found");

      // Create composite image
      const compositeCanvas = document.createElement("canvas");
      const ctx = compositeCanvas.getContext("2d")!;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      compositeCanvas.width = width * 2; // Higher resolution
      compositeCanvas.height = height * 2;
      ctx.scale(2, 2);

      // Draw photo background
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

      // Draw 3D canvas on top
      ctx.drawImage(canvas, 0, 0, width, height);

      compositeCanvas.toBlob((blob) => {
        if (!blob) return;
        if (onExport) {
          onExport(blob);
          toast.success("Image exportée");
        } else {
          // Download
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `ar-projection-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          toast.success("Image téléchargée");
        }
        setExporting(false);
      }, "image/png");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export");
      setExporting(false);
    }
  }, [photoUrl, onExport]);

  const handleReset = () => {
    setModelScale(1);
    setModelRotation(0);
    setModelPosition([0, 0, 0]);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
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

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Export…" : "Exporter"}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs flex-wrap">
          <div className="flex items-center gap-2 min-w-32">
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[11px] w-12">Échelle</Label>
            <Slider
              value={[modelScale]}
              onValueChange={([v]) => setModelScale(v)}
              min={0.1}
              max={5}
              step={0.1}
              className="w-24"
            />
            <span className="text-muted-foreground w-8 text-right">{modelScale.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2 min-w-32">
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[11px] w-12">Rotation</Label>
            <Slider
              value={[modelRotation]}
              onValueChange={([v]) => setModelRotation(v)}
              min={-Math.PI}
              max={Math.PI}
              step={0.05}
              className="w-24"
            />
            <span className="text-muted-foreground w-8 text-right">{Math.round((modelRotation * 180) / Math.PI)}°</span>
          </div>
          <div className="flex items-center gap-2 min-w-32">
            <Move className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[11px] w-12">Position</Label>
            <div className="flex gap-1">
              {["X", "Y", "Z"].map((axis, i) => (
                <div key={axis} className="flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground">{axis}</span>
                  <Slider
                    value={[modelPosition[i]]}
                    onValueChange={([v]) => {
                      const newPos = [...modelPosition] as [number, number, number];
                      newPos[i] = v;
                      setModelPosition(newPos);
                    }}
                    min={-20}
                    max={20}
                    step={0.5}
                    className="w-16"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {/* Background photo */}
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Photo de chantier"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
          )}

          {/* 3D overlay */}
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
            >
              <SceneContent
                modelUrl={modelInfo.path}
                modelScale={modelScale}
                modelPosition={modelPosition}
                modelRotation={modelRotation}
              />
            </Canvas>
          </Suspense>

          {!photoUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2 opacity-50">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Chargez une photo pour la superposition AR</p>
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
