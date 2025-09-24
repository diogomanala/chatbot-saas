import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { createSuperAdminLogger } from '@/lib/super-admin-logger'

// Supabase Admin Client (com service role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Verificar se o usuário é super admin
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { error: 'Token de autorização não fornecido', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { error: 'Token inválido', status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'super_admin') {
    console.log('[SuperAdmin] Unauthorized access attempt by user:', user.id)
    return { error: 'Acesso negado - Super Admin necessário', status: 403 }
  }

  return { user, profile }
}

// GET - Listar todos os clientes
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Criar logger e registrar acesso ao dashboard
    const logger = await createSuperAdminLogger(authResult.user.id)
    if (logger) {
      await logger.logDashboardAccess(request)
    }

    console.log('[SuperAdmin] Fetching clients list')

    // Buscar todos os perfis com suas organizações
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        role,
        created_at,
        organizations (
          id,
          name,
          created_at
        )
      `)
      .neq('role', 'super_admin')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[SuperAdmin] Error fetching clients:', error)
      return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 })
    }

    // Transformar dados para o formato esperado
    const clients = profiles?.map(profile => ({
      id: profile.id,
      full_name: profile.full_name,
      email: 'N/A', // TODO: Implementar campo email na tabela profiles ou obter de auth.users
      org_name: profile.organizations?.name || 'Sem organização',
      org_id: profile.organizations?.id,
      status: 'active', // TODO: Implementar lógica real de status
      payment_status: 'paid', // TODO: Implementar lógica real de pagamento
      evolution_instance_id: undefined, // TODO: Implementar integração Evolution API
      api_requests_today: Math.floor(Math.random() * 1000), // TODO: Implementar contagem real
      created_at: profile.created_at,
      plan: 'free' // TODO: Implementar lógica real de planos
    })) || []

    console.log('[SuperAdmin] Retrieved', clients.length, 'clients')
    return NextResponse.json({ clients })

  } catch (error) {
    console.error('[SuperAdmin] Error in GET /api/super-admin/clients:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Criar novo cliente
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { full_name, email, password, org_name } = await request.json()

    // Criar logger
    const logger = await createSuperAdminLogger(authResult.user.id)

    if (!full_name || !email || !password || !org_name) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    console.log('[SuperAdmin] Creating new client:', email)

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    })

    if (authError) {
      console.error('[SuperAdmin] Error creating user:', authError)
      return NextResponse.json({ error: 'Erro ao criar usuário: ' + authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    try {
      // 2. Criar organização
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: org_name,
          slug: org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
          owner_user_id: userId,
          plan: 'free',
          status: 'active'
        })
        .select()
        .single()

      if (orgError) {
        console.error('[SuperAdmin] Error creating organization:', orgError)
        // Rollback: deletar usuário criado
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: 'Erro ao criar organização' }, { status: 500 })
      }

      // 3. Atualizar perfil do usuário
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name,
          org_id: orgData.id,
          role: 'user'
        })
        .eq('id', userId)

      if (profileError) {
        console.error('[SuperAdmin] Error updating profile:', profileError)
        // Rollback: deletar organização e usuário
        await supabaseAdmin.from('organizations').delete().eq('id', orgData.id)
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
      }

      // 4. Criar carteira de créditos
      const { error: walletError } = await supabaseAdmin
        .from('credit_wallets')
        .insert({
          org_id: orgData.id,
          balance: 0,
          auto_recharge: false
        })

      if (walletError) {
        console.error('[SuperAdmin] Error creating credit wallet:', walletError)
        // Não fazer rollback por ser não crítico
      }

      // TODO: 5. Criar instância na Evolution API
      console.log('[SuperAdmin] TODO: Create Evolution API instance for org:', orgData.id)

      console.log('[SuperAdmin] Client created successfully:', {
        userId,
        orgId: orgData.id,
        email,
        orgName: org_name
      })

      // Log da criação do cliente
       if (logger) {
         await logger.logClientCreation(email, userId, {
           full_name,
           org_name
         }, request)
       }

      return NextResponse.json({
        success: true,
        client: {
          id: userId,
          full_name,
          email,
          org_name,
          org_id: orgData.id,
          status: 'active',
          created_at: new Date().toISOString()
        }
      })

    } catch (error) {
      console.error('[SuperAdmin] Error in client creation process:', error)
      // Rollback: deletar usuário
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Erro no processo de criação' }, { status: 500 })
    }

  } catch (error) {
    console.error('[SuperAdmin] Error in POST /api/super-admin/clients:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PATCH - Atualizar status do cliente
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request)
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { client_id, action, value } = await request.json()

    // Criar logger
    const logger = await createSuperAdminLogger(authResult.user.id)

    if (!client_id || !action) {
      return NextResponse.json({ error: 'client_id e action são obrigatórios' }, { status: 400 })
    }

    console.log('[SuperAdmin] Updating client:', client_id, 'action:', action, 'value:', value)

    switch (action) {
      case 'toggle_status':
        // Buscar organização do cliente
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('org_id')
          .eq('id', client_id)
          .single()

        if (profileError || !profile?.org_id) {
          return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
        }

        // Atualizar status da organização
        const newStatus = value === 'active' ? 'inactive' : 'active'
        const { error: updateError } = await supabaseAdmin
          .from('organizations')
          .update({ status: newStatus })
          .eq('id', profile.org_id)

        if (updateError) {
          console.error('[SuperAdmin] Error updating organization status:', updateError)
          return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
        }

        console.log('[SuperAdmin] Client status updated:', client_id, 'new status:', newStatus)
        
        // Log da alteração de status
         if (logger) {
           // Buscar email do cliente para o log
           const { data: clientData } = await supabaseAdmin
             .from('profiles')
             .select('email')
             .eq('id', client_id)
             .single()
           
           await logger.logStatusToggle(client_id, clientData?.email || '', value, newStatus, request)
         }
        
        return NextResponse.json({ success: true, new_status: newStatus })

      case 'toggle_payment':
        const newPaymentStatus = value === 'paid' ? 'overdue' : 'paid'
        
        const { error: paymentError } = await supabaseAdmin
          .from('profiles')
          .update({ payment_status: newPaymentStatus })
          .eq('id', client_id)

        if (paymentError) {
          console.error('[SuperAdmin] Error updating payment status:', paymentError)
          return NextResponse.json({ error: 'Erro ao atualizar status de pagamento' }, { status: 500 })
        }

        console.log('[SuperAdmin] Payment status updated:', client_id, 'to', newPaymentStatus)
        
        // Log da alteração de status de pagamento
         if (logger) {
           // Buscar email do cliente para o log
           const { data: clientData } = await supabaseAdmin
             .from('profiles')
             .select('email')
             .eq('id', client_id)
             .single()
           
           await logger.logPaymentStatusToggle(client_id, clientData?.email || '', value, newPaymentStatus, request)
         }
        
        return NextResponse.json({ success: true, new_payment_status: newPaymentStatus })

      case 'reset_api_key':
        // Gerar nova chave de API
        const newApiKey = `evo_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
        
        const { error: apiKeyError } = await supabaseAdmin
          .from('profiles')
          .update({ api_key: newApiKey })
          .eq('id', client_id)

        if (apiKeyError) {
          console.error('[SuperAdmin] Error resetting API key:', apiKeyError)
          return NextResponse.json({ error: 'Erro ao resetar chave de API' }, { status: 500 })
        }

        console.log('[SuperAdmin] API key reset for client:', client_id)
        
        // Log do reset da chave de API
         if (logger) {
           // Buscar email do cliente para o log
           const { data: clientData } = await supabaseAdmin
             .from('profiles')
             .select('email')
             .eq('id', client_id)
             .single()
           
           await logger.logApiKeyReset(client_id, clientData?.email || '', request)
         }
        
        return NextResponse.json({ success: true, new_api_key: newApiKey })

      default:
        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 })
    }

  } catch (error) {
    console.error('[SuperAdmin] Error in PATCH /api/super-admin/clients:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}