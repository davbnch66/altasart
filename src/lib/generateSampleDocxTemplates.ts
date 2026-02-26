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
  HeightRule,
  VerticalAlign,
  TabStopType,
  TabStopPosition,
  convertMillimetersToTwip,
} from "docx";
import { saveAs } from "file-saver";
import { type DocumentType } from "./docxTemplateEngine";

// ── Brand palette ──
const BRAND = {
  primary: "C8501E",       // Orange principal
  primaryDark: "A03D15",   // Orange foncé
  dark: "1A1A2E",          // Bleu-noir profond
  gray: "4A4A4A",          // Gris texte
  grayLight: "6B7280",     // Gris secondaire
  grayBorder: "D1D5DB",    // Gris bordures
  grayBg: "F3F4F6",        // Gris fond
  white: "FFFFFF",
  accent: "E8E0D8",        // Beige subtil
};

const FONT = { heading: "Arial", body: "Calibri" };

// ── Logo ──
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

// ── Helpers ──
const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER };
const THIN_BOTTOM = { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder } };

function emptyPara(after = 60): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}

function accentBar(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: 80, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BRAND.primary },
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({ text: "━━  ", color: BRAND.primary, size: 22, font: FONT.body }),
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: BRAND.dark, font: FONT.heading }),
    ],
  });
}

function labelValue(label: string, variable: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: THIN_BOTTOM,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: label, bold: true, size: 18, color: BRAND.grayLight, font: FONT.body })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: THIN_BOTTOM,
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: `{{${variable}}}`, size: 18, color: BRAND.dark, font: FONT.body })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function twoColumnInfo(leftRows: [string, string][], rightRows: [string, string][]): Table {
  const buildCell = (rows: [string, string][], addLeftPad = false): TableCell => {
    const content: Paragraph[] = [];
    rows.forEach(([label, variable]) => {
      content.push(
        new Paragraph({
          spacing: { before: 20, after: 20 },
          indent: addLeftPad ? { left: 200 } : undefined,
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 18, color: BRAND.grayLight, font: FONT.body }),
            new TextRun({ text: `{{${variable}}}`, size: 18, color: BRAND.dark, font: FONT.body }),
          ],
        })
      );
    });
    return new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      verticalAlign: VerticalAlign.TOP,
      children: content,
    });
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [buildCell(leftRows), buildCell(rightRows, true)],
      }),
    ],
  });
}

// ── Header professionnel avec logo + infos société ──
function buildProHeader(logo: LogoData): Header {
  const logoChildren: (TextRun | ImageRun)[] = [];
  if (logo) {
    const ratio = logo.width / logo.height;
    const h = 55;
    const w = Math.round(h * ratio);
    logoChildren.push(
      new ImageRun({ data: logo.buffer, transformation: { width: w, height: h }, type: "png" })
    );
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // Logo à gauche
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              logo
                ? new Paragraph({ children: logoChildren })
                : new Paragraph({
                    children: [new TextRun({ text: "{{company_name}}", bold: true, size: 32, color: BRAND.primary, font: FONT.heading })],
                  }),
            ],
          }),
          // Infos société à droite
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "{{company_name}}", bold: true, size: 20, color: BRAND.dark, font: FONT.heading })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 20 },
                children: [new TextRun({ text: "{{company_address}}", size: 16, color: BRAND.grayLight, font: FONT.body })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "Tél: {{company_phone}} — {{company_email}}", size: 16, color: BRAND.grayLight, font: FONT.body })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "SIRET: {{company_siret}}", size: 14, color: BRAND.grayLight, font: FONT.body })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Header({ children: [headerTable, emptyPara(20)] });
}

// ── Footer professionnel ──
function buildProFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [
          new TextRun({ text: "──────────────────────────────────────────────────────────────", size: 12, color: BRAND.grayBorder, font: FONT.body }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "{{company_name}} — SAS au capital de {{company_capital}} — SIRET {{company_siret}} — TVA {{company_tva_intra}}", size: 14, color: BRAND.grayLight, font: FONT.body }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "{{company_address}} — Tél: {{company_phone}} — {{company_email}}", size: 14, color: BRAND.grayLight, font: FONT.body }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [
          new TextRun({ text: "Page ", size: 14, color: BRAND.grayLight, font: FONT.body }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: BRAND.grayLight, font: FONT.body }),
        ],
      }),
    ],
  });
}

// ── Document title block ──
function docTitleBlock(title: string, codeVar: string, dateLabel: string, dateVar: string): (Paragraph | Table)[] {
  return [
    emptyPara(200),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: title, bold: true, size: 40, color: BRAND.primary, font: FONT.heading })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `N° {{${codeVar}}}`, bold: true, size: 26, color: BRAND.dark, font: FONT.heading })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `${dateLabel}: {{${dateVar}}}`, size: 20, color: BRAND.grayLight, font: FONT.body })],
    }),
    accentBar(),
    emptyPara(100),
  ];
}

// ── Client block (style encadré) ──
function clientBlock(rows: [string, string][]): Table {
  const content: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: "DESTINATAIRE", bold: true, size: 16, color: BRAND.primary, font: FONT.heading })],
    }),
  ];
  rows.forEach(([label, variable]) => {
    content.push(
      new Paragraph({
        spacing: { before: 15, after: 15 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 18, color: BRAND.gray, font: FONT.body }),
          new TextRun({ text: `{{${variable}}}`, size: 18, color: BRAND.dark, font: FONT.body }),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // Spacer gauche
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })],
          }),
          // Bloc client à droite
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: BRAND.primary },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
              left: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
              right: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
            },
            shading: { type: ShadingType.SOLID, color: BRAND.grayBg },
            children: content,
          }),
        ],
      }),
    ],
  });
}

// ── Ligne items table (devis/facture) ──
function lineItemsTable(): Table {
  const headerCellStyle = (text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.SOLID, color: BRAND.dark },
      borders: NO_BORDERS,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: align,
          spacing: { before: 50, after: 50 },
          children: [new TextRun({ text, bold: true, size: 18, color: BRAND.white, font: FONT.heading })],
        }),
      ],
    });

  const dataCell = (text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: THIN_BOTTOM,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: align,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text, size: 18, color: BRAND.dark, font: FONT.body })],
        }),
      ],
    });

  const exampleRows = [
    ["{{line_description_1}}", "{{line_qty_1}}", "{{line_unit_1}}", "{{line_unit_price_1}}", "{{line_total_1}}"],
    ["{{line_description_2}}", "{{line_qty_2}}", "{{line_unit_2}}", "{{line_unit_price_2}}", "{{line_total_2}}"],
    ["{{line_description_3}}", "{{line_qty_3}}", "{{line_unit_3}}", "{{line_unit_price_3}}", "{{line_total_3}}"],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          headerCellStyle("  Désignation", 40),
          headerCellStyle("Qté", 12, AlignmentType.CENTER),
          headerCellStyle("Unité", 12, AlignmentType.CENTER),
          headerCellStyle("P.U. HT", 18, AlignmentType.RIGHT),
          headerCellStyle("Total HT  ", 18, AlignmentType.RIGHT),
        ],
      }),
      // Data rows
      ...exampleRows.map(
        ([desc, qty, unit, pu, total]) =>
          new TableRow({
            children: [
              dataCell(`  ${desc}`, 40),
              dataCell(qty, 12, AlignmentType.CENTER),
              dataCell(unit, 12, AlignmentType.CENTER),
              dataCell(pu, 18, AlignmentType.RIGHT),
              dataCell(`${total}  `, 18, AlignmentType.RIGHT),
            ],
          })
      ),
    ],
  });
}

// ── Totaux ──
function totalsBlock(): Table {
  const row = (label: string, variable: string, isBold = false, highlight = false) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          borders: NO_BORDERS,
          children: [new Paragraph({ children: [] })],
        }),
        new TableCell({
          width: { size: 17, type: WidthType.PERCENTAGE },
          borders: THIN_BOTTOM,
          shading: highlight ? { type: ShadingType.SOLID, color: BRAND.primary } : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: label,
                  bold: isBold,
                  size: isBold ? 22 : 18,
                  color: highlight ? BRAND.white : BRAND.gray,
                  font: FONT.body,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          borders: THIN_BOTTOM,
          shading: highlight ? { type: ShadingType.SOLID, color: BRAND.primary } : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: `{{${variable}}}  `,
                  bold: isBold,
                  size: isBold ? 22 : 18,
                  color: highlight ? BRAND.white : BRAND.dark,
                  font: FONT.body,
                }),
              ],
            }),
          ],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row("Total HT", "total_ht"),
      row("TVA (20%)", "tva_amount"),
      row("TOTAL TTC", "total_ttc", true, true),
    ],
  });
}

// ── Signature block ──
function signatureBlock(): Table {
  const sigCell = (title: string) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
        left: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
        right: { style: BorderStyle.SINGLE, size: 1, color: BRAND.grayBorder },
      },
      children: [
        new Paragraph({
          spacing: { before: 40, after: 20 },
          children: [new TextRun({ text: title, bold: true, size: 18, color: BRAND.dark, font: FONT.heading })],
        }),
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({ text: "Date:", size: 16, color: BRAND.grayLight, font: FONT.body })],
        }),
        emptyPara(20),
        emptyPara(20),
        emptyPara(20),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: 'Mention "Bon pour accord" + Signature', size: 14, color: BRAND.grayLight, font: FONT.body, italics: true })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [sigCell("Signature de l'entreprise"), sigCell("Signature du client")],
      }),
    ],
  });
}

// ── Conditions / Notes block ──
function conditionsBlock(variable: string, title = "CONDITIONS & NOTES"): (Paragraph | Table)[] {
  return [
    sectionHeading(title),
    new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: `{{${variable}}}`, size: 18, color: BRAND.gray, font: FONT.body, italics: true })],
    }),
  ];
}

// ── RIB / Bank block ──
function bankBlock(): (Paragraph | Table)[] {
  return [
    sectionHeading("COORDONNÉES BANCAIRES"),
    twoColumnInfo(
      [["Banque", "bank_name"], ["IBAN", "bank_iban"]],
      [["BIC", "bank_bic"], ["Titulaire", "bank_holder"]]
    ),
  ];
}

// ══════════════════════════════════════════════════
//  DEVIS — Template professionnel
// ══════════════════════════════════════════════════
function buildDevisDoc(logo: LogoData): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 800, right: 800, bottom: 800, left: 800 } } },
      headers: { default: buildProHeader(logo) },
      footers: { default: buildProFooter() },
      children: [
        ...docTitleBlock("DEVIS", "devis_code", "Date d'émission", "devis_date"),
        clientBlock([
          ["Client", "client_name"],
          ["Contact", "client_contact"],
          ["Adresse", "client_address"],
          ["CP / Ville", "client_postal_code"],
          ["Email", "client_email"],
          ["Tél", "client_phone"],
        ]),
        emptyPara(120),

        sectionHeading("OBJET"),
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: "{{devis_objet}}", size: 20, color: BRAND.dark, font: FONT.body, bold: true })],
        }),
        twoColumnInfo(
          [["Dossier", "dossier_title"], ["Adresse chantier", "dossier_address"]],
          [["Validité", "devis_valid_until"], ["Réf. dossier", "dossier_code"]]
        ),
        emptyPara(120),

        sectionHeading("PRESTATIONS"),
        lineItemsTable(),
        emptyPara(60),
        totalsBlock(),
        emptyPara(200),

        ...conditionsBlock("devis_notes", "CONDITIONS GÉNÉRALES"),
        new Paragraph({
          spacing: { before: 40, after: 200 },
          children: [
            new TextRun({ text: "• Validité de l'offre : {{devis_valid_until}}", size: 16, color: BRAND.grayLight, font: FONT.body }),
          ],
        }),

        sectionHeading("ACCEPTATION"),
        signatureBlock(),
      ],
    }],
  });
}

// ══════════════════════════════════════════════════
//  FACTURE — Template professionnel
// ══════════════════════════════════════════════════
function buildFactureDoc(logo: LogoData): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 800, right: 800, bottom: 800, left: 800 } } },
      headers: { default: buildProHeader(logo) },
      footers: { default: buildProFooter() },
      children: [
        ...docTitleBlock("FACTURE", "facture_code", "Date de facturation", "facture_date"),
        clientBlock([
          ["Client", "client_name"],
          ["Code client", "client_code"],
          ["Adresse", "client_address"],
          ["CP / Ville", "client_postal_code"],
          ["N° TVA intra", "client_tva_intra"],
        ]),
        emptyPara(120),

        twoColumnInfo(
          [["Devis associé", "devis_code"], ["Dossier", "dossier_code"]],
          [["Échéance", "facture_due_date"], ["Mode de règlement", "payment_method"]]
        ),
        emptyPara(120),

        sectionHeading("DÉTAIL DES PRESTATIONS"),
        lineItemsTable(),
        emptyPara(60),

        // Totaux avec ligne payé/restant
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            ...[
              ["Total HT", "total_ht", false, false],
              ["TVA (20%)", "tva_amount", false, false],
              ["TOTAL TTC", "total_ttc", true, true],
              ["Déjà réglé", "paid_amount", false, false],
              ["RESTE DÛ", "reste_du", true, false],
            ].map(([label, variable, isBold, highlight]) =>
              new TableRow({
                children: [
                  new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [new Paragraph({ children: [] })] }),
                  new TableCell({
                    width: { size: 17, type: WidthType.PERCENTAGE },
                    borders: THIN_BOTTOM,
                    shading: highlight ? { type: ShadingType.SOLID, color: BRAND.primary } : undefined,
                    children: [new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { before: 40, after: 40 },
                      children: [new TextRun({ text: label as string, bold: isBold as boolean, size: (isBold ? 22 : 18), color: (highlight ? BRAND.white : BRAND.gray), font: FONT.body })],
                    })],
                  }),
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    borders: THIN_BOTTOM,
                    shading: highlight ? { type: ShadingType.SOLID, color: BRAND.primary } : undefined,
                    children: [new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { before: 40, after: 40 },
                      children: [new TextRun({ text: `{{${variable as string}}}  `, bold: isBold as boolean, size: (isBold ? 22 : 18), color: (highlight ? BRAND.white : BRAND.dark), font: FONT.body })],
                    })],
                  }),
                ],
              })
            ),
          ],
        }),
        emptyPara(150),

        ...bankBlock(),
        emptyPara(100),
        ...conditionsBlock("facture_notes", "MENTIONS & NOTES"),
        new Paragraph({
          spacing: { before: 40 },
          children: [new TextRun({ text: "En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée. Indemnité forfaitaire de recouvrement : 40 €.", size: 14, color: BRAND.grayLight, font: FONT.body, italics: true })],
        }),
      ],
    }],
  });
}

// ══════════════════════════════════════════════════
//  VISITE TECHNIQUE — Template professionnel
// ══════════════════════════════════════════════════
function buildVisiteDoc(logo: LogoData): Document {
  return new Document({
    sections: [{
      properties: { page: { margin: { top: 800, right: 800, bottom: 800, left: 800 } } },
      headers: { default: buildProHeader(logo) },
      footers: { default: buildProFooter() },
      children: [
        ...docTitleBlock("RAPPORT DE VISITE TECHNIQUE", "visite_code", "Date de visite", "visite_date"),
        clientBlock([
          ["Client", "client_name"],
          ["Contact", "client_contact"],
          ["Adresse", "client_address"],
          ["Ville", "client_city"],
        ]),
        emptyPara(120),

        sectionHeading("INFORMATIONS GÉNÉRALES"),
        twoColumnInfo(
          [["Type de visite", "visite_type"], ["Conseiller technique", "visite_advisor"]],
          [["Adresse du site", "visite_address"], ["Accès", "visite_access"]]
        ),
        emptyPara(100),

        sectionHeading("DONNÉES TECHNIQUES"),
        twoColumnInfo(
          [["Volume estimé", "visite_volume"], ["Poids estimé", "visite_weight"]],
          [["Distance", "visite_distance"], ["Nombre d'étages", "visite_floors"]]
        ),
        emptyPara(100),

        sectionHeading("CONTRAINTES & ACCÈS"),
        new Paragraph({
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "{{visite_constraints}}", size: 18, color: BRAND.dark, font: FONT.body })],
        }),
        emptyPara(60),

        sectionHeading("MATÉRIEL NÉCESSAIRE"),
        new Paragraph({
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "{{visite_materiel}}", size: 18, color: BRAND.dark, font: FONT.body })],
        }),
        emptyPara(60),

        sectionHeading("INSTRUCTIONS & OBSERVATIONS"),
        new Paragraph({
          spacing: { before: 40, after: 100 },
          children: [new TextRun({ text: "{{visite_instructions}}", size: 18, color: BRAND.gray, font: FONT.body })],
        }),

        sectionHeading("MÉTHODOLOGIE"),
        new Paragraph({
          spacing: { before: 40, after: 100 },
          children: [new TextRun({ text: "{{visite_methodology}}", size: 18, color: BRAND.gray, font: FONT.body })],
        }),

        sectionHeading("PHOTOS DU SITE"),
        new Paragraph({
          spacing: { before: 40, after: 100 },
          children: [new TextRun({ text: "[Emplacement photos — Insérer les photos du site ici]", size: 16, color: BRAND.grayLight, font: FONT.body, italics: true })],
        }),
      ],
    }],
  });
}

// ══════════════════════════════════════════════════
//  BON DE TRANSPORT — Template professionnel
// ══════════════════════════════════════════════════
function buildBTReportDoc(logo: LogoData): Document {
  const addressBlock = (title: string, prefix: string): (Paragraph | Table)[] => [
    new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({ text: `▸ ${title}`, bold: true, size: 20, color: BRAND.primary, font: FONT.heading }),
      ],
    }),
    twoColumnInfo(
      [["Adresse", `${prefix}_address`], ["Ville", `${prefix}_city`], ["Code postal", `${prefix}_postal_code`]],
      [["Étage", `${prefix}_floor`], ["Accès", `${prefix}_access`], ["Ascenseur", `${prefix}_elevator`]]
    ),
    new Paragraph({
      spacing: { before: 20, after: 40 },
      children: [
        new TextRun({ text: "Observations: ", bold: true, size: 16, color: BRAND.grayLight, font: FONT.body }),
        new TextRun({ text: `{{${prefix}_comments}}`, size: 16, color: BRAND.gray, font: FONT.body, italics: true }),
      ],
    }),
  ];

  return new Document({
    sections: [{
      properties: { page: { margin: { top: 800, right: 800, bottom: 800, left: 800 } } },
      headers: { default: buildProHeader(logo) },
      footers: { default: buildProFooter() },
      children: [
        ...docTitleBlock("BON DE TRANSPORT", "bt_number", "Date de l'opération", "bt_date"),
        twoColumnInfo(
          [["N° Dossier", "dossier_code"], ["Titre", "dossier_title"]],
          [["Type", "bt_type"], ["N° Opération", "bt_operation_number"]]
        ),
        emptyPara(80),

        clientBlock([
          ["Client", "client_name"],
          ["Adresse", "client_address"],
          ["Tél", "client_phone"],
        ]),
        emptyPara(120),

        sectionHeading("CHARGEMENT & LIVRAISON"),
        ...addressBlock("CHARGEMENT", "loading"),
        emptyPara(40),
        ...addressBlock("LIVRAISON", "delivery"),
        emptyPara(100),

        sectionHeading("DÉTAILS OPÉRATION"),
        twoColumnInfo(
          [["Volume", "volume"], ["Poids", "weight"]],
          [["Équipe assignée", "assigned_team"], ["Véhicules", "vehicles"]]
        ),
        emptyPara(80),

        sectionHeading("INSTRUCTIONS"),
        new Paragraph({
          spacing: { before: 40, after: 100 },
          children: [new TextRun({ text: "{{bt_instructions}}", size: 18, color: BRAND.gray, font: FONT.body })],
        }),

        sectionHeading("NOTES"),
        new Paragraph({
          spacing: { before: 40, after: 150 },
          children: [new TextRun({ text: "{{bt_notes}}", size: 18, color: BRAND.gray, font: FONT.body, italics: true })],
        }),

        sectionHeading("SIGNATURES"),
        signatureBlock(),
      ],
    }],
  });
}

// ── Export ──
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
