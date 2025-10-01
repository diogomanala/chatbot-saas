import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('device_id');
    const sessionName = searchParams.get('session_name');

    if (!deviceId && !sessionName) {
      return NextResponse.json({ error: 'device_id or session_name required' }, { status: 400 });
    }

    // Buscar device
    let deviceQuery = supabase
      .from('devices')
      .select('*');
    
    if (deviceId) {
      deviceQuery = deviceQuery.eq('id', deviceId);
    } else {
      deviceQuery = deviceQuery.eq('session_name', sessionName);
    }

    const { data: device, error: deviceError } = await deviceQuery.single();

    if (deviceError || !device) {
      return NextResponse.json({ 
        error: 'Device not found', 
        deviceError,
        searchParams: { deviceId, sessionName }
      }, { status: 404 });
    }

    // Buscar configuração do device
    const { data: deviceConfig, error: configError } = await supabase
      .from('device_configs')
      .select('*')
      .eq('device_id', device.id)
      .single();

    // Buscar chatbot ativo
    const { data: activeChatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('org_id', device.org_id)
      .eq('is_active', true)
      .single();

    return NextResponse.json({
      device: {
        id: device.id,
        name: device.name,
        session_name: device.session_name,
        org_id: device.org_id,
        status: device.status,
        chatbot_id: device.chatbot_id
      },
      deviceConfig: deviceConfig || null,
      configError: configError?.code === 'PGRST116' ? 'No config found' : configError,
      activeChatbot: activeChatbot ? {
        id: activeChatbot.id,
        name: activeChatbot.name,
        is_active: activeChatbot.is_active,
        model: activeChatbot.model
      } : null,
      chatbotError: chatbotError?.code === 'PGRST116' ? 'No active chatbot found' : chatbotError,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug device config error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
}