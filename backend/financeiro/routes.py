from flask import Blueprint, request, jsonify
from auth.decorators import admin_required
from database import get_db_connection

financeiro_bp = Blueprint("financeiro", __name__)


def _build_filters(args):
    """
    Monta WHERE + params reutilizáveis para todas as queries do financeiro.
    """
    where = ["1=1"]
    params = []

    cliente = args.get("cliente")
    mes = args.get("mes")  # YYYY-MM
    forma_pagamento = args.get("forma_pagamento")
    status = args.get("status")
    data_inicio = args.get("data_inicio")
    data_fim = args.get("data_fim")
    pago = args.get("pago")  # opcional: "true"/"false" ou "1"/"0"

    if cliente:
        where.append("nome ILIKE %s")
        params.append(f"%{cliente}%")

    if mes:
        where.append("TO_CHAR(data, 'YYYY-MM') = %s")
        params.append(mes)

    if forma_pagamento:
        where.append("forma_pagamento = %s")
        params.append(forma_pagamento)

    if status:
        where.append("status = %s")
        params.append(status)

    if pago:
        p = pago.strip().lower()
        if p in ("true", "1"):
            where.append("pago = TRUE")
        elif p in ("false", "0"):
            where.append("pago = FALSE")

    if data_inicio:
        where.append("data >= %s")
        params.append(data_inicio)

    if data_fim:
        where.append("data <= %s")
        params.append(data_fim)

    return " AND ".join(where), tuple(params)


def _num(v):
    # SUM() pode retornar NULL quando não há linhas
    return float(v or 0)


@financeiro_bp.get("/api/admin/financeiro")
@admin_required
def obter_dados_financeiros():
    where_sql, params = _build_filters(request.args)

    conn = get_db_connection()
    cur = conn.cursor()

    # 1) Lista detalhada (para a tabela)
    cur.execute(
        f"""
        SELECT
            id,
            nome,
            telefone,
            servico,
            data::text AS data,
            horario::text AS horario,
            valor::float AS valor, -- importante: frontend consegue toFixed()
            status,
            forma_pagamento,
            pago,
            data_pagamento::text AS data_pagamento
        FROM agendamentos
        WHERE {where_sql}
        ORDER BY data DESC, horario DESC
        """,
        params,
    )
    agendamentos = cur.fetchall()

    # 2) Totais gerais
    cur.execute(
        f"""
        SELECT
            COALESCE(SUM(valor), 0) AS total_faturado,
            COALESCE(SUM(CASE WHEN pago THEN valor ELSE 0 END), 0) AS total_recebido,
            COALESCE(SUM(CASE WHEN pago THEN valor ELSE 0 END), 0) AS total_pago,
            COALESCE(SUM(CASE WHEN NOT pago THEN valor ELSE 0 END), 0) AS total_nao_pago,
            COUNT(*) AS total_agendamentos
        FROM agendamentos
        WHERE {where_sql}
        """,
        params,
    )
    totals = cur.fetchone() or {}

    total_faturado = _num(totals.get("total_faturado"))
    total_recebido = _num(totals.get("total_recebido"))
    total_pendente = float(total_faturado - total_recebido)
    total_pago = _num(totals.get("total_pago"))
    total_nao_pago = _num(totals.get("total_nao_pago"))
    total_agendamentos = int(totals.get("total_agendamentos") or 0)

    # 3) Por forma de pagamento
    cur.execute(
        f"""
        SELECT forma_pagamento, COALESCE(SUM(valor), 0)::float AS total
        FROM agendamentos
        WHERE {where_sql}
        GROUP BY forma_pagamento
        """,
        params,
    )
    total_por_forma_pagamento = {
        (r["forma_pagamento"] or "pendente"): _num(r["total"]) for r in cur.fetchall()
    }

    # 4) Por status
    cur.execute(
        f"""
        SELECT status, COALESCE(SUM(valor), 0)::float AS total
        FROM agendamentos
        WHERE {where_sql}
        GROUP BY status
        """,
        params,
    )
    total_por_status = {r["status"]: _num(r["total"]) for r in cur.fetchall()}

    # 5) Por cliente
    cur.execute(
        f"""
        SELECT
            nome,
            telefone,
            COUNT(*)::int AS quantidade,
            COALESCE(SUM(valor), 0)::float AS total
        FROM agendamentos
        WHERE {where_sql}
        GROUP BY nome, telefone
        ORDER BY total DESC
        LIMIT 100
        """,
        params,
    )
    total_por_cliente = cur.fetchall()

    # 6) Por mês
    cur.execute(
        f"""
        SELECT
            TO_CHAR(data, 'YYYY-MM') AS mes,
            COALESCE(SUM(valor), 0)::float AS total
        FROM agendamentos
        WHERE {where_sql}
        GROUP BY mes
        ORDER BY mes DESC
        """,
        params,
    )
    total_por_mes = cur.fetchall()

    conn.close()

    return jsonify(
        {
            "agendamentos": agendamentos,
            "resumo": {
                "total_faturado": total_faturado,
                "total_recebido": total_recebido,
                "total_pendente": total_pendente,
                "total_agendamentos": total_agendamentos,
                "total_pago": total_pago,
                "total_nao_pago": total_nao_pago,
                "total_por_forma_pagamento": total_por_forma_pagamento,
                "total_por_status": total_por_status,
                "total_por_cliente": total_por_cliente,
                "total_por_mes": total_por_mes,
            },
        }
    ), 200