import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { loadCompanyLogo } from "./pdfLogoHelper";

// Number to French words converter (simplified for amounts)
function numberToFrenchWords(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  if (n === 0) return "zéro";

  function convert(num: number): string {
    if (num < 20) return units[num];
    if (num < 70) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      return tens[t] + (u === 1 && t !== 8 ? " et un" : u ? (t === 8 ? "-" : "-") + units[u] : t === 8 ? "s" : "");
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
  result += " et " + (cents === 0 ? "zéro" : convert(cents)) + " cent" + (cents > 1 ? "s" : "");
  return result;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

interface FactureData {
  id: string;
  code: string | null;
  amount: number;
  paid_amount: number;
  status: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  company_id: string;
  client_id: string;
  dossier_id: string | null;
  devis_id: string | null;
}

export async function generateFacturePdf(factureId: string) {
  // Fetch full facture data with relations
  const { data: facture, error: fErr } = await supabase
    .from("factures")
    .select("*, clients(name, address, city, postal_code, email, code, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", factureId)
    .single();

  if (fErr || !facture) throw new Error("Facture introuvable");

  // Fetch linked devis if any
  let devisCode: string | null = null;
  if (facture.devis_id) {
    const { data: devis } = await supabase.from("devis").select("code, objet").eq("id", facture.devis_id).single();
    if (devis) devisCode = devis.code || devis.objet;
  }

  // Fetch linked dossier if any
  let dossierCode: string | null = null;
  if (facture.dossier_id) {
    const { data: dossier } = await supabase.from("dossiers").select("code, title").eq("id", facture.dossier_id).single();
    if (dossier) dossierCode = dossier.code || dossier.title;
  }

  const client = facture.clients as any;
  const company = facture.companies as any;
  const amount = Number(facture.amount);
  const paidAmount = Number(facture.paid_amount);
  const tvaRate = 20;
  const tvaAmount = amount * tvaRate / 100;
  const totalTTC = amount + tvaAmount;
  const resteDu = totalTTC - paidAmount;

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;

  // ========== HEADER ==========
  // Company logo
  const logoData = await loadCompanyLogo(company?.short_name || "");
  if (logoData) {
    doc.addImage(logoData, "PNG", marginL, 10, 45, 20);
  } else {
    // Fallback: company name as text
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 80, 30);
    doc.text(company?.short_name || company?.name || "SOCIÉTÉ", marginL, 25);
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Spécialiste en Manutention Lourde", marginL, 33);

  // Client info (right side)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const clientX = 120;
  let clientY = 18;
  doc.text(client?.name || "Client", clientX, clientY);
  doc.setFont("helvetica", "normal");
  if (client?.address) { clientY += 5; doc.text(client.address, clientX, clientY); }
  if (client?.postal_code || client?.city) {
    clientY += 5;
    doc.text(`${client?.postal_code || ""} ${client?.city || ""}`.trim(), clientX, clientY);
  }
  if (client?.email) { clientY += 5; doc.setTextColor(0, 0, 180); doc.text(client.email, clientX, clientY); doc.setTextColor(0, 0, 0); }

  // ========== TVA & FACTURE NUMBER ==========
  let y = 48;
  if (company?.siret) {
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`TVA FR ${company.siret.replace(/\s/g, "").slice(0, 11)}`, marginL, y);
  }

  // Facture number box
  y += 4;
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(0, 0, 0);
  doc.rect(marginL, y - 4, 80, 8, "FD");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(`FACTURE N° ${facture.code || "—"}`, marginL + 3, y + 1.5);

  // Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const dateStr = `Paris, le ${format(new Date(facture.created_at), "dd MMMM yyyy", { locale: fr })}`;
  doc.text(dateStr, clientX, y + 1.5);

  // ========== REFERENCES ==========
  y += 14;
  doc.setFontSize(9);
  doc.text(`Référence client : ${client?.code || "—"}`, marginL, y);
  if (dossierCode) { y += 5; doc.text(`Dossier N° ${dossierCode}`, marginL, y); }
  if (devisCode) { y += 5; doc.text(`Référence devis : ${devisCode}`, marginL, y); }

  // ========== BODY - Description ==========
  y += 10;
  doc.setDrawColor(180, 180, 180);
  doc.rect(marginL, y, contentW, 30);

  y += 6;
  doc.setFontSize(9);
  if (facture.notes) {
    const lines = doc.splitTextToSize(facture.notes, contentW - 10);
    doc.text(lines.slice(0, 4), marginL + 5, y);
    y += Math.min(lines.length, 4) * 4.5;
  } else {
    doc.text("Prestation selon conditions convenues", marginL + 5, y);
    y += 5;
  }

  if (devisCode) {
    y += 2;
    doc.text(`Notre intervention selon devis n°${devisCode}`, marginL + 5, y);
  }

  // ========== TABLEAU TVA ==========
  y = Math.max(y + 15, 130);
  doc.setFontSize(9);

  // TVA table
  const cols = [marginL, marginL + 35, marginL + 55, marginL + 80, marginL + 105];
  const colR = marginL + contentW;

  // Header row
  doc.setFillColor(230, 230, 230);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Montant H.T.", cols[0] + 2, y + 5);
  doc.text("Code", cols[1] + 2, y + 5);
  doc.text("Taux TVA", cols[2] + 2, y + 5);
  doc.text("Montant TVA", cols[3] + 2, y + 5);

  // Data row
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.rect(marginL, y, contentW, 7);
  doc.text(fmtEur(amount), cols[0] + 2, y + 5);
  doc.text("2", cols[1] + 2, y + 5);
  doc.text(`${tvaRate.toFixed(2)}`, cols[2] + 2, y + 5);
  doc.text(fmtEur(tvaAmount), cols[3] + 2, y + 5);

  // Totals (right side)
  y += 7;
  const totalsX = marginL + contentW - 60;

  doc.setFont("helvetica", "bold");
  doc.text("Total H.T.", totalsX, y + 5);
  doc.text(`${fmtEur(amount)} €`, colR - 2, y + 5, { align: "right" });
  y += 7;
  doc.text("Total T.V.A.", totalsX, y + 5);
  doc.text(`${fmtEur(tvaAmount)} €`, colR - 2, y + 5, { align: "right" });
  y += 7;
  doc.setFillColor(220, 235, 250);
  doc.rect(totalsX - 2, y, contentW - totalsX + marginL + 2, 8, "F");
  doc.setFontSize(11);
  doc.text("TOTAL T.T.C.", totalsX, y + 6);
  doc.text(`${fmtEur(totalTTC)} €`, colR - 2, y + 6, { align: "right" });

  // ========== PAIEMENT ==========
  y += 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const paymentTerms = client?.payment_terms || "30 JOURS DATE DE FACTURE";
  doc.text(paymentTerms.toUpperCase(), marginL, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  if (facture.due_date) {
    doc.text(`Échéance : ${format(new Date(facture.due_date), "dd/MM/yyyy")}`, marginL, y);
  }

  // Reste dû
  doc.text("RESTE DÛ :", marginL + contentW - 50, y);
  doc.text(`${fmtEur(resteDu)} €`, colR - 2, y, { align: "right" });

  // ========== MENTIONS LEGALES ==========
  y += 12;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Facture arrêtée à la somme de : ${numberToFrenchWords(totalTTC)}`, marginL, y);
  y += 5;
  doc.text("Pas d'escompte en cas de paiement anticipé.", marginL, y);
  y += 4;
  doc.text("Pénalités de retard : 3 fois le taux d'intérêt légal.", marginL, y);
  y += 4;
  doc.text("Indemnité forfaitaire pour frais de recouvrement : 40 €", marginL, y);
  y += 4;
  doc.text("TVA acquittée sur les encaissements", marginL, y);

  // ========== FOOTER ==========
  const footerY = 270;
  doc.setDrawColor(200, 80, 30);
  doc.setLineWidth(1);
  doc.line(marginL, footerY, pageW - marginR, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);

  const footerLines = [];
  if (company?.address) footerLines.push(`Siège social : ${company.address}`);
  if (company?.phone) footerLines[footerLines.length - 1] += ` • Tél. ${company.phone}`;
  if (company?.email) footerLines.push(company.email);
  if (company?.siret) footerLines.push(`SIREN ${company.siret} • N° TVA Intra FR ${company.siret.replace(/\s/g, "").slice(0, 11)}`);

  let fy = footerY + 4;
  doc.setFont("helvetica", "normal");
  footerLines.forEach((line) => {
    doc.text(line, pageW / 2, fy, { align: "center" });
    fy += 3.5;
  });

  // Save
  const fileName = `Facture_${facture.code || facture.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
}
