import os
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

from database import get_db_connection
from utils.security import check_password, hash_password

auth_bp = Blueprint("auth", __name__)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "raissa")
# Em produção, defina ADMIN_PASSWORD_HASH no Railway.
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", hash_password("Raissa123!"))


@auth_bp.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Usuário e senha são obrigatórios"}), 400

    if username.lower() != ADMIN_USERNAME.lower() or not check_password(password, ADMIN_PASSWORD_HASH):
        return jsonify({"error": "Credenciais inválidas"}), 401

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=8)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO admin_sessions (session_token, username, expires_at)
        VALUES (%s, %s, %s)
        """,
        (token, username, expires_at),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "token": token, "expires_in": 28800}), 200


@auth_bp.get("/api/admin/verify")
def admin_verify():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()

    if not token:
        return jsonify({"authenticated": False}), 401

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT username
        FROM admin_sessions
        WHERE session_token = %s
          AND expires_at > NOW()
        """,
        (token,),
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"authenticated": False}), 401

    return jsonify({"authenticated": True, "username": row["username"]}), 200


@auth_bp.post("/api/admin/logout")
def admin_logout():
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()

    if token:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM admin_sessions WHERE session_token = %s", (token,))
        conn.commit()
        conn.close()

    return jsonify({"success": True}), 200