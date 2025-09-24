import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com service role para operações administrativas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Buscar o perfil do usuário para obter org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    console.log('[ChatbotManager] Desativando todos os chatbots da organização:', profile.org_id);
    
    // Desativar todos os chatbots da organização
    const { data: deactivatedChatbots, error: updateError } = await supabaseAdmin
      .from('chatbots')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', profile.org_id)
      .select('id, name');

    if (updateError) {
      console.error('Erro ao desativar chatbots:', updateError)
      return NextResponse.json({ error: 'Erro ao desativar chatbots' }, { status: 500 })
    }

    console.log('[ChatbotManager] Chatbots desativados:', deactivatedChatbots?.length || 0);

    return NextResponse.json({ 
      success: true, 
      message: 'Todos os chatbots foram desativados',
      deactivated_count: deactivatedChatbots?.length || 0,
      deactivated_chatbots: deactivatedChatbots
    })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}