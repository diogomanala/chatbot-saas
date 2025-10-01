// Utilitário para carregar variáveis de ambiente explicitamente
import { config } from 'dotenv';
import path from 'path';

// Carrega as variáveis de ambiente do arquivo .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

// Exporta as variáveis necessárias
export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
};

// Função para verificar se as variáveis críticas estão carregadas
export function validateCriticalEnvVars() {
  const missing: string[] = [];
  
  if (!ENV.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ENV.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente críticas não encontradas:', missing);
    return false;
  }
  
  console.log('✅ Variáveis de ambiente críticas carregadas com sucesso');
  return true;
}