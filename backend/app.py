from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from database import init_db

from servicos.routes import servicos_bp
from horarios.routes import horarios_bp
from agendamentos.routes import agendamentos_bp
from auth.routes import auth_bp
from config_horarios.routes import config_horarios_bp
from financeiro.routes import financeiro_bp
from clientes.routes import clientes_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        resources={r"/*": {"origins": "https://raissa-nails-design.up.railway.app"}},
        supports_credentials=True,
    )

    with app.app_context():
        init_db()

    @app.get("/health")
    @app.get("/healthcheck")
    def healthcheck():
        return jsonify({"status": "healthy"}), 200

    app.register_blueprint(auth_bp)
    app.register_blueprint(servicos_bp)
    app.register_blueprint(horarios_bp)
    app.register_blueprint(agendamentos_bp)
    app.register_blueprint(config_horarios_bp)
    app.register_blueprint(financeiro_bp)
    app.register_blueprint(clientes_bp)

    return app


app = create_app()