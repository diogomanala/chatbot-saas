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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Buscar todos os chatbots sem autenticação para debug
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('id, name, is_active, org_id, created_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erro ao buscar chatbots:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const activeChatbots = chatbots?.filter((bot: any) => bot.is_active) || []
    
    return NextResponse.json({
      total_chatbots: chatbots?.length || 0,
      active_chatbots: activeChatbots.length,
      chatbots: chatbots?.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        is_active: bot.is_active,
        org_id: bot.org_id,
        created_at: bot.created_at
      })) || [],
      problem_detected: activeChatbots.length > 1,
      active_chatbot_details: activeChatbots.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        org_id: bot.org_id
      }))
    })
  } catch (error) {
    console.error('Erro interno:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}