import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // Atualizar o primeiro chatbot para usar o device correto
    const { data: updatedChatbot, error } = await supabase
      .from('chatbots')
      .update({ device_id: '30643b7a-61a4-49b6-989b-44c1de1ae103' })
      .eq('id', '48a951ea-a9ac-4f4d-a805-3945d313fd18')
      .select();

    if (error) {
      console.error('Erro ao atualizar chatbot:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Chatbot atualizado:', updatedChatbot);

    return NextResponse.json({
      success: true,
      updated_chatbot: updatedChatbot
    });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}