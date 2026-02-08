# 🚂 Guia de Deploy no Railway

## ✅ Arquivos Criados/Atualizados

Os seguintes arquivos foram criados/ajustados para o deploy no Railway:

1. **`nixpacks.toml`** - Configuração explícita do build
2. **`railway.json`** - Atualizado para usar nixpacks.toml
3. **`requirements.txt`** (raiz) - Para Railway detectar Python
4. **`package.json`** (raiz) - Para Railway detectar Node.js

## 🚀 Passos para Deploy

### 1. Fazer Commit e Push

```bash
git add .
git commit -m "Configurar deploy para Railway"
git push origin main
```

### 2. No Railway Dashboard

1. **Criar Novo Projeto:**
   - Acesse [railway.app](https://railway.app)
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha o repositório `beauty-salon-system`

2. **Railway detectará automaticamente:**
   - O `Procfile` criará 2 serviços:
     - **web** (Flask backend)
     - **worker** (WhatsApp bot)

3. **Configurar Variáveis de Ambiente - Web Service:**
   No Railway Dashboard → Web Service → Variables:
   
   ```
   FLASK_ENV=production
   PORT=5000
   ADMIN_USERNAME=raissa
   ADMIN_PASSWORD_HASH=<hash-da-senha>
   SECRET_KEY=<chave-gerada>
   WHATSAPP_BOT_URL=http://localhost:3001
   ENVIAR_WHATSAPP_AUTO=true
   DB_NAME=agendamento.db
   ```

4. **Configurar Variáveis de Ambiente - Worker:**
   No Railway Dashboard → Worker → Variables:
   
   ```
   NODE_ENV=production
   ```

5. **Gerar Domínio:**
   - Railway Dashboard → Web Service → Settings → Networking
   - Clique em "Generate Domain"
   - Você receberá um domínio como: `seu-projeto.up.railway.app`

### 3. Verificar Deploy

- [ ] Build completou com sucesso
- [ ] Web service está online
- [ ] Worker está online
- [ ] Site acessível no domínio gerado
- [ ] Logs não mostram erros críticos

## 🔧 Troubleshooting

### Build falha com "Nixpacks was unable to generate a build plan"

**Solução:** Verifique se:
- ✅ `nixpacks.toml` existe na raiz
- ✅ `requirements.txt` existe na raiz
- ✅ `railway.json` referencia `nixpacks.toml`

### Erro "Module not found" durante build

**Solução:** Verifique se todas as dependências estão em:
- `backend/requirements.txt` (Python)
- `backend/package.json` (Node.js)

### Serviço não inicia

**Solução:** Verifique:
- Variável `PORT` está configurada
- `FLASK_ENV=production` está configurado
- Logs do serviço para ver erros específicos

### Worker (WhatsApp bot) não conecta

**Solução:** 
- Verifique logs do worker
- Acesse `/qrcode` no web service para conectar manualmente
- Verifique se `NODE_ENV=production` está configurado

## 📝 Notas Importantes

1. **Banco de Dados:** O SQLite será criado automaticamente. Para persistência, considere usar Railway Volumes.

2. **WhatsApp Auth:** A pasta `whatsapp_auth/` será criada automaticamente. Para persistência, use Railway Volumes.

3. **Logs:** Acesse Railway Dashboard → Service → Logs para ver logs em tempo real.

4. **Redeploy:** Railway faz redeploy automaticamente a cada push no GitHub.

## 🔗 Links Úteis

- [Documentação Railway](https://docs.railway.app)
- [Nixpacks Documentation](https://nixpacks.com)
- [Railway Discord](https://discord.gg/railway)

---

**Pronto para deploy!** Faça commit e push, e o Railway fará o resto automaticamente.
