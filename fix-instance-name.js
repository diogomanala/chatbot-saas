require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixInstanceName() {
  try {
    console.log('🔧 [FIX] Corrigindo instância do dispositivo...')
    
    const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f'
    const correctInstanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77'
    
    // Atualizar o dispositivo com a instância correta
    const { data, error } = await supabase
      .from('devices')
      .update({
        session_name: correctInstanceName,
        instance_id: correctInstanceName,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId)
      .select()
    
    if (error) {
      console.error('❌ [ERROR] Erro ao atualizar dispositivo:', error)
      return
    }
    
    console.log('✅ [SUCCESS] Dispositivo atualizado com sucesso!')
    console.log('📱 [DEVICE] Dados atualizados:', {
      id: data[0]?.id,
      session_name: data[0]?.session_name,
      instance_id: data[0]?.instance_id,
      updated_at: data[0]?.updated_at
    })
    
  } catch (error) {
    console.error('❌ [ERROR] Erro geral:', error)
  }
}

fixInstanceName()