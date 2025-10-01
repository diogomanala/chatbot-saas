import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json(
        { error: 'ID do dispositivo é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 Forçando reconexão do dispositivo: ${deviceId}`);

    // 1. Buscar o dispositivo no banco
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Dispositivo não encontrado' },
        { status: 404 }
      );
    }

    console.log(`📱 Dispositivo encontrado: ${device.name} (${device.instance_id})`);

    const steps = [];

    try {
      // 2. Tentar desconectar a instância atual
      console.log('🔌 Desconectando instância atual...');
      await axios.delete(
        `${EVOLUTION_API_URL}/instance/logout/${device.instance_id}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY
          }
        }
      );
      steps.push('Instância desconectada');
    } catch (logoutError: any) {
      console.log('⚠️ Erro ao desconectar (pode já estar desconectada):', logoutError.response?.data?.message);
      steps.push('Tentativa de desconexão (pode já estar desconectada)');
    }

    // 3. Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // 4. Deletar a instância completamente
      console.log('🗑️ Deletando instância...');
      await axios.delete(
        `${EVOLUTION_API_URL}/instance/delete/${device.instance_id}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY
          }
        }
      );
      steps.push('Instância deletada');
    } catch (deleteError: any) {
      console.log('⚠️ Erro ao deletar instância:', deleteError.response?.data?.message);
      steps.push('Tentativa de deleção da instância');
    }

    // 5. Aguardar um pouco mais
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 6. Criar nova instância
    console.log('🆕 Criando nova instância...');
    const createResponse = await axios.post(
      `${EVOLUTION_API_URL}/instance/create`,
      {
        instanceName: device.instance_id,
        token: device.instance_id,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      }
    );

    steps.push('Nova instância criada');
    console.log('✅ Nova instância criada com sucesso');

    // 7. Configurar webhook
    console.log('🔗 Configurando webhook...');
    try {
      await axios.post(
        `${EVOLUTION_API_URL}/webhook/set/${device.instance_id}`,
        {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/whatsapp`,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONTACTS_SET',
            'CONTACTS_UPSERT',
            'CONTACTS_UPDATE',
            'PRESENCE_UPDATE',
            'CHATS_SET',
            'CHATS_UPSERT',
            'CHATS_UPDATE',
            'CHATS_DELETE',
            'GROUPS_UPSERT',
            'GROUP_UPDATE',
            'GROUP_PARTICIPANTS_UPDATE',
            'NEW_JWT_TOKEN',
            'TYPEBOT_START',
            'TYPEBOT_CHANGE_STATUS'
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          }
        }
      );
      steps.push('Webhook configurado');
      console.log('✅ Webhook configurado');
    } catch (webhookError: any) {
      console.error('❌ Erro ao configurar webhook:', webhookError.response?.data);
      steps.push('Erro ao configurar webhook');
    }

    // 8. Atualizar status no banco
    const { error: updateError } = await supabase
      .from('devices')
      .update({ 
        status: 'connecting',
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (updateError) {
      console.error('❌ Erro ao atualizar banco:', updateError);
      steps.push('Erro ao atualizar banco de dados');
    } else {
      steps.push('Status atualizado no banco');
    }

    // 9. Buscar QR Code
    let qrCode = null;
    try {
      console.log('📱 Buscando QR Code...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const qrResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/${device.instance_id}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY
          }
        }
      );
      
      qrCode = qrResponse.data?.base64 || qrResponse.data?.qrcode?.base64;
      if (qrCode) {
        steps.push('QR Code gerado');
        console.log('✅ QR Code obtido');
      }
    } catch (qrError: any) {
      console.log('⚠️ Erro ao obter QR Code:', qrError.response?.data?.message);
      steps.push('Erro ao obter QR Code (normal se já conectado)');
    }

    return NextResponse.json({
      success: true,
      message: 'Reconexão forçada iniciada com sucesso',
      device: {
        id: device.id,
        name: device.name,
        sessionName: device.session_name
      },
      steps,
      qrCode,
      nextSteps: [
        'Escaneie o QR Code com seu WhatsApp',
        'Aguarde a confirmação de conexão',
        'Verifique o status na página de dispositivos'
      ]
    });

  } catch (error: any) {
    console.error('❌ Erro na reconexão forçada:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}