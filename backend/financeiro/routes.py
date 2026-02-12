from flask import Blueprint, request, jsonify
from auth.decorators import admin_required
from database import get_db_connection

financeiro_bp = Blueprint("financeiro", __name__)


@financeiro_bp.get("/api/admin/financeiro")
@admin_required
def obter_dados_financeiros():
    cliente = request.args.get("cliente")
    mes = request.args.get("mes")  # YYYY-MM
    forma_pagamento = request.args.get("forma_pagamento")
    status = request.args.get("status")
    data_inicio = request.args.get("data_inicio")
    data_fim = request.args.get("data_fim")

    where = ["1=1"]
    params = []

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
    if data_inicio:
        where.append("data >= %s")
        params.append(data_inicio)
    if data_fim:
        where.append("data <= %s")
        params.append(data_fim)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT id, nome, telefone, servico, data::text as data, horario::text as horario,
               valor, status, forma_pagamento, pago
        FROM agendamentos
        WHERE {' AND '.join(where)}
        ORDER BY data DESC, horario DESC
        """,
        tuple(params),
    )
    agendamentos = cur.fetchall()
    conn.close()

    total_faturado = sum(float(a["valor"]) for a in agendamentos)
    total_recebido = sum(float(a["valor"]) for a in agendamentos if a["pago"])
    total_pendente = total_faturado - total_recebido

    return jsonify(
        {
            "agendamentos": agendamentos,
            "resumo": {
                "total_faturado": total_faturado,
                "total_recebido": total_recebido,
                "total_pendente": total_pendente,
                "total_agendamentos": len(agendamentos),
            },
        }
    ), 200