'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, Info, X, Check, Settings, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BillingAlert {
  id: string;
  org_id: string;
  type: 'low_balance' | 'insufficient_credits' | 'reservation_failed' | 'circuit_breaker' | 'reconciliation_needed';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  data: any;
  created_at: string;
  acknowledged: boolean;
}

interface NotificationStats {
  total_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  info_alerts: number;
  acknowledged_alerts: number;
  avg_acknowledgment_time_hours: number;
}

interface NotificationPreferences {
  low_balance_alerts: boolean;
  low_balance_threshold: number;
  email_notifications: boolean;
  webhook_url?: string;
  slack_webhook?: string;
  discord_webhook?: string;
}

interface NotificationDashboardProps {
  orgId: string;
  className?: string;
}

/**
 * DASHBOARD DE NOTIFICAÇÕES EM TEMPO REAL
 * 
 * Funcionalidades:
 * - Conexão SSE para notificações em tempo real
 * - Lista de alertas com filtros
 * - Estatísticas de alertas
 * - Configurações de notificação
 * - Indicador de status de conexão
 */
export default function NotificationDashboard({ orgId, className = '' }: NotificationDashboardProps) {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<BillingAlert[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Função estável para conectar ao SSE usando o padrão ouro
  const connectSSE = useCallback(async () => {
    if (!session?.access_token || !orgId) return;

    // Abortar conexão anterior
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(`/api/notifications/sse?orgId=${orgId}`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      setIsConnected(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const notification = JSON.parse(line.substring(6));
              
              switch (notification.type) {
                case 'connection_established':
                  break;
                  
                case 'billing_notification':
                case 'low_balance_alert':
                case 'circuit_breaker_alert':
                case 'charge_completed':
                  // Adicionar nova notificação à lista
                  setAlerts(prev => [notification.data, ...prev]);
                  
                  // Mostrar notificação do browser se permitido
                  if (Notification.permission === 'granted') {
                    new Notification(notification.data.title, {
                      body: notification.data.message,
                      icon: '/favicon.ico'
                    });
                  }
                  break;
                  
                case 'existing_alerts':
                  break;
                  
                case 'heartbeat':
                  // Manter conexão viva
                  break;
                  
                default:
                  break;
              }
            } catch (e) {
              console.error('[SSE] JSON Parse Error', e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`[SSE] Connection error on notifications:`, err);
        setIsConnected(false);
        toast.error('Falha na conexão de notificações em tempo real');
      }
    }
  }, [session, orgId]);

  // Função estável para carregar alertas
  const loadAlerts = useCallback(async () => {
    if (!session?.access_token || !orgId) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(`/api/notifications?orgId=${orgId}&limit=50`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao carregar alertas:', error);
        toast.error('Erro ao carregar alertas');
      }
    } finally {
      setLoading(false);
    }
  }, [session, orgId]);

  // Função estável para carregar estatísticas
  const loadStats = useCallback(async () => {
    if (!session?.access_token || !orgId) return;

    try {
      const response = await fetch(`/api/notifications?orgId=${orgId}&action=stats`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.success) {
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, [session, orgId]);

  // Função estável para carregar preferências
  const loadPreferences = useCallback(async () => {
    try {
      // Implementar endpoint para buscar preferências
      // Por enquanto, usar valores padrão
      setPreferences({
        low_balance_alerts: true,
        low_balance_threshold: 100,
        email_notifications: true
      });
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    }
  }, []);

  // Effect principal - depende apenas das funções estáveis
  useEffect(() => {
    loadAlerts();
    loadStats();
    loadPreferences();
    
    // Solicitar permissão para notificações do browser
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Conectar ao SSE
    connectSSE();
    
    // Cleanup
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadAlerts, loadStats, loadPreferences, connectSSE]);

  const acknowledgeAlert = async (alertId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'acknowledge_alert',
          alertId,
          orgId
        })
      });
      
      if (response.ok) {
        setAlerts(prev => 
          prev.map(alert => 
            alert.id === alertId 
              ? { ...alert, acknowledged: true }
              : alert
          )
        );
        toast.success('Alerta confirmado');
      }
    } catch (error) {
      console.error('Erro ao confirmar alerta:', error);
      toast.error('Erro ao confirmar alerta');
    }
  };

  const acknowledgeAll = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'acknowledge_multiple',
          alertIds: [],
          orgId
        })
      });
      
      if (response.ok) {
        setAlerts(prev => 
          prev.map(alert => ({ ...alert, acknowledged: true }))
        );
        toast.success('Todos os alertas foram confirmados');
      }
    } catch (error) {
      console.error('Erro ao confirmar todos os alertas:', error);
      toast.error('Erro ao confirmar alertas');
    }
  };

  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'update_preferences',
          orgId,
          preferences: newPreferences
        })
      });
      
      if (response.ok) {
        setPreferences(prev => ({ ...prev, ...newPreferences } as NotificationPreferences));
        toast.success('Preferências atualizadas');
      }
    } catch (error) {
      console.error('Erro ao atualizar preferências:', error);
      toast.error('Erro ao atualizar preferências');
    }
  };

  const sendTestNotification = async () => {
    if (!session?.access_token) return;

    try {
      await fetch('/api/notifications/sse', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          orgId,
          message: 'Esta é uma notificação de teste do sistema',
          severity: 'info'
        })
      });
      toast.success('Notificação de teste enviada');
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      toast.error('Erro ao enviar notificação de teste');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unacknowledged':
        return !alert.acknowledged;
      case 'critical':
        return alert.severity === 'critical';
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Bell className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Notificações</h2>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={sendTestNotification}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Teste
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">{stats.total_alerts}</div>
            <div className="text-sm text-gray-500">Total de Alertas</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{stats.critical_alerts}</div>
            <div className="text-sm text-gray-500">Críticos</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{stats.warning_alerts}</div>
            <div className="text-sm text-gray-500">Avisos</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.acknowledged_alerts}</div>
            <div className="text-sm text-gray-500">Reconhecidos</div>
          </div>
        </div>
      )}

      {/* Configurações */}
      {showSettings && preferences && (
        <div className="bg-white p-4 rounded-lg border mb-6">
          <h3 className="text-lg font-semibold mb-4">Configurações de Notificação</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Alertas de Saldo Baixo</label>
              <input
                type="checkbox"
                checked={preferences.low_balance_alerts}
                onChange={(e) => updatePreferences({ low_balance_alerts: e.target.checked })}
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Limite de Saldo Baixo</label>
              <input
                type="number"
                value={preferences.low_balance_threshold}
                onChange={(e) => updatePreferences({ low_balance_threshold: parseInt(e.target.value) })}
                className="w-20 px-2 py-1 border rounded text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Notificações por Email</label>
              <input
                type="checkbox"
                checked={preferences.email_notifications}
                onChange={(e) => updatePreferences({ email_notifications: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'unacknowledged' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Não Reconhecidos ({alerts.filter(a => !a.acknowledged).length})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'critical' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Críticos ({alerts.filter(a => a.severity === 'critical').length})
          </button>
        </div>
        
        {filteredAlerts.some(a => !a.acknowledged) && (
          <button
            onClick={acknowledgeAll}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Reconhecer Todos
          </button>
        )}
      </div>

      {/* Lista de Alertas */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum alerta encontrado</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-l-4 rounded-lg ${getSeverityColor(alert.severity)} ${
                alert.acknowledged ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                    <p className="text-gray-700 mt-1">{alert.message}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                      <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                      {alert.acknowledged && (
                        <span className="flex items-center space-x-1 text-green-600">
                          <Check className="w-4 h-4" />
                          <span>Reconhecido</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {!alert.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Reconhecer alerta"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}