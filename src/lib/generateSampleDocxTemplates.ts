import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { saveAs } from "file-saver";
import { type DocumentType } from "./docxTemplateEngine";

const BRAND_COLOR = "C8501E"; // Orange brand

// Logo map matching pdfLogoHelper
const logoMap: Record<string, string> = {
  ART: "/logos/artlevage.png",
  ALT: "/logos/altigrues.png",
  ASD: "/logos/asdgm.png",
};

async function fetchLogoBuffer(shortName: string): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  const path = logoMap[shortName] || Object.entries(logoMap).find(([k]) => shortName.toUpperCase().startsWith(k))?.[1];
  if (!path) return null;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    // Get dimensions
    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });

    if (!dimensions) return null;
    return { buffer, ...dimensions };
  } catch {
    return null;
  }
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: "FFFFFF", font: "Calibri" })],
    shading: { type: ShadingType.SOLID, color: BRAND_COLOR },
    spacing: { before: 200, after: 100 },
    indent: { left: 100, right: 100 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function infoTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, varKey]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Calibri" })], spacing: { before: 40, after: 40 } })],
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: `{{${varKey}}}`, size: 20, font: "Calibri", color: "0070C0" })], spacing: { before: 40, after: 40 } })],
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
          ],
        })
    ),
  });
}

function buildHeaderChildren(logo: { buffer: ArrayBuffer; width: number; height: number } | null): Paragraph[] {
  const maxH = 50; // ~50px tall in header
  const children: (TextRun | ImageRun)[] = [];

  if (logo) {
    const ratio = logo.width / logo.height;
    const h = maxH;
    const w = Math.round(h * ratio);
    children.push(
      new ImageRun({
        data: logo.buffer,
        transformation: { width: w, height: h },
        type: "png",
      })
    );
  }

  return [
    new Paragraph({
      children: logo ? children : [new TextRun({ text: "{{company_name}}", bold: true, size: 28, color: BRAND_COLOR, font: "Calibri" })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "{{company_name}}  |  {{company_phone}}  |  {{company_email}}", size: 16, color: "666666", font: "Calibri" }),
      ],
      spacing: { after: 80 },
    }),
  ];
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "{{company_name}} — SIRET {{company_siret}} — {{company_address}}", size: 16, color: "999999", font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", size: 16, color: "999999", font: "Calibri" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999", font: "Calibri" }),
        ],
      }),
    ],
  });
}

// ── Devis template ──
function buildDevisDoc(logo: { buffer: ArrayBuffer; width: number; height: number } | null): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: buildHeaderChildren(logo) }) },
      footers: { default: buildFooter() },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "DEVIS N° {{devis_code}}", bold: true, size: 36, color: BRAND_COLOR, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        sectionTitle("CLIENT"),
        infoTable([
          ["Client", "client_name"], ["Code", "client_code"], ["Contact", "client_contact"],
          ["Adresse", "client_address"], ["Code postal", "client_postal_code"],
          ["Ville", "client_city"], ["Email", "client_email"],
        ]),
        spacer(),
        sectionTitle("INFORMATIONS DU DEVIS"),
        infoTable([
          ["Date", "devis_date"], ["Validité", "devis_valid_until"], ["Objet", "devis_objet"],
          ["Dossier", "dossier_title"], ["Adresse chantier", "dossier_address"],
        ]),
        spacer(),
        sectionTitle("MONTANTS"),
        infoTable([["Total HT", "total_ht"], ["TVA (20%)", "tva_amount"], ["Total TTC", "total_ttc"], ["Conditions", "payment_terms"]]),
        spacer(),
        sectionTitle("NOTES"),
        new Paragraph({ children: [new TextRun({ text: "{{devis_notes}}", size: 20, font: "Calibri", italics: true })], spacing: { before: 100 } }),
      ],
    }],
  });
}

// ── Facture template ──
function buildFactureDoc(logo: { buffer: ArrayBuffer; width: number; height: number } | null): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: buildHeaderChildren(logo) }) },
      footers: { default: buildFooter() },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "FACTURE N° {{facture_code}}", bold: true, size: 36, color: BRAND_COLOR, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        sectionTitle("CLIENT"),
        infoTable([
          ["Client", "client_name"], ["Code", "client_code"], ["Contact", "client_contact"],
          ["Adresse", "client_address"], ["Code postal", "client_postal_code"], ["Ville", "client_city"],
        ]),
        spacer(),
        sectionTitle("DÉTAILS DE LA FACTURE"),
        infoTable([
          ["Date", "facture_date"], ["Échéance", "facture_due_date"],
          ["Devis associé", "devis_code"], ["Dossier", "dossier_code"], ["Conditions", "payment_terms"],
        ]),
        spacer(),
        sectionTitle("MONTANTS"),
        infoTable([["Total HT", "total_ht"], ["TVA (20%)", "tva_amount"], ["Total TTC", "total_ttc"], ["Payé", "paid_amount"], ["Reste dû", "reste_du"]]),
        spacer(),
        sectionTitle("NOTES"),
        new Paragraph({ children: [new TextRun({ text: "{{facture_notes}}", size: 20, font: "Calibri", italics: true })], spacing: { before: 100 } }),
      ],
    }],
  });
}

// ── Visite template ──
function buildVisiteDoc(logo: { buffer: ArrayBuffer; width: number; height: number } | null): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: buildHeaderChildren(logo) }) },
      footers: { default: buildFooter() },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "RAPPORT DE VISITE TECHNIQUE", bold: true, size: 36, color: BRAND_COLOR, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "N° {{visite_code}}", bold: true, size: 28, color: "333333", font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        sectionTitle("INFORMATIONS GÉNÉRALES"),
        infoTable([["Titre", "visite_title"], ["Date", "visite_date"], ["Type", "visite_type"], ["Conseiller", "visite_advisor"], ["Adresse", "visite_address"]]),
        spacer(),
        sectionTitle("CLIENT"),
        infoTable([["Client", "client_name"], ["Adresse", "client_address"], ["Ville", "client_city"]]),
        spacer(),
        sectionTitle("DONNÉES TECHNIQUES"),
        infoTable([["Volume", "visite_volume"], ["Distance", "visite_distance"]]),
        spacer(),
        sectionTitle("INSTRUCTIONS"),
        new Paragraph({ children: [new TextRun({ text: "{{visite_instructions}}", size: 20, font: "Calibri", italics: true })], spacing: { before: 100 } }),
      ],
    }],
  });
}

// ── BT Report template ──
function buildBTReportDoc(logo: { buffer: ArrayBuffer; width: number; height: number } | null): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      headers: { default: new Header({ children: buildHeaderChildren(logo) }) },
      footers: { default: buildFooter() },
      children: [
        new Paragraph({
          children: [new TextRun({ text: "BON DE TRANSPORT", bold: true, size: 36, color: BRAND_COLOR, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "N° {{bt_number}} — Opération {{bt_operation_number}}", bold: true, size: 28, color: "333333", font: "Calibri" })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        sectionTitle("DOSSIER"),
        infoTable([["N° Dossier", "dossier_code"], ["Titre", "dossier_title"], ["Type", "bt_type"], ["Date", "bt_date"]]),
        spacer(),
        sectionTitle("CLIENT"),
        infoTable([["Client", "client_name"], ["Adresse", "client_address"]]),
        spacer(),
        sectionTitle("CHARGEMENT"),
        infoTable([["Adresse", "loading_address"], ["Ville", "loading_city"]]),
        spacer(),
        sectionTitle("LIVRAISON"),
        infoTable([["Adresse", "delivery_address"], ["Ville", "delivery_city"]]),
        spacer(),
        sectionTitle("INFORMATIONS COMPLÉMENTAIRES"),
        infoTable([["Volume", "volume"]]),
        spacer(),
        sectionTitle("NOTES"),
        new Paragraph({ children: [new TextRun({ text: "{{bt_notes}}", size: 20, font: "Calibri", italics: true })], spacing: { before: 100 } }),
      ],
    }],
  });
}

type LogoData = { buffer: ArrayBuffer; width: number; height: number } | null;
type DocBuilder = (logo: LogoData) => Document;

const DOC_BUILDERS: Record<DocumentType, DocBuilder> = {
  devis: buildDevisDoc,
  facture: buildFactureDoc,
  visite: buildVisiteDoc,
  bt_report: buildBTReportDoc,
};

const DOC_FILENAMES: Record<DocumentType, string> = {
  devis: "Modèle_Devis.docx",
  facture: "Modèle_Facture.docx",
  bt_report: "Modèle_BT.docx",
  visite: "Modèle_Visite.docx",
};

export async function downloadSampleTemplate(docType: DocumentType, companyShortName?: string): Promise<void> {
  const logo = companyShortName ? await fetchLogoBuffer(companyShortName) : null;
  const doc = DOC_BUILDERS[docType](logo);
  const blob = await Packer.toBlob(doc);
  const suffix = companyShortName ? `_${companyShortName}` : "";
  saveAs(blob, DOC_FILENAMES[docType].replace(".docx", `${suffix}.docx`));
}

export async function generateSampleTemplateBlob(docType: DocumentType, companyShortName?: string): Promise<{ blob: Blob; fileName: string }> {
  const logo = companyShortName ? await fetchLogoBuffer(companyShortName) : null;
  const doc = DOC_BUILDERS[docType](logo);
  const blob = await Packer.toBlob(doc);
  const suffix = companyShortName ? `_${companyShortName}` : "";
  return { blob, fileName: DOC_FILENAMES[docType].replace(".docx", `${suffix}.docx`) };
}
