
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
            "app_permissions": {
                  Row: {
                    "create": boolean,"delete": boolean,"read": boolean,"resource": string,"role_id": string,"update": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "create"?: boolean,"delete"?: boolean,"read"?: boolean,"resource": string,"role_id": string,"update"?: boolean
                  }
                  Update: {
                    "create"?: boolean,"delete"?: boolean,"read"?: boolean,"resource"?: string,"role_id"?: string,"update"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"areas": {
                  Row: {
                    "description": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cleaners": {
                  Row: {
                    "first_name": string,"id": string,"last_name": string,"middle_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "first_name": string,"id"?: string,"last_name": string,"middle_name"?: string | null
                  }
                  Update: {
                    "first_name"?: string,"id"?: string,"last_name"?: string,"middle_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cleaning_feedbacks": {
                  Row: {
                    "cleaning_job_id": string,"created_at": string,"feedback": string | null,"id": string,"rating": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaning_job_id": string,"created_at"?: string,"feedback"?: string | null,"id"?: string,"rating": number
                  }
                  Update: {
                    "cleaning_job_id"?: string,"created_at"?: string,"feedback"?: string | null,"id"?: string,"rating"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_feedbacks_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_job_areas": {
                  Row: {
                    "area_id": string,"cleaning_job_id": string,"description": string | null,"id": string,"priority": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"cleaning_job_id": string,"description"?: string | null,"id"?: string,"priority"?: boolean
                  }
                  Update: {
                    "area_id"?: string,"cleaning_job_id"?: string,"description"?: string | null,"id"?: string,"priority"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_job_areas_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_job_areas_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_job_assignments": {
                  Row: {
                    "cleaner_id": string,"cleaning_job_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaner_id": string,"cleaning_job_id": string,"id"?: string
                  }
                  Update: {
                    "cleaner_id"?: string,"cleaning_job_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_job_assignments_cleaner_id_fkey"
      columns: ["cleaner_id"]
isOneToOne: false
      referencedRelation: "cleaners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_job_assignments_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_job_cleaning_types": {
                  Row: {
                    "cleaning_job_id": string,"cleaning_type_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaning_job_id": string,"cleaning_type_id": string,"id"?: string
                  }
                  Update: {
                    "cleaning_job_id"?: string,"cleaning_type_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_job_cleaning_types_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_job_cleaning_types_cleaning_type_id_fkey"
      columns: ["cleaning_type_id"]
isOneToOne: false
      referencedRelation: "cleaning_types"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_job_items": {
                  Row: {
                    "cleaning_job_id": string,"description": string | null,"id": string,"item_id": string,"priority": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaning_job_id": string,"description"?: string | null,"id"?: string,"item_id": string,"priority"?: boolean
                  }
                  Update: {
                    "cleaning_job_id"?: string,"description"?: string | null,"id"?: string,"item_id"?: string,"priority"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_job_items_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_job_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_job_updates": {
                  Row: {
                    "cleaning_job_id": string,"created_at": string,"description": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaning_job_id": string,"created_at"?: string,"description": string,"id"?: string
                  }
                  Update: {
                    "cleaning_job_id"?: string,"created_at"?: string,"description"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_job_updates_cleaning_job_id_fkey"
      columns: ["cleaning_job_id"]
isOneToOne: false
      referencedRelation: "cleaning_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_jobs": {
                  Row: {
                    "cleaners_needed": number,"cleaning_status_id": string,"client_id": string,"created_at": string,"description": string | null,"est_hours": number,"id": string,"pets": string | null,"property_id": string,"rate": number,"schedule": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaners_needed": number,"cleaning_status_id"?: string,"client_id": string,"created_at"?: string,"description"?: string | null,"est_hours": number,"id"?: string,"pets"?: string | null,"property_id": string,"rate": number,"schedule": string
                  }
                  Update: {
                    "cleaners_needed"?: number,"cleaning_status_id"?: string,"client_id"?: string,"created_at"?: string,"description"?: string | null,"est_hours"?: number,"id"?: string,"pets"?: string | null,"property_id"?: string,"rate"?: number,"schedule"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cleaning_jobs_cleaning_status_id_fkey"
      columns: ["cleaning_status_id"]
isOneToOne: false
      referencedRelation: "cleaning_statuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_jobs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cleaning_jobs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"cleaning_statuses": {
                  Row: {
                    "color_motif": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_motif"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "color_motif"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cleaning_types": {
                  Row: {
                    "color_motif": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_motif"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "color_motif"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"clients": {
                  Row: {
                    "company_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "company_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "color_motif": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color_motif"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "color_motif"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"company_cleaners": {
                  Row: {
                    "cleaner_id": string,"company_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaner_id": string,"company_id": string,"id"?: string
                  }
                  Update: {
                    "cleaner_id"?: string,"company_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_cleaners_cleaner_id_fkey"
      columns: ["cleaner_id"]
isOneToOne: false
      referencedRelation: "cleaners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_cleaners_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "client_id": string,"contact_no": string,"first_name": string,"id": string,"last_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"contact_no": string,"first_name": string,"id"?: string,"last_name": string
                  }
                  Update: {
                    "client_id"?: string,"contact_no"?: string,"first_name"?: string,"id"?: string,"last_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "description": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"preferred_time_zone": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string,"preferred_time_zone"?: string,"role_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"preferred_time_zone"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    }
                  ]
                },"properties": {
                  Row: {
                    "address_line_1": string,"address_line_2": string | null,"city": string,"client_id": string,"country_code": string,"id": string,"parking_instructions": string | null,"postal_code": string,"property_type_id": string,"province_state": string,"sqft": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line_1": string,"address_line_2"?: string | null,"city": string,"client_id": string,"country_code": string,"id"?: string,"parking_instructions"?: string | null,"postal_code": string,"property_type_id": string,"province_state": string,"sqft"?: number | null
                  }
                  Update: {
                    "address_line_1"?: string,"address_line_2"?: string | null,"city"?: string,"client_id"?: string,"country_code"?: string,"id"?: string,"parking_instructions"?: string | null,"postal_code"?: string,"property_type_id"?: string,"province_state"?: string,"sqft"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "properties_property_type_id_fkey"
      columns: ["property_type_id"]
isOneToOne: false
      referencedRelation: "property_types"
      referencedColumns: ["id"]
    }
                  ]
                },"property_types": {
                  Row: {
                    "id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string
                  }
                  Update: {
                    "id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"roles": {
                  Row: {
                    "id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string
                  }
                  Update: {
                    "id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"todos": {
                  Row: {
                    "created_at": string,"done": boolean,"id": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_update_profile":
{ Args: { "p_display_name": string,"p_role_id": string,"p_user_id": string }; Returns: undefined
                           },
"color_motifs":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"get_cleaners_for_cleaning_job_id":
{ Args: { "p_cleaning_job_id": string }; Returns: {
              "cleaner_id": string,"full_name": string
            }[]
                           },
"get_cleaning_jobs":
{ Args: { "p_cleaner_ids"?: (string)[],"p_cleaning_status_ids"?: (string)[],"p_cleaning_type_ids"?: (string)[],"p_client_ids"?: (string)[],"p_company_ids"?: (string)[],"p_date_from"?: string,"p_date_range"?: string,"p_date_to"?: string,"p_feedback_search"?: string,"p_page"?: number,"p_page_size"?: number,"p_ratings"?: (number)[],"p_sort_by"?: string,"p_sort_dir"?: string,"p_time_zone"?: string }; Returns: {
              "address": string,"avg_rating": number,"cleaners": Json,"cleaning_types": Json,"client_id": string,"client_name": string,"company_color": string,"company_name": string,"description": string,"feedbacks": Json,"id": string,"rate": number,"schedule": string,"status_color": string,"status_name": string,"total_count": number
            }[]
                           },
"get_client_feedbacks_for_cleaning_job_id":
{ Args: { "p_cleaning_job_id": string }; Returns: {
              "created_at": string,"feedback": string,"id": string,"rating": number
            }[]
                           },
"get_complete_address_for_property_id":
{ Args: { "p_property_id": string }; Returns: string
                           },
"has_permission":
{ Args: { "p_action": string,"p_resource": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_time_zone":
{ Args: { "tz": string }; Returns: boolean
                           },
"todo_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "done": number,"pct_done": number,"pending": number,"total": number
            }[]
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
            
          }
        }
} as const
