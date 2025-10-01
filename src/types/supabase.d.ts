// Importar o tipo Database do arquivo database.types.ts
export type { Database } from './database.types';

declare module '@supabase/supabase-js' {
  interface PostgrestFilterBuilder {
    insert(values: any, options?: any): any;
    update(values: any, options?: any): any;
    upsert(values: any, options?: any): any;
  }

  interface SupabaseClient {
    rpc(fn: 'sp_debit_credits', args: {
      p_org_id: string;
      p_units: number;
      p_note?: string;
    }): any;
    rpc(fn: string, args?: any): any;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// Tipos específicos para o projeto - EXPORTADOS
export interface ChatbotWithIntents {
  id: string;
  name: string;
  intents: Intent[];
  [key: string]: any;
}

export interface Intent {
  id: string;
  name: string;
  patterns: string[];
  responses: string[];
  [key: string]: any;
}