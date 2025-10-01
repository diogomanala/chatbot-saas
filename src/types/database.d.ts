// Tipos específicos para o banco de dados
export interface Database {
  public: {
    Tables: {
      chatbots: {
        Row: {
          id: string;
          name: string;
          description?: string;
          is_active: boolean;
          org_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          is_active?: boolean;
          org_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          is_active?: boolean;
          org_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      intents: {
        Row: {
          id: string;
          name: string;
          description?: string;
          patterns: string[];
  responses: string[];
          chatbot_id: string;
          org_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          patterns: string[];
  responses: string[];
          chatbot_id: string;
          org_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          patterns?: string[];
  responses?: string[];
          chatbot_id?: string;
          org_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      devices: {
        Row: {
          id: string;
          name: string;
          instance_id: string;
          status: string;
          qr_code?: string;
          org_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          instance_id: string;
          status?: string;
          qr_code?: string;
          org_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          instance_id?: string;
          status?: string;
          qr_code?: string;
          org_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          content: string;
          from_number: string;
          to_number: string;
          status: string;
          device_id: string;
          org_id: string;
          is_from_me: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          from_number: string;
          to_number: string;
          status?: string;
          device_id: string;
          org_id: string;
          is_from_me?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          from_number?: string;
          to_number?: string;
          status?: string;
          device_id?: string;
          org_id?: string;
          is_from_me?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      sp_debit_credits: {
        Args: {
          p_org_id: string;
          p_operation_type: string;
          p_amount: number;
          p_description: string;
        };
        Returns: void;
      };
    };
  };
}