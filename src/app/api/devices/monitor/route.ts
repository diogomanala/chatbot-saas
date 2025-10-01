import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Iniciando monitoramento automático de dispositivos...');
    
    // Buscar todos os dispositivos ativos
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*');

    if (devicesError) {
      console.error('Erro ao buscar dispositivos:', devicesError);
      return NextResponse.json({ error: 'Erro ao buscar dispositivos' }, { status: 500 });
    }

    const results = [];
    
    for (const device of devices) {
      try {
        console.log(`📱 Verificando dispositivo: ${device.name} (${device.instance_id})`);
        
        // Verificar status na Evolution API
        const statusResponse = await axios.get(
          `${process.env.EVOLUTION_API_URL}/instance/connectionState/${device.instance_id}`,
          {
            headers: {
              'apikey': process.env.EVOLUTION_API_KEY
            }
          }
        );

        const evolutionStatus = statusResponse.data?.instance?.state;
        const currentStatus = device.status;
        
        let newStatus = 'error';
        if (evolutionStatus === 'open') {
          newStatus = 'connected';
        } else if (evolutionStatus === 'connecting') {
          newStatus = 'connecting';
        } else if (evolutionStatus === 'close') {
          newStatus = 'disconnected';
        }

        // Se o status mudou, atualizar no banco
        if (newStatus !== currentStatus) {
          console.log(`🔄 Status alterado para ${device.name}: ${currentStatus} → ${newStatus}`);
          
          const { error: updateError } = await supabase
            .from('devices')
            .update({
              status: newStatus,
              last_connection: newStatus === 'connected' ? new Date().toISOString() : device.last_connection,
              updated_at: new Date().toISOString(),
              metadata: {
                ...device.metadata,
                last_monitor_check: {
                  timestamp: new Date().toISOString(),
                  previous_status: currentStatus,
                  new_status: newStatus,
                  evolution_state: evolutionStatus
                }
              }
            })
            .eq('id', device.id);

          if (updateError) {
            console.error(`Erro ao atualizar ${device.name}:`, updateError);
          }
        }

        // Se desconectado, tentar reconectar automaticamente
        if (newStatus === 'disconnected' && device.auto_reconnect !== false) {
          console.log(`🔌 Tentando reconectar ${device.name}...`);
          
          try {
            await axios.post(
              `${process.env.EVOLUTION_API_URL}/instance/connect/${device.instance_id}`,
              {},
              {
                headers: {
                  'apikey': process.env.EVOLUTION_API_KEY
                }
              }
            );
            
            console.log(`✅ Reconexão iniciada para ${device.name}`);
            
            // Atualizar status para connecting
            await supabase
              .from('devices')
              .update({
                status: 'connecting',
                updated_at: new Date().toISOString(),
                metadata: {
                  ...device.metadata,
                  last_auto_reconnect: {
                    timestamp: new Date().toISOString(),
                    success: true
                  }
                }
              })
              .eq('id', device.id);
              
          } catch (reconnectError: any) {
            console.error(`❌ Falha na reconexão de ${device.name}:`, reconnectError.response?.data || reconnectError.message);
            
            await supabase
              .from('devices')
              .update({
                metadata: {
                  ...device.metadata,
                  last_auto_reconnect: {
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: reconnectError.response?.data || reconnectError.message
                  }
                }
              })
              .eq('id', device.id);
          }
        }

        results.push({
          device: device.name,
          session: device.instance_id,
          previous_status: currentStatus,
          current_status: newStatus,
          evolution_state: evolutionStatus,
          updated: newStatus !== currentStatus
        });

      } catch (error: any) {
        console.error(`Erro ao verificar ${device.name}:`, error.response?.data || error.message);
        
        results.push({
          device: device.name,
          session: device.instance_id,
          error: error.response?.data || error.message
        });
      }
    }

    console.log('✅ Monitoramento concluído');
    
    return NextResponse.json({
      success: true,
      message: 'Monitoramento concluído',
      timestamp: new Date().toISOString(),
      devices_checked: devices.length,
      results
    });

  } catch (error) {
    console.error('Erro no monitoramento:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de monitoramento ativo',
    timestamp: new Date().toISOString(),
    description: 'Use POST para executar monitoramento manual'
  });
}