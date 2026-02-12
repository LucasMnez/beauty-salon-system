import psycopg2
import psycopg2.extras
from config import Config

def get_db_connection():
    return psycopg2.connect(
        Config.DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
        sslmode="require"
    )

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    # AGENDAMENTOS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        servico TEXT NOT NULL,
        data DATE NOT NULL,
        horario TIME NOT NULL,
        valor NUMERIC NOT NULL,
        status TEXT DEFAULT 'pendente',
        forma_pagamento TEXT DEFAULT 'pendente',
        pix_qrcode TEXT,
        pix_copia_cola TEXT,
        pago BOOLEAN DEFAULT FALSE,
        data_pagamento DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (data, horario)
    );
    """)

    # SERVICOS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS servicos (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        valor NUMERIC NOT NULL,
        duracao_minutos INTEGER NOT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # CONFIG HORARIOS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS config_horarios (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL,
        dia_semana INTEGER,
        data_especifica DATE,
        horario_inicio TIME NOT NULL,
        horario_fim TIME NOT NULL,
        tem_almoco BOOLEAN DEFAULT TRUE,
        almoco_inicio TEXT,
        almoco_fim TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        UNIQUE(tipo, dia_semana, data_especifica)
    );
    """)

    # HORARIOS BLOQUEADOS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS horarios_bloqueados (
        id SERIAL PRIMARY KEY,
        data DATE NOT NULL,
        horario TIME NOT NULL,
        motivo TEXT,
        UNIQUE (data, horario)
    );
    """)

    # ADMIN SESSIONS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS admin_sessions (
        id SERIAL PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    cur.close()
    conn.close()
