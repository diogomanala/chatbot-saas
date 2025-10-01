// Tipos específicos para operações do Supabase
// Este arquivo resolve os problemas de tipo 'never' nas operações CRUD

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    from<T extends string>(relation: T): {
      select: (columns?: string) => any
      insert: (values: any, options?: any) => any
      update: (values: any, options?: any) => any
      upsert: (values: any, options?: any) => any
      delete: () => any
    }
  }
}

// Extensão global para resolver tipos 'never'
declare global {
  namespace Supabase {
    interface Database {
      public: {
        Tables: {
          devices: {
            Row: any
            Insert: any
            Update: any
          }
          messages: {
            Row: any
            Insert: any
            Update: any
          }
          intents: {
            Row: any
            Insert: any
            Update: any
          }
          chatbots: {
            Row: any
            Insert: any
            Update: any
          }
        }
        Functions: {
          sp_debit_credits: {
            Args: any
            Returns: any
          }
        }
      }
    }
  }
}

export {}