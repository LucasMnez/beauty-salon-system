# 📁 Guia de Reorganização do Projeto

Este guia explica como reorganizar o projeto em `backend/` e `frontend/`.

## ✅ Arquivos .sh Deletados

Todos os arquivos `.sh` da raiz foram removidos:
- limpar-banco.sh
- limpar_agendamentos.sh
- parar-e-aguardar.sh
- corrigir-definitivo.sh
- corrigir-e-reiniciar.sh
- corrigir-linhas.sh
- corrigir-tudo.sh
- fix-bot.sh
- forcar-reinicio.sh
- instalar-bot-completo.sh
- kill_port_5000.sh
- reconectar-whatsapp.sh
- reiniciar-bot.sh
- reiniciar-com-melhorias.sh
- resetar-autenticacao.sh
- start_server.sh
- verificar-logs.sh

## 🔄 Como Reorganizar

### Opção 1: Usar o Script Python (Recomendado)

```bash
cd /var/docker/apps/Agendamento
python3 reorganizar.py
```

### Opção 2: Reorganização Manual

Execute os seguintes comandos no terminal:

```bash
cd /var/docker/apps/Agendamento

# Criar diretórios
mkdir -p backend frontend/assets

# Mover arquivos do backend
mv app.py requirements.txt whatsapp-bot.js package.json package-lock.json testar-whatsapp.js backend/
mv agendamento.db limpar_banco.sql limpar_agendamentos.sql backend/ 2>/dev/null
mv whatsapp_auth backend/ 2>/dev/null

# Mover arquivos do frontend
mv *.html *.css *.js frontend/ 2>/dev/null
mv assets frontend/ 2>/dev/null
```

## 📝 Arquivos Atualizados

O arquivo `app.py` já foi atualizado para:
- Servir arquivos estáticos do `frontend/`
- Usar caminho relativo para o banco de dados (`backend/agendamento.db`)

## ⚠️ Importante

Após reorganizar, você precisará:

1. **Executar o backend a partir da pasta backend:**
   ```bash
   cd backend
   python3 app.py
   ```

2. **Executar o bot WhatsApp a partir da pasta backend:**
   ```bash
   cd backend
   npm start
   ```

3. **Atualizar caminhos nos arquivos HTML** (se necessário):
   - Os caminhos para CSS/JS devem continuar funcionando se o Flask estiver configurado corretamente

## 🎯 Estrutura Final

```
Agendamento/
├── backend/
│   ├── app.py
│   ├── whatsapp-bot.js
│   ├── requirements.txt
│   ├── package.json
│   ├── agendamento.db
│   └── whatsapp_auth/
│
├── frontend/
│   ├── *.html
│   ├── *.css
│   ├── *.js
│   └── assets/
│
├── README.md
└── REORGANIZAR.md
```
