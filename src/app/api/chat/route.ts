import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openaiService } from '@/lib/openai-service';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { message, chatbotId, sessionId } = await request.json();

    if (!message || !chatbotId) {
      return NextResponse.json(
        { error: 'Mensagem e ID do chatbot são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar o chatbot
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('id', chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { error: 'Chatbot não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o chatbot está ativo
    if (chatbot.status !== 'active') {
      return NextResponse.json(
        { error: 'Chatbot não está ativo' },
        { status: 400 }
      );
    }

    // Buscar a organização do chatbot
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', chatbot.organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organização não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se a organização tem créditos suficientes
    if (organization.credits <= 0) {
      return NextResponse.json(
        { error: 'Créditos insuficientes para enviar mensagem' },
        { status: 402 }
      );
    }

    // Registrar mensagem recebida
    const messageId = uuidv4();
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        id: messageId,
        chatbot_id: chatbotId,
        organization_id: chatbot.organization_id,
        from_number: 'test_user',
        to_number: chatbot.phone_number || 'test_bot',
        message_content: message,
        message_type: 'text',
        direction: 'inbound',
        status: 'received',
        tokens: 0,
        session_id: sessionId || `test_${Date.now()}`,
        created_at: new Date().toISOString()
      });

    if (messageError) {
      console.error('Erro ao salvar mensagem:', messageError);
      return NextResponse.json(
        { error: 'Erro ao processar mensagem' },
        { status: 500 }
      );
    }

    // Gerar resposta usando OpenAI
    
    try {
      const response = await openaiService.generateResponse(
        message,
        chatbot.system_prompt || 'Você é um assistente útil.',
        chatbot.temperature || 0.7,
        organization.id
      );

      if (!response) {
        return NextResponse.json(
          { error: 'Falha ao gerar resposta' },
          { status: 500 }
        );
      }

      // Registrar mensagem de resposta
      const responseMessageId = uuidv4();
      const { error: responseError } = await supabase
        .from('messages')
        .insert({
          id: responseMessageId,
          chatbot_id: chatbotId,
          organization_id: chatbot.organization_id,
          from_number: chatbot.phone_number || 'test_bot',
          to_number: 'test_user',
          message_content: response.response,
          message_type: 'text',
          direction: 'outbound',
          status: 'sent',
          tokens_used: response.tokensUsed,
          session_id: sessionId || `test_${Date.now()}`,
          created_at: new Date().toISOString()
        });

      if (responseError) {
        console.error('Erro ao salvar resposta:', responseError);
      }

      return NextResponse.json({
        success: true,
        response: response.response,
        tokens_used: response.tokensUsed,
        credits_remaining: organization.credits - 1,
        message_id: responseMessageId
      });

    } catch (openaiError: any) {
      console.error('Erro ao gerar resposta:', openaiError);
      
      // Se houve erro na geração, ainda assim registrar que houve uma tentativa
      const errorMessageId = uuidv4();
      await supabase
        .from('messages')
        .insert({
          id: errorMessageId,
          chatbot_id: chatbotId,
          organization_id: chatbot.organization_id,
          from_number: chatbot.phone_number || 'test_bot',
          to_number: 'test_user',
          message_content: 'Erro ao gerar resposta: ' + (openaiError.message || 'Erro desconhecido'),
          message_type: 'text',
          direction: 'outbound',
          status: 'failed',
          tokens_used: 0,
          session_id: sessionId || `test_${Date.now()}`,
          created_at: new Date().toISOString()
        });

      return NextResponse.json(
        { 
          error: 'Erro ao gerar resposta do chatbot',
          details: openaiError.message || 'Erro desconhecido'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Erro geral na API de chat:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}