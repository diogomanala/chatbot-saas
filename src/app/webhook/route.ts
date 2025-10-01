import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Handler POST para receber mensagens do webhook
export async function POST(request: NextRequest) {
  try {
    console.log('📨 Webhook recebido');
    
    const body = await request.json();
    console.log('📋 Payload recebido:', JSON.stringify(body, null, 2));

    // Verificar se é uma mensagem válida
    if (!body.data || !body.data.message) {
      console.log('⚠️  Payload inválido - sem mensagem');
      return NextResponse.json({ 
        success: false, 
        error: 'Payload inválido' 
      }, { status: 400 });
    }

    const messageData = body.data.message;
    
    // Salvar mensagem no banco de dados
    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert({
        phone: messageData.key?.remoteJid || 'unknown',
        message: messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || 'Mensagem sem texto',
        type: 'received',
        timestamp: new Date().toISOString(),
        raw_data: body
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Erro ao salvar mensagem:', saveError);
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao salvar mensagem' 
      }, { status: 500 });
    }

    console.log('✅ Mensagem salva:', savedMessage.id);

    // Processar resposta do chatbot
    try {
      const response = await processMessage(messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '');
      
      // Salvar resposta no banco
      const { error: responseError } = await supabase
        .from('messages')
        .insert({
          phone: messageData.key?.remoteJid || 'unknown',
          message: response,
          type: 'sent',
          timestamp: new Date().toISOString(),
          parent_message_id: savedMessage.id
        });

      if (responseError) {
        console.error('❌ Erro ao salvar resposta:', responseError);
      } else {
        console.log('✅ Resposta salva');
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Mensagem processada com sucesso',
        response: response
      });
      
    } catch (processError) {
      console.error('❌ Erro ao processar mensagem:', processError);
      return NextResponse.json({ 
        success: true, 
        message: 'Mensagem salva, mas erro no processamento'
      });
    }

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

// Handler GET para verificar status
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Webhook endpoint funcionando',
    timestamp: new Date().toISOString()
  });
}

// Função para processar mensagem com IA
async function processMessage(message: string): Promise<string> {
  try {
    // Chamar a Supabase Function
    const { data, error } = await supabase.functions.invoke('process-message', {
      body: { message }
    });

    if (error) {
      console.error('❌ Erro na Supabase Function:', error);
      return 'Desculpe, ocorreu um erro ao processar sua mensagem.';
    }

    return data?.response || 'Resposta não disponível.';
  } catch (error) {
    console.error('❌ Erro ao chamar Supabase Function:', error);
    return 'Desculpe, não consegui processar sua mensagem no momento.';
  }
}