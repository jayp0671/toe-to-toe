
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_config": {
                  Row: {
                    "fake_now": string | null,"id": boolean,"test_mode": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "fake_now"?: string | null,"id"?: boolean,"test_mode"?: boolean
                  }
                  Update: {
                    "fake_now"?: string | null,"id"?: boolean,"test_mode"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"after": Json | null,"at": string,"before": Json | null,"id": number,"season_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"season_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: never,"season_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_members": {
                  Row: {
                    "crew_id": string,"joined_at": string,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "crew_id": string,"joined_at"?: string,"role"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "crew_id"?: string,"joined_at"?: string,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_members_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"crews": {
                  Row: {
                    "commissioner_id": string,"crew_tz": string,"id": string,"invite_code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commissioner_id": string,"crew_tz"?: string,"id"?: string,"invite_code": string,"name": string
                  }
                  Update: {
                    "commissioner_id"?: string,"crew_tz"?: string,"id"?: string,"invite_code"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crews_commissioner_id_fkey"
      columns: ["commissioner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_stats": {
                  Row: {
                    "distance_m": number,"flags": (string)[],"flights": number,"home_tz": string,"id": string,"local_date": string,"locked_at": string | null,"note": string | null,"sources": (string)[],"status": Database["public"]['Enums']["daily_status"],"steps": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "distance_m"?: number,"flags"?: (string)[],"flights"?: number,"home_tz": string,"id"?: string,"local_date": string,"locked_at"?: string | null,"note"?: string | null,"sources"?: (string)[],"status"?: Database["public"]['Enums']["daily_status"],"steps"?: number,"user_id": string
                  }
                  Update: {
                    "distance_m"?: number,"flags"?: (string)[],"flights"?: number,"home_tz"?: string,"id"?: string,"local_date"?: string,"locked_at"?: string | null,"note"?: string | null,"sources"?: (string)[],"status"?: Database["public"]['Enums']["daily_status"],"steps"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_stats_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"hours": {
                  Row: {
                    "distance_m": number,"flights": number,"hour_start_utc": string,"steps": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "distance_m"?: number,"flights"?: number,"hour_start_utc": string,"steps"?: number,"user_id": string
                  }
                  Update: {
                    "distance_m"?: number,"flights"?: number,"hour_start_utc"?: string,"steps"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hours_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"source_hours": {
                  Row: {
                    "distance_m": number,"flights": number,"hour_start_utc": string,"source_name": string,"steps": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "distance_m"?: number,"flights"?: number,"hour_start_utc": string,"source_name": string,"steps"?: number,"user_id": string
                  }
                  Update: {
                    "distance_m"?: number,"flights"?: number,"hour_start_utc"?: string,"source_name"?: string,"steps"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_hours_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"sync_keys": {
                  Row: {
                    "created_at": string,"key_hash": string,"last_used_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key_hash": string,"last_used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"key_hash"?: string,"last_used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sync_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"default_tz": string,"dev_note": string | null,"display_name": string,"email": string,"id": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"default_tz": string,"dev_note"?: string | null,"display_name": string,"email": string,"id": string,"username": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"default_tz"?: string,"dev_note"?: string | null,"display_name"?: string,"email"?: string,"id"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "app_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"sync_apply":
{ Args: { "p_days": Json,"p_home_tz": string,"p_hours": Json,"p_source_hours": Json,"p_user_id": string }; Returns: Json
                           },
"sync_auth":
{ Args: { "p_key_hash": string }; Returns: {
              "home_tz": string,"rate_limited": boolean,"server_now": string,"user_id": string
            }[]
                           },
"sync_key_rotate":
{ Args: { "p_key_hash": string,"p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "daily_status": "live"|"finalizing"|"locked"|"review"|"voided"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "daily_status": ["live", "finalizing", "locked", "review", "voided"]
          }
        }
} as const
