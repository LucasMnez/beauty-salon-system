# 🔐 Configurar Credenciais no Railway

## ✅ Deploy Funcionando!

Agora você precisa configurar as variáveis de ambiente (senhas e credenciais) no Railway.

## 🚀 Passo a Passo Rápido

### 1. Gerar Credenciais

Execute no terminal local:

```bash
python3 gerar-credenciais.py
```

O script irá:
- Gerar `FLASK_SECRET_KEY` automaticamente
- Pedir uma senha para o admin
- Gerar o hash da senha
- Mostrar todas as variáveis prontas para copiar

### 2. Configurar no Railway Dashboard

#### Para o Serviço Web (Flask):

1. No Railway Dashboard → Clique no serviço **web**
2. Vá em **Variables** (aba no topo)
3. Clique em **+ New Variable**
4. Adicione cada variável:

```
FLASK_ENV=production
FLASK_SECRET_KEY=<cole-a-chave-gerada>
ADMIN_USERNAME=raissa
ADMIN_PASSWORD_HASH=<cole-o-hash-gerado>
WHATSAPP_BOT_URL=http://localhost:3001
ENVIAR_WHATSAPP_AUTO=true
DB_NAME=agendamento.db
```

**Nota:** A variável `PORT` é definida automaticamente pelo Railway, não precisa adicionar.

#### Para o Serviço Worker (WhatsApp Bot):

1. No Railway Dashboard → Clique no serviço **worker**
2. Vá em **Variables**
3. Clique em **+ New Variable**
4. Adicione:

```
NODE_ENV=production
```

### 3. Gerar Domínio

1. No Railway Dashboard → Clique no serviço **web**
2. Vá em **Settings** → **Networking**
3. Clique em **Generate Domain**
4. Você receberá um domínio como: `seu-projeto.up.railway.app`

### 4. Testar

1. Acesse o domínio gerado
2. Teste fazer login no `/admin.html` ou `/login.html`
3. Use as credenciais que você configurou

## 🔒 Variáveis Obrigatórias

| Variável | Onde Configurar | Como Obter |
|----------|----------------|------------|
| `FLASK_SECRET_KEY` | Web Service → Variables | Execute `python3 gerar-credenciais.py` |
| `ADMIN_PASSWORD_HASH` | Web Service → Variables | Execute `python3 gerar-credenciais.py` |
| `ADMIN_USERNAME` | Web Service → Variables | `raissa` (ou customizar) |
| `FLASK_ENV` | Web Service → Variables | `production` |
| `NODE_ENV` | Worker → Variables | `production` |

## ⚠️ IMPORTANTE

- **Use senha forte** (mínimo 12 caracteres)
- **Altere a senha padrão** (`Raissa123!` é apenas para desenvolvimento)
- **Guarde as credenciais** em local seguro (gerenciador de senhas)
- **NÃO compartilhe** `FLASK_SECRET_KEY` e `ADMIN_PASSWORD_HASH`

## 🆘 Problemas?

### Não consigo fazer login
- Verifique se `ADMIN_PASSWORD_HASH` está correto
- Gere um novo hash com `python3 gerar-credenciais.py`
- Atualize a variável no Railway e faça redeploy

### Site não carrega
- Verifique se o serviço **web** está **ACTIVE**
- Verifique os logs em **Deployments** → **View logs**
- Verifique se o domínio foi gerado corretamente

---

**Pronto!** Após configurar as variáveis, seu sistema estará funcionando completamente.
