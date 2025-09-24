import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verificar token Bearer
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar o perfil do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, phone_number, session_name } = body;

    if (!name || !session_name) {
      return NextResponse.json({ error: 'Name and session_name are required' }, { status: 400 });
    }

    // Verificar se já existe um device com o mesmo session_name na organização
    const { data: existingDevice, error: checkError } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('session_name', session_name)
      .eq('org_id', profile.org_id)
      .single();

    if (existingDevice) {
      return NextResponse.json({ error: 'Device with this session name already exists' }, { status: 409 });
    }

    // Criar instância na Evolution API se disponível
    let evolutionCreated = false;
    if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
      try {
        const evolutionResponse = await fetch(
          `${process.env.EVOLUTION_API_URL}/instance/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              instanceName: session_name,
              token: process.env.EVOLUTION_API_KEY,
              qrcode: true,
              webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution`,
              webhook_by_events: false,
              webhook_base64: false,
              events: [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'SEND_MESSAGE'
              ]
            }),
          }
        );
        
        if (evolutionResponse.ok) {
          evolutionCreated = true;
          console.log('Instância criada na Evolution API:', session_name);
        } else {
          console.error('Erro ao criar instância na Evolution API:', await evolutionResponse.text());
        }
      } catch (evolutionError) {
        console.error('Erro ao conectar com Evolution API:', evolutionError);
      }
    }

    // Criar novo device no banco
    const { data: device, error: createError } = await supabaseAdmin
      .from('devices')
      .insert({
        name,
        session_name,
        org_id: profile.org_id,
        status: 'disconnected',
        evolution_base_url: process.env.EVOLUTION_API_URL || 'https://evolution-api.example.com',
        evolution_api_key: process.env.EVOLUTION_API_KEY || 'default_api_key',
        webhook_secret: `webhook_secret_${session_name}_${Date.now()}`,
        metadata: {}
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
      evolution_instance_created: evolutionCreated,
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