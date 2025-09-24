import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Listar chatbots
export async function GET(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Buscar o perfil do usuário para obter o org_id
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Erro ao buscar perfil do usuário:', profileError);
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      // Buscar chatbot específico
      const { data: chatbot, error } = await supabaseAdmin
        .from('chatbots')
        .select('*')
        .eq('id', id)
        .eq('org_id', profile.org_id)
        .single();

      if (error) {
        console.error('Erro ao buscar chatbot:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ chatbot });
    } else {
      // Buscar o perfil do usuário para obter o org_id
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Erro ao buscar perfil do usuário:', profileError);
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }

      // Listar todos os chatbots
      const { data: chatbots, error } = await supabaseAdmin
        .from('chatbots')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar chatbots:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        chatbots_found: chatbots?.length || 0,
        chatbots: chatbots || []
      });
    }
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Criar novo chatbot
export async function POST(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Buscar o perfil do usuário para obter o org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // Permitir múltiplos chatbots ativos simultaneamente
    
    const { data: chatbot, error } = await supabaseAdmin
      .from('chatbots')
      .insert({
        ...body,
        org_id: profile.org_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar chatbot:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chatbot }, { status: 201 });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar chatbot
export async function PUT(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Buscar o perfil do usuário para obter o org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // Se está ativando um chatbot (is_active: true), desativar todos os outros primeiro
    if (body.is_active === true) {
      console.log('[ChatbotManager] Ativando chatbot:', id);
      
      // Desativar todos os outros chatbots da mesma organização
      const { error: deactivateError } = await supabaseAdmin
        .from('chatbots')
        .update({ is_active: false })
        .eq('org_id', profile.org_id)
        .neq('id', id);
      
      if (deactivateError) {
        console.error('Erro ao desativar outros chatbots:', deactivateError);
        return NextResponse.json({ error: 'Erro ao desativar outros chatbots' }, { status: 500 });
      }
    }
    
    const { data: chatbot, error } = await supabaseAdmin
      .from('chatbots')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', profile.org_id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar chatbot:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chatbot });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar chatbot
export async function DELETE(request: NextRequest) {
  try {
    // Verificar token de autorização no header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    // Buscar o perfil do usuário para obter o org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    
    const { error } = await supabaseAdmin
      .from('chatbots')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.org_id);

    if (error) {
      console.error('Erro ao deletar chatbot:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}