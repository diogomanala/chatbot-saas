// Script para criar usuário Super Admin automaticamente
// Execute com: node create-super-admin.js

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Chave de serviço (admin)

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

async function createSuperAdmin() {
  try {
    console.log('🚀 Criando usuário Super Admin...')
    
    const email = 'web@logintecnologia.com.br'
    const password = '123456'
    const fullName = 'Super Admin'
    
    // 1. Criar usuário na auth
    console.log('📝 Criando usuário na autenticação...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Confirma email automaticamente
    })
    
    if (authError) {
      console.error('❌ Erro ao criar usuário na auth:', authError.message)
      return
    }
    
    console.log('✅ Usuário criado na auth:', authData.user.id)
    
    // 2. Criar organização para o super admin
    console.log('🏢 Criando organização super admin...')
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Super Admin Organization',
        owner_user_id: authData.user.id
      })
      .select()
      .single()
    
    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError.message)
      return
    }
    
    console.log('✅ Organização criada:', orgData.id)
    
    // 3. Criar perfil como super admin
    console.log('👤 Criando perfil super admin...')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        org_id: orgData.id,
        full_name: fullName,
        role: 'super_admin'
      }, {
        onConflict: 'id'
      })
      .select()
    
    if (profileError) {
      console.error('❌ Erro ao criar perfil:', profileError.message)
      return
    }
    
    console.log('✅ Perfil super admin criado com sucesso!')
    console.log('📧 Email:', email)
    console.log('🔑 Senha:', password)
    console.log('🔗 Acesse: http://localhost:3000/super-admin')
    console.log('')
    console.log('🎉 Super Admin criado com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

// Executar o script
createSuperAdmin()