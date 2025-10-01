import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const sessionName = searchParams.get('sessionName');
    
    if (!deviceId && !sessionName) {
      return NextResponse.json({ error: 'deviceId or sessionName required' }, { status: 400 });
    }
    
    let query = supabase
      .from('devices')
      .select('id, name, session_name, status, metadata, created_at, org_id');
    
    if (deviceId) {
      query = query.eq('id', deviceId);
    } else if (sessionName) {
      query = query.eq('session_name', sessionName);
    }
    
    const { data: devices, error: deviceError } = await query;
    
    if (deviceError) {
      return NextResponse.json({ error: deviceError.message }, { status: 500 });
    }
    
    if (!devices || devices.length === 0) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    
    const device = devices[0];
    
    // Buscar chatbots da organização
    let chatbots = [];
    if (device.org_id) {
      const { data: orgChatbots, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id, name, fallback_message, is_active, is_default, org_id')
        .eq('org_id', device.org_id);
      
      if (!chatbotError) {
        chatbots = orgChatbots || [];
      }
    }
    
    return NextResponse.json({
      device,
      chatbots,
      analysis: {
        hasOrgId: !!device.org_id,
        totalChatbots: chatbots.length,
        activeChatbots: chatbots.filter(c => c.is_active).length,
        defaultChatbots: chatbots.filter(c => c.is_default && c.is_active).length,
        hasMetadata: !!device.metadata,
        hasChatbotConfig: !!(device.metadata?.chatbot_config)
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}