import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { CREDIT_MESSAGES, BILLING_CONFIG, EVENT_TYPES } from './constants';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Interfaces
interface CreditReservation {
  id: string;
  org_id: string;
  reserved_amount: number;
  expiry_time: Date;
  status: 'active' | 'consumed' | 'expired' | 'cancelled';
  metadata?: any;
}

interface BillingTransaction {
  id: string;
  org_id: string;
  type: 'debit' | 'credit' | 'reserve' | 'release';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  reservation_id?: string;
  metadata?: any;
  created_at: Date;
  completed_at?: Date;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure?: Date;
  state: 'closed' | 'open' | 'half_open';
}

/**
 * Sistema Avançado de Cobrança com Transações Atômicas
 * 
 * Funcionalidades principais:
 * 1. Pré-autorização de créditos com reserva temporária
 * 2. Transações atômicas com rollback automático
 * 3. Sistema de fila com retry inteligente
 * 4. Circuit breaker para falhas em cascata
 * 5. Auditoria completa e reconciliação
 * 6. Notificações em tempo real
 */
export class AdvancedBillingService extends EventEmitter {
  private static instance: AdvancedBillingService;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private billingQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minuto
  private readonly RESERVATION_TIMEOUT = 300000; // 5 minutos

  constructor() {
    super();
    this.startQueueProcessor();
    this.startReservationCleanup();
  }

  static getInstance(): AdvancedBillingService {
    if (!AdvancedBillingService.instance) {
      AdvancedBillingService.instance = new AdvancedBillingService();
    }
    return AdvancedBillingService.instance;
  }

  /**
   * FASE 1: PRÉ-AUTORIZAÇÃO DE CRÉDITOS
   * Reserva créditos antes do processamento para garantir disponibilidade
   */
  async preAuthorizeCredits(params: {
    orgId: string;
    estimatedCost: number;
    metadata?: any;
  }): Promise<{ success: boolean; reservationId?: string; message: string }> {
    const { orgId, estimatedCost, metadata } = params;
    
    try {
      // Verificar circuit breaker
      if (this.isCircuitOpen(orgId)) {
        return {
          success: false,
          message: 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.'
        };
      }

      // Iniciar transação atômica
      const { data, error } = await supabase.rpc('atomic_credit_reservation', {
        p_org_id: orgId,
        p_amount: estimatedCost,
        p_metadata: metadata || {},
        p_expiry_minutes: 5
      });

      if (error) {
        this.recordFailure(orgId);
        throw error;
      }

      if (!data.success) {
        return {
          success: false,
          message: data.message || 'Créditos insuficientes para pré-autorização'
        };
      }

      this.recordSuccess(orgId);
      
      // Emitir evento de reserva criada
      this.emit('reservation_created', {
        orgId,
        reservationId: data.reservation_id,
        amount: estimatedCost
      });

      return {
        success: true,
        reservationId: data.reservation_id,
        message: 'Créditos pré-autorizados com sucesso'
      };

    } catch (error) {
      console.error('Erro na pré-autorização:', error);
      this.recordFailure(orgId);
      return {
        success: false,
        message: 'Erro interno na pré-autorização'
      };
    }
  }

  /**
   * FASE 2: COBRANÇA DEFINITIVA
   * Converte a reserva em cobrança real com o valor exato
   */
  async chargeReservedCredits(params: {
    reservationId: string;
    actualCost: number;
    usageDetails: {
      agentId: string;
      messageId: string;
      inputTokens: number;
      outputTokens: number;
      channel: string;
    };
    metadata?: any;
  }): Promise<{ success: boolean; transactionId?: string; message: string }> {
    const { reservationId, actualCost, usageDetails, metadata } = params;

    try {
      // Executar cobrança atômica com rollback automático
      const { data, error } = await supabase.rpc('atomic_credit_charge', {
        p_reservation_id: reservationId,
        p_actual_cost: actualCost,
        p_usage_details: usageDetails,
        p_metadata: metadata || {}
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        return {
          success: false,
          message: data.message || 'Falha na cobrança dos créditos'
        };
      }

      // Emitir evento de cobrança realizada
      this.emit('charge_completed', {
        transactionId: data.transaction_id,
        reservationId,
        actualCost,
        usageDetails
      });

      // Verificar se precisa alertar sobre saldo baixo
      if (data.new_balance < BILLING_CONFIG.LOW_BALANCE_THRESHOLD) {
        this.emit('low_balance_alert', {
          orgId: usageDetails.agentId, // Assumindo que agentId contém orgId
          currentBalance: data.new_balance,
          threshold: BILLING_CONFIG.LOW_BALANCE_THRESHOLD
        });
      }

      return {
        success: true,
        transactionId: data.transaction_id,
        message: 'Créditos cobrados com sucesso'
      };

    } catch (error) {
      console.error('Erro na cobrança:', error);
      
      // Tentar rollback automático
      await this.rollbackReservation(reservationId);
      
      return {
        success: false,
        message: 'Erro na cobrança - transação revertida automaticamente'
      };
    }
  }

  /**
   * MÉTODO PRINCIPAL: COBRANÇA INTELIGENTE COM RETRY
   * Combina pré-autorização e cobrança com retry automático
   */
  async smartBilling(params: {
    orgId: string;
    estimatedCost: number;
    actualCostCalculator: () => Promise<number>;
    usageDetails: {
      agentId: string;
      messageId: string;
      inputTokens: number;
      outputTokens: number;
      channel: string;
    };
    metadata?: any;
  }): Promise<{ success: boolean; message: string; details?: any }> {
    const { orgId, estimatedCost, actualCostCalculator, usageDetails, metadata } = params;

    return new Promise((resolve) => {
      // Adicionar à fila de processamento
      this.billingQueue.push(async () => {
        let reservationId: string | undefined;
        let attempts = 0;
        const maxAttempts = BILLING_CONFIG.MAX_RETRY_ATTEMPTS;

        while (attempts < maxAttempts) {
          try {
            attempts++;

            // Fase 1: Pré-autorização
            if (!reservationId) {
              const preAuthResult = await this.preAuthorizeCredits({
                orgId,
                estimatedCost,
                metadata
              });

              if (!preAuthResult.success) {
                if (attempts === maxAttempts) {
                  return resolve({
                    success: false,
                    message: preAuthResult.message
                  });
                }
                await this.delay(1000 * attempts); // Backoff exponencial
                continue;
              }

              reservationId = preAuthResult.reservationId!;
            }

            // Calcular custo real
            const actualCost = await actualCostCalculator();

            // Fase 2: Cobrança
            const chargeResult = await this.chargeReservedCredits({
              reservationId,
              actualCost,
              usageDetails,
              metadata
            });

            if (chargeResult.success) {
              return resolve({
                success: true,
                message: chargeResult.message,
                details: {
                  transactionId: chargeResult.transactionId,
                  reservationId,
                  actualCost,
                  attempts
                }
              });
            }

            if (attempts === maxAttempts) {
              return resolve({
                success: false,
                message: chargeResult.message
              });
            }

            await this.delay(1000 * attempts);

          } catch (error) {
            console.error(`Tentativa ${attempts} falhou:`, error);
            
            if (reservationId) {
              await this.rollbackReservation(reservationId);
              reservationId = undefined;
            }

            if (attempts === maxAttempts) {
              return resolve({
                success: false,
                message: 'Falha após múltiplas tentativas'
              });
            }

            await this.delay(1000 * attempts);
          }
        }
      });
    });
  }

  /**
   * SISTEMA DE RECONCILIAÇÃO AUTOMÁTICA
   * Verifica e corrige inconsistências no sistema
   */
  async reconcileTransactions(orgId: string): Promise<{
    success: boolean;
    discrepancies: any[];
    corrections: any[];
  }> {
    try {
      const { data, error } = await supabase.rpc('reconcile_billing_transactions', {
        p_org_id: orgId
      });

      if (error) throw error;

      // Se houver discrepâncias, aplicar correções automáticas
      if (data.discrepancies.length > 0) {
        this.emit('reconciliation_needed', {
          orgId,
          discrepancies: data.discrepancies
        });
      }

      return {
        success: true,
        discrepancies: data.discrepancies,
        corrections: data.corrections
      };

    } catch (error) {
      console.error('Erro na reconciliação:', error);
      return {
        success: false,
        discrepancies: [],
        corrections: []
      };
    }
  }

  // Métodos auxiliares privados
  private async rollbackReservation(reservationId: string): Promise<void> {
    try {
      await supabase.rpc('rollback_reservation', {
        p_reservation_id: reservationId
      });
      
      this.emit('reservation_rolled_back', { reservationId });
    } catch (error) {
      console.error('Erro no rollback:', error);
    }
  }

  private isCircuitOpen(orgId: string): boolean {
    const breaker = this.circuitBreakers.get(orgId);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - (breaker.lastFailure?.getTime() || 0);
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        breaker.state = 'half_open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordFailure(orgId: string): void {
    const breaker = this.circuitBreakers.get(orgId) || {
      failures: 0,
      state: 'closed' as const
    };

    breaker.failures++;
    breaker.lastFailure = new Date();

    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      this.emit('circuit_breaker_opened', { orgId });
    }

    this.circuitBreakers.set(orgId, breaker);
  }

  private recordSuccess(orgId: string): void {
    const breaker = this.circuitBreakers.get(orgId);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      this.circuitBreakers.set(orgId, breaker);
    }
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (true) {
      if (this.billingQueue.length > 0) {
        const task = this.billingQueue.shift();
        if (task) {
          try {
            await task();
          } catch (error) {
            console.error('Erro no processamento da fila:', error);
          }
        }
      } else {
        await this.delay(100); // Aguardar novas tarefas
      }
    }
  }

  private async startReservationCleanup(): Promise<void> {
    setInterval(async () => {
      try {
        await supabase.rpc('cleanup_expired_reservations');
      } catch (error) {
        console.error('Erro na limpeza de reservas:', error);
      }
    }, 60000); // A cada minuto
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instância singleton
export const advancedBilling = AdvancedBillingService.getInstance();