export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fc25hub: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      lobby_participants: {
        Row: {
          created_at: string
          id: string
          is_ready: boolean | null
          lobby_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_ready?: boolean | null
          lobby_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_ready?: boolean | null
          lobby_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_participants_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "tournament_lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_time: string | null
          created_at: string
          id: string
          player1_id: string
          player1_score: number | null
          player2_id: string
          player2_score: number | null
          result_confirmed: boolean | null
          result_confirmed_by_player2: boolean | null
          result_image_url: string | null
          scheduled_time: string | null
          status: string
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          completed_time?: string | null
          created_at?: string
          id?: string
          player1_id: string
          player1_score?: number | null
          player2_id: string
          player2_score?: number | null
          result_confirmed?: boolean | null
          result_confirmed_by_player2?: boolean | null
          result_image_url?: string | null
          scheduled_time?: string | null
          status: string
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          completed_time?: string | null
          created_at?: string
          id?: string
          player1_id?: string
          player1_score?: number | null
          player2_id?: string
          player2_score?: number | null
          result_confirmed?: boolean | null
          result_confirmed_by_player2?: boolean | null
          result_image_url?: string | null
          scheduled_time?: string | null
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          losses: number | null
          platform: string | null
          rating: number | null
          tournaments_played: number | null
          updated_at: string
          username: string | null
          wins: number | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          losses?: number | null
          platform?: string | null
          rating?: number | null
          tournaments_played?: number | null
          updated_at?: string
          username?: string | null
          wins?: number | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          losses?: number | null
          platform?: string | null
          rating?: number | null
          tournaments_played?: number | null
          updated_at?: string
          username?: string | null
          wins?: number | null
        }
        Relationships: []
      }
      tournament_lobbies: {
        Row: {
          created_at: string
          current_players: number
          id: string
          match_time_limit: number | null
          max_players: number
          ready_check_started_at: string | null
          started_at: string | null
          status: string
          tournament_id: string | null
        }
        Insert: {
          created_at?: string
          current_players?: number
          id?: string
          match_time_limit?: number | null
          max_players?: number
          ready_check_started_at?: string | null
          started_at?: string | null
          status?: string
          tournament_id?: string | null
        }
        Update: {
          created_at?: string
          current_players?: number
          id?: string
          match_time_limit?: number | null
          max_players?: number
          ready_check_started_at?: string | null
          started_at?: string | null
          status?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_lobbies_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          created_at: string
          id: string
          points: number | null
          position: number | null
          status: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number | null
          position?: number | null
          status: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number | null
          position?: number | null
          status?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          current_participants: number | null
          description: string | null
          end_date: string | null
          id: string
          lobby_id: string | null
          max_participants: number
          min_rating: number | null
          prize_pool: string | null
          qualification_rating: number | null
          start_date: string | null
          status: string
          title: string
          tournament_format: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          lobby_id?: string | null
          max_participants: number
          min_rating?: number | null
          prize_pool?: string | null
          qualification_rating?: number | null
          start_date?: string | null
          status: string
          title: string
          tournament_format?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          lobby_id?: string | null
          max_participants?: number
          min_rating?: number | null
          prize_pool?: string | null
          qualification_rating?: number | null
          start_date?: string | null
          status?: string
          title?: string
          tournament_format?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_matches_for_quick_tournament: {
        Args: {
          lobby_id: string
        }
        Returns: undefined
      }
      match_players_for_quick_tournament: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
