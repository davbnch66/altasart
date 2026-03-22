import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

async function decryptValue(encrypted: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const key = await crypto.subtle.importKey("raw", keyBytes, ALGORITHM, false, ["decrypt"]);
  const raw = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = raw.slice(0, IV_LENGTH);
  const tag = raw.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.slice(IV_LENGTH + TAG_LENGTH);
  const combined = new Uint8Array(ciphertext.length + TAG_LENGTH);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: 128 }, key, combined);
  return new TextDecoder().decode(decrypted);
}

async function refreshGoogleToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed [${res.status}]`);
  return (await res.json()).access_token;
}

async function refreshMicrosoftToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed [${res.status}]`);
  return (await res.json()).access_token;
}

// Download attachment content from email provider
async function downloadAttachments(
  supabase: any,
  emailAccountId: string | null,
  attachments: any[],
  encryptionKey: string,
  inboundEmailMessageId: string | null,
): Promise<Array<{ filename: string; content_type: string; base64_content: string; size: number }>> {
  if (!emailAccountId || !attachments || attachments.length === 0) return [];

  const { data: account } = await supabase
    .from("email_accounts")
    .select("provider, oauth_refresh_token_encrypted, oauth_client_id")
    .eq("id", emailAccountId)
    .single();

  if (!account?.oauth_refresh_token_encrypted) return [];

  let accessToken: string;
  try {
    const refreshToken = await decryptValue(account.oauth_refresh_token_encrypted, encryptionKey);
    if (account.provider === "gmail") {
      accessToken = await refreshGoogleToken(
        refreshToken,
        account.oauth_client_id || Deno.env.get("GOOGLE_CLIENT_ID")!,
        Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      );
    } else if (account.provider === "outlook") {
      accessToken = await refreshMicrosoftToken(
        refreshToken,
        account.oauth_client_id || Deno.env.get("MICROSOFT_CLIENT_ID")!,
        Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
      );
    } else return [];
  } catch (e) {
    console.error("Token refresh failed for attachment download:", e);
    return [];
  }

  // If attachments don't have attachment_id, re-fetch from provider to get IDs
  const needsIdLookup = attachments.some((a: any) => !a.attachment_id);
  let enrichedAttachments = attachments;

  if (needsIdLookup) {
    try {
      if (account.provider === "gmail") {
        // Search Gmail for this message by message_id header
        const searchQuery = inboundEmailMessageId ? `rfc822msgid:${inboundEmailMessageId.replace(/[<>]/g, "")}` : null;
        let gmailMsgId: string | null = null;

        if (searchQuery) {
          const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=1&includeSpamTrash=true`;
          const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            gmailMsgId = searchData.messages?.[0]?.id || null;
          }
        }

        if (gmailMsgId) {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (msgRes.ok) {
            const msg = await msgRes.json();
            const parts = flattenGmailParts(msg.payload);
            const attParts = parts.filter((p: any) => p.filename && p.filename.length > 0);
            
            // Enrich original attachments with attachment_id
            enrichedAttachments = attachments.map((a: any) => {
              const match = attParts.find((p: any) => p.filename === a.filename);
              return match ? { ...a, attachment_id: match.body?.attachmentId, provider_msg_id: gmailMsgId } : a;
            });
          }
        }
      } else if (account.provider === "outlook") {
        // For Outlook, find message by internetMessageId
        if (inboundEmailMessageId) {
          const filterQuery = `internetMessageId eq '${inboundEmailMessageId}'`;
          const searchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filterQuery)}&$select=id&$top=1`;
          const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const outlookMsgId = searchData.value?.[0]?.id;
            if (outlookMsgId) {
              const attRes = await fetch(
                `https://graph.microsoft.com/v1.0/me/messages/${outlookMsgId}/attachments?$select=id,name,contentType,size`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (attRes.ok) {
                const attData = await attRes.json();
                enrichedAttachments = attachments.map((a: any) => {
                  const match = (attData.value || []).find((p: any) => p.name === a.filename);
                  return match ? { ...a, attachment_id: match.id, provider_msg_id: outlookMsgId } : a;
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Attachment ID lookup error:", e);
    }
  }

  const results: Array<{ filename: string; content_type: string; base64_content: string; size: number }> = [];
  // Only download relevant attachments under 10MB, skip inline signature images
  const relevantAttachments = enrichedAttachments.filter((a: any) => {
    const name = (a.filename || a.name || "").toLowerCase();
    const size = a.size || 0;
    if (size > 10 * 1024 * 1024) return false;
    const isInlineImage = name.startsWith("image0") && (name.endsWith(".png") || name.endsWith(".jpg")) && size < 50000;
    if (isInlineImage) return false;
    return name.endsWith(".pdf") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") ||
      name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp");
  }).slice(0, 8);

  for (const att of relevantAttachments) {
    try {
      let base64Content: string | null = null;

      if (account.provider === "gmail" && att.attachment_id && att.provider_msg_id) {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${att.provider_msg_id}/attachments/${att.attachment_id}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) {
          const data = await res.json();
          base64Content = (data.data || "").replace(/-/g, "+").replace(/_/g, "/");
        }
      } else if (account.provider === "outlook" && att.attachment_id && att.provider_msg_id) {
        const url = `https://graph.microsoft.com/v1.0/me/messages/${att.provider_msg_id}/attachments/${att.attachment_id}?$select=contentBytes`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) {
          const data = await res.json();
          base64Content = data.contentBytes || null;
        }
      }

      if (base64Content) {
        results.push({
          filename: att.filename || att.name || "attachment",
          content_type: att.content_type || "application/octet-stream",
          base64_content: base64Content,
          size: att.size || 0,
        });
        console.log(`Downloaded attachment: ${att.filename} (${Math.round((att.size || 0) / 1024)}Ko)`);
      }
    } catch (e) {
      console.error(`Failed to download attachment ${att.filename}:`, e);
    }
  }

  return results;
}

function flattenGmailParts(part: any): any[] {
  if (!part) return [];
  const result: any[] = [part];
  if (part.parts) {
    for (const p of part.parts) result.push(...flattenGmailParts(p));
  }
  return result;
}

// Build Gemini-compatible content parts for attachments
function buildAttachmentParts(downloadedAttachments: Array<{ filename: string; content_type: string; base64_content: string }>) {
  const parts: any[] = [];
  for (const att of downloadedAttachments) {
    // Map to mime types Gemini supports
    let mimeType = att.content_type;
    if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      // Gemini doesn't natively support xlsx, but we can try sending as binary
      // Better to convert xlsx description in text
      parts.push({
        type: "text",
        text: `[Fichier joint: ${att.filename} - Ce fichier Excel/tableur contient probablement des listes de matériel. Analysez-le en détail.]`,
      });
      continue;
    }
    
    // PDF and images are supported natively by Gemini
    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${att.base64_content}`,
        },
      });
      parts.push({
        type: "text",
        text: `[Document ci-dessus: ${att.filename}]`,
      });
    }
  }
  return parts;
}

// ── Helper: check what enrichment is needed for an existing client ──
async function checkEnrichmentNeeded(
  supabase: any,
  clientId: string,
  companyId: string,
  extracted: { contact?: string | null; email?: string | null; phone?: string | null; mobile?: string | null; address?: string | null }
): Promise<string[]> {
  const enrichments: string[] = [];

  // Check if this contact already exists
  if (extracted.contact && extracted.email) {
    const { data: existingContacts } = await supabase
      .from("client_contacts")
      .select("id, email, first_name, last_name")
      .eq("client_id", clientId)
      .eq("company_id", companyId);

    const emailExists = (existingContacts || []).some((c: any) =>
      c.email && c.email.toLowerCase() === extracted.email!.toLowerCase()
    );
    const nameExists = (existingContacts || []).some((c: any) => {
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().trim();
      return fullName.includes(extracted.contact!.toLowerCase().trim()) ||
        extracted.contact!.toLowerCase().trim().includes(fullName);
    });

    if (!emailExists && !nameExists) {
      enrichments.push("new_contact");
    }
  }

  // Check if client is missing info we have
  const { data: client } = await supabase
    .from("clients")
    .select("phone, mobile, address, email")
    .eq("id", clientId)
    .single();

  if (client) {
    if (!client.phone && extracted.phone) enrichments.push("add_phone");
    if (!client.mobile && extracted.mobile) enrichments.push("add_mobile");
    if (!client.address && extracted.address) enrichments.push("add_address");
  }

  return enrichments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    if (!body.inbound_email_id) {
      const webhookSecret = req.headers.get("X-Webhook-Secret");
      const expectedSecret = Deno.env.get("INBOUND_EMAIL_WEBHOOK_SECRET");
      if (!expectedSecret || webhookSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let emailId: string;
    let companyId: string;
    let emailAccountId: string | null = null;
    let safeFromEmail: string | null;
    let safeFromName: string | null;
    let safeToEmail: string | null;
    let safeSubject: string;
    let safeBodyText: string;
    let safeBodyHtml: string;
    let attachments: any[];

    if (body.inbound_email_id) {
      const { data: existing, error: fetchErr } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("id", body.inbound_email_id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: "Inbound email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing.status === "processed") {
        return new Response(JSON.stringify({ success: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      emailId = existing.id;
      companyId = existing.company_id;
      emailAccountId = existing.email_account_id || null;
      safeFromEmail = existing.from_email;
      safeFromName = existing.from_name;
      safeToEmail = existing.to_email;
      safeSubject = existing.subject || "(sans objet)";
      safeBodyText = existing.body_text || "";
      safeBodyHtml = existing.body_html || "";
      attachments = Array.isArray(existing.attachments) ? existing.attachments : [];

      await supabase.from("inbound_emails").update({ status: "processing" }).eq("id", emailId);
    } else {
      // Mode 2: raw webhook
      const fromEmail = body.from_email || body.from?.address || body.from;
      const fromName = body.from_name || body.from?.name || fromEmail;
      const toEmail = body.to_email || (Array.isArray(body.to) ? body.to[0] : body.to);
      const subject = body.subject || "(sans objet)";
      const bodyText = body.body_text || body.text || body.body || "";
      const bodyHtml = body.body_html || body.html || "";
      attachments = body.attachments || [];
      companyId = body.company_id;

      if (!companyId || typeof companyId !== "string") {
        return new Response(JSON.stringify({ error: "company_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(companyId)) {
        return new Response(JSON.stringify({ error: "company_id invalide" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      safeSubject = String(subject).slice(0, 1000);
      safeBodyText = String(bodyText).slice(0, 100000);
      safeBodyHtml = String(bodyHtml).slice(0, 200000);
      safeFromEmail = fromEmail ? String(fromEmail).slice(0, 320) : null;
      safeFromName = fromName ? String(fromName).slice(0, 200) : null;
      safeToEmail = toEmail ? String(toEmail).slice(0, 320) : null;

      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .maybeSingle();
      if (companyErr || !company) {
        return new Response(JSON.stringify({ error: "Société introuvable" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: emailRow, error: insertErr } = await supabase
        .from("inbound_emails")
        .insert({
          company_id: companyId,
          from_email: safeFromEmail,
          from_name: safeFromName,
          to_email: safeToEmail,
          subject: safeSubject,
          body_text: safeBodyText,
          body_html: safeBodyHtml,
          attachments: Array.isArray(attachments) ? attachments.slice(0, 20) : [],
          status: "processing",
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      emailId = emailRow.id;
    }

    // ── Download actual attachment content from email provider ──
    const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY") || "";
    let downloadedAttachments: Array<{ filename: string; content_type: string; base64_content: string; size: number }> = [];
    
    if (emailAccountId && encryptionKey && attachments.length > 0) {
      // Get the message_id for provider lookup
      const { data: emailForMsgId } = await supabase
        .from("inbound_emails").select("message_id").eq("id", emailId).single();
      const inboundMessageId = emailForMsgId?.message_id || null;
      
      try {
        downloadedAttachments = await downloadAttachments(supabase, emailAccountId, attachments, encryptionKey, inboundMessageId);
        console.log(`Downloaded ${downloadedAttachments.length} attachments for analysis`);
      } catch (e) {
        console.error("Attachment download error:", e);
      }
    }

    const attachmentNames = (Array.isArray(attachments) ? attachments : [])
      .map((a: any) => `${a.filename || a.name || ""} (${Math.round((a.size || 0) / 1024)}Ko)`).filter(Boolean).slice(0, 20);

    // ── AI Analysis with actual document content ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contentForAnalysis = `De: ${safeFromName} <${safeFromEmail}>
Objet: ${safeSubject}
Pièces jointes: ${attachmentNames.length > 0 ? attachmentNames.join(", ") : "aucune"}

${safeBodyText.slice(0, 10000)}`;

    // Build multimodal message with attachment content
    const userContent: any[] = [
      {
        type: "text",
        text: `Analyse cet email entrant ET toutes les pièces jointes fournies ci-dessous. Extrais CHAQUE machine, CHAQUE équipement individuellement avec ses caractéristiques. Ne regroupe PAS les matériels par catégorie - liste-les UN PAR UN.\n\n${contentForAnalysis}`,
      },
    ];

    // Add downloaded attachment content as inline documents
    if (downloadedAttachments.length > 0) {
      const attachmentParts = buildAttachmentParts(downloadedAttachments);
      userContent.push(...attachmentParts);
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant d'analyse d'emails commerciaux pour une entreprise spécialisée en MANUTENTION LOURDE, LEVAGE, DÉMÉNAGEMENT INDUSTRIEL et RÉCEPTION DE MATÉRIEL.

Analyse MINUTIEUSEMENT l'email, son contenu ET TOUTES les pièces jointes (documents PDF, images, tableurs) pour extraire CHAQUE équipement individuellement.

CLASSIFICATION - type_demande :
- "devis" : demande de chiffrage, estimation, tarif
- "visite" : demande de visite technique, reconnaissance terrain
- "information" : demande de renseignements, disponibilité, capacités
- "relance" : suivi d'une demande précédente
- "confirmation" : validation, bon de commande, accord
- "autre" : newsletters, spam, notifications automatiques

EXTRACTION MATÉRIEL - EXHAUSTIVE ET DÉTAILLÉE :
Tu DOIS analyser le contenu des PDF, images et tableurs joints pour extraire CHAQUE machine/équipement INDIVIDUELLEMENT.
- NE PAS regrouper par catégorie (ex: pas "Centrales de Traitement d'Air" comme unique entrée)
- LISTER chaque CTA, chaque moteur, chaque équipement SÉPARÉMENT avec son identifiant/repère
- Pour chaque matériel : désignation précise (incluant le repère/numéro), quantité, dimensions LxlxH, poids, bâtiment/pièce de destination, étage, contraintes

REGROUPEMENT PAR PIÈCE/BÂTIMENT :
Si les documents mentionnent des bâtiments, zones, pièces ou locaux techniques, groupe les matériels par "piece" (nom du bâtiment/local/zone).
Chaque pièce doit avoir : name (nom du bâtiment/zone), floor_level (étage), et la liste des matériels qui y sont destinés.

DOCUMENTS VOIRIE :
- "plan_voirie", "pv_roc", "arrete"
Si un arrêté est détecté, extrais la date (champ arrete_date, format YYYY-MM-DD).`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_email",
              description: "Analyse structurée exhaustive d'un email commercial avec extraction détaillée de chaque matériel",
              parameters: {
                type: "object",
                properties: {
                  societe: { type: "string" },
                  contact: { type: "string" },
                  email: { type: "string" },
                  telephone: { type: "string" },
                  mobile: { type: "string" },
                  adresse_chantier: { type: "string" },
                  code_postal: { type: "string" },
                  ville: { type: "string" },
                  adresse_origine: { type: "string" },
                  ville_origine: { type: "string" },
                  cp_origine: { type: "string" },
                  adresse_destination: { type: "string" },
                  ville_destination: { type: "string" },
                  cp_destination: { type: "string" },
                  nature: { type: "string" },
                  volume: { type: "number" },
                  etage: { type: "string" },
                  ascenseur: { type: "boolean" },
                  instructions: { type: "string" },
                  type_demande: {
                    type: "array",
                    items: { type: "string", enum: ["devis", "visite", "information", "relance", "confirmation", "autre"] },
                  },
                  voirie_documents: {
                    type: "array",
                    items: { type: "string", enum: ["plan_voirie", "pv_roc", "arrete"] },
                  },
                  arrete_date: { type: "string" },
                  pieces: {
                    type: "array",
                    description: "Liste des pièces/bâtiments/zones avec leurs matériels. Chaque pièce regroupe les matériels destinés à ce lieu.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Nom du bâtiment, local technique, zone (ex: Bâtiment QID, Local CTA R+2, PEP)" },
                        floor_level: { type: "string", description: "Étage (ex: RDC, R+1, R+2, Toiture)" },
                        access_comments: { type: "string", description: "Commentaires d'accès spécifiques à cette pièce" },
                        materials: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              designation: { type: "string", description: "Désignation PRÉCISE avec repère/identifiant (ex: CTA QID-01, VED B3-R+2)" },
                              quantity: { type: "number" },
                              dimensions: { type: "string", description: "Dimensions LxlxH" },
                              weight: { type: "number", description: "Poids en kg" },
                              etage: { type: "string" },
                              acces_contraintes: { type: "string" },
                              fragile: { type: "boolean" },
                              notes: { type: "string", description: "Informations complémentaires (type de levage requis, grue spécifique, etc.)" },
                            },
                            required: ["designation"],
                          },
                        },
                      },
                      required: ["name", "materials"],
                    },
                  },
                  materiel: {
                    type: "array",
                    description: "Liste EXHAUSTIVE de TOUS les équipements individuels (utilisé si pas de regroupement par pièce possible)",
                    items: {
                      type: "object",
                      properties: {
                        designation: { type: "string" },
                        quantity: { type: "number" },
                        dimensions: { type: "string" },
                        weight: { type: "number" },
                        etage: { type: "string" },
                        acces_contraintes: { type: "string" },
                        fragile: { type: "boolean" },
                        notes: { type: "string" },
                      },
                      required: ["designation"],
                    },
                  },
                  pieces_jointes_detectees: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        filename: { type: "string" },
                        type_document: { type: "string", enum: ["plan_levage", "plan_acces", "plan_implantation", "fiche_technique", "photo_materiel", "bon_commande", "cahier_charges", "plan_voirie", "arrete", "pv_roc", "liste_materiel", "autre"] },
                        description: { type: "string" },
                      },
                      required: ["filename", "type_document"],
                    },
                  },
                  date_souhaitee: { type: "string" },
                  periode: { type: "string" },
                  urgence: { type: "boolean" },
                  resume: { type: "string" },
                },
                required: ["type_demande", "resume"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_email" } },
      }),
    });

    let analysis: any = {};
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        analysis = JSON.parse(toolCall.function.arguments);
      }
    } else {
      console.error("AI analysis failed:", aiResponse.status, await aiResponse.text());
    }

    // Log extraction results
    const piecesCount = (analysis.pieces || []).length;
    const flatMaterielCount = (analysis.materiel || []).length;
    const pieceMaterielCount = (analysis.pieces || []).reduce((sum: number, p: any) => sum + (p.materials || []).length, 0);
    console.log(`AI extracted: ${piecesCount} pieces with ${pieceMaterielCount} materials, ${flatMaterielCount} flat materials, ${downloadedAttachments.length} attachments analyzed`);

    // ── Detect forwarded/self-sent emails ──
    // If from_email matches the email account's own address OR any company email,
    // this is likely a forwarded email. Use AI-extracted contact info instead.
    let isForwardedOrSelfSent = false;
    let realClientEmail: string | null = safeFromEmail;

    // Build a set of "own" email addresses (account + all company email accounts + company email)
    const ownEmails = new Set<string>();
    if (emailAccountId) {
      const { data: emailAccount } = await supabase
        .from("email_accounts")
        .select("email_address")
        .eq("id", emailAccountId)
        .single();
      if (emailAccount?.email_address) ownEmails.add(emailAccount.email_address.toLowerCase());
    }
    // Add all email accounts for this company
    const { data: allAccounts } = await supabase
      .from("email_accounts")
      .select("email_address")
      .eq("company_id", companyId);
    for (const acc of (allAccounts || [])) {
      if (acc.email_address) ownEmails.add(acc.email_address.toLowerCase());
    }
    // Add company email
    const { data: companyInfo } = await supabase
      .from("companies")
      .select("email")
      .eq("id", companyId)
      .single();
    if (companyInfo?.email) ownEmails.add(companyInfo.email.toLowerCase());

    // Also detect forwarded emails by subject prefix (TR:, FW:, Fwd:) or from==to
    const subjectLower = safeSubject.toLowerCase().trim();
    const isForwardedSubject = /^(tr\s*:|fw\s*:|fwd\s*:)/i.test(subjectLower);
    const isSelfSent = safeFromEmail && safeToEmail && safeFromEmail.toLowerCase() === safeToEmail.toLowerCase();

    if (!isForwardedOrSelfSent && (isForwardedSubject || isSelfSent)) {
      isForwardedOrSelfSent = true;
      realClientEmail = analysis.email ? String(analysis.email).toLowerCase().slice(0, 320) : null;
      console.log(`Forwarded email detected by subject/self-send. Using AI-extracted email: ${realClientEmail}`);
    }

    // ══════════════════════════════════════════════════════
    // ── INTELLIGENT CLIENT MATCHING WITH SCORING ──
    // ══════════════════════════════════════════════════════
    let clientId: string | null = null;
    const matchEmail = realClientEmail || safeFromEmail;
    const matchDomain = matchEmail ? matchEmail.split("@")[1]?.toLowerCase() : null;
    const matchName = analysis.societe || "";
    const matchContact = analysis.contact || (isForwardedOrSelfSent ? null : safeFromName) || "";
    const matchPhone = analysis.telephone || "";
    const matchMobile = analysis.mobile || "";

    // Step 0: Check learned corrections first
    if (matchEmail) {
      const { data: correction } = await supabase
        .from("client_match_corrections")
        .select("matched_client_id")
        .eq("company_id", companyId)
        .eq("from_email", matchEmail.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (correction?.matched_client_id) {
        // Verify the client still exists
        const { data: corrClient } = await supabase
          .from("clients").select("id").eq("id", correction.matched_client_id).maybeSingle();
        if (corrClient) {
          clientId = corrClient.id;
          console.log(`Client matched via learned correction: ${clientId}`);
        }
      }
    }

    // Step 1: Multi-criteria candidate search
    type ClientCandidate = {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      score: number;
      reasons: string[];
    };
    const candidates: ClientCandidate[] = [];

    if (!clientId) {
      // Fetch all clients for this company with contacts
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, name, email, phone, mobile, address, contact_name")
        .eq("company_id", companyId);

      const { data: allContacts } = await supabase
        .from("client_contacts")
        .select("client_id, email, phone_office, mobile, first_name, last_name")
        .eq("company_id", companyId);

      const contactsByClient = new Map<string, any[]>();
      for (const c of (allContacts || [])) {
        const list = contactsByClient.get(c.client_id) || [];
        list.push(c);
        contactsByClient.set(c.client_id, list);
      }

      for (const client of (allClients || [])) {
        let score = 0;
        const reasons: string[] = [];
        const contacts = contactsByClient.get(client.id) || [];

        // 1. Exact email match on client → +70
        if (matchEmail && client.email && client.email.toLowerCase() === matchEmail.toLowerCase()) {
          score += 70;
          reasons.push("Email client identique");
        }

        // 2. Exact email match on contacts → +70
        if (matchEmail) {
          const contactEmailMatch = contacts.some((c: any) =>
            c.email && c.email.toLowerCase() === matchEmail.toLowerCase()
          );
          if (contactEmailMatch) {
            score += 70;
            reasons.push("Email contact identique");
          }
        }

        // 3. Domain match → +40
        if (matchDomain && matchDomain !== "gmail.com" && matchDomain !== "hotmail.com" && matchDomain !== "yahoo.com" && matchDomain !== "outlook.com" && matchDomain !== "orange.fr" && matchDomain !== "free.fr" && matchDomain !== "sfr.fr" && matchDomain !== "wanadoo.fr" && matchDomain !== "laposte.net") {
          const clientDomain = client.email?.split("@")[1]?.toLowerCase();
          if (clientDomain === matchDomain) {
            score += 40;
            reasons.push("Même domaine email");
          }
          // Also check contact domains
          const contactDomainMatch = contacts.some((c: any) =>
            c.email && c.email.split("@")[1]?.toLowerCase() === matchDomain
          );
          if (contactDomainMatch && clientDomain !== matchDomain) {
            score += 35;
            reasons.push("Domaine contact identique");
          }
        }

        // 4. Company name similarity (trigram-based fuzzy match)
        if (matchName && client.name) {
          const nameA = matchName.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüçœæ0-9\s]/g, "").trim();
          const nameB = client.name.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüçœæ0-9\s]/g, "").trim();
          
          if (nameA === nameB) {
            score += 50;
            reasons.push("Nom société identique");
          } else if (nameA && nameB) {
            // Simple trigram similarity calculation
            const trigramsA = new Set<string>();
            const trigramsB = new Set<string>();
            const padA = `  ${nameA} `;
            const padB = `  ${nameB} `;
            for (let i = 0; i < padA.length - 2; i++) trigramsA.add(padA.substring(i, i + 3));
            for (let i = 0; i < padB.length - 2; i++) trigramsB.add(padB.substring(i, i + 3));
            
            let intersection = 0;
            for (const t of trigramsA) if (trigramsB.has(t)) intersection++;
            const union = trigramsA.size + trigramsB.size - intersection;
            const similarity = union > 0 ? intersection / union : 0;
            
            if (similarity > 0.6) {
              score += Math.round(similarity * 45);
              reasons.push(`Nom société similaire (${Math.round(similarity * 100)}%)`);
            } else if (similarity > 0.3) {
              score += Math.round(similarity * 25);
              reasons.push(`Nom société approchant (${Math.round(similarity * 100)}%)`);
            }
            // Also check if one name contains the other
            if (nameA.includes(nameB) || nameB.includes(nameA)) {
              score += 30;
              reasons.push("Nom société contenu dans l'autre");
            }
          }
        }

        // 5. Contact name match
        if (matchContact) {
          const contactNameLower = matchContact.toLowerCase().trim();
          // Check client contact_name
          if (client.contact_name && client.contact_name.toLowerCase().includes(contactNameLower)) {
            score += 25;
            reasons.push("Nom contact correspondant");
          }
          // Check client_contacts table
          const contactNameMatch = contacts.some((c: any) => {
            const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().trim();
            return fullName.includes(contactNameLower) || contactNameLower.includes(fullName);
          });
          if (contactNameMatch) {
            score += 30;
            reasons.push("Contact existant reconnu");
          }
        }

        // 6. Phone match
        if (matchPhone || matchMobile) {
          const normalizePhone = (p: string) => p.replace(/[\s\.\-\(\)]/g, "").replace(/^(\+33|0033)/, "0");
          const phones = [matchPhone, matchMobile].filter(Boolean).map(normalizePhone);
          
          const clientPhones = [client.phone, client.mobile].filter(Boolean).map(normalizePhone);
          const contactPhones = contacts.flatMap((c: any) =>
            [c.phone_office, c.mobile].filter(Boolean).map(normalizePhone)
          );
          const allClientPhones = [...clientPhones, ...contactPhones];
          
          const phoneMatch = phones.some(p => allClientPhones.some(cp => cp === p || cp.endsWith(p.slice(-9)) || p.endsWith(cp.slice(-9))));
          if (phoneMatch) {
            score += 35;
            reasons.push("Téléphone correspondant");
          }
        }

        if (score > 0) {
          candidates.push({ id: client.id, name: client.name, email: client.email, phone: client.phone, score, reasons });
        }
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      // Decision logic based on score
      if (candidates.length > 0) {
        const best = candidates[0];
        if (best.score >= 70) {
          // High confidence → auto-link
          clientId = best.id;
          console.log(`Client auto-matched (score ${best.score}): ${best.name} — ${best.reasons.join(", ")}`);
        }
      }
    }

    // Step 2: Determine what action to suggest based on matching results
    const actions: any[] = [];
    const clientEmail = realClientEmail || (isForwardedOrSelfSent ? analysis.email : safeFromEmail);
    const clientName = analysis.societe || (isForwardedOrSelfSent ? analysis.contact : safeFromName) || clientEmail;

    if (clientId) {
      // Client found with high confidence — check if we need to enrich (add new contact, etc.)
      const needsEnrichment = await checkEnrichmentNeeded(supabase, clientId, companyId, {
        contact: analysis.contact || (isForwardedOrSelfSent ? null : safeFromName),
        email: clientEmail,
        phone: analysis.telephone,
        mobile: analysis.mobile,
        address: analysis.adresse_chantier,
      });
      
      if (needsEnrichment.length > 0) {
        actions.push({
          inbound_email_id: emailId, company_id: companyId, action_type: "enrich_client",
          payload: {
            client_id: clientId,
            client_name: candidates[0]?.name || "Client existant",
            enrichments: needsEnrichment,
            contact_name: analysis.contact || (isForwardedOrSelfSent ? null : safeFromName),
            email: clientEmail,
            phone: analysis.telephone || null,
            mobile: analysis.mobile || null,
            address: analysis.adresse_chantier || null,
            postal_code: analysis.code_postal || null,
            city: analysis.ville || null,
          },
        });
      }
    } else if (candidates.length > 0 && candidates[0].score >= 30) {
      // Medium confidence → suggest candidates to user
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "link_existing_client",
        payload: {
          candidates: candidates.slice(0, 5).map(c => ({
            client_id: c.id,
            name: c.name,
            email: c.email,
            score: c.score,
            reasons: c.reasons,
          })),
          new_client_data: {
            name: clientName,
            contact_name: analysis.contact || (isForwardedOrSelfSent ? null : safeFromName),
            email: clientEmail,
            phone: analysis.telephone || null,
            mobile: analysis.mobile || null,
            address: analysis.adresse_chantier || null,
            postal_code: analysis.code_postal || null,
            city: analysis.ville || null,
          },
          from_email: matchEmail,
        },
      });
    } else {
      // No match → suggest creation
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "create_client",
        payload: {
          name: clientName,
          contact_name: analysis.contact || (isForwardedOrSelfSent ? null : safeFromName),
          email: clientEmail,
          phone: analysis.telephone || null,
          mobile: analysis.mobile || null,
          address: analysis.adresse_chantier || null,
          postal_code: analysis.code_postal || null,
          city: analysis.ville || null,
        },
      });
    }

    const types = analysis.type_demande || [];
    if (types.includes("devis") || types.includes("visite")) {
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "create_dossier",
        payload: { title: safeSubject, description: analysis.resume || "", address: analysis.adresse_chantier || null },
      });
    }

    if (types.includes("devis")) {
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "create_devis",
        payload: { objet: safeSubject, notes: analysis.resume || "" },
      });
    }

    if (types.includes("visite")) {
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "plan_visite",
        payload: {
          title: `Visite — ${analysis.societe || safeFromName || ""}`,
          address: analysis.adresse_chantier || null,
          code_postal: analysis.code_postal || null,
          ville: analysis.ville || null,
          origin_address: analysis.adresse_origine || null,
          origin_city: analysis.ville_origine || null,
          origin_postal_code: analysis.cp_origine || null,
          dest_address: analysis.adresse_destination || null,
          dest_city: analysis.ville_destination || null,
          dest_postal_code: analysis.cp_destination || null,
          date_souhaitee: analysis.date_souhaitee || null,
          periode: analysis.periode || null,
          nature: analysis.nature || null,
          volume: analysis.volume || null,
          etage: analysis.etage || null,
          ascenseur: analysis.ascenseur || null,
          instructions: analysis.instructions || null,
          contact_name: analysis.contact || null,
          zone: analysis.ville || null,
        },
      });
    }

    // Build comprehensive material list from both pieces and flat materiel
    const allMaterials: any[] = [];
    const piecesList: any[] = analysis.pieces || [];
    
    if (piecesList.length > 0) {
      for (const piece of piecesList) {
        for (const mat of (piece.materials || [])) {
          allMaterials.push({ ...mat, _piece_name: piece.name, _piece_floor: piece.floor_level, _piece_access: piece.access_comments });
        }
      }
    }
    // Also add flat materiel that isn't already in pieces
    for (const mat of (analysis.materiel || [])) {
      allMaterials.push(mat);
    }

    if (allMaterials.length > 0) {
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "extract_materiel",
        payload: {
          materials: allMaterials.slice(0, 500),
          pieces: piecesList.slice(0, 50),
        },
      });
    }

    if (clientId) {
      actions.push({
        inbound_email_id: emailId, company_id: companyId, action_type: "link_dossier",
        payload: { client_id: clientId },
      });
    }

    // Voirie document actions
    const voirieDocs = analysis.voirie_documents || [];
    if (voirieDocs.length > 0) {
      let targetVisiteId: string | null = null;
      if (clientId) {
        const { data: voirieVisites } = await supabase
          .from("visites").select("id, dossier_id").eq("company_id", companyId).eq("needs_voirie", true)
          .order("created_at", { ascending: false }).limit(10);
        if (voirieVisites && voirieVisites.length > 0) {
          const { data: clientDossiers } = await supabase
            .from("dossiers").select("id").eq("client_id", clientId).eq("company_id", companyId);
          const dossierIds = (clientDossiers || []).map((d: any) => d.id);
          const matchingVisite = voirieVisites.find((v: any) => dossierIds.includes(v.dossier_id));
          targetVisiteId = matchingVisite?.id || voirieVisites[0]?.id || null;
        }
      }

      const pdfAttachments = (Array.isArray(attachments) ? attachments : [])
        .filter((a: any) => {
          const name = (a.filename || a.name || "").toLowerCase();
          return name.endsWith(".pdf") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
        }).slice(0, 5);

      for (const docType of voirieDocs) {
        const actionType = docType === "plan_voirie" ? "attach_voirie_plan"
          : docType === "pv_roc" ? "attach_pv_roc"
          : docType === "arrete" ? "attach_arrete" : null;
        if (actionType) {
          actions.push({
            inbound_email_id: emailId, company_id: companyId, action_type: actionType,
            payload: {
              visite_id: targetVisiteId,
              attachments: pdfAttachments.map((a: any) => ({
                filename: a.filename || a.name,
                content_type: a.content_type || a.type || "application/pdf",
                url: a.url || null,
              })),
              arrete_date: docType === "arrete" ? (analysis.arrete_date || null) : undefined,
              address: analysis.adresse_chantier || null,
            },
          });
        }
      }
    }

    if (actions.length > 0) {
      await supabase.from("email_actions").insert(actions);
    }

    // ── Insert into messages table ──
    await supabase.from("messages").insert({
      company_id: companyId, client_id: clientId, channel: "email", direction: "inbound",
      sender: safeFromName || safeFromEmail, subject: safeSubject,
      body: safeBodyText.slice(0, 10000), inbound_email_id: emailId, is_read: false,
    });

    // ── Notifications (with dedup to prevent duplicates) ──
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("id")
      .eq("company_id", companyId)
      .like("link", `%email=${emailId}%`)
      .limit(1);

    const { data: members } = await supabase
      .from("company_memberships").select("profile_id").eq("company_id", companyId);

    if ((!existingNotifs || existingNotifs.length === 0) && members && members.length > 0) {
      const materialCount = allMaterials.length;
      const notifTitle = materialCount > 0
        ? `📦 ${materialCount} matériels détectés: ${safeSubject.slice(0, 60)}`
        : voirieDocs.length > 0
          ? `📋 Document voirie reçu: ${safeSubject.slice(0, 80)}`
          : `Nouvel email: ${safeSubject.slice(0, 100)}`;

      const notifications = members.map((m: any) => ({
        company_id: companyId, user_id: m.profile_id,
        type: materialCount > 0 ? "materiel_detected" : voirieDocs.length > 0 ? "new_lead" : types.includes("visite") ? "visite_requested" : "new_lead",
        title: notifTitle,
        body: String(analysis.resume || `De ${safeFromName || safeFromEmail}`).slice(0, 500),
        link: `/inbox?email=${emailId}`,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({
      success: true, email_id: emailId, client_id: clientId,
      actions_count: actions.length, materials_found: allMaterials.length,
      pieces_found: piecesList.length, attachments_analyzed: downloadedAttachments.length,
      voirie_docs: voirieDocs, analysis,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-inbound-email error:", e);
    return new Response(JSON.stringify({ error: "Erreur lors du traitement de l'email." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
