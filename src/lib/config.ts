/**
 * Configuração central para variáveis de ambiente da aplicação
 * Centraliza o acesso às variáveis de ambiente para evitar duplicação e facilitar manutenção
 */

export const config = {
  // Evolution API Configuration
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },
  
  // Application URLs
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || '',
  },
  
  // Supabase Configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
} as const;

/**
 * Valida se as variáveis de ambiente essenciais estão configuradas
 * @param requiredKeys - Array de chaves que devem estar presentes
 * @throws Error se alguma variável obrigatória estiver ausente
 */
export function validateConfig(requiredKeys: string[] = []) {
  const missingKeys: string[] = [];
  
  // Validações padrão
  if (!config.evolution.apiUrl) missingKeys.push('EVOLUTION_API_URL');
  if (!config.evolution.apiKey) missingKeys.push('EVOLUTION_API_KEY');
  if (!config.app.url) missingKeys.push('NEXT_PUBLIC_APP_URL');
  if (!config.supabase.url) missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!config.supabase.anonKey) missingKeys.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // Validações adicionais específicas
  requiredKeys.forEach(key => {
    if (!process.env[key]) {
      missingKeys.push(key);
    }
  });
  
  if (missingKeys.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não configuradas: ${missingKeys.join(', ')}`);
  }
}

/**
 * Constrói uma URL completa para a Evolution API
 * @param endpoint - Endpoint da API (ex: '/instance/connect')
 * @param baseUrl - URL base opcional (usa config.evolution.apiUrl por padrão)
 * @returns URL completa formatada corretamente
 */
export function buildEvolutionApiUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl || config.evolution.apiUrl;
  
  if (!base) {
    throw new Error('Evolution API URL não configurada');
  }
  
  // Remove aspas duplas que podem estar na variável de ambiente
  const cleanBase = base.replace(/["']/g, '').replace(/\/+$/, ''); // Remove aspas e barras no final
  const cleanEndpoint = endpoint.replace(/^\/+/, ''); // Remove barras no início
  
  return `${cleanBase}/${cleanEndpoint}`;
}

/**
 * Headers padrão para requisições à Evolution API
 */
export function getEvolutionApiHeaders(apiKey?: string) {
  return {
    'Content-Type': 'application/json',
    'apikey': apiKey || config.evolution.apiKey,
  };
}