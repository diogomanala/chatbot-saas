import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { buildEvolutionApiUrl, getEvolutionApiHeaders, validateConfig } from '@/lib/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Validar configuração
    validateConfig(['SUPABASE_SERVICE_ROLE_KEY']);
    
    console.log('🧹 Iniciando limpeza de instâncias órfãs...');

    // 1. Buscar todas as instâncias na Evolution API
    const evolutionResponse = await axios.get(
      buildEvolutionApiUrl('/instance/fetchInstances'),
      {
        headers: getEvolutionApiHeaders()
      }
    );

    const evolutionInstances = evolutionResponse.data;
    console.log(`📊 Encontradas ${evolutionInstances.length} instâncias na Evolution API`);

    // 2. Buscar todos os dispositivos no banco
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, name, session_name, status');

    if (devicesError) {
      throw new Error(`Erro ao buscar dispositivos: ${devicesError.message}`);
    }

    console.log(`📊 Encontrados ${devices.length} dispositivos no banco`);

    // 3. Identificar instâncias órfãs (na Evolution mas não no banco)
    const deviceSessionNames = devices.map(d => d.session_name);
    const orphanInstances = evolutionInstances.filter(
      (instance: any) => !deviceSessionNames.includes(instance.name)
    );

    console.log(`🗑️ Encontradas ${orphanInstances.length} instâncias órfãs`);

    // 4. Deletar instâncias órfãs
    const deletedInstances: string[] = [];
    for (const orphan of orphanInstances) {
      try {
        await axios.delete(
          buildEvolutionApiUrl(`/instance/delete/${orphan.name}`),
          {
            headers: getEvolutionApiHeaders()
          }
        );
        deletedInstances.push(orphan.name);
        console.log(`✅ Instância órfã deletada: ${orphan.name}`);
      } catch (deleteError: any) {
        console.error(`❌ Erro ao deletar instância ${orphan.name}:`, deleteError.response?.data || deleteError.message);
      }
    }

    // 5. Resetar status de dispositivos problemáticos
    const problematicDevices = devices.filter(d => 
      d.status === 'connecting' || d.status === 'disconnected'
    );

    console.log(`🔄 Resetando ${problematicDevices.length} dispositivos problemáticos`);

    const resetResults: any[] = [];
    for (const device of problematicDevices) {
      try {
        // Verificar status real na Evolution API
        const statusResponse = await axios.get(
          buildEvolutionApiUrl(`/instance/connectionState/${device.session_name}`),
          {
            headers: getEvolutionApiHeaders()
          }
        );

        const realStatus = statusResponse.data?.instance?.state;
        let newStatus = 'disconnected';

        if (realStatus === 'open') {
          newStatus = 'connected';
        } else if (realStatus === 'connecting') {
          newStatus = 'connecting';
        }

        // Atualizar no banco
        const { error: updateError } = await supabase
          .from('devices')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);

        if (updateError) {
          throw updateError;
        }

        resetResults.push({
          device: device.name,
          oldStatus: device.status,
          newStatus,
          realStatus
        });

        console.log(`🔄 ${device.name}: ${device.status} → ${newStatus} (real: ${realStatus})`);
      } catch (error: any) {
        console.error(`❌ Erro ao resetar ${device.name}:`, error.message);
        resetResults.push({
          device: device.name,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Limpeza concluída com sucesso',
      results: {
        totalEvolutionInstances: evolutionInstances.length,
        totalDatabaseDevices: devices.length,
        orphanInstancesFound: orphanInstances.length,
        orphanInstancesDeleted: deletedInstances.length,
        deletedInstances,
        problematicDevicesReset: resetResults.length,
        resetResults
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na limpeza:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Validar configuração
    validateConfig(['SUPABASE_SERVICE_ROLE_KEY']);
    
    // Apenas mostrar estatísticas sem fazer limpeza
    const evolutionResponse = await axios.get(
      buildEvolutionApiUrl('/instance/fetchInstances'),
      {
        headers: getEvolutionApiHeaders()
      }
    );

    const { data: devices } = await supabase
      .from('devices')
      .select('id, name, session_name, status');

    const deviceSessionNames = devices?.map(d => d.session_name) || [];
    const orphanInstances = evolutionResponse.data.filter(
      (instance: any) => !deviceSessionNames.includes(instance.name)
    );

    const problematicDevices = devices?.filter(d => 
      d.status === 'connecting' || d.status === 'disconnected'
    ) || [];

    return NextResponse.json({
      statistics: {
        totalEvolutionInstances: evolutionResponse.data.length,
        totalDatabaseDevices: devices?.length || 0,
        orphanInstances: orphanInstances.length,
        problematicDevices: problematicDevices.length,
        orphanInstancesList: orphanInstances.map((i: any) => ({
          name: i.name,
          status: i.connectionStatus,
          createdAt: i.createdAt
        })),
        problematicDevicesList: problematicDevices.map(d => ({
          name: d.name,
          status: d.status,
          sessionName: d.session_name
        }))
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}