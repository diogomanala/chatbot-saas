import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('*');

    if (error) {
      console.error('Erro ao buscar chatbots:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Chatbots encontrados:', chatbots);

    return NextResponse.json({
      chatbots_found: chatbots?.length || 0,
      chatbots: chatbots || []
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}