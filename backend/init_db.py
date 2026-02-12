import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def init_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL não definida")

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    print(DATABASE_URL)

    # =========================
    # agendamentos
    # =========================
    cursor.execute("""
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
            data_pagamento DATE,
            pago BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (data, horario)
        );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_agendamentos_data_status ON agendamentos(data, status);")

    # =========================
    # horarios_bloqueados
    # =========================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS horarios_bloqueados (
            id SERIAL PRIMARY KEY,
            data DATE NOT NULL,
            horario TIME NOT NULL,
            motivo TEXT,
            UNIQUE (data, horario)
        );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bloqueados_data ON horarios_bloqueados(data);")

    # =========================
    # admin_sessions
    # =========================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id SERIAL PRIMARY KEY,
            session_token TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(session_token);")

    # =========================
    # servicos
    # =========================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS servicos (
            id SERIAL PRIMARY KEY,
            nome TEXT UNIQUE NOT NULL,
            valor NUMERIC NOT NULL CHECK (valor >= 0),
            duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
            ativo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        INSERT INTO servicos (nome, valor, duracao_minutos, ativo)
        VALUES
            ('Esmaltação em Gel - Mão', 50.00, 90, TRUE),
            ('Esmaltação em Gel - Pé', 60.00, 90, TRUE),
            ('Alongamento no molde F1', 120.00, 180, TRUE),
            ('Banho de Gel', 80.00, 150, TRUE)
        ON CONFLICT (nome) DO NOTHING;
    """)

    # =========================
    # config_horarios
    # =========================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS config_horarios (
            id SERIAL PRIMARY KEY,
            tipo TEXT NOT NULL CHECK (tipo IN ('dia_semana', 'data_especifica')),
            dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
            data_especifica DATE,
            horario_inicio TIME NOT NULL,
            horario_fim TIME NOT NULL,
            tem_almoco BOOLEAN DEFAULT TRUE,
            almoco_inicio TIME,
            almoco_fim TIME,
            ativo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tipo, dia_semana, data_especifica)
        );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_config_horarios_tipo ON config_horarios(tipo);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_config_horarios_dia_semana ON config_horarios(dia_semana);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_config_horarios_data ON config_horarios(data_especifica);")

    cursor.execute("""
        DO $$
        BEGIN
            FOR i IN 0..6 LOOP
                INSERT INTO config_horarios (
                    tipo, dia_semana, horario_inicio, horario_fim,
                    tem_almoco, almoco_inicio, almoco_fim, ativo
                )
                VALUES (
                    'dia_semana',
                    i,
                    '08:00',
                    '21:00',
                    TRUE,
                    '12:00',
                    '13:00',
                    CASE WHEN i = 0 THEN FALSE ELSE TRUE END
                )
                ON CONFLICT (tipo, dia_semana, data_especifica) DO NOTHING;
            END LOOP;
        END $$;
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Banco PostgreSQL inicializado com sucesso")

