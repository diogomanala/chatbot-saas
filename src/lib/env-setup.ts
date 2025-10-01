// Configuração global de variáveis de ambiente
// Este arquivo deve ser importado ANTES de qualquer outro código que use variáveis de ambiente

import { config } from 'dotenv';
import path from 'path';

// Força o carregamento das variáveis de ambiente do .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const result = config({ path: envPath });

if (result.error) {
  console.error('❌ Erro ao carregar .env.local:', result.error);
} else {
  console.log('✅ Variáveis de ambiente carregadas do .env.local');
}

// Log das variáveis críticas para debug
console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'undefined');
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : 'undefined');

// Exporta as variáveis para garantir que estejam disponíveis
export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
};

export {}; // Torna este arquivo um módulo