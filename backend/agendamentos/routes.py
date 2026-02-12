from flask import Blueprint, request, jsonify
from psycopg2 import IntegrityError

from auth.decorators import admin_required
from database import get_db_connection

agendamentos_bp = Blueprint("agendamentos", __name__)


@agendamentos_bp.post("/api/agendar")
def criar_agendamento():
    data = request.get_json(silent=True) or {}

    nome = (data.get("nome") or "").strip()
    telefone = (data.get("telefone") or "").strip()
    data_ag = data.get("data")
    horario = data.get("horario")
    servicos = data.get("servicos") or []
    servico_legacy = data.get("servico")

    if not servicos and servico_legacy:
        servicos = [servico_legacy]

    if not nome or not telefone or not data_ag or not horario or not servicos:
        return jsonify({"error": "Campos obrigatórios ausentes"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Soma valor dos serviços
    cur.execute("SELECT nome, valor FROM servicos WHERE ativo = TRUE")
    mapa_valor = {r["nome"]: float(r["valor"]) for r in cur.fetchall()}

    for s in servicos:
        if s not in mapa_valor:
            conn.close()
            return jsonify({"error": f"Serviço inválido: {s}"}), 400

    valor_total = sum(mapa_valor[s] for s in servicos)
    servicos_str = ", ".join(servicos)

    try:
        cur.execute(
            """
            INSERT INTO agendamentos (nome, telefone, servico, data, horario, valor, status, forma_pagamento, pago)
            VALUES (%s, %s, %s, %s, %s::time, %s, 'pendente', 'pendente', FALSE)
            RETURNING id
            """,
            (nome, telefone, servicos_str, data_ag, horario, valor_total),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
        return jsonify({"success": True, "agendamento_id": new_id, "valor": valor_total}), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({"error": "Horário já está agendado"}), 400
    finally:
        conn.close()


@agendamentos_bp.get("/api/admin/agendamentos")
@admin_required
def listar_agendamentos_admin():
    data_inicio = request.args.get("data_inicio")
    data_fim = request.args.get("data_fim")
    status = request.args.get("status")
    nome = request.args.get("nome")
    telefone = request.args.get("telefone")

    where = ["1=1"]
    params = []

    if data_inicio:
        where.append("data >= %s")
        params.append(data_inicio)
    if data_fim:
        where.append("data <= %s")
        params.append(data_fim)
    if status:
        where.append("status = %s")
        params.append(status)
    if nome:
        where.append("nome ILIKE %s")
        params.append(f"%{nome}%")
    if telefone:
        where.append("telefone ILIKE %s")
        params.append(f"%{telefone}%")

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT id, nome, telefone, servico, data::text as data, horario::text as horario,
               valor, status, forma_pagamento, data_pagamento::text as data_pagamento,
               pago, created_at
        FROM agendamentos
        WHERE {' AND '.join(where)}
        ORDER BY data DESC, horario DESC
        """,
        tuple(params),
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows), 200


@agendamentos_bp.get("/api/agendamentos")
@admin_required
def listar_agendamentos_legacy():
    return listar_agendamentos_admin()


@agendamentos_bp.get("/api/admin/agendamentos/<int:agendamento_id>")
@admin_required
def obter_agendamento(agendamento_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, nome, telefone, servico, data::text as data, horario::text as horario,
               valor, status, forma_pagamento, data_pagamento::text as data_pagamento,
               pago, created_at
        FROM agendamentos
        WHERE id = %s
        """,
        (agendamento_id,),
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Agendamento não encontrado"}), 404
    return jsonify(row), 200


@agendamentos_bp.patch("/api/admin/agendamentos/<int:agendamento_id>")
@admin_required
def atualizar_agendamento(agendamento_id):
    data = request.get_json(silent=True) or {}
    permitidos = ["nome", "telefone", "servico", "data", "horario", "valor", "status", "forma_pagamento", "data_pagamento", "pago"]

    campos = []
    valores = []

    for k in permitidos:
        if k in data:
            if k == "horario":
                campos.append("horario = %s::time")
                valores.append(data[k])
            else:
                campos.append(f"{k} = %s")
                valores.append(data[k])

    if not campos:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    valores.append(agendamento_id)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"""
        UPDATE agendamentos
        SET {', '.join(campos)}
        WHERE id = %s
        RETURNING id
        """,
        tuple(valores),
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Agendamento não encontrado"}), 404

    return jsonify({"success": True}), 200


@agendamentos_bp.delete("/api/admin/agendamentos/<int:agendamento_id>")
@admin_required
def deletar_agendamento(agendamento_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM agendamentos WHERE id = %s RETURNING id", (agendamento_id,))
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Agendamento não encontrado"}), 404

    return jsonify({"success": True}), 200


@agendamentos_bp.post("/api/admin/limpar-agendamentos")
@admin_required
def limpar_agendamentos():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM agendamentos")
    total = cur.rowcount
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"{total} agendamento(s) deletado(s)"}), 200