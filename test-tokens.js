const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testTokens() {
  try {
    // Simular login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'diogo@example.com',
      password: 'password123'
    });

    if (authError) {
      console.error('Erro de autenticação:', authError);
      return;
    }

    console.log('Login realizado com sucesso:', authData.user.email);

    // Buscar tokens do usuário
    const { data: tokensData, error: tokensError } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', authData.user.id);

    if (tokensError) {
      console.error('Erro ao buscar tokens:', tokensError);
      return;
    }

    console.log('Tokens encontrados:', tokensData);

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

testTokens();