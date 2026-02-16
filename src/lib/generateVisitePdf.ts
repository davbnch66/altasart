import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { loadCompanyLogo, LogoResult } from "./pdfLogoHelper";

const brandR = 200, brandG = 80, brandB = 30;

function drawLogo(doc: jsPDF, logo: LogoResult | null, company: any, marginL: number) {
  if (logo) {
    const maxW = 50, maxH = 22;
    const ratio = logo.width / logo.height;
    let imgW = maxW, imgH = imgW / ratio;
    if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
    doc.addImage(logo.dataUrl, "PNG", marginL, 8, imgW, imgH);
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(company?.short_name || company?.name || "", marginL, 22);
  }
}

function drawFooter(doc: jsPDF, company: any, pageW: number, marginL: number, marginR: number) {
  const footerY = 280;
  doc.setDrawColor(brandR, brandG, brandB);
  doc.setLineWidth(0.5);
  doc.line(marginL, footerY, pageW - marginR, footerY);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const parts: string[] = [];
  if (company?.address) parts.push(`Siege social : ${company.address}`);
  if (company?.phone) parts[parts.length - 1] = (parts[parts.length - 1] || "") + ` - Tel. ${company.phone}`;
  if (company?.email) parts.push(company.email);
  if (company?.siret) parts.push(`SIRET ${company.siret}`);
  let fy = footerY + 3;
  for (const line of parts) {
    doc.text(line, pageW / 2, fy, { align: "center" });
    fy += 3;
  }
}

function checkPage(doc: jsPDF, y: number, needed: number, logo: LogoResult | null, company: any, pageW: number, marginL: number, marginR: number): number {
  if (y + needed > 270) {
    drawFooter(doc, company, pageW, marginL, marginR);
    doc.addPage();
    drawLogo(doc, logo, company, marginL);
    return 35;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number, marginL: number, contentW: number, pageW: number): number {
  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 8, 1, 1, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageW / 2, y + 5.5, { align: "center" });
  return y + 12;
}

function subTitle(doc: jsPDF, title: string, y: number, marginL: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(title, marginL, y);
  return y + 5;
}

const vehiculeLabels: Record<string, string> = {
  utilitaire: "Utilitaire", camion: "Camion", semi: "Semi-remorque",
  grue_mobile: "Grue mobile", bras_de_grue: "Bras de grue", nacelle: "Nacelle",
  chariot: "Chariot", palan: "Palan", autre: "Autre",
};

export async function generateVisitePdf(visiteId: string) {
  // Fetch all data in parallel
  const [visiteRes, piecesRes, materielRes, affectationsRes, rhRes, vehiculesRes, contraintesRes, methodoRes, photosRes] = await Promise.all([
    supabase.from("visites").select("*, clients(name, code, address, city, postal_code, email, phone, mobile, contact_name), companies(name, short_name, address, phone, email, siret)").eq("id", visiteId).single(),
    supabase.from("visite_pieces").select("*").eq("visite_id", visiteId).order("sort_order"),
    supabase.from("visite_materiel").select("*").eq("visite_id", visiteId).order("sort_order"),
    supabase.from("visite_materiel_affectations").select("*, visite_materiel(designation), visite_pieces(name)").eq("company_id", (await supabase.from("visites").select("company_id").eq("id", visiteId).single()).data?.company_id || ""),
    supabase.from("visite_ressources_humaines").select("*").eq("visite_id", visiteId).order("sort_order"),
    supabase.from("visite_vehicules").select("*").eq("visite_id", visiteId).order("sort_order"),
    supabase.from("visite_contraintes").select("*").eq("visite_id", visiteId).maybeSingle(),
    supabase.from("visite_methodologie").select("*").eq("visite_id", visiteId).order("sort_order"),
    supabase.from("visite_photos").select("*").eq("visite_id", visiteId),
  ]);

  const visite = visiteRes.data;
  if (!visite) throw new Error("Visite introuvable");

  const client = visite.clients as any;
  const company = visite.companies as any;
  const pieces = piecesRes.data || [];
  const materiel = materielRes.data || [];
  const affectations = (affectationsRes.data || []).filter((a: any) => materiel.some((m: any) => m.id === a.materiel_id));
  const rh = rhRes.data || [];
  const vehicules = vehiculesRes.data || [];
  const contraintes = contraintesRes.data;
  const methodologie = methodoRes.data || [];
  const photos = photosRes.data || [];

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210, marginL = 15, marginR = 15;
  const contentW = pageW - marginL - marginR;
  const colR = marginL + contentW;

  const logo = await loadCompanyLogo(company?.short_name || "");

  // ===== PAGE 1 HEADER =====
  drawLogo(doc, logo, company, marginL);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Transport - Grutage - Portage - Levage - Manutention lourde", marginL, 33);

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Paris, le ${format(new Date(), "dd/MM/yyyy")}`, colR, 16, { align: "right" });

  // ===== TITLE BAR =====
  let y = 40;
  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 10, 1, 1, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`RAPPORT DE VISITE TECHNIQUE${visite.code ? ` N° ${visite.code}` : ""}`, pageW / 2, y + 7, { align: "center" });

  // ===== CLIENT INFO =====
  y = 56;
  const clientBoxX = pageW / 2 + 5;
  const clientBoxW = colR - clientBoxX;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(clientBoxX, y, clientBoxW, 30, 1.5, 1.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(client?.name || "---", clientBoxX + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let cy = y + 11;
  if (client?.code) { doc.text(`Code : ${client.code}`, clientBoxX + 4, cy); cy += 4; }
  if (client?.address) { doc.text(client.address, clientBoxX + 4, cy); cy += 4; }
  if (client?.postal_code || client?.city) { doc.text(`${client?.postal_code || ""} ${client?.city || ""}`.trim(), clientBoxX + 4, cy); cy += 4; }
  if (client?.contact_name) { doc.setFont("helvetica", "italic"); doc.text(`Att. : ${client.contact_name}`, clientBoxX + 4, cy); }

  // Company info left
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let ly = y + 6;
  if (company?.name) { doc.text(company.name, marginL, ly); ly += 4; }
  if (company?.address) { doc.text(company.address, marginL, ly); ly += 4; }
  if (company?.phone) { doc.text(`Tel : ${company.phone}`, marginL, ly); ly += 4; }

  // ===== VISIT INFO =====
  y = 92;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const infoItems: string[] = [];
  if (visite.title) infoItems.push(`Objet : ${visite.title}`);
  if (visite.scheduled_date) infoItems.push(`Date : ${format(new Date(visite.scheduled_date), "dd/MM/yyyy")}`);
  if (visite.address) infoItems.push(`Adresse : ${visite.address}`);
  if (visite.visit_type) infoItems.push(`Type : ${visite.visit_type}`);
  if (visite.advisor) infoItems.push(`Conseiller : ${visite.advisor}`);
  if (visite.volume) infoItems.push(`Volume : ${visite.volume} m3`);
  if (visite.distance) infoItems.push(`Distance : ${visite.distance} km`);

  for (const info of infoItems) {
    doc.text(info, marginL, y);
    y += 4;
  }
  y += 4;

  // ===== SECTION: INSTRUCTIONS =====
  if (visite.instructions) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "INSTRUCTIONS", y, marginL, contentW, pageW);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    const instrLines = doc.splitTextToSize(visite.instructions, contentW - 6);
    for (const line of instrLines) {
      y = checkPage(doc, y, 4, logo, company, pageW, marginL, marginR);
      doc.text(line, marginL + 3, y);
      y += 3.8;
    }
    y += 4;
  }

  // ===== SECTION: MATERIEL GLOBAL =====
  if (materiel.length > 0) {
    y = checkPage(doc, y, 30, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "INVENTAIRE MATERIEL", y, marginL, contentW, pageW);

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Designation", marginL + 3, y + 5);
    doc.text("Qte", marginL + contentW * 0.55, y + 5, { align: "center" });
    doc.text("Dimensions", marginL + contentW * 0.7, y + 5);
    doc.text("Poids", colR - 3, y + 5, { align: "right" });
    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    let totalWeight = 0;

    for (let i = 0; i < materiel.length; i++) {
      y = checkPage(doc, y, 6, logo, company, pageW, marginL, marginR);
      const m = materiel[i] as any;
      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginL, y - 1, contentW, 6, "F");
      }
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8);
      doc.text(m.designation, marginL + 3, y + 3);
      doc.text(String(m.quantity), marginL + contentW * 0.55, y + 3, { align: "center" });
      doc.text(m.dimensions || "—", marginL + contentW * 0.7, y + 3);
      doc.text(m.weight ? `${m.weight} kg` : "—", colR - 3, y + 3, { align: "right" });
      if (m.weight) totalWeight += m.weight * m.quantity;
      y += 6;
    }

    // Total weight
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(`Poids total estime : ${totalWeight} kg`, colR - 3, y + 3, { align: "right" });
    y += 8;
  }

  // ===== SECTION: MATERIEL PAR PIECE =====
  if (pieces.length > 0 && affectations.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "MATERIEL PAR PIECE / ZONE", y, marginL, contentW, pageW);

    for (const piece of pieces) {
      const pieceAff = affectations.filter((a: any) => a.piece_id === (piece as any).id);
      if (pieceAff.length === 0) continue;

      y = checkPage(doc, y, 12, logo, company, pageW, marginL, marginR);
      y = subTitle(doc, `${(piece as any).name}${(piece as any).floor_level ? ` (${(piece as any).floor_level})` : ""}`, y, marginL);

      for (const aff of pieceAff) {
        y = checkPage(doc, y, 5, logo, company, pageW, marginL, marginR);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        doc.text(`  - ${(aff as any).visite_materiel?.designation || "—"} x ${aff.quantity}`, marginL + 4, y);
        y += 4;
      }
      y += 3;
    }

    // Unassigned material
    const assignedQty = (mid: string) => affectations.filter((a: any) => a.materiel_id === mid).reduce((s: number, a: any) => s + a.quantity, 0);
    const unassigned = materiel.filter((m: any) => assignedQty(m.id) < m.quantity);
    if (unassigned.length > 0) {
      y = checkPage(doc, y, 10, logo, company, pageW, marginL, marginR);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(200, 50, 50);
      doc.text("Materiel non entierement affecte :", marginL, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      for (const m of unassigned) {
        doc.text(`  - ${(m as any).designation} (${assignedQty((m as any).id)}/${(m as any).quantity})`, marginL + 4, y);
        y += 4;
      }
      y += 3;
    }
  }

  // ===== SECTION: PHOTOS =====
  if (photos.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, `PHOTOS (${photos.length})`, y, marginL, contentW, pageW);

    // Load and embed photos (max 6 per page, 2 columns)
    const photosByPiece: Record<string, any[]> = { "": [] };
    for (const p of pieces) { photosByPiece[(p as any).id] = []; }
    for (const ph of photos) {
      const key = (ph as any).piece_id || "";
      if (!photosByPiece[key]) photosByPiece[key] = [];
      photosByPiece[key].push(ph);
    }

    for (const [pieceId, piecePhotos] of Object.entries(photosByPiece)) {
      if (piecePhotos.length === 0) continue;
      const pieceName = pieceId ? (pieces.find((p: any) => p.id === pieceId) as any)?.name || "Zone" : "Sans piece";

      y = checkPage(doc, y, 15, logo, company, pageW, marginL, marginR);
      y = subTitle(doc, pieceName, y, marginL);

      // Try to load and add photos
      for (let i = 0; i < piecePhotos.length; i++) {
        y = checkPage(doc, y, 50, logo, company, pageW, marginL, marginR);
        const ph = piecePhotos[i];
        try {
          const { data: urlData } = supabase.storage.from("visite-photos").getPublicUrl(ph.storage_path);
          if (urlData?.publicUrl) {
            const fetchUrl = `${urlData.publicUrl}?t=${Date.now()}`;
            const imgResp = await fetch(fetchUrl);
            if (imgResp.ok) {
              const blob = await imgResp.blob();
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });

              // Calculate real aspect ratio to avoid deformation
              const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
              });

              const col = i % 2;
              const imgX = marginL + col * (contentW / 2 + 2);
              const imgW = contentW / 2 - 4;
              // Compute height from real aspect ratio
              const aspectRatio = imgEl.naturalWidth / imgEl.naturalHeight;
              let imgH = imgW / aspectRatio;
              // Cap max height to avoid overflowing the page
              if (imgH > 80) imgH = 80;

              y = checkPage(doc, y, imgH + 8, logo, company, pageW, marginL, marginR);
              doc.addImage(dataUrl, "JPEG", imgX, y, imgW, imgH);

              if (ph.caption) {
                doc.setFontSize(7);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(100, 100, 100);
                doc.text(ph.caption, imgX, y + imgH + 3);
              }

              if (col === 1 || i === piecePhotos.length - 1) {
                y += imgH + 6;
              }
            }
          }
        } catch {
          // Skip failed photos
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(`[Photo: ${ph.file_name || ph.storage_path}]`, marginL, y);
          y += 5;
        }
      }
      y += 3;
    }
  }

  // ===== SECTION: RESSOURCES HUMAINES =====
  if (rh.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "RESSOURCES HUMAINES", y, marginL, contentW, pageW);

    doc.setFillColor(245, 245, 245);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Role", marginL + 3, y + 5);
    doc.text("Qte", marginL + contentW * 0.55, y + 5, { align: "center" });
    doc.text("Duree estimee", marginL + contentW * 0.75, y + 5);
    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    let totalPeople = 0;

    for (const r of rh) {
      y = checkPage(doc, y, 6, logo, company, pageW, marginL, marginR);
      doc.text((r as any).role, marginL + 3, y + 3);
      doc.text(String((r as any).quantity), marginL + contentW * 0.55, y + 3, { align: "center" });
      doc.text((r as any).duration_estimate || "—", marginL + contentW * 0.75, y + 3);
      totalPeople += (r as any).quantity;
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(`Total : ${totalPeople} personne(s)`, marginL + 3, y + 3);
    y += 8;
  }

  // ===== SECTION: VEHICULES ET ENGINS =====
  if (vehicules.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "VEHICULES ET ENGINS", y, marginL, contentW, pageW);

    for (const v of vehicules) {
      y = checkPage(doc, y, 12, logo, company, pageW, marginL, marginR);
      const veh = v as any;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(`${vehiculeLabels[veh.type] || veh.type}${veh.label ? ` - ${veh.label}` : ""}`, marginL + 3, y + 3);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const specs: string[] = [];
      if (veh.capacity) specs.push(`Capacite: ${veh.capacity}t`);
      if (veh.height) specs.push(`Hauteur: ${veh.height}m`);
      if (veh.reach) specs.push(`Deport: ${veh.reach}m`);
      if (veh.road_constraints) specs.push(`Voirie: ${veh.road_constraints}`);
      if (specs.length > 0) {
        doc.text(specs.join("  |  "), marginL + 6, y + 2);
        y += 5;
      }
      if (veh.notes) {
        const noteLines = doc.splitTextToSize(veh.notes, contentW - 10);
        doc.text(noteLines, marginL + 6, y + 2);
        y += noteLines.length * 3.5;
      }
      y += 3;
    }
  }

  // ===== SECTION: CONTRAINTES D'ACCES =====
  if (contraintes) {
    y = checkPage(doc, y, 25, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "CONTRAINTES D'ACCES", y, marginL, contentW, pageW);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);

    const c = contraintes as any;
    const items: [string, string][] = [];
    if (c.door_width) items.push(["Largeur portes", c.door_width]);
    if (c.stairs) items.push(["Escaliers", c.stairs]);
    items.push(["Monte-charge", c.freight_elevator ? "Oui" : "Non"]);
    items.push(["Rampe", c.ramp ? "Oui" : "Non"]);
    if (c.obstacles) items.push(["Obstacles", c.obstacles]);
    if (c.authorizations) items.push(["Autorisations", c.authorizations]);

    for (const [label, value] of items) {
      y = checkPage(doc, y, 5, logo, company, pageW, marginL, marginR);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} : `, marginL + 3, y + 3);
      const labelW = doc.getTextWidth(`${label} : `);
      doc.setFont("helvetica", "normal");
      doc.text(value, marginL + 3 + labelW, y + 3);
      y += 5;
    }

    if (c.notes) {
      y += 2;
      y = subTitle(doc, "Notes acces", y, marginL);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      const noteLines = doc.splitTextToSize(c.notes, contentW - 10);
      doc.text(noteLines, marginL + 3, y);
      y += noteLines.length * 4;
    }
    y += 5;
  }

  // ===== SECTION: METHODOLOGIE =====
  if (methodologie.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "METHODOLOGIE / NOTES TECHNIQUES", y, marginL, contentW, pageW);

    for (const m of methodologie) {
      const meth = m as any;
      y = checkPage(doc, y, 15, logo, company, pageW, marginL, marginR);
      y = subTitle(doc, meth.title || "Methodologie", y, marginL);

      if (meth.content) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(meth.content, contentW - 6);
        for (const line of lines) {
          y = checkPage(doc, y, 4, logo, company, pageW, marginL, marginR);
          doc.text(line, marginL + 3, y);
          y += 3.8;
        }
        y += 2;
      }

      // Checklist
      if (meth.checklist && Array.isArray(meth.checklist) && meth.checklist.length > 0) {
        for (const item of meth.checklist) {
          y = checkPage(doc, y, 5, logo, company, pageW, marginL, marginR);
          doc.setFontSize(8);
          const checked = typeof item === "object" && item.checked;
          const label = typeof item === "object" ? item.label || item.text || "" : String(item);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 30);
          doc.text(`${checked ? "[x]" : "[ ]"} ${label}`, marginL + 6, y);
          y += 4;
        }
        y += 3;
      }
    }
  }

  // ===== NOTES / COMMENTAIRES =====
  if (visite.comment || visite.notes || visite.instructions) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, "OBSERVATIONS", y, marginL, contentW, pageW);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);

    for (const [label, text] of [["Commentaire", visite.comment], ["Notes", visite.notes], ["Instructions", visite.instructions]]) {
      if (!text) continue;
      y = checkPage(doc, y, 10, logo, company, pageW, marginL, marginR);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} :`, marginL + 3, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, contentW - 6);
      for (const line of lines) {
        y = checkPage(doc, y, 4, logo, company, pageW, marginL, marginR);
        doc.text(line, marginL + 3, y);
        y += 3.8;
      }
      y += 4;
    }
  }

  // ===== FINAL FOOTER =====
  drawFooter(doc, company, pageW, marginL, marginR);

  const fileName = `Visite_${visite.code || visite.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
}
