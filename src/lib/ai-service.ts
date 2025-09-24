import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export interface ChatMessage {
  phone: string
  message: string
  instanceId: string
}

export interface ChatResponse {
  success: boolean
  response?: string
  error?: string
}

/**
 * Serviço de IA Unificado - SIMPLES e ROBUSTO
 * Faz TUDO em um só lugar: busca chatbot, valida, gera resposta
 */
export class AIService {
  
  /**
   * Método principal - processa mensagem e retorna resposta
   */
  async processMessage({ phone, message, instanceId }: ChatMessage): Promise<ChatResponse> {
    try {
      console.log(`🚀 [AI] Processando mensagem de ${phone}`)
      
      // 1. Buscar chatbot ativo
      const chatbot = await this.getChatbot(instanceId)
      if (!chatbot) {
        return { success: false, error: 'Chatbot não encontrado' }
      }

      // 2. Validar configuração
      if (!this.isValidChatbot(chatbot)) {
        return { 
          success: true, 
          response: 'Desculpe, este assistente ainda não foi configurado. Entre em contato com o suporte.' 
        }
      }

      // 3. Gerar resposta
      const response = await this.generateResponse(chatbot, message, phone)
      if (!response) {
        return { success: false, error: 'Falha ao gerar resposta' }
      }

      // 4. Salvar mensagens
      await this.saveMessages(chatbot.id, phone, message, response)

      console.log(`✅ [AI] Resposta gerada com sucesso`)
      return { success: true, response }

    } catch (error) {
      console.error('❌ [AI] Erro:', error)
      return { success: false, error: 'Erro interno' }
    }
  }

  /**
   * Busca chatbot ativo para a instância
   */
  private async getChatbot(instanceId: string) {
    try {
      // Buscar device
      const { data: device } = await supabase
        .from('devices')
        .select('id, org_id, chatbot_id')
        .eq('session_name', instanceId)
        .eq('status', 'connected')
        .single()

      if (!device) return null

      // Buscar chatbot específico do device
      if (device.chatbot_id) {
        const { data: chatbot } = await supabase
          .from('chatbots')
          .select('*')
          .eq('id', device.chatbot_id)
          .eq('is_active', true)
          .single()

        if (chatbot) return chatbot
      }

      // Buscar chatbot genérico da organização
      const { data: orgChatbot } = await supabase
        .from('chatbots')
        .select('*')
        .eq('org_id', device.org_id)
        .is('device_id', null)
        .eq('is_active', true)
        .single()

      return orgChatbot

    } catch (error) {
      console.error('❌ [AI] Erro ao buscar chatbot:', error)
      return null
    }
  }

  /**
   * Valida se chatbot está configurado corretamente
   */
  private isValidChatbot(chatbot: any): boolean {
    return !!(
      chatbot.system_prompt && 
      chatbot.system_prompt.trim().length >= 10
    )
  }

  /**
   * Gera resposta usando OpenAI
   */
  private async generateResponse(chatbot: any, message: string, phone: string): Promise<string | null> {
    try {
      // Buscar histórico recente
      const { data: history } = await supabase
        .from('messages')
        .select('direction, message_content')
        .eq('chatbot_id', chatbot.id)
        .eq('phone_number', phone)
        .order('created_at', { ascending: false })
        .limit(6)

      // Construir mensagens
      const messages = [
        { 
          role: 'system' as const, 
          content: chatbot.system_prompt 
        },
        ...(history || []).reverse().map((msg: any) => ({
          role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: msg.message_content
        })),
        { 
          role: 'user' as const, 
          content: message 
        }
      ]

      // Chamar OpenAI
      const completion = await openai.chat.completions.create({
        model: chatbot.ai_model || 'gpt-4o-mini',
        messages,
        temperature: chatbot.temperature || 0.7,
        max_tokens: chatbot.max_tokens || 500
      })

      return completion.choices[0]?.message?.content || null

    } catch (error) {
      console.error('❌ [AI] Erro OpenAI:', error)
      return null
    }
  }

  /**
   * Salva mensagens no banco
   */
  private async saveMessages(chatbotId: string, phone: string, userMessage: string, aiResponse: string) {
    try {
      await supabase.from('messages').insert([
        {
          chatbot_id: chatbotId,
          phone_number: phone,
          direction: 'inbound',
          message_content: userMessage,
          content: userMessage, // ✅ Garantir que o campo content seja preenchido
          created_at: new Date().toISOString()
        },
        {
          chatbot_id: chatbotId,
          phone_number: phone,
          direction: 'outbound',
          message_content: aiResponse,
          content: aiResponse, // ✅ Garantir que o campo content seja preenchido
          created_at: new Date().toISOString()
        }
      ])
    } catch (error) {
      console.error('❌ [AI] Erro ao salvar mensagens:', error)
    }
  }
}

// Instância única
export const aiService = new AIService()