import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    console.log('[FixExclusivity] Iniciando correção de exclusividade...')
    
    // Buscar todos os chatbots
    const { data: chatbots, error: fetchError } = await supabase
      .from('chatbots')
      .select('id, name, is_active, org_id, created_at')
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      console.error('Erro ao buscar chatbots:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    if (!chatbots || chatbots.length === 0) {
      return NextResponse.json({ message: 'Nenhum chatbot encontrado' })
    }
    
    // Agrupar chatbots por organização
    const chatbotsByOrg = chatbots.reduce((acc, bot) => {
      if (!acc[bot.org_id]) {
        acc[bot.org_id] = []
      }
      acc[bot.org_id].push(bot)
      return acc
    }, {} as Record<string, any[]>)
    
    const results = []
    
    // Para cada organização, manter apenas o mais recente ativo
    for (const [orgId, orgChatbots] of Object.entries(chatbotsByOrg)) {
      console.log(`[FixExclusivity] Processando organização ${orgId} com ${(orgChatbots as any[]).length} chatbots`)
      
      // Primeiro, desativar todos os chatbots desta organização
      const { error: deactivateError } = await supabase
        .from('chatbots')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
      
      if (deactivateError) {
        console.error(`Erro ao desativar chatbots da org ${orgId}:`, deactivateError)
        results.push({
          org_id: orgId,
          success: false,
          error: deactivateError.message
        })
        continue
      }
      
      // Ativar apenas o chatbot mais recente
      const mostRecentBot = (orgChatbots as any[]).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      
      const { error: activateError } = await supabase
        .from('chatbots')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', mostRecentBot.id)
      
      if (activateError) {
        console.error(`Erro ao ativar chatbot ${mostRecentBot.id}:`, activateError)
        results.push({
          org_id: orgId,
          success: false,
          error: activateError.message
        })
      } else {
        console.log(`[FixExclusivity] Ativado chatbot '${mostRecentBot.name}' (${mostRecentBot.id}) para org ${orgId}`)
        results.push({
          org_id: orgId,
          success: true,
          active_chatbot: {
            id: mostRecentBot.id,
            name: mostRecentBot.name
          },
          deactivated_count: (orgChatbots as any[]).length - 1
        })
      }
    }
    
    return NextResponse.json({
      message: 'Correção de exclusividade concluída',
      organizations_processed: Object.keys(chatbotsByOrg).length,
      results
    })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}