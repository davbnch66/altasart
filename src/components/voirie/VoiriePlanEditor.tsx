import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Line, Text, Group, Rect, Arrow } from "react-konva";
import Konva from "konva";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Download, Save, Wand2, Trash2, RotateCcw, ZoomIn, ZoomOut,
  Plus, MousePointer, Move, Loader2
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
  // Grue specific
  radius?: number;
  label?: string;
  // Zone emprise specific
  points?: number[];
  width?: number;
  height?: number;
  // Text
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

const VoiriePlanEditor = ({
  planId, companyId, visiteId, dossierId, address,
  initialElements = [], pdfUrl, onSave, onClose,
}: VoiriePlanEditorProps) => {
  const isMobile = useIsMobile();
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [elements, setElements] = useState<PlanElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [title, setTitle] = useState(address || "Plan d'implantation");
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Resize stage to container
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = Math.max(400, window.innerHeight - 280);
        setStageSize({ width: w, height: h });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Load background image from PDF rendered as image
  useEffect(() => {
    if (!pdfUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImage(img);
    img.src = pdfUrl;
  }, [pdfUrl]);

  const genId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const addElement = useCallback((type: string) => {
    const cx = stageSize.width / 2 / scale;
    const cy = stageSize.height / 2 / scale;
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
    setActiveTool("select");
  }, [stageSize, scale]);

  const updateElement = useCallback((id: string, updates: Partial<PlanElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  };

  // Handle PDF upload
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("Format non supporté. Utilisez PDF ou image.");
      return;
    }
    setUploadingPdf(true);
    try {
      // For images, load directly
      if (file.type.includes("image")) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => setBgImage(img);
        img.src = url;
        setUploadingPdf(false);
        return;
      }
      // For PDF, render first page as image using pdfjs
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const arrayBuf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      const img = new window.Image();
      img.onload = () => setBgImage(img);
      img.src = dataUrl;

      // Also upload to storage
      const path = `${companyId}/${planId || genId()}.pdf`;
      await supabase.storage.from("voirie-plans").upload(path, file, { upsert: true });
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement du plan");
    } finally {
      setUploadingPdf(false);
    }
  };

  // Save plan
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

  // Generate legend from elements
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

  // AI pre-fill
  const handleAiFill = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-voirie-plan", {
        body: {
          address,
          visiteId,
          dossierId,
          companyId,
          existingElements: elements,
          hasBackgroundPlan: !!bgImage,
          stageWidth: stageSize.width,
          stageHeight: stageSize.height,
        },
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

  // Export as PNG
  const handleExportPng = () => {
    if (!stageRef.current) return;
    // Deselect before export
    setSelectedId(null);
    setTimeout(() => {
      const uri = stageRef.current!.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `plan-implantation-${title.replace(/\s+/g, "-")}.png`;
      link.href = uri;
      link.click();
      toast.success("Plan exporté en PNG");
    }, 100);
  };

  // Export as PDF (using jsPDF)
  const handleExportPdf = async () => {
    if (!stageRef.current) return;
    setSelectedId(null);
    setTimeout(async () => {
      const { default: jsPDF } = await import("jspdf");
      const uri = stageRef.current!.toDataURL({ pixelRatio: 2 });
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [stageSize.width, stageSize.height] });
      pdf.addImage(uri, "PNG", 0, 0, stageSize.width, stageSize.height);

      // Add legend
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

  // Render individual element on canvas
  const renderElement = (el: PlanElement) => {
    const isSelected = el.id === selectedId;
    const color = el.color || ELEMENT_COLORS[el.type] || "#333";

    const commonProps = {
      draggable: activeTool === "select",
      onClick: () => setSelectedId(el.id),
      onTap: () => setSelectedId(el.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        updateElement(el.id, { x: e.target.x(), y: e.target.y() });
      },
    };

    switch (el.type) {
      case "grue":
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            {/* Rotation radius */}
            <Circle radius={el.radius || 60} stroke={color} strokeWidth={1.5} dash={[6, 4]} opacity={0.5} fill={`${color}15`} />
            {/* Crane body */}
            <Circle radius={12} fill={color} stroke={isSelected ? "#fff" : color} strokeWidth={isSelected ? 3 : 1} />
            <Text text="🏗️" fontSize={16} offsetX={8} offsetY={8} />
            {/* Label */}
            <Text text={el.label || "Grue"} fontSize={11} fill={color} fontStyle="bold" offsetX={15} y={16} />
          </Group>
        );

      case "homme_traffic":
      case "pieton_deviation":
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            <Circle radius={14} fill={color} opacity={0.2} stroke={isSelected ? "#fff" : color} strokeWidth={isSelected ? 2 : 1} />
            <Text text={el.type === "homme_traffic" ? "🧑‍🦺" : "🚶"} fontSize={18} offsetX={9} offsetY={9} />
          </Group>
        );

      case "balisage_cone":
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            <Circle radius={8} fill={color} stroke={isSelected ? "#fff" : color} strokeWidth={isSelected ? 2 : 1} />
            <Text text="🔶" fontSize={12} offsetX={6} offsetY={6} />
          </Group>
        );

      case "balisage_barriere":
        return (
          <Group key={el.id} x={el.x} y={el.y} rotation={el.rotation || 0} {...commonProps}>
            <Rect width={50} height={8} fill={color} offsetX={25} offsetY={4} stroke={isSelected ? "#fff" : undefined} strokeWidth={isSelected ? 2 : 0} cornerRadius={2} />
            <Rect width={4} height={16} fill={color} x={-25} offsetY={8} />
            <Rect width={4} height={16} fill={color} x={21} offsetY={8} />
          </Group>
        );

      case "panneau_k8":
      case "panneau_travaux":
      case "panneau_deviation":
      case "panneau_rue_barree":
      case "totem":
        const iconMap: Record<string, string> = {
          panneau_k8: "⚠️", panneau_travaux: "🔨", panneau_deviation: "↪️",
          panneau_rue_barree: "⛔", totem: "🔻",
        };
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            <Rect width={28} height={28} fill="#fff" stroke={color} strokeWidth={2} offsetX={14} offsetY={14} cornerRadius={4} shadowColor="#000" shadowBlur={3} shadowOpacity={0.15} />
            {isSelected && <Rect width={32} height={32} stroke="#fff" strokeWidth={2} offsetX={16} offsetY={16} cornerRadius={5} />}
            <Text text={iconMap[el.type] || "?"} fontSize={16} offsetX={8} offsetY={8} />
            <Text text={ELEMENT_PALETTE.find((p) => p.type === el.type)?.label || ""} fontSize={9} fill={color} y={18} offsetX={15} width={50} align="center" />
          </Group>
        );

      case "zone_emprise":
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            <Rect
              width={el.width || 150}
              height={el.height || 80}
              fill={`${color}20`}
              stroke={color}
              strokeWidth={2}
              dash={[8, 4]}
              cornerRadius={4}
            />
            {isSelected && <Rect width={(el.width || 150) + 4} height={(el.height || 80) + 4} stroke="#fff" strokeWidth={2} x={-2} y={-2} cornerRadius={5} />}
            <Text text="Zone d'emprise" fontSize={10} fill={color} fontStyle="bold" x={4} y={4} />
          </Group>
        );

      case "fleche_deviation":
        return (
          <Group key={el.id} x={el.x} y={el.y} rotation={el.rotation || 0} {...commonProps}>
            <Arrow points={[0, 0, 60, 0]} stroke={color} strokeWidth={3} fill={color} pointerLength={10} pointerWidth={8} />
            {isSelected && <Circle radius={6} stroke="#fff" strokeWidth={2} />}
            <Text text="Déviation" fontSize={9} fill={color} y={8} />
          </Group>
        );

      case "custom_text":
        return (
          <Group key={el.id} x={el.x} y={el.y} {...commonProps}>
            {isSelected && <Rect width={100} height={20} stroke="#fff" strokeWidth={1} x={-2} y={-2} />}
            <Text text={el.text || "Texte"} fontSize={13} fill={color} fontStyle="bold" />
          </Group>
        );

      default:
        return null;
    }
  };

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

        {/* Tool buttons */}
        <Button variant={activeTool === "select" ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setActiveTool("select")} title="Sélectionner">
          <MousePointer className="h-3.5 w-3.5" />
        </Button>

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
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={scale}
            scaleY={scale}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer>
              {/* Background image (PDF rendered) */}
              {bgImage && (() => {
                const imgW = bgImage.naturalWidth || bgImage.width;
                const imgH = bgImage.naturalHeight || bgImage.height;
                const stageW = stageSize.width / scale;
                const stageH = stageSize.height / scale;
                const ratio = Math.min(stageW / imgW, stageH / imgH);
                const drawW = imgW * ratio;
                const drawH = imgH * ratio;
                const offsetX = (stageW - drawW) / 2;
                const offsetY = (stageH - drawH) / 2;
                return (
                  <KonvaImage
                    image={bgImage}
                    x={offsetX}
                    y={offsetY}
                    width={drawW}
                    height={drawH}
                    opacity={0.9}
                  />
                );
              })()}

              {/* Grid lines when no background */}
              {!bgImage && (
                <>
                  {Array.from({ length: Math.ceil(stageSize.width / scale / 50) }).map((_, i) => (
                    <Line key={`gv-${i}`} points={[i * 50, 0, i * 50, stageSize.height / scale]} stroke="#e5e5e5" strokeWidth={0.5} />
                  ))}
                  {Array.from({ length: Math.ceil(stageSize.height / scale / 50) }).map((_, i) => (
                    <Line key={`gh-${i}`} points={[0, i * 50, stageSize.width / scale, i * 50]} stroke="#e5e5e5" strokeWidth={0.5} />
                  ))}
                  <Text text="Chargez un plan PDF ou image de fond" fontSize={14} fill="#999" x={stageSize.width / scale / 2 - 130} y={stageSize.height / scale / 2} />
                </>
              )}

              {/* Elements */}
              {elements.map(renderElement)}
            </Layer>

            {/* Legend layer */}
            <Layer>
              {elements.length > 0 && (
                <Group x={10} y={stageSize.height / scale - 10 - generateLegend().length * 18 - 20}>
                  <Rect
                    width={160}
                    height={generateLegend().length * 18 + 25}
                    fill="rgba(255,255,255,0.92)"
                    stroke="#ccc"
                    strokeWidth={1}
                    cornerRadius={6}
                    shadowColor="#000"
                    shadowBlur={4}
                    shadowOpacity={0.1}
                  />
                  <Text text="LÉGENDE" fontSize={9} fontStyle="bold" fill="#666" x={8} y={6} />
                  {generateLegend().map((item, i) => (
                    <Group key={item.type} y={22 + i * 18} x={8}>
                      <Circle radius={4} fill={item.color} x={6} y={5} />
                      <Text text={`${item.icon} ${item.label} (×${item.count})`} fontSize={9} fill="#333" x={16} y={0} />
                    </Group>
                  ))}
                </Group>
              )}
            </Layer>
          </Stage>

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
                  <Input
                    value={selectedEl.label || ""}
                    onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })}
                    className="h-7 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Rayon de giration (px)</label>
                  <Input
                    type="number"
                    value={selectedEl.radius || 60}
                    onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })}
                    className="h-7 text-xs mt-0.5"
                  />
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
