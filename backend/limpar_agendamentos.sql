-- Script para limpar todos os agendamentos de teste
-- ATENÇÃO: Isso vai deletar TODOS os agendamentos do banco!

-- Deletar todos os agendamentos
DELETE FROM agendamentos;

-- Resetar o contador de IDs (opcional, mas recomendado)
DELETE FROM sqlite_sequence WHERE name='agendamentos';

-- Verificar quantos agendamentos restam (deve ser 0)
SELECT COUNT(*) as total_agendamentos FROM agendamentos;
