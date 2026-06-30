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
      agente_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          revogado_em: string | null
          token_hash: string
          token_prefix: string
          ultimo_uso_em: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          revogado_em?: string | null
          token_hash: string
          token_prefix: string
          ultimo_uso_em?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          revogado_em?: string | null
          token_hash?: string
          token_prefix?: string
          ultimo_uso_em?: string | null
        }
        Relationships: []
      }
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
      producao_diaria: {
        Row: {
          acumulado_mes: number | null
          atualizado_em: string
          carga_operando: number | null
          created_at: string
          data_referencia: string
          disponibilidade_fisica_df: number | null
          equipamentos_disponiveis: number | null
          equipamentos_utilizados: number | null
          id: string
          meta_diaria: number | null
          meta_mensal: number | null
          payload_bruto: Json | null
          producao_hora: number | null
          producao_mina: number | null
          producao_retaludamento: number | null
          projecao_turno: number | null
          relatorio_origem: string
          toneladas_total: number | null
          transporte_operando: number | null
          turno: string | null
          utilizacao_ut: number | null
        }
        Insert: {
          acumulado_mes?: number | null
          atualizado_em?: string
          carga_operando?: number | null
          created_at?: string
          data_referencia: string
          disponibilidade_fisica_df?: number | null
          equipamentos_disponiveis?: number | null
          equipamentos_utilizados?: number | null
          id?: string
          meta_diaria?: number | null
          meta_mensal?: number | null
          payload_bruto?: Json | null
          producao_hora?: number | null
          producao_mina?: number | null
          producao_retaludamento?: number | null
          projecao_turno?: number | null
          relatorio_origem?: string
          toneladas_total?: number | null
          transporte_operando?: number | null
          turno?: string | null
          utilizacao_ut?: number | null
        }
        Update: {
          acumulado_mes?: number | null
          atualizado_em?: string
          carga_operando?: number | null
          created_at?: string
          data_referencia?: string
          disponibilidade_fisica_df?: number | null
          equipamentos_disponiveis?: number | null
          equipamentos_utilizados?: number | null
          id?: string
          meta_diaria?: number | null
          meta_mensal?: number | null
          payload_bruto?: Json | null
          producao_hora?: number | null
          producao_mina?: number | null
          producao_retaludamento?: number | null
          projecao_turno?: number | null
          relatorio_origem?: string
          toneladas_total?: number | null
          transporte_operando?: number | null
          turno?: string | null
          utilizacao_ut?: number | null
        }
        Relationships: []
      }
      producao_equipamento: {
        Row: {
          atualizado_em: string
          data_referencia: string
          df: number | null
          equipamento: string
          id: string
          producao_hora: number | null
          relatorio_origem: string
          tipo: string | null
          toneladas: number
          turno: string
          ut: number | null
        }
        Insert: {
          atualizado_em?: string
          data_referencia: string
          df?: number | null
          equipamento: string
          id?: string
          producao_hora?: number | null
          relatorio_origem: string
          tipo?: string | null
          toneladas?: number
          turno: string
          ut?: number | null
        }
        Update: {
          atualizado_em?: string
          data_referencia?: string
          df?: number | null
          equipamento?: string
          id?: string
          producao_hora?: number | null
          relatorio_origem?: string
          tipo?: string | null
          toneladas?: number
          turno?: string
          ut?: number | null
        }
        Relationships: []
      }
      producao_frente: {
        Row: {
          atualizado_em: string
          data_referencia: string
          frente: string
          id: string
          producao_hora: number | null
          relatorio_origem: string
          toneladas: number
          turno: string
        }
        Insert: {
          atualizado_em?: string
          data_referencia: string
          frente: string
          id?: string
          producao_hora?: number | null
          relatorio_origem: string
          toneladas?: number
          turno: string
        }
        Update: {
          atualizado_em?: string
          data_referencia?: string
          frente?: string
          id?: string
          producao_hora?: number | null
          relatorio_origem?: string
          toneladas?: number
          turno?: string
        }
        Relationships: []
      }
      producao_view: {
        Row: {
          cargas: number | null
          created_at: string
          data_referencia: string
          equipamento: string | null
          frente: string | null
          frota: string | null
          hora: number | null
          id: string
          material: string | null
          raw: Json
          raw_hash: string
          relatorio_origem: string
          toneladas: number | null
          turno: string | null
        }
        Insert: {
          cargas?: number | null
          created_at?: string
          data_referencia: string
          equipamento?: string | null
          frente?: string | null
          frota?: string | null
          hora?: number | null
          id?: string
          material?: string | null
          raw: Json
          raw_hash: string
          relatorio_origem?: string
          toneladas?: number | null
          turno?: string | null
        }
        Update: {
          cargas?: number | null
          created_at?: string
          data_referencia?: string
          equipamento?: string | null
          frente?: string | null
          frota?: string | null
          hora?: number | null
          id?: string
          material?: string | null
          raw?: Json
          raw_hash?: string
          relatorio_origem?: string
          toneladas?: number | null
          turno?: string | null
        }
        Relationships: []
      }
      sincronizacao_ssrs: {
        Row: {
          agente_host: string | null
          agente_versao: string | null
          duracao_ms: number | null
          finalizado_em: string
          id: string
          iniciado_em: string
          mensagem_erro: string | null
          registros_atualizados: number
          registros_inseridos: number
          registros_recebidos: number
          relatorio: string
          status: string
        }
        Insert: {
          agente_host?: string | null
          agente_versao?: string | null
          duracao_ms?: number | null
          finalizado_em?: string
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          registros_atualizados?: number
          registros_inseridos?: number
          registros_recebidos?: number
          relatorio: string
          status: string
        }
        Update: {
          agente_host?: string | null
          agente_versao?: string | null
          duracao_ms?: number | null
          finalizado_em?: string
          id?: string
          iniciado_em?: string
          mensagem_erro?: string | null
          registros_atualizados?: number
          registros_inseridos?: number
          registros_recebidos?: number
          relatorio?: string
          status?: string
        }
        Relationships: []
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
      ssrs_config: {
        Row: {
          ativo: boolean
          caminho_relatorio: string
          created_at: string
          id: string
          intervalo_sync_segundos: number
          observacoes: string | null
          ssrs_url: string
          ssrs_username: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          caminho_relatorio?: string
          created_at?: string
          id?: string
          intervalo_sync_segundos?: number
          observacoes?: string | null
          ssrs_url: string
          ssrs_username?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          caminho_relatorio?: string
          created_at?: string
          id?: string
          intervalo_sync_segundos?: number
          observacoes?: string | null
          ssrs_url?: string
          ssrs_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          mensagem: string | null
          origem: string
          status: string
          total_registros: number | null
          ultima_sincronizacao: string | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          mensagem?: string | null
          origem: string
          status: string
          total_registros?: number | null
          ultima_sincronizacao?: string | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          mensagem?: string | null
          origem?: string
          status?: string
          total_registros?: number | null
          ultima_sincronizacao?: string | null
        }
        Relationships: []
      }
      tempo_ciclo: {
        Row: {
          ciclo_min: number | null
          created_at: string
          data_referencia: string
          equipamento: string | null
          frente: string | null
          frota: string | null
          id: string
          raw: Json
          raw_hash: string
          relatorio_origem: string
          turno: string | null
          viagens: number | null
        }
        Insert: {
          ciclo_min?: number | null
          created_at?: string
          data_referencia: string
          equipamento?: string | null
          frente?: string | null
          frota?: string | null
          id?: string
          raw: Json
          raw_hash: string
          relatorio_origem?: string
          turno?: string | null
          viagens?: number | null
        }
        Update: {
          ciclo_min?: number | null
          created_at?: string
          data_referencia?: string
          equipamento?: string | null
          frente?: string | null
          frota?: string | null
          id?: string
          raw?: Json
          raw_hash?: string
          relatorio_origem?: string
          turno?: string | null
          viagens?: number | null
        }
        Relationships: []
      }
      tempo_detalhado: {
        Row: {
          categoria: string | null
          created_at: string
          data_referencia: string
          equipamento: string | null
          frota: string | null
          id: string
          minutos: number | null
          raw: Json
          raw_hash: string
          relatorio_origem: string
          sub_estado: string | null
          turno: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_referencia: string
          equipamento?: string | null
          frota?: string | null
          id?: string
          minutos?: number | null
          raw: Json
          raw_hash: string
          relatorio_origem?: string
          sub_estado?: string | null
          turno?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_referencia?: string
          equipamento?: string | null
          frota?: string | null
          id?: string
          minutos?: number | null
          raw?: Json
          raw_hash?: string
          relatorio_origem?: string
          sub_estado?: string | null
          turno?: string | null
        }
        Relationships: []
      }
      tempo_estado: {
        Row: {
          created_at: string
          data_referencia: string
          equipamento: string | null
          estado: string | null
          frota: string | null
          id: string
          minutos: number | null
          raw: Json
          raw_hash: string
          relatorio_origem: string
          turno: string | null
        }
        Insert: {
          created_at?: string
          data_referencia: string
          equipamento?: string | null
          estado?: string | null
          frota?: string | null
          id?: string
          minutos?: number | null
          raw: Json
          raw_hash: string
          relatorio_origem?: string
          turno?: string | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          equipamento?: string | null
          estado?: string | null
          frota?: string | null
          id?: string
          minutos?: number | null
          raw?: Json
          raw_hash?: string
          relatorio_origem?: string
          turno?: string | null
        }
        Relationships: []
      }
      viagens_acompanhamento: {
        Row: {
          created_at: string
          data_referencia: string
          equipamento: string | null
          frente_destino: string | null
          frente_origem: string | null
          frota: string | null
          id: string
          raw: Json
          raw_hash: string
          relatorio_origem: string
          tempo_ciclo_min: number | null
          toneladas: number | null
          turno: string | null
          viagens: number | null
        }
        Insert: {
          created_at?: string
          data_referencia: string
          equipamento?: string | null
          frente_destino?: string | null
          frente_origem?: string | null
          frota?: string | null
          id?: string
          raw: Json
          raw_hash: string
          relatorio_origem?: string
          tempo_ciclo_min?: number | null
          toneladas?: number | null
          turno?: string | null
          viagens?: number | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          equipamento?: string | null
          frente_destino?: string | null
          frente_origem?: string | null
          frota?: string | null
          id?: string
          raw?: Json
          raw_hash?: string
          relatorio_origem?: string
          tempo_ciclo_min?: number | null
          toneladas?: number | null
          turno?: string | null
          viagens?: number | null
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
