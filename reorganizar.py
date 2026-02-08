#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para reorganizar o projeto em backend/ e frontend/
"""

import os
import shutil
from pathlib import Path

# Diretórios
BASE_DIR = Path('.')
BACKEND_DIR = BASE_DIR / 'backend'
FRONTEND_DIR = BASE_DIR / 'frontend'

# Criar diretórios
BACKEND_DIR.mkdir(exist_ok=True)
FRONTEND_DIR.mkdir(exist_ok=True)
(FRONTEND_DIR / 'assets').mkdir(exist_ok=True)

# Arquivos para backend
BACKEND_FILES = [
    'app.py',
    'requirements.txt',
    'whatsapp-bot.js',
    'package.json',
    'package-lock.json',
    'testar-whatsapp.js',
    'agendamento.db',
    'limpar_banco.sql',
    'limpar_agendamentos.sql'
]

# Arquivos para frontend
FRONTEND_FILES = [
    'index.html',
    'agendamento.html',
    'admin.html',
    'login.html',
    'servicos.html',
    'sobrenos.html',
    'contato.html',
    'styles.css',
    'script.js',
    'agendamento.js',
    'admin.js'
]

# Pastas para mover
BACKEND_FOLDERS = ['whatsapp_auth']
FRONTEND_FOLDERS = ['assets']

print("🔄 Reorganizando projeto...")

# Mover arquivos do backend
for file in BACKEND_FILES:
    src = BASE_DIR / file
    if src.exists():
        dst = BACKEND_DIR / file
        print(f"  📦 {file} → backend/")
        shutil.move(str(src), str(dst))

# Mover arquivos do frontend
for file in FRONTEND_FILES:
    src = BASE_DIR / file
    if src.exists():
        dst = FRONTEND_DIR / file
        print(f"  📄 {file} → frontend/")
        shutil.move(str(src), str(dst))

# Mover pastas do backend
for folder in BACKEND_FOLDERS:
    src = BASE_DIR / folder
    if src.exists() and src.is_dir():
        dst = BACKEND_DIR / folder
        print(f"  📁 {folder}/ → backend/")
        shutil.move(str(src), str(dst))

# Mover pastas do frontend
for folder in FRONTEND_FOLDERS:
    src = BASE_DIR / folder
    if src.exists() and src.is_dir():
        dst = FRONTEND_DIR / folder
        print(f"  📁 {folder}/ → frontend/")
        if dst.exists():
            # Se já existe, mover conteúdo
            for item in src.iterdir():
                shutil.move(str(item), str(dst / item.name))
            src.rmdir()
        else:
            shutil.move(str(src), str(dst))

print("\n✅ Reorganização concluída!")
print("\n📁 Estrutura criada:")
print("   backend/")
print("   frontend/")
