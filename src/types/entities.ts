/**
 * Shared TypeScript types for joined Supabase queries.
 * Use these instead of `as any` when accessing relation data.
 */

// ── Client (from joins) ──
export interface JoinedClient {
  id: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  contact_name?: string | null;
  siret?: string | null;
  payment_terms?: string | null;
  status?: string;
}

// ── Company (from joins) ──
export interface JoinedCompany {
  id?: string;
  name: string;
  short_name: string;
  color?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  default_tva_rate?: number;
}

// ── Dossier (from joins) ──
export interface JoinedDossier {
  id: string;
  code?: string | null;
  title: string;
  stage?: string;
  amount?: number | null;
  address?: string | null;
}

// ── Devis (from joins) ──
export interface JoinedDevis {
  id: string;
  code?: string | null;
  objet: string;
  amount?: number;
  status?: string;
}

// ── Profile (from joins) ──
export interface JoinedProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

// ── Resource (from joins) ──
export interface JoinedResource {
  id: string;
  name: string;
  type: string;
  status?: string;
  capacity_tons?: number | null;
  max_height_m?: number | null;
  max_reach_m?: number | null;
}

// ── Facture with joins ──
export interface FactureWithRelations {
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
  clients: JoinedClient | null;
  companies: JoinedCompany | null;
  dossiers: JoinedDossier | null;
  devis: JoinedDevis | null;
}

// ── Dossier with joins ──
export interface DossierWithRelations {
  id: string;
  code: string | null;
  title: string;
  stage: string;
  amount: number | null;
  cost: number | null;
  company_id: string;
  client_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  clients: JoinedClient | null;
  companies: JoinedCompany | null;
}

// ── Devis with joins ──
export interface DevisWithRelations {
  id: string;
  code: string | null;
  objet: string;
  amount: number;
  status: string;
  company_id: string;
  client_id: string;
  dossier_id: string | null;
  visite_id: string | null;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
  clients: JoinedClient | null;
  companies: JoinedCompany | null;
  dossiers: JoinedDossier | null;
}

// ── Email recipient ──
export interface EmailRecipient {
  email: string;
  name?: string;
}

// ── Location state helpers ──
export interface NavigationState {
  fromClient?: boolean;
  fromDossier?: string;
}

// Helper to safely access location state
export function getNavState(state: unknown): NavigationState {
  if (!state || typeof state !== "object") return {};
  const s = state as Record<string, unknown>;
  return {
    fromClient: s.fromClient === true,
    fromDossier: typeof s.fromDossier === "string" ? s.fromDossier : undefined,
  };
}
