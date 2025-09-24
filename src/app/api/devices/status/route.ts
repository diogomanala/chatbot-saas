import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEVICE-STATUS] Request received:', request.url);
    
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');

    if (!deviceId) {
      console.error('❌ [DEVICE-STATUS] Device ID missing');
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    console.log('🔍 [DEVICE-STATUS] Device ID:', deviceId);

    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    console.log('🔍 [DEVICE-STATUS] Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [DEVICE-STATUS] Authorization header missing or invalid');
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔍 [DEVICE-STATUS] Token extracted, length:', token.length);
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ [DEVICE-STATUS] Invalid token:', authError?.message);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('✅ [DEVICE-STATUS] User authenticated:', user.id);

    // Buscar o perfil do usuário para obter a org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error('❌ [DEVICE-STATUS] Profile/Organization not found:', profileError?.message);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Buscar o device específico
    const { data: device, error } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('org_id', profile.org_id)
      .single();

    if (error || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Verificar status na Evolution API se disponível
    let evolutionStatus = null;
    if (device.instance_id && process.env.EVOLUTION_API_URL) {
      try {
        const evolutionResponse = await fetch(
          `${process.env.EVOLUTION_API_URL}/instance/connectionState/${device.instance_id}`,
          {
            headers: {
              'apikey': process.env.EVOLUTION_API_KEY || '',
            },
          }
        );
        
        if (evolutionResponse.ok) {
          const evolutionData = await evolutionResponse.json();
          const rawStatus = evolutionData.instance?.state || 'unknown';
          evolutionStatus = rawStatus;
          
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
              .eq('id', deviceId);
            
            device.status = mappedStatus;
          }
        }
      } catch (evolutionError) {
        console.error('Erro ao verificar status na Evolution API:', evolutionError);
      }
    }

    return NextResponse.json({
      success: true,
      device_id: device.id,
      status: device.status,
      evolution_status: evolutionStatus,
      updated_at: device.updated_at
    });
  } catch (error) {
    console.error('❌ [DEVICE-STATUS] Internal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}