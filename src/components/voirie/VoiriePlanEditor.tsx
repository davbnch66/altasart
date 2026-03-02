import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Download, Save, Wand2, Trash2, ZoomIn, ZoomOut,
  Plus, MousePointer, Loader2, X
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
  grue: "#E63946",
  balisage_cone: "#FF6B35",
  balisage_barriere: "#FF6B35",
  panneau_k8: "#FFD700",
  panneau_travaux: "#FFD700",
  panneau_deviation: "#2196F3",
  panneau_rue_barree: "#E63946",
  totem: "#FF4081",
  homme_traffic: "#4CAF50",
  pieton_deviation: "#4CAF50",
  zone_emprise: "#2196F3",
  fleche_deviation: "#2196F3",
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

const VoiriePlanEditor = ({
  planId, companyId, visiteId, dossierId, address,
  initialElements = [], pdfUrl, onSave, onClose,
}: VoiriePlanEditorProps) => {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      ctx.globalAlpha = 0.9;
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

    // Draw elements
    for (const el of elements) {
      const isSelected = el.id === selectedId;
      const color = el.color || ELEMENT_COLORS[el.type] || "#333";

      ctx.save();
      ctx.translate(el.x, el.y);
      if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);

      switch (el.type) {
        case "grue": {
          const r = el.radius || 60;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.fillStyle = color + "15";
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke(); }
          ctx.font = "16px sans-serif";
          ctx.fillText("🏗️", -8, 6);
          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = color;
          ctx.fillText(el.label || "Grue", -15, 22);
          break;
        }
        case "homme_traffic":
        case "pieton_deviation": {
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fillStyle = color + "33";
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#fff" : color;
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();
          ctx.font = "18px sans-serif";
          ctx.fillText(el.type === "homme_traffic" ? "🧑‍🦺" : "🚶", -9, 7);
          break;
        }
        case "balisage_cone": {
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
          ctx.font = "12px sans-serif";
          ctx.fillText("🔶", -6, 5);
          break;
        }
        case "balisage_barriere": {
          ctx.fillStyle = color;
          ctx.fillRect(-25, -4, 50, 8);
          ctx.fillRect(-25, -8, 4, 16);
          ctx.fillRect(21, -8, 4, 16);
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(-26, -9, 52, 18); }
          break;
        }
        case "zone_emprise": {
          const w = el.width || 150;
          const h = el.height || 80;
          ctx.fillStyle = color + "20";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          ctx.strokeRect(0, 0, w, h);
          ctx.setLineDash([]);
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(-2, -2, w + 4, h + 4); }
          ctx.font = "bold 10px sans-serif";
          ctx.fillStyle = color;
          ctx.fillText("Zone d'emprise", 4, 14);
          break;
        }
        case "fleche_deviation": {
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(60, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(50, -8); ctx.lineTo(60, 0); ctx.lineTo(50, 8); ctx.fillStyle = color; ctx.fill();
          if (isSelected) { ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
          ctx.font = "9px sans-serif";
          ctx.fillStyle = color;
          ctx.fillText("Déviation", 0, 16);
          break;
        }
        case "custom_text": {
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(-2, -14, 100, 20); }
          ctx.font = "bold 13px sans-serif";
          ctx.fillStyle = color;
          ctx.fillText(el.text || "Texte", 0, 0);
          break;
        }
        default: {
          // panneau_k8, panneau_travaux, panneau_deviation, panneau_rue_barree, totem
          const iconMap: Record<string, string> = {
            panneau_k8: "⚠️", panneau_travaux: "🔨", panneau_deviation: "↪️",
            panneau_rue_barree: "⛔", totem: "🔻",
          };
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const r2 = 4;
          ctx.roundRect(-14, -14, 28, 28, r2);
          ctx.fill();
          ctx.stroke();
          if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(-16, -16, 32, 32); }
          ctx.font = "16px sans-serif";
          ctx.fillText(iconMap[el.type] || "?", -8, 6);
          const paletteItem = ELEMENT_PALETTE.find((p) => p.type === el.type);
          ctx.font = "9px sans-serif";
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.fillText(paletteItem?.label || "", 0, 26);
          ctx.textAlign = "start";
          break;
        }
      }
      ctx.restore();
    }

    // Legend
    if (elements.length > 0) {
      const types = [...new Set(elements.map((e) => e.type))];
      const legendItems = types.map((t) => ({
        type: t,
        label: ELEMENT_PALETTE.find((p) => p.type === t)?.label || t,
        icon: ELEMENT_PALETTE.find((p) => p.type === t)?.icon || "?",
        count: elements.filter((e) => e.type === t).length,
        color: ELEMENT_COLORS[t] || "#333",
      }));
      const lx = 10;
      const ly = sh - 10 - legendItems.length * 18 - 25;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, 160, legendItems.length * 18 + 25, 6);
      ctx.fill();
      ctx.stroke();
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText("LÉGENDE", lx + 8, ly + 14);
      legendItems.forEach((item, i) => {
        ctx.beginPath();
        ctx.arc(lx + 14, ly + 27 + i * 18, 4, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`${item.icon} ${item.label} (×${item.count})`, lx + 24, ly + 31 + i * 18);
      });
    }

    ctx.restore();
  }, [elements, selectedId, bgImage, canvasSize, scale]);

  useEffect(() => { draw(); }, [draw]);

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
    // Reverse order so top elements are hit first
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const dx = pos.x - el.x;
      const dy = pos.y - el.y;
      const hitRadius = el.type === "zone_emprise" 
        ? Math.max(el.width || 150, el.height || 80) 
        : el.type === "grue" ? (el.radius || 60) : 20;
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

  const handlePointerUp = () => {
    setDragging(null);
  };

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
      radius: type === "grue" ? 60 : undefined,
      width: type === "zone_emprise" ? 150 : undefined,
      height: type === "zone_emprise" ? 80 : undefined,
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

  // ── PDF upload ──
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
        img.onload = () => setBgImage(img);
        img.src = url;
        setUploadingPdf(false);
        return;
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx2 = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx2, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
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
        type,
        label: palette?.label || type,
        icon: palette?.icon || "?",
        count: elements.filter((el) => el.type === type).length,
        color: ELEMENT_COLORS[type] || "#333",
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        visite_id: visiteId || null,
        dossier_id: dossierId || null,
        title,
        address: address || null,
        elements: elements as any,
        legend: generateLegend() as any,
        status: "brouillon",
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
    } finally {
      setSaving(false);
    }
  };

  // ── AI pre-fill ──
  const handleAiFill = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-voirie-plan", {
        body: { address, visiteId, dossierId, companyId, existingElements: elements, hasBackgroundPlan: !!bgImage, stageWidth: canvasSize.width, stageHeight: canvasSize.height },
      });
      if (error) throw error;
      if (data?.elements && Array.isArray(data.elements)) {
        setElements((prev) => [...prev, ...data.elements.map((el: any) => ({ ...el, id: genId() }))]);
        toast.success(`${data.elements.length} éléments ajoutés par l'IA`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur IA");
    } finally {
      setAiLoading(false);
    }
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
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-sm w-48 max-w-[200px]"
          placeholder="Titre du plan"
        />
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

        {/* Delete selected */}
        {selectedId && (
          <Button variant="destructive" size="sm" className="h-8 w-8 p-0" onClick={deleteSelected} title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        <div className="flex-1" />

        {/* Export & Save */}
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
              <button
                key={item.type}
                onClick={() => addElement(item.type)}
                className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                title={item.label}
              >
                <span className="text-sm">{item.icon}</span>
                {!isMobile && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-muted/30 relative" ref={containerRef}>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="cursor-crosshair"
            style={{ width: canvasSize.width, height: canvasSize.height }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />

          {/* No plan hint */}
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
                  <Input type="number" value={selectedEl.radius || 60} onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}

            {selectedEl.type === "zone_emprise" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground">Largeur (px)</label>
                  <Input type="number" value={selectedEl.width || 150} onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Hauteur (px)</label>
                  <Input type="number" value={selectedEl.height || 80} onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}

            {selectedEl.type === "custom_text" && (
              <div>
                <label className="text-[10px] text-muted-foreground">Texte</label>
                <Input value={selectedEl.text || ""} onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })} className="h-7 text-xs mt-0.5" />
              </div>
            )}

            {(selectedEl.type === "fleche_deviation" || selectedEl.type === "balisage_barriere") && (
              <div>
                <label className="text-[10px] text-muted-foreground">Rotation (°)</label>
                <Input type="number" value={selectedEl.rotation || 0} onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
              </div>
            )}

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
