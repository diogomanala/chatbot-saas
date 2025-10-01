import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🔧 [FIX-SCHEMA] Iniciando correção do schema...');
    
    const results: {
      timestamp: string;
      operations: string[];
      errors: string[];
    } = {
      timestamp: new Date().toISOString(),
      operations: [],
      errors: []
    };
    
    // 1. Adicionar coluna chatbot_id na tabela devices (se não existir)
    try {
      console.log('📝 [FIX-SCHEMA] Adicionando coluna chatbot_id...');
      
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'devices' AND column_name = 'chatbot_id'
            ) THEN
              ALTER TABLE devices ADD COLUMN chatbot_id UUID REFERENCES chatbots(id);
            END IF;
          END $$;
        `
      });
      
      if (alterError) {
        console.log('⚠️ [FIX-SCHEMA] Tentativa alternativa para adicionar coluna...');
        // Tentativa alternativa usando SQL direto
        const { error: directError } = await supabase
          .from('devices')
          .select('chatbot_id')
          .limit(1);
        
        if (directError && directError.message.includes('does not exist')) {
          results.errors.push('Coluna chatbot_id não existe e não foi possível adicionar automaticamente');
        } else {
          results.operations.push('Coluna chatbot_id já existe ou foi adicionada');
        }
      } else {
        results.operations.push('Coluna chatbot_id adicionada com sucesso');
      }
    } catch (error: any) {
      results.errors.push(`Erro ao adicionar coluna chatbot_id: ${error.message}`);
    }
    
    // 2. Buscar chatbot default
    const { data: defaultChatbot, error: defaultError } = await supabase
      .from('chatbots')
      .select('id, org_id')
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1);
    
    if (defaultError || !defaultChatbot || defaultChatbot.length === 0) {
      results.errors.push('Chatbot default não encontrado');
      console.error('❌ [FIX-SCHEMA] Chatbot default não encontrado');
    } else {
      console.log('✅ [FIX-SCHEMA] Chatbot default encontrado:', defaultChatbot[0].id);
      
      // 3. Verificar se device medical-crm existe
      const medicalSessionName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
      const { data: existingDevice, error: deviceError } = await supabase
        .from('devices')
        .select('id, name, session_name, org_id')
        .eq('session_name', medicalSessionName)
        .limit(1);
      
      if (deviceError) {
        results.errors.push(`Erro ao buscar device: ${deviceError.message}`);
      } else if (!existingDevice || existingDevice.length === 0) {
        // 4. Criar device medical-crm
        console.log('🏗️ [FIX-SCHEMA] Criando device medical-crm...');
        
        const deviceData = {
          name: 'Medical CRM WhatsApp',
          session_name: medicalSessionName,
          org_id: defaultChatbot[0].org_id,
          status: 'connected',
          metadata: {
            chatbot_config: {
              chatbot_id: defaultChatbot[0].id
            },
            auto_created: true,
            created_by: 'fix-schema-endpoint'
          },
          config: {
            language: 'pt-BR',
            auto_reply: true,
            business_hours: {
              enabled: false
            }
          }
        };
        
        // Tentar incluir chatbot_id se a coluna existir
        try {
          const deviceWithChatbotId = {
            ...deviceData,
            chatbot_id: defaultChatbot[0].id
          };
          
          const { data: newDevice, error: createError } = await supabase
            .from('devices')
            .insert([deviceWithChatbotId])
            .select()
            .single();
          
          if (createError) {
            // Se falhar, tentar sem chatbot_id
            console.log('⚠️ [FIX-SCHEMA] Tentando criar sem chatbot_id...');
            const { data: newDeviceAlt, error: createErrorAlt } = await supabase
              .from('devices')
              .insert([deviceData])
              .select()
              .single();
            
            if (createErrorAlt) {
              results.errors.push(`Erro ao criar device: ${createErrorAlt.message}`);
            } else {
              results.operations.push(`Device medical-crm criado (sem chatbot_id): ${newDeviceAlt.id}`);
            }
          } else {
            results.operations.push(`Device medical-crm criado com sucesso: ${newDevice.id}`);
          }
        } catch (error: any) {
          results.errors.push(`Erro ao criar device: ${error.message}`);
        }
      } else {
        results.operations.push(`Device medical-crm já existe: ${existingDevice[0].id}`);
        
        // 5. Atualizar device existente com chatbot_id se necessário
        try {
          const { error: updateError } = await supabase
            .from('devices')
            .update({ chatbot_id: defaultChatbot[0].id })
            .eq('id', existingDevice[0].id);
          
          if (updateError) {
            console.log('⚠️ [FIX-SCHEMA] Não foi possível atualizar chatbot_id');
          } else {
            results.operations.push('Device medical-crm atualizado com chatbot_id');
          }
        } catch (error: any) {
          console.log('⚠️ [FIX-SCHEMA] Coluna chatbot_id ainda não existe');
        }
      }
    }
    
    console.log('📊 [FIX-SCHEMA] Resultado:', JSON.stringify(results, null, 2));
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('❌ [FIX-SCHEMA] Erro geral:', error);
    return NextResponse.json(
      { 
        error: 'Schema fix failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST para executar correções no schema',
    available_operations: [
      'Adicionar coluna chatbot_id na tabela devices',
      'Criar device medical-crm com configuração padrão',
      'Vincular device ao chatbot default'
    ]
  });
}