import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Pencil, ArrowUp, Type, Square, Circle,
  Eraser, Undo2, Trash2, Save, X, Ruler, Move
} from "lucide-react";

type Tool = "select" | "pen" | "arrow" | "text" | "rect" | "circle" | "eraser" | "cote";

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

const TOOL_COLORS = [
  { value: "#ef4444", label: "Rouge" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Jaune" },
  { value: "#22c55e", label: "Vert" },
  { value: "#3b82f6", label: "Bleu" },
  { value: "#ffffff", label: "Blanc" },
  { value: "#000000", label: "Noir" },
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
    case "eraser": {
      if (!a.points || a.points.length < 2) return false;
      for (let i = 1; i < a.points.length; i++) {
        if (distToSegment(px, py, a.points[i - 1].x, a.points[i - 1].y, a.points[i].x, a.points[i].y) < threshold)
          return true;
      }
      return false;
    }
    case "arrow":
    case "cote": {
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
  if (a.tool === "pen" || a.tool === "eraser") {
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
  const [coteInput, setCoteInput] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [coteValue, setCoteValue] = useState("");
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
      const maxW = window.innerWidth - 16;
      const maxH = window.innerHeight - 280;
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
      setCoteInput(null);
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

    switch (a.tool) {
      case "pen":
        if (a.points && a.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(a.points[0].x, a.points[0].y);
          a.points.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }
        break;
      case "eraser":
        if (a.points && a.points.length > 1) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineWidth = a.lineWidth * 4;
          ctx.beginPath();
          ctx.moveTo(a.points[0].x, a.points[0].y);
          a.points.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        break;
      case "arrow":
        if (a.startX != null && a.startY != null && a.endX != null && a.endY != null) {
          drawArrow(ctx, a.startX, a.startY, a.endX, a.endY, a.lineWidth);
        }
        break;
      case "cote":
        if (a.startX != null && a.startY != null && a.endX != null && a.endY != null) {
          drawCote(ctx, a.startX, a.startY, a.endX, a.endY, a.lineWidth, a.text || "", a.fontSize || 16);
        }
        break;
      case "text":
        if (a.text && a.startX != null && a.startY != null) {
          const fs = a.fontSize || 24;
          ctx.font = `bold ${fs}px sans-serif`;
          const metrics = ctx.measureText(a.text);
          const textW = metrics.width;
          const textH = fs;
          const padX = 6, padY = 4;
          // Background
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(a.startX - padX, a.startY - textH - padY, textW + padX * 2, textH + padY * 2);
          // Border
          ctx.strokeStyle = a.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(a.startX - padX, a.startY - textH - padY, textW + padX * 2, textH + padY * 2);
          // Text
          ctx.fillStyle = a.color;
          ctx.fillText(a.text, a.startX, a.startY - padY);
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

  const drawCote = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    lw: number, text: string, fs: number
  ) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(lw * 3, 10);
    const perpLen = 8;
    const perpAngle = angle + Math.PI / 2;

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead at start
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + headLen * Math.cos(angle - Math.PI / 6), y1 + headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x1 + headLen * Math.cos(angle + Math.PI / 6), y1 + headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Arrowhead at end
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Perpendicular ticks at ends
    ctx.beginPath();
    ctx.moveTo(x1 + perpLen * Math.cos(perpAngle), y1 + perpLen * Math.sin(perpAngle));
    ctx.lineTo(x1 - perpLen * Math.cos(perpAngle), y1 - perpLen * Math.sin(perpAngle));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2 + perpLen * Math.cos(perpAngle), y2 + perpLen * Math.sin(perpAngle));
    ctx.lineTo(x2 - perpLen * Math.cos(perpAngle), y2 - perpLen * Math.sin(perpAngle));
    ctx.stroke();

    // Text label centered on line
    if (text) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.save();
      ctx.font = `bold ${fs}px sans-serif`;
      const metrics = ctx.measureText(text);
      const textW = metrics.width;
      const textH = fs;
      const padX = 6, padY = 3;
      // Background
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.translate(midX, midY);
      // Rotate text to match line angle, but keep readable
      let displayAngle = angle;
      if (displayAngle > Math.PI / 2) displayAngle -= Math.PI;
      if (displayAngle < -Math.PI / 2) displayAngle += Math.PI;
      ctx.rotate(displayAngle);
      ctx.fillRect(-textW / 2 - padX, -textH / 2 - padY, textW + padX * 2, textH + padY * 2);
      ctx.strokeStyle = ctx.strokeStyle; // keep current color
      ctx.lineWidth = 1;
      ctx.strokeRect(-textW / 2 - padX, -textH / 2 - padY, textW + padX * 2, textH + padY * 2);
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
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

    if (tool === "select") {
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
    const isFreehand = tool === "pen" || tool === "eraser";
    const newAnnotation: Annotation = {
      id: crypto.randomUUID(),
      tool,
      color,
      lineWidth,
      fontSize,
      points: isFreehand ? [pos] : undefined,
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
    if (prev.tool === "pen" || prev.tool === "eraser") {
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

    // Cote tool: after drawing the line, ask for the dimension value
    if (finalAnnotation.tool === "cote") {
      setCoteInput({
        startX: finalAnnotation.startX!,
        startY: finalAnnotation.startY!,
        endX: finalAnnotation.endX!,
        endY: finalAnnotation.endY!,
      });
      setCoteValue("");
      currentAnnotationRef.current = null;
      setCurrentAnnotation(null);
      const overlay = overlayRef.current;
      overlay?.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
      return;
    }

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

  const addCoteAnnotation = () => {
    if (!coteInput) return;
    const text = coteValue.trim() || "";
    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tool: "cote",
        color,
        lineWidth,
        fontSize: 16,
        text,
        startX: coteInput.startX,
        startY: coteInput.startY,
        endX: coteInput.endX,
        endY: coteInput.endY,
      },
    ]);
    setCoteInput(null);
    setCoteValue("");
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
        if (typeof createImageBitmap === "function") {
          try {
            const bmpOrImg = await createImageBitmap(blob);
            fctx.drawImage(bmpOrImg, 0, 0, fullCanvas.width, fullCanvas.height);
            if (typeof bmpOrImg.close === "function") bmpOrImg.close();
          } catch {
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
    { id: "pen", icon: Pencil, label: "Crayon" },
    { id: "arrow", icon: ArrowUp, label: "Flèche" },
    { id: "text", icon: Type, label: "Texte" },
    { id: "rect", icon: Square, label: "Rect" },
    { id: "circle", icon: Circle, label: "Cercle" },
    { id: "cote", icon: Ruler, label: "Cote" },
    { id: "eraser", icon: Eraser, label: "Gomme" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 overflow-hidden flex flex-col rounded-none gap-0"
        style={{ margin: 0 }}
      >
        {/* ── Slim header ── */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Annoter</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Canvas area (takes all remaining space) ── */}
        <div ref={containerRef} className="relative flex-1 flex items-center justify-center overflow-hidden bg-black/5">
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

            {/* Text input popup */}
            {textInput && (
              <div
                className="absolute z-10 animate-in fade-in-0 zoom-in-95"
                style={{ left: Math.min(textInput.x, canvasSize.w - 200), top: Math.max(textInput.y - 50, 0) }}
              >
                <div className="bg-card border-2 rounded-xl shadow-lg p-2 flex gap-1.5" style={{ borderColor: color }}>
                  <Input
                    autoFocus
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTextAnnotation()}
                    className="h-9 text-sm w-36 rounded-lg border-none bg-muted/50"
                    placeholder="Votre texte..."
                  />
                  <Button size="sm" className="h-9 px-3 rounded-lg" onClick={addTextAnnotation}>
                    OK
                  </Button>
                </div>
              </div>
            )}

            {/* Cote input popup */}
            {coteInput && (
              <div
                className="absolute z-10 animate-in fade-in-0 zoom-in-95"
                style={{
                  left: Math.min((coteInput.startX + coteInput.endX) / 2, canvasSize.w - 200),
                  top: Math.max((coteInput.startY + coteInput.endY) / 2 - 50, 0),
                }}
              >
                <div className="bg-card border-2 border-primary rounded-xl shadow-lg p-2 flex gap-1.5">
                  <Input
                    autoFocus
                    value={coteValue}
                    onChange={(e) => setCoteValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCoteAnnotation()}
                    className="h-9 text-sm w-28 rounded-lg border-none bg-muted/50"
                    placeholder="ex: 2m80"
                  />
                  <Button size="sm" className="h-9 px-3 rounded-lg" onClick={addCoteAnnotation}>
                    OK
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom toolbar panel ── */}
        <div className="shrink-0 bg-card border-t border-border pb-safe">
          {/* Row 1: Tools + Undo */}
          <div className="flex items-center justify-center gap-1.5 px-3 pt-2.5 pb-1">
            {toolItems.map((t) => {
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTool(t.id); if (t.id !== "select") setSelectedId(null); }}
                  className={`flex flex-col items-center justify-center rounded-xl transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  style={{ width: 44, height: 44 }}
                  title={t.label}
                >
                  <t.icon className="h-5 w-5" />
                  <span className="text-[9px] font-medium mt-0.5 leading-none">{t.label}</span>
                </button>
              );
            })}
            {/* Separator */}
            <div className="w-px h-8 bg-border mx-0.5" />
            {/* Undo button in toolbar */}
            <button
              onClick={undo}
              disabled={annotations.length === 0}
              className="flex flex-col items-center justify-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"
              style={{ width: 44, height: 44 }}
              title="Annuler"
            >
              <Undo2 className="h-5 w-5" />
              <span className="text-[9px] font-medium mt-0.5 leading-none">Annuler</span>
            </button>
            {/* Move / select */}
            <button
              onClick={() => { setTool("select"); }}
              className={`flex flex-col items-center justify-center rounded-xl transition-all ${
                tool === "select"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              style={{ width: 44, height: 44 }}
              title="Déplacer"
            >
              <Move className="h-5 w-5" />
              <span className="text-[9px] font-medium mt-0.5 leading-none">Déplacer</span>
            </button>
            {/* Delete selected */}
            {selectedId && (
              <button
                onClick={deleteSelected}
                className="flex flex-col items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition-all"
                style={{ width: 44, height: 44 }}
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-[9px] font-medium mt-0.5 leading-none">Suppr</span>
              </button>
            )}
          </div>

          {/* Slider: stroke width */}
          <div className="flex items-center gap-2 px-4 py-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-8">Trait</span>
            <Slider
              value={[lineWidth]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => setLineWidth(v[0])}
              className="flex-1"
            />
            <span className="text-xs font-mono text-muted-foreground w-5 text-right">{lineWidth}</span>
          </div>

          {/* Row 2: Colors */}
          <div className="flex items-center justify-center gap-2.5 px-3 pb-2">
            {TOOL_COLORS.map((c) => {
              const isActive = color === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`rounded-full border-2 transition-all shrink-0 ${
                    isActive
                      ? "scale-110 border-foreground ring-2 ring-primary/30"
                      : "border-border hover:scale-105"
                  } ${c.value === "#ffffff" ? "shadow-sm" : ""}`}
                  style={{
                    backgroundColor: c.value,
                    width: 32,
                    height: 32,
                  }}
                  title={c.label}
                />
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-3 pb-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-[52px] rounded-2xl text-base gap-2 border-border"
            >
              <X className="h-5 w-5" /> Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={annotations.length === 0}
              className="flex-1 h-[52px] rounded-2xl text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="h-5 w-5" /> Sauvegarder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
