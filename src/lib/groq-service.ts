import Groq from 'groq-sdk'
import { supabaseAdmin } from './supabase-admin'

interface ChatbotConfig {id: string
  name: string
  groq_model: string
  temperature: number
  system_prompt: string
  company_prompt?: string
  training_prompt?: string
  response_rules?: string
  org_id: string
  is_active: boolean
  working_hours_start?: number;
  working_hours_end?: number;
  out_of_hours_message?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

class GroqService {
  private groq: Groq

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY não configurada')
    }
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  }

  /**
   * Busca configuração do chatbot com isolamento por organização
   */
  async getChatbotConfig(chatbotId: string, orgId: string): Promise<ChatbotConfig | null> {
    try {
      const { data: chatbot, error } = await supabaseAdmin
        .from('chatbots')
        .select(`
          id,
          name,
          groq_model,
          temperature,
          system_prompt,
          company_prompt,
          training_prompt,
          response_rules,
          org_id,
          is_active
        `)
        .eq('id', chatbotId.toString())
        .eq('org_id', orgId.toString())
        .eq('is_active', true)
        .single()

      if (error || !chatbot) {
        console.error('Chatbot não encontrado ou inativo:', error)
        return null
      }

      return chatbot as ChatbotConfig
    } catch (error) {
      console.error('Erro ao buscar configuração do chatbot:', error)
      return null
    }
  }

  /**
   * Constrói o prompt do sistema personalizado baseado no treinamento
   */
  private buildSystemPrompt(config: ChatbotConfig): string {
    let systemPrompt = config.system_prompt

    // Adiciona contexto da empresa se disponível
    if (config.company_prompt) {
      systemPrompt += `\n\nContexto da Empresa:\n${config.company_prompt}`
    }

    // Adiciona treinamento personalizado se disponível
    if (config.training_prompt) {
      systemPrompt += `\n\nTreinamento Personalizado:\n${config.training_prompt}`
    }

    // Adiciona regras de resposta se disponíveis
    if (config.response_rules) {
      systemPrompt += `\n\nRegras de Resposta:\n${config.response_rules}`
    }

    // Adiciona instruções específicas para isolamento
    systemPrompt += `\n\nIMPORTANTE: Você deve responder apenas com base nas informações fornecidas neste prompt e no contexto desta conversa específica. Não utilize informações de outras conversas ou contextos.`

    return systemPrompt
  }

  /**
   * Gera resposta usando Groq com treinamento personalizado
   */
  async generateResponse(
    chatbotId: string,
    orgId: string,
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string | null> {
    try {
      // Busca configuração do chatbot com isolamento por organização
      const config = await this.getChatbotConfig(chatbotId, orgId)
      
      if (!config) {
        console.error('Chatbot não encontrado, inativo ou não pertence à organização')
        return null
      }

      // Constrói o prompt do sistema personalizado
      const systemPrompt = this.buildSystemPrompt(config)

      // Prepara as mensagens para a API
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...conversationHistory.slice(-10), // Mantém apenas as últimas 10 mensagens para contexto
        {
          role: 'user',
          content: userMessage
        }
      ]

      // Chama a API Groq
      const completion = await this.groq.chat.completions.create({
        messages: messages as any,
        model: config.groq_model,
        temperature: config.temperature,
        max_tokens: 1000,
        top_p: 1,
        stream: false,
      })

      const response = completion.choices[0]?.message?.content
      
      if (!response) {
        console.error('Resposta vazia da API Groq')
        return null
      }

      // Log da interação para auditoria (sem dados sensíveis)
      console.log(`Resposta gerada para chatbot ${config.name} (org: ${orgId})`, {
        model: config.groq_model,
        temperature: config.temperature,
        messageLength: userMessage.length,
        responseLength: response.length
      })

      return response
    } catch (error) {
      console.error('Erro ao gerar resposta com Groq:', error)
      return null
    }
  }

  /**
   * Valida se um modelo Groq está disponível
   */
  async validateModel(model: string): Promise<boolean> {
    try {
      const models = await this.groq.models.list()
      return models.data.some(m => m.id === model)
    } catch (error) {
      console.error('Erro ao validar modelo:', error)
      return false
    }
  }

  /**
   * Lista modelos disponíveis na API Groq
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.groq.models.list()
      return models.data.map(m => m.id)
    } catch (error) {
      console.error('Erro ao listar modelos:', error)
      return []
    }
  }

  /**
   * Testa a conectividade com a API Groq
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.groq.models.list()
      return true
    } catch (error) {
      console.error('Erro de conectividade com Groq:', error)
      return false
    }
  }
}

// Instância singleton do serviço
export const groqService = new GroqService()
export default groqService