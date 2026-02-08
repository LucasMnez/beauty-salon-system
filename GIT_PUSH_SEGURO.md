# 🔒 Guia para Push Seguro no GitHub

## ✅ Verificações Antes do Push

### 1. Verificar arquivos que serão enviados

```bash
# Ver arquivos no staging
git status

# Verificar se há arquivos sensíveis
bash verificar-seguranca.sh
```

### 2. Garantir que arquivos sensíveis estão ignorados

O `.gitignore` já está configurado para ignorar:
- ✅ Arquivos `.env` e variáveis de ambiente
- ✅ Bancos de dados `.db`, `.sqlite`
- ✅ Pasta `whatsapp_auth/` (credenciais WhatsApp)
- ✅ Arquivos de chaves `.key`, `.pem`
- ✅ Logs que podem conter informações sensíveis
- ✅ Backups e arquivos temporários

### 3. Remover arquivos sensíveis do staging (se necessário)

Se algum arquivo sensível aparecer no `git status`:

```bash
# Remover do staging (mas manter no disco local)
git reset HEAD backend/agendamento.db
git reset HEAD .env
git reset HEAD backend/whatsapp_auth/

# Verificar novamente
git status
```

## 🚀 Fazer Push com Segurança

### Opção 1: Usando Personal Access Token (Recomendado)

1. **Criar token no GitHub:**
   - Acesse: https://github.com/settings/tokens
   - Clique em "Generate new token (classic)"
   - Nome: `beauty-salon-system`
   - Escopo: `repo` (marcar tudo)
   - Clique em "Generate token"
   - **COPIE O TOKEN** (não será mostrado novamente)

2. **Fazer push:**
```bash
git add .
git commit -m "Initial commit: Sistema de agendamento para salão de beleza"
git push -u origin main

# Quando pedir credenciais:
# Username: LucasMnez
# Password: <cole-o-token-aqui>
```

### Opção 2: Usando SSH (Mais Seguro)

1. **Gerar chave SSH (se ainda não tiver):**
```bash
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"
# Pressione Enter para aceitar local padrão
# Digite uma senha (ou deixe vazio)
```

2. **Copiar chave pública:**
```bash
cat ~/.ssh/id_ed25519.pub
```

3. **Adicionar chave no GitHub:**
   - Acesse: https://github.com/settings/keys
   - Clique em "New SSH key"
   - Cole o conteúdo da chave pública
   - Salve

4. **Configurar remote para SSH:**
```bash
git remote set-url origin git@github.com:LucasMnez/beauty-salon-system.git
```

5. **Testar conexão:**
```bash
ssh -T git@github.com
# Deve mostrar: "Hi LucasMnez! You've successfully authenticated..."
```

6. **Fazer push:**
```bash
git add .
git commit -m "Initial commit: Sistema de agendamento para salão de beleza"
git push -u origin main
```

## ⚠️ Checklist Final Antes do Push

- [ ] Executei `bash verificar-seguranca.sh` e não há arquivos sensíveis
- [ ] Nenhum arquivo `.env` será commitado
- [ ] Nenhum arquivo `.db` será commitado
- [ ] Pasta `whatsapp_auth/` não será commitada
- [ ] Token SSH ou Personal Access Token está pronto
- [ ] Mensagem de commit está clara e descritiva

## 🔍 Verificar Após o Push

1. **Acessar o repositório no GitHub:**
   https://github.com/LucasMnez/beauty-salon-system

2. **Verificar que arquivos sensíveis NÃO estão lá:**
   - Não deve ter arquivos `.env`
   - Não deve ter arquivos `.db`
   - Não deve ter pasta `whatsapp_auth/`

3. **Se encontrar arquivos sensíveis no GitHub:**
   - Remova-os imediatamente
   - Considere regenerar tokens/senhas que possam ter sido expostos
   - Use `git rm --cached` para removê-los do histórico

## 📝 Comandos Úteis

```bash
# Ver o que será commitado
git status

# Ver diferenças
git diff

# Adicionar todos os arquivos (respeitando .gitignore)
git add .

# Fazer commit
git commit -m "Sua mensagem descritiva"

# Ver histórico de commits
git log --oneline

# Verificar remote configurado
git remote -v
```

## 🆘 Problemas Comuns

### "Permission denied"
- Verifique que está usando a conta correta (`LucasMnez`)
- Use Personal Access Token ao invés de senha

### "Authentication failed"
- Token pode ter expirado - gere um novo
- Verifique que o token tem permissão `repo`

### Arquivos sensíveis aparecem no GitHub
- Remova-os imediatamente do repositório
- Adicione ao `.gitignore` se ainda não estiver
- Considere regenerar credenciais expostas

---

**✅ Pronto para fazer push seguro!**
