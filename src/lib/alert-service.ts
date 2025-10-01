import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

interface AlertData {
  level: AlertLevel;
  title: string;
  message: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  source: string;
  environment: string;
}

class AlertService {
  private static instance: AlertService;
  private readonly env: string;
  private readonly commitHash: string;
  private readonly supabaseRef: string;

  constructor() {
    this.env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    this.commitHash = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local-dev';
    this.supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'unknown';
  }

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  async sendAlert(alertData: AlertData): Promise<void> {
    try {
      const alert = {
        ...alertData,
        timestamp: new Date().toISOString(),
        environment: this.env,
        commit_hash: this.commitHash,
        supabase_ref: this.supabaseRef,
        metadata: {
          ...alertData.metadata,
          alert_id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_agent: 'webhook-system',
          ip_address: 'internal'
        }
      };

      // Log do alerta
      const logLevel = this.getLogLevel(alertData.level);
      console[logLevel](`🚨 [ALERT-${alertData.level.toUpperCase()}] ${alertData.title}`, {
        message: alertData.message,
        correlationId: alertData.correlationId,
        source: alertData.source,
        metadata: alert.metadata
      });

      // Salvar alerta no banco (se tabela existir)
      try {
        await supabase
          .from('system_alerts')
          .insert(alert);
      } catch (dbError) {
        console.warn('⚠️ [ALERT-DB] Falha ao salvar alerta no banco:', dbError);
      }

      // Enviar para serviços externos em produção
      if (this.env === 'production' && alertData.level === 'critical') {
        await this.sendCriticalAlert(alert);
      }

    } catch (error) {
      console.error('❌ [ALERT-SERVICE-ERROR] Falha no serviço de alertas:', error);
    }
  }

  private getLogLevel(level: AlertLevel): 'log' | 'warn' | 'error' {
    switch (level) {
      case 'info': return 'log';
      case 'warning': return 'warn';
      case 'error':
      case 'critical': return 'error';
      default: return 'log';
    }
  }

  private async sendCriticalAlert(alert: any): Promise<void> {
    // Placeholder para integração com serviços de alerta externos
    // Ex: Slack, Discord, Email, PagerDuty, etc.
    console.error('🔥 [CRITICAL-ALERT] Alerta crítico detectado:', alert);
    
    // TODO: Implementar integração com Slack/Discord/Email
    // if (process.env.SLACK_WEBHOOK_URL) {
    //   await this.sendSlackAlert(alert);
    // }
  }

  // Métodos de conveniência para diferentes tipos de alerta
  async deviceCreationFailed(correlationId: string, instanceName: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Falha na Criação Automática de Device',
      message: `Não foi possível criar device automaticamente para instância ${instanceName}`,
      correlationId,
      source: 'webhook-device-autocreation',
      environment: this.env,
      metadata: {
        instanceName,
        error: error?.message || 'Unknown error',
        errorCode: error?.code
      }
    });
  }

  async chatbotNotFound(correlationId: string, instanceName: string, additionalMetadata?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Chatbot Default Não Encontrado',
      message: `Sistema não conseguiu encontrar chatbot default para instância ${instanceName}`,
      correlationId,
      source: 'webhook-chatbot-lookup',
      environment: this.env,
      metadata: {
        instanceName,
        action_required: 'Configurar chatbot default ativo',
        ...additionalMetadata
      }
    });
  }

  async messageSaveFailed(correlationId: string, phoneNumber: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'error',
      title: 'Falha ao Salvar Mensagem',
      message: `Erro ao salvar mensagem no banco de dados para ${phoneNumber}`,
      correlationId,
      source: 'webhook-message-save',
      environment: this.env,
      metadata: {
        phoneNumber,
        error: error?.message || 'Unknown error',
        errorCode: error?.code
      }
    });
  }

  async openaiServiceFailed(correlationId: string, phoneNumber: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title: 'Falha no Serviço OpenAI',
      message: `Erro ao processar mensagem via OpenAI para ${phoneNumber}`,
      correlationId,
      source: 'openai-service',
      environment: this.env,
      metadata: {
        phoneNumber,
        error: error?.message || 'Unknown error',
        fallback_used: true
      }
    });
  }

  async webhookBlocked(host: string, reason: string): Promise<void> {
    await this.sendAlert({
      level: 'info',
      title: 'Webhook Bloqueado',
      message: `Webhook rejeitado de ${host}: ${reason}`,
      source: 'webhook-security',
      environment: this.env,
      metadata: {
        host,
        reason,
        security_check: 'domain_validation'
      }
    });
  }

  async criticalError(correlationId: string, error: any, context?: string): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Erro Crítico do Sistema',
      message: `Erro crítico detectado${context ? ` em ${context}` : ''}`,
      correlationId,
      source: 'system-critical',
      environment: this.env,
      metadata: {
        error: error?.message || 'Unknown error',
        errorCode: error?.code,
        context
      }
    });
  }

  async invalidPayload(correlationId: string, payload: any, reason?: string): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title: 'Payload Inválido',
      message: `Payload recebido é inválido${reason ? `: ${reason}` : ''}`,
      correlationId,
      source: 'webhook-validation',
      environment: this.env,
      metadata: {
        payload: JSON.stringify(payload).substring(0, 500),
        reason
      }
    });
  }

  async deviceUpdateFailed(correlationId: string, deviceId: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'error',
      title: 'Falha na Atualização do Device',
      message: `Erro ao atualizar device ${deviceId}`,
      correlationId,
      source: 'device-update',
      environment: this.env,
      metadata: {
        deviceId,
        error: error?.message || 'Unknown error',
        errorCode: error?.code
      }
    });
  }

  async aiServiceFailed(correlationId: string, phoneNumber: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title: 'Falha no Serviço de IA',
      message: `Erro ao processar mensagem via IA para ${phoneNumber}`,
      correlationId,
      source: 'ai-service',
      environment: this.env,
      metadata: {
        phoneNumber,
        error: error?.message || 'Unknown error',
        fallback_used: true
      }
    });
  }

  async messageSendFailed(correlationId: string, phoneNumber: string, error: any): Promise<void> {
    await this.sendAlert({
      level: 'error',
      title: 'Falha ao Enviar Mensagem',
      message: `Erro ao enviar mensagem para ${phoneNumber}`,
      correlationId,
      source: 'message-send',
      environment: this.env,
      metadata: {
        phoneNumber,
        error: error?.message || 'Unknown error',
        errorCode: error?.code
      }
    });
  }
}

export const alertService = AlertService.getInstance();
export type { AlertLevel, AlertData };