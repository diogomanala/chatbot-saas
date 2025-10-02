'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreditWallet {
  org_id: string;
  balance: number;
  reserved_credits: number;
  last_updated: string;
}

interface BillingTransaction {
  id: string;
  org_id: string;
  type: 'charge' | 'topup' | 'refund' | 'reservation' | 'release';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  metadata: any;
  created_at: string;
  completed_at?: string;
}

interface ReservationResult {
  success: boolean;
  reservation_id?: string;
  available_balance?: number;
  error?: string;
}

interface ChargeResult {
  success: boolean;
  transaction_id?: string;
  new_balance?: number;
  error?: string;
}

interface BillingStats {
  total_charged_today: number;
  total_reservations: number;
  failed_charges: number;
  success_rate: number;
  avg_processing_time: number;
}

interface UseAdvancedBillingOptions {
  orgId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onLowBalance?: (balance: number) => void;
  onChargeComplete?: (result: ChargeResult) => void;
  onError?: (error: string) => void;
}

/**
 * HOOK PARA SISTEMA DE COBRANÇA AVANÇADO - PADRÃO OURO APLICADO
 * 
 * Funcionalidades:
 * - Pré-autorização de créditos com reserva
 * - Cobrança inteligente com retry automático
 * - Monitoramento em tempo real do saldo
 * - Estatísticas de cobrança
 * - Reconciliação automática
 * - Circuit breaker para falhas
 */
export function useAdvancedBilling({
  orgId,
  autoRefresh = true,
  refreshInterval = 30000, // 30 segundos
  onLowBalance,
  onChargeComplete,
  onError
}: UseAdvancedBillingOptions) {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBalanceRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onLowBalanceRef = useRef(onLowBalance);
  const onChargeCompleteRef = useRef(onChargeComplete);
  const onErrorRef = useRef(onError);

  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onLowBalanceRef.current = onLowBalance;
    onChargeCompleteRef.current = onChargeComplete;
    onErrorRef.current = onError;
  }, [onLowBalance, onChargeComplete, onError]);

  // Carregar dados iniciais - ESTABILIZADO
  const loadWallet = useCallback(async () => {
    if (!session?.access_token) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(`/api/advanced-billing?action=get_wallet&orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setWallet(data.wallet);
        
        // Verificar saldo baixo
        if (onLowBalanceRef.current && data.wallet.balance < 100 && 
            lastBalanceRef.current !== null && 
            lastBalanceRef.current >= 100) {
          onLowBalanceRef.current(data.wallet.balance);
        }
        
        lastBalanceRef.current = data.wallet.balance;
      } else {
        throw new Error(data.error || 'Erro ao carregar carteira');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMsg);
        onErrorRef.current?.(errorMsg);
        toast.error(`Erro ao carregar carteira: ${errorMsg}`);
      }
    }
  }, [session, orgId]);

  const loadTransactions = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/advanced-billing?action=get_transactions&orgId=${orgId}&limit=20`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Erro ao carregar transações:', err);
    }
  }, [session, orgId]);

  const loadStats = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/advanced-billing?action=get_stats&orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  }, [session, orgId]);

  const refreshData = useCallback(async () => {
    await Promise.all([
      loadWallet(),
      loadTransactions(),
      loadStats()
    ]);
  }, [loadWallet, loadTransactions, loadStats]);

  const checkCircuitBreaker = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/advanced-billing?action=check_circuit_breaker&orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setCircuitBreakerOpen(data.isOpen);
      }
    } catch (err) {
      console.error('Erro ao verificar circuit breaker:', err);
    }
  }, [session, orgId]);

  // Pré-autorizar créditos (reservar)
  const preAuthorizeCredits = useCallback(async (
    amount: number,
    metadata: any = {}
  ): Promise<ReservationResult> => {
    if (circuitBreakerOpen) {
      return {
        success: false,
        error: 'Circuit breaker ativo - sistema temporariamente indisponível'
      };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/advanced-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pre_authorize',
          orgId,
          amount,
          metadata
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Atualizar carteira local
        if (wallet) {
          setWallet({
            ...wallet,
            reserved_credits: wallet.reserved_credits + amount
          });
        }
        
        // Recarregar dados para sincronizar
        await refreshData();
        
        return {
          success: true,
          reservation_id: data.reservation_id,
          available_balance: data.available_balance
        };
      } else {
        throw new Error(data.error || 'Erro na pré-autorização');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      onError?.(errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setIsProcessing(false);
    }
  }, [orgId, wallet, circuitBreakerOpen, refreshData, onError]);

  // Cobrar créditos reservados
  const chargeReservedCredits = useCallback(async (
    reservationId: string,
    actualAmount?: number,
    metadata: any = {}
  ): Promise<ChargeResult> => {
    if (circuitBreakerOpen) {
      return {
        success: false,
        error: 'Circuit breaker ativo - sistema temporariamente indisponível'
      };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/advanced-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'charge_reserved',
          orgId,
          reservation_id: reservationId,
          actual_amount: actualAmount,
          metadata
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Recarregar dados para sincronizar
        await refreshData();
        
        const result: ChargeResult = {
          success: true,
          transaction_id: data.transaction_id,
          new_balance: data.new_balance
        };
        
        onChargeComplete?.(result);
        
        return result;
      } else {
        throw new Error(data.error || 'Erro na cobrança');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      onError?.(errorMsg);
      
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      setIsProcessing(false);
    }
  }, [orgId, circuitBreakerOpen, refreshData, onChargeComplete, onError]);

  // Cobrança inteligente (pré-autoriza + cobra em uma operação)
  const smartBilling = useCallback(async (
    estimatedAmount: number,
    actualAmount: number,
    metadata: any = {}
  ): Promise<ChargeResult> => {
    try {
      // Primeiro, pré-autorizar
      const reservation = await preAuthorizeCredits(estimatedAmount, {
        ...metadata,
        smart_billing: true,
        estimated_amount: estimatedAmount,
        actual_amount: actualAmount
      });
      
      if (!reservation.success || !reservation.reservation_id) {
        return {
          success: false,
          error: reservation.error || 'Falha na pré-autorização'
        };
      }
      
      // Depois, cobrar o valor real
      return await chargeReservedCredits(
        reservation.reservation_id,
        actualAmount,
        metadata
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro na cobrança inteligente';
      return {
        success: false,
        error: errorMsg
      };
    }
  }, [preAuthorizeCredits, chargeReservedCredits]);

  // Cancelar reserva
  const cancelReservation = useCallback(async (reservationId: string) => {
    try {
      const response = await fetch('/api/advanced-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_reservation',
          orgId,
          reservation_id: reservationId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await refreshData();
        return true;
      } else {
        throw new Error(data.error || 'Erro ao cancelar reserva');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [orgId, refreshData, onError]);

  // Reconciliação manual
  const reconcile = useCallback(async () => {
    try {
      const response = await fetch('/api/advanced-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile',
          orgId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await refreshData();
        return data.reconciliation_report;
      } else {
        throw new Error(data.error || 'Erro na reconciliação');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro na reconciliação';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    }
  }, [orgId, refreshData, onError]);

  // Verificar status do circuit breaker
  const checkCircuitBreakerStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/advanced-billing?action=circuit_breaker_status&orgId=${orgId}`);
      const data = await response.json();
      
      if (data.success) {
        setCircuitBreakerOpen(data.circuit_breaker_open);
      }
    } catch (err) {
      console.error('Erro ao verificar circuit breaker:', err);
    }
  }, [orgId]);

  // Resetar circuit breaker
  const resetCircuitBreaker = useCallback(async () => {
    try {
      const response = await fetch(`/api/advanced-billing?action=reset_circuit_breaker&orgId=${orgId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCircuitBreakerOpen(false);
        toast.success('Circuit breaker resetado com sucesso');
        await refreshData();
      } else {
        throw new Error(data.error || 'Erro ao resetar circuit breaker');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao resetar circuit breaker:', err);
      toast.error(`Erro ao resetar circuit breaker: ${errorMsg}`);
      onErrorRef.current?.(errorMsg);
    }
  }, [orgId, session?.access_token, refreshData]);

  // Efeito para carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await refreshData();
      await checkCircuitBreaker();
      setIsLoading(false);
    };

    loadInitialData();
  }, [refreshData, checkCircuitBreaker]);

  // Efeito para auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refreshData();
        checkCircuitBreaker();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
    
    return () => {
      // Cleanup function for when autoRefresh is false
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, refreshData, checkCircuitBreaker]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    // Estado
    wallet,
    transactions,
    stats,
    isLoading,
    isProcessing,
    error,
    circuitBreakerOpen,
    
    // Ações
    preAuthorizeCredits,
    chargeReservedCredits,
    smartBilling,
    cancelReservation,
    reconcile,
    resetCircuitBreaker,
    refreshData,
    
    // Utilitários
    hasLowBalance: wallet ? wallet.balance < 100 : false,
    availableBalance: wallet ? wallet.balance - wallet.reserved_credits : 0,
    totalReserved: wallet?.reserved_credits || 0,
    isHealthy: !circuitBreakerOpen && !error,
    
    // Estatísticas calculadas
    successRate: stats?.success_rate || 0,
    avgProcessingTime: stats?.avg_processing_time || 0,
    todayCharges: stats?.total_charged_today || 0
  };
}

export default useAdvancedBilling;