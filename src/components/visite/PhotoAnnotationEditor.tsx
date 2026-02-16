import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Pencil, MousePointer2, ArrowUp, Type, Square, Circle,
  Highlighter, Undo2, Trash2, Save, X
} from "lucide-react";

type Tool = "select" | "pen" | "arrow" | "text" | "rect" | "circle" | "highlight";

interface Annotation {
  id: string;
  tool: Tool;
  color: string;
  lineWidth: number;
  fontSize?: number;
  text?: string;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (blob: Blob) => void;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff", "#000000",
];

export const PhotoAnnotationEditor = ({ open, onClose, imageSrc, onSave }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image
  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    const img = new Image();

    // Register handlers BEFORE setting src to avoid race conditions
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 160;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      setCanvasSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error("[AnnotationEditor] Failed to load image:", imageSrc);
    };

    // For remote URLs, fetch as blob to avoid CORS tainting the canvas
    if (imageSrc.startsWith("http")) {
      fetch(imageSrc)
        .then((resp) => resp.blob())
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        })
        .catch(() => {
          if (cancelled) return;
          img.crossOrigin = "anonymous";
          img.src = imageSrc;
        });
    } else {
      img.src = imageSrc;
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setAnnotations([]);
      setImageLoaded(false);
      setTextInput(null);
    };
  }, [open, imageSrc]);

  // Redraw everything
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !imgRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    annotations.forEach((a) => drawAnnotation(ctx, a));
  }, [annotations]);

  useEffect(() => {
    if (imageLoaded) redraw();
  }, [imageLoaded, redraw]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, a: Annotation) => {
    ctx.save();
    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    ctx.lineWidth = a.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (a.tool === "highlight") {
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = a.lineWidth * 4;
    }

    switch (a.tool) {
      case "pen":
      case "highlight":
        if (a.points && a.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(a.points[0].x, a.points[0].y);
          a.points.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
        break;
      case "arrow":
        if (a.startX != null && a.startY != null && a.endX != null && a.endY != null) {
          drawArrow(ctx, a.startX, a.startY, a.endX, a.endY, a.lineWidth);
        }
        break;
      case "text":
        if (a.text && a.startX != null && a.startY != null) {
          ctx.font = `bold ${a.fontSize || 24}px sans-serif`;
          ctx.globalAlpha = 1;
          // Stroke for readability
          ctx.strokeStyle = a.color === "#ffffff" ? "#000000" : "#ffffff";
          ctx.lineWidth = 3;
          ctx.strokeText(a.text, a.startX, a.startY);
          ctx.fillText(a.text, a.startX, a.startY);
        }
        break;
      case "rect":
        if (a.startX != null && a.startY != null && a.endX != null && a.endY != null) {
          ctx.strokeRect(a.startX, a.startY, a.endX - a.startX, a.endY - a.startY);
        }
        break;
      case "circle":
        if (a.startX != null && a.startY != null && a.endX != null && a.endY != null) {
          const rx = Math.abs(a.endX - a.startX) / 2;
          const ry = Math.abs(a.endY - a.startY) / 2;
          const cx = a.startX + (a.endX - a.startX) / 2;
          const cy = a.startY + (a.endY - a.startY) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
    }
    ctx.restore();
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number, lw: number
  ) => {
    const headLen = Math.max(lw * 4, 15);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === "text") {
      setTextInput(pos);
      setTextValue("");
      return;
    }

    setDrawing(true);
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      tool,
      color,
      lineWidth,
      fontSize,
      points: tool === "pen" || tool === "highlight" ? [pos] : undefined,
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
    };
    setCurrentAnnotation(newAnnotation);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentAnnotation) return;
    e.preventDefault();
    const pos = getPos(e);

    setCurrentAnnotation((prev) => {
      if (!prev) return prev;
      if (prev.tool === "pen" || prev.tool === "highlight") {
        return { ...prev, points: [...(prev.points || []), pos] };
      }
      return { ...prev, endX: pos.x, endY: pos.y };
    });

    // Draw current on overlay
    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d");
    if (!octx || !overlay) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const updated = { ...currentAnnotation };
    if (updated.tool === "pen" || updated.tool === "highlight") {
      updated.points = [...(updated.points || []), pos];
    } else {
      updated.endX = pos.x;
      updated.endY = pos.y;
    }
    drawAnnotation(octx, updated);
  };

  const handlePointerUp = () => {
    if (!drawing || !currentAnnotation) return;
    setDrawing(false);
    setAnnotations((prev) => [...prev, currentAnnotation]);
    setCurrentAnnotation(null);
    const overlay = overlayRef.current;
    overlay?.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
  };

  const addTextAnnotation = () => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      return;
    }
    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tool: "text",
        color,
        lineWidth,
        fontSize,
        text: textValue,
        startX: textInput.x,
        startY: textInput.y,
      },
    ]);
    setTextInput(null);
    setTextValue("");
  };

  const undo = () => setAnnotations((prev) => prev.slice(0, -1));
  const clearAll = () => setAnnotations([]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;

    // Render at full resolution
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = imgRef.current.width;
    fullCanvas.height = imgRef.current.height;
    const fctx = fullCanvas.getContext("2d")!;
    const scaleX = imgRef.current.width / canvas.width;
    const scaleY = imgRef.current.height / canvas.height;

    fctx.drawImage(imgRef.current, 0, 0);

    annotations.forEach((a) => {
      const scaled: Annotation = {
        ...a,
        lineWidth: a.lineWidth * scaleX,
        fontSize: (a.fontSize || 24) * scaleX,
        startX: a.startX != null ? a.startX * scaleX : undefined,
        startY: a.startY != null ? a.startY * scaleY : undefined,
        endX: a.endX != null ? a.endX * scaleX : undefined,
        endY: a.endY != null ? a.endY * scaleY : undefined,
        points: a.points?.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
      };
      drawAnnotation(fctx, scaled);
    });

    fullCanvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: "pen", icon: Pencil, label: "Stylo" },
    { id: "arrow", icon: ArrowUp, label: "Flèche" },
    { id: "text", icon: Type, label: "Texte" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Cercle" },
    { id: "highlight", icon: Highlighter, label: "Surligneur" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-3 overflow-hidden flex flex-col rounded-none"  style={{ margin: 0 }}>
        <DialogHeader>
          <DialogTitle className="text-sm">Annoter la photo</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b">
          {tools.map((t) => (
            <Button
              key={t.id}
              variant={tool === t.id ? "default" : "outline"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          {COLORS.map((c) => (
            <button
              key={c}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                color === c ? "scale-125 border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-1 w-24">
            <span className="text-[10px] text-muted-foreground">Trait</span>
            <Slider value={[lineWidth]} min={1} max={10} step={1} onValueChange={(v) => setLineWidth(v[0])} />
          </div>
          {tool === "text" && (
            <div className="flex items-center gap-1 w-24">
              <span className="text-[10px] text-muted-foreground">Taille</span>
              <Slider value={[fontSize]} min={12} max={72} step={2} onValueChange={(v) => setFontSize(v[0])} />
            </div>
          )}
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={undo} title="Annuler">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearAll} title="Tout effacer">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="relative flex-1 flex items-center justify-center overflow-hidden">
          <div className="relative" style={{ width: canvasSize.w, height: canvasSize.h }}>
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="absolute inset-0 rounded"
            />
            <canvas
              ref={overlayRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="absolute inset-0 rounded cursor-crosshair"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          {textInput && (
            <div
              className="absolute z-10"
              style={{ left: textInput.x, top: textInput.y - 16 }}
            >
              <Input
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTextAnnotation()}
                onBlur={addTextAnnotation}
                className="h-7 text-sm w-40"
                placeholder="Tapez votre texte..."
              />
            </div>
          )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> Annuler
          </Button>
          <Button size="sm" onClick={handleSave} disabled={annotations.length === 0}>
            <Save className="h-4 w-4 mr-1" /> Sauvegarder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
