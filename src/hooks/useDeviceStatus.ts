'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';

// Tipos para o dispositivo
interface Device {
  id: string;
  org_id: string;
  name: string;
  session_name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  evolution_base_url?: string;
  evolution_api_key?: string;
  instance_id?: string;
  phone_jid?: string;
  last_connection?: string;
  webhook_secret?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  chatbot_id?: string;
  config?: any;
}

// Tipos para os eventos do Supabase Realtime
interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Device;
  old: Device;
  errors: any;
}

interface UseDeviceStatusOptions {
  onDeviceUpdate?: (device: Device) => void;
  onDeviceInsert?: (device: Device) => void;
  onDeviceDelete?: (device: Device) => void;
  enableToasts?: boolean;
}

interface UseDeviceStatusReturn {
  devices: Device[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isConnected: boolean;
}

/**
 * Hook simplificado para escutar mudanças em tempo real na tabela devices
 * usando Supabase Realtime - Versão estável sem loops infinitos
 */
export function useDeviceStatus(
  session: Session | null,
  options: UseDeviceStatusOptions = {}
): UseDeviceStatusReturn {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const channelRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const {
    onDeviceUpdate,
    onDeviceInsert,
    onDeviceDelete,
    enableToasts = true
  } = options;

  // Inicializar cliente Supabase
  const initializeSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return supabaseRef.current;
  }, []);

  // Buscar dispositivos iniciais
  const fetchDevices = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Criar novo AbortController
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      // Ignorar erros de abort
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('Erro ao buscar dispositivos:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      
      if (enableToasts) {
        toast.error('Erro ao carregar dispositivos');
      }
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, enableToasts]);

  // Configurar subscription em tempo real
  const setupRealtimeSubscription = useCallback(() => {
    if (!session?.access_token) return;

    const supabase = initializeSupabase();
    
    // Remover subscription anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              if (payload.new) {
                setDevices(prev => [...prev, payload.new]);
                onDeviceInsert?.(payload.new);
                
                if (enableToasts) {
                  toast.success(`Dispositivo "${payload.new.name}" foi adicionado`);
                }
              }
              break;

            case 'UPDATE':
              if (payload.new) {
                setDevices(prev => 
                  prev.map(device => 
                    device.id === payload.new.id ? payload.new : device
                  )
                );
                onDeviceUpdate?.(payload.new);
                
                if (enableToasts && payload.old && payload.old.status !== payload.new.status) {
                  const statusMessages = {
                    connected: 'conectado',
                    connecting: 'conectando',
                    disconnected: 'desconectado'
                  };
                  toast.info(`Dispositivo "${payload.new.name}" está ${statusMessages[payload.new.status] || payload.new.status}`);
                }
              }
              break;

            case 'DELETE':
              if (payload.old) {
                setDevices(prev => prev.filter(device => device.id !== payload.old.id));
                onDeviceDelete?.(payload.old);
                
                if (enableToasts) {
                  toast.error(`Dispositivo "${payload.old.name}" foi removido`);
                }
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED' && enableToasts) {
          toast.success('Conectado ao sistema de atualizações em tempo real');
        } else if (status === 'CHANNEL_ERROR' && enableToasts) {
          toast.error('Erro na conexão em tempo real');
        }
      });

    channelRef.current = channel;
  }, [session?.access_token, enableToasts, onDeviceUpdate, onDeviceInsert, onDeviceDelete, initializeSupabase]);

  // Função para refetch manual
  const refetch = useCallback(async () => {
    await fetchDevices();
  }, [fetchDevices]);

  // Efeito principal - configurar subscription e buscar dados iniciais
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    if (session.access_token) {
      fetchDevices();
      setupRealtimeSubscription();
    } else {
      setLoading(false);
    }

    // Cleanup
    return () => {
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [session?.access_token, fetchDevices, setupRealtimeSubscription]);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      if (channelRef.current && supabaseRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    devices,
    loading,
    error,
    refetch,
    isConnected
  };
}