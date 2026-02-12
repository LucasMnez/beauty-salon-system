#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import site

# Detectar versão atual do Python
python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
python_full_version = sys.version_info


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "agendamento.db")
# Credenciais de admin (em produção, usar variáveis de ambiente)
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'raissa')
ADMIN_PASSWORD_HASH = os.getenv('ADMIN_PASSWORD_HASH', None)  # Será gerado na primeira execução


# Verificar se Python é 3.8+
if python_full_version < (3, 8):
    print(f"ERRO: Python {python_version} não é suportado!")
    print("Este aplicativo requer Python 3.8 ou superior.")
    print(f"Versão atual: {sys.version}")
    sys.exit(1)

# Adicionar diretórios do usuário ao PYTHONPATH
# Isso resolve o problema quando pip instala com --user
user_site = site.getusersitepackages()
if user_site and os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

# Adicionar diretório específico da versão atual primeiro
user_site_packages = os.path.expanduser(f'~/.local/lib/python{python_version}/site-packages')
if os.path.exists(user_site_packages) and user_site_packages not in sys.path:
    sys.path.insert(0, user_site_packages)

from flask import Flask, request, jsonify, render_template_string, session, redirect, url_for, send_from_directory, make_response
from flask_cors import CORS, cross_origin
from functools import wraps
import sqlite3
import os

from datetime import datetime, timedelta
import json
import qrcode
import base64
from io import BytesIO
import threading
import requests
import re
import hashlib
import secrets


# Configurar Flask para servir arquivos estáticos do frontend
# Se executado de dentro de backend/, usar caminho relativo
# Se executado da raiz, usar caminho absoluto
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')

# Verificar se frontend existe (se não, assumir que estamos na raiz)
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

def hash_password(password):
    """Gera hash seguro da senha usando SHA-256 com salt"""
    # Usar salt fixo para garantir consistência
    salt = 'raissa_nails_salt_2024'
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


# Configuração do banco de dados (caminho relativo ao backend/)
DB_NAME = os.path.join(os.path.dirname(__file__), 'agendamento.db')

# Log do caminho do banco na inicialização
print(f"\n📁 Caminho do banco de dados: {DB_NAME}")
print(f"📁 Banco existe? {os.path.exists(DB_NAME)}")
if os.path.exists(DB_NAME):
    tamanho = os.path.getsize(DB_NAME)
    print(f"📁 Tamanho do banco: {tamanho} bytes")
print()


def register_routes(app):

    @app.route("/health")
    def healthcheck():
        return "OK"

    @app.route("/api/servicos")
    def get_servicos():
        ...


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(32))
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_NAME'] = 'admin_session'
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)

    CORS(
        app,
        supports_credentials=True,
        origins=["https://raissa-nails-design.up.railway.app"]
    )

    with app.app_context():
        init_db()
        init_admin_password()

    # ⬇️ TODAS AS ROTAS VÊM AQUI
    register_routes(app)

    return app
    
def init_db():
    """Inicializa o banco de dados"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Tabela de agendamentos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT NOT NULL,
            servico TEXT NOT NULL,
            data DATE NOT NULL,
            horario TEXT NOT NULL,
            valor REAL NOT NULL,
            status TEXT DEFAULT 'pendente',
            forma_pagamento TEXT DEFAULT 'pendente',
            pix_qrcode TEXT,
            pix_copia_cola TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(data, horario)
        )
    ''')
    
    # Adicionar coluna forma_pagamento se não existir (migration)
    try:
        cursor.execute('ALTER TABLE agendamentos ADD COLUMN forma_pagamento TEXT DEFAULT "pendente"')
        conn.commit()
    except sqlite3.OperationalError:
        # Coluna já existe, ignorar
        pass
    
    # Adicionar colunas de pagamento se não existirem (migration)
    try:
        cursor.execute('ALTER TABLE agendamentos ADD COLUMN data_pagamento DATE')
        conn.commit()
    except sqlite3.OperationalError:
        # Coluna já existe, ignorar
        pass
    
    try:
        cursor.execute('ALTER TABLE agendamentos ADD COLUMN pago INTEGER DEFAULT 0')
        conn.commit()
    except sqlite3.OperationalError:
        # Coluna já existe, ignorar
        pass
    
    # Criar índices para melhorar performance das queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_agendamentos_data 
        ON agendamentos(data)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
        ON agendamentos(status)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_agendamentos_data_status 
        ON agendamentos(data, status)
    ''')
    
    # Tabela de horários bloqueados (feriados, etc)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS horarios_bloqueados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data DATE NOT NULL,
            horario TEXT NOT NULL,
            motivo TEXT,
            UNIQUE(data, horario)
        )
    ''')
    
    # Índice para horários bloqueados
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_bloqueados_data 
        ON horarios_bloqueados(data)
    ''')
    
    # Tabela de sessões admin (para controle de tokens)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_token TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_sessions_token 
        ON admin_sessions(session_token)
    ''')
    
    # Tabela de serviços
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS servicos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            valor REAL NOT NULL CHECK(valor >= 0),
            duracao_minutos INTEGER NOT NULL CHECK(duracao_minutos > 0),
            ativo INTEGER DEFAULT 1 CHECK(ativo IN (0, 1)),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Inserir serviços padrão se não existirem
    servicos_padrao = [
        ('Esmaltação em Gel - Mão', 50.00, 90, 1),
        ('Esmaltação em Gel - Pé', 60.00, 90, 1),
        ('Alongamento no molde F1', 120.00, 180, 1),
        ('Banho de Gel', 80.00, 150, 1)
    ]
    
    for nome, valor, duracao, ativo in servicos_padrao:
        cursor.execute('''
            SELECT id FROM servicos WHERE nome = ?
        ''', (nome,))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO servicos (nome, valor, duracao_minutos, ativo)
                VALUES (?, ?, ?, ?)
            ''', (nome, valor, duracao, ativo))
    
    # Tabela de configurações de horários (por dia da semana ou data específica)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS config_horarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL CHECK(tipo IN ('dia_semana', 'data_especifica')),
            dia_semana INTEGER CHECK(dia_semana >= 0 AND dia_semana <= 6), -- 0=domingo, 6=sábado
            data_especifica DATE, -- Para datas específicas (feriados, etc)
            horario_inicio TEXT NOT NULL, -- Ex: '08:00'
            horario_fim TEXT NOT NULL, -- Ex: '21:00'
            tem_almoco INTEGER DEFAULT 1 CHECK(tem_almoco IN (0, 1)), -- 1=tem almoço, 0=não tem
            almoco_inicio TEXT, -- Ex: '12:00'
            almoco_fim TEXT, -- Ex: '13:00'
            ativo INTEGER DEFAULT 1 CHECK(ativo IN (0, 1)), -- 1=ativo, 0=inativo (dia não trabalha)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tipo, dia_semana, data_especifica)
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_config_horarios_tipo 
        ON config_horarios(tipo)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_config_horarios_dia_semana 
        ON config_horarios(dia_semana)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_config_horarios_data 
        ON config_horarios(data_especifica)
    ''')
    
    # Inserir configuração padrão para todos os dias da semana se não existir
    for dia in range(7):  # 0=domingo, 6=sábado
        cursor.execute('''
            SELECT id FROM config_horarios 
            WHERE tipo = 'dia_semana' AND dia_semana = ?
        ''', (dia,))
        if not cursor.fetchone():
            # Domingo não trabalha (ativo=0), outros dias trabalham normalmente
            if dia == 0:  # Domingo
                cursor.execute('''
                    INSERT INTO config_horarios 
                    (tipo, dia_semana, horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo)
                    VALUES ('dia_semana', ?, '08:00', '21:00', 1, '12:00', '13:00', 0)
                ''', (dia,))
            else:
                cursor.execute('''
                    INSERT INTO config_horarios 
                    (tipo, dia_semana, horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo)
                    VALUES ('dia_semana', ?, '08:00', '21:00', 1, '12:00', '13:00', 1)
                ''', (dia,))
    
    conn.commit()
    conn.close()
    
    # Gerar hash da senha padrão se não existir
def init_admin_password():
    global ADMIN_PASSWORD_HASH
    if ADMIN_PASSWORD_HASH is None:
        ADMIN_PASSWORD_HASH = hash_password("Raissa123!")
        print("⚠️ Senha padrão do admin inicializada")



# Configurar Flask sem static_folder para evitar conflitos
# Vamos servir arquivos estáticos manualmente com rotas específicas

def get_db_connection():
    """Retorna conexão com o banco"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def calcular_crc16(payload):
    """Calcula CRC16-CCITT conforme padrão PIX (polinômio 0x1021)"""
    crc = 0xFFFF
    polynomial = 0x1021
    
    for byte in payload.encode('utf-8'):
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ polynomial) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    
    return format(crc, '04X')

def formatar_tamanho(valor, tamanho):
    """Formata o tamanho do campo com zeros à esquerda (formato PIX)"""
    return f"{tamanho:02d}{valor}"

# Valores dos serviços (fallback - mantido para compatibilidade)
# Serviços com valores e durações (em minutos)
SERVICOS_VALORES = {
    'Esmaltação em Gel - Mão': 50.00,
    'Esmaltação em Gel - Pé': 60.00,
    'Alongamento no molde F1': 120.00,
    'Banho de Gel': 80.00
}

# Duração de cada serviço em minutos (fallback)
SERVICOS_DURACAO = {
    'Esmaltação em Gel - Mão': 90,      # 1h30
    'Esmaltação em Gel - Pé': 90,       # 1h30
    'Alongamento no molde F1': 180,     # 3 horas
    'Banho de Gel': 150                 # 2h30
}

# Funções auxiliares para buscar serviços do banco
def obter_servicos_do_banco():
    """Retorna dicionários de serviços do banco de dados (com fallback)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT nome, valor, duracao_minutos
        FROM servicos
        WHERE ativo = 1
    ''')
    
    valores = {}
    duracoes = {}
    
    for row in cursor.fetchall():
        valores[row['nome']] = float(row['valor'])
        duracoes[row['nome']] = row['duracao_minutos']
    
    conn.close()
    
    # Se não há serviços no banco, usar fallback
    if not valores:
        valores = SERVICOS_VALORES.copy()
        duracoes = SERVICOS_DURACAO.copy()
    
    return valores, duracoes

def obter_valor_servico(nome_servico):
    """Retorna o valor de um serviço (do banco ou fallback)"""
    valores, _ = obter_servicos_do_banco()
    return valores.get(nome_servico, 0)

def obter_duracao_servico(nome_servico):
    """Retorna a duração de um serviço em minutos (do banco ou fallback)"""
    _, duracoes = obter_servicos_do_banco()
    return duracoes.get(nome_servico, 60)

# Configuração de horário de funcionamento
HORARIO_INICIO = '08:00'  # 7:00 AM
HORARIO_FIM = '21:00'     # 7:00 PM
HORARIO_ALMOCO_INICIO = '12:00'  # 12:00 PM
HORARIO_ALMOCO_FIM = '13:00'     # 1:00 PM
INTERVALO_ENTRE_SERVICOS = 30    # 30 minutos entre serviços

# Períodos e seus horários disponíveis (mantido para compatibilidade)
PERIODOS = {
    'manhã': ['08:00', '09:00'],
    'tarde': ['14:00', '15:00'],
    'noite': ['17:00', '18:00']
}

HORARIOS_DISPONIVEIS = ['manhã', 'tarde', 'noite']

# Função auxiliar para obter período de um horário específico
def obter_periodo(horario_especifico):
    """Retorna o período (manhã/tarde/noite) de um horário específico"""
    for periodo, horarios in PERIODOS.items():
        if horario_especifico in horarios:
            return periodo
    return None

def obter_config_horario(data_str):
    """Obtém configuração de horário para uma data específica (do banco ou padrão)"""
    data_obj = datetime.strptime(data_str, '%Y-%m-%d')
    # Converter weekday() do Python (0=segunda, 6=domingo) para nosso formato (0=domingo, 6=sábado)
    dia_semana_python = data_obj.weekday()  # 0=segunda, 6=domingo
    dia_semana = (dia_semana_python + 1) % 7  # Converter: 0=domingo, 1=segunda, ..., 6=sábado
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Primeiro, tentar buscar configuração específica para a data
    cursor.execute('''
        SELECT horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo
        FROM config_horarios
        WHERE tipo = 'data_especifica' AND data_especifica = ? AND ativo = 1
    ''', (data_str,))
    config_data = cursor.fetchone()
    
    # Se não encontrou configuração específica, buscar por dia da semana
    if not config_data:
        cursor.execute('''
            SELECT horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo
            FROM config_horarios
            WHERE tipo = 'dia_semana' AND dia_semana = ? AND ativo = 1
        ''', (dia_semana,))
        config_data = cursor.fetchone()
    
    conn.close()
    
    # Se encontrou configuração no banco, usar ela
    if config_data:
        return {
            'horario_inicio': config_data['horario_inicio'],
            'horario_fim': config_data['horario_fim'],
            'tem_almoco': bool(config_data['tem_almoco']),
            'almoco_inicio': config_data['almoco_inicio'] if config_data['tem_almoco'] else None,
            'almoco_fim': config_data['almoco_fim'] if config_data['tem_almoco'] else None,
            'ativo': bool(config_data['ativo'])
        }
    
    # Fallback: usar configuração padrão (hardcoded)
    return {
        'horario_inicio': HORARIO_INICIO,
        'horario_fim': HORARIO_FIM,
        'tem_almoco': True,
        'almoco_inicio': HORARIO_ALMOCO_INICIO,
        'almoco_fim': HORARIO_ALMOCO_FIM,
        'ativo': True
    }

def gerar_horarios_disponiveis_dia(data_str=None):
    """Gera todos os horários disponíveis do dia considerando funcionamento e almoço"""
    # Se não foi passada data, usar configuração padrão
    if data_str:
        config = obter_config_horario(data_str)
        if not config['ativo']:
            return []  # Dia não trabalha
        
        horario_inicio = config['horario_inicio']
        horario_fim = config['horario_fim']
        tem_almoco = config['tem_almoco']
        almoco_inicio = config['almoco_inicio'] if tem_almoco else None
        almoco_fim = config['almoco_fim'] if tem_almoco else None
    else:
        # Usar configuração padrão
        horario_inicio = HORARIO_INICIO
        horario_fim = HORARIO_FIM
        tem_almoco = True
        almoco_inicio = HORARIO_ALMOCO_INICIO
        almoco_fim = HORARIO_ALMOCO_FIM
    
    horarios = []
    inicio = datetime.strptime(horario_inicio, '%H:%M').time()
    fim = datetime.strptime(horario_fim, '%H:%M').time()
    
    hora_atual = inicio
    while hora_atual < fim:
        # Verificar se está no horário de almoço (se tiver almoço)
        if tem_almoco and almoco_inicio and almoco_fim:
            almoco_inicio_obj = datetime.strptime(almoco_inicio, '%H:%M').time()
            almoco_fim_obj = datetime.strptime(almoco_fim, '%H:%M').time()
            if not (almoco_inicio_obj <= hora_atual < almoco_fim_obj):
                horarios.append(hora_atual.strftime('%H:%M'))
        else:
            # Sem almoço, adicionar todos os horários
            horarios.append(hora_atual.strftime('%H:%M'))
        
        # Avançar 30 minutos (intervalo mínimo entre serviços)
        hora_atual = (datetime.combine(datetime.today(), hora_atual) + timedelta(minutes=INTERVALO_ENTRE_SERVICOS)).time()
    
    return horarios

def calcular_horario_fim(horario_inicio, duracao_minutos):
    """Calcula o horário de término de um serviço"""
    inicio = datetime.strptime(horario_inicio, '%H:%M')
    fim = inicio + timedelta(minutes=duracao_minutos)
    return fim.strftime('%H:%M')

def verificar_conflito_horario(horario_inicio, duracao_minutos, agendamentos_existentes, horarios_bloqueados_set, data_str=None):
    """Verifica se um horário conflita com agendamentos existentes ou horários bloqueados"""
    horario_fim = calcular_horario_fim(horario_inicio, duracao_minutos)
    
    inicio_obj = datetime.strptime(horario_inicio, '%H:%M').time()
    fim_obj = datetime.strptime(horario_fim, '%H:%M').time()
    
    # Verificar conflito com horário de almoço (usar configuração do banco se disponível)
    if data_str:
        config = obter_config_horario(data_str)
        if config['tem_almoco'] and config['almoco_inicio'] and config['almoco_fim']:
            almoco_inicio = datetime.strptime(config['almoco_inicio'], '%H:%M').time()
            almoco_fim = datetime.strptime(config['almoco_fim'], '%H:%M').time()
            if inicio_obj < almoco_fim and fim_obj > almoco_inicio:
                return True  # Conflita com horário de almoço
    else:
        # Usar configuração padrão
        almoco_inicio = datetime.strptime(HORARIO_ALMOCO_INICIO, '%H:%M').time()
        almoco_fim = datetime.strptime(HORARIO_ALMOCO_FIM, '%H:%M').time()
        if inicio_obj < almoco_fim and fim_obj > almoco_inicio:
            return True  # Conflita com horário de almoço
    
    # Verificar conflito com agendamentos existentes
    for agendamento in agendamentos_existentes:
        ag_inicio = datetime.strptime(agendamento['horario'], '%H:%M').time()
        # Obter duração do serviço do agendamento (se disponível)
        servicos_ag = agendamento.get('servico', [])
        if isinstance(servicos_ag, str):
            servicos_ag = [s.strip() for s in servicos_ag.split(',')]
        _, duracoes_servicos = obter_servicos_do_banco()
        ag_duracao = sum(duracoes_servicos.get(s.strip(), 60) for s in servicos_ag) if servicos_ag else 60
        ag_fim = (datetime.combine(datetime.today(), ag_inicio) + timedelta(minutes=ag_duracao)).time()
        
        # Verificar sobreposição (com intervalo de 30 minutos)
        ag_fim_com_intervalo = (datetime.combine(datetime.today(), ag_fim) + timedelta(minutes=INTERVALO_ENTRE_SERVICOS)).time()
        inicio_com_intervalo = (datetime.combine(datetime.today(), inicio_obj) - timedelta(minutes=INTERVALO_ENTRE_SERVICOS)).time()
        
        if inicio_obj < ag_fim_com_intervalo and fim_obj > inicio_com_intervalo:
            return True  # Conflita com agendamento existente
    
    # Verificar conflito com horários bloqueados
    for horario_bloqueado in horarios_bloqueados_set:
        bloqueado_inicio = datetime.strptime(horario_bloqueado, '%H:%M').time()
        bloqueado_fim = (datetime.combine(datetime.today(), bloqueado_inicio) + timedelta(minutes=60)).time()  # Assumir 1h de bloqueio
        
        if inicio_obj < bloqueado_fim and fim_obj > bloqueado_inicio:
            return True  # Conflita com horário bloqueado
    
    return False

def obter_horarios_disponiveis_com_duracao(data_str, servicos_selecionados, agendamentos_existentes, horarios_bloqueados_set):
    """Retorna horários disponíveis considerando duração dos serviços e intervalos"""
    # Verificar se o dia está ativo (trabalha)
    config = obter_config_horario(data_str)
    if not config['ativo']:
        return []  # Dia não trabalha
    
    # Calcular duração total dos serviços selecionados
    _, duracoes_servicos = obter_servicos_do_banco()
    duracao_total = sum(duracoes_servicos.get(servico, 60) for servico in servicos_selecionados)
    
    # Gerar todos os horários possíveis do dia (usando configuração do banco)
    todos_horarios = gerar_horarios_disponiveis_dia(data_str)
    
    # Obter horário de fechamento da configuração
    horario_fechamento = datetime.strptime(config['horario_fim'], '%H:%M').time()
    
    # Filtrar horários disponíveis
    horarios_disponiveis = []
    for horario in todos_horarios:
        # Verificar se o serviço cabe no horário (não ultrapassa o horário de fechamento)
        horario_fim = calcular_horario_fim(horario, duracao_total)
        fim_obj = datetime.strptime(horario_fim, '%H:%M').time()
        
        if fim_obj > horario_fechamento:
            continue  # Serviço não cabe antes do fechamento
        
        # Verificar conflitos (passar data_str para usar configuração correta)
        if not verificar_conflito_horario(horario, duracao_total, agendamentos_existentes, horarios_bloqueados_set, data_str):
            horarios_disponiveis.append(horario)
    
    return horarios_disponiveis

# Decorator para proteger rotas admin
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Tentar obter token do header Authorization primeiro
        auth_header = request.headers.get('Authorization', '')
        token_from_header = None
        
        if auth_header.startswith('Bearer '):
            token_from_header = auth_header.replace('Bearer ', '')
        
        # Verificar token no banco (do header ou da sessão)
        session_token = token_from_header or session.get('session_token')
        
        print(f"\n{'='*60}")
        print(f"🔐 ADMIN_REQUIRED - {request.method} {request.path}")
        print(f"   Authorization header: {auth_header[:30] if auth_header else 'None'}...")
        print(f"   Token do header: {token_from_header[:20] if token_from_header else 'None'}...")
        print(f"   Token da sessão: {session.get('session_token')[:20] if session.get('session_token') else 'None'}...")
        print(f"   Token usado: {session_token[:20] if session_token else 'None'}...")
        
        if session_token:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    SELECT expires_at FROM admin_sessions 
                    WHERE session_token = ? AND expires_at > datetime('now')
                ''', (session_token,))
                result = cursor.fetchone()
                if result:
                    print(f"   ✅ Token válido - autorizado")
                    print(f"{'='*60}\n")
                    conn.close()
                    return f(*args, **kwargs)
                else:
                    print(f"   ❌ Token inválido ou expirado")
                    conn.close()
            except Exception as e:
                print(f"   ⚠️  Erro ao verificar token: {e}")
                import traceback
                traceback.print_exc()
                conn.close()
        else:
            print(f"   ❌ Nenhum token encontrado")
        
        print(f"   ❌ Retornando 401 - Não autorizado")
        print(f"{'='*60}\n")
        
        # Não autorizado
        return jsonify({'error': 'Não autorizado. Faça login primeiro.'}), 401
    return decorated_function

# ============================================================
# ROTAS DE ARQUIVOS ESTÁTICOS (devem vir ANTES das rotas /api)
# ============================================================

@app.route('/')
def index():
    """Redireciona para a página principal"""
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/login.html')
def login_page():
    """Serve a página de login"""
    return send_from_directory(FRONTEND_DIR, 'login.html')

@app.route('/admin.html')
def admin_page():
    """Serve a página admin (protegida)"""
    if not session.get('admin_logged_in'):
        return redirect('/login.html')
    return send_from_directory(FRONTEND_DIR, 'admin.html')

@app.route('/config.html')
def config_page():
    """Serve a página de configurações (protegida)"""
    if not session.get('admin_logged_in'):
        return redirect('/login.html')
    return send_from_directory(FRONTEND_DIR, 'config.html')

@app.route('/financeiro.html')
def financeiro_page():
    """Serve a página financeiro (protegida)"""
    if not session.get('admin_logged_in'):
        return redirect('/login.html')
    return send_from_directory(FRONTEND_DIR, 'financeiro.html')

# Rotas específicas para arquivos HTML
@app.route('/index.html')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/agendamento.html')
def serve_agendamento():
    return send_from_directory(FRONTEND_DIR, 'agendamento.html')

@app.route('/servicos.html')
def serve_servicos():
    return send_from_directory(FRONTEND_DIR, 'servicos.html')

@app.route('/sobrenos.html')
def serve_sobrenos():
    return send_from_directory(FRONTEND_DIR, 'sobrenos.html')

@app.route('/contato.html')
def serve_contato():
    return send_from_directory(FRONTEND_DIR, 'contato.html')

# Servir arquivos CSS e JS
@app.route('/styles.css')
def serve_styles():
    return send_from_directory(FRONTEND_DIR, 'styles.css')

@app.route('/script.js')
def serve_script():
    return send_from_directory(FRONTEND_DIR, 'script.js')

@app.route('/agendamento.js')
def serve_agendamento_js():
    return send_from_directory(FRONTEND_DIR, 'agendamento.js')

@app.route('/admin.js')
def serve_admin_js():
    return send_from_directory(FRONTEND_DIR, 'admin.js')

@app.route('/config.js')
def serve_config_js():
    return send_from_directory(FRONTEND_DIR, 'config.js')

@app.route('/financeiro.js')
def serve_financeiro_js():
    return send_from_directory(FRONTEND_DIR, 'financeiro.js')

# Servir assets
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'assets'), filename)

# ============================================================
# ROTAS DA API (devem vir DEPOIS das rotas de arquivos estáticos)
# ============================================================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Autenticação do admin"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': 'Usuário e senha são obrigatórios'}), 400
    
    # Sempre recalcular o hash esperado para garantir consistência
    expected_hash = hash_password('Raissa123!')
    
    # Atualizar ADMIN_PASSWORD_HASH global se necessário
    global ADMIN_PASSWORD_HASH
    ADMIN_PASSWORD_HASH = expected_hash
    
    # Verificar credenciais - normalizar username (lowercase, sem espaços)
    username_normalized = username.lower().strip()
    admin_username_normalized = ADMIN_USERNAME.lower().strip()
    
    # Verificar credenciais - calcular hash da senha recebida
    password_hash = hash_password(password)
    
    # Debug: imprimir informações detalhadas
    print(f"\n{'='*60}")
    print(f"DEBUG LOGIN:")
    print(f"Username recebido: '{username}'")
    print(f"Username esperado: '{ADMIN_USERNAME}'")
    print(f"Password recebida: '{password}'")
    print(f"Password hash recebido: {password_hash}")
    print(f"Password hash esperado: {expected_hash}")
    print(f"Match username: {username_normalized == admin_username_normalized}")
    print(f"Match password: {password_hash == expected_hash}")
    print(f"{'='*60}\n")
    
    if username_normalized != admin_username_normalized:
        print(f"❌ Username não confere!")
        return jsonify({'error': 'Credenciais inválidas'}), 401
    
    if password_hash != expected_hash:
        print(f"❌ Password hash não confere!")
        return jsonify({'error': 'Credenciais inválidas'}), 401
    
    print(f"✅ Credenciais válidas! Criando sessão...")
    
    # Criar sessão segura
    session.permanent = True
    session['admin_logged_in'] = True
    session['admin_username'] = username
    session['login_time'] = datetime.now().isoformat()
    
    # Gerar token único para esta sessão
    session_token = secrets.token_urlsafe(32)
    session['session_token'] = session_token
    
    # Debug: verificar se sessão foi criada
    print(f"DEBUG SESSÃO:")
    print(f"  session.permanent: {session.permanent}")
    print(f"  session.get('admin_logged_in'): {session.get('admin_logged_in')}")
    print(f"  session.get('session_token'): {session.get('session_token')[:20]}...")
    
    # Salvar sessão no banco (opcional, para auditoria)
    conn = get_db_connection()
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(hours=8)
    try:
        cursor.execute('''
            INSERT INTO admin_sessions (session_token, username, expires_at)
            VALUES (?, ?, ?)
        ''', (session_token, username, expires_at))
        conn.commit()
        print(f"  ✅ Sessão salva no banco")
    except Exception as e:
        print(f"  ⚠️  Erro ao salvar sessão no banco: {e}")
    conn.close()
    
    # Criar resposta com token no JSON (mais confiável que cookies para CORS)
    response = jsonify({
        'success': True,
        'message': 'Login realizado com sucesso',
        'token': session_token,  # Enviar token no JSON para o frontend armazenar
        'expires_in': 28800  # 8 horas em segundos
    })
    
    print(f"  Token gerado: {session_token[:20]}...")
    print(f"  Token será enviado no JSON (frontend armazenará em localStorage)")
    
    return response

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    """Logout do admin"""
    session_token = session.get('session_token')
    
    # Remover sessão do banco
    if session_token:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM admin_sessions WHERE session_token = ?', (session_token,))
            conn.commit()
        except:
            pass
        conn.close()
    
    session.clear()
    return jsonify({'success': True, 'message': 'Logout realizado com sucesso'})

@app.route('/api/admin/verify', methods=['GET'])
def verify_admin():
    """Verifica se o admin está autenticado"""
    # Tentar obter token do header Authorization primeiro (mais confiável para CORS)
    auth_header = request.headers.get('Authorization', '')
    token_from_header = None
    
    if auth_header.startswith('Bearer '):
        token_from_header = auth_header.replace('Bearer ', '')
    
    # Fallback: tentar da sessão (cookies)
    session_token = session.get('session_token') or token_from_header
    
    print(f"\n{'='*60}")
    print(f"DEBUG VERIFY:")
    print(f"  Authorization header: {auth_header[:30] if auth_header else 'None'}...")
    print(f"  Token do header: {token_from_header[:20] if token_from_header else 'None'}...")
    print(f"  Token da sessão: {session.get('session_token')[:20] if session.get('session_token') else 'None'}...")
    print(f"  Token usado: {session_token[:20] if session_token else 'None'}...")
    print(f"  request.cookies: {dict(request.cookies)}")
    print(f"{'='*60}\n")
    
    if session_token:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                SELECT username, expires_at FROM admin_sessions 
                WHERE session_token = ? AND expires_at > datetime('now')
            ''', (session_token,))
            result = cursor.fetchone()
            if result:
                username, expires_at = result
                conn.close()
                print(f"✅ Verificação OK - usuário autenticado: {username}")
                return jsonify({
                    'authenticated': True,
                    'username': username,
                    'login_time': session.get('login_time')
                })
        except Exception as e:
            print(f"⚠️  Erro ao verificar token no banco: {e}")
        conn.close()
    
    # Token inválido ou expirado
    print(f"❌ Token inválido ou expirado")
    session.clear()
    return jsonify({'authenticated': False}), 401

@app.route('/.port')
def get_port():
    """Retorna a porta atual do servidor"""
    # Obter porta do request
    port = request.environ.get('SERVER_PORT', '5000')
    # Se não conseguir, tentar do host
    if port == '5000':
        host = request.environ.get('HTTP_HOST', '')
        if ':' in host:
            port = host.split(':')[1]
    return str(port), 200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'}

@app.route('/health')
@app.route('/healthcheck')
def healthcheck():
    """Endpoint de healthcheck para Railway verificar se o serviço está funcionando"""
    try:
        # Verificar se o banco de dados está acessível
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        conn.close()
        return jsonify({
            'status': 'healthy',
            'service': 'raissa-nails-beauty',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'raissa-nails-beauty',
            'error': str(e)
        }), 503

@app.route('/api/servicos', methods=['GET'])
def get_servicos():
    """Retorna lista de serviços com valores (do banco ou fallback)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT nome, valor, duracao_minutos, ativo
        FROM servicos
        WHERE ativo = 1
        ORDER BY nome
    ''')
    
    servicos = []
    for row in cursor.fetchall():
        servicos.append({
            'nome': row['nome'],
            'valor': float(row['valor']),
            'duracao_minutos': row['duracao_minutos']
        })
    
    conn.close()
    
    # Se não há serviços no banco, usar fallback
    if not servicos:
        for nome, valor in SERVICOS_VALORES.items():
            servicos.append({
                'nome': nome,
                'valor': valor,
                'duracao_minutos': SERVICOS_DURACAO.get(nome, 60)
            })
    
    return jsonify(servicos)

# Endpoints CRUD para serviços (admin)
@app.route('/api/admin/servicos', methods=['GET'])
@admin_required
def listar_servicos_admin():
    """Lista todos os serviços (incluindo inativos)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, nome, valor, duracao_minutos, ativo, created_at, updated_at
        FROM servicos
        ORDER BY nome
    ''')
    
    servicos = []
    for row in cursor.fetchall():
        servicos.append({
            'id': row['id'],
            'nome': row['nome'],
            'valor': float(row['valor']),
            'duracao_minutos': row['duracao_minutos'],
            'ativo': bool(row['ativo']),
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        })
    
    conn.close()
    return jsonify(servicos)

@app.route('/api/admin/servicos', methods=['POST'])
@admin_required
def criar_servico():
    """Cria um novo serviço"""
    data = request.json
    
    nome = data.get('nome', '').strip()
    valor = data.get('valor')
    duracao_minutos = data.get('duracao_minutos')
    ativo = data.get('ativo', True)
    
    if not nome:
        return jsonify({'error': 'Nome do serviço é obrigatório'}), 400
    
    if valor is None or valor < 0:
        return jsonify({'error': 'Valor deve ser maior ou igual a zero'}), 400
    
    if not duracao_minutos or duracao_minutos <= 0:
        return jsonify({'error': 'Duração deve ser maior que zero'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO servicos (nome, valor, duracao_minutos, ativo, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        ''', (nome, valor, duracao_minutos, int(ativo)))
        
        conn.commit()
        servico_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Serviço criado com sucesso',
            'id': servico_id
        }), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Já existe um serviço com este nome'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': f'Erro ao criar serviço: {str(e)}'}), 500

@app.route('/api/admin/servicos/<int:servico_id>', methods=['PATCH'])
@admin_required
def atualizar_servico(servico_id):
    """Atualiza um serviço"""
    data = request.json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existe
    cursor.execute('SELECT * FROM servicos WHERE id = ?', (servico_id,))
    servico_existente = cursor.fetchone()
    if not servico_existente:
        conn.close()
        return jsonify({'error': 'Serviço não encontrado'}), 404
    
    campos_atualizar = {}
    
    if 'nome' in data:
        nome = data['nome'].strip()
        if not nome:
            conn.close()
            return jsonify({'error': 'Nome não pode ser vazio'}), 400
        campos_atualizar['nome'] = nome
    
    if 'valor' in data:
        valor = data['valor']
        if valor < 0:
            conn.close()
            return jsonify({'error': 'Valor deve ser maior ou igual a zero'}), 400
        campos_atualizar['valor'] = valor
    
    if 'duracao_minutos' in data:
        duracao = data['duracao_minutos']
        if duracao <= 0:
            conn.close()
            return jsonify({'error': 'Duração deve ser maior que zero'}), 400
        campos_atualizar['duracao_minutos'] = duracao
    
    if 'ativo' in data:
        campos_atualizar['ativo'] = int(bool(data['ativo']))
    
    if not campos_atualizar:
        conn.close()
        return jsonify({'error': 'Nenhum campo para atualizar'}), 400
    
    campos_atualizar['updated_at'] = datetime.now().isoformat()
    
    # Construir query
    set_clauses = ', '.join([f'{campo} = ?' for campo in campos_atualizar.keys()])
    valores = list(campos_atualizar.values()) + [servico_id]
    
    try:
        cursor.execute(f'''
            UPDATE servicos 
            SET {set_clauses}
            WHERE id = ?
        ''', valores)
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Serviço atualizado com sucesso'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Já existe um serviço com este nome'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': f'Erro ao atualizar serviço: {str(e)}'}), 500

@app.route('/api/admin/servicos/<int:servico_id>', methods=['DELETE'])
@admin_required
def deletar_servico(servico_id):
    """Deleta um serviço"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existe
    cursor.execute('SELECT id FROM servicos WHERE id = ?', (servico_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Serviço não encontrado'}), 404
    
    # Deletar
    cursor.execute('DELETE FROM servicos WHERE id = ?', (servico_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Serviço deletado com sucesso'})

@app.route('/api/disponibilidade-mes', methods=['GET'])
def get_disponibilidade_mes():
    """Retorna disponibilidade de todo o mês de uma vez (otimizado)"""
    mes_str = request.args.get('mes')
    ano_str = request.args.get('ano')
    
    if not mes_str or not ano_str:
        return jsonify({'error': 'Mês e ano são obrigatórios'}), 400
    
    try:
        mes = int(mes_str)
        ano = int(ano_str)
    except ValueError:
        return jsonify({'error': 'Mês ou ano inválidos'}), 400
    
    try:
        # Calcular primeiro e último dia do mês
        primeiro_dia_mes = datetime(ano, mes, 1).strftime('%Y-%m-%d')
        if mes == 12:
            ultimo_dia_mes = datetime(ano + 1, 1, 1) - timedelta(days=1)
        else:
            ultimo_dia_mes = datetime(ano, mes + 1, 1) - timedelta(days=1)
        ultimo_dia_mes_str = ultimo_dia_mes.strftime('%Y-%m-%d')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query otimizada: buscar TODOS os agendamentos do mês de uma vez usando índice
        cursor.execute('''
            SELECT data, horario FROM agendamentos 
            WHERE data >= ? AND data <= ?
            AND (status = 'confirmado' OR status = 'pendente')
        ''', (primeiro_dia_mes, ultimo_dia_mes_str))
        
        # Organizar agendamentos por data
        agendamentos_por_data = {}
        for row in cursor.fetchall():
            data_agendamento = row[0]
            horario = row[1]
            if data_agendamento not in agendamentos_por_data:
                agendamentos_por_data[data_agendamento] = []
            agendamentos_por_data[data_agendamento].append(horario)
        
        # Query otimizada: buscar TODOS os horários bloqueados do mês de uma vez usando índice
        cursor.execute('''
            SELECT data, horario FROM horarios_bloqueados 
            WHERE data >= ? AND data <= ?
        ''', (primeiro_dia_mes, ultimo_dia_mes_str))
        
        bloqueados_por_data = {}
        for row in cursor.fetchall():
            data_bloqueio = row[0]
            horario = row[1]
            if data_bloqueio not in bloqueados_por_data:
                bloqueados_por_data[data_bloqueio] = []
            bloqueados_por_data[data_bloqueio].append(horario)
        
        conn.close()
        
        # Processar cada dia do mês
        resultado = {}
        current_date = datetime(ano, mes, 1)
        print(f"\n📅 GET_DISPONIBILIDADE_MES - Mês: {mes}/{ano}")
        
        while current_date.month == mes:
            data_str = current_date.strftime('%Y-%m-%d')
            dia_semana = current_date.weekday()  # 0 = segunda, 6 = domingo
            
            # Domingo não tem disponibilidade
            if dia_semana == 6:
                resultado[data_str] = {}
                print(f"   {data_str} (domingo): sem disponibilidade")
            else:
                # Obter horários reservados e bloqueados para esta data
                horarios_reservados = set(agendamentos_por_data.get(data_str, []))
                horarios_bloqueados = set(bloqueados_por_data.get(data_str, []))
                
                # Determinar períodos bloqueados
                agendados_periodos = set()
                bloqueados_periodos = set()
                
                # Se QUALQUER horário de um período estiver reservado, bloquear o período inteiro
                for periodo in HORARIOS_DISPONIVEIS:
                    horarios_periodo = PERIODOS[periodo]
                    if any(h in horarios_reservados for h in horarios_periodo):
                        agendados_periodos.add(periodo)
                    if any(h in horarios_bloqueados for h in horarios_periodo):
                        bloqueados_periodos.add(periodo)
                
                # Usar a nova lógica baseada em duração para calcular horários disponíveis
                # Se não há agendamentos, retornar todos os horários disponíveis
                agendamentos_existentes_lista = [
                    {'horario': h, 'servico': []} for h in horarios_reservados
                ]
                horarios_bloqueados_set = horarios_bloqueados
                
                # Obter horários disponíveis usando a função de duração (sem serviços específicos)
                horarios_disponiveis = obter_horarios_disponiveis_com_duracao(
                    data_str, [], agendamentos_existentes_lista, horarios_bloqueados_set
                )
                
                # Converter lista de horários para formato de períodos (compatibilidade com frontend)
                periodos_disponiveis = {}
                ordem_periodos = ['manhã', 'tarde', 'noite']
                
                for periodo in ordem_periodos:
                    horarios_periodo = PERIODOS[periodo]
                    horarios_disponiveis_periodo = [
                        h for h in horarios_periodo 
                        if h in horarios_disponiveis
                    ]
                    if horarios_disponiveis_periodo:
                        periodos_disponiveis[periodo] = horarios_disponiveis_periodo
                
                # Se não há períodos mas há horários disponíveis, criar períodos manualmente
                if not periodos_disponiveis and horarios_disponiveis:
                    # Agrupar horários por período
                    for periodo in ordem_periodos:
                        horarios_periodo = PERIODOS[periodo]
                        horarios_disponiveis_periodo = [
                            h for h in horarios_periodo 
                            if h in horarios_disponiveis
                        ]
                        if horarios_disponiveis_periodo:
                            periodos_disponiveis[periodo] = horarios_disponiveis_periodo
                
                total_horarios = sum(len(arr) for arr in periodos_disponiveis.values())
                if data_str == '2025-02-09' or total_horarios > 0:
                    print(f"   {data_str} (dia semana {dia_semana}): {total_horarios} horários disponíveis - períodos: {list(periodos_disponiveis.keys())}")
                
                resultado[data_str] = periodos_disponiveis
            
            current_date += timedelta(days=1)
        
        return jsonify({'disponibilidade': resultado})
    
    except ValueError as e:
        return jsonify({'error': f'Data inválida: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Erro ao processar: {str(e)}'}), 500

@app.route('/api/horarios-disponiveis', methods=['GET'])
def get_horarios_disponiveis():
    """Retorna horários disponíveis para uma data específica considerando duração dos serviços"""
    data = request.args.get('data')
    servicos_param = request.args.get('servicos')  # Lista de serviços separados por vírgula
    
    if not data:
        return jsonify({'error': 'Data não fornecida'}), 400
    
    try:
        data_obj = datetime.strptime(data, '%Y-%m-%d')
        dia_semana = data_obj.weekday()  # 0 = segunda, 6 = domingo
        
        # Domingo não pode agendar (6 = domingo)
        if dia_semana == 6:
            return jsonify({'horarios': []})
        
        # Parse dos serviços selecionados
        servicos_selecionados = []
        if servicos_param:
            servicos_selecionados = [s.strip() for s in servicos_param.split(',') if s.strip()]
        
        # Se não tem serviços selecionados, usar duração padrão de 60 minutos
        if not servicos_selecionados:
            duracao_total = 60
        else:
            _, duracoes_servicos = obter_servicos_do_banco()
            duracao_total = sum(duracoes_servicos.get(servico, 60) for servico in servicos_selecionados)
        
        print(f"\n📅 GET_HORARIOS_DISPONIVEIS - Data: {data}, Serviços: {servicos_selecionados}, Duração: {duracao_total}min")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar agendamentos já feitos para esta data (apenas confirmados/pagos/pendentes)
        cursor.execute('''
            SELECT horario, servico FROM agendamentos 
            WHERE data = ? AND (status = 'confirmado' OR status = 'pendente')
        ''', (data,))
        
        # Organizar agendamentos com suas durações
        agendamentos_existentes = []
        for row in cursor.fetchall():
            horario = row[0]
            servico_str = row[1] if len(row) > 1 else ''
            servicos_ag = [s.strip() for s in servico_str.split(',')] if servico_str else []
            agendamentos_existentes.append({
                'horario': horario,
                'servico': servicos_ag
            })
        
        print(f"   Agendamentos existentes para {data}: {len(agendamentos_existentes)}")
        for ag in agendamentos_existentes:
            print(f"      - {ag['horario']}: {ag['servico']}")
        
        # Buscar horários bloqueados
        cursor.execute('''
            SELECT horario FROM horarios_bloqueados 
            WHERE data = ?
        ''', (data,))
        
        horarios_bloqueados_set = set(row[0] for row in cursor.fetchall())
        print(f"   Horários bloqueados: {len(horarios_bloqueados_set)} - {sorted(horarios_bloqueados_set)}")
        conn.close()
        
        # Obter horários disponíveis considerando duração e intervalos
        if servicos_selecionados:
            horarios_disponiveis = obter_horarios_disponiveis_com_duracao(
                data, servicos_selecionados, agendamentos_existentes, horarios_bloqueados_set
            )
        else:
            # Se não tem serviços selecionados, retornar horários básicos
            horarios_disponiveis = obter_horarios_disponiveis_com_duracao(
                data, [], agendamentos_existentes, horarios_bloqueados_set
            )
        
        print(f"   Horários disponíveis retornados: {len(horarios_disponiveis)} - {horarios_disponiveis[:10]}...")
        print()
        
        return jsonify({'horarios': horarios_disponiveis})
    
    except ValueError:
        return jsonify({'error': 'Data inválida'}), 400

@app.route('/api/agendar', methods=['POST'])
def criar_agendamento():
    """Cria um novo agendamento"""
    data = request.json
    
    # Debug: imprimir dados recebidos
    print(f"\n{'='*60}")
    print(f"DEBUG - Dados recebidos no /api/agendar:")
    print(f"{'='*60}")
    print(f"Data completa: {data}")
    print(f"Tem 'servicos'? {('servicos' in data)}")
    print(f"Tem 'servico'? {('servico' in data)}")
    if 'servicos' in data:
        print(f"Valor de 'servicos': {data['servicos']}")
        print(f"Tipo: {type(data['servicos'])}")
    if 'servico' in data:
        print(f"Valor de 'servico': {data['servico']}")
    print(f"{'='*60}\n")
    
    # Validações - aceitar 'servicos' (lista) ou 'servico' (string) para compatibilidade
    required_fields = ['nome', 'telefone', 'data', 'horario']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Campo {field} é obrigatório'}), 400
    
    nome = data['nome']
    telefone = data['telefone']
    data_agendamento = data['data']
    horario = data['horario']
    
    # Aceitar lista de serviços ou serviço único (compatibilidade)
    if 'servicos' in data:
        servicos_lista = data['servicos']
        # Verificar se é uma lista válida
        if not isinstance(servicos_lista, list):
            print(f"ERRO: servicos não é uma lista! Tipo: {type(servicos_lista)}, Valor: {servicos_lista}")
            return jsonify({'error': 'Campo servicos deve ser uma lista'}), 400
        if len(servicos_lista) == 0:
            return jsonify({'error': 'Deve selecionar pelo menos um serviço'}), 400
        print(f"Serviços recebidos (lista): {servicos_lista}")
    elif 'servico' in data:
        # Compatibilidade com código antigo
        servicos_lista = [data['servico']]
        print(f"Serviço recebido (string): {data['servico']}")
    else:
        print(f"ERRO: Nem 'servicos' nem 'servico' encontrados nos dados!")
        return jsonify({'error': 'Campo servicos ou servico é obrigatório'}), 400
    
    # Validar todos os serviços (verificar no banco)
    valores_servicos, _ = obter_servicos_do_banco()
    for servico in servicos_lista:
        if servico not in valores_servicos:
            return jsonify({'error': f'Serviço inválido: {servico}'}), 400
    
    # Obter configuração de horário para esta data
    config = obter_config_horario(data_agendamento)
    
    # Verificar se o dia está ativo (trabalha)
    # NOTA: Para permitir criação de histórico retroativo no admin, não bloqueamos datas passadas
    # A validação de 'ativo' apenas verifica se há configuração de horário para o dia
    if not config['ativo']:
        # Se não há configuração e é uma data passada, permitir mesmo assim (para histórico)
        try:
            data_obj = datetime.strptime(data_agendamento, '%Y-%m-%d')
            if data_obj.date() < datetime.now().date():
                # Data passada: permitir mesmo sem configuração (para histórico)
                pass
            else:
                # Data futura sem configuração: bloquear
                return jsonify({'error': 'Não é possível agendar neste dia'}), 400
        except:
            # Se não conseguir validar data, bloquear por segurança
            return jsonify({'error': 'Não é possível agendar neste dia'}), 400
    
    # Validar horário (aceita qualquer horário no formato HH:MM válido)
    horario_valido = False
    periodo_selecionado = None
    
    # Verificar formato HH:MM
    try:
        horario_obj = datetime.strptime(horario, '%H:%M').time()
        # Verificar se está dentro do horário de funcionamento (usar configuração do banco)
        inicio = datetime.strptime(config['horario_inicio'], '%H:%M').time()
        fim = datetime.strptime(config['horario_fim'], '%H:%M').time()
        
        # Verificar se está dentro do horário de funcionamento
        if inicio <= horario_obj < fim:
            # Verificar se não está no horário de almoço (se tiver almoço)
            if config['tem_almoco'] and config['almoco_inicio'] and config['almoco_fim']:
                almoco_inicio = datetime.strptime(config['almoco_inicio'], '%H:%M').time()
                almoco_fim = datetime.strptime(config['almoco_fim'], '%H:%M').time()
                if not (almoco_inicio <= horario_obj < almoco_fim):
                    horario_valido = True
            else:
                # Sem almoço, horário válido se estiver dentro do funcionamento
                horario_valido = True
            
            if horario_valido:
                # Tentar obter período (para compatibilidade com código antigo)
                periodo_selecionado = obter_periodo(horario)
                if not periodo_selecionado:
                    # Se não encontrar período, usar o horário diretamente
                    periodo_selecionado = horario
    except ValueError:
        # Formato inválido
        pass
    
    if not horario_valido:
        return jsonify({'error': 'Horário inválido ou fora do horário de funcionamento'}), 400
    
    # Validar data
    try:
        data_obj = datetime.strptime(data_agendamento, '%Y-%m-%d')
        dia_semana = data_obj.weekday()
        
        # Verificar se o dia está ativo usando configuração
        # Se não há configuração e é uma data passada, permitir mesmo assim (para histórico)
        if not config['ativo']:
            if data_obj.date() < datetime.now().date():
                # Data passada: permitir mesmo sem configuração (para histórico)
                pass
            else:
                # Data futura sem configuração: bloquear
                return jsonify({'error': 'Não é possível agendar neste dia'}), 400
        
    except ValueError:
        return jsonify({'error': 'Data inválida'}), 400
    
    # Verificar disponibilidade
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se o horário específico já está agendado
    cursor.execute('''
        SELECT id FROM agendamentos 
        WHERE data = ? AND horario = ? 
        AND (status = 'confirmado' OR status = 'pendente')
    ''', (data_agendamento, horario))
    
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': f'Horário {horario} já está agendado'}), 400
    
    # Verificar também se o período inteiro está bloqueado (apenas se período_selecionado for um período válido)
    if periodo_selecionado in PERIODOS:
        horarios_periodo = PERIODOS[periodo_selecionado]
        placeholders = ','.join(['?'] * len(horarios_periodo))
        cursor.execute(f'''
            SELECT COUNT(DISTINCT horario) as total FROM agendamentos 
            WHERE data = ? AND horario IN ({placeholders})
            AND (status = 'confirmado' OR status = 'pendente')
        ''', (data_agendamento, *horarios_periodo))
        
        resultado = cursor.fetchone()
        if resultado and resultado[0] >= len(horarios_periodo):
            conn.close()
            return jsonify({'error': f'Todos os horários do período {periodo_selecionado} já estão agendados'}), 400
    
    # Verificar se está bloqueado (verificar período e horário específico)
    if periodo_selecionado in PERIODOS:
        cursor.execute('''
            SELECT id FROM horarios_bloqueados 
            WHERE data = ? AND (horario = ? OR horario = ?)
        ''', (data_agendamento, periodo_selecionado, horario))
    else:
        cursor.execute('''
            SELECT id FROM horarios_bloqueados 
            WHERE data = ? AND horario = ?
        ''', (data_agendamento, horario))
    
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Horário não disponível'}), 400
    
    # Criar agendamento - calcular valor total dos serviços
    valores_servicos, _ = obter_servicos_do_banco()
    valor_total = sum(valores_servicos.get(servico, 0) for servico in servicos_lista)
    
    # Converter lista de serviços para string (separado por vírgula)
    servicos_str = ', '.join(servicos_lista)
    
    try:
        # Criar agendamento
        # Usar status do request se fornecido, senão usar 'pendente'
        status_agendamento = request.json.get('status', 'pendente')
        if status_agendamento not in ['pendente', 'confirmado', 'cancelado', 'concluido']:
            status_agendamento = 'pendente'
        
        # Obter forma de pagamento do request (padrão: 'pendente')
        forma_pagamento = request.json.get('forma_pagamento', 'pendente')
        formas_validas = ['pendente', 'pix', 'cartao']
        if forma_pagamento not in formas_validas:
            forma_pagamento = 'pendente'
        
        # Obter campos de pagamento (opcionais)
        data_pagamento = request.json.get('data_pagamento')  # YYYY-MM-DD ou None
        pago = request.json.get('pago', False)
        pago_int = 1 if pago else 0
        
        cursor.execute('''
            INSERT INTO agendamentos (nome, telefone, servico, data, horario, valor, status, forma_pagamento, data_pagamento, pago)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (nome, telefone, servicos_str, data_agendamento, horario, valor_total, status_agendamento, forma_pagamento, data_pagamento, pago_int))
        
        agendamento_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # Enviar notificação WhatsApp automática em thread separada (não bloqueia resposta)
        if ENVIAR_WHATSAPP_AUTO:
            thread = threading.Thread(
                target=enviar_notificacao_whatsapp,
                args=(nome, telefone, servicos_str, data_agendamento, horario, valor_total)
            )
            thread.daemon = True
            thread.start()
        
        mensagem = 'Agendamento criado com sucesso!'
        
        return jsonify({
            'success': True,
            'message': mensagem,
            'agendamento_id': agendamento_id,
            'valor': valor_total
        }), 201
    
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Horário já está agendado'}), 400

@app.route('/api/admin/agendamentos', methods=['GET'])
@admin_required
def listar_agendamentos_admin():
    """Lista agendamentos com filtros (para administração - otimizado)"""
    print(f"\n{'='*60}")
    print(f"📋 LISTAR_AGENDAMENTOS_ADMIN - Requisição recebida")
    print(f"{'='*60}")
    
    try:
        # Obter filtros da query string
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        status = request.args.get('status')
        nome = request.args.get('nome', '').strip()
        telefone = request.args.get('telefone', '').strip()
        if telefone:
            telefone = re.sub(r'\D', '', telefone)
        
        print(f"   Filtros: data_inicio={data_inicio}, data_fim={data_fim}, status={status}, nome={nome}, telefone={telefone}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Primeiro, contar total de agendamentos no banco (sem filtros)
        cursor.execute('SELECT COUNT(*) FROM agendamentos')
        total_no_banco = cursor.fetchone()[0]
        print(f"   📊 Total de agendamentos no banco (sem filtros): {total_no_banco}")
        
        # Construir query dinamicamente com filtros
        query = 'SELECT * FROM agendamentos WHERE 1=1'
        params = []
        
        if data_inicio:
            query += ' AND data >= ?'
            params.append(data_inicio)
        
        if data_fim:
            query += ' AND data <= ?'
            params.append(data_fim)
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        if nome:
            query += ' AND nome LIKE ?'
            params.append(f'%{nome}%')
        
        if telefone:
            query += ' AND telefone LIKE ?'
            params.append(f'%{telefone}%')
        
        query += ' ORDER BY data DESC, horario DESC'
        
        print(f"   Query SQL: {query}")
        print(f"   Parâmetros: {params}")
        
        cursor.execute(query, params)
        
        agendamentos = []
        for row in cursor.fetchall():
            try:
                # sqlite3.Row não tem método .get(), usar acesso direto com verificação
                # Verificar se a coluna existe antes de acessar
                if 'forma_pagamento' in row.keys():
                    forma_pagamento = row['forma_pagamento']
                else:
                    forma_pagamento = None
                
                data_pagamento = row['data_pagamento'] if 'data_pagamento' in row.keys() else None
                pago = bool(row['pago']) if 'pago' in row.keys() else False
                
                agendamentos.append({
                    'id': row['id'],
                    'nome': row['nome'],
                    'telefone': row['telefone'],
                    'servico': row['servico'],
                    'data': row['data'],
                    'horario': row['horario'],
                    'valor': float(row['valor']),
                    'status': row['status'],
                    'forma_pagamento': forma_pagamento if forma_pagamento else 'pendente',
                    'data_pagamento': data_pagamento,
                    'pago': pago,
                    'created_at': row['created_at']
                })
            except Exception as e:
                print(f"   ⚠️  Erro ao processar linha: {e}")
                import traceback
                traceback.print_exc()
                # Continuar com próximo registro
                continue
        
        conn.close()
        
        print(f"   📤 Retornando {len(agendamentos)} agendamento(s) após filtros")
        if len(agendamentos) > 0:
            print(f"   Primeiros IDs: {[a['id'] for a in agendamentos[:5]]}")
        print(f"{'='*60}\n")
        
        # Adicionar headers para evitar cache
        response = jsonify(agendamentos)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        print(f"   ❌ ERRO CRÍTICO em listar_agendamentos_admin: {e}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        if 'conn' in locals():
            conn.close()
        return jsonify({'error': f'Erro ao buscar agendamentos: {str(e)}'}), 500

@app.route('/api/admin/agendamentos/<int:agendamento_id>', methods=['GET'])
@admin_required
def obter_agendamento(agendamento_id):
    """Obtém um agendamento específico"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM agendamentos WHERE id = ?', (agendamento_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'error': 'Agendamento não encontrado'}), 404
    
    # sqlite3.Row não tem método .get(), usar acesso direto com verificação
    forma_pagamento = row['forma_pagamento'] if 'forma_pagamento' in row.keys() else None
    data_pagamento = row['data_pagamento'] if 'data_pagamento' in row.keys() else None
    pago = bool(row['pago']) if 'pago' in row.keys() else False
    
    agendamento = {
        'id': row['id'],
        'nome': row['nome'],
        'telefone': row['telefone'],
        'servico': row['servico'],
        'data': row['data'],
        'horario': row['horario'],
        'valor': float(row['valor']),
        'status': row['status'],
        'forma_pagamento': forma_pagamento if forma_pagamento else 'pendente',
        'data_pagamento': data_pagamento,
        'pago': pago,
        'created_at': row['created_at']
    }
    
    return jsonify(agendamento)

@app.route('/api/admin/agendamentos/<int:agendamento_id>', methods=['PATCH'])
@admin_required
def atualizar_agendamento(agendamento_id):
    """Atualiza um agendamento completo"""
    data = request.json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se agendamento existe
    cursor.execute('SELECT * FROM agendamentos WHERE id = ?', (agendamento_id,))
    agendamento_existente = cursor.fetchone()
    if not agendamento_existente:
        conn.close()
        return jsonify({'error': 'Agendamento não encontrado'}), 404
    
    # Validar campos opcionais
    campos_permitidos = ['nome', 'telefone', 'servico', 'data', 'horario', 'valor', 'status', 'forma_pagamento', 'data_pagamento', 'pago']
    campos_atualizar = {}
    
    # Verificar se data ou horário mudaram (precisa validar disponibilidade)
    data_mudou = 'data' in data and data['data'] != agendamento_existente['data']
    horario_mudou = 'horario' in data and data['horario'] != agendamento_existente['horario']
    servico_mudou = 'servico' in data
    
    for campo in campos_permitidos:
        if campo in data:
            if campo == 'status':
                status_validos = ['pendente', 'confirmado', 'cancelado', 'concluido']
                if data[campo] not in status_validos:
                    conn.close()
                    return jsonify({'error': f'Status inválido. Valores válidos: {", ".join(status_validos)}'}), 400
            elif campo == 'forma_pagamento':
                formas_validas = ['pendente', 'pix', 'cartao']
                if data[campo] not in formas_validas:
                    conn.close()
                    return jsonify({'error': f'Forma de pagamento inválida. Valores válidos: {", ".join(formas_validas)}'}), 400
                campos_atualizar[campo] = data[campo]
                continue
            elif campo == 'data_pagamento':
                # Validar formato de data (YYYY-MM-DD) ou None
                if data[campo] is None or data[campo] == '':
                    campos_atualizar[campo] = None
                else:
                    try:
                        datetime.strptime(data[campo], '%Y-%m-%d')
                        campos_atualizar[campo] = data[campo]
                    except ValueError:
                        conn.close()
                        return jsonify({'error': 'data_pagamento deve estar no formato YYYY-MM-DD'}), 400
                continue
            elif campo == 'pago':
                # Converter boolean para integer
                campos_atualizar[campo] = 1 if bool(data[campo]) else 0
                continue
            elif campo == 'servico':
                # Validar serviços
                servicos_lista = data[campo] if isinstance(data[campo], list) else [data[campo]]
                valores_servicos, _ = obter_servicos_do_banco()
                for servico in servicos_lista:
                    if servico not in valores_servicos:
                        conn.close()
                        return jsonify({'error': f'Serviço inválido: {servico}'}), 400
                campos_atualizar[campo] = ', '.join(servicos_lista) if isinstance(data[campo], list) else data[campo]
                # Recalcular valor se serviços mudaram
                valores_servicos, _ = obter_servicos_do_banco()
                valor_total = sum(valores_servicos.get(s, 0) for s in servicos_lista)
                campos_atualizar['valor'] = valor_total
                continue
            elif campo == 'valor':
                try:
                    campos_atualizar[campo] = float(data[campo])
                except (ValueError, TypeError):
                    conn.close()
                    return jsonify({'error': 'Valor inválido'}), 400
                continue
            elif campo == 'data':
                # Validar formato de data
                try:
                    datetime.strptime(data[campo], '%Y-%m-%d')
                except ValueError:
                    conn.close()
                    return jsonify({'error': 'Data inválida'}), 400
            elif campo == 'horario':
                # Validar formato de horário (HH:MM)
                try:
                    datetime.strptime(data[campo], '%H:%M')
                except ValueError:
                    conn.close()
                    return jsonify({'error': 'Horário inválido'}), 400
            
            campos_atualizar[campo] = data[campo]
    
    if not campos_atualizar:
        conn.close()
        return jsonify({'error': 'Nenhum campo para atualizar'}), 400
    
    # Se data ou horário mudaram, validar disponibilidade
    if data_mudou or horario_mudou:
        nova_data = campos_atualizar.get('data', agendamento_existente['data'])
        novo_horario = campos_atualizar.get('horario', agendamento_existente['horario'])
        
        # Verificar se o novo horário não está ocupado (exceto pelo próprio agendamento)
        cursor.execute('''
            SELECT id FROM agendamentos 
            WHERE data = ? AND horario = ? AND id != ?
            AND (status = 'confirmado' OR status = 'pendente')
        ''', (nova_data, novo_horario, agendamento_id))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Horário {novo_horario} já está agendado para esta data'}), 400
        
        # Validar se o dia está ativo usando configuração do banco
        try:
            config_nova_data = obter_config_horario(nova_data)
            if not config_nova_data['ativo']:
                conn.close()
                return jsonify({'error': 'Não é possível agendar neste dia'}), 400
        except Exception:
            pass
    
    # Construir query de atualização
    set_clauses = ', '.join([f'{campo} = ?' for campo in campos_atualizar.keys()])
    valores = list(campos_atualizar.values()) + [agendamento_id]
    
    cursor.execute(f'''
        UPDATE agendamentos 
        SET {set_clauses}
        WHERE id = ?
    ''', valores)
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Agendamento atualizado com sucesso'})

@app.route('/api/admin/agendamentos/<int:agendamento_id>', methods=['DELETE'])
@admin_required
def deletar_agendamento(agendamento_id):
    """Deleta um agendamento"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se agendamento existe
    cursor.execute('SELECT id FROM agendamentos WHERE id = ?', (agendamento_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Agendamento não encontrado'}), 404
    
    # Deletar agendamento
    cursor.execute('DELETE FROM agendamentos WHERE id = ?', (agendamento_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Agendamento deletado com sucesso'})

# Endpoint antigo mantido para compatibilidade
@app.route('/api/agendamentos', methods=['GET'])
def listar_agendamentos():
    """Lista todos os agendamentos (para administração) - endpoint antigo"""
    return listar_agendamentos_admin()

@app.route('/api/admin/clientes', methods=['GET'])
@admin_required
def buscar_clientes():
    """Busca clientes por nome para autocomplete ou retorna últimos clientes"""
    nome_busca = request.args.get('nome', '').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Se não há busca ou busca vazia, retornar últimos clientes cadastrados
    if not nome_busca or len(nome_busca) == 0:
        cursor.execute('''
            SELECT 
                a1.nome,
                a1.telefone
            FROM agendamentos a1
            INNER JOIN (
                SELECT 
                    LOWER(nome) as nome_lower,
                    MAX(created_at) as ultimo_agendamento
                FROM agendamentos
                GROUP BY LOWER(nome)
            ) a2 ON LOWER(a1.nome) = a2.nome_lower 
                AND a1.created_at = a2.ultimo_agendamento
            ORDER BY a1.created_at DESC
            LIMIT 10
        ''')
    else:
        # Buscar clientes únicos por nome (case-insensitive)
        # Retornar o telefone mais recente de cada cliente
        cursor.execute('''
            SELECT 
                a1.nome,
                a1.telefone
            FROM agendamentos a1
            INNER JOIN (
                SELECT 
                    LOWER(nome) as nome_lower,
                    MAX(created_at) as ultimo_agendamento
                FROM agendamentos
                WHERE LOWER(nome) LIKE LOWER(?)
                GROUP BY LOWER(nome)
            ) a2 ON LOWER(a1.nome) = a2.nome_lower 
                AND a1.created_at = a2.ultimo_agendamento
            WHERE LOWER(a1.nome) LIKE LOWER(?)
            ORDER BY a1.created_at DESC
            LIMIT 10
        ''', (f'%{nome_busca}%', f'%{nome_busca}%'))
    
    clientes = []
    for row in cursor.fetchall():
        clientes.append({
            'nome': row['nome'],
            'telefone': row['telefone']
        })
    
    conn.close()
    return jsonify(clientes)

@app.route('/api/admin/financeiro', methods=['GET'])
@admin_required
def obter_dados_financeiros():
    """Retorna dados financeiros agregados com filtros"""
    # Obter filtros da query string
    cliente = request.args.get('cliente', '').strip()
    mes = request.args.get('mes')  # formato: YYYY-MM
    forma_pagamento = request.args.get('forma_pagamento', '').strip()
    status = request.args.get('status', '').strip()
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Construir query base
    query = '''
        SELECT 
            id, nome, telefone, servico, data, horario, valor, status, forma_pagamento, data_pagamento, pago, created_at
        FROM agendamentos
        WHERE 1=1
    '''
    params = []
    
    # Aplicar filtros
    if cliente:
        query += ' AND nome LIKE ?'
        params.append(f'%{cliente}%')
    
    if mes:
        # mes no formato YYYY-MM
        query += ' AND strftime("%Y-%m", data) = ?'
        params.append(mes)
    
    if forma_pagamento:
        query += ' AND forma_pagamento = ?'
        params.append(forma_pagamento)
    
    if status:
        query += ' AND status = ?'
        params.append(status)
    
    # Obter filtro de pagamento
    pago_filtro = request.args.get('pago', '').strip()
    if pago_filtro:
        if pago_filtro.lower() == 'true' or pago_filtro == '1':
            query += ' AND pago = 1'
        elif pago_filtro.lower() == 'false' or pago_filtro == '0':
            query += ' AND pago = 0'
    
    if data_inicio:
        query += ' AND data >= ?'
        params.append(data_inicio)
    
    if data_fim:
        query += ' AND data <= ?'
        params.append(data_fim)
    
    query += ' ORDER BY data DESC, horario DESC'
    
    cursor.execute(query, params)
    
    # Obter todos os agendamentos filtrados
    agendamentos = []
    for row in cursor.fetchall():
        # sqlite3.Row não tem método .get(), usar acesso direto com verificação
        forma_pag = row['forma_pagamento'] if 'forma_pagamento' in row.keys() else None
        data_pag = row['data_pagamento'] if 'data_pagamento' in row.keys() else None
        pago = bool(row['pago']) if 'pago' in row.keys() else False
        
        agendamentos.append({
            'id': row['id'],
            'nome': row['nome'],
            'telefone': row['telefone'],
            'servico': row['servico'],
            'data': row['data'],
            'horario': row['horario'],
            'valor': float(row['valor']),
            'status': row['status'],
            'forma_pagamento': forma_pag if forma_pag else 'pendente',
            'data_pagamento': data_pag,
            'pago': pago,
            'created_at': row['created_at']
        })
    
    # Calcular totais e estatísticas
    total_faturado = sum(a['valor'] for a in agendamentos)
    total_recebido = sum(a['valor'] for a in agendamentos if a.get('pago', False))
    total_pendente = total_faturado - total_recebido
    
    # Total por forma de pagamento
    total_por_forma = {}
    for ag in agendamentos:
        forma = ag['forma_pagamento'] or 'pendente'
        total_por_forma[forma] = total_por_forma.get(forma, 0) + ag['valor']
    
    # Total por status
    total_por_status = {}
    for ag in agendamentos:
        status_ag = ag['status']
        total_por_status[status_ag] = total_por_status.get(status_ag, 0) + ag['valor']
    
    # Total por status de pagamento
    total_pago = sum(a['valor'] for a in agendamentos if a.get('pago', False))
    total_nao_pago = total_faturado - total_pago
    
    # Total por cliente
    total_por_cliente = {}
    for ag in agendamentos:
        cliente_nome = ag['nome']
        if cliente_nome not in total_por_cliente:
            total_por_cliente[cliente_nome] = {
                'nome': cliente_nome,
                'telefone': ag['telefone'],
                'total': 0,
                'quantidade': 0
            }
        total_por_cliente[cliente_nome]['total'] += ag['valor']
        total_por_cliente[cliente_nome]['quantidade'] += 1
    
    # Converter dict para lista e ordenar por total
    total_por_cliente_lista = sorted(
        total_por_cliente.values(),
        key=lambda x: x['total'],
        reverse=True
    )
    
    # Total por mês
    total_por_mes = {}
    for ag in agendamentos:
        if ag['data']:
            mes_ag = ag['data'][:7]  # YYYY-MM
            total_por_mes[mes_ag] = total_por_mes.get(mes_ag, 0) + ag['valor']
    
    # Converter dict para lista e ordenar por mês
    total_por_mes_lista = sorted([
        {'mes': mes, 'total': total}
        for mes, total in total_por_mes.items()
    ], key=lambda x: x['mes'], reverse=True)
    
    conn.close()
    
    return jsonify({
        'agendamentos': agendamentos,
        'resumo': {
            'total_faturado': total_faturado,
            'total_recebido': total_recebido,
            'total_pendente': total_pendente,
            'total_agendamentos': len(agendamentos),
            'total_pago': total_pago,
            'total_nao_pago': total_nao_pago,
            'total_por_forma_pagamento': total_por_forma,
            'total_por_status': total_por_status,
            'total_por_cliente': total_por_cliente_lista,
            'total_por_mes': total_por_mes_lista
        }
    })

# ============================================================
# ENDPOINTS DE CONFIGURAÇÃO DE HORÁRIOS
# ============================================================

@app.route('/api/admin/config-horarios', methods=['GET'])
@admin_required
def listar_config_horarios():
    """Lista todas as configurações de horários"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, tipo, dia_semana, data_especifica, horario_inicio, horario_fim,
               tem_almoco, almoco_inicio, almoco_fim, ativo, created_at, updated_at
        FROM config_horarios
        ORDER BY tipo, dia_semana, data_especifica
    ''')
    
    configs = []
    for row in cursor.fetchall():
        configs.append({
            'id': row['id'],
            'tipo': row['tipo'],
            'dia_semana': row['dia_semana'],
            'data_especifica': row['data_especifica'],
            'horario_inicio': row['horario_inicio'],
            'horario_fim': row['horario_fim'],
            'tem_almoco': bool(row['tem_almoco']),
            'almoco_inicio': row['almoco_inicio'],
            'almoco_fim': row['almoco_fim'],
            'ativo': bool(row['ativo']),
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        })
    
    conn.close()
    return jsonify(configs)

@app.route('/api/admin/config-horarios', methods=['POST'])
@admin_required
def criar_config_horario():
    """Cria uma nova configuração de horário"""
    data = request.json
    
    # Validações
    tipo = data.get('tipo')
    if tipo not in ['dia_semana', 'data_especifica']:
        return jsonify({'error': 'Tipo deve ser "dia_semana" ou "data_especifica"'}), 400
    
    if tipo == 'dia_semana':
        dia_semana = data.get('dia_semana')
        if dia_semana is None or dia_semana < 0 or dia_semana > 6:
            return jsonify({'error': 'dia_semana deve ser entre 0 (domingo) e 6 (sábado)'}), 400
        data_especifica = None
    else:
        data_especifica = data.get('data_especifica')
        if not data_especifica:
            return jsonify({'error': 'data_especifica é obrigatória para tipo "data_especifica"'}), 400
        try:
            datetime.strptime(data_especifica, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'data_especifica deve estar no formato YYYY-MM-DD'}), 400
        dia_semana = None
    
    horario_inicio = data.get('horario_inicio')
    horario_fim = data.get('horario_fim')
    if not horario_inicio or not horario_fim:
        return jsonify({'error': 'horario_inicio e horario_fim são obrigatórios'}), 400
    
    # Validar formato de horário
    try:
        datetime.strptime(horario_inicio, '%H:%M')
        datetime.strptime(horario_fim, '%H:%M')
    except ValueError:
        return jsonify({'error': 'Horários devem estar no formato HH:MM'}), 400
    
    tem_almoco = data.get('tem_almoco', True)
    almoco_inicio = data.get('almoco_inicio') if tem_almoco else None
    almoco_fim = data.get('almoco_fim') if tem_almoco else None
    
    if tem_almoco:
        if not almoco_inicio or not almoco_fim:
            return jsonify({'error': 'almoco_inicio e almoco_fim são obrigatórios quando tem_almoco é true'}), 400
        try:
            datetime.strptime(almoco_inicio, '%H:%M')
            datetime.strptime(almoco_fim, '%H:%M')
        except ValueError:
            return jsonify({'error': 'Horários de almoço devem estar no formato HH:MM'}), 400
    
    ativo = data.get('ativo', True)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO config_horarios 
            (tipo, dia_semana, data_especifica, horario_inicio, horario_fim,
             tem_almoco, almoco_inicio, almoco_fim, ativo, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (tipo, dia_semana, data_especifica, horario_inicio, horario_fim,
              int(tem_almoco), almoco_inicio, almoco_fim, int(ativo)))
        
        conn.commit()
        config_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Configuração de horário criada com sucesso',
            'id': config_id
        }), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Já existe uma configuração para este dia/data'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': f'Erro ao criar configuração: {str(e)}'}), 500

@app.route('/api/admin/config-horarios/<int:config_id>', methods=['PATCH'])
@admin_required
def atualizar_config_horario(config_id):
    """Atualiza uma configuração de horário"""
    data = request.json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existe
    cursor.execute('SELECT * FROM config_horarios WHERE id = ?', (config_id,))
    config_existente = cursor.fetchone()
    if not config_existente:
        conn.close()
        return jsonify({'error': 'Configuração não encontrada'}), 404
    
    # Construir campos para atualizar
    campos_atualizar = {}
    
    if 'horario_inicio' in data:
        try:
            datetime.strptime(data['horario_inicio'], '%H:%M')
            campos_atualizar['horario_inicio'] = data['horario_inicio']
        except ValueError:
            conn.close()
            return jsonify({'error': 'horario_inicio deve estar no formato HH:MM'}), 400
    
    if 'horario_fim' in data:
        try:
            datetime.strptime(data['horario_fim'], '%H:%M')
            campos_atualizar['horario_fim'] = data['horario_fim']
        except ValueError:
            conn.close()
            return jsonify({'error': 'horario_fim deve estar no formato HH:MM'}), 400
    
    if 'tem_almoco' in data:
        tem_almoco = bool(data['tem_almoco'])
        campos_atualizar['tem_almoco'] = int(tem_almoco)
        
        if tem_almoco:
            if 'almoco_inicio' in data and 'almoco_fim' in data:
                try:
                    datetime.strptime(data['almoco_inicio'], '%H:%M')
                    datetime.strptime(data['almoco_fim'], '%H:%M')
                    campos_atualizar['almoco_inicio'] = data['almoco_inicio']
                    campos_atualizar['almoco_fim'] = data['almoco_fim']
                except ValueError:
                    conn.close()
                    return jsonify({'error': 'Horários de almoço devem estar no formato HH:MM'}), 400
            elif not config_existente['almoco_inicio'] or not config_existente['almoco_fim']:
                conn.close()
                return jsonify({'error': 'almoco_inicio e almoco_fim são obrigatórios quando tem_almoco é true'}), 400
        else:
            campos_atualizar['almoco_inicio'] = None
            campos_atualizar['almoco_fim'] = None
    
    if 'ativo' in data:
        campos_atualizar['ativo'] = int(bool(data['ativo']))
    
    if not campos_atualizar:
        conn.close()
        return jsonify({'error': 'Nenhum campo para atualizar'}), 400
    
    # Adicionar updated_at
    campos_atualizar['updated_at'] = datetime.now().isoformat()
    
    # Construir query
    set_clauses = ', '.join([f'{campo} = ?' for campo in campos_atualizar.keys()])
    valores = list(campos_atualizar.values()) + [config_id]
    
    cursor.execute(f'''
        UPDATE config_horarios 
        SET {set_clauses}
        WHERE id = ?
    ''', valores)
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Configuração atualizada com sucesso'})

@app.route('/api/admin/config-horarios/<int:config_id>', methods=['DELETE'])
@admin_required
def deletar_config_horario(config_id):
    """Deleta uma configuração de horário"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existe
    cursor.execute('SELECT id FROM config_horarios WHERE id = ?', (config_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Configuração não encontrada'}), 404
    
    # Não permitir deletar configurações padrão de dia da semana (só pode desativar)
    cursor.execute('SELECT tipo FROM config_horarios WHERE id = ?', (config_id,))
    tipo = cursor.fetchone()[0]
    if tipo == 'dia_semana':
        conn.close()
        return jsonify({'error': 'Não é possível deletar configurações de dia da semana. Use PATCH para desativar.'}), 400
    
    # Deletar
    cursor.execute('DELETE FROM config_horarios WHERE id = ?', (config_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Configuração deletada com sucesso'})

@app.route('/api/admin/limpar-agendamentos', methods=['POST'])
@admin_required
def limpar_agendamentos():
    """Limpa todos os agendamentos (apenas para testes)"""
    print("\n" + "="*60)
    print("🗑️ LIMPAR AGENDAMENTOS - Requisição recebida")
    print("="*60)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Contar quantos agendamentos serão deletados
        cursor.execute('SELECT COUNT(*) FROM agendamentos')
        total = cursor.fetchone()[0]
        print(f"📊 Total de agendamentos encontrados: {total}")
        
        if total == 0:
            conn.close()
            print("ℹ️ Nenhum agendamento para deletar")
            print("="*60 + "\n")
            return jsonify({
                'success': True,
                'message': 'Nenhum agendamento encontrado para deletar'
            })
        
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
        print("="*60 + "\n")
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'{total} agendamento(s) deletado(s) com sucesso'
        })
    except Exception as e:
        print(f"❌ ERRO ao limpar agendamentos: {str(e)}")
        import traceback
        traceback.print_exc()
        print("="*60 + "\n")
        conn.close()
        return jsonify({'error': f'Erro ao limpar agendamentos: {str(e)}'}), 500

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
    flask_env = os.getenv('FLASK_ENV', 'development')
    is_production = flask_env == 'production'
    
    # Porta: usar variável de ambiente em produção, ou detectar em desenvolvimento
    if is_production:
        port = int(os.getenv('PORT', 5000))
        print(f"\n🚀 Servidor iniciando em modo PRODUÇÃO")
        print(f"📡 Porta: {port}")
    else:
        # Modo desenvolvimento: tentar encontrar porta disponível
        import socket
        port = None
        portas_tentadas = []
        
        for tentativa_porta in range(5000, 5010):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            result = sock.connect_ex(('127.0.0.1', tentativa_porta))
            sock.close()
            
            if result != 0:  # Porta disponível
                port = tentativa_porta
                break
            else:
                portas_tentadas.append(tentativa_porta)
        
        if port is None:
            print(f"\n❌ Erro: Nenhuma porta disponível entre 5000-5009!")
            print(f"Portas ocupadas: {', '.join(map(str, portas_tentadas))}")
            print("Por favor, pare os processos que estão usando essas portas.")
            sys.exit(1)
        
        if port != 5000:
            print(f"\n⚠️  Porta 5000 está ocupada, usando porta {port}")
            print(f"ℹ️  O frontend detecta automaticamente a porta - não é necessário alterar nada!")
        
        print(f"\n🚀 Servidor iniciando em http://localhost:{port}")
        print("Pressione Ctrl+C para parar o servidor\n")
        
        # Salvar porta em arquivo para o frontend ler (apenas em desenvolvimento)
        try:
            with open('.port', 'w') as f:
                f.write(str(port))
        except:
            pass
    
    # Configurar debug baseado no ambiente
    debug_mode = not is_production
    
