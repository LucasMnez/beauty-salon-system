from flask import Blueprint, request, jsonify
from psycopg2 import IntegrityError

from auth.decorators import admin_required
from database import get_db_connection

config_horarios_bp = Blueprint("config_horarios", __name__)


@config_horarios_bp.get("/api/admin/config-horarios")
@admin_required
def listar_config_horarios():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, tipo, dia_semana, data_especifica::text as data_especifica,
               horario_inicio::text as horario_inicio, horario_fim::text as horario_fim,
               tem_almoco, almoco_inicio::text as almoco_inicio, almoco_fim::text as almoco_fim,
               ativo
        FROM config_horarios
        ORDER BY tipo, dia_semana, data_especifica
        """
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows), 200


@config_horarios_bp.post("/api/admin/config-horarios")
@admin_required
def criar_config_horario():
    data = request.get_json(silent=True) or {}

    tipo = data.get("tipo")
    dia_semana = data.get("dia_semana")
    data_especifica = data.get("data_especifica")
    horario_inicio = data.get("horario_inicio")
    horario_fim = data.get("horario_fim")
    tem_almoco = bool(data.get("tem_almoco", True))
    almoco_inicio = data.get("almoco_inicio")
    almoco_fim = data.get("almoco_fim")
    ativo = bool(data.get("ativo", True))

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO config_horarios
            (tipo, dia_semana, data_especifica, horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo)
            VALUES (%s, %s, %s, %s::time, %s::time, %s, %s::time, %s::time, %s)
            RETURNING id
            """,
            (tipo, dia_semana, data_especifica, horario_inicio, horario_fim, tem_almoco, almoco_inicio, almoco_fim, ativo),
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify({"success": True, "id": row["id"]}), 201
    except IntegrityError:
        conn.rollback()
        return jsonify({"error": "Já existe configuração para esse dia/data"}), 400
    finally:
        conn.close()


@config_horarios_bp.patch("/api/admin/config-horarios/<int:config_id>")
@admin_required
def atualizar_config_horario(config_id):
    data = request.get_json(silent=True) or {}
    campos = []
    valores = []

    for key in ["tipo", "dia_semana", "data_especifica", "tem_almoco", "ativo"]:
        if key in data:
            campos.append(f"{key} = %s")
            valores.append(data[key])

    for key in ["horario_inicio", "horario_fim", "almoco_inicio", "almoco_fim"]:
        if key in data:
            campos.append(f"{key} = %s::time")
            valores.append(data[key])

    if not campos:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    valores.append(config_id)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE config_horarios SET {', '.join(campos)} WHERE id = %s RETURNING id",
        tuple(valores),
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Configuração não encontrada"}), 404
    return jsonify({"success": True}), 200


@config_horarios_bp.delete("/api/admin/config-horarios/<int:config_id>")
@admin_required
def deletar_config_horario(config_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM config_horarios WHERE id = %s RETURNING id", (config_id,))
    row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        return jsonify({"error": "Configuração não encontrada"}), 404

    return jsonify({"success": True}), 200