import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    console.log('🔍 [HEALTH-ENV] Verificando variáveis de ambiente...');
    
    // Verificar variáveis essenciais
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      EVOLUTION_API_URL: !!process.env.EVOLUTION_API_URL,
      EVOLUTION_API_KEY: !!process.env.EVOLUTION_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY
    };
    
    console.log('🔍 [HEALTH-ENV] Variáveis encontradas:', envVars);
    
    // Testar conexão com Supabase usando Service Role
    let supabaseTest = { connected: false, error: null };
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data, error } = await supabase
        .from('devices')
        .select('count')
        .limit(1);
        
      if (error) {
        supabaseTest = { connected: false, error: error.message };
        console.log('❌ [HEALTH-ENV] Erro Supabase:', error.message);
      } else {
        supabaseTest = { connected: true, error: null };
        console.log('✅ [HEALTH-ENV] Supabase conectado com Service Role');
      }
    } catch (err: any) {
      supabaseTest = { connected: false, error: err.message };
      console.log('❌ [HEALTH-ENV] Erro de conexão Supabase:', err.message);
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      environment_variables: envVars,
      supabase_connection: supabaseTest,
      status: supabaseTest.connected ? 'healthy' : 'unhealthy'
    };
    
    console.log('📊 [HEALTH-ENV] Resultado final:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ [HEALTH-ENV] Erro geral:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}