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
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          owner_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_user_id?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          org_id: string
          role: 'owner' | 'admin' | 'member'
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          org_id: string
          role?: 'owner' | 'admin' | 'member'
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: 'owner' | 'admin' | 'member'
          full_name?: string | null
          created_at?: string
        }
      }
      devices: {
        Row: {
          id: string
          org_id: string
          name: string
          session_name: string
          status: 'disconnected' | 'qr' | 'connecting' | 'connected' | 'error'
          evolution_base_url: string
          evolution_api_key: string
          last_connection: string | null
          webhook_secret: string
          metadata: Json
          created_at: string
          instance_id: string | null
          chatbot_id: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          session_name: string
          status?: 'disconnected' | 'qr' | 'connecting' | 'connected' | 'error'
          evolution_base_url: string
          evolution_api_key: string
          last_connection?: string | null
          webhook_secret: string
          metadata?: Json
          created_at?: string
          instance_id?: string | null
          chatbot_id?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          session_name?: string
          status?: 'disconnected' | 'qr' | 'connecting' | 'connected' | 'error'
          evolution_base_url?: string
          evolution_api_key?: string
          last_connection?: string | null
          webhook_secret?: string
          metadata?: Json
          created_at?: string
          instance_id?: string | null
          chatbot_id?: string | null
        }
      }
      chatbots: {
        Row: {
          id: string
          org_id: string
          device_id: string | null
          name: string
          groq_model: string
          temperature: number
          system_prompt: string
          company_prompt: string | null
          business_hours: string | null
          fallback_message: string | null
          auto_response_enabled: boolean
          business_context: string | null
          response_rules: string | null
          default_fallback_enabled: boolean
          webhook_url: string | null
          training_prompt: string | null
          is_active: boolean
          working_hours_start: number | null
          working_hours_end: number | null
          out_of_hours_message: string | null
          use_ai_training: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          device_id?: string | null
          name: string
          groq_model?: string
          temperature?: number
          system_prompt?: string
          company_prompt?: string | null
          business_hours?: string | null
          fallback_message?: string | null
          auto_response_enabled?: boolean
          business_context?: string | null
          response_rules?: string | null
          default_fallback_enabled?: boolean
          webhook_url?: string | null
          training_prompt?: string | null
          is_active?: boolean
          working_hours_start?: number | null
          working_hours_end?: number | null
          out_of_hours_message?: string | null
          use_ai_training?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          device_id?: string | null
          name?: string
          groq_model?: string
          temperature?: number
          system_prompt?: string
          company_prompt?: string | null
          business_hours?: string | null
          fallback_message?: string | null
          auto_response_enabled?: boolean
          business_context?: string | null
          response_rules?: string | null
          default_fallback_enabled?: boolean
          webhook_url?: string | null
          training_prompt?: string | null
          is_active?: boolean
          working_hours_start?: number | null
          working_hours_end?: number | null
          out_of_hours_message?: string | null
          use_ai_training?: boolean
          created_at?: string
        }
      }
      intents: {
        Row: {
          id: string
          chatbot_id: string
          name: string
          patterns: string[]
          responses: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chatbot_id: string
          name: string
          patterns: string[]
          responses: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chatbot_id?: string
          name?: string
          patterns?: string[]
          responses?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          org_id: string
          device_id: string
          direction: 'inbound' | 'outbound'
          phone_from: string
          phone_to: string
          body: string | null
          msg_type: string
          status: string
          external_id: string | null
          tokens_used: number | null
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          org_id: string
          device_id: string
          direction: 'inbound' | 'outbound'
          phone_from: string
          phone_to: string
          body?: string | null
          msg_type?: string
          status?: string
          external_id?: string | null
          tokens_used?: number | null
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          org_id?: string
          device_id?: string
          direction?: 'inbound' | 'outbound'
          phone_from?: string
          phone_to?: string
          body?: string | null
          msg_type?: string
          status?: string
          external_id?: string | null
          tokens_used?: number | null
          created_at?: string
          metadata?: Json
        }
      }
      credit_wallets: {
        Row: {
          id: string
          org_id: string
          balance: number
          plan: string | null
          renew_start: string | null
          renew_end: string | null
          auto_recharge: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          balance?: number
          plan?: string | null
          renew_start?: string | null
          renew_end?: string | null
          auto_recharge?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          balance?: number
          plan?: string | null
          renew_start?: string | null
          renew_end?: string | null
          auto_recharge?: boolean
          created_at?: string
        }
      }
      usage_ledger: {
        Row: {
          id: string
          org_id: string
          message_id: string | null
          utype: 'inbound' | 'outbound' | 'ai'
          units: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          message_id?: string | null
          utype: 'inbound' | 'outbound' | 'ai'
          units: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          message_id?: string | null
          utype?: 'inbound' | 'outbound' | 'ai'
          units?: number
          note?: string | null
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          org_id: string
          key_hash: string
          created_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          key_hash: string
          created_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          key_hash?: string
          created_at?: string
          last_used_at?: string | null
        }
      }
      conversation_history: {
        Row: {
          id: string
          chatbot_id: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          organization_id: string
          created_at: string
        }
        Insert: {
          id?: string
          chatbot_id: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          organization_id: string
          created_at?: string
        }
        Update: {
          id?: string
          chatbot_id?: string
          session_id?: string
          role?: 'user' | 'assistant'
          content?: string
          organization_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      v_user_orgs: {
        Row: {
          user_id: string
          org_id: string
        }
      }
    }
    Functions: {
      sp_debit_credits: {
        Args: {
          p_org_id: string
          p_units: number
          p_note?: string
        }
        Returns: boolean
      }
    }
  }
}