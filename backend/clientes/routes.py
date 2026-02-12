from flask import Blueprint, request, jsonify
from auth.decorators import admin_required
from database import get_db_connection

clientes_bp = Blueprint("clientes", __name__)


@clientes_bp.get("/api/admin/clientes")
@admin_required
def buscar_clientes():
    nome_busca = (request.args.get("nome") or "").strip()

    conn = get_db_connection()
    cur = conn.cursor()

    if not nome_busca:
        cur.execute(
            """
            SELECT nome, telefone
            FROM agendamentos
            ORDER BY created_at DESC
            LIMIT 20
            """
        )
    else:
        cur.execute(
            """
            SELECT DISTINCT ON (LOWER(nome)) nome, telefone
            FROM agendamentos
            WHERE nome ILIKE %s
            ORDER BY LOWER(nome), created_at DESC
            LIMIT 20
            """,
            (f"%{nome_busca}%",),
        )

    rows = cur.fetchall()
    conn.close()
    return jsonify(rows), 200