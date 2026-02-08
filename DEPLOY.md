# 🚀 Guia de Deploy - Raissa Nails Beauty

Este guia explica como fazer deploy da aplicação em produção usando Railway ou VPS.

## 📋 Pré-requisitos

- Conta no GitHub (para Railway) ou acesso SSH a um VPS
- Domínio configurado (opcional, mas recomendado)
- Python 3.8+ e Node.js 18+ (para VPS)

---

## 🚂 Opção 1: Deploy no Railway (Recomendado - Mais Simples)

Railway é a opção mais simples e rápida para deploy. Oferece plano gratuito com créditos mensais.

### Passo 1: Preparar o Repositório

1. Certifique-se de que todos os arquivos estão commitados:
```bash
git add .
git commit -m "Preparar para deploy"
git push origin main
```

### Passo 2: Criar Conta no Railway

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha seu repositório

### Passo 3: Configurar Serviços

Railway detectará automaticamente o `Procfile` e criará dois serviços:
- **Web Service** (Flask backend)
- **Worker** (WhatsApp bot)

### Passo 4: Configurar Variáveis de Ambiente

No Railway Dashboard, vá em **Variables** e adicione:

```env
FLASK_ENV=production
PORT=5000
ADMIN_USERNAME=raissa
ADMIN_PASSWORD_HASH=<hash-da-senha>
WHATSAPP_BOT_URL=http://localhost:3001
ENVIAR_WHATSAPP_AUTO=true
```

**Para gerar o hash da senha:**
```python
import hashlib
senha = "Raissa123!"
salt = "raissa_nails_salt_2024"
hash_senha = hashlib.sha256((senha + salt).encode()).hexdigest()
print(hash_senha)
```

### Passo 5: Configurar Domínio (Opcional)

1. No Railway Dashboard, vá em **Settings** → **Networking**
2. Clique em **Generate Domain** para obter um domínio gratuito
3. Ou configure um domínio customizado apontando para o Railway

### Passo 6: Deploy Automático

Railway fará deploy automaticamente a cada push no GitHub!

---

## 🖥️ Opção 2: Deploy em VPS (Mais Controle)

Para VPS, recomendamos DigitalOcean, Vultr, ou Contabo ($4-6/mês).

### Passo 1: Configurar VPS

1. Crie uma VPS Ubuntu 22.04 LTS
2. Conecte via SSH:
```bash
ssh root@seu-ip
```

### Passo 2: Executar Setup Inicial

```bash
# Baixar scripts de deploy
git clone <seu-repositorio> /tmp/raissa-nails
cd /tmp/raissa-nails

# Executar setup inicial
sudo bash deploy/vps-setup.sh
```

Este script irá:
- Instalar Python, Node.js, Nginx, PM2
- Configurar firewall
- Criar usuário da aplicação

### Passo 3: Fazer Deploy

```bash
# Clonar repositório no diretório da aplicação
sudo -u raissa-app git clone <seu-repositorio> /var/www/raissa-nails

# Executar deploy
sudo bash deploy/vps-deploy.sh seu-dominio.com
```

**Substitua `seu-dominio.com` pelo seu domínio real!**

### Passo 4: Configurar DNS

Configure os registros DNS do seu domínio:
- **Tipo A**: `@` → IP do VPS
- **Tipo A**: `www` → IP do VPS

### Passo 5: Verificar SSL

O script configurará SSL automaticamente com Let's Encrypt. Se não funcionar:

```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

---

## 🔧 Gerenciamento Pós-Deploy

### Railway

- **Logs**: Railway Dashboard → Service → Logs
- **Reiniciar**: Railway Dashboard → Service → Restart
- **Variáveis**: Railway Dashboard → Variables

### VPS

**Verificar status:**
```bash
pm2 status
pm2 logs raissa-nails-backend
pm2 logs raissa-nails-whatsapp
```

**Reiniciar serviços:**
```bash
pm2 restart all
```

**Atualizar código:**
```bash
cd /var/www/raissa-nails
sudo -u raissa-app git pull
sudo bash deploy/vps-deploy.sh seu-dominio.com
```

**Reiniciar Nginx:**
```bash
sudo systemctl reload nginx
```

---

## 🔐 Segurança

### ⚠️ IMPORTANTE: Alterar Senha Padrão

Após o primeiro deploy, **ALTERE A SENHA DO ADMIN**:

1. Acesse `/admin.html`
2. Faça login com credenciais padrão
3. Gere um novo hash de senha:
```python
import hashlib
nova_senha = "SuaNovaSenhaForte123!"
salt = "raissa_nails_salt_2024"
hash_senha = hashlib.sha256((nova_senha + salt).encode()).hexdigest()
print(hash_senha)
```
4. Atualize a variável `ADMIN_PASSWORD_HASH` no Railway/VPS

### Configurar SECRET_KEY

Gere uma chave secreta forte:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Adicione como variável `SECRET_KEY` no Railway/VPS.

---

## 🐛 Troubleshooting

### Railway

**Problema: Deploy falha**
- Verifique os logs no Railway Dashboard
- Certifique-se de que `requirements.txt` está correto
- Verifique se todas as variáveis de ambiente estão configuradas

**Problema: WhatsApp bot não conecta**
- Verifique se o worker está rodando
- Acesse `/qrcode` para conectar manualmente
- Verifique logs do worker

### VPS

**Problema: Site não carrega**
```bash
# Verificar se Flask está rodando
pm2 status

# Verificar logs
pm2 logs raissa-nails-backend

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

**Problema: SSL não funciona**
```bash
# Renovar certificado
sudo certbot renew

# Verificar certificado
sudo certbot certificates
```

**Problema: Porta 5000 já em uso**
```bash
# Verificar processos
sudo lsof -i :5000

# Matar processo
sudo kill -9 <PID>
```

---

## 📊 Monitoramento

### Railway
- Use o dashboard do Railway para monitorar uso de recursos
- Configure alertas para falhas de deploy

### VPS
```bash
# Monitorar recursos
htop

# Ver uso de disco
df -h

# Ver logs em tempo real
pm2 monit
```

---

## 💰 Custos Estimados

- **Railway**: $5/mês (ou créditos gratuitos)
- **VPS**: $4-6/mês (DigitalOcean/Vultr)
- **Domínio**: $10-15/ano (opcional)

---

## 📚 Recursos Adicionais

- [Documentação Railway](https://docs.railway.app)
- [Documentação PM2](https://pm2.keymetrics.io/docs/)
- [Documentação Nginx](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)

---

## ✅ Checklist Pós-Deploy

- [ ] Site acessível via domínio
- [ ] SSL configurado (HTTPS)
- [ ] Admin login funcionando
- [ ] WhatsApp bot conectado
- [ ] Senha padrão alterada
- [ ] Backup do banco de dados configurado
- [ ] Monitoramento configurado

---

**Dúvidas?** Abra uma issue no repositório ou consulte a documentação acima.
