-- Script para criar usuário Super Admin
-- Execute este script no Supabase SQL Editor

-- 1. Primeiro, inserir o usuário na tabela auth.users (simulando registro)
-- Nota: Em produção, o usuário deve se registrar normalmente primeiro
-- Este é apenas um exemplo para desenvolvimento

-- 2. Inserir/atualizar o perfil como super admin
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
VALUES (
  gen_random_uuid(), -- Gera um UUID aleatório
  'web@logintecnologia.com.br',
  'Super Admin',
  'super_admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  role = 'super_admin',
  updated_at = NOW();

-- 3. Verificar se o usuário foi criado corretamente
SELECT id, email, full_name, role, created_at 
FROM profiles 
WHERE email = 'web@logintecnologia.com.br';

-- INSTRUÇÕES:
-- 1. O usuário deve primeiro se registrar normalmente em http://localhost:3000
-- 2. Depois execute este script no Supabase SQL Editor
-- 3. Ou altere manualmente o role na tabela profiles

-- ALTERNATIVA MANUAL:
-- UPDATE profiles 
-- SET role = 'super_admin' 
-- WHERE email = 'web@logintecnologia.com.br';