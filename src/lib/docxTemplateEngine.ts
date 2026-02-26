import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ── Variable definitions per document type ──

export const DOCUMENT_TYPES = [
  { value: "devis", label: "Devis" },
  { value: "facture", label: "Facture" },
  { value: "visite", label: "Rapport de visite" },
  { value: "bt_report", label: "Rapport BT" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: Record<DocumentType, TemplateVariable[]> = {
  devis: [
    { key: "devis_code", label: "N° du devis", example: "DEV-2026-001" },
    { key: "devis_objet", label: "Objet du devis", example: "Levage grue mobile" },
    { key: "devis_date", label: "Date de création", example: "26/02/2026" },
    { key: "devis_valid_until", label: "Date de validité", example: "28/03/2026" },
    { key: "devis_notes", label: "Notes", example: "Conditions spéciales..." },
    { key: "client_name", label: "Nom du client", example: "ACME SAS" },
    { key: "client_code", label: "Code client", example: "CLI-001" },
    { key: "client_address", label: "Adresse client", example: "1 rue de la Paix" },
    { key: "client_city", label: "Ville client", example: "Paris" },
    { key: "client_postal_code", label: "Code postal client", example: "75001" },
    { key: "client_contact", label: "Contact client", example: "M. Dupont" },
    { key: "client_email", label: "Email client", example: "contact@acme.fr" },
    { key: "company_name", label: "Nom de la société", example: "Art Levage" },
    { key: "company_address", label: "Adresse société", example: "10 rue du Port" },
    { key: "company_phone", label: "Tél. société", example: "01 23 45 67 89" },
    { key: "company_email", label: "Email société", example: "contact@artlevage.fr" },
    { key: "company_siret", label: "SIRET", example: "12345678900000" },
    { key: "total_ht", label: "Total HT", example: "1 500,00" },
    { key: "tva_amount", label: "Montant TVA", example: "300,00" },
    { key: "total_ttc", label: "Total TTC", example: "1 800,00" },
    { key: "payment_terms", label: "Conditions de paiement", example: "30 jours" },
    { key: "dossier_title", label: "Titre du dossier", example: "Chantier Tour Eiffel" },
    { key: "dossier_address", label: "Adresse du chantier", example: "5 av Anatole France" },
  ],
  facture: [
    { key: "facture_code", label: "N° de facture", example: "FAC-2026-001" },
    { key: "facture_date", label: "Date de facturation", example: "26/02/2026" },
    { key: "facture_due_date", label: "Date d'échéance", example: "28/03/2026" },
    { key: "facture_notes", label: "Notes", example: "..." },
    { key: "client_name", label: "Nom du client", example: "ACME SAS" },
    { key: "client_code", label: "Code client", example: "CLI-001" },
    { key: "client_address", label: "Adresse client", example: "1 rue de la Paix" },
    { key: "client_city", label: "Ville client", example: "Paris" },
    { key: "client_postal_code", label: "Code postal client", example: "75001" },
    { key: "client_contact", label: "Contact client", example: "M. Dupont" },
    { key: "company_name", label: "Nom de la société", example: "Art Levage" },
    { key: "company_address", label: "Adresse société", example: "10 rue du Port" },
    { key: "company_phone", label: "Tél. société", example: "01 23 45 67 89" },
    { key: "company_email", label: "Email société", example: "contact@artlevage.fr" },
    { key: "company_siret", label: "SIRET", example: "12345678900000" },
    { key: "total_ht", label: "Total HT", example: "1 500,00" },
    { key: "tva_amount", label: "Montant TVA", example: "300,00" },
    { key: "total_ttc", label: "Total TTC", example: "1 800,00" },
    { key: "paid_amount", label: "Montant payé", example: "500,00" },
    { key: "reste_du", label: "Reste dû", example: "1 300,00" },
    { key: "payment_terms", label: "Conditions de paiement", example: "30 jours" },
    { key: "devis_code", label: "N° du devis lié", example: "DEV-2026-001" },
    { key: "dossier_code", label: "N° du dossier", example: "DOS-2026-001" },
  ],
  visite: [
    { key: "visite_code", label: "N° de visite", example: "VIS-2026-001" },
    { key: "visite_title", label: "Titre", example: "Visite technique chantier" },
    { key: "visite_date", label: "Date", example: "26/02/2026" },
    { key: "visite_address", label: "Adresse", example: "5 av Anatole France" },
    { key: "visite_type", label: "Type de visite", example: "Technique" },
    { key: "visite_advisor", label: "Conseiller", example: "J. Martin" },
    { key: "visite_volume", label: "Volume", example: "12 m³" },
    { key: "visite_distance", label: "Distance", example: "25 km" },
    { key: "visite_instructions", label: "Instructions", example: "..." },
    { key: "client_name", label: "Nom du client", example: "ACME SAS" },
    { key: "client_address", label: "Adresse client", example: "1 rue de la Paix" },
    { key: "client_city", label: "Ville client", example: "Paris" },
    { key: "company_name", label: "Nom de la société", example: "Art Levage" },
    { key: "company_address", label: "Adresse société", example: "10 rue du Port" },
    { key: "company_phone", label: "Tél. société", example: "01 23 45 67 89" },
    { key: "company_siret", label: "SIRET", example: "12345678900000" },
  ],
  bt_report: [
    { key: "bt_number", label: "N° BT", example: "BT-001" },
    { key: "bt_type", label: "Type d'opération", example: "B.T." },
    { key: "bt_operation_number", label: "N° opération", example: "1" },
    { key: "bt_date", label: "Date", example: "26/02/2026" },
    { key: "bt_notes", label: "Notes", example: "..." },
    { key: "loading_address", label: "Adresse chargement", example: "10 rue du Port" },
    { key: "loading_city", label: "Ville chargement", example: "Paris" },
    { key: "delivery_address", label: "Adresse livraison", example: "5 av Anatole France" },
    { key: "delivery_city", label: "Ville livraison", example: "Paris" },
    { key: "volume", label: "Volume", example: "12 m³" },
    { key: "client_name", label: "Nom du client", example: "ACME SAS" },
    { key: "client_address", label: "Adresse client", example: "1 rue de la Paix" },
    { key: "company_name", label: "Nom de la société", example: "Art Levage" },
    { key: "company_address", label: "Adresse société", example: "10 rue du Port" },
    { key: "company_phone", label: "Tél. société", example: "01 23 45 67 89" },
    { key: "company_siret", label: "SIRET", example: "12345678900000" },
    { key: "dossier_code", label: "N° dossier", example: "DOS-2026-001" },
    { key: "dossier_title", label: "Titre dossier", example: "Chantier X" },
  ],
};

// ── Format helpers ──

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy", { locale: fr });
  } catch {
    return d;
  }
}

// ── Data fetchers per type ──

async function fetchDevisData(devisId: string): Promise<Record<string, string>> {
  const { data: devis } = await supabase
    .from("devis")
    .select("*, clients(name, code, address, city, postal_code, email, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", devisId)
    .single();

  if (!devis) throw new Error("Devis introuvable");

  const { data: lines } = await supabase
    .from("devis_lines")
    .select("*")
    .eq("devis_id", devisId)
    .order("sort_order");

  const devisLines = lines ?? [];
  const client = devis.clients as any;
  const company = devis.companies as any;
  const amount = devisLines.length > 0
    ? devisLines.reduce((sum: number, l: any) => sum + (l.total != null ? Number(l.total) : Number(l.quantity) * Number(l.unit_price)), 0)
    : Number(devis.amount);
  const tvaAmount = amount * 0.2;
  const totalTTC = amount + tvaAmount;

  let dossierTitle = "", dossierAddress = "";
  if (devis.dossier_id) {
    const { data: d } = await supabase.from("dossiers").select("title, address").eq("id", devis.dossier_id).single();
    if (d) { dossierTitle = d.title || ""; dossierAddress = d.address || ""; }
  }

  return {
    devis_code: devis.code || "---",
    devis_objet: devis.objet || "",
    devis_date: fmtDate(devis.created_at),
    devis_valid_until: fmtDate(devis.valid_until),
    devis_notes: devis.notes || "",
    client_name: client?.name || "",
    client_code: client?.code || "",
    client_address: client?.address || "",
    client_city: client?.city || "",
    client_postal_code: client?.postal_code || "",
    client_contact: client?.contact_name || "",
    client_email: client?.email || "",
    company_name: company?.name || "",
    company_address: company?.address || "",
    company_phone: company?.phone || "",
    company_email: company?.email || "",
    company_siret: company?.siret || "",
    total_ht: fmtEur(amount),
    tva_amount: fmtEur(tvaAmount),
    total_ttc: fmtEur(totalTTC),
    payment_terms: client?.payment_terms || "30 jours",
    dossier_title: dossierTitle,
    dossier_address: dossierAddress,
  };
}

async function fetchFactureData(factureId: string): Promise<Record<string, string>> {
  const { data: facture } = await supabase
    .from("factures")
    .select("*, clients(name, code, address, city, postal_code, email, contact_name, payment_terms), companies(name, short_name, address, phone, email, siret)")
    .eq("id", factureId)
    .single();

  if (!facture) throw new Error("Facture introuvable");

  const client = facture.clients as any;
  const company = facture.companies as any;
  const amount = Number(facture.amount);
  const tvaAmount = amount * 0.2;
  const totalTTC = amount + tvaAmount;
  const paidAmount = Number(facture.paid_amount);

  let devisCode = "", dossierCode = "";
  if (facture.devis_id) {
    const { data: d } = await supabase.from("devis").select("code").eq("id", facture.devis_id).single();
    if (d) devisCode = d.code || "";
  }
  if (facture.dossier_id) {
    const { data: d } = await supabase.from("dossiers").select("code").eq("id", facture.dossier_id).single();
    if (d) dossierCode = d.code || "";
  }

  return {
    facture_code: facture.code || "---",
    facture_date: fmtDate(facture.created_at),
    facture_due_date: fmtDate(facture.due_date),
    facture_notes: facture.notes || "",
    client_name: client?.name || "",
    client_code: client?.code || "",
    client_address: client?.address || "",
    client_city: client?.city || "",
    client_postal_code: client?.postal_code || "",
    client_contact: client?.contact_name || "",
    company_name: company?.name || "",
    company_address: company?.address || "",
    company_phone: company?.phone || "",
    company_email: company?.email || "",
    company_siret: company?.siret || "",
    total_ht: fmtEur(amount),
    tva_amount: fmtEur(tvaAmount),
    total_ttc: fmtEur(totalTTC),
    paid_amount: fmtEur(paidAmount),
    reste_du: fmtEur(totalTTC - paidAmount),
    payment_terms: client?.payment_terms || "30 jours",
    devis_code: devisCode,
    dossier_code: dossierCode,
  };
}

async function fetchVisiteData(visiteId: string): Promise<Record<string, string>> {
  const { data: visite } = await supabase
    .from("visites")
    .select("*, clients(name, code, address, city, postal_code), companies(name, short_name, address, phone, email, siret)")
    .eq("id", visiteId)
    .single();

  if (!visite) throw new Error("Visite introuvable");

  const client = visite.clients as any;
  const company = visite.companies as any;

  return {
    visite_code: (visite as any).code || "---",
    visite_title: (visite as any).title || "",
    visite_date: fmtDate((visite as any).scheduled_date),
    visite_address: (visite as any).address || "",
    visite_type: (visite as any).visit_type || "",
    visite_advisor: (visite as any).advisor || "",
    visite_volume: (visite as any).volume ? `${(visite as any).volume} m³` : "",
    visite_distance: (visite as any).distance ? `${(visite as any).distance} km` : "",
    visite_instructions: (visite as any).instructions || "",
    client_name: client?.name || "",
    client_address: client?.address || "",
    client_city: client?.city || "",
    company_name: company?.name || "",
    company_address: company?.address || "",
    company_phone: company?.phone || "",
    company_siret: company?.siret || "",
  };
}

async function fetchBTReportData(operationId: string): Promise<Record<string, string>> {
  const { data: op } = await supabase
    .from("operations")
    .select("*, dossiers(title, code, clients(name, address, city, postal_code))")
    .eq("id", operationId)
    .single();

  if (!op) throw new Error("Opération introuvable");

  const dossier = (op as any).dossiers;
  const client = dossier?.clients;
  const { data: company } = await supabase
    .from("companies")
    .select("name, short_name, address, phone, email, siret")
    .eq("id", (op as any).company_id)
    .single();

  return {
    bt_number: (op as any).lv_bt_number || "",
    bt_type: (op as any).type || "B.T.",
    bt_operation_number: String((op as any).operation_number || 1),
    bt_date: fmtDate((op as any).loading_date),
    bt_notes: (op as any).notes || "",
    loading_address: (op as any).loading_address || "",
    loading_city: (op as any).loading_city || "",
    delivery_address: (op as any).delivery_address || "",
    delivery_city: (op as any).delivery_city || "",
    volume: (op as any).volume ? `${(op as any).volume} m³` : "",
    client_name: client?.name || "",
    client_address: client?.address || "",
    company_name: company?.name || "",
    company_address: company?.address || "",
    company_phone: company?.phone || "",
    company_siret: company?.siret || "",
    dossier_code: dossier?.code || "",
    dossier_title: dossier?.title || "",
  };
}

const DATA_FETCHERS: Record<DocumentType, (id: string) => Promise<Record<string, string>>> = {
  devis: fetchDevisData,
  facture: fetchFactureData,
  visite: fetchVisiteData,
  bt_report: fetchBTReportData,
};

// ── Main template processing ──

export async function generateDocxFromTemplate(
  templateStoragePath: string,
  documentType: DocumentType,
  documentId: string,
  outputFileName: string
): Promise<Blob> {
  // 1. Download the template from storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from("document-templates")
    .download(templateStoragePath);
  if (dlError || !fileData) throw new Error("Impossible de télécharger le modèle");

  // 2. Fetch dynamic data
  const variables = await DATA_FETCHERS[documentType](documentId);

  // 3. Process template with docxtemplater
  const arrayBuffer = await fileData.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  // Replace variables
  doc.render(variables);

  // 4. Generate output
  const output = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return output;
}

export async function downloadDocx(
  templateStoragePath: string,
  documentType: DocumentType,
  documentId: string,
  outputFileName: string
): Promise<void> {
  const blob = await generateDocxFromTemplate(templateStoragePath, documentType, documentId, outputFileName);
  saveAs(blob, outputFileName.endsWith(".docx") ? outputFileName : `${outputFileName}.docx`);
}

// ── Check if a template exists for a given company/type ──

export async function getDefaultTemplate(
  companyId: string,
  documentType: DocumentType
): Promise<{ id: string; storage_path: string; file_name: string } | null> {
  const { data } = await supabase
    .from("document_templates")
    .select("id, storage_path, file_name")
    .eq("company_id", companyId)
    .eq("document_type", documentType)
    .eq("is_default", true)
    .maybeSingle();
  return data;
}
