# ✅ Checklist de Implantação - Raissa Nails Beauty

Use este checklist para garantir que todos os passos sejam seguidos corretamente durante a implantação em produção.

---

## 📋 FASE 1: Pré-requisitos e Preparação

### Verificação de Arquivos
- [ ] Verificar que `Procfile` existe na raiz do projeto
- [ ] Verificar que `runtime.txt` existe na raiz do projeto
- [ ] Verificar que `railway.json` existe (para Railway)
- [ ] Verificar que `render.yaml` existe (para Render)
- [ ] Verificar que `deploy/vps-setup.sh` existe
- [ ] Verificar que `deploy/vps-deploy.sh` existe
- [ ] Verificar que `backend/requirements.txt` existe e está atualizado
- [ ] Verificar que `backend/package.json` existe e está atualizado
- [ ] Verificar que `backend/app.py` está configurado para produção

### Preparação do Repositório Git
- [ ] Todos os arquivos estão commitados localmente
- [ ] Repositório está sincronizado com GitHub/GitLab
- [ ] Branch principal (`main` ou `master`) está atualizada
- [ ] Não há arquivos sensíveis no repositório (`.env`, senhas, etc.)

### Geração de Credenciais
- [ ] **Gerar hash da senha do admin:**
  ```python
  import hashlib
  senha = "SuaSenhaForte123!"
  salt = "raissa_nails_salt_2024"
  hash_senha = hashlib.sha256((senha + salt).encode()).hexdigest()
  print(f"ADMIN_PASSWORD_HASH={hash_senha}")
  ```
  **Anotar o hash gerado:** `_________________________`

- [ ] **Gerar SECRET_KEY:**
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
  **Anotar a chave gerada:** `_________________________`

- [ ] **Preparar informações do domínio:**
  - Domínio escolhido: `_________________________`
  - Email para SSL: `_________________________`

---

## 🎯 FASE 2: Escolha da Plataforma

Escolha uma das opções abaixo:

### Opção A: Railway (Recomendado - Mais Simples)
- [ ] Escolhido Railway
- [ ] Conta criada em [railway.app](https://railway.app)
- [ ] Login realizado com GitHub

### Opção B: VPS (Mais Controle)
- [ ] Escolhido VPS
- [ ] VPS criado (DigitalOcean/Vultr/Contabo)
- [ ] IP do VPS: `_________________________`
- [ ] Acesso SSH configurado
- [ ] Domínio DNS configurado apontando para o VPS

---

## 🚂 FASE 3: Deploy no Railway (Se escolhido)

### Passo 1: Conectar Repositório
- [ ] Acessar Railway Dashboard
- [ ] Clicar em "New Project"
- [ ] Selecionar "Deploy from GitHub repo"
- [ ] Escolher o repositório correto
- [ ] Railway detectou automaticamente o `Procfile`

### Passo 2: Configurar Serviços
- [ ] Verificar que foram criados 2 serviços:
  - [ ] **Web Service** (Flask backend)
  - [ ] **Worker** (WhatsApp bot)

### Passo 3: Configurar Variáveis de Ambiente - Web Service
No Railway Dashboard → Web Service → Variables, adicionar:

- [ ] `FLASK_ENV=production`
- [ ] `PORT=5000`
- [ ] `ADMIN_USERNAME=raissa`
- [ ] `ADMIN_PASSWORD_HASH=<hash-gerado-na-fase-1>`
- [ ] `SECRET_KEY=<chave-gerada-na-fase-1>`
- [ ] `WHATSAPP_BOT_URL=http://localhost:3001`
- [ ] `ENVIAR_WHATSAPP_AUTO=true`
- [ ] `DB_NAME=agendamento.db`

### Passo 4: Configurar Variáveis de Ambiente - Worker
No Railway Dashboard → Worker → Variables, adicionar:

- [ ] `NODE_ENV=production`

### Passo 5: Configurar Domínio
- [ ] No Railway Dashboard → Web Service → Settings → Networking
- [ ] Clicar em "Generate Domain" OU
- [ ] Configurar domínio customizado:
  - [ ] Adicionar domínio customizado
  - [ ] Configurar DNS apontando para Railway
  - [ ] Aguardar propagação DNS (pode levar até 24h)

### Passo 6: Validar Deploy
- [ ] Verificar logs do Web Service (deve mostrar "Servidor iniciando")
- [ ] Verificar logs do Worker (deve mostrar inicialização do bot)
- [ ] Acessar `https://seu-dominio.railway.app` ou domínio customizado
- [ ] Site carrega corretamente
- [ ] Pular para FASE 5

---

## 🖥️ FASE 4: Deploy em VPS (Se escolhido)

### Passo 1: Conectar ao VPS
- [ ] Conectar via SSH:
  ```bash
  ssh root@seu-ip-vps
  ```

### Passo 2: Executar Setup Inicial
- [ ] Baixar repositório temporariamente:
  ```bash
  git clone <seu-repositorio> /tmp/raissa-nails
  cd /tmp/raissa-nails
  ```

- [ ] Executar script de setup:
  ```bash
  sudo bash deploy/vps-setup.sh
  ```
  
- [ ] Verificar instalações:
  - [ ] Python 3.8+ instalado: `python3 --version`
  - [ ] Node.js 18+ instalado: `node --version`
  - [ ] PM2 instalado: `pm2 --version`
  - [ ] Nginx instalado: `nginx -v`

### Passo 3: Clonar Repositório no Diretório da Aplicação
- [ ] Clonar repositório:
  ```bash
  sudo -u raissa-app git clone <seu-repositorio> /var/www/raissa-nails
  ```

### Passo 4: Executar Deploy
- [ ] Executar script de deploy:
  ```bash
  cd /var/www/raissa-nails
  sudo bash deploy/vps-deploy.sh seu-dominio.com
  ```
  
  **Substituir `seu-dominio.com` pelo domínio real!**

- [ ] Verificar que o script executou sem erros
- [ ] Verificar status dos serviços:
  ```bash
  pm2 status
  ```
  
  Deve mostrar:
  - [ ] `raissa-nails-backend` (status: online)
  - [ ] `raissa-nails-whatsapp` (status: online)

### Passo 5: Configurar DNS
- [ ] No painel do seu provedor de domínio, configurar:
  - [ ] **Tipo A**: `@` → IP do VPS
  - [ ] **Tipo A**: `www` → IP do VPS
- [ ] Aguardar propagação DNS (pode levar até 24h)
- [ ] Verificar DNS:
  ```bash
  dig seu-dominio.com
  nslookup seu-dominio.com
  ```

### Passo 6: Configurar SSL
- [ ] Verificar se SSL foi configurado automaticamente pelo script
- [ ] Se não foi configurado, executar manualmente:
  ```bash
  sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
  ```
- [ ] Verificar certificado:
  ```bash
  sudo certbot certificates
  ```
- [ ] Testar SSL: Acessar `https://seu-dominio.com`

### Passo 7: Validar Deploy
- [ ] Verificar logs do Flask:
  ```bash
  pm2 logs raissa-nails-backend --lines 50
  ```
- [ ] Verificar logs do WhatsApp bot:
  ```bash
  pm2 logs raissa-nails-whatsapp --lines 50
  ```
- [ ] Verificar Nginx:
  ```bash
  sudo nginx -t
  sudo systemctl status nginx
  ```
- [ ] Acessar `http://seu-dominio.com` (deve redirecionar para HTTPS)
- [ ] Site carrega corretamente

---

## ⚙️ FASE 5: Configuração Pós-Deploy

### Teste de Acesso ao Site
- [ ] Acessar página inicial (`/`)
- [ ] Acessar página de serviços (`/servicos.html`)
- [ ] Acessar página de agendamento (`/agendamento.html`)
- [ ] Verificar que o card "Precisa de Ajuda?" aparece
- [ ] Verificar que "Próximos Horários Disponíveis" carrega
- [ ] Verificar que serviços são exibidos corretamente

### Teste de Login Admin
- [ ] Acessar `/admin.html` ou `/login.html`
- [ ] Tentar login com credenciais padrão:
  - Usuário: `raissa`
  - Senha: `Raissa123!`
- [ ] Login funciona corretamente
- [ ] Painel admin carrega
- [ ] Lista de agendamentos aparece

### Conectar WhatsApp Bot
- [ ] Acessar `/qrcode` (se disponível) OU
- [ ] Verificar logs do worker/bot:
  ```bash
  # Railway: Ver logs no dashboard
  # VPS: pm2 logs raissa-nails-whatsapp
  ```
- [ ] Procurar por QR Code nos logs OU
- [ ] Verificar se bot já está conectado (sem necessidade de QR)
- [ ] Escanear QR Code com WhatsApp (se necessário)
- [ ] Bot conectado e pronto

### Configurar Serviços e Horários
- [ ] Fazer login no admin
- [ ] Acessar página de configurações (`/config.html`)
- [ ] **Aba Serviços:**
  - [ ] Verificar serviços padrão estão cadastrados
  - [ ] Adicionar/editar serviços conforme necessário
  - [ ] Verificar valores e durações estão corretos
- [ ] **Aba Horários:**
  - [ ] Configurar horários padrão por dia da semana
  - [ ] Configurar horário de almoço
  - [ ] Configurar dias de funcionamento
  - [ ] Testar salvamento de configurações

### Teste de Agendamento Completo
- [ ] Acessar página de agendamento como cliente
- [ ] Selecionar um serviço
- [ ] Selecionar uma data disponível
- [ ] Selecionar um horário disponível
- [ ] Preencher formulário com dados de teste
- [ ] Criar agendamento
- [ ] Verificar mensagem de sucesso
- [ ] Verificar agendamento aparece no admin
- [ ] Verificar notificação WhatsApp foi enviada (se configurado)

---

## 🔐 FASE 6: Segurança

### Alterar Senha Padrão do Admin
- [ ] Gerar novo hash de senha forte:
  ```python
  import hashlib
  nova_senha = "SuaNovaSenhaMuitoForte123!"
  salt = "raissa_nails_salt_2024"
  hash_senha = hashlib.sha256((nova_senha + salt).encode()).hexdigest()
  print(hash_senha)
  ```
  
- [ ] **Railway:** Atualizar variável `ADMIN_PASSWORD_HASH` no dashboard
- [ ] **VPS:** Editar arquivo `.env`:
  ```bash
  sudo nano /var/www/raissa-nails/backend/.env
  # Atualizar ADMIN_PASSWORD_HASH
  ```
  
- [ ] Reiniciar serviços:
  - **Railway:** Redeploy ou restart do serviço
  - **VPS:** `pm2 restart raissa-nails-backend`
  
- [ ] Testar login com nova senha
- [ ] Confirmar que senha antiga não funciona mais

### Configurar SECRET_KEY
- [ ] Verificar que `SECRET_KEY` está configurada (gerada na Fase 1)
- [ ] **Railway:** Verificar variável `SECRET_KEY` no dashboard
- [ ] **VPS:** Verificar no arquivo `.env`:
  ```bash
  sudo cat /var/www/raissa-nails/backend/.env | grep SECRET_KEY
  ```

### Verificar SSL/HTTPS
- [ ] Site redireciona HTTP para HTTPS automaticamente
- [ ] Certificado SSL válido (cadeado verde no navegador)
- [ ] Sem avisos de certificado inválido
- [ ] Testar em diferentes navegadores:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Mobile

### Configurar Firewall (VPS apenas)
- [ ] Verificar firewall está ativo:
  ```bash
  sudo ufw status
  ```
- [ ] Verificar regras:
  - [ ] Porta 22 (SSH) aberta
  - [ ] Porta 80 (HTTP) aberta
  - [ ] Porta 443 (HTTPS) aberta
  - [ ] Outras portas fechadas
- [ ] Testar acesso bloqueado em portas não autorizadas

### Outras Configurações de Segurança
- [ ] Verificar que arquivos `.env` não estão no repositório Git
- [ ] Verificar que senhas não estão hardcoded no código
- [ ] Verificar que logs não expõem informações sensíveis
- [ ] Configurar backup automático do banco de dados (próxima fase)

---

## ✅ FASE 7: Validação Final

### Teste de Todas as Funcionalidades

#### Funcionalidades do Cliente
- [ ] Visualizar serviços na página inicial
- [ ] Visualizar "Próximos Horários Disponíveis"
- [ ] Selecionar múltiplos serviços
- [ ] Visualizar calendário de 14 dias
- [ ] Selecionar data disponível
- [ ] Visualizar horários disponíveis para a data
- [ ] Criar agendamento completo
- [ ] Ver mensagem de sucesso após agendamento
- [ ] Card "Precisa de Ajuda?" funciona (link WhatsApp)

#### Funcionalidades do Admin
- [ ] Login funciona
- [ ] Visualizar lista de agendamentos
- [ ] Filtrar agendamentos (data, status, cliente)
- [ ] Criar novo agendamento manualmente
- [ ] Editar agendamento existente
- [ ] Deletar agendamento
- [ ] Alterar status de agendamento
- [ ] Visualizar página financeiro
- [ ] Filtrar dados financeiros
- [ ] Configurar serviços (CRUD)
- [ ] Configurar horários de funcionamento
- [ ] Bloquear/desbloquear dias específicos

#### Funcionalidades do WhatsApp Bot
- [ ] Bot está conectado
- [ ] Notificação é enviada quando agendamento é criado
- [ ] Mensagem contém informações corretas:
  - [ ] Nome do cliente
  - [ ] Data do agendamento
  - [ ] Horário do agendamento
  - [ ] Serviços selecionados
  - [ ] Valor total

### Verificação de Logs
- [ ] **Railway:**
  - [ ] Verificar logs do Web Service (sem erros críticos)
  - [ ] Verificar logs do Worker (bot conectado)
  
- [ ] **VPS:**
  ```bash
  pm2 logs raissa-nails-backend --lines 100
  pm2 logs raissa-nails-whatsapp --lines 100
  ```
  - [ ] Sem erros críticos nos logs
  - [ ] Banco de dados inicializado corretamente
  - [ ] Serviços carregados corretamente

### Configurar Backup do Banco de Dados

#### Railway
- [ ] Configurar backup automático usando Railway Volumes:
  - [ ] Criar Volume para persistência do banco
  - [ ] Montar volume no serviço Web
  - [ ] Configurar variável `DB_NAME` apontando para volume
  
- [ ] OU configurar backup manual periódico:
  - [ ] Criar script de backup
  - [ ] Agendar execução (cron job ou Railway cron)

#### VPS
- [ ] Criar script de backup:
  ```bash
  sudo nano /var/www/raissa-nails/backup-db.sh
  ```
  
  Conteúdo:
  ```bash
  #!/bin/bash
  BACKUP_DIR="/var/backups/raissa-nails"
  DB_PATH="/var/www/raissa-nails/backend/agendamento.db"
  DATE=$(date +%Y%m%d_%H%M%S)
  
  mkdir -p $BACKUP_DIR
  cp $DB_PATH "$BACKUP_DIR/agendamento_$DATE.db"
  
  # Manter apenas últimos 30 backups
  ls -t $BACKUP_DIR/agendamento_*.db | tail -n +31 | xargs rm -f
  ```
  
- [ ] Tornar executável:
  ```bash
  sudo chmod +x /var/www/raissa-nails/backup-db.sh
  ```
  
- [ ] Agendar backup diário:
  ```bash
  sudo crontab -e
  # Adicionar linha:
  # 0 2 * * * /var/www/raissa-nails/backup-db.sh
  ```

- [ ] Testar backup manualmente:
  ```bash
  sudo bash /var/www/raissa-nails/backup-db.sh
  ls -lh /var/backups/raissa-nails/
  ```

### Documentar Credenciais

**⚠️ IMPORTANTE: Armazenar em local seguro (gerenciador de senhas)**

- [ ] **Credenciais de Acesso:**
  - [ ] URL do site: `_________________________`
  - [ ] Usuário admin: `_________________________`
  - [ ] Senha admin: `_________________________`
  - [ ] Hash da senha: `_________________________`

- [ ] **Credenciais de Infraestrutura:**
  - [ ] **Railway:**
    - [ ] Email da conta: `_________________________`
    - [ ] Link do projeto: `_________________________`
  - [ ] **VPS:**
    - [ ] IP do servidor: `_________________________`
    - [ ] Usuário SSH: `_________________________`
    - [ ] Porta SSH: `_________________________`
    - [ ] Chave SSH (localização): `_________________________`

- [ ] **Variáveis de Ambiente Importantes:**
  - [ ] SECRET_KEY: `_________________________`
  - [ ] ADMIN_PASSWORD_HASH: `_________________________`
  - [ ] WHATSAPP_BOT_URL: `_________________________`

- [ ] **Informações do Domínio:**
  - [ ] Domínio: `_________________________`
  - [ ] Provedor DNS: `_________________________`
  - [ ] Email para SSL: `_________________________`

- [ ] **Informações do Banco de Dados:**
  - [ ] Localização do banco: `_________________________`
  - [ ] Último backup: `_________________________`

---

## 🎉 FASE 8: Finalização

### Checklist Final
- [ ] Todos os testes passaram
- [ ] Site está acessível publicamente
- [ ] SSL/HTTPS funcionando
- [ ] Admin protegido com senha forte
- [ ] WhatsApp bot conectado
- [ ] Backup configurado
- [ ] Credenciais documentadas e seguras
- [ ] Logs monitorados e sem erros críticos

### Próximos Passos Recomendados
- [ ] Adicionar monitoramento (UptimeRobot, Pingdom, etc.)
- [ ] Configurar alertas de downtime
- [ ] Documentar procedimentos de manutenção
- [ ] Treinar usuários no uso do sistema
- [ ] Configurar analytics (Google Analytics, etc.)
- [ ] Otimizar SEO das páginas

---

## 📞 Suporte e Troubleshooting

### Problemas Comuns

**Site não carrega:**
- Verificar logs do serviço
- Verificar DNS está correto
- Verificar firewall permite tráfego
- Verificar serviços estão rodando

**WhatsApp bot não conecta:**
- Verificar logs do worker/bot
- Verificar se worker está rodando
- Tentar reconectar manualmente via `/qrcode`

**Erro 500 no site:**
- Verificar logs do backend
- Verificar banco de dados está acessível
- Verificar variáveis de ambiente estão corretas

**SSL não funciona:**
- Verificar DNS está propagado
- Verificar certificado foi gerado
- Tentar renovar certificado manualmente

### Links Úteis
- [Documentação Railway](https://docs.railway.app)
- [Documentação PM2](https://pm2.keymetrics.io/docs/)
- [Documentação Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)

---

**✅ Checklist concluído em:** `____/____/________`

**Assinatura:** `_________________________`

---

**IMPORTANTE:** Mantenha este checklist atualizado e revisado periodicamente para garantir que todas as configurações estão corretas e seguras.
