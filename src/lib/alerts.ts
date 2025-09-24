// Sistema de Alertas do Sistema
import { supabaseAdmin } from './supabase-admin';
import { ALERT_CONFIG, AlertSeverity } from './alert-config';
// import type { AlertConfig } from './alert-config';

// Tipos locais para o sistema de alertas
export type AlertType = string;
export type { AlertSeverity };

export interface SystemAlert {
  id?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Classe para gerenciar alertas do sistema
 */
export class AlertManager {
  private static instance: AlertManager;
  private rateLimitMap = new Map<string, number>();

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Criar um novo alerta
   */
  async createAlert({
    type,
    severity,
    title,
    message,
    metadata = {}
  }: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<SystemAlert | null> {
    try {
      // Verificar rate limiting
      // const rateLimitKey = `${type}_${severity}`;
      // const severityConfig = ALERT_CONFIG[severity.toUpperCase() as keyof typeof ALERT_CONFIG];
      // const config = severityConfig?.[type as keyof typeof severityConfig];

      // Inserir alerta no banco
      const { data, error } = await supabaseAdmin
        .from('system_alerts')
        .insert({
          type,
          severity,
          title,
          message,
          metadata
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar alerta:', error);
        return null;
      }

      // Rate limit removido - não configurado no ALERT_CONFIG atual

      // Enviar notificação se configurado
      await this.sendNotification(data as SystemAlert);

      return data as SystemAlert;
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
      return null;
    }
  }

  /**
   * Buscar alertas ativos
   */
  async getActiveAlerts(limit = 50): Promise<SystemAlert[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar alertas:', error);
        return [];
      }

      return data as SystemAlert[];
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      return [];
    }
  }

  /**
   * Resolver um alerta
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('system_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', alertId);

      if (error) {
        console.error('Erro ao resolver alerta:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      return false;
    }
  }

  /**
   * Buscar alertas por tipo
   */
  async getAlertsByType(type: AlertType, resolved = false): Promise<SystemAlert[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_alerts')
        .select('*')
        .eq('type', type)
        .eq('resolved', resolved)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar alertas por tipo:', error);
        return [];
      }

      return data as SystemAlert[];
    } catch (error) {
      console.error('Erro ao buscar alertas por tipo:', error);
      return [];
    }
  }

  /**
   * Limpar alertas antigos
   */
  async cleanupOldAlerts(): Promise<void> {
    try {
      const retentionDays = 30; // Valor padrão de retenção
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { error } = await supabaseAdmin
        .from('system_alerts')
        .delete()
        .eq('resolved', true)
        .lt('resolved_at', cutoffDate.toISOString());

      if (error) {
        console.error('Erro ao limpar alertas antigos:', error);
      } else {
        console.log('Alertas antigos limpos com sucesso');
      }
    } catch (error) {
      console.error('Erro ao limpar alertas antigos:', error);
    }
  }

  /**
   * Verificar rate limiting
   */
  private isRateLimited(key: string, rateLimit: { count: number; windowMs: number }): boolean {
    const now = Date.now();
    const lastAlert = this.rateLimitMap.get(key) || 0;
    
    return (now - lastAlert) < rateLimit.windowMs;
  }

  /**
   * Atualizar rate limit
   */
  private updateRateLimit(key: string): void {
    this.rateLimitMap.set(key, Date.now());
  }

  /**
   * Enviar notificação (placeholder para implementação futura)
   */
  private async sendNotification(alert: SystemAlert): Promise<void> {
    // TODO: Implementar notificações (email, webhook, etc.)
    console.log(`🚨 Alerta criado: ${alert.title} (${alert.severity})`);
  }
}

/**
 * Funções de conveniência para criar alertas específicos
 */
export const AlertHelpers = {
  /**
   * Alerta de erro de webhook
   */
  webhookError: (error: string, metadata?: Record<string, any>) => {
    return AlertManager.getInstance().createAlert({
      type: 'webhook_error',
      severity: 'high',
      title: 'Erro no Webhook',
      message: `Falha no processamento do webhook: ${error}`,
      metadata
    });
  },

  /**
   * Alerta de falha na API
   */
  apiFailure: (service: string, error: string, metadata?: Record<string, any>) => {
    return AlertManager.getInstance().createAlert({
      type: 'api_failure',
      severity: 'high',
      title: `Falha na API ${service}`,
      message: `Erro na comunicação com ${service}: ${error}`,
      metadata
    });
  },

  /**
   * Alerta de erro de banco de dados
   */
  databaseError: (operation: string, error: string, metadata?: Record<string, any>) => {
    return AlertManager.getInstance().createAlert({
      type: 'database_error',
      severity: 'critical',
      title: 'Erro no Banco de Dados',
      message: `Falha na operação ${operation}: ${error}`,
      metadata
    });
  },

  /**
   * Alerta de limite de recursos
   */
  resourceLimit: (resource: string, usage: number, limit: number, metadata?: Record<string, any>) => {
    return AlertManager.getInstance().createAlert({
      type: 'resource_limit',
      severity: usage > limit * 0.9 ? 'critical' : 'medium',
      title: `Limite de ${resource} Atingido`,
      message: `Uso atual: ${usage}/${limit} (${Math.round((usage/limit)*100)}%)`,
      metadata
    });
  },

  /**
   * Alerta de sistema
   */
  systemAlert: (title: string, message: string, severity: AlertSeverity = 'medium', metadata?: Record<string, any>) => {
    return AlertManager.getInstance().createAlert({
      type: 'system',
      severity,
      title,
      message,
      metadata
    });
  }
};

// Instância global
export const alertManager = AlertManager.getInstance();

// Inicializar limpeza automática (executar a cada 24 horas)
if (typeof window === 'undefined') {
  setInterval(() => {
    alertManager.cleanupOldAlerts();
  }, 24 * 60 * 60 * 1000);
}