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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          title: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          location: string | null
          location_url: string | null
          time: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          location?: string | null
          location_url?: string | null
          time?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          location?: string | null
          location_url?: string | null
          time?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          company_phone: string | null
          contact_person: string | null
          contract_days: number | null
          contract_period: string | null
          contract_start: string | null
          created_at: string | null
          custom_fields: Json | null
          group_name: string | null
          history: Json | null
          id: string
          kakao_chat_name: string | null
          link: string | null
          mask_company_phone: boolean | null
          mask_phone: boolean | null
          memo: string | null
          name: string
          phone: string | null
          progress: Json | null
          report_template: string | null
          report_tone: string | null
          show_grass_grid: boolean | null
          status: string | null
          tags: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_phone?: string | null
          contact_person?: string | null
          contract_days?: number | null
          contract_period?: string | null
          contract_start?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          group_name?: string | null
          history?: Json | null
          id?: string
          kakao_chat_name?: string | null
          link?: string | null
          mask_company_phone?: boolean | null
          mask_phone?: boolean | null
          memo?: string | null
          name: string
          phone?: string | null
          progress?: Json | null
          report_template?: string | null
          report_tone?: string | null
          show_grass_grid?: boolean | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_phone?: string | null
          contact_person?: string | null
          contract_days?: number | null
          contract_period?: string | null
          contract_start?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          group_name?: string | null
          history?: Json | null
          id?: string
          kakao_chat_name?: string | null
          link?: string | null
          mask_company_phone?: boolean | null
          mask_phone?: boolean | null
          memo?: string | null
          name?: string
          phone?: string | null
          progress?: Json | null
          report_template?: string | null
          report_tone?: string | null
          show_grass_grid?: boolean | null
          status?: string | null
          tags?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      glossary: {
        Row: {
          category: string | null
          created_at: string | null
          definition: string | null
          id: string
          term: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          definition?: string | null
          id?: string
          term: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          definition?: string | null
          id?: string
          term?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memos: {
        Row: {
          created_at: string | null
          id: string
          meeting_memo: string | null
          personal_memo: string | null
          updated_at: string | null
          user_id: string
          work_memo: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_memo?: string | null
          personal_memo?: string | null
          updated_at?: string | null
          user_id: string
          work_memo?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_memo?: string | null
          personal_memo?: string | null
          updated_at?: string | null
          user_id?: string
          work_memo?: string | null
        }
        Relationships: []
      }
      qa_histories: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string | null
          date: string
          id: string
          todos: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          todos?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          todos?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_stats: {
        Row: {
          created_at: string | null
          id: string
          stats: Json
          updated_at: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          stats?: Json
          updated_at?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          stats?: Json
          updated_at?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          custom_field_keys: Json | null
          custom_greeting: Json | null
          employment_type: string | null
          granted_leaves: number | null
          help_button: boolean | null
          id: string
          job_preset: string | null
          join_date: string | null
          leave_standard: string | null
          menu_order: string[] | null
          menu_settings: Json | null
          sender_info: Json | null
          sidebar_collapsed: boolean | null
          speed_dial_custom: Json | null
          theme: string | null
          updated_at: string | null
          used_leaves: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_field_keys?: Json | null
          custom_greeting?: Json | null
          employment_type?: string | null
          granted_leaves?: number | null
          help_button?: boolean | null
          id?: string
          job_preset?: string | null
          join_date?: string | null
          leave_standard?: string | null
          menu_order?: string[] | null
          menu_settings?: Json | null
          sender_info?: Json | null
          sidebar_collapsed?: boolean | null
          speed_dial_custom?: Json | null
          theme?: string | null
          updated_at?: string | null
          used_leaves?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_field_keys?: Json | null
          custom_greeting?: Json | null
          employment_type?: string | null
          granted_leaves?: number | null
          help_button?: boolean | null
          id?: string
          job_preset?: string | null
          join_date?: string | null
          leave_standard?: string | null
          menu_order?: string[] | null
          menu_settings?: Json | null
          sender_info?: Json | null
          sidebar_collapsed?: boolean | null
          speed_dial_custom?: Json | null
          theme?: string | null
          updated_at?: string | null
          used_leaves?: number | null
          user_id?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
