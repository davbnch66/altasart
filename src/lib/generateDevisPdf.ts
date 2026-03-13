import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { loadCompanyLogo, LogoResult } from "./pdfLogoHelper";

interface TextBlock {
  type: "text" | "bullet" | "ordered";
  text: string;
  bold?: boolean;
  index?: number;
}

/** Parse simple HTML into text blocks for PDF rendering */
function htmlToPlainText(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const div = document.createElement("div");
  div.innerHTML = html;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) {
        const parentTag = (node.parentElement?.tagName || "").toLowerCase();
        blocks.push({ type: "text", text, bold: parentTag === "b" || parentTag === "strong" });
      }
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();

    if (tag === "ul") {
      el.querySelectorAll(":scope > li").forEach((li) => {
        blocks.push({ type: "bullet", text: (li.textContent || "").trim() });
      });
      return;
    }
    if (tag === "ol") {
      let idx = 1;
      el.querySelectorAll(":scope > li").forEach((li) => {
        blocks.push({ type: "ordered", text: (li.textContent || "").trim(), index: idx++ });
      });
      return;
    }
    if (tag === "br") {
      blocks.push({ type: "text", text: "" });
      return;
    }
    if (tag === "p" || tag === "div") {
      const text = (el.textContent || "").trim();
      if (text) {
        const isBold = el.querySelector("b, strong") !== null;
        blocks.push({ type: "text", text, bold: isBold });
      }
      return;
    }
    // Recurse for other tags
    el.childNodes.forEach(walk);
  };

  div.childNodes.forEach(walk);
  return blocks.length > 0 ? blocks : [{ type: "text", text: div.textContent || "" }];
}

/** Format number as "1 000,00" with regular spaces (jsPDF-safe) */
function fmtEur(n: number): string {
  return n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Brand color
const brandR = 200, brandG = 80, brandB = 30;

/** Draw logo on any page — 50x22mm max, aspect ratio preserved */
function drawLogo(doc: jsPDF, logoResult: LogoResult | null, company: any, marginL: number) {
  if (logoResult) {
    const maxW = 50, maxH = 22;
    const ratio = logoResult.width / logoResult.height;
    let imgW = maxW;
    let imgH = imgW / ratio;
    if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
    doc.addImage(logoResult.dataUrl, "PNG", marginL, 8, imgW, imgH);
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(company?.short_name || company?.name || "", marginL, 22);
  }
}

/** Draw signature stamp at the bottom-right of a page */
function drawSignatureStamp(
  doc: jsPDF,
  signatureDataUrl: string | null,
  signerName: string | null,
  signedAt: string | null,
  pageW: number,
  marginR: number
) {
  if (!signatureDataUrl) return;

  const stampX = pageW - marginR - 55;
  const stampY = 250;

  // Light border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(stampX, stampY, 55, 28, 1.5, 1.5);

  // "Lu et approuvé" label
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Lu et approuvé", stampX + 2, stampY + 3.5);

  // Signature image — fit in ~50x16mm area
  try {
    doc.addImage(signatureDataUrl, "PNG", stampX + 2, stampY + 5, 40, 14);
  } catch {
    // fallback if image decode fails
  }

  // Signer name + date
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 80);
  const nameText = signerName || "";
  const dateText = signedAt ? format(new Date(signedAt), "dd/MM/yyyy") : "";
  doc.text(`${nameText}  ${dateText}`, stampX + 2, stampY + 26);
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

export async function generateDevisPdf(devisId: string, returnBase64 = false, returnPreview = false): Promise<string | { blobUrl: string; fileName: string; dataUri: string } | void> {
  const { data: devis, error } = await supabase
    .from("devis")
    .select("*, clients(name, code, address, city, postal_code, email, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", devisId)
    .single();

  if (error || !devis) throw new Error("Devis introuvable");

  const { data: lines } = await supabase
    .from("devis_lines")
    .select("*")
    .eq("devis_id", devisId)
    .order("sort_order", { ascending: true });

  // Fetch signature data if the devis is signed
  let signatureDataUrl: string | null = null;
  let signerName: string | null = null;
  let signedAt: string | null = null;

  if (devis.status === "accepte") {
    const { data: sigData } = await supabase
      .from("devis_signatures")
      .select("signature_data_url, signer_name, signed_at, status")
      .eq("devis_id", devisId)
      .eq("status", "signed")
      .order("signed_at", { ascending: false })
      .limit(1);

    if (sigData && sigData.length > 0 && sigData[0].signature_data_url) {
      signatureDataUrl = sigData[0].signature_data_url;
      signerName = sigData[0].signer_name;
      signedAt = sigData[0].signed_at;
    }
  }

  const devisLines = lines ?? [];
  const client = devis.clients as any;
  const company = devis.companies as any;

  const amount = devisLines.length > 0
    ? devisLines.reduce((sum: number, l: any) => sum + (l.total != null ? Number(l.total) : Number(l.quantity) * Number(l.unit_price)), 0)
    : Number(devis.amount);
  const tvaRate = 20;
  const tvaAmount = amount * tvaRate / 100;
  const totalTTC = amount + tvaAmount;

  let dossierInfo: { title?: string; address?: string } | null = null;
  if (devis.dossier_id) {
    const { data: dossier } = await supabase.from("dossiers").select("title, address, code").eq("id", devis.dossier_id).single();
    if (dossier) dossierInfo = dossier;
  }

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  const colR = marginL + contentW;

  const logoResult = await loadCompanyLogo(company?.short_name || "");

  // ===================== PAGE 1 HEADER =====================
  drawLogo(doc, logoResult, company, marginL);

  // Tagline
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Transport - Grutage - Portage - Levage - Manutention lourde", marginL, 33);

  // Date top-right
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const dateStr = `Paris, le ${format(new Date(devis.created_at), "dd/MM/yyyy")}`;
  doc.text(dateStr, colR, 16, { align: "right" });

  // ===================== TITLE BAR =====================
  let y = 40;
  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 10, 1, 1, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`DEVIS CONTRAT N° ${devis.code || "---"}`, pageW / 2, y + 7, { align: "center" });

  // ===================== CLIENT INFO =====================
  y = 56;
  doc.setTextColor(0, 0, 0);

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

  // ===================== INTRO =====================
  y = 92;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Monsieur,", marginL, y);
  y += 5;
  const introText = "Suite a votre demande, nous vous indiquons ci-apres nos meilleures conditions pour les prestations suivantes :";
  const introLines = doc.splitTextToSize(introText, contentW);
  doc.text(introLines, marginL, y);
  y += introLines.length * 4 + 2;

  // ===================== SUR SITE =====================
  if (dossierInfo?.address) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("SUR SITE", marginL + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(dossierInfo.address, marginL + 35, y + 5);
    y += 10;
  }

  // ===================== OBJET =====================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text(`OBJET : ${devis.objet}`, marginL, y + 4);
  y += 10;

  // ===================== TABLE =====================
  const contentMode = devis.content_mode || "lines";
  const showCustom = (contentMode === "custom" || contentMode === "both") && devis.custom_content;
  const showLines = contentMode === "lines" || contentMode === "both" || !devis.content_mode;

  // --- Custom content section ---
  if (showCustom) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("DETAIL DE LA PRESTATION", marginL + 4, y + 5);
    y += 12;

    const plainText = htmlToPlainText(devis.custom_content);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);

    const textIndent = marginL + 4;
    const bulletIndent = marginL + 8;
    const textMaxW = contentW - 8;
    const bulletMaxW = contentW - 14;

    for (const block of plainText) {
      if (y > 240) {
        drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
        drawFooter(doc, company, pageW, marginL, marginR);
        doc.addPage();
        drawLogo(doc, logoResult, company, marginL);
        y = 35;
      }

      if (block.type === "bullet") {
        const wrapped = doc.splitTextToSize(block.text, bulletMaxW);
        doc.setFont("helvetica", "normal");
        doc.text("•", textIndent, y);
        doc.text(wrapped, bulletIndent, y);
        y += wrapped.length * 4 + 1.5;
      } else if (block.type === "ordered") {
        const prefix = `${block.index}.`;
        const wrapped = doc.splitTextToSize(block.text, bulletMaxW);
        doc.setFont("helvetica", "normal");
        doc.text(prefix, textIndent, y);
        doc.text(wrapped, bulletIndent, y);
        y += wrapped.length * 4 + 1.5;
      } else {
        if (!block.text) { y += 2; continue; }
        if (block.bold) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(block.text, textMaxW);
        doc.text(wrapped, textIndent, y);
        y += wrapped.length * 4 + 1.5;
        doc.setFont("helvetica", "normal");
      }
    }

    if (contentMode === "both") y += 6;
  }

  // --- Lines section ---
  if (showLines) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("DETAIL DU PRIX", marginL + 4, y + 5);
    y += 10;

    const colDesc = marginL + 3;
    const colQty = marginL + contentW * 0.6;
    const colPU = marginL + contentW * 0.78;
    const colTotal = colR - 3;

    if (devisLines.length > 0) {
      doc.setFillColor(brandR, brandG, brandB);
      doc.rect(marginL, y, contentW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Description", colDesc, y + 5);
      doc.text("Qte", colQty, y + 5, { align: "center" });
      doc.text("P.U. HT", colPU, y + 5, { align: "right" });
      doc.text("Total HT", colTotal, y + 5, { align: "right" });
      y += 9;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8);

      let rowAlt = false;
      for (const line of devisLines) {
        if (y > 240) {
          drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
          drawFooter(doc, company, pageW, marginL, marginR);
          doc.addPage();
          drawLogo(doc, logoResult, company, marginL);
          y = 35;
        }

        const descLines = doc.splitTextToSize(line.description, contentW * 0.55);
        const rowH = Math.max(descLines.length * 4, 6);

        if (rowAlt) {
          doc.setFillColor(250, 250, 250);
          doc.rect(marginL, y - 1, contentW, rowH + 2, "F");
        }
        rowAlt = !rowAlt;

        doc.setTextColor(30, 30, 30);
        doc.text(descLines, colDesc, y + 3);
        doc.text(String(line.quantity), colQty, y + 3, { align: "center" });
        doc.text(`${fmtEur(Number(line.unit_price))} EUR`, colPU, y + 3, { align: "right" });
        const lineTotal = line.total != null ? Number(line.total) : Number(line.quantity) * Number(line.unit_price);
        doc.text(`${fmtEur(lineTotal)} EUR`, colTotal, y + 3, { align: "right" });

        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.2);
        doc.line(marginL, y + rowH + 1, colR, y + rowH + 1);

        y += rowH + 3;
      }
    } else if (devis.notes && contentMode !== "both") {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(devis.notes, contentW - 10);
      doc.text(noteLines.slice(0, 8), marginL + 3, y);
      y += Math.min(noteLines.length, 8) * 4;
    }
  }

  // ===================== TOTALS TABLE =====================
  y += 6;
  if (y > 225) {
    drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
    drawFooter(doc, company, pageW, marginL, marginR);
    doc.addPage();
    drawLogo(doc, logoResult, company, marginL);
    y = 35;
  }

  const totalsX = marginL + contentW * 0.45;
  const totalsW = colR - totalsX;

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

  doc.setFillColor(245, 245, 245);
  doc.rect(totalsX, y, totalsW, 7, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("TVA 20,00 %", totalsX + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`${fmtEur(tvaAmount)} EUR`, colR - 4, y + 5, { align: "right" });
  y += 8;

  doc.setFillColor(brandR, brandG, brandB);
  doc.rect(totalsX, y, totalsW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TTC", totalsX + 4, y + 5.5);
  doc.text(`${fmtEur(totalTTC)} EUR`, colR - 4, y + 5.5, { align: "right" });
  y += 14;

  // ===================== PAYMENT TERMS =====================
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const paymentTerms = client?.payment_terms || "A definir";
  doc.text(`Condition de paiement : ${paymentTerms}`, marginL, y);
  y += 5;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.text("* NON ASSUJETTI A L'AUTOLIQUIDATION", marginL, y);
  y += 8;

  // ===================== CONDITIONS =====================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(brandR, brandG, brandB);
  doc.text("APRES VALIDATION", marginL, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.text("TOUTES MODIFICATIONS, REPORT OU ANNULATION DEVRA ETRE EFFECTUE DANS LES 48H SOUS PEINE DE FACTURATION TOTALE.", marginL, y);
  y += 3.5;
  doc.text("TOUTE HEURE D'ATTENTE NON TRAVAILLEE SERA FACTUREE.", marginL, y);
  y += 6;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  doc.text("Pour l'acceptation du present devis, veuillez nous retourner un exemplaire du devis", marginL, y);
  y += 3;
  doc.text("accompagne des conditions generales dument signe et tamponne.", marginL, y);

  // ===================== SIGNATURE STAMP PAGE 1 =====================
  drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);

  // ===================== FOOTER PAGE 1 =====================
  drawFooter(doc, company, pageW, marginL, marginR);

  // ===================== PAGE 2 - CONDITIONS GENERALES =====================
  doc.addPage();
  drawLogo(doc, logoResult, company, marginL);
  generateConditionsPage(doc, company, devis, logoResult, pageW, marginL, marginR, contentW, colR, signatureDataUrl, signerName, signedAt);

  const fileName = `Devis_${devis.code || devis.id.slice(0, 8)}.pdf`;

  if (returnPreview) {
    const blob = doc.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    const dataUri = doc.output("datauristring");
    return { blobUrl, fileName, dataUri };
  }

  if (returnBase64) {
    return doc.output("datauristring").split(",")[1];
  }
  doc.save(fileName);
}

function generateConditionsPage(
  doc: jsPDF, company: any, devis: any, logoResult: LogoResult | null,
  pageW: number, marginL: number, marginR: number, contentW: number, colR: number,
  signatureDataUrl: string | null, signerName: string | null, signedAt: string | null
) {
  let y = 35;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`DEVIS N° ${devis.code || "---"}`, colR, 16, { align: "right" });

  doc.setFillColor(brandR, brandG, brandB);
  doc.roundedRect(marginL, y, contentW, 8, 1, 1, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CONDITIONS GENERALES", pageW / 2, y + 5.5, { align: "center" });

  y += 14;
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);

  const conditions = [
    { title: "1 - Preambule", text: "Les presentes conditions generales s'appliquent a tout contrat conclu entre le PRESTATAIRE et le CLIENT, lequel reconnait en avoir pris connaissance et les accepte, sans aucune reserve." },
    { title: "2 - Nature du contrat", text: "Toute commande passee par le CLIENT constitue un contrat d'entreprise denomme contrat de levage - manutention au sens des articles 1710 et 1779 suivants du Code Civil." },
    { title: "3 - Commande", text: "Sauf cas de force majeure, aucun report, aucune modification ou aucune annulation de commande ne pourra se faire sans acceptation ecrite du PRESTATAIRE. En cas de report ou d'annulation, tous les frais deja engages seront factures." },
    { title: "4 - Prestation", text: "Le PRESTATAIRE fournit les moyens en personnel et materiels necessaires. Le CLIENT s'engage a donner par ecrit les precisions necessaires : definition de l'operation, nature et poids des objets, emplacement des points d'ancrage, moyens d'acces." },
    { title: "5 - Conditions d'execution", text: "Le CLIENT s'engage a informer le PRESTATAIRE des contraintes liees au site et a prendre les mesures necessaires pour que l'operation s'effectue en toute securite. Le CLIENT doit proceder au controle prealable des sols et sous-sols." },
    { title: "10 - Assurances", text: "Lorsque la valeur des objets confies est superieure au plafond de garantie, le CLIENT peut obtenir une garantie plus etendue moyennant facturation." },
    { title: "11 - Resiliation", text: "Le PRESTATAIRE se reserve la faculte de resilier le contrat en cas d'inexecution par le CLIENT de ses obligations, a l'issue d'un delai de huit jours calendaires." },
    { title: "12 - Prescriptions", text: "Les actions en responsabilite se prescrivent dans le delai d'une annee a compter du jour de l'evenement." },
    { title: "13 - Droit applicable", text: "Tout contrat est soumis au droit francais. En cas de litige, le Tribunal de Commerce du lieu du siege social du PRESTATAIRE sera seul competent." },
  ];

  for (const cond of conditions) {
    if (y > 240) {
      drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
      drawFooter(doc, company, pageW, marginL, marginR);
      doc.addPage();
      drawLogo(doc, logoResult, company, marginL);
      y = 35;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(brandR, brandG, brandB);
    doc.text(cond.title, marginL, y);
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const textLines = doc.splitTextToSize(cond.text, contentW);
    doc.text(textLines, marginL, y);
    y += textLines.length * 3.2 + 4;
  }

  // Signature area — if signed, show real signature; otherwise show empty box
  y += 8;
  if (y > 240) {
    drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
    drawFooter(doc, company, pageW, marginL, marginR);
    doc.addPage();
    drawLogo(doc, logoResult, company, marginL);
    y = 35;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Le Client", marginL + contentW - 35, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("Lu et approuve", marginL + contentW - 35, y);
  y += 3;

  if (signatureDataUrl) {
    // Draw actual signature
    doc.setDrawColor(brandR, brandG, brandB);
    doc.setLineWidth(0.5);
    doc.roundedRect(marginL + contentW - 55, y, 55, 25, 1, 1);
    try {
      doc.addImage(signatureDataUrl, "PNG", marginL + contentW - 53, y + 1, 42, 16);
    } catch { /* skip */ }
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 60);
    doc.text(signerName || "", marginL + contentW - 53, y + 20);
    if (signedAt) {
      doc.text(`Signé le ${format(new Date(signedAt), "dd/MM/yyyy")}`, marginL + contentW - 53, y + 23);
    }
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginL + contentW - 55, y, 55, 20, 1, 1);
  }

  drawSignatureStamp(doc, signatureDataUrl, signerName, signedAt, pageW, marginR);
  drawFooter(doc, company, pageW, marginL, marginR);
}