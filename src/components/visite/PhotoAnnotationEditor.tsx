import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Pencil, MousePointer2, ArrowUp, Type, Square, Circle,
  Highlighter, Undo2, Trash2, Save, X, Move
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

// Hit-test helpers
const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

const hitTestAnnotation = (a: Annotation, px: number, py: number, threshold = 15): boolean => {
  switch (a.tool) {
    case "pen":
    case "highlight": {
      if (!a.points || a.points.length < 2) return false;
      for (let i = 1; i < a.points.length; i++) {
        if (distToSegment(px, py, a.points[i - 1].x, a.points[i - 1].y, a.points[i].x, a.points[i].y) < threshold)
          return true;
      }
      return false;
    }
    case "arrow": {
      if (a.startX == null || a.startY == null || a.endX == null || a.endY == null) return false;
      return distToSegment(px, py, a.startX, a.startY, a.endX, a.endY) < threshold;
    }
    case "text": {
      if (a.startX == null || a.startY == null || !a.text) return false;
      const fs = a.fontSize || 24;
      const w = a.text.length * fs * 0.6;
      const h = fs;
      return px >= a.startX && px <= a.startX + w && py >= a.startY - h && py <= a.startY;
    }
    case "rect": {
      if (a.startX == null || a.startY == null || a.endX == null || a.endY == null) return false;
      const minX = Math.min(a.startX, a.endX), maxX = Math.max(a.startX, a.endX);
      const minY = Math.min(a.startY, a.endY), maxY = Math.max(a.startY, a.endY);
      // Check proximity to edges
      const nearLeft = Math.abs(px - minX) < threshold && py >= minY - threshold && py <= maxY + threshold;
      const nearRight = Math.abs(px - maxX) < threshold && py >= minY - threshold && py <= maxY + threshold;
      const nearTop = Math.abs(py - minY) < threshold && px >= minX - threshold && px <= maxX + threshold;
      const nearBottom = Math.abs(py - maxY) < threshold && px >= minX - threshold && px <= maxX + threshold;
      return nearLeft || nearRight || nearTop || nearBottom;
    }
    case "circle": {
      if (a.startX == null || a.startY == null || a.endX == null || a.endY == null) return false;
      const cx = (a.startX + a.endX) / 2, cy = (a.startY + a.endY) / 2;
      const rx = Math.abs(a.endX - a.startX) / 2, ry = Math.abs(a.endY - a.startY) / 2;
      if (rx === 0 || ry === 0) return false;
      const normalized = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      return Math.abs(normalized - 1) < 0.5;
    }
    default:
      return false;
  }
};

const getAnnotationBounds = (a: Annotation): { cx: number; cy: number } => {
  if (a.tool === "pen" || a.tool === "highlight") {
    if (!a.points || a.points.length === 0) return { cx: 0, cy: 0 };
    const sumX = a.points.reduce((s, p) => s + p.x, 0);
    const sumY = a.points.reduce((s, p) => s + p.y, 0);
    return { cx: sumX / a.points.length, cy: sumY / a.points.length };
  }
  if (a.tool === "text") return { cx: a.startX || 0, cy: a.startY || 0 };
  return {
    cx: ((a.startX || 0) + (a.endX || 0)) / 2,
    cy: ((a.startY || 0) + (a.endY || 0)) / 2,
  };
};

const moveAnnotation = (a: Annotation, dx: number, dy: number): Annotation => {
  const moved = { ...a };
  if (moved.startX != null) moved.startX += dx;
  if (moved.startY != null) moved.startY += dy;
  if (moved.endX != null) moved.endX += dx;
  if (moved.endY != null) moved.endY += dy;
  if (moved.points) moved.points = moved.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return moved;
};

export const PhotoAnnotationEditor = ({ open, onClose, imageSrc, onSave }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const currentAnnotationRef = useRef<Annotation | null>(null);
  const drawingRef = useRef(false);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load image
  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 200;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      setCanvasSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
      setImageLoaded(true);
    };
    img.onerror = () => console.error("[AnnotationEditor] Failed to load image:", imageSrc);

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
      setSelectedId(null);
    };
  }, [open, imageSrc]);

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !imgRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    annotations.forEach((a) => drawAnnotation(ctx, a));

    // Draw selection indicator
    if (selectedId) {
      const sel = annotations.find((a) => a.id === selectedId);
      if (sel) {
        const { cx, cy } = getAnnotationBounds(sel);
        ctx.save();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }, [annotations, selectedId]);

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

    // Select mode: try to pick an annotation
    if (tool === "select") {
      // Check from top (last drawn) to bottom
      for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTestAnnotation(annotations[i], pos.x, pos.y)) {
          setSelectedId(annotations[i].id);
          setDragging(true);
          dragStartRef.current = pos;
          return;
        }
      }
      setSelectedId(null);
      return;
    }

    if (tool === "text") {
      setTextInput(pos);
      setTextValue("");
      return;
    }

    setSelectedId(null);
    drawingRef.current = true;
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
    currentAnnotationRef.current = newAnnotation;
    setCurrentAnnotation(newAnnotation);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    // Handle drag move for selected annotation
    if (tool === "select" && dragging && selectedId && dragStartRef.current) {
      const pos = getPos(e);
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      dragStartRef.current = pos;
      setAnnotations((prev) =>
        prev.map((a) => (a.id === selectedId ? moveAnnotation(a, dx, dy) : a))
      );
      return;
    }

    if (!drawingRef.current || !currentAnnotationRef.current) return;
    const pos = getPos(e);

    const prev = currentAnnotationRef.current;
    let updated: Annotation;
    if (prev.tool === "pen" || prev.tool === "highlight") {
      updated = { ...prev, points: [...(prev.points || []), pos] };
    } else {
      updated = { ...prev, endX: pos.x, endY: pos.y };
    }
    currentAnnotationRef.current = updated;
    setCurrentAnnotation(updated);

    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d");
    if (!octx || !overlay) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    drawAnnotation(octx, updated);
  };

  const handlePointerUp = () => {
    if (tool === "select" && dragging) {
      setDragging(false);
      dragStartRef.current = null;
      return;
    }

    if (!drawingRef.current || !currentAnnotationRef.current) return;
    drawingRef.current = false;
    setDrawing(false);
    const finalAnnotation = currentAnnotationRef.current;
    setAnnotations((prev) => [...prev, finalAnnotation]);
    currentAnnotationRef.current = null;
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

  const undo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
    setSelectedId(null);
  };
  const clearAll = () => {
    setAnnotations([]);
    setSelectedId(null);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;

    // Deselect before saving so selection indicator isn't baked in
    setSelectedId(null);

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = imgRef.current.naturalWidth || imgRef.current.width;
    fullCanvas.height = imgRef.current.naturalHeight || imgRef.current.height;
    const fctx = fullCanvas.getContext("2d")!;
    const scaleX = fullCanvas.width / canvas.width;
    const scaleY = fullCanvas.height / canvas.height;

    try {
      if (imageSrc.startsWith("http")) {
        const resp = await fetch(imageSrc);
        const blob = await resp.blob();
        // Safari < 16.4 doesn't support ImageBitmap.close(), use Image fallback
        if (typeof createImageBitmap === "function") {
          try {
            const bmpOrImg = await createImageBitmap(blob);
            fctx.drawImage(bmpOrImg, 0, 0, fullCanvas.width, fullCanvas.height);
            if (typeof bmpOrImg.close === "function") bmpOrImg.close();
          } catch {
            // Fallback: draw from loaded img element
            fctx.drawImage(imgRef.current!, 0, 0, fullCanvas.width, fullCanvas.height);
          }
        } else {
          fctx.drawImage(imgRef.current!, 0, 0, fullCanvas.width, fullCanvas.height);
        }
      } else {
        fctx.drawImage(imgRef.current, 0, 0, fullCanvas.width, fullCanvas.height);
      }
    } catch {
      fctx.drawImage(canvas, 0, 0, fullCanvas.width, fullCanvas.height);
    }

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
        if (blob) {
          onSave(blob);
        } else {
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) onSave(fallbackBlob);
            },
            "image/jpeg",
            0.9
          );
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const toolItems: { id: Tool; icon: any; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Sélectionner / Déplacer" },
    { id: "pen", icon: Pencil, label: "Stylo" },
    { id: "arrow", icon: ArrowUp, label: "Flèche" },
    { id: "text", icon: Type, label: "Texte" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Cercle" },
    { id: "highlight", icon: Highlighter, label: "Surligneur" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-3 overflow-hidden flex flex-col rounded-none" style={{ margin: 0 }}>
        <DialogHeader>
          <DialogTitle className="text-sm">Annoter la photo</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 pb-2 border-b overflow-x-auto">
          {toolItems.map((t) => (
            <Button
              key={t.id}
              variant={tool === t.id ? "default" : "outline"}
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => { setTool(t.id); if (t.id !== "select") setSelectedId(null); }}
              title={t.label}
            >
              <t.icon className="h-4 w-4" />
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-0.5 shrink-0" />
          {COLORS.map((c) => (
            <button
              key={c}
              className={`h-6 w-6 rounded-full border-2 transition-transform shrink-0 ${
                color === c ? "scale-125 border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        {/* Size controls + actions row */}
        <div className="flex items-center gap-2 pb-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-muted-foreground shrink-0">Trait</span>
            <Slider value={[lineWidth]} min={1} max={10} step={1} onValueChange={(v) => setLineWidth(v[0])} className="w-20" />
            <span className="text-xs font-mono w-4 text-center">{lineWidth}</span>
          </div>
          {tool === "text" && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Taille</span>
              <Slider value={[fontSize]} min={12} max={72} step={2} onValueChange={(v) => setFontSize(v[0])} className="w-20" />
              <span className="text-xs font-mono w-6 text-center">{fontSize}</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={undo} title="Annuler dernière">
              <Undo2 className="h-4 w-4" />
            </Button>
            {selectedId && (
              <Button variant="destructive" size="sm" className="h-8 px-2 text-xs" onClick={deleteSelected} title="Supprimer la sélection">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Suppr.
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearAll} title="Tout effacer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
              className={`absolute inset-0 rounded ${tool === "select" ? "cursor-grab" : "cursor-crosshair"}`}
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
