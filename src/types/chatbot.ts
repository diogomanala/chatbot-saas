// Tipos para o sistema de chatbot

export interface ChatbotConfig {
  id?: string;
  name: string;
  description?: string;
  business_hours?: boolean;
  fallback_message?: string;
  auto_response_enabled?: boolean;
  working_hours_start?: number;
  working_hours_end?: number;
  out_of_hours_message?: string;
  device_id?: string | null;
  is_active?: boolean;
}

export interface Chatbot {
  id: string;
  name: string;
  description?: string | null;
  business_hours?: boolean | null;
  fallback_message?: string | null;
  auto_response_enabled?: boolean | null;
  working_hours_start?: number | null;
  working_hours_end?: number | null;
  out_of_hours_message?: string | null;
  device_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChatbotFormData {
  name: string;
  description?: string;
  business_hours?: boolean;
  fallback_message?: string;
  auto_response_enabled?: boolean;
  working_hours_start?: number;
  working_hours_end?: number;
  out_of_hours_message?: string;
  device_id?: string | null;
  is_active?: boolean;
}
