from flask import Blueprint, request, jsonify
from psycopg2 import IntegrityError

from auth.decorators import admin_required
from database import get_db_connection

servicos_bp = Blueprint("servicos", __name__)


@servicos_bp.get("/api/servicos")
def listar_servicos_publico():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT nome, valor, duracao_minutos
        FROM servicos
        WHERE ativo = TRUE
        ORDER BY nome
        """
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows), 200


@servicos_bp.get("/api/admin/servicos")
@admin_required
def listar_servicos_admin():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, nome, valor, duracao_minutos, ativo, created_at, updated_at
        FROM servicos
        ORDER BY nome
        """
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows), 200


@servicos_bp.post("/api/admin/servicos")
@admin_required
def criar_servico():
    data = request.get_json(silent=True) or {}
    nome = (data.get("nome") or "").strip()
    valor = data.get("valor")
    duracao = data.get("duracao_minutos")
    ativo = bool(data.get("ativo", True))

    if not nome:
        return jsonify({"error": "Nome é obrigatório"}), 400
    if valor is None or float(valor) < 0:
        return jsonify({"error": "Valor inválido"}), 400
    if duracao is None or int(duracao) <= 0:
        return jsonify({"error": "Duração inválida"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO servicos (nome, valor, duracao_minutos, ativo, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id
            """,
            (nome, valor, duracao, ativo),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
        return jsonify({"success": True, "id": new_id}), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({"error": "Já existe serviço com esse nome"}), 400
    finally:
        conn.close()


@servicos_bp.patch("/api/admin/servicos/<int:servico_id>")
@admin_required
def atualizar_servico(servico_id):
    data = request.get_json(silent=True) or {}
    campos = []
    valores = []

    if "nome" in data:
        nome = (data["nome"] or "").strip()
        if not nome:
            return jsonify({"error": "Nome não pode ser vazio"}), 400
        campos.append("nome = %s")
        valores.append(nome)

    if "valor" in data:
        if float(data["valor"]) < 0:
            return jsonify({"error": "Valor inválido"}), 400
        campos.append("valor = %s")
        valores.append(data["valor"])

    if "duracao_minutos" in data:
        if int(data["duracao_minutos"]) <= 0:
            return jsonify({"error": "Duração inválida"}), 400
        campos.append("duracao_minutos = %s")
        valores.append(data["duracao_minutos"])

    if "ativo" in data:
        campos.append("ativo = %s")
        valores.append(bool(data["ativo"]))

    if not campos:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    campos.append("updated_at = NOW()")
    valores.append(servico_id)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"UPDATE servicos SET {', '.join(campos)} WHERE id = %s RETURNING id", tuple(valores))
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Serviço não encontrado"}), 404

    return jsonify({"success": True}), 200


@servicos_bp.delete("/api/admin/servicos/<int:servico_id>")
@admin_required
def deletar_servico(servico_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM servicos WHERE id = %s RETURNING id", (servico_id,))
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Serviço não encontrado"}), 404

    return jsonify({"success": True}), 200