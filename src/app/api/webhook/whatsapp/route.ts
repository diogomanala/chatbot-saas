import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 [WEBHOOK-WHATSAPP] Webhook recebido');
    
    const body = await request.json();
    console.log('📦 [WEBHOOK-WHATSAPP] Payload:', JSON.stringify(body, null, 2));

    // Extrair evento e instância
    const event = body.event;
    const instance = body.instance?.instanceName || body.instanceName;
    
    if (!event || !instance) {
      console.log('❌ [WEBHOOK-WHATSAPP] Evento ou instância não encontrados');
      return NextResponse.json({ error: 'Event or instance not found' }, { status: 400 });
    }

    console.log(`🎯 [WEBHOOK-WHATSAPP] Processando evento: ${event} para instância: ${instance}`);

    // Rotear eventos para endpoints específicos
    switch (event) {
      case 'CONNECTION_UPDATE':
      case 'connection.update':
        console.log('🔄 [WEBHOOK-WHATSAPP] Redirecionando para connection-update');
        return await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution/connection-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        }).then(res => res.json()).then(data => NextResponse.json(data));

      case 'QRCODE_UPDATED':
      case 'qrcode.updated':
        console.log('📱 [WEBHOOK-WHATSAPP] QR Code atualizado');
        // Aqui você pode adicionar lógica específica para QR Code se necessário
        return NextResponse.json({ success: true, message: 'QR Code updated' });

      case 'MESSAGES_UPSERT':
      case 'messages.upsert':
        console.log('💬 [WEBHOOK-WHATSAPP] Redirecionando para messages-upsert');
        return await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution/messages-upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        }).then(res => res.json()).then(data => NextResponse.json(data));

      case 'MESSAGES_UPDATE':
      case 'messages.update':
        console.log('📝 [WEBHOOK-WHATSAPP] Redirecionando para messages-update');
        return await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/evolution/messages-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        }).then(res => res.json()).then(data => NextResponse.json(data));

      default:
        console.log(`ℹ️ [WEBHOOK-WHATSAPP] Evento não tratado: ${event}`);
        return NextResponse.json({ 
          success: true, 
          message: `Event ${event} received but not processed`,
          event,
          instance 
        });
    }

  } catch (error) {
    console.error('❌ [WEBHOOK-WHATSAPP] Erro ao processar webhook:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'WhatsApp webhook endpoint is active',
    timestamp: new Date().toISOString(),
    endpoint: '/api/webhook/whatsapp'
  });
}