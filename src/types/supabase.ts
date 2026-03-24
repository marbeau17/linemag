// ============================================================================
// src/types/supabase.ts
// Supabase データベース型定義（Phase 1 + Phase 2）
// ============================================================================

export interface Database {
  public: {
    Tables: {
      sent_urls: {
        Row: {
          id: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          created_at?: string;
        };
      };
      broadcasts: {
        Row: {
          id: string;
          url: string;
          title: string;
          template_id: string | null;
          status: string;
          error_message: string | null;
          sent_at: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          title: string;
          template_id?: string | null;
          status: string;
          error_message?: string | null;
          sent_at: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          title?: string;
          template_id?: string | null;
          status?: string;
          error_message?: string | null;
          sent_at?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          key: string;
          enabled: boolean;
          times: string[];
          template_id: string;
          max_articles_per_run: number;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key?: string;
          enabled?: boolean;
          times?: string[];
          template_id?: string;
          max_articles_per_run?: number;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          enabled?: boolean;
          times?: string[];
          template_id?: string;
          max_articles_per_run?: number;
          updated_at?: string;
          created_at?: string;
        };
      };
      execution_logs: {
        Row: {
          id: string;
          step: string;
          result: string;
          detail: string;
          metadata: Record<string, unknown>;
          executed_at: string;
        };
        Insert: {
          id?: string;
          step: string;
          result: string;
          detail: string;
          metadata?: Record<string, unknown>;
          executed_at?: string;
        };
        Update: {
          id?: string;
          step?: string;
          result?: string;
          detail?: string;
          metadata?: Record<string, unknown>;
          executed_at?: string;
        };
      };
      error_trackings: {
        Row: {
          id: string;
          key: string;
          consecutive_errors: number;
          last_error_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key?: string;
          consecutive_errors?: number;
          last_error_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          consecutive_errors?: number;
          last_error_at?: string | null;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          line_user_id: string;
          display_name: string | null;
          picture_url: string | null;
          status_message: string | null;
          email: string | null;
          phone: string | null;
          gender: string | null;
          birth_date: string | null;
          prefecture: string | null;
          membership_tier: string;
          message_count: number;
          first_seen_at: string;
          last_seen_at: string;
          blocked_at: string | null;
          attributes: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_user_id: string;
          display_name?: string | null;
          picture_url?: string | null;
          status_message?: string | null;
          email?: string | null;
          phone?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          prefecture?: string | null;
          membership_tier?: string;
          message_count?: number;
          first_seen_at?: string;
          last_seen_at?: string;
          blocked_at?: string | null;
          attributes?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string;
          display_name?: string | null;
          picture_url?: string | null;
          status_message?: string | null;
          email?: string | null;
          phone?: string | null;
          gender?: string | null;
          birth_date?: string | null;
          prefecture?: string | null;
          membership_tier?: string;
          message_count?: number;
          first_seen_at?: string;
          last_seen_at?: string;
          blocked_at?: string | null;
          attributes?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      // ----- Phase 2 Tables -----
      customer_tags: {
        Row: {
          id: string;
          customer_id: string;
          tag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tag: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tag?: string;
          created_at?: string;
        };
      };
      customer_actions: {
        Row: {
          id: string;
          customer_id: string;
          action_type: string;
          action_detail: Record<string, unknown>;
          source: string | null;
          acted_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          action_type: string;
          action_detail?: Record<string, unknown>;
          source?: string | null;
          acted_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          action_type?: string;
          action_detail?: Record<string, unknown>;
          source?: string | null;
          acted_at?: string;
        };
      };
      segments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: string;
          rules: Record<string, unknown>[];
          auto_refresh: boolean;
          last_computed_at: string | null;
          customer_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type: string;
          rules?: Record<string, unknown>[];
          auto_refresh?: boolean;
          last_computed_at?: string | null;
          customer_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: string;
          rules?: Record<string, unknown>[];
          auto_refresh?: boolean;
          last_computed_at?: string | null;
          customer_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      segment_members: {
        Row: {
          segment_id: string;
          customer_id: string;
          added_at: string;
        };
        Insert: {
          segment_id: string;
          customer_id: string;
          added_at?: string;
        };
        Update: {
          segment_id?: string;
          customer_id?: string;
          added_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_consecutive_errors: {
        Args: { p_key?: string };
        Returns: number;
      };
      compute_segment_members: {
        Args: { p_segment_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
