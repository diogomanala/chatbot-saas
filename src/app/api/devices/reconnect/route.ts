import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, org_id')
      .eq('auth_token', token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { deviceId } = await request.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'ID do dispositivo é obrigatório' }, { status: 400 });
    }

    // Buscar dispositivo
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('org_id', profile.org_id)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Dispositivo não encontrado' }, { status: 404 });
    }

    // Tentar reconectar na Evolution API
    try {
      const reconnectResponse = await axios.post(
        `${process.env.EVOLUTION_API_URL}/instance/connect/${device.session_name}`,
        {},
        {
          headers: {
            'apikey': process.env.EVOLUTION_API_KEY
          }
        }
      );

      // Atualizar status no banco
      const { error: updateError } = await supabase
        .from('devices')
        .update({
          status: 'connecting',
          updated_at: new Date().toISOString(),
          metadata: {
            ...device.metadata,
            last_reconnect_attempt: {
              timestamp: new Date().toISOString(),
              success: true,
              response: reconnectResponse.data
            }
          }
        })
        .eq('id', deviceId);

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
      }

      return NextResponse.json({
        success: true,
        message: 'Reconexão iniciada com sucesso',
        device: {
          id: device.id,
          name: device.name,
          status: 'connecting'
        },
        evolutionResponse: reconnectResponse.data
      });

    } catch (evolutionError: any) {
      console.error('Erro na Evolution API:', evolutionError.response?.data || evolutionError.message);
      
      // Atualizar com erro
      const { error: updateError } = await supabase
        .from('devices')
        .update({
          status: 'error',
          updated_at: new Date().toISOString(),
          metadata: {
            ...device.metadata,
            last_reconnect_attempt: {
              timestamp: new Date().toISOString(),
              success: false,
              error: evolutionError.response?.data || evolutionError.message
            }
          }
        })
        .eq('id', deviceId);

      return NextResponse.json({
        success: false,
        error: 'Falha ao reconectar dispositivo',
        details: evolutionError.response?.data || evolutionError.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro no endpoint de reconexão:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de reconexão ativo',
    timestamp: new Date().toISOString()
  });
}