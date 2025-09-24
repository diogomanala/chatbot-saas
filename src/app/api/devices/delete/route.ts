import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
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

    // Verificar se o device pertence à organização do usuário
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('id, org_id, session_name')
      .eq('id', deviceId)
      .eq('org_id', profile.org_id)
      .single();

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Deletar instância na Evolution API se disponível
    let evolutionDeleted = false;
    if (device.session_name && process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
      try {
        const evolutionResponse = await fetch(
          `${process.env.EVOLUTION_API_URL}/instance/delete/${device.session_name}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': process.env.EVOLUTION_API_KEY,
            },
          }
        );
        
        if (evolutionResponse.ok) {
          evolutionDeleted = true;
          console.log('Instância deletada na Evolution API:', device.session_name);
        } else {
          console.error('Erro ao deletar instância na Evolution API:', await evolutionResponse.text());
        }
      } catch (evolutionError) {
        console.error('Erro ao conectar com Evolution API:', evolutionError);
      }
    }

    // Deletar o device do banco
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
      evolution_deleted: evolutionDeleted,
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