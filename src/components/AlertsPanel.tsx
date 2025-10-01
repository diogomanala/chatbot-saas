'use client';

import React, { useState, useEffect } from 'react';
import { AlertManager, AlertHelpers } from '@/lib/alerts';
import { SystemAlert, AlertSeverity } from '@/lib/alerts';

interface AlertsPanelProps {
  className?: string;
}

const severityColors: Record<AlertSeverity, string> = {
  low: 'bg-blue-50 border-blue-200 text-blue-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  high: 'bg-orange-50 border-orange-200 text-orange-800',
  critical: 'bg-red-50 border-red-200 text-red-800'
};

const severityIcons: Record<AlertSeverity, string> = {
  low: '💡',
  medium: '⚠️',
  high: '🚨',
  critical: '🔥'
};

export function AlertsPanel({ className = '' }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | AlertSeverity>('all');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const alertManager = AlertManager.getInstance();
      const activeAlerts = await alertManager.getActiveAlerts();
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const alertManager = AlertManager.getInstance();
      const success = await alertManager.resolveAlert(alertId, 'user');
      
      if (success) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      }
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
    }
  };

  const createTestAlert = async () => {
    await AlertHelpers.systemAlert(
      'Teste de Alerta',
      'Este é um alerta de teste criado pelo painel de administração.',
      'low',
      { test: true, created_from: 'dashboard' }
    );
    loadAlerts();
  };

  useEffect(() => {
    loadAlerts();
    
    // Recarregar alertas a cada 30 segundos
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(alert => alert.severity === filter);

  const alertCounts = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Alertas do Sistema</h3>
            <p className="text-sm text-gray-600">
              {alertCounts.total} alertas ativos
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={createTestAlert}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Teste
            </button>
            <button
              onClick={loadAlerts}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Contadores por severidade */}
        <div className="flex space-x-4 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded ${
              filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({alertCounts.total})
          </button>
          {alertCounts.critical > 0 && (
            <button
              onClick={() => setFilter('critical')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'critical' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              🔥 Críticos ({alertCounts.critical})
            </button>
          )}
          {alertCounts.high > 0 && (
            <button
              onClick={() => setFilter('high')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'high' ? 'bg-orange-800 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              🚨 Altos ({alertCounts.high})
            </button>
          )}
          {alertCounts.medium > 0 && (
            <button
              onClick={() => setFilter('medium')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'medium' ? 'bg-yellow-800 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              ⚠️ Médios ({alertCounts.medium})
            </button>
          )}
          {alertCounts.low > 0 && (
            <button
              onClick={() => setFilter('low')}
              className={`px-3 py-1 text-xs rounded ${
                filter === 'low' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              💡 Baixos ({alertCounts.low})
            </button>
          )}
        </div>
      </div>

      {/* Lista de alertas */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {filter === 'all' ? (
              <div>
                <div className="text-4xl mb-2">✅</div>
                <p>Nenhum alerta ativo</p>
                <p className="text-sm">Sistema funcionando normalmente</p>
              </div>
            ) : (
              <p>Nenhum alerta {filter} encontrado</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{severityIcons[alert.severity]}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${severityColors[alert.severity]}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{alert.type}</span>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 mb-1">{alert.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>
                        {new Date(alert.created_at).toLocaleString('pt-BR')}
                      </span>
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <details className="cursor-pointer">
                          <summary className="hover:text-gray-700">Detalhes</summary>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="ml-4 px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex-shrink-0"
                  >
                    Resolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}