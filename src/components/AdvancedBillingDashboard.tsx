'use client';

import React, { useState, useCallback } from 'react';
import { 
  CreditCard, 
  Shield, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  RefreshCw,
  Zap,
  DollarSign,
  BarChart3,
  Settings
} from 'lucide-react';
import useAdvancedBilling from '../hooks/useAdvancedBilling';
import NotificationDashboard from './NotificationDashboard';

interface AdvancedBillingDashboardProps {
  orgId: string;
  className?: string;
}

/**
 * DASHBOARD PRINCIPAL DO SISTEMA DE COBRANÇA AVANÇADO
 * 
 * Funcionalidades:
 * - Visão geral da carteira e saldo
 * - Monitoramento de transações em tempo real
 * - Estatísticas de performance
 * - Controles de circuit breaker
 * - Integração com notificações
 * - Ferramentas de reconciliação
 */
export default function AdvancedBillingDashboard({ 
  orgId, 
  className = '' 
}: AdvancedBillingDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'notifications' | 'settings'>('overview');
  const [testAmount, setTestAmount] = useState(50);
  const [isTestingBilling, setIsTestingBilling] = useState(false);

  const {
    wallet,
    transactions,
    stats,
    isLoading,
    isProcessing,
    error,
    circuitBreakerOpen,
    preAuthorizeCredits,
    chargeReservedCredits,
    smartBilling,
    cancelReservation,
    reconcile,
    resetCircuitBreaker,
    refreshData,
    hasLowBalance,
    availableBalance,
    totalReserved,
    isHealthy,
    successRate,
    avgProcessingTime,
    todayCharges
  } = useAdvancedBilling({
    orgId,
    autoRefresh: true,
    refreshInterval: 30000,
    onLowBalance: (balance) => {
      console.log(`Alerta: Saldo baixo detectado - ${balance} créditos`);
    },
    onChargeComplete: (result) => {
      console.log('Cobrança concluída:', result);
    },
    onError: (error) => {
      console.error('Erro no sistema de cobrança:', error);
    }
  });

  const handleTestSmartBilling = useCallback(async () => {
    setIsTestingBilling(true);
    
    try {
      const result = await smartBilling(
        testAmount + 10, // Estimar um pouco mais
        testAmount, // Valor real
        {
          test: true,
          description: 'Teste de cobrança inteligente',
          timestamp: new Date().toISOString()
        }
      );
      
      if (result.success) {
        alert(`Cobrança realizada com sucesso! Novo saldo: ${result.new_balance} créditos`);
      } else {
        alert(`Erro na cobrança: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro inesperado: ${error}`);
    } finally {
      setIsTestingBilling(false);
    }
  }, [smartBilling, testAmount]);

  const handleReconcile = useCallback(async () => {
    const result = await reconcile();
    if (result) {
      alert(`Reconciliação concluída: ${JSON.stringify(result, null, 2)}`);
    }
  }, [reconcile]);

  const getHealthStatus = () => {
    if (circuitBreakerOpen) {
      return { color: 'text-red-600', bg: 'bg-red-100', text: 'Circuit Breaker Ativo', icon: AlertCircle };
    }
    if (error) {
      return { color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'Com Problemas', icon: AlertCircle };
    }
    if (hasLowBalance) {
      return { color: 'text-orange-600', bg: 'bg-orange-100', text: 'Saldo Baixo', icon: AlertCircle };
    }
    return { color: 'text-green-600', bg: 'bg-green-100', text: 'Operacional', icon: CheckCircle };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Zap className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sistema de Cobrança Avançado</h1>
            <p className="text-gray-600">Monitoramento e controle em tempo real</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${healthStatus.bg}`}>
            <HealthIcon className={`w-5 h-5 ${healthStatus.color}`} />
            <span className={`font-medium ${healthStatus.color}`}>{healthStatus.text}</span>
          </div>
          
          <button
            onClick={refreshData}
            disabled={isProcessing}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
          { id: 'transactions', label: 'Transações', icon: Activity },
          { id: 'notifications', label: 'Notificações', icon: AlertCircle },
          { id: 'settings', label: 'Configurações', icon: Settings }
        ].map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Saldo Disponível</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {availableBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">créditos</p>
                </div>
                <div className={`p-3 rounded-full ${hasLowBalance ? 'bg-red-100' : 'bg-green-100'}`}>
                  <CreditCard className={`w-6 h-6 ${hasLowBalance ? 'text-red-600' : 'text-green-600'}`} />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Créditos Reservados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalReserved.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">em uso</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-100">
                  <Shield className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(successRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500">últimas 24h</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cobrado Hoje</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {todayCharges.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">créditos</p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Controles de Teste */}
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Teste de Cobrança Inteligente</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Valor:</label>
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border rounded text-sm"
                  min="1"
                  max="1000"
                />
                <span className="text-sm text-gray-500">créditos</span>
              </div>
              
              <button
                onClick={handleTestSmartBilling}
                disabled={isTestingBilling || circuitBreakerOpen || testAmount <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isTestingBilling && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isTestingBilling ? 'Processando...' : 'Testar Cobrança'}</span>
              </button>
              
              <button
                onClick={handleReconcile}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Reconciliar</span>
              </button>
              
              {circuitBreakerOpen && (
                <button
                  onClick={resetCircuitBreaker}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Reset Circuit Breaker</span>
                </button>
              )}
            </div>
          </div>

          {/* Estatísticas Detalhadas */}
          {stats && (
            <div className="bg-white p-6 rounded-lg border shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Estatísticas Detalhadas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.total_reservations}</div>
                  <div className="text-sm text-gray-600">Total de Reservas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.failed_charges}</div>
                  <div className="text-sm text-gray-600">Cobranças Falhadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{avgProcessingTime.toFixed(0)}ms</div>
                  <div className="text-sm text-gray-600">Tempo Médio</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Transações Recentes</h3>
          </div>
          <div className="divide-y">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        transaction.status === 'completed' ? 'bg-green-500' :
                        transaction.status === 'failed' ? 'bg-red-500' :
                        transaction.status === 'pending' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}></div>
                      <div>
                        <div className="font-medium capitalize">
                          {transaction.type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-semibold ${
                        transaction.type === 'charge' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'charge' ? '-' : '+'}{transaction.amount} créditos
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {transaction.status}
                      </div>
                    </div>
                  </div>
                  
                  {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {JSON.stringify(transaction.metadata)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <NotificationDashboard orgId={orgId} />
      )}

      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Configurações do Sistema</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">Auto-refresh</div>
                <div className="text-sm text-gray-500">Atualização automática a cada 30 segundos</div>
              </div>
              <div className="text-green-600">Ativo</div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">Circuit Breaker</div>
                <div className="text-sm text-gray-500">Proteção contra falhas em cascata</div>
              </div>
              <div className={circuitBreakerOpen ? 'text-red-600' : 'text-green-600'}>
                {circuitBreakerOpen ? 'Ativo' : 'Inativo'}
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">Notificações em Tempo Real</div>
                <div className="text-sm text-gray-500">Server-Sent Events para alertas</div>
              </div>
              <div className="text-green-600">Ativo</div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">Auditoria Completa</div>
                <div className="text-sm text-gray-500">Log de todas as transações</div>
              </div>
              <div className="text-green-600">Ativo</div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Erro */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}