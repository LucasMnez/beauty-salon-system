import os
import random
from datetime import date, datetime, timedelta

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
load_dotenv()

# -----------------------------
# Configurações da carga demo
# -----------------------------
DAYS_AHEAD = 90          # próximos 3 meses (~90 dias)
APPOINTMENTS_PER_DAY = 5 # 5 agendamentos por dia útil
RANDOM_SEED = 42         # repetibilidade

NOMES = [
    "DEMO Ana Souza", "DEMO Beatriz Lima", "DEMO Carla Mendes", "DEMO Daniela Rocha",
    "DEMO Fernanda Alves", "DEMO Gabriela Costa", "DEMO Helena Martins", "DEMO Isabela Nunes",
    "DEMO Juliana Ribeiro", "DEMO Larissa Gomes", "DEMO Mariana Santos", "DEMO Natalia Freitas",
    "DEMO Patricia Araujo", "DEMO Rafaela Moreira", "DEMO Sabrina Teixeira", "DEMO Talita Oliveira",
]

HORARIOS_BASE = ["08:00", "09:30", "11:00", "13:30", "15:00", "16:30", "18:00", "19:30"]


def telefone_ficticio():
    # Gera celular BR no padrão só números (11 dígitos)
    ddd = random.choice(["11", "21", "31", "41", "51"])
    inicio = "9"
    meio = random.randint(1000, 9999)
    fim = random.randint(1000, 9999)
    return f"{ddd}{inicio}{meio}{fim}"


def escolher_status_pagamento():
    # Distribuição para deixar o financeiro “realista”
    # concluido tende a pago; pendente/cancelado tende a não pago
    p = random.random()
    if p < 0.60:
        status = "concluido"
    elif p < 0.85:
        status = "confirmado"
    elif p < 0.95:
        status = "pendente"
    else:
        status = "cancelado"

    if status == "concluido":
        pago = random.random() < 0.85
    elif status == "confirmado":
        pago = random.random() < 0.35
    else:
        pago = False

    if pago:
        forma_pagamento = random.choice(["pix", "cartao"])
    else:
        forma_pagamento = "pendente"

    return status, pago, forma_pagamento


def main():
    random.seed(RANDOM_SEED)

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não definida no ambiente.")

    conn = psycopg2.connect(
        database_url,
        cursor_factory=psycopg2.extras.RealDictCursor,
        sslmode="require"
    )
    cur = conn.cursor()

    # Carrega serviços ativos e valores
    cur.execute("""
        SELECT nome, valor
        FROM servicos
        WHERE ativo = TRUE
        ORDER BY nome
    """)
    servicos = cur.fetchall()

    if not servicos:
        raise RuntimeError("Nenhum serviço ativo encontrado para gerar dados.")

    start = date.today()
    end = start + timedelta(days=DAYS_AHEAD)

    total_tentativas = 0
    total_inseridos = 0

    current = start
    while current <= end:
        # Pula domingo (0=segunda ... 6=domingo no Python)
        if current.weekday() == 6:
            current += timedelta(days=1)
            continue

        horarios = random.sample(HORARIOS_BASE, k=min(APPOINTMENTS_PER_DAY, len(HORARIOS_BASE)))

        for horario in horarios:
            total_tentativas += 1

            nome = random.choice(NOMES)
            telefone = telefone_ficticio()

            # 20% chance de agendamento com 2 serviços
            if random.random() < 0.20 and len(servicos) >= 2:
                s1, s2 = random.sample(servicos, 2)
                servico_nome = f"{s1['nome']}, {s2['nome']}"
                valor = float(s1["valor"]) + float(s2["valor"])
            else:
                s = random.choice(servicos)
                servico_nome = s["nome"]
                valor = float(s["valor"])

            status, pago, forma_pagamento = escolher_status_pagamento()

            data_pagamento = None
            if pago:
                # pagamento no dia ou até 2 dias depois
                delta = random.randint(0, 2)
                data_pagamento = current + timedelta(days=delta)

            cur.execute("""
                INSERT INTO agendamentos (
                    nome, telefone, servico, data, horario, valor, status,
                    forma_pagamento, pago, data_pagamento
                )
                VALUES (%s, %s, %s, %s, %s::time, %s, %s, %s, %s, %s)
                ON CONFLICT (data, horario) DO NOTHING
                RETURNING id
            """, (
                nome,
                telefone,
                servico_nome,
                current.isoformat(),
                horario,
                valor,
                status,
                forma_pagamento,
                pago,
                data_pagamento.isoformat() if data_pagamento else None,
            ))

            inserted = cur.fetchone()
            if inserted:
                total_inseridos += 1

        current += timedelta(days=1)

    conn.commit()
    cur.close()
    conn.close()

    print(f"Tentativas: {total_tentativas}")
    print(f"Inseridos : {total_inseridos}")
    print("Carga demo concluída.")


if __name__ == "__main__":
    main()