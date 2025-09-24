import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('Buscando device com session_name: device_1757769886275_frkwrtw2n');
    
    // Primeiro, buscar o device pela session_name
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, session_name, status')
      .eq('session_name', 'device_1757769886275_frkwrtw2n')
      .single();

    console.log('Device query result:', { device, deviceError });

    if (deviceError || !device) {
      return NextResponse.json({
        chatbots_found: 0,
        chatbots: [],
        device_found: false,
        error: 'Device not found',
        debug: { deviceError, searchedSessionName: 'device_1757769886275_frkwrtw2n' }
      });
    }

    // Agora buscar chatbots para este device
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('*')
      .eq('device_id', device.id)
      .eq('status', 'active');

    if (error) {
      console.error('Erro ao buscar chatbots:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      chatbots_found: chatbots?.length || 0,
      chatbots: chatbots || [],
      instance_id: 'device_1757769886275_frkwrtw2n'
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}