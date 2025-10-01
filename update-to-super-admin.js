// Script para atualizar usuário existente para Super Admin
// Execute com: node update-to-super-admin.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.log('Certifique-se de ter NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateToSuperAdmin() {
  try {
    console.log('🚀 Atualizando usuário para Super Admin...')
    
    const email = 'web@logintecnologia.com.br'
    
    // 1. Buscar usuário existente
    console.log('🔍 Buscando usuário existente...')
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers()
    
    if (getUserError) {
      console.error('❌ Erro ao buscar usuários:', getUserError.message)
      return
    }
    
    const existingUser = users.users.find(user => user.email === email)
    
    if (!existingUser) {
      console.error('❌ Usuário não encontrado:', email)
      console.log('💡 O usuário precisa se registrar primeiro em http://localhost:3000')
      return
    }
    
    console.log('✅ Usuário encontrado:', existingUser.id)
    
    // 2. Verificar se já tem organização
    console.log('🏢 Verificando organização...')
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', existingUser.id)
      .single()
    
    let orgId = null
    
    if (profileError || !existingProfile) {
      console.log('🏢 Criando organização super admin...')
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Super Admin Organization',
          owner_user_id: existingUser.id
        })
        .select()
        .single()
      
      if (orgError) {
        console.error('❌ Erro ao criar organização:', orgError.message)
        return
      }
      
      orgId = orgData.id
      console.log('✅ Organização criada:', orgId)
    } else {
      orgId = existingProfile.org_id
      console.log('✅ Organização existente:', orgId)
    }
    
    // 3. Atualizar/criar perfil como super admin
    console.log('👤 Atualizando perfil para super admin...')
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: existingUser.id,
        org_id: orgId,
        full_name: 'Super Admin',
        role: 'super_admin'
      }, {
        onConflict: 'id'
      })
      .select()
    
    if (updateError) {
      console.error('❌ Erro ao atualizar perfil:', updateError.message)
      return
    }
    
    console.log('✅ Perfil super admin atualizado com sucesso!')
    console.log('📧 Email:', email)
    console.log('🔑 Senha: (use a senha que você definiu ao se registrar)')
    console.log('🔗 Acesse: http://localhost:3000/super-admin')
    console.log('')
    console.log('🎉 Super Admin configurado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

// Executar o script
updateToSuperAdmin()