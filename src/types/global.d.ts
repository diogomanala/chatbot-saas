// Supressão global de tipos para Supabase
declare global {
  namespace Supabase {
    interface Database {
      [key: string]: any;
    }
  }
}

// Extensão do módulo Supabase para permitir tipos mais flexíveis
declare module '@supabase/supabase-js' {
  interface PostgrestQueryBuilder {
    insert(values: any, options?: any): any;
    update(values: any, options?: any): any;
    upsert(values: any, options?: any): any;
  }
  
  interface PostgrestFilterBuilder {
    insert(values: any, options?: any): any;
    update(values: any, options?: any): any;
    upsert(values: any, options?: any): any;
  }
  
  interface PostgrestBuilder {
    insert(values: any, options?: any): any;
    update(values: any, options?: any): any;
    upsert(values: any, options?: any): any;
  }
}

export {};