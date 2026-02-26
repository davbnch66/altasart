import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { useGLTF, Center } from "@react-three/drei";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Download, RotateCcw, Maximize2, X, VideoOff, Move, Hand } from "lucide-react";
import { toast } from "sonner";
import * as THREE from "three";

const AVAILABLE_MODELS = [
  { key: "k1000", label: "K1000", path: "/models/K1000.glb" },
  { key: "k1003", label: "K1003", path: "/models/K1003.glb" },
  { key: "mk73-ouverte", label: "MK73 Ouverte", path: "/models/MK73-ouverte.glb" },
  { key: "mk73-patin", label: "MK73 Patin", path: "/models/MK73-patin.glb" },
  { key: "cbdg", label: "CBDG", path: "/models/CBDG.glb" },
];

interface ARLiveCameraProps {
  open: boolean;
  onClose: () => void;
  initialModel?: string;
}

function LiveModel({ url, scale, rotation, onScaleChange, onRotationChange, dragMode }: {
  url: string;
  scale: number;
  rotation: number;
  onScaleChange: (s: number) => void;
  onRotationChange: (r: number) => void;
  dragMode: "rotate" | "scale";
}) {
  const { scene } = useGLTF(url);
  const cloned = scene.clone(true);
  const { gl } = useThree();
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    gl.domElement.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };

    if (dragMode === "rotate") {
      onRotationChange(rotation + dx * 0.01);
    } else {
      onScaleChange(Math.max(0.1, Math.min(10, scale - dy * 0.01)));
    }
  }, [dragMode, rotation, scale, onRotationChange, onScaleChange]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

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
      rotation={[0, rotation, 0]}
      scale={[scale, scale, scale]}
      onPointerDown={handlePointerDown}
    >
      <Center>
        <primitive object={cloned} />
      </Center>
    </group>
  );
}

export function ARLiveCamera({ open, onClose, initialModel }: ARLiveCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(initialModel || AVAILABLE_MODELS[0].key);
  const [modelScale, setModelScale] = useState(1);
  const [modelRotation, setModelRotation] = useState(0);
  const [dragMode, setDragMode] = useState<"rotate" | "scale">("rotate");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const modelInfo = AVAILABLE_MODELS.find((m) => m.key === selectedModel) || AVAILABLE_MODELS[0];

  // Start camera
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err: any) {
        if (mounted) setCameraError(err.message || "Impossible d'accéder à la caméra");
      }
    };
    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
      setCameraError(null);
    };
  }, [open]);

  const handleCapture = useCallback(async () => {
    if (!containerRef.current || !videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      canvas.width = w * 2;
      canvas.height = h * 2;
      ctx.scale(2, 2);
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      const threeCanvas = containerRef.current.querySelector("canvas");
      if (threeCanvas) ctx.drawImage(threeCanvas, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ar-capture-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success("Capture AR téléchargée");
      }, "image/png");
    } catch {
      toast.error("Erreur lors de la capture");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
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

          <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border">
            <button
              onClick={() => setDragMode("rotate")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                dragMode === "rotate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <RotateCcw className="h-3 w-3" />Tourner
            </button>
            <button
              onClick={() => setDragMode("scale")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                dragMode === "scale" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Maximize2 className="h-3 w-3" />Taille
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-24">
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
            <Slider value={[modelScale]} onValueChange={([v]) => setModelScale(v)} min={0.1} max={5} step={0.1} className="w-20" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={handleCapture} disabled={!cameraReady} className="gap-1.5">
              <Camera className="h-3.5 w-3.5" />Capturer
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Viewport */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center space-y-3">
                <VideoOff className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
                <p className="text-xs text-muted-foreground">Vérifiez les permissions caméra de votre navigateur</p>
              </div>
            </div>
          )}

          {cameraReady && (
            <Suspense fallback={null}>
              <Canvas
                camera={{ position: [15, 10, 15], fov: 45 }}
                style={{ position: "absolute", inset: 0, background: "transparent" }}
                gl={{ preserveDrawingBuffer: true, alpha: true }}
              >
                <ambientLight intensity={0.8} />
                <directionalLight position={[10, 15, 10]} intensity={0.6} />
                <LiveModel
                  url={modelInfo.path}
                  scale={modelScale}
                  rotation={modelRotation}
                  onScaleChange={setModelScale}
                  onRotationChange={setModelRotation}
                  dragMode={dragMode}
                />
              </Canvas>
            </Suspense>
          )}

          <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground border">
            <Hand className="h-3 w-3 inline mr-1" />
            Glissez la grue pour la manipuler
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
