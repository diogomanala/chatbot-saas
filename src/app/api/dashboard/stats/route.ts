import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar o perfil do usuário para obter o org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil do usuário:', profileError)
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const orgId = profile.org_id

    // Buscar estatísticas de dispositivos
    const { data: devicesData, error: devicesError } = await supabase
      .from('devices')
      .select('id, status')
      .eq('org_id', orgId)

    if (devicesError) {
      console.error('Erro ao buscar dispositivos:', devicesError)
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
    }

    // Buscar estatísticas de chatbots
    const { data: chatbotsData, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id, is_active')
      .eq('org_id', orgId)

    if (chatbotsError) {
      console.error('Erro ao buscar chatbots:', chatbotsError)
      return NextResponse.json({ error: 'Failed to fetch chatbots' }, { status: 500 })
    }

    // Buscar estatísticas de mensagens
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('org_id', orgId)

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Buscar saldo de créditos
    const { data: walletData, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('org_id', orgId)
      .single()

    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Erro ao buscar carteira:', walletError)
      return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
    }

    // Calcular estatísticas
    const totalDevices = devicesData?.length || 0
    const connectedDevices = devicesData?.filter((d: any) => d.status === 'connected').length || 0
    const totalChatbots = chatbotsData?.length || 0
    const activeChatbots = chatbotsData?.filter((c: any) => c.is_active).length || 0
    const totalMessages = messagesData?.length || 0
    const todayMessages = messagesData?.filter((m: any) => 
      new Date(m.created_at) >= today
    ).length || 0
    const creditBalance = walletData?.balance || 0

    const stats = {
      devices: totalDevices,
      connectedDevices,
      chatbots: totalChatbots,
      activeChatbots,
      totalMessages,
      todayMessages,
      creditBalance
    }

    console.log('📊 [DASHBOARD-STATS] Estatísticas calculadas:', stats)

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('❌ [DASHBOARD-STATS] Erro:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}