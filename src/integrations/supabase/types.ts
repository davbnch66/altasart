export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      avaries: {
        Row: {
          amount: number | null
          client_id: string
          company_id: string
          created_at: string
          description: string | null
          dossier_id: string
          id: string
          photos: string[] | null
          resolution: string | null
          responsibility: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_id: string
          company_id: string
          created_at?: string
          description?: string | null
          dossier_id: string
          id?: string
          photos?: string[] | null
          resolution?: string | null
          responsibility?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          dossier_id?: string
          id?: string
          photos?: string[] | null
          resolution?: string | null
          responsibility?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaries_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_companies: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          id?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          civility: string | null
          client_id: string
          code: string | null
          company_id: string
          created_at: string
          email: string | null
          first_name: string | null
          function_title: string | null
          id: string
          is_default: boolean
          last_name: string
          mobile: string | null
          notes: string | null
          phone_direct: string | null
          phone_office: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          civility?: string | null
          client_id: string
          code?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          function_title?: string | null
          id?: string
          is_default?: boolean
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone_direct?: string | null
          phone_office?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          civility?: string | null
          client_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          function_title?: string | null
          id?: string
          is_default?: boolean
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone_direct?: string | null
          phone_office?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_match_corrections: {
        Row: {
          company_id: string
          corrected_by: string | null
          created_at: string
          from_domain: string | null
          from_email: string
          id: string
          matched_client_id: string | null
        }
        Insert: {
          company_id: string
          corrected_by?: string | null
          created_at?: string
          from_domain?: string | null
          from_email: string
          id?: string
          matched_client_id?: string | null
        }
        Update: {
          company_id?: string
          corrected_by?: string | null
          created_at?: string
          from_domain?: string | null
          from_email?: string
          id?: string
          matched_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_match_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_match_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_match_corrections_matched_client_id_fkey"
            columns: ["matched_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string
          client_id: string
          company_id: string
          content: string
          created_at: string
          dossier_id: string | null
          id: string
          note_type: string
        }
        Insert: {
          author_id: string
          client_id: string
          company_id: string
          content: string
          created_at?: string
          dossier_id?: string | null
          id?: string
          note_type?: string
        }
        Update: {
          author_id?: string
          client_id?: string
          company_id?: string
          content?: string
          created_at?: string
          dossier_id?: string | null
          id?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_number: string | null
          accounting_collective: string | null
          address: string | null
          advisor: string | null
          ape_naf: string | null
          bic: string | null
          billing_address: string | null
          city: string | null
          client_type: string
          code: string | null
          commercial_notes: string | null
          company_id: string
          contact_name: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          fax: string | null
          iban: string | null
          id: string
          invoice_by_email: boolean | null
          mobile: string | null
          name: string
          notes: string | null
          payment_method: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          siret: string | null
          site_address: string | null
          source: string | null
          special_conditions: string | null
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          tva_intra: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_number?: string | null
          accounting_collective?: string | null
          address?: string | null
          advisor?: string | null
          ape_naf?: string | null
          bic?: string | null
          billing_address?: string | null
          city?: string | null
          client_type?: string
          code?: string | null
          commercial_notes?: string | null
          company_id: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          invoice_by_email?: boolean | null
          mobile?: string | null
          name: string
          notes?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          site_address?: string | null
          source?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tva_intra?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_number?: string | null
          accounting_collective?: string | null
          address?: string | null
          advisor?: string | null
          ape_naf?: string | null
          bic?: string | null
          billing_address?: string | null
          city?: string | null
          client_type?: string
          code?: string | null
          commercial_notes?: string | null
          company_id?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          invoice_by_email?: boolean | null
          mobile?: string | null
          name?: string
          notes?: string | null
          payment_method?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          site_address?: string | null
          source?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tva_intra?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          color: string
          created_at: string
          default_tva_rate: number
          email: string | null
          id: string
          name: string
          phone: string | null
          short_name: string
          siret: string | null
        }
        Insert: {
          address?: string | null
          color?: string
          created_at?: string
          default_tva_rate?: number
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          short_name: string
          siret?: string | null
        }
        Update: {
          address?: string | null
          color?: string
          created_at?: string
          default_tva_rate?: number
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          short_name?: string
          siret?: string | null
        }
        Relationships: []
      }
      company_fixed_costs: {
        Row: {
          category: string
          charges_rate: number
          company_id: string
          created_at: string
          id: string
          label: string
          notes: string | null
          sort_order: number
          total_cost: number | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string
          charges_rate?: number
          company_id: string
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          sort_order?: number
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          charges_rate?: number
          company_id?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          sort_order?: number
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fixed_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          accepted_at: string | null
          amount: number
          archive_reason: string | null
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          client_id: string
          code: string | null
          company_id: string
          content_mode: string
          created_at: string
          created_by: string | null
          custom_content: string | null
          dossier_id: string | null
          id: string
          notes: string | null
          objet: string
          sent_at: string | null
          status: Database["public"]["Enums"]["devis_status"]
          updated_at: string
          use_custom_content: boolean
          valid_until: string | null
          visite_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number
          archive_reason?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id: string
          code?: string | null
          company_id: string
          content_mode?: string
          created_at?: string
          created_by?: string | null
          custom_content?: string | null
          dossier_id?: string | null
          id?: string
          notes?: string | null
          objet: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          updated_at?: string
          use_custom_content?: boolean
          valid_until?: string | null
          visite_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          archive_reason?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id?: string
          code?: string | null
          company_id?: string
          content_mode?: string
          created_at?: string
          created_by?: string | null
          custom_content?: string | null
          dossier_id?: string | null
          id?: string
          notes?: string | null
          objet?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          updated_at?: string
          use_custom_content?: boolean
          valid_until?: string | null
          visite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lines: {
        Row: {
          created_at: string
          description: string
          devis_id: string
          id: string
          quantity: number
          sort_order: number
          total: number | null
          tva_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          devis_id: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number | null
          tva_rate?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          devis_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          total?: number | null
          tva_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_lines_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_relances: {
        Row: {
          company_id: string
          created_at: string
          devis_id: string
          id: string
          recipient_email: string
          recipient_name: string | null
          relance_num: number
          sent_at: string
          status: string
          subject: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          devis_id: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          relance_num?: number
          sent_at?: string
          status?: string
          subject?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          devis_id?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          relance_num?: number
          sent_at?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_relances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_relances_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_signatures: {
        Row: {
          company_id: string
          created_at: string
          devis_id: string
          expires_at: string
          id: string
          signature_data_url: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          status: string
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          devis_id: string
          expires_at?: string
          id?: string
          signature_data_url?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          devis_id?: string
          expires_at?: string
          id?: string
          signature_data_url?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_signatures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_templates: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          lines: Json
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          id?: string
          lines?: Json
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          lines?: Json
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          file_name: string
          id: string
          is_default: boolean
          name: string
          storage_path: string
          updated_at: string
          variables: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type?: string
          file_name: string
          id?: string
          is_default?: boolean
          name: string
          storage_path: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          is_default?: boolean
          name?: string
          storage_path?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_costs: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          date: string | null
          description: string
          dossier_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount?: number
          category?: string
          company_id: string
          created_at?: string
          date?: string | null
          description: string
          dossier_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          date?: string | null
          description?: string
          dossier_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossier_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_costs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          address: string | null
          advisor: string | null
          amount: number | null
          client_id: string
          code: string | null
          company_id: string
          complexity_score: number | null
          confirmation_date: string | null
          coordinator: string | null
          cost: number | null
          created_at: string
          delivery_access: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_comments: string | null
          delivery_elevator: boolean | null
          delivery_floor: string | null
          delivery_parking_request: boolean | null
          delivery_postal_code: string | null
          description: string | null
          distance: number | null
          dossier_type: string | null
          end_date: string | null
          execution_mode: string | null
          id: string
          instructions: string | null
          lifting_charge_kg: number | null
          lifting_height_m: number | null
          lifting_reach_m: number | null
          loading_access: string | null
          loading_address: string | null
          loading_city: string | null
          loading_comments: string | null
          loading_elevator: boolean | null
          loading_floor: string | null
          loading_parking_request: boolean | null
          loading_postal_code: string | null
          loss_reason: string | null
          nature: string | null
          notes: string | null
          origin: string | null
          stage: Database["public"]["Enums"]["dossier_stage"]
          start_date: string | null
          title: string
          updated_at: string
          visite_date: string | null
          volume: number | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          advisor?: string | null
          amount?: number | null
          client_id: string
          code?: string | null
          company_id: string
          complexity_score?: number | null
          confirmation_date?: string | null
          coordinator?: string | null
          cost?: number | null
          created_at?: string
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_parking_request?: boolean | null
          delivery_postal_code?: string | null
          description?: string | null
          distance?: number | null
          dossier_type?: string | null
          end_date?: string | null
          execution_mode?: string | null
          id?: string
          instructions?: string | null
          lifting_charge_kg?: number | null
          lifting_height_m?: number | null
          lifting_reach_m?: number | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_parking_request?: boolean | null
          loading_postal_code?: string | null
          loss_reason?: string | null
          nature?: string | null
          notes?: string | null
          origin?: string | null
          stage?: Database["public"]["Enums"]["dossier_stage"]
          start_date?: string | null
          title: string
          updated_at?: string
          visite_date?: string | null
          volume?: number | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          advisor?: string | null
          amount?: number | null
          client_id?: string
          code?: string | null
          company_id?: string
          complexity_score?: number | null
          confirmation_date?: string | null
          coordinator?: string | null
          cost?: number | null
          created_at?: string
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_parking_request?: boolean | null
          delivery_postal_code?: string | null
          description?: string | null
          distance?: number | null
          dossier_type?: string | null
          end_date?: string | null
          execution_mode?: string | null
          id?: string
          instructions?: string | null
          lifting_charge_kg?: number | null
          lifting_height_m?: number | null
          lifting_reach_m?: number | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_parking_request?: boolean | null
          loading_postal_code?: string | null
          loss_reason?: string | null
          nature?: string | null
          notes?: string | null
          origin?: string | null
          stage?: Database["public"]["Enums"]["dossier_stage"]
          start_date?: string | null
          title?: string
          updated_at?: string
          visite_date?: string | null
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          auth_method: Database["public"]["Enums"]["email_auth_method"]
          auto_link_clients: boolean
          company_id: string
          created_at: string
          email_address: string
          id: string
          imap_host: string | null
          imap_password_encrypted: string | null
          imap_port: number | null
          imap_security: string | null
          imap_username: string | null
          is_default: boolean
          label: string
          last_error: string | null
          last_sync_at: string | null
          oauth_access_token_encrypted: string | null
          oauth_client_id: string | null
          oauth_refresh_token_encrypted: string | null
          oauth_token_expires_at: string | null
          provider: Database["public"]["Enums"]["email_provider"]
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_security: string | null
          smtp_username: string | null
          status: Database["public"]["Enums"]["email_account_status"]
          sync_enabled: boolean
          sync_from_date: string | null
          updated_at: string
        }
        Insert: {
          auth_method?: Database["public"]["Enums"]["email_auth_method"]
          auto_link_clients?: boolean
          company_id: string
          created_at?: string
          email_address: string
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_security?: string | null
          imap_username?: string | null
          is_default?: boolean
          label: string
          last_error?: string | null
          last_sync_at?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_client_id?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_token_expires_at?: string | null
          provider?: Database["public"]["Enums"]["email_provider"]
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_security?: string | null
          smtp_username?: string | null
          status?: Database["public"]["Enums"]["email_account_status"]
          sync_enabled?: boolean
          sync_from_date?: string | null
          updated_at?: string
        }
        Update: {
          auth_method?: Database["public"]["Enums"]["email_auth_method"]
          auto_link_clients?: boolean
          company_id?: string
          created_at?: string
          email_address?: string
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_port?: number | null
          imap_security?: string | null
          imap_username?: string | null
          is_default?: boolean
          label?: string
          last_error?: string | null
          last_sync_at?: string | null
          oauth_access_token_encrypted?: string | null
          oauth_client_id?: string | null
          oauth_refresh_token_encrypted?: string | null
          oauth_token_expires_at?: string | null
          provider?: Database["public"]["Enums"]["email_provider"]
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_security?: string | null
          smtp_username?: string | null
          status?: Database["public"]["Enums"]["email_account_status"]
          sync_enabled?: boolean
          sync_from_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["email_action_type"]
          company_id: string
          created_at: string
          executed_at: string | null
          executed_by: string | null
          id: string
          inbound_email_id: string
          payload: Json | null
          status: Database["public"]["Enums"]["email_action_status"]
        }
        Insert: {
          action_type: Database["public"]["Enums"]["email_action_type"]
          company_id: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          inbound_email_id: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["email_action_status"]
        }
        Update: {
          action_type?: Database["public"]["Enums"]["email_action_type"]
          company_id?: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          inbound_email_id?: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["email_action_status"]
        }
        Relationships: [
          {
            foreignKeyName: "email_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_actions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_actions_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_flag_assignments: {
        Row: {
          company_id: string
          created_at: string
          flag_color: string
          id: string
          inbound_email_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          flag_color: string
          id?: string
          inbound_email_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          flag_color?: string
          id?: string
          inbound_email_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_flag_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_flag_assignments_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_label_assignments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          inbound_email_id: string
          label_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          inbound_email_id: string
          label_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          inbound_email_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_label_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_assignments_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "email_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      email_labels: {
        Row: {
          color: string
          company_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          account_id: string
          attachments: Json | null
          bcc_recipients: Json | null
          body_html: string | null
          body_text: string | null
          cc_recipients: Json | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          dossier_id: string | null
          error: string | null
          id: string
          reply_to_message_id: string | null
          sent_at: string | null
          sent_message_id: string | null
          status: string
          subject: string | null
          to_recipients: Json
        }
        Insert: {
          account_id: string
          attachments?: Json | null
          bcc_recipients?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_recipients?: Json | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          error?: string | null
          id?: string
          reply_to_message_id?: string | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          subject?: string | null
          to_recipients?: Json
        }
        Update: {
          account_id?: string
          attachments?: Json | null
          bcc_recipients?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_recipients?: Json | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          error?: string | null
          id?: string
          reply_to_message_id?: string | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
          subject?: string | null
          to_recipients?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      event_resources: {
        Row: {
          created_at: string
          event_id: string
          id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          resource_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "planning_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_relances: {
        Row: {
          company_id: string
          created_at: string
          facture_id: string
          id: string
          recipient_email: string
          recipient_name: string | null
          relance_num: number
          sent_at: string
          status: string
          subject: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          facture_id: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          relance_num?: number
          sent_at?: string
          status?: string
          subject?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          facture_id?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          relance_num?: number
          sent_at?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facture_relances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_relances_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_situations: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          dossier_id: string
          due_date: string | null
          facture_id: string | null
          id: string
          label: string
          notes: string | null
          percentage: number
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          dossier_id: string
          due_date?: string | null
          facture_id?: string | null
          id?: string
          label?: string
          notes?: string | null
          percentage?: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          dossier_id?: string
          due_date?: string | null
          facture_id?: string | null
          id?: string
          label?: string
          notes?: string | null
          percentage?: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facture_situations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_situations_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facture_situations_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          amount: number
          archive_reason: string | null
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          client_id: string
          code: string | null
          company_id: string
          created_at: string
          devis_id: string | null
          discount_percent: number | null
          dossier_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          payment_terms: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["facture_status"]
          tva_rate: number
          updated_at: string
        }
        Insert: {
          amount?: number
          archive_reason?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id: string
          code?: string | null
          company_id: string
          created_at?: string
          devis_id?: string | null
          discount_percent?: number | null
          dossier_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_terms?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
          tva_rate?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          archive_reason?: string | null
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          devis_id?: string | null
          discount_percent?: number | null
          dossier_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_terms?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
          tva_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          brand: string | null
          capacity_tons: number | null
          company_id: string
          created_at: string
          daily_rate: number | null
          height_meters: number | null
          id: string
          insurance_expiry: string | null
          model: string | null
          name: string
          next_maintenance: string | null
          notes: string | null
          reach_meters: number | null
          registration: string | null
          status: string
          technical_control_expiry: string | null
          type: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          capacity_tons?: number | null
          company_id: string
          created_at?: string
          daily_rate?: number | null
          height_meters?: number | null
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          name: string
          next_maintenance?: string | null
          notes?: string | null
          reach_meters?: number | null
          registration?: string | null
          status?: string
          technical_control_expiry?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          capacity_tons?: number | null
          company_id?: string
          created_at?: string
          daily_rate?: number | null
          height_meters?: number | null
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          name?: string
          next_maintenance?: string | null
          notes?: string | null
          reach_meters?: number | null
          registration?: string | null
          status?: string
          technical_control_expiry?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_emails: {
        Row: {
          ai_analysis: Json | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          client_id: string | null
          company_id: string
          created_at: string
          devis_id: string | null
          dossier_id: string | null
          email_account_id: string | null
          folder: string
          from_email: string | null
          from_name: string | null
          id: string
          is_read: boolean
          label_id: string | null
          message_id: string | null
          processed_at: string | null
          read_at: string | null
          read_by: string | null
          status: Database["public"]["Enums"]["inbound_email_status"]
          subject: string | null
          to_email: string | null
          visite_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          devis_id?: string | null
          dossier_id?: string | null
          email_account_id?: string | null
          folder?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_read?: boolean
          label_id?: string | null
          message_id?: string | null
          processed_at?: string | null
          read_at?: string | null
          read_by?: string | null
          status?: Database["public"]["Enums"]["inbound_email_status"]
          subject?: string | null
          to_email?: string | null
          visite_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          devis_id?: string | null
          dossier_id?: string | null
          email_account_id?: string | null
          folder?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_read?: boolean
          label_id?: string | null
          message_id?: string | null
          processed_at?: string | null
          read_at?: string | null
          read_by?: string | null
          status?: Database["public"]["Enums"]["inbound_email_status"]
          subject?: string | null
          to_email?: string | null
          visite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "email_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      materiel_catalog: {
        Row: {
          category: string
          company_id: string
          created_at: string
          default_dimensions: string | null
          default_volume: number | null
          default_weight: number | null
          designation: string
          fragility: string | null
          handling_notes: string | null
          id: string
          unit_price: number | null
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          default_dimensions?: string | null
          default_volume?: number | null
          default_weight?: number | null
          designation: string
          fragility?: string | null
          handling_notes?: string | null
          id?: string
          unit_price?: number | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          default_dimensions?: string | null
          default_volume?: number | null
          default_weight?: number | null
          designation?: string
          fragility?: string | null
          handling_notes?: string | null
          id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materiel_catalog_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_status: string | null
          direction: string
          external_id: string | null
          id: string
          inbound_email_id: string | null
          is_read: boolean
          read_at: string | null
          sender: string | null
          subject: string | null
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          inbound_email_id?: string | null
          is_read?: boolean
          read_at?: string | null
          sender?: string | null
          subject?: string | null
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          inbound_email_id?: string | null
          is_read?: boolean
          read_at?: string | null
          sender?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_inbound_email_id_fkey"
            columns: ["inbound_email_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          company_id: string
          created_at: string
          devis_signed: boolean
          email_action_suggested: boolean
          id: string
          new_client: boolean
          new_email: boolean
          popup_devis_signed: boolean
          popup_email_action: boolean
          popup_new_client: boolean
          popup_new_email: boolean
          popup_visite_reminder: boolean
          updated_at: string
          user_id: string
          visite_reminder: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          devis_signed?: boolean
          email_action_suggested?: boolean
          id?: string
          new_client?: boolean
          new_email?: boolean
          popup_devis_signed?: boolean
          popup_email_action?: boolean
          popup_new_client?: boolean
          popup_new_email?: boolean
          popup_visite_reminder?: boolean
          updated_at?: string
          user_id: string
          visite_reminder?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          devis_signed?: boolean
          email_action_suggested?: boolean
          id?: string
          new_client?: boolean
          new_email?: boolean
          popup_devis_signed?: boolean
          popup_email_action?: boolean
          popup_new_client?: boolean
          popup_new_email?: boolean
          popup_visite_reminder?: boolean
          updated_at?: string
          user_id?: string
          visite_reminder?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_resources: {
        Row: {
          created_at: string
          id: string
          operation_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operation_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_resources_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_suppliers: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          notes: string | null
          operation_id: string
          role: string | null
          supplier_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          operation_id: string
          role?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          operation_id?: string
          role?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_suppliers_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed: boolean
          created_at: string
          delivery_access: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_comments: string | null
          delivery_date: string | null
          delivery_elevator: boolean | null
          delivery_floor: string | null
          delivery_monte_meubles: boolean | null
          delivery_parking_request: boolean | null
          delivery_passage_fenetre: boolean | null
          delivery_portage: number | null
          delivery_postal_code: string | null
          delivery_time_end: string | null
          delivery_time_start: string | null
          delivery_transbordement: boolean | null
          dossier_id: string
          end_signature_url: string | null
          end_signed_at: string | null
          end_signer_name: string | null
          facture_id: string | null
          id: string
          instructions: string | null
          loading_access: string | null
          loading_address: string | null
          loading_city: string | null
          loading_comments: string | null
          loading_date: string | null
          loading_elevator: boolean | null
          loading_floor: string | null
          loading_monte_meubles: boolean | null
          loading_parking_request: boolean | null
          loading_passage_fenetre: boolean | null
          loading_portage: number | null
          loading_postal_code: string | null
          loading_time_end: string | null
          loading_time_start: string | null
          loading_transbordement: boolean | null
          lv_bt_number: string | null
          notes: string | null
          operation_number: number
          operator_signature_url: string | null
          operator_signed_at: string | null
          operator_signer_name: string | null
          photos: string[] | null
          sort_order: number
          start_signature_url: string | null
          start_signed_at: string | null
          start_signer_name: string | null
          type: string
          updated_at: string
          volume: number | null
          weight: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed?: boolean
          created_at?: string
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_date?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_monte_meubles?: boolean | null
          delivery_parking_request?: boolean | null
          delivery_passage_fenetre?: boolean | null
          delivery_portage?: number | null
          delivery_postal_code?: string | null
          delivery_time_end?: string | null
          delivery_time_start?: string | null
          delivery_transbordement?: boolean | null
          dossier_id: string
          end_signature_url?: string | null
          end_signed_at?: string | null
          end_signer_name?: string | null
          facture_id?: string | null
          id?: string
          instructions?: string | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_date?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_monte_meubles?: boolean | null
          loading_parking_request?: boolean | null
          loading_passage_fenetre?: boolean | null
          loading_portage?: number | null
          loading_postal_code?: string | null
          loading_time_end?: string | null
          loading_time_start?: string | null
          loading_transbordement?: boolean | null
          lv_bt_number?: string | null
          notes?: string | null
          operation_number?: number
          operator_signature_url?: string | null
          operator_signed_at?: string | null
          operator_signer_name?: string | null
          photos?: string[] | null
          sort_order?: number
          start_signature_url?: string | null
          start_signed_at?: string | null
          start_signer_name?: string | null
          type?: string
          updated_at?: string
          volume?: number | null
          weight?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed?: boolean
          created_at?: string
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_date?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_monte_meubles?: boolean | null
          delivery_parking_request?: boolean | null
          delivery_passage_fenetre?: boolean | null
          delivery_portage?: number | null
          delivery_postal_code?: string | null
          delivery_time_end?: string | null
          delivery_time_start?: string | null
          delivery_transbordement?: boolean | null
          dossier_id?: string
          end_signature_url?: string | null
          end_signed_at?: string | null
          end_signer_name?: string | null
          facture_id?: string | null
          id?: string
          instructions?: string | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_date?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_monte_meubles?: boolean | null
          loading_parking_request?: boolean | null
          loading_passage_fenetre?: boolean | null
          loading_portage?: number | null
          loading_postal_code?: string | null
          loading_time_end?: string | null
          loading_time_start?: string | null
          loading_transbordement?: boolean | null
          lv_bt_number?: string | null
          notes?: string | null
          operation_number?: number
          operator_signature_url?: string | null
          operator_signed_at?: string | null
          operator_signer_name?: string | null
          photos?: string[] | null
          sort_order?: number
          start_signature_url?: string | null
          start_signed_at?: string | null
          start_signer_name?: string | null
          type?: string
          updated_at?: string
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_events: {
        Row: {
          all_day: boolean
          client_id: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          delivery_access: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_comments: string | null
          delivery_elevator: boolean | null
          delivery_floor: string | null
          delivery_monte_meubles: boolean | null
          delivery_parking_request: boolean | null
          delivery_passage_fenetre: boolean | null
          delivery_portage: number | null
          delivery_postal_code: string | null
          delivery_transbordement: boolean | null
          description: string | null
          dossier_id: string | null
          end_time: string
          event_type: string
          id: string
          instructions: string | null
          internal_notes: string | null
          loading_access: string | null
          loading_address: string | null
          loading_city: string | null
          loading_comments: string | null
          loading_elevator: boolean | null
          loading_floor: string | null
          loading_monte_meubles: boolean | null
          loading_parking_request: boolean | null
          loading_passage_fenetre: boolean | null
          loading_portage: number | null
          loading_postal_code: string | null
          loading_transbordement: boolean | null
          priority: string
          resource_id: string | null
          start_time: string
          title: string
          updated_at: string
          volume: number | null
          weight: number | null
        }
        Insert: {
          all_day?: boolean
          client_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_monte_meubles?: boolean | null
          delivery_parking_request?: boolean | null
          delivery_passage_fenetre?: boolean | null
          delivery_portage?: number | null
          delivery_postal_code?: string | null
          delivery_transbordement?: boolean | null
          description?: string | null
          dossier_id?: string | null
          end_time: string
          event_type?: string
          id?: string
          instructions?: string | null
          internal_notes?: string | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_monte_meubles?: boolean | null
          loading_parking_request?: boolean | null
          loading_passage_fenetre?: boolean | null
          loading_portage?: number | null
          loading_postal_code?: string | null
          loading_transbordement?: boolean | null
          priority?: string
          resource_id?: string | null
          start_time: string
          title: string
          updated_at?: string
          volume?: number | null
          weight?: number | null
        }
        Update: {
          all_day?: boolean
          client_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivery_access?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_comments?: string | null
          delivery_elevator?: boolean | null
          delivery_floor?: string | null
          delivery_monte_meubles?: boolean | null
          delivery_parking_request?: boolean | null
          delivery_passage_fenetre?: boolean | null
          delivery_portage?: number | null
          delivery_postal_code?: string | null
          delivery_transbordement?: boolean | null
          description?: string | null
          dossier_id?: string | null
          end_time?: string
          event_type?: string
          id?: string
          instructions?: string | null
          internal_notes?: string | null
          loading_access?: string | null
          loading_address?: string | null
          loading_city?: string | null
          loading_comments?: string | null
          loading_elevator?: boolean | null
          loading_floor?: string | null
          loading_monte_meubles?: boolean | null
          loading_parking_request?: boolean | null
          loading_passage_fenetre?: boolean | null
          loading_portage?: number | null
          loading_postal_code?: string | null
          loading_transbordement?: boolean | null
          priority?: string
          resource_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          volume?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      ppsps: {
        Row: {
          attachments: Json | null
          company_id: string
          content: Json
          created_by: string | null
          custom_sections: Json | null
          devis_id: string
          dossier_id: string | null
          generated_at: string
          id: string
          images: Json | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          attachments?: Json | null
          company_id: string
          content?: Json
          created_by?: string | null
          custom_sections?: Json | null
          devis_id: string
          dossier_id?: string | null
          generated_at?: string
          id?: string
          images?: Json | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          attachments?: Json | null
          company_id?: string
          content?: Json
          created_by?: string | null
          custom_sections?: Json | null
          devis_id?: string
          dossier_id?: string | null
          generated_at?: string
          id?: string
          images?: Json | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppsps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppsps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppsps_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppsps_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          subscription_json: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          subscription_json: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          subscription_json?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reglements: {
        Row: {
          amount: number
          bank: string | null
          code: string | null
          company_id: string
          created_at: string
          encaissement_date: string | null
          facture_id: string
          id: string
          notes: string | null
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          bank?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          encaissement_date?: string | null
          facture_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bank?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          encaissement_date?: string | null
          facture_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reglements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reglements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_absences: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          reason: string | null
          resource_id: string
          start_date: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          reason?: string | null
          resource_id: string
          start_date: string
          type?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          resource_id?: string
          start_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_absences_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_companies: {
        Row: {
          company_id: string
          id: string
          resource_id: string
        }
        Insert: {
          company_id: string
          id?: string
          resource_id: string
        }
        Update: {
          company_id?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_companies_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_documents: {
        Row: {
          ai_extracted: boolean | null
          company_id: string
          created_at: string
          document_type: string
          expires_at: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          resource_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          ai_extracted?: boolean | null
          company_id: string
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          resource_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          ai_extracted?: boolean | null
          company_id?: string
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          resource_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_documents_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_equipment: {
        Row: {
          brand: string | null
          capacity_tons: number | null
          current_km: number | null
          daily_rate: number | null
          height_meters: number | null
          id: string
          insurance_expiry: string | null
          insurance_policy: string | null
          maintenance_interval_km: number | null
          model: string | null
          next_maintenance_date: string | null
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          reach_meters: number | null
          registration: string | null
          resource_id: string
          serial_number: string | null
          technical_control_expiry: string | null
          updated_at: string
          vgp_expiry: string | null
          vgp_frequency_months: number | null
          weight_tons: number | null
          year_manufacture: number | null
        }
        Insert: {
          brand?: string | null
          capacity_tons?: number | null
          current_km?: number | null
          daily_rate?: number | null
          height_meters?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          maintenance_interval_km?: number | null
          model?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          reach_meters?: number | null
          registration?: string | null
          resource_id: string
          serial_number?: string | null
          technical_control_expiry?: string | null
          updated_at?: string
          vgp_expiry?: string | null
          vgp_frequency_months?: number | null
          weight_tons?: number | null
          year_manufacture?: number | null
        }
        Update: {
          brand?: string | null
          capacity_tons?: number | null
          current_km?: number | null
          daily_rate?: number | null
          height_meters?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_policy?: string | null
          maintenance_interval_km?: number | null
          model?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          reach_meters?: number | null
          registration?: string | null
          resource_id?: string
          serial_number?: string | null
          technical_control_expiry?: string | null
          updated_at?: string
          vgp_expiry?: string | null
          vgp_frequency_months?: number | null
          weight_tons?: number | null
          year_manufacture?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_equipment_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_interventions: {
        Row: {
          attachments: string[] | null
          completed_date: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          next_due_date: string | null
          notes: string | null
          priority: string
          provider: string | null
          reference: string | null
          resource_id: string
          scheduled_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          attachments?: string[] | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          next_due_date?: string | null
          notes?: string | null
          priority?: string
          provider?: string | null
          reference?: string | null
          resource_id: string
          scheduled_date?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          attachments?: string[] | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          next_due_date?: string | null
          notes?: string | null
          priority?: string
          provider?: string | null
          reference?: string | null
          resource_id?: string
          scheduled_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_interventions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_personnel: {
        Row: {
          address: string | null
          aipr: boolean | null
          birth_date: string | null
          caces: string[] | null
          contract_type: string | null
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          employee_id: string | null
          habilitations_elec: string[] | null
          hire_date: string | null
          id: string
          id_expiry: string | null
          id_number: string | null
          job_title: string | null
          last_medical_visit: string | null
          medical_aptitude: string | null
          nationality: string | null
          next_medical_visit: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          resource_id: string
          social_security: string | null
          sst: boolean | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          aipr?: boolean | null
          birth_date?: string | null
          caces?: string[] | null
          contract_type?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          employee_id?: string | null
          habilitations_elec?: string[] | null
          hire_date?: string | null
          id?: string
          id_expiry?: string | null
          id_number?: string | null
          job_title?: string | null
          last_medical_visit?: string | null
          medical_aptitude?: string | null
          nationality?: string | null
          next_medical_visit?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          resource_id: string
          social_security?: string | null
          sst?: boolean | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          aipr?: boolean | null
          birth_date?: string | null
          caces?: string[] | null
          contract_type?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          employee_id?: string | null
          habilitations_elec?: string[] | null
          hire_date?: string | null
          id?: string
          id_expiry?: string | null
          id_number?: string | null
          job_title?: string | null
          last_medical_visit?: string | null
          medical_aptitude?: string | null
          nationality?: string | null
          next_medical_visit?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          resource_id?: string
          social_security?: string | null
          sst?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_personnel_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          certifications: string[] | null
          created_at: string
          id: string
          linked_profile_id: string | null
          name: string
          notes: string | null
          permits: string[] | null
          skills: string[] | null
          status: Database["public"]["Enums"]["resource_status"]
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string
        }
        Insert: {
          certifications?: string[] | null
          created_at?: string
          id?: string
          linked_profile_id?: string | null
          name: string
          notes?: string | null
          permits?: string[] | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["resource_status"]
          type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Update: {
          certifications?: string[] | null
          created_at?: string
          id?: string
          linked_profile_id?: string | null
          name?: string
          notes?: string | null
          permits?: string[] | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["resource_status"]
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_units: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          dossier_id: string | null
          end_date: string | null
          id: string
          location: string | null
          monthly_rate: number | null
          name: string
          notes: string | null
          size_m2: number | null
          start_date: string | null
          status: string
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          dossier_id?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          monthly_rate?: number | null
          name: string
          notes?: string | null
          size_m2?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          dossier_id?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          monthly_rate?: number | null
          name?: string
          notes?: string | null
          size_m2?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_units_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_units_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_equipment: {
        Row: {
          availability: string | null
          brand: string | null
          capacity_tons: number | null
          category: string | null
          company_id: string
          created_at: string | null
          daily_rate: number | null
          document_urls: string[] | null
          height_meters: number | null
          id: string
          model: string | null
          monthly_rate: number | null
          notes: string | null
          reach_meters: number | null
          supplier_id: string
          technical_specs: Json | null
          type: string
          updated_at: string | null
          weekly_rate: number | null
        }
        Insert: {
          availability?: string | null
          brand?: string | null
          capacity_tons?: number | null
          category?: string | null
          company_id: string
          created_at?: string | null
          daily_rate?: number | null
          document_urls?: string[] | null
          height_meters?: number | null
          id?: string
          model?: string | null
          monthly_rate?: number | null
          notes?: string | null
          reach_meters?: number | null
          supplier_id: string
          technical_specs?: Json | null
          type?: string
          updated_at?: string | null
          weekly_rate?: number | null
        }
        Update: {
          availability?: string | null
          brand?: string | null
          capacity_tons?: number | null
          category?: string | null
          company_id?: string
          created_at?: string | null
          daily_rate?: number | null
          document_urls?: string[] | null
          height_meters?: number | null
          id?: string
          model?: string | null
          monthly_rate?: number | null
          notes?: string | null
          reach_meters?: number | null
          supplier_id?: string
          technical_specs?: Json | null
          type?: string
          updated_at?: string | null
          weekly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_equipment_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string
          company_id: string
          contact_name: string | null
          created_at: string
          daily_rate: number | null
          email: string | null
          hourly_rate: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          siret: string | null
          specialties: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string
          company_id: string
          contact_name?: string | null
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          siret?: string | null
          specialties?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          company_id?: string
          contact_name?: string | null
          created_at?: string
          daily_rate?: number | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          siret?: string | null
          specialties?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      synced_emails: {
        Row: {
          ai_analysis: Json | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          client_id: string | null
          company_id: string
          created_at: string
          devis_id: string | null
          direction: string
          dossier_id: string | null
          email_account_id: string
          folder: string | null
          from_email: string | null
          from_name: string | null
          id: string
          in_reply_to: string | null
          is_read: boolean
          label_id: string | null
          message_id: string
          processed_at: string | null
          raw_headers: Json | null
          read_at: string | null
          read_by: string | null
          received_at: string
          status: string | null
          subject: string | null
          to_emails: Json | null
          visite_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          client_id?: string | null
          company_id: string
          created_at?: string
          devis_id?: string | null
          direction?: string
          dossier_id?: string | null
          email_account_id: string
          folder?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          label_id?: string | null
          message_id: string
          processed_at?: string | null
          raw_headers?: Json | null
          read_at?: string | null
          read_by?: string | null
          received_at?: string
          status?: string | null
          subject?: string | null
          to_emails?: Json | null
          visite_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          devis_id?: string | null
          direction?: string
          dossier_id?: string | null
          email_account_id?: string
          folder?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          is_read?: boolean
          label_id?: string | null
          message_id?: string
          processed_at?: string | null
          raw_headers?: Json | null
          read_at?: string | null
          read_by?: string | null
          received_at?: string
          status?: string | null
          subject?: string | null
          to_emails?: Json | null
          visite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synced_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_emails_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_theme_settings: {
        Row: {
          border_radius: string
          company_colors: Json
          created_at: string
          dark_mode: boolean
          font_size: string
          id: string
          sidebar_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          border_radius?: string
          company_colors?: Json
          created_at?: string
          dark_mode?: boolean
          font_size?: string
          id?: string
          sidebar_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          border_radius?: string
          company_colors?: Json
          created_at?: string
          dark_mode?: boolean
          font_size?: string
          id?: string
          sidebar_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_expenses: {
        Row: {
          ai_extracted: boolean | null
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          liters: number | null
          mileage_km: number | null
          notes: string | null
          photo_url: string | null
          reference: string | null
          resource_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          ai_extracted?: boolean | null
          amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          liters?: number | null
          mileage_km?: number | null
          notes?: string | null
          photo_url?: string | null
          reference?: string | null
          resource_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          ai_extracted?: boolean | null
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          liters?: number | null
          mileage_km?: number | null
          notes?: string | null
          photo_url?: string | null
          reference?: string | null
          resource_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_contraintes: {
        Row: {
          authorizations: string | null
          company_id: string
          created_at: string
          door_width: string | null
          freight_elevator: boolean | null
          id: string
          notes: string | null
          obstacles: string | null
          ramp: boolean | null
          stairs: string | null
          updated_at: string
          visite_id: string
        }
        Insert: {
          authorizations?: string | null
          company_id: string
          created_at?: string
          door_width?: string | null
          freight_elevator?: boolean | null
          id?: string
          notes?: string | null
          obstacles?: string | null
          ramp?: boolean | null
          stairs?: string | null
          updated_at?: string
          visite_id: string
        }
        Update: {
          authorizations?: string | null
          company_id?: string
          created_at?: string
          door_width?: string | null
          freight_elevator?: boolean | null
          id?: string
          notes?: string | null
          obstacles?: string | null
          ramp?: boolean | null
          stairs?: string | null
          updated_at?: string
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_contraintes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_contraintes_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_materiel: {
        Row: {
          company_id: string
          created_at: string
          designation: string
          dimensions: string | null
          id: string
          notes: string | null
          piece_id: string | null
          quantity: number
          sort_order: number
          unit: string | null
          updated_at: string
          visite_id: string
          weight: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          designation: string
          dimensions?: string | null
          id?: string
          notes?: string | null
          piece_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
          visite_id: string
          weight?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          designation?: string
          dimensions?: string | null
          id?: string
          notes?: string | null
          piece_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
          visite_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visite_materiel_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_materiel_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "visite_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_materiel_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_materiel_affectations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          materiel_id: string
          notes: string | null
          piece_id: string
          quantity: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          materiel_id: string
          notes?: string | null
          piece_id: string
          quantity?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          materiel_id?: string
          notes?: string | null
          piece_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "visite_materiel_affectations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_materiel_affectations_materiel_id_fkey"
            columns: ["materiel_id"]
            isOneToOne: false
            referencedRelation: "visite_materiel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_materiel_affectations_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "visite_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_methodologie: {
        Row: {
          checklist: Json | null
          company_id: string
          content: string | null
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          visite_id: string
        }
        Insert: {
          checklist?: Json | null
          company_id: string
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          visite_id: string
        }
        Update: {
          checklist?: Json | null
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_methodologie_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_methodologie_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          file_name: string | null
          id: string
          piece_id: string | null
          storage_path: string
          visite_id: string
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          file_name?: string | null
          id?: string
          piece_id?: string | null
          storage_path: string
          visite_id: string
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          file_name?: string | null
          id?: string
          piece_id?: string | null
          storage_path?: string
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_photos_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "visite_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_photos_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_pieces: {
        Row: {
          access_comments: string | null
          company_id: string
          created_at: string
          dimensions: string | null
          floor_level: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          visite_id: string
        }
        Insert: {
          access_comments?: string | null
          company_id: string
          created_at?: string
          dimensions?: string | null
          floor_level?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          visite_id: string
        }
        Update: {
          access_comments?: string | null
          company_id?: string
          created_at?: string
          dimensions?: string | null
          floor_level?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_pieces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_pieces_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_ressources_humaines: {
        Row: {
          company_id: string
          created_at: string
          duration_estimate: string | null
          id: string
          notes: string | null
          quantity: number
          role: string
          sort_order: number
          visite_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          duration_estimate?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          role: string
          sort_order?: number
          visite_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          duration_estimate?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          role?: string
          sort_order?: number
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_ressources_humaines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_ressources_humaines_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visite_vehicules: {
        Row: {
          capacity: number | null
          company_id: string
          created_at: string
          height: number | null
          id: string
          label: string | null
          notes: string | null
          reach: number | null
          road_constraints: string | null
          sort_order: number
          type: Database["public"]["Enums"]["vehicule_type"]
          visite_id: string
        }
        Insert: {
          capacity?: number | null
          company_id: string
          created_at?: string
          height?: number | null
          id?: string
          label?: string | null
          notes?: string | null
          reach?: number | null
          road_constraints?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["vehicule_type"]
          visite_id: string
        }
        Update: {
          capacity?: number | null
          company_id?: string
          created_at?: string
          height?: number | null
          id?: string
          label?: string | null
          notes?: string | null
          reach?: number | null
          road_constraints?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["vehicule_type"]
          visite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visite_vehicules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visite_vehicules_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
      visites: {
        Row: {
          address: string | null
          advisor: string | null
          call_date: string | null
          client_id: string
          code: string | null
          comment: string | null
          company_id: string
          completed_date: string | null
          complexity_score: number | null
          contractor: string | null
          coordinator: string | null
          created_at: string
          created_by: string | null
          dest_access: string | null
          dest_address_line1: string | null
          dest_address_line2: string | null
          dest_city: string | null
          dest_country: string | null
          dest_elevator: boolean | null
          dest_floor: string | null
          dest_furniture_lift: boolean | null
          dest_heavy_vehicle: boolean | null
          dest_name: string | null
          dest_portage: number | null
          dest_postal_code: string | null
          dest_reference: string | null
          dest_transshipment: boolean | null
          dest_window: boolean | null
          devis_type: string | null
          distance: number | null
          dossier_id: string | null
          duration: string | null
          id: string
          instructions: string | null
          lifting_charge_kg: number | null
          lifting_ground_pressure: number | null
          lifting_height_m: number | null
          lifting_reach_m: number | null
          loading_date: string | null
          nature: string | null
          needs_voirie: boolean
          notes: string | null
          on_hold: boolean | null
          operation_type: string | null
          origin: string | null
          origin_access: string | null
          origin_address_line1: string | null
          origin_address_line2: string | null
          origin_city: string | null
          origin_country: string | null
          origin_elevator: boolean | null
          origin_floor: string | null
          origin_furniture_lift: boolean | null
          origin_heavy_vehicle: boolean | null
          origin_name: string | null
          origin_portage: number | null
          origin_postal_code: string | null
          origin_reference: string | null
          origin_transshipment: boolean | null
          origin_window: boolean | null
          period: string | null
          photos_count: number | null
          quality: number | null
          report: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["visite_status"]
          technician_id: string | null
          title: string
          updated_at: string
          visit_type: string | null
          voirie_address: string | null
          voirie_arrete_date: string | null
          voirie_arrete_storage_path: string | null
          voirie_notes: string | null
          voirie_obtained_at: string | null
          voirie_plan_storage_path: string | null
          voirie_pv_roc_storage_path: string | null
          voirie_requested_at: string | null
          voirie_status: string
          voirie_type: string | null
          volume: number | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          advisor?: string | null
          call_date?: string | null
          client_id: string
          code?: string | null
          comment?: string | null
          company_id: string
          completed_date?: string | null
          complexity_score?: number | null
          contractor?: string | null
          coordinator?: string | null
          created_at?: string
          created_by?: string | null
          dest_access?: string | null
          dest_address_line1?: string | null
          dest_address_line2?: string | null
          dest_city?: string | null
          dest_country?: string | null
          dest_elevator?: boolean | null
          dest_floor?: string | null
          dest_furniture_lift?: boolean | null
          dest_heavy_vehicle?: boolean | null
          dest_name?: string | null
          dest_portage?: number | null
          dest_postal_code?: string | null
          dest_reference?: string | null
          dest_transshipment?: boolean | null
          dest_window?: boolean | null
          devis_type?: string | null
          distance?: number | null
          dossier_id?: string | null
          duration?: string | null
          id?: string
          instructions?: string | null
          lifting_charge_kg?: number | null
          lifting_ground_pressure?: number | null
          lifting_height_m?: number | null
          lifting_reach_m?: number | null
          loading_date?: string | null
          nature?: string | null
          needs_voirie?: boolean
          notes?: string | null
          on_hold?: boolean | null
          operation_type?: string | null
          origin?: string | null
          origin_access?: string | null
          origin_address_line1?: string | null
          origin_address_line2?: string | null
          origin_city?: string | null
          origin_country?: string | null
          origin_elevator?: boolean | null
          origin_floor?: string | null
          origin_furniture_lift?: boolean | null
          origin_heavy_vehicle?: boolean | null
          origin_name?: string | null
          origin_portage?: number | null
          origin_postal_code?: string | null
          origin_reference?: string | null
          origin_transshipment?: boolean | null
          origin_window?: boolean | null
          period?: string | null
          photos_count?: number | null
          quality?: number | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["visite_status"]
          technician_id?: string | null
          title: string
          updated_at?: string
          visit_type?: string | null
          voirie_address?: string | null
          voirie_arrete_date?: string | null
          voirie_arrete_storage_path?: string | null
          voirie_notes?: string | null
          voirie_obtained_at?: string | null
          voirie_plan_storage_path?: string | null
          voirie_pv_roc_storage_path?: string | null
          voirie_requested_at?: string | null
          voirie_status?: string
          voirie_type?: string | null
          volume?: number | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          advisor?: string | null
          call_date?: string | null
          client_id?: string
          code?: string | null
          comment?: string | null
          company_id?: string
          completed_date?: string | null
          complexity_score?: number | null
          contractor?: string | null
          coordinator?: string | null
          created_at?: string
          created_by?: string | null
          dest_access?: string | null
          dest_address_line1?: string | null
          dest_address_line2?: string | null
          dest_city?: string | null
          dest_country?: string | null
          dest_elevator?: boolean | null
          dest_floor?: string | null
          dest_furniture_lift?: boolean | null
          dest_heavy_vehicle?: boolean | null
          dest_name?: string | null
          dest_portage?: number | null
          dest_postal_code?: string | null
          dest_reference?: string | null
          dest_transshipment?: boolean | null
          dest_window?: boolean | null
          devis_type?: string | null
          distance?: number | null
          dossier_id?: string | null
          duration?: string | null
          id?: string
          instructions?: string | null
          lifting_charge_kg?: number | null
          lifting_ground_pressure?: number | null
          lifting_height_m?: number | null
          lifting_reach_m?: number | null
          loading_date?: string | null
          nature?: string | null
          needs_voirie?: boolean
          notes?: string | null
          on_hold?: boolean | null
          operation_type?: string | null
          origin?: string | null
          origin_access?: string | null
          origin_address_line1?: string | null
          origin_address_line2?: string | null
          origin_city?: string | null
          origin_country?: string | null
          origin_elevator?: boolean | null
          origin_floor?: string | null
          origin_furniture_lift?: boolean | null
          origin_heavy_vehicle?: boolean | null
          origin_name?: string | null
          origin_portage?: number | null
          origin_postal_code?: string | null
          origin_reference?: string | null
          origin_transshipment?: boolean | null
          origin_window?: boolean | null
          period?: string | null
          photos_count?: number | null
          quality?: number | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["visite_status"]
          technician_id?: string | null
          title?: string
          updated_at?: string
          visit_type?: string | null
          voirie_address?: string | null
          voirie_arrete_date?: string | null
          voirie_arrete_storage_path?: string | null
          voirie_notes?: string | null
          voirie_obtained_at?: string | null
          voirie_plan_storage_path?: string | null
          voirie_pv_roc_storage_path?: string | null
          voirie_requested_at?: string | null
          voirie_status?: string
          voirie_type?: string | null
          volume?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      voirie_plans: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          dossier_id: string | null
          elements: Json
          id: string
          legend: Json
          notes: string | null
          plan_image_url: string | null
          plan_pdf_path: string | null
          status: string
          title: string
          updated_at: string
          visite_id: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          dossier_id?: string | null
          elements?: Json
          id?: string
          legend?: Json
          notes?: string | null
          plan_image_url?: string | null
          plan_pdf_path?: string | null
          status?: string
          title?: string
          updated_at?: string
          visite_id?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          dossier_id?: string | null
          elements?: Json
          id?: string
          legend?: Json
          notes?: string | null
          plan_image_url?: string | null
          plan_pdf_path?: string | null
          status?: string
          title?: string
          updated_at?: string
          visite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voirie_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voirie_plans_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voirie_plans_visite_id_fkey"
            columns: ["visite_id"]
            isOneToOne: false
            referencedRelation: "visites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      unified_emails: {
        Row: {
          ai_analysis: Json | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          client_id: string | null
          company_id: string | null
          created_at: string | null
          devis_id: string | null
          direction: string | null
          dossier_id: string | null
          email_account_id: string | null
          folder: string | null
          from_email: string | null
          from_name: string | null
          id: string | null
          in_reply_to: string | null
          is_read: boolean | null
          label_id: string | null
          message_id: string | null
          processed_at: string | null
          read_at: string | null
          read_by: string | null
          received_at: string | null
          source: string | null
          status: string | null
          subject: string | null
          to_emails: Json | null
          visite_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_assign_companies_for_new_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_my_client_ids: { Args: never; Returns: string[] }
      get_my_company_ids: { Args: never; Returns: string[] }
      get_or_create_signature_token: {
        Args: { p_devis_id: string }
        Returns: string
      }
      has_role_in_company: {
        Args: {
          p_company_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_member: { Args: { p_company_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "commercial"
        | "exploitation"
        | "terrain"
        | "comptable"
        | "readonly"
      client_status: "nouveau_lead" | "actif" | "inactif" | "relance"
      devis_status: "brouillon" | "envoye" | "accepte" | "refuse" | "expire"
      dossier_stage:
        | "prospect"
        | "devis"
        | "accepte"
        | "planifie"
        | "en_cours"
        | "termine"
        | "facture"
        | "paye"
      email_account_status: "active" | "error" | "disconnected" | "testing"
      email_action_status: "suggested" | "accepted" | "rejected"
      email_action_type:
        | "create_client"
        | "create_dossier"
        | "create_devis"
        | "plan_visite"
        | "extract_materiel"
        | "link_dossier"
        | "attach_voirie_plan"
        | "attach_pv_roc"
        | "attach_arrete"
        | "link_existing_client"
        | "enrich_client"
      email_auth_method: "password" | "oauth2"
      email_provider:
        | "generic"
        | "gandi"
        | "gmail"
        | "outlook"
        | "ovh"
        | "zoho"
        | "ionos"
        | "yahoo"
      facture_status:
        | "brouillon"
        | "envoyee"
        | "payee"
        | "en_retard"
        | "annulee"
        | "partielle"
      inbound_email_status: "pending" | "processing" | "processed" | "error"
      message_channel: "email" | "whatsapp" | "phone" | "internal" | "sms"
      notification_type:
        | "new_lead"
        | "materiel_detected"
        | "visite_requested"
        | "client_response"
        | "date_to_validate"
        | "devis_accepted"
        | "info"
      resource_status: "disponible" | "occupe" | "maintenance" | "absent"
      resource_type: "employe" | "grue" | "vehicule" | "equipement" | "equipe"
      vehicule_type:
        | "utilitaire"
        | "camion"
        | "semi"
        | "grue_mobile"
        | "bras_de_grue"
        | "nacelle"
        | "chariot"
        | "palan"
        | "autre"
      visite_status: "planifiee" | "realisee" | "annulee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "commercial",
        "exploitation",
        "terrain",
        "comptable",
        "readonly",
      ],
      client_status: ["nouveau_lead", "actif", "inactif", "relance"],
      devis_status: ["brouillon", "envoye", "accepte", "refuse", "expire"],
      dossier_stage: [
        "prospect",
        "devis",
        "accepte",
        "planifie",
        "en_cours",
        "termine",
        "facture",
        "paye",
      ],
      email_account_status: ["active", "error", "disconnected", "testing"],
      email_action_status: ["suggested", "accepted", "rejected"],
      email_action_type: [
        "create_client",
        "create_dossier",
        "create_devis",
        "plan_visite",
        "extract_materiel",
        "link_dossier",
        "attach_voirie_plan",
        "attach_pv_roc",
        "attach_arrete",
        "link_existing_client",
        "enrich_client",
      ],
      email_auth_method: ["password", "oauth2"],
      email_provider: [
        "generic",
        "gandi",
        "gmail",
        "outlook",
        "ovh",
        "zoho",
        "ionos",
        "yahoo",
      ],
      facture_status: [
        "brouillon",
        "envoyee",
        "payee",
        "en_retard",
        "annulee",
        "partielle",
      ],
      inbound_email_status: ["pending", "processing", "processed", "error"],
      message_channel: ["email", "whatsapp", "phone", "internal", "sms"],
      notification_type: [
        "new_lead",
        "materiel_detected",
        "visite_requested",
        "client_response",
        "date_to_validate",
        "devis_accepted",
        "info",
      ],
      resource_status: ["disponible", "occupe", "maintenance", "absent"],
      resource_type: ["employe", "grue", "vehicule", "equipement", "equipe"],
      vehicule_type: [
        "utilitaire",
        "camion",
        "semi",
        "grue_mobile",
        "bras_de_grue",
        "nacelle",
        "chariot",
        "palan",
        "autre",
      ],
      visite_status: ["planifiee", "realisee", "annulee"],
    },
  },
} as const
