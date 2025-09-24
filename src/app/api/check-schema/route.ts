import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🔍 [CHECK-SCHEMA] Verificando estrutura do banco de dados...');
    
    // Verificar estrutura da tabela devices
    const { data: devicesInfo, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    // Verificar estrutura da tabela chatbots
    const { data: chatbotsInfo, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('*')
      .limit(1);
    
    // Contar devices
    const { data: allDevices, error: devicesCountError } = await supabase
      .from('devices')
      .select('id');
    
    // Contar chatbots
    const { data: allChatbots, error: chatbotsCountError } = await supabase
      .from('chatbots')
      .select('id');
    
    // Verificar chatbots default
    const { data: defaultChatbots, error: defaultError } = await supabase
      .from('chatbots')
      .select('id, name, org_id, is_default, is_active')
      .eq('is_default', true)
      .eq('is_active', true);
    
    // Verificar device específico do medical-crm
    const { data: medicalDevice, error: medicalError } = await supabase
      .from('devices')
      .select('id, name, session_name, metadata, org_id')
      .eq('session_name', 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77')
      .limit(1);
    
    // Verificar se device tem chatbot_config no metadata
    let deviceChatbotStatus: any = null;
    if (medicalDevice && medicalDevice.length > 0) {
      const device = medicalDevice[0];
      deviceChatbotStatus = {
        has_chatbot_config_in_metadata: !!(device.metadata?.chatbot_config),
        chatbot_config: device.metadata?.chatbot_config,
        org_id: device.org_id,
        metadata: device.metadata
      };
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      tables: {
        devices: {
           exists: !devicesError,
           error: devicesError?.message || null,
           count: allDevices?.length || 0,
           sample_structure: devicesInfo && devicesInfo.length > 0 ? Object.keys(devicesInfo[0]) : []
         },
         chatbots: {
           exists: !chatbotsError,
           error: chatbotsError?.message || null,
           count: allChatbots?.length || 0,
           sample_structure: chatbotsInfo && chatbotsInfo.length > 0 ? Object.keys(chatbotsInfo[0]) : []
         }
      },
      default_chatbots: {
        count: defaultChatbots?.length || 0,
        error: defaultError?.message || null,
        chatbots: defaultChatbots || []
      },
      medical_device: {
        found: medicalDevice && medicalDevice.length > 0,
        error: medicalError?.message || null,
        device: medicalDevice && medicalDevice.length > 0 ? medicalDevice[0] : null,
        chatbot_status: deviceChatbotStatus
      },
      issues: [] as string[]
    };
    
    // Identificar problemas
    if (devicesError) result.issues.push('Tabela devices não encontrada ou inacessível');
    if (chatbotsError) result.issues.push('Tabela chatbots não encontrada ou inacessível');
    if (!defaultChatbots || defaultChatbots.length === 0) {
      result.issues.push('Nenhum chatbot default encontrado');
    }
    if (medicalDevice && medicalDevice.length > 0) {
      const device = medicalDevice[0];
      if (!device.chatbot_id && !device.metadata?.chatbot_config) {
        result.issues.push('Device medical-crm sem chatbot configurado');
      }
    } else {
      result.issues.push('Device medical-crm não encontrado');
    }
    
    console.log('📊 [CHECK-SCHEMA] Resultado:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ [CHECK-SCHEMA] Erro:', error);
    return NextResponse.json(
      { 
        error: 'Schema check failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}