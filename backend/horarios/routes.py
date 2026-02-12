from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from .logic import calcular_horarios

horarios_bp = Blueprint("horarios", __name__)


@horarios_bp.get("/api/horarios-disponiveis")
def horarios_disponiveis():
    data = request.args.get("data")
    if not data:
        return jsonify({"error": "Data é obrigatória"}), 400

    servicos_param = request.args.get("servicos", "")
    servicos = [s.strip() for s in servicos_param.split(",") if s.strip()]
    return jsonify(calcular_horarios(data, servicos)), 200


@horarios_bp.get("/api/disponibilidade-mes")
def disponibilidade_mes():
    mes = request.args.get("mes")
    ano = request.args.get("ano")

    if not mes or not ano:
        return jsonify({"error": "mes e ano são obrigatórios"}), 400

    mes_i = int(mes)
    ano_i = int(ano)

    atual = datetime(ano_i, mes_i, 1)
    fim = datetime(ano_i + (1 if mes_i == 12 else 0), 1 if mes_i == 12 else mes_i + 1, 1)

    disponibilidade = {}
    while atual < fim:
        ds = atual.strftime("%Y-%m-%d")
        disponibilidade[ds] = calcular_horarios(ds, [])["horarios"]
        atual += timedelta(days=1)

    return jsonify({"disponibilidade": disponibilidade}), 200