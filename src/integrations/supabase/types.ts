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
      clients: {
        Row: {
          address: string | null
          advisor: string | null
          billing_address: string | null
          city: string | null
          code: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          advisor?: string | null
          billing_address?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          advisor?: string | null
          billing_address?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
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
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          short_name?: string
          siret?: string | null
        }
        Relationships: []
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
          client_id: string
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          dossier_id: string | null
          id: string
          notes: string | null
          objet: string
          sent_at: string | null
          status: Database["public"]["Enums"]["devis_status"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount?: number
          client_id: string
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          id?: string
          notes?: string | null
          objet: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          client_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          id?: string
          notes?: string | null
          objet?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["devis_status"]
          updated_at?: string
          valid_until?: string | null
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
      dossiers: {
        Row: {
          address: string | null
          amount: number | null
          client_id: string
          code: string | null
          company_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          stage: Database["public"]["Enums"]["dossier_stage"]
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amount?: number | null
          client_id: string
          code?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          stage?: Database["public"]["Enums"]["dossier_stage"]
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amount?: number | null
          client_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          stage?: Database["public"]["Enums"]["dossier_stage"]
          start_date?: string | null
          title?: string
          updated_at?: string
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
      factures: {
        Row: {
          amount: number
          client_id: string
          code: string | null
          company_id: string
          created_at: string
          devis_id: string | null
          dossier_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          sent_at: string | null
          status: Database["public"]["Enums"]["facture_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          code?: string | null
          company_id: string
          created_at?: string
          devis_id?: string | null
          dossier_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          code?: string | null
          company_id?: string
          created_at?: string
          devis_id?: string | null
          dossier_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["facture_status"]
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
      messages: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          is_read: boolean
          read_at: string | null
          sender: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
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
        ]
      }
      planning_events: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          dossier_id: string | null
          end_time: string
          id: string
          resource_id: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dossier_id?: string | null
          end_time: string
          id?: string
          resource_id?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dossier_id?: string | null
          end_time?: string
          id?: string
          resource_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
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
      resources: {
        Row: {
          certifications: string[] | null
          created_at: string
          id: string
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
          name?: string
          notes?: string | null
          permits?: string[] | null
          skills?: string[] | null
          status?: Database["public"]["Enums"]["resource_status"]
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string
        }
        Relationships: []
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
          duration: unknown
          id: string
          instructions: string | null
          loading_date: string | null
          nature: string | null
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
          duration?: unknown
          id?: string
          instructions?: string | null
          loading_date?: string | null
          nature?: string | null
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
          duration?: unknown
          id?: string
          instructions?: string | null
          loading_date?: string | null
          nature?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_assign_companies_for_new_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_my_company_ids: { Args: never; Returns: string[] }
      has_role_in_company: {
        Args: {
          p_company_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_member: { Args: { p_company_id: string }; Returns: boolean }
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
      facture_status:
        | "brouillon"
        | "envoyee"
        | "payee"
        | "en_retard"
        | "annulee"
      message_channel: "email" | "whatsapp" | "phone" | "internal"
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
      facture_status: ["brouillon", "envoyee", "payee", "en_retard", "annulee"],
      message_channel: ["email", "whatsapp", "phone", "internal"],
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
