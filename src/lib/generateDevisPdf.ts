import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { loadCompanyLogo } from "./pdfLogoHelper";

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export async function generateDevisPdf(devisId: string) {
  // Fetch devis with relations
  const { data: devis, error } = await supabase
    .from("devis")
    .select("*, clients(name, code, address, city, postal_code, email, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", devisId)
    .single();

  if (error || !devis) throw new Error("Devis introuvable");

  // Fetch devis lines
  const { data: lines } = await supabase
    .from("devis_lines")
    .select("*")
    .eq("devis_id", devisId)
    .order("sort_order", { ascending: true });

  const devisLines = lines ?? [];
  const client = devis.clients as any;
  const company = devis.companies as any;
  // Always compute amount from lines to stay in sync
  const amount = devisLines.length > 0
    ? devisLines.reduce((sum: number, l: any) => sum + (l.total != null ? Number(l.total) : Number(l.quantity) * Number(l.unit_price)), 0)
    : Number(devis.amount);
  const tvaRate = 20;
  const tvaAmount = amount * tvaRate / 100;
  const totalTTC = amount + tvaAmount;

  // Fetch dossier info if linked
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

  // ========== HEADER ==========
  const logoData = await loadCompanyLogo(company?.short_name || "");
  if (logoData) {
    doc.addImage(logoData, "PNG", marginL, 8, 45, 20);
  } else {
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 80, 30);
    doc.text(company?.short_name || company?.name || "SOCIÉTÉ", marginL, 22);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Transport • Grutage • Portage • Levage • Manutention lourde", marginL, 30);
  doc.text("Spécialiste en Manutention Lourde", marginL, 34);

  // Date (right side)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  const dateStr = `Paris, le ${format(new Date(devis.created_at), "dd/MM/yyyy")}`;
  doc.text(dateStr, colR, 22, { align: "right" });

  // ========== DEVIS NUMBER ==========
  let y = 40;
  doc.setFillColor(200, 80, 30);
  doc.rect(marginL, y - 5, contentW, 10, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`DEVIS CONTRAT n°${devis.code || "—"}`, pageW / 2, y + 2, { align: "center" });

  // ========== CLIENT BLOCK ==========
  y += 14;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Société ${client?.name || "—"}`, marginL, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Code client : ${client?.code || "—"} – ${client?.name || ""}`, marginL, y);

  if (client?.address) { y += 5; doc.text(client.address, marginL, y); }
  if (client?.postal_code || client?.city) {
    y += 5;
    doc.text(`${client?.postal_code || ""} ${client?.city || ""}`.trim(), marginL, y);
  }

  // Suivi technique (right side)
  doc.setFontSize(9);
  doc.text(`Suivi technique : ${format(new Date(devis.created_at), "dd/MM/yyyy")}`, colR, y - 5, { align: "right" });

  // Attention line
  if (client?.contact_name) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`A l'attention de ${client.contact_name}`, marginL, y);
  }

  // Greeting
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Monsieur,", marginL, y);
  y += 5;
  const introText = `Suite à votre demande, nous vous indiquons ci-après nos meilleures conditions pour les prestations suivantes :`;
  const introLines = doc.splitTextToSize(introText, contentW);
  doc.text(introLines, marginL, y);
  y += introLines.length * 4.5;

  // ========== SUR SITE ==========
  y += 4;
  doc.setFillColor(240, 240, 240);
  doc.rect(marginL, y - 4, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("SUR SITE", marginL + 3, y + 1);

  if (dossierInfo?.address) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(dossierInfo.address, marginL, y);
  }

  // ========== OBJET ==========
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`OBJET : ${devis.objet}`, marginL, y);

  // ========== DETAIL DU PRIX ==========
  y += 8;
  doc.setFillColor(240, 240, 240);
  doc.rect(marginL, y - 4, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DÉTAIL DU PRIX", marginL + 3, y + 1);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (devisLines.length > 0) {
    // Table header
    doc.setFillColor(230, 230, 230);
    doc.rect(marginL, y - 4, contentW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Description", marginL + 3, y + 1);
    doc.text("Qté", marginL + contentW - 55, y + 1, { align: "right" });
    doc.text("P.U. HT", marginL + contentW - 30, y + 1, { align: "right" });
    doc.text("Total HT", colR - 3, y + 1, { align: "right" });

    y += 5;
    doc.setFont("helvetica", "normal");

    for (const line of devisLines) {
      // Check page break
      if (y > 245) {
        doc.addPage();
        y = 20;
      }

      const descLines = doc.splitTextToSize(line.description, contentW - 70);
      const lineHeight = Math.max(descLines.length * 4.5, 6);

      doc.setDrawColor(230, 230, 230);
      doc.line(marginL, y + lineHeight - 2, colR, y + lineHeight - 2);

      doc.text(descLines, marginL + 3, y + 2);
      doc.text(String(line.quantity), marginL + contentW - 55, y + 2, { align: "right" });
      doc.text(fmtEur(Number(line.unit_price)), marginL + contentW - 30, y + 2, { align: "right" });
      const lineTotal = line.total != null ? Number(line.total) : Number(line.quantity) * Number(line.unit_price);
      doc.text(fmtEur(lineTotal), colR - 3, y + 2, { align: "right" });

      y += lineHeight + 1;
    }
  } else if (devis.notes) {
    // Fallback: use notes as description
    const noteLines = doc.splitTextToSize(devis.notes, contentW - 10);
    doc.text(noteLines.slice(0, 8), marginL + 3, y);
    y += Math.min(noteLines.length, 8) * 4.5;
  }

  // ========== TABLEAU TVA ==========
  y += 8;
  if (y > 230) { doc.addPage(); y = 20; }

  // Header
  doc.setFillColor(200, 80, 30);
  doc.rect(marginL, y - 4, contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL H.T", marginL + 5, y + 1);
  doc.text("TVA* de 20,00 %", marginL + contentW / 2 - 15, y + 1);
  doc.text("PRIX TTC", colR - 30, y + 1);

  // Values
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setDrawColor(180, 180, 180);
  doc.rect(marginL, y - 3, contentW, 8);
  doc.text(`${fmtEur(amount)} €`, marginL + 5, y + 2.5);
  doc.text(`${fmtEur(tvaAmount)} €`, marginL + contentW / 2 - 15, y + 2.5);
  doc.text(`${fmtEur(totalTTC)} €`, colR - 30, y + 2.5);

  // ========== PAYMENT TERMS ==========
  y += 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const paymentTerms = client?.payment_terms || "A définir";
  doc.text(`Condition de paiement : ${paymentTerms}`, marginL, y);

  y += 5;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text("* NON ASSUJETI A L'AUTOLIQUIDATION", marginL, y);

  y += 5;
  doc.text("Garantie : Valeur globale à préciser", marginL, y);

  // ========== CONDITIONS ==========
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 50, 20);
  doc.text("APRES VALIDATION", marginL, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const condText = "TOUTES MODIFICATIONS, REPORT OU ANNULATION DEVRA ETRE EFFECTUE DANS LES 48H SOUS PEINE DE FACTURATION TOTALE";
  const condLines = doc.splitTextToSize(condText, contentW);
  doc.text(condLines, marginL, y);
  y += condLines.length * 3.5;

  y += 3;
  doc.text("TOUTE HEURE D'ATTENTE NON TRAVAILLEE SERA FACTUREE", marginL, y);

  // Acceptance note
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("Pour l'acceptation du présent devis, veuillez nous retourner un exemplaire du devis", marginL, y);
  y += 3.5;
  doc.text("accompagné des conditions générales dûment signé et tamponné.", marginL, y);

  // ========== FOOTER ==========
  const footerY = 270;
  doc.setDrawColor(200, 80, 30);
  doc.setLineWidth(1);
  doc.line(marginL, footerY, pageW - marginR, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const footerParts: string[] = [];
  if (company?.address) footerParts.push(`Siège social : ${company.address}`);
  if (company?.phone) footerParts[footerParts.length - 1] += ` • Tél. ${company.phone}`;
  if (company?.email) footerParts.push(company.email);
  if (company?.siret) footerParts.push(`SIRET ${company.siret} • N° TVA Intra FR ${company.siret.replace(/\s/g, "").slice(0, 11)}`);

  let fy = footerY + 4;
  footerParts.forEach((line) => {
    doc.text(line, pageW / 2, fy, { align: "center" });
    fy += 3.5;
  });

  // ========== PAGE 2 - CONDITIONS GENERALES ==========
  doc.addPage();
  let cy = 20;

  // Header p2
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 80, 30);
  doc.text(company?.short_name || company?.name || "SOCIÉTÉ", marginL, cy);

  cy += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`DEVIS N°: ${devis.code || "—"}`, colR, cy, { align: "right" });

  cy += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("CONDITIONS GENERALES", pageW / 2, cy, { align: "center" });

  cy += 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const conditions = [
    { title: "1 – Préambule", text: "Les présentes conditions générales s'appliquent à tout contrat conclu entre le PRESTATAIRE et le CLIENT, lequel reconnaît en avoir pris connaissance et les accepte, sans aucune réserve." },
    { title: "2 – Nature du contrat", text: "Toute commande passée par le CLIENT constitue un contrat d'entreprise dénommé « contrat de levage – manutention » au sens des articles 1710 et 1779 suivants du Code Civil." },
    { title: "3 – Commande", text: "Sauf cas de force majeure, aucun report, aucune modification ou aucune annulation de commande ne pourra se faire sans acceptation écrite du PRESTATAIRE. En cas de report ou d'annulation, tous les frais déjà engagés seront facturés." },
    { title: "4 – Prestation", text: "Le PRESTATAIRE fournit les moyens en personnel et matériels nécessaires. Le CLIENT s'engage à donner par écrit les précisions nécessaires : définition de l'opération, nature et poids des objets, emplacement des points d'ancrage, moyens d'accès." },
    { title: "5 – Conditions d'exécution", text: "Le CLIENT s'engage à informer le PRESTATAIRE des contraintes liées au site et à prendre les mesures nécessaires pour que l'opération s'effectue en toute sécurité. Le CLIENT doit procéder au contrôle préalable des sols et sous-sols." },
    { title: "10 – Assurances", text: "Lorsque la valeur des objets confiés est supérieure au plafond de garantie, le CLIENT peut obtenir une garantie plus étendue moyennant facturation." },
    { title: "11 – Résiliation", text: "Le PRESTATAIRE se réserve la faculté de résilier le contrat en cas d'inexécution par le CLIENT de ses obligations, à l'issue d'un délai de huit jours calendaires." },
    { title: "12 – Prescriptions", text: "Les actions en responsabilité se prescrivent dans le délai d'une année à compter du jour de l'événement." },
    { title: "13 – Droit applicable", text: "Tout contrat est soumis au droit français. En cas de litige, le Tribunal de Commerce du lieu du siège social du PRESTATAIRE sera seul compétent." },
  ];

  for (const cond of conditions) {
    if (cy > 265) { doc.addPage(); cy = 20; }
    doc.setFont("helvetica", "bold");
    doc.text(cond.title, marginL, cy);
    cy += 4;
    doc.setFont("helvetica", "normal");
    const textLines = doc.splitTextToSize(cond.text, contentW);
    doc.text(textLines, marginL, cy);
    cy += textLines.length * 3.5 + 4;
  }

  // Signature area
  cy += 5;
  if (cy > 250) { doc.addPage(); cy = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Le Client", marginL + contentW - 40, cy);
  cy += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Lu et approuvé", marginL + contentW - 40, cy);
  cy += 15;
  doc.setDrawColor(180, 180, 180);
  doc.rect(marginL + contentW - 60, cy - 12, 60, 20);

  // Footer p2
  doc.setDrawColor(200, 80, 30);
  doc.setLineWidth(1);
  doc.line(marginL, footerY, pageW - marginR, footerY);
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  fy = footerY + 4;
  footerParts.forEach((line) => {
    doc.text(line, pageW / 2, fy, { align: "center" });
    fy += 3.5;
  });

  // Save
  const fileName = `Devis_${devis.code || devis.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
}
