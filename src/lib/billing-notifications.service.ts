import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { advancedBilling } from './advanced-billing.service';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface NotificationPreferences {
  org_id: string;
  low_balance_alerts: boolean;
  low_balance_threshold: number;
  email_notifications: boolean;
  webhook_url?: string;
  slack_webhook?: string;
  discord_webhook?: string;
}

interface BillingAlert {
  id: string;
  org_id: string;
  type: 'low_balance' | 'insufficient_credits' | 'reservation_failed' | 'circuit_breaker' | 'reconciliation_needed';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: any;
  created_at: Date;
  acknowledged: boolean;
}

/**
 * SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL
 * 
 * Funcionalidades:
 * 1. Alertas automáticos de saldo baixo
 * 2. Notificações de falhas no sistema
 * 3. Integração com Slack, Discord, Email
 * 4. Dashboard em tempo real
 * 5. Configurações personalizáveis por organização
 */
export class BillingNotificationService extends EventEmitter {
  private static instance: BillingNotificationService;
  private activeConnections = new Map<string, WebSocket[]>();
  private notificationPreferences = new Map<string, NotificationPreferences>();

  constructor() {
    super();
    this.setupEventListeners();
    this.loadNotificationPreferences();
  }

  static getInstance(): BillingNotificationService {
    if (!BillingNotificationService.instance) {
      BillingNotificationService.instance = new BillingNotificationService();
    }
    return BillingNotificationService.instance;
  }

  /**
   * CONFIGURAR LISTENERS PARA EVENTOS DO SISTEMA DE COBRANÇA
   */
  private setupEventListeners(): void {
    // Escutar eventos do sistema avançado de cobrança
    advancedBilling.on('low_balance_alert', this.handleLowBalanceAlert.bind(this));
    advancedBilling.on('reservation_created', this.handleReservationCreated.bind(this));
    advancedBilling.on('charge_completed', this.handleChargeCompleted.bind(this));
    advancedBilling.on('circuit_breaker_opened', this.handleCircuitBreakerOpened.bind(this));
    advancedBilling.on('reconciliation_needed', this.handleReconciliationNeeded.bind(this));
    advancedBilling.on('reservation_rolled_back', this.handleReservationRolledBack.bind(this));
  }

  /**
   * CARREGAR PREFERÊNCIAS DE NOTIFICAÇÃO
   */
  private async loadNotificationPreferences(): Promise<void> {
    try {
      const { data: preferences } = await supabase
        .from('notification_preferences')
        .select('*');

      if (preferences) {
        preferences.forEach(pref => {
          this.notificationPreferences.set(pref.org_id, pref);
        });
      }
    } catch (error) {
      console.error('Erro ao carregar preferências de notificação:', error);
    }
  }

  /**
   * REGISTRAR CONEXÃO WEBSOCKET PARA NOTIFICAÇÕES EM TEMPO REAL
   */
  registerConnection(orgId: string, ws: WebSocket): void {
    if (!this.activeConnections.has(orgId)) {
      this.activeConnections.set(orgId, []);
    }
    
    const connections = this.activeConnections.get(orgId)!;
    connections.push(ws);

    // Remover conexão quando fechada
    ws.addEventListener('close', () => {
      const index = connections.indexOf(ws);
      if (index > -1) {
        connections.splice(index, 1);
      }
    });

    // Enviar status inicial
    this.sendToConnection(ws, {
      type: 'connection_established',
      data: {
        orgId,
        timestamp: new Date().toISOString(),
        message: 'Conectado ao sistema de notificações de cobrança'
      }
    });
  }

  /**
   * HANDLERS PARA EVENTOS ESPECÍFICOS
   */
  private async handleLowBalanceAlert(data: any): Promise<void> {
    const { orgId, currentBalance, threshold } = data;
    
    const alert: BillingAlert = {
      id: this.generateId(),
      org_id: orgId,
      type: 'low_balance',
      severity: currentBalance < threshold * 0.5 ? 'critical' : 'warning',
      title: 'Saldo Baixo Detectado',
      message: `Seu saldo atual é de ${currentBalance} créditos, abaixo do limite de ${threshold} créditos.`,
      data: { currentBalance, threshold },
      created_at: new Date(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  private async handleReservationCreated(data: any): Promise<void> {
    const { orgId, reservationId, amount } = data;
    
    const alert: BillingAlert = {
      id: this.generateId(),
      org_id: orgId,
      type: 'low_balance',
      severity: 'info',
      title: 'Créditos Reservados',
      message: `${amount} créditos foram reservados para processamento.`,
      data: { reservationId, amount },
      created_at: new Date(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  private async handleChargeCompleted(data: any): Promise<void> {
    const { transactionId, actualCost, usageDetails } = data;
    
    // Notificação apenas para transações grandes
    if (actualCost > 10) {
      const alert: BillingAlert = {
        id: this.generateId(),
        org_id: usageDetails.agentId, // Assumindo que contém orgId
        type: 'low_balance',
        severity: 'info',
        title: 'Cobrança Realizada',
        message: `Cobrança de ${actualCost} créditos processada com sucesso.`,
        data: { transactionId, actualCost, usageDetails },
        created_at: new Date(),
        acknowledged: false
      };

      await this.processAlert(alert);
    }
  }

  private async handleCircuitBreakerOpened(data: any): Promise<void> {
    const { orgId } = data;
    
    const alert: BillingAlert = {
      id: this.generateId(),
      org_id: orgId,
      type: 'circuit_breaker',
      severity: 'critical',
      title: 'Sistema de Proteção Ativado',
      message: 'O sistema detectou múltiplas falhas e ativou o circuit breaker. O serviço será restaurado automaticamente em breve.',
      data,
      created_at: new Date(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  private async handleReconciliationNeeded(data: any): Promise<void> {
    const { orgId, discrepancies } = data;
    
    const alert: BillingAlert = {
      id: this.generateId(),
      org_id: orgId,
      type: 'reconciliation_needed',
      severity: 'warning',
      title: 'Reconciliação Necessária',
      message: `Foram detectadas ${discrepancies.length} discrepâncias que precisam de atenção.`,
      data,
      created_at: new Date(),
      acknowledged: false
    };

    await this.processAlert(alert);
  }

  private async handleReservationRolledBack(data: any): Promise<void> {
    const { reservationId } = data;
    
    // Buscar detalhes da reserva para obter orgId
    const { data: reservation } = await supabase
      .from('credit_reservations')
      .select('org_id, reserved_amount')
      .eq('id', reservationId)
      .single();

    if (reservation) {
      const alert: BillingAlert = {
        id: this.generateId(),
        org_id: reservation.org_id,
        type: 'reservation_failed',
        severity: 'warning',
        title: 'Reserva Cancelada',
        message: `Uma reserva de ${reservation.reserved_amount} créditos foi cancelada devido a uma falha no processamento.`,
        data: { reservationId, amount: reservation.reserved_amount },
        created_at: new Date(),
        acknowledged: false
      };

      await this.processAlert(alert);
    }
  }

  /**
   * PROCESSAR ALERTA (SALVAR E ENVIAR NOTIFICAÇÕES)
   */
  private async processAlert(alert: BillingAlert): Promise<void> {
    try {
      // Salvar alerta no banco
      await supabase
        .from('billing_alerts')
        .insert({
          id: alert.id,
          org_id: alert.org_id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          data: alert.data,
          acknowledged: false
        });

      // Enviar notificações
      await this.sendNotifications(alert);

    } catch (error) {
      console.error('Erro ao processar alerta:', error);
    }
  }

  /**
   * ENVIAR NOTIFICAÇÕES ATRAVÉS DE MÚLTIPLOS CANAIS
   */
  private async sendNotifications(alert: BillingAlert): Promise<void> {
    const preferences = this.notificationPreferences.get(alert.org_id);
    
    // WebSocket (tempo real)
    this.sendWebSocketNotification(alert);
    
    if (preferences) {
      // Email
      if (preferences.email_notifications) {
        await this.sendEmailNotification(alert, preferences);
      }
      
      // Webhook
      if (preferences.webhook_url) {
        await this.sendWebhookNotification(alert, preferences.webhook_url);
      }
      
      // Slack
      if (preferences.slack_webhook) {
        await this.sendSlackNotification(alert, preferences.slack_webhook);
      }
      
      // Discord
      if (preferences.discord_webhook) {
        await this.sendDiscordNotification(alert, preferences.discord_webhook);
      }
    }
  }

  /**
   * ENVIAR NOTIFICAÇÃO VIA WEBSOCKET
   */
  private sendWebSocketNotification(alert: BillingAlert): void {
    const connections = this.activeConnections.get(alert.org_id);
    if (connections) {
      const message = {
        type: 'billing_alert',
        alert: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.created_at.toISOString()
        }
      };

      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendToConnection(ws, message);
        }
      });
    }
  }

  /**
   * ENVIAR NOTIFICAÇÃO VIA EMAIL
   */
  private async sendEmailNotification(alert: BillingAlert, preferences: NotificationPreferences): Promise<void> {
    try {
      // Implementar integração com serviço de email (SendGrid, AWS SES, etc.)
      console.log('Enviando email para:', alert.org_id);
      console.log('Assunto:', alert.title);
      console.log('Mensagem:', alert.message);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
    }
  }

  /**
   * ENVIAR NOTIFICAÇÃO VIA WEBHOOK
   */
  private async sendWebhookNotification(alert: BillingAlert, webhookUrl: string): Promise<void> {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'billing_alert',
          alert: {
            id: alert.id,
            org_id: alert.org_id,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            data: alert.data,
            timestamp: alert.created_at.toISOString()
          }
        })
      });
    } catch (error) {
      console.error('Erro ao enviar webhook:', error);
    }
  }

  /**
   * ENVIAR NOTIFICAÇÃO VIA SLACK
   */
  private async sendSlackNotification(alert: BillingAlert, slackWebhook: string): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 'danger' : 
                   alert.severity === 'warning' ? 'warning' : 'good';
      
      const payload = {
        attachments: [{
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Organização',
              value: alert.org_id,
              short: true
            },
            {
              title: 'Severidade',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.created_at.toISOString(),
              short: false
            }
          ]
        }]
      };

      await fetch(slackWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Erro ao enviar notificação Slack:', error);
    }
  }

  /**
   * ENVIAR NOTIFICAÇÃO VIA DISCORD
   */
  private async sendDiscordNotification(alert: BillingAlert, discordWebhook: string): Promise<void> {
    try {
      const color = alert.severity === 'critical' ? 0xFF0000 : 
                   alert.severity === 'warning' ? 0xFFA500 : 0x00FF00;
      
      const payload = {
        embeds: [{
          title: alert.title,
          description: alert.message,
          color,
          fields: [
            {
              name: 'Organização',
              value: alert.org_id,
              inline: true
            },
            {
              name: 'Severidade',
              value: alert.severity.toUpperCase(),
              inline: true
            }
          ],
          timestamp: alert.created_at.toISOString()
        }]
      };

      await fetch(discordWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Erro ao enviar notificação Discord:', error);
    }
  }

  /**
   * MÉTODOS PÚBLICOS PARA GERENCIAMENTO
   */
  async updateNotificationPreferences(orgId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          org_id: orgId,
          ...preferences,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Atualizar cache local
      const current = this.notificationPreferences.get(orgId) || {} as NotificationPreferences;
      this.notificationPreferences.set(orgId, { ...current, ...preferences } as NotificationPreferences);
    } catch (error) {
      console.error('Erro ao atualizar preferências:', error);
      throw error;
    }
  }

  async getAlerts(orgId: string, limit: number = 50): Promise<BillingAlert[]> {
    try {
      const { data, error } = await supabase
        .from('billing_alerts')
        .select('*')
        .eq('org_id', String(orgId))
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      return [];
    }
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await supabase
        .from('billing_alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);
    } catch (error) {
      console.error('Erro ao confirmar alerta:', error);
      throw error;
    }
  }

  // Métodos auxiliares
  private sendToConnection(ws: WebSocket, message: any): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Erro ao enviar mensagem WebSocket:', error);
    }
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Instância singleton
export const billingNotifications = BillingNotificationService.getInstance();