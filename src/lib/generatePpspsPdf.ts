import jsPDF from "jspdf";
import { loadCompanyLogo } from "./pdfLogoHelper";

const ORANGE = [200, 80, 30] as const;
const DARK = [30, 30, 30] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_BG = [245, 245, 245] as const;

interface PpspsPdfOptions {
  compress?: boolean;
  customSections?: { id: string; title: string; content: string; position: string }[];
  images?: { id: string; storagePath: string; caption: string; url?: string }[];
}

export const generatePpspsPdf = async (content: any, devis: any, options?: PpspsPdfOptions) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: options?.compress ?? true, putOnlyUsedFonts: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - 2 * margin;
  let y = 20;

  const company = devis.companies || {};
  const client = devis.clients || {};
  const rg = content.renseignements_generaux || {};

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 25) {
      addFooter(doc, pageW, pageH);
      doc.addPage();
      y = 20;
    }
  };

  // Try to load logo
  try {
    const shortName = company.short_name || "ART";
    const logoData = await loadCompanyLogo(shortName);
    if (logoData) {
      const ratio = logoData.width / logoData.height;
      const logoH = 15;
      const logoW = logoH * ratio;
      doc.addImage(logoData.dataUrl, "PNG", margin, y, Math.min(logoW, 50), logoH);
    }
  } catch {}

  // Title
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...ORANGE);
  doc.text("PLAN PARTICULIER DE SÉCURITÉ", pageW / 2, y, { align: "center" });
  y += 7;
  doc.text("ET DE PROTECTION DE LA SANTÉ", pageW / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(14);
  doc.text("P.P.S.P.S.", pageW / 2, y, { align: "center" });
  y += 12;

  // Company info
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(`Entreprise : ${company.name || "ART LEVAGE"}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Adresse : ${company.address || "30 rue Marbeuf 75008 PARIS"}`, margin, y); y += 4;
  doc.text(`Tél : ${company.phone || "01 43 87 04 83"}`, margin, y); y += 4;
  doc.text(`Email : ${company.email || "contact@artlevage.fr"}`, margin, y); y += 4;
  doc.text(`SIRET : ${company.siret || "490 553 393 00037"}`, margin, y); y += 8;

  // Devis ref
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ORANGE);
  doc.text(`Réf. Devis : ${devis.code || ""}`, margin, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(`Objet : ${devis.objet || ""}`, margin, y); y += 5;
  doc.text(`Client : ${client.name || ""}`, margin, y); y += 10;

  // I. Renseignements Généraux
  y = addSectionTitle(doc, "I. RENSEIGNEMENTS GÉNÉRAUX", margin, y, maxW);
  const rgFields = [
    ["Adresse du chantier", rg.adresse_chantier],
    ["Donneur d'ordre", rg.donneur_ordre],
    ["Responsable au siège", rg.responsable_siege || "Mr. IASSA Amar"],
    ["Responsable chantier", rg.responsable_chantier || "À DÉFINIR"],
    ["Chargé d'exécution", rg.charge_execution || "À DÉFINIR"],
  ];
  for (const [label, value] of rgFields) {
    checkPageBreak(6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(`${label} :`, margin + 2, y);
    doc.setFont("helvetica", "normal"); doc.text(String(value || "À DÉFINIR"), margin + 50, y);
    y += 5;
  }
  y += 5;

  // Intervenants
  if (content.intervenants?.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "INTERVENANTS", margin, y, maxW);
    y = addTable(doc, ["Poste", "Nom / Adresse", "Contact"],
      content.intervenants.map((i: any) => [i.poste || "", i.nom_adresse || "—", i.contact || "—"]),
      margin, y, maxW, [40, 80, 40]);
    y += 5;
  }

  // Autorités compétentes
  if (content.autorites_competentes?.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "AUTORITÉS COMPÉTENTES", margin, y, maxW);
    y = addTable(doc, ["Poste", "Adresse", "Contact"],
      content.autorites_competentes.map((a: any) => [a.poste || "", a.adresse || "—", a.contact || "—"]),
      margin, y, maxW, [40, 80, 40]);
    y += 5;
  }

  // Organisation secours
  const secours = content.organisation_secours || {};
  checkPageBreak(30);
  y = addSectionTitle(doc, "II. ORGANISATION DES SECOURS", margin, y, maxW);
  if (secours.premiers_secours) { y = addSubSection(doc, "Premiers secours", secours.premiers_secours, margin, y, maxW, checkPageBreak); }
  if (secours.consignes_accidents) { y = addSubSection(doc, "Consignes en cas d'accidents", secours.consignes_accidents, margin, y, maxW, checkPageBreak); }
  if (secours.droit_retrait) { y = addSubSection(doc, "Droit d'alerte et de retrait", secours.droit_retrait, margin, y, maxW, checkPageBreak); }
  if (secours.numeros_urgence?.length > 0) {
    checkPageBreak(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Numéros d'urgence", margin + 2, y); y += 5;
    y = addTable(doc, ["Dénomination", "Adresse", "Téléphone"],
      secours.numeros_urgence.map((n: any) => [n.denomination, n.adresse || "—", n.telephone]),
      margin, y, maxW, [45, 75, 40]);
    y += 5;
  }

  // Visite médicale
  if (content.visite_medicale) {
    checkPageBreak(15);
    y = addSubSection(doc, "Visite médicale obligatoire", content.visite_medicale, margin, y, maxW, checkPageBreak);
  }

  // Mesures spécifiques
  if (content.mesures_specifiques?.length > 0) {
    checkPageBreak(15);
    y = addSectionTitle(doc, "MESURES SPÉCIFIQUES", margin, y, maxW);
    y = addBulletList(doc, content.mesures_specifiques, margin, y, maxW, checkPageBreak);
    y += 3;
  }

  // Horaires
  if (content.horaires?.jours?.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "HORAIRES DU CHANTIER", margin, y, maxW);
    y = addTable(doc, ["Jour", "Horaires"],
      content.horaires.jours.map((j: any) => [j.jour, j.horaire]),
      margin, y, maxW, [40, 120]);
    y += 5;
  }

  // Habilitations
  if (content.habilitations?.length > 0) {
    checkPageBreak(15);
    y = addSectionTitle(doc, "HABILITATIONS ET AUTORISATIONS", margin, y, maxW);
    y = addBulletList(doc, content.habilitations, margin, y, maxW, checkPageBreak);
    y += 3;
  }

  // Description opération
  if (content.description_operation) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "III. DESCRIPTION DE L'OPÉRATION", margin, y, maxW);
    y = addWrappedText(doc, content.description_operation, margin + 2, y, maxW - 4, checkPageBreak);
    y += 5;
  }

  // Mode opératoire
  if (content.mode_operatoire?.length > 0) {
    checkPageBreak(15);
    y = addSectionTitle(doc, "MODE OPÉRATOIRE", margin, y, maxW);
    for (const phase of content.mode_operatoire) {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setTextColor(...ORANGE);
      doc.text(phase.phase, margin + 2, y); y += 5;
      doc.setTextColor(...DARK);
      y = addBulletList(doc, phase.etapes, margin, y, maxW, checkPageBreak);
      y += 3;
    }
  }

  // Méthodologie
  if (content.methodologie) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "MÉTHODOLOGIE DE MANUTENTION", margin, y, maxW);
    y = addWrappedText(doc, content.methodologie, margin + 2, y, maxW - 4, checkPageBreak);
    y += 5;
  }

  // Planning
  if (content.planning) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "PLANNING PRÉVISIONNEL", margin, y, maxW);
    const planFields = [
      ["Horaire de travail", content.planning.horaire_travail],
      ["Durée estimée", content.planning.duree_estimee],
      ["Date de début", content.planning.date_debut],
      ["Date de fin", content.planning.date_fin],
    ];
    for (const [label, value] of planFields) {
      checkPageBreak(6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text(`${label} :`, margin + 2, y);
      doc.setFont("helvetica", "normal"); doc.text(String(value || "À DÉFINIR"), margin + 50, y);
      y += 5;
    }
    y += 3;
  }

  // Moyens humains
  if (content.moyens_humains) {
    checkPageBreak(15);
    y = addSubSection(doc, "Moyens humains", content.moyens_humains, margin, y, maxW, checkPageBreak);
  }

  // Moyens matériels
  if (content.moyens_materiels?.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "MOYENS MATÉRIELS", margin, y, maxW);
    y = addTable(doc, ["Matériel", "Vérification", "Date contrôle", "Date fin", "Risques"],
      content.moyens_materiels.map((m: any) => [m.materiel, m.soumis_verification || "—", m.date_controle || "—", m.date_fin || "—", m.risques || "—"]),
      margin, y, maxW, [35, 25, 30, 30, 40]);
    y += 5;
  }

  // Prérequis client
  if (content.prerequis_client?.length > 0) {
    checkPageBreak(15);
    y = addSectionTitle(doc, "AVANT NOTRE INTERVENTION", margin, y, maxW);
    y = addBulletList(doc, content.prerequis_client, margin, y, maxW, checkPageBreak);
    y += 3;
  }

  // Analyse des risques
  if (content.analyse_risques?.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "IV. ANALYSE DES RISQUES", margin, y, maxW);
    y = addTable(doc, ["Situation dangereuse", "Risques", "Mesures de prévention", "Moyens de protection"],
      content.analyse_risques.map((r: any) => [r.situation_dangereuse, r.risques, r.mesures_prevention, r.moyens_protection || "—"]),
      margin, y, maxW, [40, 35, 45, 40]);
    y += 5;
  }

  // Custom sections
  const customSections = options?.customSections || [];
  for (const section of customSections) {
    checkPageBreak(20);
    y = addSectionTitle(doc, section.title.toUpperCase(), margin, y, maxW);
    y = addWrappedText(doc, section.content, margin + 2, y, maxW - 4, checkPageBreak);
    y += 5;
  }

  // Embedded images (annexes)
  const pdfImages = options?.images || [];
  if (pdfImages.length > 0) {
    checkPageBreak(20);
    y = addSectionTitle(doc, "ANNEXES — PHOTOS ET DOCUMENTS", margin, y, maxW);
    for (const img of pdfImages) {
      if (!img.url) continue;
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const imgEl = new Image();
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = reject;
          imgEl.src = dataUrl;
        });
        const ratio = imgEl.width / imgEl.height;
        const imgW = Math.min(maxW - 10, 120);
        const imgH = imgW / ratio;
        checkPageBreak(imgH + 12);
        doc.addImage(dataUrl, "JPEG", margin + 5, y, imgW, imgH);
        y += imgH + 3;
        if (img.caption) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(...GRAY);
          doc.text(img.caption, margin + 5, y);
          doc.setTextColor(...DARK);
          y += 5;
        }
      } catch {
        // Skip failed images
      }
    }
  }

  addFooter(doc, pageW, pageH);

  const fileName = `PPSPS_${devis.code || devis.id?.slice(0, 8)}.pdf`;
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const dataUri = doc.output("datauristring");
  return { blobUrl, fileName, dataUri };
};

function addFooter(doc: jsPDF, pageW: number, pageH: number) {
  doc.setFontSize(6);
  doc.setTextColor(120, 120, 120);
  doc.text("Siège social : 30, rue Marbeuf - 75008 Paris • Tél. 01 43 87 04 83 • Fax 01 39 88 80 16", pageW / 2, pageH - 10, { align: "center" });
  doc.text("Entrepôt : 12-14, rue Jean Monnet - 95190 Goussainville • Tél. 01 34 38 83 60 • Fax 01 30 11 09 82", pageW / 2, pageH - 7, { align: "center" });
  doc.text("www.artlevage.fr • contact@artlevage.fr • SARL au capital de 10 000 € - SIRET 490 553 393 00037 - APE 4941B", pageW / 2, pageH - 4, { align: "center" });
}

function addSectionTitle(doc: jsPDF, title: string, x: number, y: number, maxW: number): number {
  doc.setFillColor(...ORANGE);
  doc.rect(x, y - 4, maxW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 3, y);
  doc.setTextColor(...DARK);
  return y + 8;
}

function addSubSection(doc: jsPDF, title: string, text: string, margin: number, y: number, maxW: number, checkPageBreak: (n: number) => void): number {
  checkPageBreak(15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(title, margin + 2, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const lines = doc.splitTextToSize(text, maxW - 4);
  for (const line of lines) {
    checkPageBreak(4);
    doc.text(line, margin + 2, y); y += 3.5;
  }
  return y + 2;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxW: number, checkPageBreak: (n: number) => void): number {
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    checkPageBreak(4);
    doc.text(line, x, y); y += 3.5;
  }
  return y;
}

function addBulletList(doc: jsPDF, items: string[], margin: number, y: number, maxW: number, checkPageBreak: (n: number) => void): number {
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  for (const item of items) {
    checkPageBreak(6);
    doc.text("•", margin + 4, y);
    const lines = doc.splitTextToSize(item, maxW - 12);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) { checkPageBreak(4); }
      doc.text(lines[i], margin + 8, y);
      y += 3.5;
    }
  }
  return y;
}

function addTable(doc: jsPDF, headers: string[], rows: string[][], x: number, y: number, maxW: number, colWidths: number[]): number {
  const totalDefined = colWidths.reduce((a, b) => a + b, 0);
  const scale = maxW / totalDefined;
  const scaledWidths = colWidths.map((w) => w * scale);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const lineHeight = 3.6;
  const cellPaddingX = 1.5;
  const cellPaddingTop = 2.6;
  const cellPaddingBottom = 2.2;
  const headerPaddingTop = 2.8;
  const headerPaddingBottom = 2.2;

  const normalizeCellText = (value: string) => String(value || "—").replace(/\s*\n\s*/g, " ").trim() || "—";

  const renderHeader = (startY: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...DARK);

    const headerLines = headers.map((header, index) =>
      doc.splitTextToSize(header, Math.max(8, scaledWidths[index] - cellPaddingX * 2))
    );
    const maxHeaderLines = Math.max(...headerLines.map((lines) => Math.max(lines.length, 1)));
    const headerHeight = headerPaddingTop + maxHeaderLines * lineHeight + headerPaddingBottom;

    doc.setFillColor(...LIGHT_BG);
    doc.rect(x, startY, maxW, headerHeight, "F");

    let cx = x;
    for (let i = 0; i < headers.length; i++) {
      let ly = startY + headerPaddingTop + lineHeight - 0.8;
      for (const line of headerLines[i]) {
        doc.text(line, cx + cellPaddingX, ly);
        ly += lineHeight;
      }
      cx += scaledWidths[i];
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(x, startY + headerHeight, x + maxW, startY + headerHeight);

    return startY + headerHeight;
  };

  y = renderHeader(y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  for (const row of rows) {
    const cellLines = row.map((cell, index) =>
      doc.splitTextToSize(normalizeCellText(cell), Math.max(8, scaledWidths[index] - cellPaddingX * 2))
    );
    const maxLines = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)));
    const rowHeight = cellPaddingTop + maxLines * lineHeight + cellPaddingBottom;

    if (y + rowHeight > pageH - 25) {
      addFooter(doc, pageW, pageH);
      doc.addPage();
      y = renderHeader(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
    }

    let cx = x;
    for (let i = 0; i < cellLines.length; i++) {
      let ly = y + cellPaddingTop + lineHeight - 0.8;
      for (const line of cellLines[i]) {
        doc.text(line, cx + cellPaddingX, ly);
        ly += lineHeight;
      }
      cx += scaledWidths[i];
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(x, y + rowHeight, x + maxW, y + rowHeight);
    y += rowHeight;
  }

  return y;
}
