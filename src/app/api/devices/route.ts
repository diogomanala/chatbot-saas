import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API /devices - Iniciando requisição');
    
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    console.log('🔍 Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Authorization header missing or invalid format');
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔍 Token extracted:', token ? 'Present' : 'Missing');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log('❌ Token validation failed:', authError?.message || 'No user found');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    // Buscar o perfil do usuário para obter a org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Buscar devices da organização do usuário
    const { data: devices, error } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar devices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verificar status em tempo real na Evolution API para cada device
    const devicesWithRealTimeStatus = await Promise.all(
      (devices || []).map(async (device) => {
        if (device.session_name && process.env.EVOLUTION_API_URL) {
          try {
            const evolutionResponse = await fetch(
              `${process.env.EVOLUTION_API_URL}/instance/connectionState/${device.session_name}`,
              {
                headers: {
                  'apikey': process.env.EVOLUTION_API_KEY || '',
                },
              }
            );
            
            if (evolutionResponse.ok) {
              const evolutionData = await evolutionResponse.json();
              const rawStatus = evolutionData.instance?.state || 'unknown';
              
              // Mapear status da Evolution API para nosso sistema
              let mappedStatus = 'disconnected';
              if (rawStatus === 'open') {
                mappedStatus = 'connected';
              } else if (rawStatus === 'connecting') {
                mappedStatus = 'connecting';
              } else if (rawStatus === 'close') {
                mappedStatus = 'disconnected';
              }
              
              // Atualizar status no banco se diferente
              if (mappedStatus !== device.status) {
                await supabaseAdmin
                  .from('devices')
                  .update({ 
                    status: mappedStatus,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', device.id);
                
                device.status = mappedStatus;
              }
            }
          } catch (evolutionError) {
            console.error(`Erro ao verificar status na Evolution API para device ${device.id}:`, evolutionError);
          }
        }
        return device;
      })
    );

    return NextResponse.json({
      success: true,
      devices: devicesWithRealTimeStatus || [],
      count: devicesWithRealTimeStatus?.length || 0
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Buscar o perfil do usuário para obter a org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, session_name, webhook_secret } = body;

    if (!name || !session_name) {
      return NextResponse.json({ error: 'Name and session_name are required' }, { status: 400 });
    }

    // Gerar webhook_secret se não fornecido
    const finalWebhookSecret = webhook_secret || `wh_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

    // Criar novo device
    const { data: device, error: createError } = await supabaseAdmin
      .from('devices')
      .insert({
        name,
        session_name,
        org_id: profile.org_id,
        status: 'disconnected',
        evolution_base_url: process.env.EVOLUTION_API_URL || 'https://evolution-api.com',
        evolution_api_key: process.env.EVOLUTION_API_KEY || 'default-api-key',
        webhook_secret: finalWebhookSecret
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar device:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      device,
      message: 'Device created successfully'
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    // Buscar o perfil do usuário para obter a org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Verificar se o device pertence à organização do usuário
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('id, org_id')
      .eq('id', deviceId)
      .eq('org_id', profile.org_id)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Deletar o device
    const { error: deleteError } = await supabaseAdmin
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (deleteError) {
      console.error('Erro ao deletar device:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}