from functools import wraps
from flask import request, jsonify
from database import get_db_connection


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "").strip()

        if not token:
            return jsonify({"error": "Não autorizado"}), 401

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 1
            FROM admin_sessions
            WHERE session_token = %s
              AND expires_at > NOW()
            """,
            (token,),
        )
        valid = cur.fetchone()
        conn.close()

        if not valid:
            return jsonify({"error": "Sessão expirada"}), 401

        return fn(*args, **kwargs)

    return wrapper