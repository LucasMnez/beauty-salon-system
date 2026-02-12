from datetime import datetime, timedelta
from database import get_db_connection


def _to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _to_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _slots(inicio: str, fim: str, intervalo: int = 30):
    ini = _to_minutes(inicio)
    end = _to_minutes(fim)
    return [_to_hhmm(m) for m in range(ini, end, intervalo)]


def calcular_horarios(data_str, servicos):
    # 1) Busca duração dos serviços selecionados
    conn = get_db_connection()
    cur = conn.cursor()

    duracao_total = 60
    if servicos:
        cur.execute(
            """
            SELECT nome, duracao_minutos
            FROM servicos
            WHERE ativo = TRUE
            """
        )
        dur_map = {r["nome"]: int(r["duracao_minutos"]) for r in cur.fetchall()}
        duracao_total = sum(dur_map.get(s, 60) for s in servicos) or 60

    # 2) Configuração do dia (fallback padrão)
    data_obj = datetime.strptime(data_str, "%Y-%m-%d")
    dia_semana = (data_obj.weekday() + 1) % 7  # 0=domingo

    cur.execute(
        """
        SELECT horario_inicio::text, horario_fim::text,
               tem_almoco, almoco_inicio::text, almoco_fim::text, ativo
        FROM config_horarios
        WHERE tipo='data_especifica' AND data_especifica=%s
        LIMIT 1
        """,
        (data_str,),
    )
    cfg = cur.fetchone()

    if not cfg:
        cur.execute(
            """
            SELECT horario_inicio::text, horario_fim::text,
                   tem_almoco, almoco_inicio::text, almoco_fim::text, ativo
            FROM config_horarios
            WHERE tipo='dia_semana' AND dia_semana=%s
            LIMIT 1
            """,
            (dia_semana,),
        )
        cfg = cur.fetchone()

    if not cfg:
        cfg = {
            "horario_inicio": "08:00:00",
            "horario_fim": "21:00:00",
            "tem_almoco": True,
            "almoco_inicio": "12:00:00",
            "almoco_fim": "13:00:00",
            "ativo": True,
        }

    if not cfg["ativo"]:
        conn.close()
        return {"data": data_str, "horarios": []}

    inicio = cfg["horario_inicio"][:5]
    fim = cfg["horario_fim"][:5]
    base_slots = _slots(inicio, fim, 30)

    # 3) Horários já ocupados/bloqueados
    cur.execute(
        """
        SELECT horario::text
        FROM agendamentos
        WHERE data=%s AND status IN ('pendente', 'confirmado')
        """,
        (data_str,),
    )
    ocupados = {r["horario"][:5] for r in cur.fetchall()}

    cur.execute("SELECT horario::text FROM horarios_bloqueados WHERE data=%s", (data_str,))
    bloqueados = {r["horario"][:5] for r in cur.fetchall()}

    conn.close()

    # 4) Filtra almoço + ocupação simples (MVP)
    livres = []
    for h in base_slots:
        if h in ocupados or h in bloqueados:
            continue

        if cfg["tem_almoco"] and cfg["almoco_inicio"] and cfg["almoco_fim"]:
            ai = cfg["almoco_inicio"][:5]
            af = cfg["almoco_fim"][:5]
            if _to_minutes(ai) <= _to_minutes(h) < _to_minutes(af):
                continue

        # Se duração > 30, valida se o horário final não passa do fechamento
        fim_servico = _to_minutes(h) + duracao_total
        if fim_servico > _to_minutes(fim):
            continue

        livres.append(h)

    return {"data": data_str, "horarios": livres}