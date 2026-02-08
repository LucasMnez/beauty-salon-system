-- Limpar todos os agendamentos
DELETE FROM agendamentos;

-- Resetar contador de IDs
DELETE FROM sqlite_sequence WHERE name='agendamentos';

-- Verificar se foi limpo
SELECT COUNT(*) as total_restante FROM agendamentos;
