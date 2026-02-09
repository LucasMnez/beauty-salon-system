# Raissa Nails Beauty - Sistema de Agendamento

Sistema de agendamento online para salão de beleza com notificações automáticas via WhatsApp.

## 📁 Estrutura do Projeto

```
Agendamento/
├── backend/              # Backend (Python Flask + Node.js)
│   ├── app.py           # API Flask principal
│   ├── whatsapp-bot.js  # Bot WhatsApp (Baileys)
│   ├── requirements.txt # Dependências Python
│   ├── package.json     # Dependências Node.js
│   ├── agendamento.db   # Banco de dados SQLite
│   └── whatsapp_auth/   # Autenticação WhatsApp (gerado automaticamente)
│
├── frontend/            # Frontend (HTML/CSS/JS)
│   ├── index.html       # Página inicial
│   ├── agendamento.html # Página de agendamento
│   ├── admin.html       # Painel administrativo
│   ├── login.html       # Página de login
│   ├── servicos.html    # Página de serviços
│   ├── sobrenos.html    # Sobre nós
│   ├── contato.html     # Contato
│   ├── styles.css       # Estilos globais
│   ├── script.js        # Scripts gerais
│   ├── agendamento.js   # Lógica de agendamento
│   ├── admin.js         # Lógica do admin
│   └── assets/          # Imagens e recursos
│
├── .gitignore          # Arquivos ignorados pelo Git
└── README.md           # Este arquivo
```

## 🚀 Como Executar

### 1. Backend (Flask API)

```bash
cd backend
pip install -r requirements.txt
python3 app.py
```

O servidor Flask iniciará automaticamente na porta 5000 (ou próxima disponível).

### 2. Bot WhatsApp (Node.js)

```bash
cd backend
npm install
npm start
```

O bot WhatsApp iniciará na porta 3001. Acesse `http://localhost:3001/qrcode` para conectar.

### 3. Frontend

O frontend é servido automaticamente pelo Flask. Acesse:
- `http://localhost:5000/` - Página inicial
- `http://localhost:5000/agendamento.html` - Agendar
- `http://localhost:5000/admin.html` - Painel admin

## 🔐 Credenciais Admin

- **Usuário:** ``
- **Senha:** ``

⚠️ **IMPORTANTE:** Altere a senha em produção!

## 📝 Notas

- O banco de dados SQLite é criado automaticamente na primeira execução
- A autenticação do WhatsApp é salva em `backend/whatsapp_auth/`
- O frontend detecta automaticamente a porta do backend

## 🛠️ Desenvolvimento

Para desenvolvimento, recomenda-se usar:
- **Flask:** Modo debug ativado (já configurado)
- **Node.js:** `npm run dev` para auto-reload com nodemon
