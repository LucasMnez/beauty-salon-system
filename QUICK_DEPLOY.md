# ⚡ Deploy Rápido

## 🚂 Railway (5 minutos)

```bash
# 1. Faça commit e push
git add .
git commit -m "Deploy"
git push

# 2. Acesse railway.app e conecte seu repositório
# 3. Railway detectará automaticamente o Procfile
# 4. Configure variáveis de ambiente (veja DEPLOY.md)
# 5. Pronto! Deploy automático
```

## 🖥️ VPS (15 minutos)

```bash
# 1. Conecte no VPS
ssh root@seu-ip

# 2. Execute setup
git clone <seu-repo> /tmp/raissa-nails
cd /tmp/raissa-nails
bash deploy/vps-setup.sh

# 3. Clone no diretório da aplicação
sudo -u raissa-app git clone <seu-repo> /var/www/raissa-nails

# 4. Deploy
cd /var/www/raissa-nails
sudo bash deploy/vps-deploy.sh seu-dominio.com
```

**Pronto!** Acesse `http://seu-dominio.com`
