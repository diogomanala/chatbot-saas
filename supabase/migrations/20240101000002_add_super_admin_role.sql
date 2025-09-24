-- Adicionar o valor 'super_admin' ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Comentário explicativo
COMMENT ON TYPE user_role IS 'Roles disponíveis: user, admin, super_admin';