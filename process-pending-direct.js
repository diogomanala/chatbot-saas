// Script para processar mensagens pendentes diretamente via Edge Function
require('dotenv').config({ path: '.env.local' });

async function processPendingMessages() {
  try {
    console.log('🔄 Processando mensagens pendentes via Edge Function...');
    
    const response = await fetch('https://anlemekgocrrllsogxix.supabase.co/functions/v1/process-pending-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: process.env.CRON_SECRET || 'billing-cron-secret-2024'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro HTTP ${response.status}:`, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Resultado:', result);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

processPendingMessages();