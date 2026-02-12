from flask import Blueprint, send_from_directory
import os

static_bp = Blueprint("static", __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

@static_bp.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")
