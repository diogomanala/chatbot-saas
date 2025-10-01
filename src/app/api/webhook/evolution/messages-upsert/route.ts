import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📨 MESSAGES_UPSERT webhook recebido:', JSON.stringify(body, null, 2));
    
    // Redirecionar para a rota principal
    const mainWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://saas-chatbot-production.vercel.app'}/api/webhook/evolution`;
    
    const response = await fetch(mainWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'messages.upsert',
        ...body
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return NextResponse.json(result);
    } else {
      console.error('Erro ao redirecionar para webhook principal:', await response.text());
      return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Erro no webhook messages-upsert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}