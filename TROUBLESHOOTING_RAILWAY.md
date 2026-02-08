# 🔧 Troubleshooting - Railway Deploy

## Problemas Comuns e Soluções

### 1. Ambos os serviços estão "Crashed"

#### Verificar logs do Railway:
1. No dashboard do Railway, clique em cada serviço (`web` e `worker`)
2. Vá na aba **"Logs"** ou **"Deployments"**
3. Procure por erros específicos

#### Possíveis causas:

**A) Erro no serviço `web` (Python/Flask):**
- ❌ `python3: command not found` → Railway não detectou Python
- ❌ `ModuleNotFoundError` → Dependências não instaladas
- ❌ `Port already in use` → Conflito de porta

**B) Erro no serviço `worker` (Node.js):**
- ❌ `node: command not found` → Railway não detectou Node.js
- ❌ `Cannot find module` → Dependências não instaladas
- ❌ `SyntaxError` → Erro no código JavaScript

### 2. Verificações Necessárias

#### ✅ Arquivos na raiz do projeto:
- [ ] `requirements.txt` (sem comentários, apenas dependências)
- [ ] `runtime.txt` (com `python-3.11.0`)
- [ ] `package.json` (com `engines.node >= 20.0.0`)
- [ ] `.nvmrc` (com `20`)
- [ ] `Procfile` (com comandos corretos)
- [ ] `railway.json` (configuração opcional)

#### ✅ Variáveis de ambiente no Railway:
- [ ] `FLASK_ENV=production`
- [ ] `PORT=5000` (ou deixar Railway definir automaticamente)
- [ ] `ADMIN_USERNAME=raissa`
- [ ] `ADMIN_PASSWORD_HASH=<hash gerada>`
- [ ] `FLASK_SECRET_KEY=<chave secreta>`
- [ ] `DB_NAME=agendamento.db`
- [ ] `WHATSAPP_BOT_URL=http://localhost:3001`
- [ ] `ENVIAR_WHATSAPP_AUTO=true`

### 3. Soluções Rápidas

#### Se o `web` está falhando:

1. **Verificar se Python está sendo detectado:**
   - O `requirements.txt` deve estar na raiz
   - O `runtime.txt` deve conter `python-3.11.0`

2. **Verificar dependências:**
   ```bash
   # Localmente, testar se instala:
   pip install -r requirements.txt
   ```

3. **Verificar se o app.py inicia:**
   ```bash
   cd backend && python3 app.py
   ```

#### Se o `worker` está falhando:

1. **Verificar se Node.js está sendo detectado:**
   - O `package.json` deve estar na raiz com `engines.node >= 20.0.0`
   - O `.nvmrc` deve conter `20`

2. **Verificar dependências:**
   ```bash
   # Localmente, testar se instala:
   cd backend && npm install
   ```

3. **Verificar se o bot inicia:**
   ```bash
   cd backend && node whatsapp-bot.js
   ```

### 4. Comandos de Debug

#### No Railway Dashboard:
1. Vá em **Settings** → **Service**
2. Verifique o **Start Command**:
   - `web`: `cd backend && python3 app.py`
   - `worker`: `cd backend && node whatsapp-bot.js`

3. Verifique os **Build Logs** para ver se:
   - Python foi instalado corretamente
   - Node.js foi instalado corretamente
   - Dependências foram instaladas

### 5. Solução de Emergência

Se nada funcionar, tente:

1. **Deletar e recriar os serviços no Railway**
2. **Verificar se o repositório está atualizado:**
   ```bash
   git status
   git add .
   git commit -m "Fix Railway deploy configuration"
   git push origin main
   ```

3. **Verificar se os arquivos estão na raiz:**
   - `requirements.txt` ✅
   - `runtime.txt` ✅
   - `package.json` ✅
   - `.nvmrc` ✅
   - `Procfile` ✅

### 6. Próximos Passos

1. **Copie os logs de erro completos** do Railway
2. **Verifique qual serviço falha primeiro** (web ou worker)
3. **Compartilhe os logs** para diagnóstico mais preciso
