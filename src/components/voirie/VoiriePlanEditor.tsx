import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Download, Save, Wand2, Trash2, ZoomIn, ZoomOut,
  Plus, Loader2, X
} from "lucide-react";

// ── Element types ──
export interface PlanElement {
  id: string;
  type: "grue" | "balisage_cone" | "balisage_barriere" | "panneau_k8" | "panneau_travaux" |
    "panneau_deviation" | "panneau_rue_barree" | "totem" | "homme_traffic" | "zone_emprise" |
    "fleche_deviation" | "pieton_deviation" | "custom_text";
  x: number;
  y: number;
  rotation?: number;
  radius?: number;
  label?: string;
  points?: number[];
  width?: number;
  height?: number;
  text?: string;
  color?: string;
}

const ELEMENT_PALETTE = [
  { type: "grue", label: "Grue", icon: "🏗️", category: "Engins" },
  { type: "balisage_cone", label: "Cône", icon: "🔶", category: "Balisage" },
  { type: "balisage_barriere", label: "Barrière", icon: "🚧", category: "Balisage" },
  { type: "panneau_k8", label: "K8", icon: "⚠️", category: "Signalisation" },
  { type: "panneau_travaux", label: "Travaux", icon: "🔨", category: "Signalisation" },
  { type: "panneau_deviation", label: "Déviation", icon: "↪️", category: "Signalisation" },
  { type: "panneau_rue_barree", label: "Rue barrée", icon: "⛔", category: "Signalisation" },
  { type: "totem", label: "Totem ralentir", icon: "🔻", category: "Signalisation" },
  { type: "homme_traffic", label: "Homme trafic", icon: "🧑‍🦺", category: "Personnel" },
  { type: "pieton_deviation", label: "Dév. piéton", icon: "🚶", category: "Personnel" },
  { type: "zone_emprise", label: "Zone emprise", icon: "▢", category: "Zones" },
  { type: "fleche_deviation", label: "Flèche dév.", icon: "➡️", category: "Signalisation" },
  { type: "custom_text", label: "Texte", icon: "T", category: "Autre" },
] as const;

const ELEMENT_COLORS: Record<string, string> = {
  grue: "#C8501E",
  balisage_cone: "#FF6B35",
  balisage_barriere: "#E63946",
  panneau_k8: "#FFD700",
  panneau_travaux: "#FFD700",
  panneau_deviation: "#2196F3",
  panneau_rue_barree: "#E63946",
  totem: "#FF4081",
  homme_traffic: "#F5A623",
  pieton_deviation: "#4CAF50",
  zone_emprise: "#4CAF50",
  fleche_deviation: "#333333",
  custom_text: "#333333",
};

interface VoiriePlanEditorProps {
  planId?: string;
  companyId: string;
  visiteId?: string;
  dossierId?: string;
  address?: string;
  initialElements?: PlanElement[];
  pdfUrl?: string;
  onSave?: () => void;
  onClose?: () => void;
}

const genId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Professional drawing functions ──
function drawCrane(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  const r = el.radius || 80;
  const color = el.color || ELEMENT_COLORS.grue;
  
  // Zone d'emprise (green outline)
  ctx.save();
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  const empriseW = r * 2.2;
  const empriseH = r * 0.8;
  ctx.strokeRect(-empriseW / 2, -empriseH / 2, empriseW, empriseH);
  ctx.fillStyle = "rgba(76,175,80,0.08)";
  ctx.fillRect(-empriseW / 2, -empriseH / 2, empriseW, empriseH);
  ctx.setLineDash([]);
  ctx.restore();

  // Crane body (orange rectangle)
  const bodyW = r * 1.4;
  const bodyH = r * 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  ctx.strokeStyle = "#8B3A10";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);

  // Cabin (darker rectangle at left)
  const cabW = bodyW * 0.15;
  ctx.fillStyle = "#8B3A10";
  ctx.fillRect(-bodyW / 2, -bodyH / 2, cabW, bodyH);

  // Arrow showing reach direction (black)
  const arrowStartX = bodyW / 2;
  const arrowLen = r * 0.6;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-arrowLen, bodyH / 2 + 8);
  ctx.lineTo(arrowLen, bodyH / 2 + 8);
  ctx.stroke();
  // Arrow heads
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(arrowLen, bodyH / 2 + 8);
  ctx.lineTo(arrowLen - 8, bodyH / 2 + 2);
  ctx.lineTo(arrowLen - 8, bodyH / 2 + 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-arrowLen, bodyH / 2 + 8);
  ctx.lineTo(-arrowLen + 8, bodyH / 2 + 2);
  ctx.lineTo(-arrowLen + 8, bodyH / 2 + 14);
  ctx.closePath();
  ctx.fill();

  // Reach label
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  const reachMeters = el.label?.match(/(\d+)/)?.[1] || Math.round(r / 5);
  ctx.fillText(`${reachMeters}m`, 0, bodyH / 2 + 22);
  ctx.textAlign = "start";

  // Label above
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(el.label || "Grue", 0, -bodyH / 2 - 6);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(-empriseW / 2 - 4, -empriseH / 2 - 4, empriseW + 8, empriseH + 8);
    ctx.setLineDash([]);
  }
}

function drawHommeTraffic(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  // Body
  ctx.fillStyle = "#333";
  ctx.fillRect(-3, -2, 6, 16);
  // Arms
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(8, 4); ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.arc(0, -6, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#F5C49C";
  ctx.fill();
  // Hard hat (yellow)
  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.ellipse(0, -10, 7, 4, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-7, -10, 14, 2);
  // Legs
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2, 14); ctx.lineTo(-5, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, 14); ctx.lineTo(5, 22); ctx.stroke();
  // Hi-vis vest
  ctx.fillStyle = "#FF6B00";
  ctx.fillRect(-4, -1, 8, 8);
  ctx.fillStyle = "#C8C8C8";
  ctx.fillRect(-4, 3, 8, 1.5);

  // Label
  ctx.font = "bold 10px Arial, sans-serif";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText("Homme traffic", 0, 34);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -16, 24, 54);
  }
}

function drawCone(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  // Base
  ctx.fillStyle = "#666";
  ctx.fillRect(-8, 12, 16, 3);
  // Cone body (orange triangle)
  ctx.fillStyle = "#FF6B35";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(-7, 12);
  ctx.lineTo(7, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#CC4400";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // White stripes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(-2.5, -2);
  ctx.lineTo(-4.5, 4);
  ctx.lineTo(4.5, 4);
  ctx.lineTo(2.5, -2);
  ctx.closePath();
  ctx.fill();

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -12, 20, 28);
  }
}

function drawBarriere(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  // Posts
  ctx.fillStyle = "#666";
  ctx.fillRect(-30, -2, 4, 20);
  ctx.fillRect(26, -2, 4, 20);
  // Bar with red/white stripes
  const barW = 56;
  const barH = 10;
  const stripeW = 8;
  for (let i = 0; i < barW; i += stripeW * 2) {
    ctx.fillStyle = "#E63946";
    ctx.fillRect(-28 + i, -2, Math.min(stripeW, barW - i), barH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-28 + i + stripeW, -2, Math.min(stripeW, barW - i - stripeW), barH);
  }
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-28, -2, barW, barH);

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-32, -6, 64, 28);
  }
}

function drawPanneau(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean, type: string) {
  // Post
  ctx.fillStyle = "#888";
  ctx.fillRect(-1.5, 8, 3, 18);
  
  if (type === "panneau_k8" || type === "panneau_travaux") {
    // Triangle warning sign
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-13, 8);
    ctx.lineTo(13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#E63946";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Exclamation or icon
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(type === "panneau_k8" ? "!" : "⚒", 0, 5);
    ctx.textAlign = "start";
  } else if (type === "panneau_rue_barree") {
    // Round red sign with white bar
    ctx.beginPath();
    ctx.arc(0, -2, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#E63946";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-10, -4, 20, 4);
    // Text below
    ctx.font = "bold 7px Arial";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText("ROUTE", 0, 32);
    ctx.fillText("BARRÉE", 0, 40);
    ctx.textAlign = "start";
  } else if (type === "panneau_deviation") {
    // Blue square with arrow
    ctx.fillStyle = "#2196F3";
    const s = 12;
    ctx.fillRect(-s, -s - 2, s * 2, s * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(-s, -s - 2, s * 2, s * 2);
    // White arrow
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(5, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, -6);
    ctx.lineTo(5, -1);
    ctx.stroke();
  } else if (type === "totem") {
    // Speed limit sign (like "30")
    ctx.beginPath();
    ctx.arc(0, -2, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#E63946";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("30", 0, 3);
    ctx.textAlign = "start";
  }

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -18, 32, 48);
  }
}

function drawZoneEmprise(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  const w = el.width || 150;
  const h = el.height || 80;
  const color = el.color || ELEMENT_COLORS.zone_emprise;
  ctx.fillStyle = color + "18";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);
  ctx.font = "bold 10px Arial, sans-serif";
  ctx.fillStyle = color;
  ctx.fillText("Zone d'emprise", 4, 14);

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, -2, w + 4, h + 4);
  }
}

function drawFlecheDeviation(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  // Big black arrow
  const len = 60;
  ctx.fillStyle = "#000";
  // Arrow body
  ctx.fillRect(0, -6, len - 12, 12);
  // Arrow head
  ctx.beginPath();
  ctx.moveTo(len - 12, -14);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - 12, 14);
  ctx.closePath();
  ctx.fill();
  // Dimension text
  ctx.font = "bold 10px Arial";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText("4m", len / 2, -12);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-4, -18, len + 8, 36);
  }
}

function drawPietonDeviation(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  // Blue circle with pedestrian
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#2196F3";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  // Pedestrian icon (white)
  ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-4, 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(4, 11); ctx.stroke();

  if (isSelected) {
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -18, 36, 36);
  }
}

function drawCustomText(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillStyle = el.color || "#000";
  ctx.fillText(el.text || "Texte", 0, 0);
  if (isSelected) {
    const m = ctx.measureText(el.text || "Texte");
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 1;
    ctx.strokeRect(-2, -16, m.width + 4, 22);
  }
}

// ── Main component ──
const VoiriePlanEditor = ({
  planId, companyId, visiteId, dossierId, address,
  initialElements = [], pdfUrl, onSave, onClose,
}: VoiriePlanEditorProps) => {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasDrawErrorRef = useRef(false);
  const bgDataUrlRef = useRef<string | null>(null);

  const [elements, setElements] = useState<PlanElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [title, setTitle] = useState(address || "Plan d'implantation");
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Resize canvas to container
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = Math.max(400, containerRef.current.offsetHeight || (window.innerHeight - 280));
        setCanvasSize({ width: w, height: h });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Load background image
  useEffect(() => {
    if (!pdfUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImage(img);
    img.src = pdfUrl;
  }, [pdfUrl]);

  // ── Draw everything on canvas ──
  const draw = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);

      const sw = canvasSize.width / scale;
      const sh = canvasSize.height / scale;

      // Background image (aspect-ratio preserved)
      if (bgImage) {
        const imgW = bgImage.naturalWidth || bgImage.width;
        const imgH = bgImage.naturalHeight || bgImage.height;
        const ratio = Math.min(sw / imgW, sh / imgH);
        const drawW = imgW * ratio;
        const drawH = imgH * ratio;
        const ox = (sw - drawW) / 2;
        const oy = (sh - drawH) / 2;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(bgImage, ox, oy, drawW, drawH);
        ctx.globalAlpha = 1;
      } else {
        // Grid
        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < sw; x += 50) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke();
        }
        for (let y = 0; y < sh; y += 50) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke();
        }
        ctx.fillStyle = "#999";
        ctx.font = "14px sans-serif";
        ctx.fillText("Chargez un plan PDF ou image de fond", sw / 2 - 150, sh / 2);
      }

      // Draw elements with professional rendering
      for (const el of elements) {
        const isSelected = el.id === selectedId;
        ctx.save();
        ctx.translate(el.x, el.y);
        if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

        try {
          switch (el.type) {
            case "grue": drawCrane(ctx, el, isSelected); break;
            case "homme_traffic": drawHommeTraffic(ctx, el, isSelected); break;
            case "pieton_deviation": drawPietonDeviation(ctx, el, isSelected); break;
            case "balisage_cone": drawCone(ctx, el, isSelected); break;
            case "balisage_barriere": drawBarriere(ctx, el, isSelected); break;
            case "zone_emprise": drawZoneEmprise(ctx, el, isSelected); break;
            case "fleche_deviation": drawFlecheDeviation(ctx, el, isSelected); break;
            case "custom_text": drawCustomText(ctx, el, isSelected); break;
            default: drawPanneau(ctx, el, isSelected, el.type); break;
          }
        } catch (elErr) {
          console.warn("[VoiriePlan] draw element error", el.type, elErr);
        }

        ctx.restore();
      }

      // Legend
      if (elements.length > 0) {
        const types = [...new Set(elements.map((e) => e.type))];
        const legendItems = types.map((t) => ({
          type: t,
          label: ELEMENT_PALETTE.find((p) => p.type === t)?.label || t,
          count: elements.filter((e) => e.type === t).length,
          color: ELEMENT_COLORS[t] || "#333",
        }));
        const lx = 10;
        const ly = sh - 10 - legendItems.length * 20 - 28;
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(lx, ly, 170, legendItems.length * 20 + 28);
        ctx.fill();
        ctx.stroke();
        ctx.font = "bold 10px Arial, sans-serif";
        ctx.fillStyle = "#444";
        ctx.fillText("LÉGENDE", lx + 8, ly + 16);
        legendItems.forEach((item, i) => {
          ctx.beginPath();
          ctx.arc(lx + 16, ly + 32 + i * 20, 5, 0, Math.PI * 2);
          ctx.fillStyle = item.color;
          ctx.fill();
          ctx.font = "11px Arial, sans-serif";
          ctx.fillStyle = "#222";
          ctx.fillText(`${item.label} (×${item.count})`, lx + 28, ly + 36 + i * 20);
        });
      }

      ctx.restore();
    } catch (error) {
      console.error("[VoiriePlanEditor] draw crash", error);
      if (!hasDrawErrorRef.current) {
        hasDrawErrorRef.current = true;
        toast.error("Erreur de rendu du plan. Rechargez la page.");
      }
    }
  }, [elements, selectedId, bgImage, canvasSize, scale]);

  useEffect(() => {
    try { draw(); } catch (error) {
      console.error("[VoiriePlanEditor] draw effect crash", error);
    }
  }, [draw]);

  // ── Mouse / Touch interaction ──
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX || 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY || 0 : e.clientY;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const hitTest = (pos: { x: number; y: number }) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const dx = pos.x - el.x;
      const dy = pos.y - el.y;
      const hitRadius = el.type === "zone_emprise"
        ? Math.max(el.width || 150, el.height || 80)
        : el.type === "grue" ? (el.radius || 80) : 25;
      if (el.type === "zone_emprise") {
        if (dx >= 0 && dx <= (el.width || 150) && dy >= 0 && dy <= (el.height || 80)) return el;
      } else if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        return el;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    const hit = hitTest(pos);
    if (hit) {
      setSelectedId(hit.id);
      setDragging({ id: hit.id, offsetX: pos.x - hit.x, offsetY: pos.y - hit.y });
    } else {
      setSelectedId(null);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const pos = getCanvasPos(e);
    setElements((prev) =>
      prev.map((el) =>
        el.id === dragging.id
          ? { ...el, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY }
          : el
      )
    );
  };

  const handlePointerUp = () => setDragging(null);

  // ── Add element ──
  const addElement = useCallback((type: string) => {
    const cx = canvasSize.width / 2 / scale;
    const cy = canvasSize.height / 2 / scale;
    const newEl: PlanElement = {
      id: genId(),
      type: type as PlanElement["type"],
      x: cx + (Math.random() - 0.5) * 100,
      y: cy + (Math.random() - 0.5) * 100,
      rotation: 0,
      label: type === "grue" ? "Grue" : undefined,
      radius: type === "grue" ? 80 : undefined,
      width: type === "zone_emprise" ? 200 : undefined,
      height: type === "zone_emprise" ? 100 : undefined,
      text: type === "custom_text" ? "Texte" : undefined,
      color: ELEMENT_COLORS[type] || "#333",
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  }, [canvasSize, scale]);

  const updateElement = useCallback((id: string, updates: Partial<PlanElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // ── PDF upload (high quality) ──
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("Format non supporté. Utilisez PDF ou image.");
      return;
    }
    setUploadingPdf(true);
    try {
      if (file.type.includes("image")) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
          setBgImage(img);
          // Store data URL for AI vision
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.naturalWidth || img.width;
          tempCanvas.height = img.naturalHeight || img.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0);
            bgDataUrlRef.current = tempCanvas.toDataURL("image/jpeg", 0.7);
          }
        };
        img.src = url;
        setUploadingPdf(false);
        return;
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      // HIGH QUALITY: scale 4 for crisp rendering
      const viewport = page.getViewport({ scale: 4 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx2 = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx2, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      
      // Store a lower-res version for AI vision (to keep payload manageable)
      const aiViewport = page.getViewport({ scale: 1.5 });
      const aiCanvas = document.createElement("canvas");
      aiCanvas.width = aiViewport.width;
      aiCanvas.height = aiViewport.height;
      const aiCtx = aiCanvas.getContext("2d")!;
      await page.render({ canvasContext: aiCtx, viewport: aiViewport }).promise;
      bgDataUrlRef.current = aiCanvas.toDataURL("image/jpeg", 0.7);
      
      const img = new window.Image();
      img.onload = () => setBgImage(img);
      img.src = dataUrl;
      const path = `${companyId}/${planId || genId()}.pdf`;
      await supabase.storage.from("voirie-plans").upload(path, file, { upsert: true });
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement du plan");
    } finally {
      setUploadingPdf(false);
    }
  };

  // ── Save ──
  const generateLegend = () => {
    const types = new Set(elements.map((el) => el.type));
    return Array.from(types).map((type) => {
      const palette = ELEMENT_PALETTE.find((p) => p.type === type);
      return {
        type, label: palette?.label || type, icon: palette?.icon || "?",
        count: elements.filter((el) => el.type === type).length,
        color: ELEMENT_COLORS[type] || "#333",
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_id: companyId, visite_id: visiteId || null,
        dossier_id: dossierId || null, title, address: address || null,
        elements: elements as any, legend: generateLegend() as any, status: "brouillon",
      };
      if (planId) {
        const { error } = await supabase.from("voirie_plans").update(payload).eq("id", planId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("voirie_plans").insert(payload as any);
        if (error) throw error;
      }
      toast.success("Plan sauvegardé");
      onSave?.();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally { setSaving(false); }
  };

  // ── AI pre-fill with VISION ──
  const handleAiFill = async () => {
    setAiLoading(true);
    try {
      const body: any = {
        address, visiteId, dossierId, companyId,
        existingElements: elements, hasBackgroundPlan: !!bgImage,
        stageWidth: canvasSize.width / scale,
        stageHeight: canvasSize.height / scale,
      };
      // Send plan image for vision-based positioning
      if (bgDataUrlRef.current) {
        body.planImageBase64 = bgDataUrlRef.current;
      }
      const { data, error } = await supabase.functions.invoke("analyze-voirie-plan", { body });
      if (error) throw error;
      if (data?.elements && Array.isArray(data.elements)) {
        setElements((prev) => [...prev, ...data.elements.map((el: any) => ({ ...el, id: genId() }))]);
        toast.success(`${data.elements.length} éléments ajoutés par l'IA`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur IA");
    } finally { setAiLoading(false); }
  };

  // ── Export PNG ──
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelectedId(null);
    setTimeout(() => {
      draw();
      const link = document.createElement("a");
      link.download = `plan-implantation-${title.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Plan exporté en PNG");
    }, 100);
  };

  // ── Export PDF ──
  const handleExportPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSelectedId(null);
    setTimeout(async () => {
      draw();
      const { default: jsPDF } = await import("jspdf");
      const uri = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvasSize.width, canvasSize.height] });
      pdf.addImage(uri, "PNG", 0, 0, canvasSize.width, canvasSize.height);
      const legend = generateLegend();
      if (legend.length > 0) {
        pdf.addPage();
        pdf.setFontSize(18);
        pdf.text("Légende", 30, 40);
        pdf.setFontSize(12);
        legend.forEach((item, i) => {
          pdf.setFillColor(item.color);
          pdf.circle(40, 70 + i * 25, 6, "F");
          pdf.text(`${item.icon} ${item.label} (×${item.count})`, 55, 74 + i * 25);
        });
      }
      pdf.save(`plan-implantation-${title.replace(/\s+/g, "-")}.pdf`);
      toast.success("Plan exporté en PDF");
    }, 100);
  };

  const selectedEl = elements.find((el) => el.id === selectedId);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-card flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-sm w-48 max-w-[200px]" placeholder="Titre du plan" />
        <div className="h-6 w-px bg-border" />

        {/* Upload PDF */}
        <label className="cursor-pointer">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
            <span>
              {uploadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {bgImage ? "Changer le plan" : "Charger un plan"}
            </span>
          </Button>
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePdfUpload(f);
            e.target.value = "";
          }} />
        </label>

        <div className="h-6 w-px bg-border" />

        {/* Zoom */}
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setScale((s) => Math.min(3, s + 0.2))} title="Zoom +">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setScale((s) => Math.max(0.3, s - 0.2))} title="Zoom -">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* AI fill */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleAiFill} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          IA
        </Button>

        {selectedId && (
          <Button variant="destructive" size="sm" className="h-8 w-8 p-0" onClick={deleteSelected} title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportPdf}>
          <Download className="h-3 w-3" /> PDF
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportPng}>
          <Download className="h-3 w-3" /> PNG
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Sauvegarder
        </Button>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className={`border-r bg-card overflow-y-auto ${isMobile ? "w-12" : "w-44"} shrink-0`}>
          <div className="p-1.5 space-y-1">
            {!isMobile && <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1">Éléments</p>}
            {ELEMENT_PALETTE.map((item) => (
              <button key={item.type} onClick={() => addElement(item.type)}
                className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                title={item.label}>
                <span className="text-sm">{item.icon}</span>
                {!isMobile && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-muted/30 relative" ref={containerRef}>
          <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height}
            className="cursor-crosshair"
            style={{ width: canvasSize.width, height: canvasSize.height }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp} />

          {!bgImage && elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                <p className="text-sm font-medium">Chargez un plan de voirie</p>
                <p className="text-xs mt-1">PDF ou image (plan cadastral, plan de masse…)</p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - selected element properties */}
        {selectedEl && !isMobile && (
          <div className="w-52 border-l bg-card p-3 space-y-3 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Propriétés</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedId(null)}>✕</Button>
            </div>
            <div>
              <Badge className="text-[10px]">{ELEMENT_PALETTE.find((p) => p.type === selectedEl.type)?.label || selectedEl.type}</Badge>
            </div>
            {selectedEl.type === "grue" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground">Nom de la grue</label>
                  <Input value={selectedEl.label || ""} onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Rayon de giration (px)</label>
                  <Input type="number" value={selectedEl.radius || 80} onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}
            {selectedEl.type === "zone_emprise" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground">Largeur (px)</label>
                  <Input type="number" value={selectedEl.width || 200} onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Hauteur (px)</label>
                  <Input type="number" value={selectedEl.height || 100} onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}
            {selectedEl.type === "custom_text" && (
              <div>
                <label className="text-[10px] text-muted-foreground">Texte</label>
                <Input value={selectedEl.text || ""} onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })} className="h-7 text-xs mt-0.5" />
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground">Rotation (°)</label>
              <Input type="number" value={selectedEl.rotation || 0} onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Position</label>
              <div className="flex gap-1 mt-0.5">
                <Input type="number" value={Math.round(selectedEl.x)} onChange={(e) => updateElement(selectedEl.id, { x: Number(e.target.value) })} className="h-7 text-xs" placeholder="X" />
                <Input type="number" value={Math.round(selectedEl.y)} onChange={(e) => updateElement(selectedEl.id, { y: Number(e.target.value) })} className="h-7 text-xs" placeholder="Y" />
              </div>
            </div>
            <Button variant="destructive" size="sm" className="w-full h-7 text-xs gap-1" onClick={deleteSelected}>
              <Trash2 className="h-3 w-3" /> Supprimer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiriePlanEditor;
