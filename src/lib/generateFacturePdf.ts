import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { loadCompanyLogo, LogoResult } from "./pdfLogoHelper";

// ── Helpers ──

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function numberToFrenchWords(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  if (n === 0) return "zero";

  function convert(num: number): string {
    if (num < 20) return units[num];
    if (num < 70) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      return tens[t] + (u === 1 && t !== 8 ? " et un" : u ? "-" + units[u] : t === 8 ? "s" : "");
    }
    if (num < 80) {
      const u = num - 60;
      return "soixante" + (u === 11 ? " et onze" : u === 1 ? " et un" : "-" + units[u]);
    }
    if (num < 100) {
      const u = num - 80;
      return "quatre-vingt" + (u === 0 ? "s" : "-" + units[u]);
    }
    if (num < 200) return "cent" + (num === 100 ? "" : " " + convert(num - 100));
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const r = num % 100;
      return units[h] + " cent" + (r === 0 && h > 1 ? "s" : r ? " " + convert(r) : "");
    }
    if (num < 2000) return "mille" + (num === 1000 ? "" : " " + convert(num - 1000));
    if (num < 1000000) {
      const t = Math.floor(num / 1000);
      const r = num % 1000;
      return convert(t) + " mille" + (r ? " " + convert(r) : "");
    }
    return String(num);
  }

  const euros = Math.floor(n);
  const cents = Math.round((n - euros) * 100);
  let result = convert(euros) + " euro" + (euros > 1 ? "s" : "");
  result += " et " + (cents === 0 ? "zero" : convert(cents)) + " cent" + (cents > 1 ? "s" : "");
  return result;
}

// ── Brand constants ──
const brandR = 200, brandG = 80, brandB = 30;

// ── Reusable drawing functions ──

function drawHeader(doc: jsPDF, company: any, logoResult: LogoResult | null, marginL: number, colR: number, dateStr: string) {
  if (logoResult) {
    const maxW = 50, maxH = 22;
    const ratio = logoResult.width / logoResult.height;
    let imgW = maxW;
    let imgH = imgW / ratio;
    if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
    doc.addImage(logoResult.dataUrl, "PNG", marginL, 10, imgW, imgH);
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(company?.short_name || company?.name || "", marginL, 22);
  }

  // Tagline
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Transport - Grutage - Portage - Levage - Manutention lourde", marginL, 31);

  // Date top-right
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(dateStr, colR, 16, { align: "right" });
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

// ── Main export ──

export async function generateFacturePdf(factureId: string, returnPreview = false): Promise<{ blobUrl: string; fileName: string; dataUri: string } | void> {
  // Fetch facture with relations
  const { data: facture, error: fErr } = await supabase
    .from("factures")
    .select("*, clients(name, address, city, postal_code, email, code, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", factureId)
    .single();

  if (fErr || !facture) throw new Error("Facture introuvable");

  // Fetch linked devis
  let devisCode: string | null = null;
  if (facture.devis_id) {
    const { data: devis } = await supabase.from("devis").select("code, objet").eq("id", facture.devis_id).single();
    if (devis) devisCode = devis.code || devis.objet;
  }

  // Fetch linked dossier
  let dossierCode: string | null = null;
  if (facture.dossier_id) {
    const { data: dossier } = await supabase.from("dossiers").select("code, title").eq("id", facture.dossier_id).single();
    if (dossier) dossierCode = dossier.code || dossier.title;
  }

  const client = facture.clients as any;
  const company = facture.companies as any;
  const amount = Number(facture.amount);
  const discountPercent = Number((facture as any).discount_percent) || 0;
  const discountAmount = amount * discountPercent / 100;
  const amountAfterDiscount = amount - discountAmount;
  const paidAmount = Number(facture.paid_amount);
  const tvaRate = Number(facture.tva_rate) || 20;
  const tvaAmount = amountAfterDiscount * tvaRate / 100;
  const totalTTC = amountAfterDiscount + tvaAmount;
  const resteDu = totalTTC - paidAmount;
  const paymentTermsFac = (facture as any).payment_terms as string | null;

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const colR = marginL + contentW;

  const logoResult = await loadCompanyLogo(company?.short_name || "");
  const dateStr = `Paris, le ${format(new Date(facture.created_at), "dd MMMM yyyy", { locale: fr })}`;

  // ===================== HEADER =====================
  drawHeader(doc, company, logoResult, marginL, colR, dateStr);

  // ===================== TITLE BAR =====================
  let y = 38;
  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 10, 1, 1, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`FACTURE N° ${facture.code || "---"}`, pageW / 2, y + 7, { align: "center" });

  // ===================== CLIENT INFO =====================
  y = 54;
  doc.setTextColor(0, 0, 0);

  // Client box (right side)
  const clientBoxX = pageW / 2 + 5;
  const clientBoxW = colR - clientBoxX;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(clientBoxX, y, clientBoxW, 30, 1.5, 1.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(client?.name || "---", clientBoxX + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let cy = y + 11;
  if (client?.code) { doc.text(`Code : ${client.code}`, clientBoxX + 4, cy); cy += 4; }
  if (client?.address) { doc.text(client.address, clientBoxX + 4, cy); cy += 4; }
  if (client?.postal_code || client?.city) {
    doc.text(`${client?.postal_code || ""} ${client?.city || ""}`.trim(), clientBoxX + 4, cy); cy += 4;
  }
  if (client?.contact_name) {
    doc.setFont("helvetica", "italic");
    doc.text(`Att. : ${client.contact_name}`, clientBoxX + 4, cy);
  }

  // Company info (left side)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  let ly = y + 6;
  if (company?.name) { doc.text(company.name, marginL, ly); ly += 4; }
  if (company?.address) { doc.text(company.address, marginL, ly); ly += 4; }
  if (company?.phone) { doc.text(`Tel : ${company.phone}`, marginL, ly); ly += 4; }
  if (company?.email) { doc.text(company.email, marginL, ly); ly += 4; }
  if (company?.siret) {
    doc.setFontSize(7);
    doc.text(`SIRET ${company.siret}`, marginL, ly);
  }

  // ===================== REFERENCES =====================
  y = 90;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (client?.code) { doc.text(`Reference client : ${client.code}`, marginL, y); y += 5; }
  if (dossierCode) { doc.text(`Dossier N° ${dossierCode}`, marginL, y); y += 5; }
  if (devisCode) { doc.text(`Reference devis : ${devisCode}`, marginL, y); y += 5; }

  // ===================== DESCRIPTION / NOTES =====================
  y += 3;
  if (facture.notes) {
    doc.setFillColor(245, 245, 245);
    const noteLines = doc.splitTextToSize(facture.notes, contentW - 10);
    const boxH = Math.max(noteLines.length * 4 + 6, 14);
    doc.roundedRect(marginL, y, contentW, boxH, 1, 1, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(noteLines, marginL + 5, y + 5);
    y += boxH + 4;
  }

  if (devisCode) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Notre intervention selon devis n°${devisCode}`, marginL, y);
    y += 8;
  }

  // ===================== TVA TABLE =====================
  y = Math.max(y, 140);

  // Table header
  const colMontantHT = marginL + 3;
  const colCode = marginL + contentW * 0.35;
  const colTaux = marginL + contentW * 0.55;
  const colMontantTVA = colR - 3;

  doc.setFillColor(brandR, brandG, brandB);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Montant H.T.", colMontantHT, y + 5);
  doc.text("Code", colCode, y + 5);
  doc.text("Taux TVA", colTaux, y + 5);
  doc.text("Montant TVA", colMontantTVA, y + 5, { align: "right" });
  y += 7;

  // Data row
  doc.setFillColor(250, 250, 250);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text(`${fmtEur(amount)} EUR`, colMontantHT, y + 5);
  doc.text("2", colCode, y + 5);
  doc.text(`${tvaRate.toFixed(2)} %`, colTaux, y + 5);
  doc.text(`${fmtEur(tvaAmount)} EUR`, colMontantTVA, y + 5, { align: "right" });
  y += 7;

  // Discount row
  if (discountPercent > 0) {
    doc.setFillColor(255, 245, 245);
    doc.rect(marginL, y, contentW, 7, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 40, 40);
    doc.text(`Remise ${discountPercent}%`, colMontantHT, y + 5);
    doc.text(`-${fmtEur(discountAmount)} EUR`, colMontantTVA, y + 5, { align: "right" });
    y += 7;
  }

  // Bottom line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.line(marginL, y, colR, y);
  y += 2;

  // ===================== TOTALS =====================
  y += 4;
  const totalsX = marginL + contentW * 0.45;
  const totalsW = colR - totalsX;

  // Total HT
  doc.setFillColor(245, 245, 245);
  doc.rect(totalsX, y, totalsW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("Total HT", totalsX + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${fmtEur(amount)} EUR`, colR - 4, y + 5, { align: "right" });
  y += 8;

  // TVA
  doc.setFillColor(245, 245, 245);
  doc.rect(totalsX, y, totalsW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("TVA 20,00 %", totalsX + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${fmtEur(tvaAmount)} EUR`, colR - 4, y + 5, { align: "right" });
  y += 8;

  // TTC (brand colored)
  doc.setFillColor(brandR, brandG, brandB);
  doc.rect(totalsX, y, totalsW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TTC", totalsX + 4, y + 5.5);
  doc.text(`${fmtEur(totalTTC)} EUR`, colR - 4, y + 5.5, { align: "right" });
  y += 14;

  // ===================== PAIEMENT =====================
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const paymentTerms = client?.payment_terms || "30 JOURS DATE DE FACTURE";
  doc.text(`Conditions de paiement : ${paymentTerms.toUpperCase()}`, marginL, y);
  y += 5;

  if (facture.due_date) {
    doc.setFont("helvetica", "bold");
    doc.text(`Echeance : ${format(new Date(facture.due_date), "dd/MM/yyyy")}`, marginL, y);
    y += 5;
  }

  // Reste du - right aligned, brand color
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text("RESTE DU :", colR - 50, y);
  doc.text(`${fmtEur(resteDu)} EUR`, colR, y, { align: "right" });
  y += 10;

  // ===================== MENTIONS LEGALES =====================
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Facture arretee a la somme de : ${numberToFrenchWords(totalTTC)}`, marginL, y);
  y += 4;
  doc.text("Pas d'escompte en cas de paiement anticipe.", marginL, y);
  y += 3.5;
  doc.text("Penalites de retard : 3 fois le taux d'interet legal.", marginL, y);
  y += 3.5;
  doc.text("Indemnite forfaitaire pour frais de recouvrement : 40 EUR", marginL, y);
  y += 3.5;
  doc.text("TVA acquittee sur les encaissements", marginL, y);

  // ===================== FOOTER =====================
  drawFooter(doc, company, pageW, marginL, marginR);

  // Save or return preview
  const fileName = `Facture_${facture.code || facture.id.slice(0, 8)}.pdf`;

  if (returnPreview) {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const dataUri = doc.output("datauristring");
    return { blobUrl, fileName, dataUri };
  }

  // Archive PDF to storage (non-blocking)
  try {
    const pdfBlob = doc.output("blob");
    const path = `factures/${facture.company_id}/${factureId}/${facture.code || factureId}.pdf`;
    await supabase.storage.from("documents-pdf").upload(path, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });
  } catch (e) {
    console.warn("PDF archive failed:", e);
  }

  doc.save(fileName);
}
