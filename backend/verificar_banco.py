#!/usr/bin/env python3
"""Script para verificar o conteúdo do banco de dados"""

import sqlite3
import os
from datetime import datetime

# Caminho do banco de dados
DB_NAME = os.path.join(os.path.dirname(__file__), 'agendamento.db')

print("="*60)
print("🔍 VERIFICANDO BANCO DE DADOS")
print("="*60)
print(f"📁 Caminho do banco: {DB_NAME}")
print(f"📁 Existe? {os.path.exists(DB_NAME)}")
print()

if not os.path.exists(DB_NAME):
    print("❌ Banco de dados não encontrado!")
    exit(1)

conn = sqlite3.connect(DB_NAME)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Verificar estrutura da tabela
print("📋 Estrutura da tabela 'agendamentos':")
cursor.execute("PRAGMA table_info(agendamentos)")
colunas = cursor.fetchall()
for coluna in colunas:
    print(f"   - {coluna[1]} ({coluna[2]})")
print()

# Contar total de agendamentos
cursor.execute('SELECT COUNT(*) FROM agendamentos')
total = cursor.fetchone()[0]
print(f"📊 Total de agendamentos no banco: {total}")
print()

if total > 0:
    # Listar todos os agendamentos
    cursor.execute('SELECT * FROM agendamentos ORDER BY id DESC LIMIT 20')
    agendamentos = cursor.fetchall()
    
    print(f"📋 Últimos {len(agendamentos)} agendamentos:")
    print("-"*60)
    for ag in agendamentos:
        print(f"ID: {ag['id']}")
        print(f"  Nome: {ag['nome']}")
        print(f"  Telefone: {ag['telefone']}")
        if 'servico' in ag.keys():
            print(f"  Serviço: {ag['servico']}")
        print(f"  Data: {ag['data']}")
        print(f"  Horário: {ag['horario']}")
        if 'valor' in ag.keys():
            print(f"  Valor: R$ {ag['valor']:.2f}")
        print(f"  Status: {ag['status']}")
        if 'created_at' in ag.keys():
            print(f"  Criado em: {ag['created_at']}")
        print()
else:
    print("✅ Banco de dados está vazio (sem agendamentos)")
    print()

# Verificar sequência de IDs
cursor.execute("SELECT * FROM sqlite_sequence WHERE name='agendamentos'")
seq = cursor.fetchone()
if seq:
    print(f"🔢 Sequência de IDs: próximo ID será {seq[1]}")
else:
    print("🔢 Sequência de IDs: não existe (banco limpo)")

conn.close()

print("="*60)
