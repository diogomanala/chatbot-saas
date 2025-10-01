// Força o carregamento das variáveis de ambiente ANTES de qualquer coisa
import { config } from 'dotenv'
import path from 'path'

// Carrega .env.local primeiro
config({ path: path.resolve(process.cwd(), '.env.local') })
// Carrega .env como fallback
config({ path: path.resolve(process.cwd(), '.env') })

import OpenAI from 'openai'
import { supabaseAdmin } from './supabase-admin'
import { billingService } from './billing.service'
import { calculateCreditCost } from '../../packages/shared/pricing'

interface ChatbotConfig {
  id: string
  name: string
  openai_model: string
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

class OpenAIService {
  private openai: OpenAI

  constructor() {
    // Log para debug das variáveis de ambiente
    console.log('🔧 [OpenAI] Inicializando OpenAI Service');
    console.log('🔧 [OpenAI] OPENAI_API_KEY presente:', !!process.env.OPENAI_API_KEY);
    console.log('🔧 [OpenAI] OPENAI_API_KEY valor bruto:', JSON.stringify(process.env.OPENAI_API_KEY));
    
    let apiKey = process.env.OPENAI_API_KEY;
    
    // Remove aspas se existirem
    if (apiKey && (apiKey.startsWith('"') && apiKey.endsWith('"'))) {
      console.log('🔧 [OpenAI] Removendo aspas da API key...');
      apiKey = apiKey.slice(1, -1);
    }
    
    console.log('🔧 [OpenAI] OPENAI_API_KEY processada:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined');
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
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
          is_active,
          business_context,
          fallback_message,
          auto_response_enabled,
          default_fallback_enabled,
          working_hours_start,
          working_hours_end,
          out_of_hours_message
        `)
        .eq('id', chatbotId.toString())
        .eq('org_id', orgId.toString())
        .eq('is_active', true)
        .single()

      if (error || !chatbot) {
        console.error('Chatbot não encontrado ou inativo:', error)
        return null
      }

      // Padronizar campos e aplicar defaults seguros
      const config = {
        ...chatbot,
        // Padronizar modelo - usar default se vazio
        model: chatbot.groq_model || 'gpt-4o-mini',
        model_provider: 'openai', // Sempre OpenAI para este serviço
        // Padronizar campo de treinamento
        systemPrompt: this.buildSystemPrompt(chatbot),
        // Aplicar defaults seguros
        temperature: chatbot.temperature ?? 0.3,
        top_p: 1.0, // Default padrão
        // Mapear para compatibilidade
        openai_model: this.mapToOpenAIModel(chatbot.groq_model || 'gpt-4o-mini')
      } as ChatbotConfig

      // Log de validação do modelo
      if (!chatbot.groq_model) {
        console.warn(`⚠️ [OpenAI] Chatbot ${chatbot.name} sem modelo definido, usando default: gpt-4o-mini`)
      }

      return config
    } catch (error) {
      console.error('Erro ao buscar configuração do chatbot:', error)
      return null
    }
  }

  /**
   * Mapeia modelos Groq para modelos OpenAI equivalentes
   */
  private mapToOpenAIModel(groqModel: string): string {
    const modelMap: { [key: string]: string } = {
      'llama-3.1-70b-versatile': 'gpt-3.5-turbo',
      'llama-3.3-70b-versatile': 'gpt-3.5-turbo',
      'llama-3.1-8b-instant': 'gpt-3.5-turbo',
      'mixtral-8x7b-32768': 'gpt-3.5-turbo',
      'gemma2-9b-it': 'gpt-3.5-turbo'
    }
    
    return modelMap[groqModel] || 'gpt-3.5-turbo'
  }

  /**
   * Constrói o prompt do sistema personalizado baseado no treinamento
   */
  private buildSystemPrompt(config: ChatbotConfig): string {
    let systemPrompt = config.system_prompt

    console.log(`🔍 [OpenAI] System prompt original do chatbot ${config.name}:`, systemPrompt);

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

    console.log(`🔍 [OpenAI] System prompt final construído:`, systemPrompt);

    return systemPrompt
  }

  /**
   * Gera resposta usando OpenAI com treinamento personalizado e débito automático de créditos
   */
  // Método para gerar resposta usando OpenAI
  async generateResponse(
    chatbot: any, // Aceitar objeto chatbot completo
    message: string,
    conversationHistory: any[] = [],
    correlationId?: string
  ): Promise<{ response: string; tokensUsed: number } | null> {
    const logPrefix = correlationId ? `[${correlationId}]` : '';
    
    try {
      console.log(`🚀 ${logPrefix} [OPENAI] Iniciando generateResponse`);
      console.log(`🔍 ${logPrefix} [OPENAI] Parâmetros:`, { 
        chatbotId: chatbot.id, 
        orgId: chatbot.org_id, 
        messageLength: message.length 
      });

      // VALIDAÇÃO 1: Model não pode estar vazio
      const model = chatbot.groq_model || chatbot.model || 'gpt-4o-mini';
      if (!model || model.trim() === '') {
        console.warn(`⚠️ ${logPrefix} [OPENAI] WARNING: Chatbot ${chatbot.name} sem model definido, usando default gpt-4o-mini`);
        chatbot.model = 'gpt-4o-mini';
      } else {
        chatbot.model = model;
      }

      // VALIDAÇÃO 2: System prompt deve ter pelo menos 20 caracteres
      if (!chatbot.system_prompt || chatbot.system_prompt.trim().length < 20) {
        console.error(`❌ ${logPrefix} [OPENAI] ERRO: Chatbot ${chatbot.name} sem treinamento configurado adequadamente`);
        console.error(`🔍 ${logPrefix} [OPENAI] System prompt atual:`, chatbot.system_prompt);
        
        // Retornar mensagem de fallback específica
        return {
          response: "Desculpe, este chatbot ainda não foi configurado adequadamente. Entre em contato com o suporte para configurar o treinamento do assistente.",
          tokensUsed: 0
        };
      }

      // LOGS OBRIGATÓRIOS: provider, model e primeiros 100 chars do system prompt
      console.log(`📊 ${logPrefix} [OPENAI] Configuração validada:`, {
        provider: 'openai',
        model: chatbot.model,
        systemPromptPreview: chatbot.system_prompt.substring(0, 100) + (chatbot.system_prompt.length > 100 ? '...' : ''),
        systemPromptLength: chatbot.system_prompt.length
      });

      // Verificar créditos suficientes
      const estimatedTokens = this.estimateTokens(message);
      const hasCredits = await this.checkCredits(chatbot.org_id, estimatedTokens);
      
      if (!hasCredits) {
        console.error(`❌ ${logPrefix} [OPENAI] Créditos insuficientes para org ${chatbot.org_id}`);
        return null;
      }

      // Construir system prompt final com defaults seguros
      const systemPrompt = this.buildSystemPromptWithDefaults(chatbot);
      
      console.log(`🔍 ${logPrefix} [OPENAI] System prompt construído (${systemPrompt.length} chars)`);

      // Buscar histórico da conversa (últimas 10 mensagens)
      const { data: recentMessages } = await supabaseAdmin
        .from('messages')
        .select('direction, message_content, created_at')
        .eq('chatbot_id', chatbot.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(recentMessages || []).reverse().map((msg: any) => ({
          role: msg.direction === 'inbound' ? 'user' : 'assistant',
          content: msg.message_content
        })),
        { role: 'user', content: message }
      ];

      console.log(`🔍 ${logPrefix} [OPENAI] Preparando chamada para API com ${messages.length} mensagens`);

      const completion = await this.openai.chat.completions.create({
        model: this.mapToOpenAIModel(chatbot.model),
        messages: messages as any,
        temperature: chatbot.temperature ?? 0.3,
        top_p: 1.0,
        max_tokens: chatbot.max_tokens || 1000,
      });

      const response = completion.choices[0]?.message?.content;
      const tokensUsed = completion.usage?.total_tokens || 0;

      if (!response) {
        console.error(`❌ ${logPrefix} [OPENAI] Resposta vazia da API`);
        return null;
      }

      console.log(`✅ ${logPrefix} [OPENAI] Resposta gerada com sucesso: ${tokensUsed} tokens`);
      
      return {
        response: response.trim(),
        tokensUsed
      };

    } catch (error: any) {
      console.error(`❌ ${logPrefix} [OPENAI] Erro ao gerar resposta:`, error);
      
      if (error.code === 'insufficient_quota') {
        console.error(`💳 ${logPrefix} [OPENAI] Cota da API OpenAI esgotada`);
      } else if (error.code === 'rate_limit_exceeded') {
        console.error(`⏱️ ${logPrefix} [OPENAI] Rate limit da API OpenAI excedido`);
      }
      
      return null;
    }
  }

  /**
   * Constrói o prompt do sistema com defaults seguros
   */
  private buildSystemPromptWithDefaults(chatbot: any): string {
    // Prefixo padrão seguro
    const defaultPrefix = `Você é o chatbot ${chatbot.name} da organização. `;
    
    let systemPrompt = chatbot.system_prompt || '';
    
    // Se não tem system_prompt, usar apenas o prefixo padrão
    if (!systemPrompt || systemPrompt.trim().length < 20) {
      systemPrompt = defaultPrefix + "Responda de forma útil e prestativa às perguntas dos usuários.";
    } else {
      // Concatenar prefixo com o treinamento existente
      systemPrompt = defaultPrefix + systemPrompt;
    }

    // Adiciona contexto da empresa se disponível
    if (chatbot.company_prompt) {
      systemPrompt += `\n\nContexto da Empresa:\n${chatbot.company_prompt}`;
    }

    // Adiciona treinamento personalizado se disponível
    if (chatbot.training_prompt) {
      systemPrompt += `\n\nTreinamento Personalizado:\n${chatbot.training_prompt}`;
    }

    // Adiciona regras de resposta se disponíveis
    if (chatbot.response_rules) {
      systemPrompt += `\n\nRegras de Resposta:\n${chatbot.response_rules}`;
    }

    // Adiciona instruções específicas para isolamento
    systemPrompt += `\n\nIMPORTANTE: Você deve responder apenas com base nas informações fornecidas neste prompt e no contexto desta conversa específica. Não utilize informações de outras conversas ou contextos.`;

    return systemPrompt;
  }

  /**
   * Extrai uso de tokens da resposta da API OpenAI
   * 🔥 CORREÇÃO ROBUSTA: NUNCA retorna 0 tokens - sempre calcula fallback
   */
  private extractTokenUsage(completion: any): { inputTokens: number; outputTokens: number } {
    try {
      // Tenta extrair tokens reais da API
      const realInputTokens = completion.usage?.prompt_tokens || 0
      const realOutputTokens = completion.usage?.completion_tokens || 0
      
      // Se temos tokens reais válidos, usa eles
      if (realInputTokens > 0 && realOutputTokens > 0) {
        console.log('[OpenAIService] ✅ Tokens reais extraídos:', { realInputTokens, realOutputTokens })
        return {
          inputTokens: realInputTokens,
          outputTokens: realOutputTokens
        }
      }
      
      // 🔥 FALLBACK ROBUSTO: Se não temos tokens reais, calcula estimativa
      console.warn('[OpenAIService] ⚠️ completion.usage inválido, calculando fallback:', completion.usage)
      
      // Estima tokens baseado no conteúdo da resposta
      const responseContent = completion.choices?.[0]?.message?.content || ''
      const estimatedOutputTokens = Math.max(Math.ceil(responseContent.length / 4), 50) // Mínimo 50 tokens
      const estimatedInputTokens = Math.max(Math.ceil(estimatedOutputTokens * 0.3), 30) // Mínimo 30 tokens de input
      
      console.log('[OpenAIService] 🔄 Tokens estimados (fallback):', { 
        estimatedInputTokens, 
        estimatedOutputTokens,
        responseLength: responseContent.length 
      })
      
      return {
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens
      }
    } catch (error) {
      console.error('[OpenAIService] ❌ Erro ao extrair tokens, usando fallback de emergência:', error)
      
      // 🔥 FALLBACK DE EMERGÊNCIA: Valores mínimos garantidos
      const emergencyInputTokens = 100  // Mínimo absoluto
      const emergencyOutputTokens = 150 // Mínimo absoluto
      
      console.log('[OpenAIService] 🚨 Usando fallback de emergência:', { 
        emergencyInputTokens, 
        emergencyOutputTokens 
      })
      
      return { 
        inputTokens: emergencyInputTokens, 
        outputTokens: emergencyOutputTokens 
      }
    }
  }

  /**
   * Estima o número de tokens em um texto (aproximação simples)
   */
  private estimateTokens(text: string): number {
    // Aproximação: 1 token ≈ 4 caracteres para texto em português/inglês
    return Math.ceil(text.length / 4)
  }

  /**
   * Verifica se a organização tem créditos suficientes
   */
  private async checkCredits(orgId: string, estimatedTokens: number): Promise<boolean> {
    try {
      const estimatedCredits = calculateCreditCost(estimatedTokens, estimatedTokens);
      const hasSufficientCredits = await billingService.hasSufficientCredits(orgId, estimatedCredits);
      
      if (!hasSufficientCredits) {
        console.warn(`⚠️ [OpenAI] Créditos insuficientes para org ${orgId}. Estimativa: ${estimatedCredits} créditos`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ [OpenAI] Erro ao verificar créditos:`, error);
      return false;
    }
  }

  /**
   * Valida se um modelo OpenAI está disponível
   */
  async validateModel(model: string): Promise<boolean> {
    try {
      const models = await this.openai.models.list()
      return models.data.some(m => m.id === model)
    } catch (error) {
      console.error('Erro ao validar modelo:', error)
      return false
    }
  }

  /**
   * Lista modelos disponíveis na API OpenAI
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.openai.models.list()
      return models.data.map(m => m.id)
    } catch (error) {
      console.error('Erro ao listar modelos:', error)
      return []
    }
  }

  /**
   * Testa a conectividade com a API OpenAI
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔧 [OpenAI] Testando conexão...');
      const models = await this.openai.models.list();
      console.log('🔧 [OpenAI] Conexão bem-sucedida! Modelos encontrados:', models.data.length);
      return true
    } catch (error) {
      console.error('❌ [OpenAI] Erro de conectividade:', error)
      return false
    }
  }
}

// Instância singleton do serviço
export const openaiService = new OpenAIService()
export default openaiService