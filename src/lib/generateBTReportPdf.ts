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

async function loadImageAsDataUrl(signedUrl: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const resp = await fetch(signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const origUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = origUrl;
    });

    const MAX_PX = 1200;
    let cw = imgEl.naturalWidth, ch = imgEl.naturalHeight;
    if (cw > MAX_PX || ch > MAX_PX) {
      if (cw > ch) { ch = Math.round(ch * MAX_PX / cw); cw = MAX_PX; }
      else { cw = Math.round(cw * MAX_PX / ch); ch = MAX_PX; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imgEl, 0, 0, cw, ch);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.7), width: cw, height: ch };
  } catch {
    return null;
  }
}

export async function generateBTReportPdf(operationId: string): Promise<{ pdfBase64: string; fileName: string; clientEmail: string | null }> {
  // Fetch operation with related data
  const { data: op, error } = await supabase
    .from("operations")
    .select("*, dossiers(title, code, clients(name, phone, email, address, city, postal_code, contact_name, code))")
    .eq("id", operationId)
    .single();

  if (error || !op) throw new Error("Opération introuvable");

  const dossier = (op as any).dossiers;
  const client = dossier?.clients;

  // Fetch company separately
  const { data: company } = await supabase
    .from("companies")
    .select("name, short_name, address, phone, email, siret")
    .eq("id", (op as any).company_id)
    .single();

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210, marginL = 15, marginR = 15;
  const contentW = pageW - marginL - marginR;
  const colR = marginL + contentW;

  const logo = await loadCompanyLogo(company?.short_name || "");

  // Header
  drawLogo(doc, logo, company, marginL);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Transport - Grutage - Portage - Levage - Manutention lourde", marginL, 33);

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Paris, le ${format(new Date(), "dd/MM/yyyy")}`, colR, 16, { align: "right" });

  // Title bar
  let y = 40;
  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 10, 1, 1, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const btTitle = `RAPPORT DE FIN DE CHANTIER — ${op.type} #${op.operation_number}`;
  doc.text(btTitle, pageW / 2, y + 7, { align: "center" });

  // Client info box
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

  // Company info left
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let ly = y + 6;
  if (company?.name) { doc.text(company.name, marginL, ly); ly += 4; }
  if (company?.address) { doc.text(company.address, marginL, ly); ly += 4; }
  if (company?.phone) { doc.text(`Tel : ${company.phone}`, marginL, ly); ly += 4; }

  // Operation details
  y = 92;
  y = sectionTitle(doc, "DETAILS DE L'OPERATION", y, marginL, contentW, pageW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  const infoLines: [string, string][] = [];
  if (dossier?.code) infoLines.push(["Dossier", `${dossier.code} — ${dossier.title}`]);
  if (op.lv_bt_number) infoLines.push(["N° BT", op.lv_bt_number]);
  if (op.loading_date) infoLines.push(["Date", format(new Date(op.loading_date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr })]);
  if (op.loading_address) infoLines.push(["Chargement", `${op.loading_address}${op.loading_city ? `, ${op.loading_city}` : ""}`]);
  if (op.delivery_address) infoLines.push(["Livraison", `${op.delivery_address}${op.delivery_city ? `, ${op.delivery_city}` : ""}`]);
  if (op.volume && op.volume > 0) infoLines.push(["Volume", `${op.volume} m³`]);

  for (const [label, value] of infoLines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, marginL + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginL + 30, y);
    y += 5;
  }

  if (op.notes) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Notes :", marginL + 2, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(op.notes, contentW - 6);
    for (const line of noteLines) {
      y = checkPage(doc, y, 4, logo, company, pageW, marginL, marginR);
      doc.text(line, marginL + 4, y);
      y += 3.8;
    }
  }

  y += 6;

  // Signatures section
  y = checkPage(doc, y, 60, logo, company, pageW, marginL, marginR);
  y = sectionTitle(doc, "SIGNATURES", y, marginL, contentW, pageW);

  const sigW = contentW / 2 - 5;

  // Start signature
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text("Debut de chantier", marginL, y + 4);

  if (op.start_signature_url) {
    try {
      const sigImg = await loadImageAsDataUrl(op.start_signature_url);
      if (!sigImg) {
        // It's a data URL already
        doc.addImage(op.start_signature_url, "PNG", marginL, y + 6, sigW, 30);
      } else {
        doc.addImage(sigImg.dataUrl, "JPEG", marginL, y + 6, sigW, 30);
      }
    } catch {
      // Try as data URL directly
      try { doc.addImage(op.start_signature_url, "PNG", marginL, y + 6, sigW, 30); } catch {}
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (op.start_signer_name) doc.text(`Signataire : ${op.start_signer_name}`, marginL, y + 39);
    if (op.start_signed_at) doc.text(format(new Date(op.start_signed_at), "dd/MM/yyyy HH:mm"), marginL, y + 43);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Non signe", marginL + 10, y + 20);
  }

  // End signature
  const endX = marginL + sigW + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text("Fin de chantier", endX, y + 4);

  if (op.end_signature_url) {
    try {
      const sigImg = await loadImageAsDataUrl(op.end_signature_url);
      if (!sigImg) {
        doc.addImage(op.end_signature_url, "PNG", endX, y + 6, sigW, 30);
      } else {
        doc.addImage(sigImg.dataUrl, "JPEG", endX, y + 6, sigW, 30);
      }
    } catch {
      try { doc.addImage(op.end_signature_url, "PNG", endX, y + 6, sigW, 30); } catch {}
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    if (op.end_signer_name) doc.text(`Signataire : ${op.end_signer_name}`, endX, y + 39);
    if (op.end_signed_at) doc.text(format(new Date(op.end_signed_at), "dd/MM/yyyy HH:mm"), endX, y + 43);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Non signe", endX + 10, y + 20);
  }

  y += 50;

  // Photos section
  const photos: string[] = (op as any).photos || [];
  if (photos.length > 0) {
    y = checkPage(doc, y, 20, logo, company, pageW, marginL, marginR);
    y = sectionTitle(doc, `PHOTOS (${photos.length})`, y, marginL, contentW, pageW);

    for (let i = 0; i < photos.length; i++) {
      const path = photos[i];
      try {
        const { data: urlData } = await supabase.storage.from("operation-photos").createSignedUrl(path, 3600);
        if (!urlData?.signedUrl) continue;

        const imgData = await loadImageAsDataUrl(urlData.signedUrl);
        if (!imgData) continue;

        const aspectRatio = imgData.width / imgData.height;
        const col = i % 2;
        const colW = contentW / 2 - 3;
        const imgX = marginL + col * (colW + 6);
        let imgH = colW / aspectRatio;
        if (imgH > 90) imgH = 90;

        if (col === 0) {
          y = checkPage(doc, y, imgH + 6, logo, company, pageW, marginL, marginR);
        }
        doc.addImage(imgData.dataUrl, "JPEG", imgX, y, colW, imgH);

        if (col === 1 || i === photos.length - 1) {
          y += imgH + 4;
        }
      } catch {
        // Skip failed photos
      }
    }
  }

  // Footer on last page
  drawFooter(doc, company, pageW, marginL, marginR);

  // Generate base64
  const pdfOutput = doc.output("datauristring");
  const pdfBase64 = pdfOutput.split(",")[1];
  const fileName = `Rapport-BT-${op.type}-${op.operation_number}${dossier?.code ? `-${dossier.code}` : ""}.pdf`;

  return { pdfBase64, fileName, clientEmail: client?.email || null };
}
