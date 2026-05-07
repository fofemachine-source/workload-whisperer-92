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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      daily_production: {
        Row: {
          created_at: string | null
          date: string
          equipment_id: string | null
          horimeter_end: number | null
          horimeter_start: number | null
          hours_stopped: number | null
          hours_worked: number | null
          id: string
          location_id: string | null
          material: Database["public"]["Enums"]["material_type"]
          shift: Database["public"]["Enums"]["shift_type"]
          stop_reason: string | null
          tons_produced: number | null
          trips: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          equipment_id?: string | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hours_stopped?: number | null
          hours_worked?: number | null
          id?: string
          location_id?: string | null
          material?: Database["public"]["Enums"]["material_type"]
          shift: Database["public"]["Enums"]["shift_type"]
          stop_reason?: string | null
          tons_produced?: number | null
          trips?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          equipment_id?: string | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hours_stopped?: number | null
          hours_worked?: number | null
          id?: string
          location_id?: string | null
          material?: Database["public"]["Enums"]["material_type"]
          shift?: Database["public"]["Enums"]["shift_type"]
          stop_reason?: string | null
          tons_produced?: number | null
          trips?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_production_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          active: boolean | null
          capacity_tons: number | null
          code: string
          created_at: string | null
          id: string
          type: Database["public"]["Enums"]["equipment_type"]
        }
        Insert: {
          active?: boolean | null
          capacity_tons?: number | null
          code: string
          created_at?: string | null
          id?: string
          type: Database["public"]["Enums"]["equipment_type"]
        }
        Update: {
          active?: boolean | null
          capacity_tons?: number | null
          code?: string
          created_at?: string | null
          id?: string
          type?: Database["public"]["Enums"]["equipment_type"]
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          created_at: string | null
          description: string | null
          equipment_id: string | null
          id: string
          location_id: string | null
          resolved_at: string | null
          started_at: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          location_id?: string | null
          resolved_at?: string | null
          started_at?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          equipment_id?: string | null
          id?: string
          location_id?: string | null
          resolved_at?: string | null
          started_at?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_production: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location_id: string | null
          material: Database["public"]["Enums"]["material_type"]
          planned_tons: number
          planned_trips: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          location_id?: string | null
          material?: Database["public"]["Enums"]["material_type"]
          planned_tons?: number
          planned_trips?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location_id?: string | null
          material?: Database["public"]["Enums"]["material_type"]
          planned_tons?: number
          planned_trips?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_production_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      spreadsheet_uploads: {
        Row: {
          file_name: string
          file_path: string
          id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      equipment_status:
        | "OPERANDO"
        | "CORRETIVA"
        | "PREVENTIVA"
        | "STAND_BY"
        | "AG_FRENTE"
      equipment_type:
        | "CR"
        | "EH"
        | "PF"
        | "CD"
        | "CL"
        | "CP"
        | "MN"
        | "TE"
        | "TI"
        | "CH"
      material_type: "minerio" | "esteril"
      shift_type: "1" | "2"
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
      equipment_status: [
        "OPERANDO",
        "CORRETIVA",
        "PREVENTIVA",
        "STAND_BY",
        "AG_FRENTE",
      ],
      equipment_type: [
        "CR",
        "EH",
        "PF",
        "CD",
        "CL",
        "CP",
        "MN",
        "TE",
        "TI",
        "CH",
      ],
      material_type: ["minerio", "esteril"],
      shift_type: ["1", "2"],
    },
  },
} as const
