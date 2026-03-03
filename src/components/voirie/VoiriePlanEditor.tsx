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
  { type: "grue", label: "Grue", category: "Engins" },
  { type: "balisage_cone", label: "Cône K5c", category: "Balisage" },
  { type: "balisage_barriere", label: "Barrière K2", category: "Balisage" },
  { type: "panneau_k8", label: "Panneau AK5", category: "Signalisation" },
  { type: "panneau_travaux", label: "Panneau AK4", category: "Signalisation" },
  { type: "panneau_deviation", label: "Panneau KD", category: "Signalisation" },
  { type: "panneau_rue_barree", label: "B1 Route barrée", category: "Signalisation" },
  { type: "totem", label: "B14 Lim. 30", category: "Signalisation" },
  { type: "homme_traffic", label: "Alternateur", category: "Personnel" },
  { type: "pieton_deviation", label: "Dév. piéton", category: "Personnel" },
  { type: "zone_emprise", label: "Zone emprise", category: "Zones" },
  { type: "fleche_deviation", label: "Flèche déviation", category: "Signalisation" },
  { type: "custom_text", label: "Annotation", category: "Autre" },
] as const;

// Professional CAD color scheme
const ELEMENT_COLORS: Record<string, string> = {
  grue: "#D4760A",
  balisage_cone: "#E25A1C",
  balisage_barriere: "#C41E3A",
  panneau_k8: "#FFB800",
  panneau_travaux: "#FFB800",
  panneau_deviation: "#0066B3",
  panneau_rue_barree: "#C41E3A",
  totem: "#C41E3A",
  homme_traffic: "#2E7D32",
  pieton_deviation: "#0066B3",
  zone_emprise: "#2E7D32",
  fleche_deviation: "#1A1A1A",
  custom_text: "#1A1A1A",
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

// ══════════════════════════════════════════════════════
// ── PROFESSIONAL CAD-QUALITY DRAWING FUNCTIONS ──
// ══════════════════════════════════════════════════════

/** Draw a top-down crane with circular giration radius (like MethoCAD / Liebherr Crane Planner) */
function drawCrane(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  const r = el.radius || 80;
  const color = el.color || ELEMENT_COLORS.grue;
  
  // ── Circular giration radius (dashed) ──
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 5]);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fill giration zone
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.04;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.restore();

  // ── Counter-jib (short side) ──
  const counterJibLen = r * 0.3;
  const jibW = 4;
  ctx.fillStyle = color;
  ctx.fillRect(-counterJibLen, -jibW / 2, counterJibLen, jibW);
  // Counter-weight block
  ctx.fillStyle = "#8B5E3C";
  ctx.fillRect(-counterJibLen - 6, -8, 12, 16);
  ctx.strokeStyle = "#5D3A1A";
  ctx.lineWidth = 1;
  ctx.strokeRect(-counterJibLen - 6, -8, 12, 16);

  // ── Main jib (long side) ──
  const jibLen = r * 0.85;
  ctx.fillStyle = color;
  // Tapered jib
  ctx.beginPath();
  ctx.moveTo(0, -jibW / 2);
  ctx.lineTo(jibLen, -2);
  ctx.lineTo(jibLen, 2);
  ctx.moveTo(0, jibW / 2);
  ctx.closePath();
  ctx.fill();
  // Lattice pattern on jib
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < jibLen; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -jibW / 2 + 1);
    ctx.lineTo(i + 5, jibW / 2 - 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── Tower/mast (center) ──
  const towerSize = 14;
  ctx.fillStyle = color;
  ctx.fillRect(-towerSize / 2, -towerSize / 2, towerSize, towerSize);
  ctx.strokeStyle = "#8B5E3C";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-towerSize / 2, -towerSize / 2, towerSize, towerSize);
  // Cross inside tower
  ctx.strokeStyle = "#8B5E3C";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-towerSize / 2, -towerSize / 2);
  ctx.lineTo(towerSize / 2, towerSize / 2);
  ctx.moveTo(towerSize / 2, -towerSize / 2);
  ctx.lineTo(-towerSize / 2, towerSize / 2);
  ctx.stroke();

  // ── Radius dimension line ──
  ctx.save();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(towerSize / 2 + 2, 0);
  ctx.lineTo(r - 2, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  // Arrow tips
  const arrS = 4;
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(r - 2, 0);
  ctx.lineTo(r - 2 - arrS, -arrS / 2);
  ctx.lineTo(r - 2 - arrS, arrS / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Reach label ──
  const reachMeters = el.label?.match(/(\d+)/)?.[1] || Math.round(r / 5);
  ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${reachMeters}m`, r / 2 + towerSize / 4, -4);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  // ── Crane name label ──
  ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "center";
  // White background for label
  const labelText = el.label || "Grue";
  const labelW = ctx.measureText(labelText).width + 8;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(-labelW / 2, -towerSize / 2 - 20, labelW, 15);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-labelW / 2, -towerSize / 2 - 20, labelW, 15);
  ctx.fillStyle = "#1A1A1A";
  ctx.fillText(labelText, 0, -towerSize / 2 - 8);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Draw alternateur / homme trafic — professional top-down view */
function drawHommeTraffic(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  const s = 16; // size
  // Green circle with white person icon
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(0, -3, 2, 0, 0, s);
  grad.addColorStop(0, "#43A047");
  grad.addColorStop(1, "#2E7D32");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#1B5E20";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Person silhouette (white)
  ctx.fillStyle = "#fff";
  // Head
  ctx.beginPath();
  ctx.arc(0, -5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(-6, 8);
  ctx.lineTo(-3, 8);
  ctx.lineTo(0, 2);
  ctx.lineTo(3, 8);
  ctx.lineTo(6, 8);
  ctx.lineTo(4, -1);
  ctx.closePath();
  ctx.fill();
  // Stop paddle (small red octagon on right)
  ctx.fillStyle = "#C41E3A";
  ctx.beginPath();
  ctx.arc(9, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 5px Arial";
  ctx.textAlign = "center";
  ctx.fillText("⬡", 9, 0);
  ctx.textAlign = "start";

  // Label
  ctx.font = "600 9px 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "center";
  const lbl = "Alternateur";
  const lblW = ctx.measureText(lbl).width + 6;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(-lblW / 2, s + 3, lblW, 12);
  ctx.fillStyle = "#2E7D32";
  ctx.fillText(lbl, 0, s + 12);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-s - 4, -s - 4, (s + 4) * 2, (s + 4) * 2 + 20);
  }
}

/** Draw a proper K5c traffic cone — technical top-view */
function drawCone(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  const s = 10;
  // Top-down view: orange square with white X
  ctx.fillStyle = "#E25A1C";
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeStyle = "#A03C10";
  ctx.lineWidth = 1;
  ctx.strokeRect(-s, -s, s * 2, s * 2);
  // White reflective stripes
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s + 2, -s + 2);
  ctx.lineTo(s - 2, s - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s - 2, -s + 2);
  ctx.lineTo(-s + 2, s - 2);
  ctx.stroke();
  // Center dot
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2);
  }
}

/** Draw K2 barricade — professional plan view */
function drawBarriere(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  const w = 50;
  const h = 6;
  // Hatched red/white bar
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  // White base
  ctx.fillStyle = "#fff";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Red diagonal stripes
  ctx.fillStyle = "#C41E3A";
  for (let i = -w; i < w * 2; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i - w / 2, -h / 2);
    ctx.lineTo(i - w / 2 + 5, -h / 2);
    ctx.lineTo(i - w / 2 + 5 + h, h / 2);
    ctx.lineTo(i - w / 2 + h, h / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Border
  ctx.strokeStyle = "#8B0000";
  ctx.lineWidth = 1;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // Support posts (small black squares)
  ctx.fillStyle = "#333";
  ctx.fillRect(-w / 2 - 2, h / 2, 4, 6);
  ctx.fillRect(w / 2 - 2, h / 2, 4, 6);

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 3, w + 8, h + 12);
  }
}

/** French regulatory road sign — professional rendering */
function drawPanneau(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean, type: string) {
  const postH = 20;
  const signR = 14;

  // Post
  ctx.fillStyle = "#666";
  ctx.fillRect(-1.5, signR, 3, postH);
  
  if (type === "panneau_k8" || type === "panneau_travaux") {
    // AK5 / AK4: Triangle with red border on white
    const ts = 16;
    ctx.beginPath();
    ctx.moveTo(0, -ts);
    ctx.lineTo(-ts * 0.87, ts * 0.5);
    ctx.lineTo(ts * 0.87, ts * 0.5);
    ctx.closePath();
    // White fill
    ctx.fillStyle = "#fff";
    ctx.fill();
    // Red border
    ctx.strokeStyle = "#C41E3A";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Inner symbol
    ctx.fillStyle = "#1A1A1A";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (type === "panneau_k8") {
      ctx.fillText("!", 0, 2);
    } else {
      // AK4 - worker icon
      ctx.fillText("⛏", 0, 2);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  } else if (type === "panneau_rue_barree") {
    // B1: Round red with white horizontal bar
    ctx.beginPath();
    ctx.arc(0, 0, signR, 0, Math.PI * 2);
    ctx.fillStyle = "#C41E3A";
    ctx.fill();
    // White border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    // White horizontal bar
    ctx.fillStyle = "#fff";
    ctx.fillRect(-signR + 3, -2.5, (signR - 3) * 2, 5);
    // Label
    ctx.font = "bold 7px 'Segoe UI', Arial";
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "center";
    ctx.fillText("ROUTE", 0, signR + postH + 10);
    ctx.fillText("BARRÉE", 0, signR + postH + 18);
    ctx.textAlign = "start";
  } else if (type === "panneau_deviation") {
    // KD: Blue rectangle with white arrow
    const sw = 20, sh = 16;
    ctx.fillStyle = "#0066B3";
    // Rounded corners
    const cr = 3;
    ctx.beginPath();
    ctx.moveTo(-sw / 2 + cr, -sh / 2);
    ctx.lineTo(sw / 2 - cr, -sh / 2);
    ctx.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + cr);
    ctx.lineTo(sw / 2, sh / 2 - cr);
    ctx.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - cr, sh / 2);
    ctx.lineTo(-sw / 2 + cr, sh / 2);
    ctx.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - cr);
    ctx.lineTo(-sw / 2, -sh / 2 + cr);
    ctx.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + cr, -sh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // White arrow
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.lineTo(2, -5);
    ctx.lineTo(8, -5);
    ctx.lineTo(8, -8);
    ctx.lineTo(12, -2);
    ctx.lineTo(8, 4);
    ctx.lineTo(8, 1);
    ctx.lineTo(2, 1);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();
    // Label
    ctx.font = "600 7px 'Segoe UI', Arial";
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "center";
    ctx.fillText("DÉVIATION", 0, signR + postH + 10);
    ctx.textAlign = "start";
  } else if (type === "totem") {
    // B14: Speed limit 30 — round white with red border
    ctx.beginPath();
    ctx.arc(0, 0, signR, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#C41E3A";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#1A1A1A";
    ctx.font = "bold 14px 'Segoe UI', Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("30", 0, 0);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(-signR - 3, -signR - 5, (signR + 3) * 2, signR * 2 + postH + 10);
    ctx.setLineDash([]);
  }
}

/** Zone emprise with professional cross-hatching */
function drawZoneEmprise(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  const w = el.width || 150;
  const h = el.height || 80;
  const color = el.color || ELEMENT_COLORS.zone_emprise;

  // Fill with light green + hatching
  ctx.fillStyle = color + "12";
  ctx.fillRect(0, 0, w, h);

  // Cross-hatch pattern
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.25;
  const gap = 12;
  for (let i = -h; i < w + h; i += gap) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.lineTo(i + h, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 4]);
  ctx.strokeRect(0, 0, w, h);
  ctx.setLineDash([]);

  // Label with background
  const labelText = "ZONE D'EMPRISE";
  ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
  const lw = ctx.measureText(labelText).width + 8;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(4, 4, lw, 14);
  ctx.fillStyle = color;
  ctx.fillText(labelText, 8, 14);

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(-3, -3, w + 6, h + 6);
    ctx.setLineDash([]);
  }
}

/** Professional deviation arrow with dimension */
function drawFlecheDeviation(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  const len = 60;
  const bodyH = 8;

  // Arrow body with gradient
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, "#333");
  grad.addColorStop(1, "#1A1A1A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, -bodyH / 2, len - 14, bodyH);

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(len - 14, -bodyH - 2);
  ctx.lineTo(len, 0);
  ctx.lineTo(len - 14, bodyH + 2);
  ctx.closePath();
  ctx.fill();

  // Dimension text above
  ctx.font = "600 9px 'Segoe UI', Arial";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "center";
  ctx.fillText("→ Déviation", len / 2, -bodyH - 4);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-3, -bodyH - 12, len + 6, bodyH * 2 + 20);
  }
}

/** Pedestrian deviation — blue mandatory sign */
function drawPietonDeviation(ctx: CanvasRenderingContext2D, _el: PlanElement, isSelected: boolean) {
  const r = 14;
  // Blue circle
  const grad = ctx.createRadialGradient(0, -2, 2, 0, 0, r);
  grad.addColorStop(0, "#1976D2");
  grad.addColorStop(1, "#0D47A1");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pedestrian silhouette (white)
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.8;
  // Head
  ctx.beginPath();
  ctx.arc(1, -6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.beginPath();
  ctx.moveTo(1, -3.5);
  ctx.lineTo(1, 3);
  ctx.stroke();
  // Arms
  ctx.beginPath();
  ctx.moveTo(-3, -1);
  ctx.lineTo(5, 0);
  ctx.stroke();
  // Legs (walking)
  ctx.beginPath();
  ctx.moveTo(1, 3);
  ctx.lineTo(-2, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 3);
  ctx.lineTo(4, 8);
  ctx.stroke();

  // Arrow below
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(6, -7);
  ctx.lineTo(10, -4);
  ctx.lineTo(6, -1);
  ctx.closePath();
  ctx.fill();

  // Label
  ctx.font = "600 8px 'Segoe UI', Arial";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "center";
  const lbl = "Piétons";
  const lblW = ctx.measureText(lbl).width + 6;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(-lblW / 2, r + 3, lblW, 12);
  ctx.fillStyle = "#0D47A1";
  ctx.fillText(lbl, 0, r + 12);
  ctx.textAlign = "start";

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2 + 18);
  }
}

/** Custom text annotation with leader line style */
function drawCustomText(ctx: CanvasRenderingContext2D, el: PlanElement, isSelected: boolean) {
  const text = el.text || "Annotation";
  ctx.font = "600 12px 'Segoe UI', Arial, sans-serif";
  const m = ctx.measureText(text);
  const pad = 5;
  // Background
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = el.color || "#1A1A1A";
  ctx.lineWidth = 1;
  ctx.fillRect(-pad, -14, m.width + pad * 2, 18);
  ctx.strokeRect(-pad, -14, m.width + pad * 2, 18);
  // Text
  ctx.fillStyle = el.color || "#1A1A1A";
  ctx.fillText(text, 0, 0);

  if (isSelected) {
    ctx.strokeStyle = "#1565C0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-pad - 3, -17, m.width + pad * 2 + 6, 24);
  }
}

// Palette preview — small icon renderings for the sidebar
function drawPaletteIcon(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 2;

  switch (type) {
    case "grue": {
      ctx.strokeStyle = ELEMENT_COLORS.grue;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, s - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ELEMENT_COLORS.grue;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillRect(3, -1, s - 6, 2);
      break;
    }
    case "balisage_cone": {
      ctx.fillStyle = ELEMENT_COLORS.balisage_cone;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-s / 2 + 1, -s / 2 + 1);
      ctx.lineTo(s / 2 - 1, s / 2 - 1);
      ctx.stroke();
      break;
    }
    case "balisage_barriere": {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-s + 2, -2, (s - 2) * 2, 4);
      ctx.fillStyle = ELEMENT_COLORS.balisage_barriere;
      for (let i = -s + 2; i < s; i += 6) {
        ctx.fillRect(i, -2, 3, 4);
      }
      break;
    }
    case "homme_traffic": {
      ctx.beginPath();
      ctx.arc(0, 0, s - 2, 0, Math.PI * 2);
      ctx.fillStyle = ELEMENT_COLORS.homme_traffic;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-1.5, 0, 3, 4);
      break;
    }
    case "zone_emprise": {
      ctx.strokeStyle = ELEMENT_COLORS.zone_emprise;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(-s + 2, -s / 2 + 2, (s - 2) * 2, s - 4);
      ctx.setLineDash([]);
      break;
    }
    default: {
      // Sign types
      const color = ELEMENT_COLORS[type] || "#666";
      if (type === "totem" || type === "panneau_rue_barree") {
        ctx.beginPath();
        ctx.arc(0, 0, s - 3, 0, Math.PI * 2);
        ctx.fillStyle = type === "totem" ? "#fff" : color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (type === "totem") {
          ctx.fillStyle = "#1A1A1A";
          ctx.font = `bold ${s - 3}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("30", 0, 0);
          ctx.textAlign = "start";
          ctx.textBaseline = "alphabetic";
        }
      } else if (type.includes("k8") || type.includes("travaux")) {
        ctx.beginPath();
        ctx.moveTo(0, -s + 2);
        ctx.lineTo(-s + 3, s - 3);
        ctx.lineTo(s - 3, s - 3);
        ctx.closePath();
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        const bw = (s - 2) * 1.4, bh = (s - 2);
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      }
      break;
    }
  }
  ctx.restore();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const pixelRatio = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(planId || null);
  const [uploadedPlanPath, setUploadedPlanPath] = useState<string | null>(null);
  const [didAutoFrameLoaded, setDidAutoFrameLoaded] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  const renderPdfToBackground = useCallback(async (fileUrl: string) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const arrayBuf = await fetch(fileUrl).then((r) => r.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");

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
  }, []);

  // ── Load existing plan from DB on mount ──
  useEffect(() => {
    if (planId || (!visiteId && !dossierId)) return;
    const loadExistingPlan = async () => {
      try {
        let query = supabase
          .from("voirie_plans")
          .select("id, title, elements, legend, status, plan_pdf_path, plan_image_url")
          .eq("company_id", companyId);
        if (visiteId) query = query.eq("visite_id", visiteId);
        else if (dossierId) query = query.eq("dossier_id", dossierId);

        const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error || !data) return;

        setLoadedPlanId(data.id);
        setLoadedFromDb(true);
        if (data.title) setTitle(data.title);
        if (data.elements && Array.isArray(data.elements) && data.elements.length > 0) {
          setElements(data.elements as unknown as PlanElement[]);
          setDidAutoFrameLoaded(false);
        }

        const savedPath = data.plan_pdf_path || data.plan_image_url;
        if (!savedPath) return;
        setUploadedPlanPath(savedPath);

        const resolvedUrl = savedPath.startsWith("http")
          ? savedPath
          : (await supabase.storage.from("voirie-plans").createSignedUrl(savedPath, 3600)).data?.signedUrl;

        if (!resolvedUrl) return;

        if (savedPath.toLowerCase().endsWith(".pdf")) {
          await renderPdfToBackground(resolvedUrl);
        } else {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            setBgImage(img);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = img.naturalWidth || img.width;
            tempCanvas.height = img.naturalHeight || img.height;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              tempCtx.drawImage(img, 0, 0);
              bgDataUrlRef.current = tempCanvas.toDataURL("image/jpeg", 0.7);
            }
          };
          img.src = resolvedUrl;
        }
      } catch (err) {
        console.error("Error loading existing plan:", err);
      }
    };
    loadExistingPlan();
  }, [planId, visiteId, dossierId, companyId, renderPdfToBackground]);

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

  // Fit + recentrage automatique des éléments chargés depuis la base (mobile + desktop)
  useEffect(() => {
    if (!loadedFromDb || didAutoFrameLoaded || elements.length === 0 || bgImage) return;

    const minX = Math.min(...elements.map((el) => el.x));
    const maxX = Math.max(...elements.map((el) => el.x));
    const minY = Math.min(...elements.map((el) => el.y));
    const maxY = Math.max(...elements.map((el) => el.y));

    const boxWidth = Math.max(1, maxX - minX);
    const boxHeight = Math.max(1, maxY - minY);

    // 1) Ajuster le zoom pour rendre tout le plan visible (surtout sur mobile)
    const fitScale = Math.max(
      0.3,
      Math.min(
        1,
        (canvasSize.width * 0.85) / boxWidth,
        (canvasSize.height * 0.85) / boxHeight,
      ),
    );

    if (Math.abs(fitScale - scale) > 0.01) {
      setScale(fitScale);
    }

    // 2) Recentrer la boîte englobante avec l'échelle cible
    const stageWidth = Math.max(1, canvasSize.width / Math.max(fitScale, 0.01));
    const stageHeight = Math.max(1, canvasSize.height / Math.max(fitScale, 0.01));
    const boxCenterX = (minX + maxX) / 2;
    const boxCenterY = (minY + maxY) / 2;

    const offsetX = stageWidth / 2 - boxCenterX;
    const offsetY = stageHeight / 2 - boxCenterY;

    setElements((prev) => prev.map((el) => ({ ...el, x: el.x + offsetX, y: el.y + offsetY })));
    setDidAutoFrameLoaded(true);
  }, [loadedFromDb, didAutoFrameLoaded, elements, bgImage, canvasSize.width, canvasSize.height, scale]);

  // Load background image
  useEffect(() => {
    if (!pdfUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImage(img);
    img.src = pdfUrl;
  }, [pdfUrl]);

  const getPlanRect = useCallback(() => {
    const sw = canvasSize.width / scale;
    const sh = canvasSize.height / scale;

    if (!bgImage) {
      return { x: 0, y: 0, width: sw, height: sh, stageWidth: sw, stageHeight: sh };
    }

    const imgW = bgImage.naturalWidth || bgImage.width;
    const imgH = bgImage.naturalHeight || bgImage.height;
    const ratio = Math.min(sw / imgW, sh / imgH);
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    const drawX = (sw - drawW) / 2;
    const drawY = (sh - drawH) / 2;

    return { x: drawX, y: drawY, width: drawW, height: drawH, stageWidth: sw, stageHeight: sh };
  }, [bgImage, canvasSize, scale]);


  // ── Draw everything on canvas ──
  const draw = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, 0, 0);
      ctx.save();

      const { stageWidth: sw, stageHeight: sh, x: planX, y: planY, width: planW, height: planH } = getPlanRect();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Background image (aspect-ratio preserved)
      if (bgImage) {
        ctx.drawImage(bgImage, planX, planY, planW, planH);
      } else {
        // Grille technique uniquement (le message d'état vide est géré en overlay React pour éviter toute superposition)
        ctx.strokeStyle = "#E0E0E0";
        ctx.lineWidth = 0.3;
        for (let x = 0; x < sw; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, sh);
          ctx.stroke();
        }
        for (let y = 0; y < sh; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(sw, y);
          ctx.stroke();
        }

        // Sous-grille
        ctx.strokeStyle = "#F0F0F0";
        ctx.lineWidth = 0.15;
        for (let x = 0; x < sw; x += 10) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, sh);
          ctx.stroke();
        }
        for (let y = 0; y < sh; y += 10) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(sw, y);
          ctx.stroke();
        }
      }

      // Draw elements
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

      // ── Professional Legend ──
      if (elements.length > 0) {
        const types = [...new Set(elements.map((e) => e.type))];
        const legendItems = types.map((t) => ({
          type: t,
          label: ELEMENT_PALETTE.find((p) => p.type === t)?.label || t,
          count: elements.filter((e) => e.type === t).length,
          color: ELEMENT_COLORS[t] || "#333",
        }));
        const lx = 8;
        const itemH = 22;
        const legendH = legendItems.length * itemH + 30;
        const legendW = 180;
        const ly = sh - 8 - legendH;

        // Background with shadow
        ctx.shadowColor = "rgba(0,0,0,0.08)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.fillRect(lx, ly, legendW, legendH);
        ctx.shadowColor = "transparent";

        ctx.strokeStyle = "#BDBDBD";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(lx, ly, legendW, legendH);

        // Header
        ctx.font = "bold 9px 'Segoe UI', Arial, sans-serif";
        ctx.fillStyle = "#616161";
        ctx.fillText("LÉGENDE", lx + 8, ly + 14);
        ctx.strokeStyle = "#E0E0E0";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(lx + 4, ly + 20);
        ctx.lineTo(lx + legendW - 4, ly + 20);
        ctx.stroke();

        legendItems.forEach((item, i) => {
          const iy = ly + 26 + i * itemH;
          // Color swatch
          ctx.fillStyle = item.color;
          ctx.fillRect(lx + 8, iy, 12, 12);
          ctx.strokeStyle = "#999";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(lx + 8, iy, 12, 12);
          // Label
          ctx.font = "10px 'Segoe UI', Arial, sans-serif";
          ctx.fillStyle = "#333";
          ctx.fillText(`${item.label} (×${item.count})`, lx + 26, iy + 10);
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
  }, [elements, selectedId, getPlanRect, pixelRatio, scale]);

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
      label: type === "grue" ? "Grue GME" : undefined,
      radius: type === "grue" ? 80 : undefined,
      width: type === "zone_emprise" ? 200 : undefined,
      height: type === "zone_emprise" ? 100 : undefined,
      text: type === "custom_text" ? "Annotation" : undefined,
      color: ELEMENT_COLORS[type] || "#1A1A1A",
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

  // ── PDF/image upload (high quality) ──
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      toast.error("Format non supporté. Utilisez PDF ou image.");
      return;
    }

    setUploadingPdf(true);
    try {
      const existingId = planId || loadedPlanId;
      const fallbackKey = visiteId ? `visite-${visiteId}` : dossierId ? `dossier-${dossierId}` : genId();
      const ext = file.type.includes("pdf") ? "pdf" : (file.name.split(".").pop() || "png");
      const path = `${companyId}/${existingId || fallbackKey}.${ext}`;

      if (file.type.includes("image")) {
        const url = URL.createObjectURL(file);
        await new Promise<void>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => {
            setBgImage(img);
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = img.naturalWidth || img.width;
            tempCanvas.height = img.naturalHeight || img.height;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              tempCtx.drawImage(img, 0, 0);
              bgDataUrlRef.current = tempCanvas.toDataURL("image/jpeg", 0.7);
            }
            resolve();
          };
          img.onerror = () => reject(new Error("Impossible de charger l'image"));
          img.src = url;
        });
        URL.revokeObjectURL(url);
      } else {
        const pdfObjectUrl = URL.createObjectURL(file);
        await renderPdfToBackground(pdfObjectUrl);
        URL.revokeObjectURL(pdfObjectUrl);
      }

      const { error: uploadError } = await supabase.storage.from("voirie-plans").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      setUploadedPlanPath(path);
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
        type, label: palette?.label || type,
        count: elements.filter((el) => el.type === type).length,
        color: ELEMENT_COLORS[type] || "#333",
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isPdfPath = uploadedPlanPath?.toLowerCase().endsWith(".pdf") ?? false;
      const payload = {
        company_id: companyId, visite_id: visiteId || null,
        dossier_id: dossierId || null, title, address: address || null,
        elements: elements as any, legend: generateLegend() as any, status: "brouillon",
        plan_pdf_path: isPdfPath ? uploadedPlanPath : null,
        plan_image_url: !isPdfPath ? uploadedPlanPath : null,
      };
      const existingId = planId || loadedPlanId;
      if (existingId) {
        const { error } = await supabase.from("voirie_plans").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("voirie_plans").insert(payload as any).select("id").single();
        if (error) throw error;
        if (inserted) setLoadedPlanId(inserted.id);
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
      const planRect = getPlanRect();
      const body: any = {
        address, visiteId, dossierId, companyId,
        existingElements: elements, hasBackgroundPlan: !!bgImage,
        stageWidth: planRect.stageWidth,
        stageHeight: planRect.stageHeight,
        planRect: {
          x: planRect.x,
          y: planRect.y,
          width: planRect.width,
          height: planRect.height,
        },
      };
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
        pdf.text("Légende du plan d'implantation", 30, 40);
        pdf.setFontSize(12);
        legend.forEach((item, i) => {
          pdf.setFillColor(item.color);
          pdf.circle(40, 70 + i * 25, 6, "F");
          pdf.text(`${item.label} (×${item.count})`, 55, 74 + i * 25);
        });
      }
      pdf.save(`plan-implantation-${title.replace(/\s+/g, "-")}.pdf`);
      toast.success("Plan exporté en PDF");
    }, 100);
  };

  const selectedEl = elements.find((el) => el.id === selectedId);

  // Group palette by category
  const categories = [...new Set(ELEMENT_PALETTE.map(p => p.category))];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-card flex-wrap">
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-sm w-48 max-w-[200px] font-medium" placeholder="Titre du plan" />
        <div className="h-6 w-px bg-border" />

        {/* Upload PDF */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={uploadingPdf}
          onClick={() => {
            // Use setTimeout to escape dialog event handling
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 0);
          }}>
          {uploadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          {bgImage ? "Changer le plan" : "Charger un plan"}
        </Button>
        <input ref={fileInputRef} type="file" accept=".pdf,image/*"
          style={{ position: "absolute", top: -9999, left: -9999, opacity: 0 }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePdfUpload(f);
            e.target.value = "";
          }} />

        <div className="h-6 w-px bg-border" />

        {/* Zoom */}
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setScale((s) => Math.min(3, s + 0.2))} title="Zoom +">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setScale((s) => Math.max(0.3, s - 0.2))} title="Zoom -">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* AI fill */}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleAiFill} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          IA auto-plan
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
        {/* Left palette — grouped by category with visual previews */}
        <div className={`border-r bg-card overflow-y-auto ${isMobile ? "w-14" : "w-48"} shrink-0`}>
          <div className="p-1.5 space-y-0.5">
            {categories.map((cat) => (
              <div key={cat}>
                {!isMobile && (
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">{cat}</p>
                )}
                {ELEMENT_PALETTE.filter(p => p.category === cat).map((item) => (
                  <button key={item.type} onClick={() => addElement(item.type)}
                    className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent/60 transition-colors text-left group"
                    title={item.label}>
                    {/* Mini canvas preview */}
                    <canvas
                      ref={(cvs) => {
                        if (!cvs) return;
                        const c = cvs.getContext("2d");
                        if (!c) return;
                        const sz = isMobile ? 24 : 28;
                        cvs.width = sz * 2;
                        cvs.height = sz * 2;
                        cvs.style.width = `${sz}px`;
                        cvs.style.height = `${sz}px`;
                        c.clearRect(0, 0, sz * 2, sz * 2);
                        c.scale(2, 2);
                        drawPaletteIcon(c, item.type, sz / 2, sz / 2, sz - 4);
                      }}
                      className="shrink-0 rounded"
                      style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28 }}
                    />
                    {!isMobile && (
                      <span className="truncate text-[11px] font-medium text-foreground/80 group-hover:text-foreground">{item.label}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-muted/30 relative" ref={containerRef}>
          <canvas ref={canvasRef} width={Math.round(canvasSize.width * pixelRatio)} height={Math.round(canvasSize.height * pixelRatio)}
            className={bgImage ? "cursor-crosshair" : "cursor-default"}
            style={{ width: canvasSize.width, height: canvasSize.height, touchAction: "none" }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp} />

          {!bgImage && elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-center text-muted-foreground space-y-2 max-w-xs rounded-lg p-2 transition-colors hover:bg-muted/60"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium leading-tight">Chargez un plan de voirie</p>
                <p className="text-xs leading-relaxed">PDF ou image (plan cadastral, plan de masse…)</p>
              </button>
            </div>
          )}
        </div>

        {/* Right panel — selected element properties */}
        {selectedEl && !isMobile && (
          <div className="w-56 border-l bg-card p-3 space-y-3 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">Propriétés</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div>
              <Badge variant="secondary" className="text-[10px]">
                {ELEMENT_PALETTE.find((p) => p.type === selectedEl.type)?.label || selectedEl.type}
              </Badge>
            </div>
            {selectedEl.type === "grue" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Nom de la grue</label>
                  <Input value={selectedEl.label || ""} onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Rayon de giration (px)</label>
                  <Input type="number" value={selectedEl.radius || 80} onChange={(e) => updateElement(selectedEl.id, { radius: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}
            {selectedEl.type === "zone_emprise" && (
              <>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Largeur (px)</label>
                  <Input type="number" value={selectedEl.width || 200} onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Hauteur (px)</label>
                  <Input type="number" value={selectedEl.height || 100} onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
                </div>
              </>
            )}
            {selectedEl.type === "custom_text" && (
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Texte</label>
                <Input value={selectedEl.text || ""} onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })} className="h-7 text-xs mt-0.5" />
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Rotation (°)</label>
              <Input type="number" value={selectedEl.rotation || 0} onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })} className="h-7 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Position</label>
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
