# 🚀 Como Iniciar o Servidor

## ⚠️ IMPORTANTE: O servidor Flask precisa estar rodando!

Se você está vendo o erro "Erro ao carregar agendamentos", significa que o servidor Flask não está rodando.

## 📋 Passos para Iniciar

### 1. Abrir um terminal

### 2. Navegar até a pasta do projeto

```bash
cd /var/docker/apps/Agendamento
```

### 3. Iniciar o servidor Flask

```bash
cd backend
python3 app.py
```

Você verá uma mensagem como:

```
🚀 Servidor iniciando em http://localhost:5000
```

**OU** se a porta 5000 estiver ocupada:

```
⚠️  Porta 5000 está ocupada, usando porta 5001
🚀 Servidor iniciando em http://localhost:5001
```

### 4. Manter o terminal aberto

⚠️ **NÃO FECHE O TERMINAL!** O servidor precisa continuar rodando.

### 5. Abrir o navegador

Acesse:
- `http://localhost:5000/admin.html` (ou a porta que apareceu no terminal)
- `http://localhost:5000/login.html` para fazer login

## 🔧 Verificar se está rodando

Abra outro terminal e teste:

```bash
curl http://localhost:5000/api/servicos
```

Se retornar uma lista de serviços em JSON, está funcionando! ✅

## 🛑 Parar o servidor

No terminal onde o servidor está rodando, pressione:
```
Ctrl + C
```

## 📝 Notas

- O servidor Flask precisa estar rodando **sempre** que você quiser usar o sistema
- Se mudar a porta (ex: 5001), o frontend detecta automaticamente
- O banco de dados é criado automaticamente na primeira execução
