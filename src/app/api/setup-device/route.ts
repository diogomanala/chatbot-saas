import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const instanceId = '97eeeb59-1bd2-49e2-9269-03a0952f07a1';
    const phoneNumber = '+5522996763813';
    
    // Verificar se o device já existe
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('id')
      .eq('instance_id', instanceId)
      .single();

    let deviceId;
    
    if (existingDevice) {
      deviceId = existingDevice.id;
      console.log('Device já existe:', deviceId);
    } else {
      // Criar o device
      const { data: newDevice, error: deviceError } = await supabase
        .from('devices')
        .insert({
          instance_id: instanceId,
          phone_number: phoneNumber,
          session_name: 'wa_login',
          status: 'disconnected',
          org_id: '00000000-0000-0000-0000-000000000000' // UUID padrão
        })
        .select('id')
        .single();

      if (deviceError) {
        console.error('Erro ao criar device:', deviceError);
        return NextResponse.json({ error: deviceError.message }, { status: 500 });
      }

      deviceId = newDevice.id;
      console.log('Device criado:', deviceId);
    }

    // Verificar se já existe um chatbot ativo
    const { data: existingChatbot } = await supabase
      .from('chatbots')
      .select('id')
      .eq('device_id', deviceId)
      .eq('is_active', true)
      .single();

    if (existingChatbot) {
      return NextResponse.json({
        success: true,
        message: 'Device e chatbot já existem',
        device_id: deviceId,
        chatbot_id: existingChatbot.id
      });
    }

    // Criar um chatbot básico
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .insert({
        device_id: deviceId,
        name: 'Chatbot Padrão',
        description: 'Chatbot com resposta automática',
        is_active: true,
        default_fallback_enabled: true,
        fallback_message: 'Olá! Obrigado pela sua mensagem. Em breve entraremos em contato!',
        groq_model: 'llama-3.3-70b-versatile',
        system_prompt: 'Você é um assistente útil e amigável para suporte via WhatsApp. Responda de forma concisa e profissional.',
        temperature: 0.7
      })
      .select('id')
      .single();

    if (chatbotError) {
      console.error('Erro ao criar chatbot:', chatbotError);
      return NextResponse.json({ error: chatbotError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device e chatbot configurados com sucesso',
      device_id: deviceId,
      chatbot_id: chatbot.id,
      instance_id: instanceId
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}