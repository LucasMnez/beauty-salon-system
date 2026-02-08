#!/usr/bin/env python3
"""Script para limpar TODOS os agendamentos do banco de dados"""

import sqlite3
import os

# Caminho do banco de dados
DB_NAME = os.path.join(os.path.dirname(__file__), 'agendamento.db')

print("="*60)
print("🗑️ LIMPAR BANCO DE DADOS")
print("="*60)
print(f"📁 Caminho do banco: {DB_NAME}")
print()

if not os.path.exists(DB_NAME):
    print("❌ Banco de dados não encontrado!")
    exit(1)

# Confirmar ação
confirmacao = input("⚠️ ATENÇÃO: Isso vai deletar TODOS os agendamentos!\nDigite 'LIMPAR' para confirmar: ")

if confirmacao != 'LIMPAR':
    print("❌ Operação cancelada.")
    exit(0)

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

try:
    # Contar quantos agendamentos serão deletados
    cursor.execute('SELECT COUNT(*) FROM agendamentos')
    total = cursor.fetchone()[0]
    print(f"\n📊 Total de agendamentos encontrados: {total}")
    
    if total == 0:
        print("ℹ️ Nenhum agendamento para deletar")
        conn.close()
        exit(0)
    
    # Deletar todos os agendamentos
    print("🗑️ Deletando agendamentos...")
    cursor.execute('DELETE FROM agendamentos')
    
    # Resetar contador de IDs
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='agendamentos'")
    
    conn.commit()
    
    # Verificar se foi deletado
    cursor.execute('SELECT COUNT(*) FROM agendamentos')
    restante = cursor.fetchone()[0]
    
    print(f"✅ Agendamentos deletados: {total}")
    print(f"📊 Agendamentos restantes: {restante}")
    
    if restante == 0:
        print("\n✅ Banco limpo com sucesso!")
    else:
        print(f"\n⚠️ Ainda há {restante} agendamento(s) no banco!")
    
except Exception as e:
    print(f"❌ ERRO ao limpar banco: {str(e)}")
    import traceback
    traceback.print_exc()
    conn.rollback()
finally:
    conn.close()

print("="*60)
