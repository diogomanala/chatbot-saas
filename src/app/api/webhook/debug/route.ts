import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  try {
    // Capturar todos os headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Capturar o body
    const body = await request.text();
    
    // Capturar informações da URL
    const url = request.url;
    const method = request.method;
    
    // Log detalhado no console
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Timestamp:', timestamp);
    console.log('Method:', method);
    console.log('URL:', url);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body (raw):', body);
    
    // Tentar parsear o body como JSON
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(body);
      console.log('Body (parsed):', JSON.stringify(parsedBody, null, 2));
    } catch (e) {
      console.log('Body não é JSON válido');
    }

    // Salvar no banco para análise posterior
    const debugData = {
      timestamp,
      method,
      url,
      headers,
      body_raw: body,
      body_parsed: parsedBody,
      user_agent: headers['user-agent'] || null,
      content_type: headers['content-type'] || null,
      origin: headers['origin'] || null
    };

    // Tentar salvar no Supabase (se falhar, não quebra o webhook)
    try {
      await supabase
        .from('webhook_debug_logs')
        .insert(debugData);
      console.log('Debug log salvo no banco');
    } catch (dbError) {
      console.error('Erro ao salvar debug log:', dbError);
    }

    console.log('=== FIM DEBUG ===');

    return NextResponse.json({
      success: true,
      message: 'Debug webhook received',
      timestamp,
      received_data: {
        method,
        headers_count: Object.keys(headers).length,
        body_length: body.length,
        has_json: parsedBody !== null
      }
    });

  } catch (error) {
    console.error('Erro no webhook debug:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno', 
        timestamp,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Debug webhook endpoint is active',
    timestamp: new Date().toISOString(),
    url: request.url
  });
}