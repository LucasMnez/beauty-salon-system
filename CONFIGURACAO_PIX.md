# Configuração do Pagamento PIX

## Configuração Inicial

Para usar o pagamento PIX automático, você precisa configurar suas informações no arquivo `app.py`:

```python
# Configuração PIX (substitua com suas informações reais)
PIX_CHAVE = '11993940514'  # Sua chave PIX (CPF, email, telefone ou chave aleatória)
PIX_NOME_RECEBEDOR = 'Raissa Menezes'
PIX_CIDADE = 'Sao Paulo'
PIX_CEP = '02410010'
```

## Tipos de Chave PIX Aceitas

- **CPF**: Apenas números (ex: 11993940514)
- **Telefone**: Apenas números com DDD (ex: 11993940514)
- **Email**: Seu email cadastrado no PIX
- **Chave Aleatória**: UUID gerado pelo banco

## Como Obter sua Chave PIX

1. Acesse o app do seu banco
2. Vá em PIX > Minhas Chaves
3. Escolha ou crie uma chave PIX
4. Copie a chave e cole no arquivo `app.py`

## Instalação das Dependências

```bash
pip install -r requirements.txt
```

## Como Funciona

1. Cliente cria o agendamento
2. Sistema gera QR Code PIX automaticamente
3. Cliente escaneia ou copia o código PIX
4. Cliente realiza o pagamento
5. Cliente clica em "Já Paguei" para confirmar
6. Agendamento é confirmado automaticamente

## Verificação Automática (Opcional)

Para verificação automática de pagamento, você pode integrar com:
- **Mercado Pago**: Requer cadastro e configuração de webhook
- **Gerencianet/Efí**: API específica para PIX
- **Outras APIs**: Qualquer gateway que suporte PIX

## Nota Importante

A biblioteca `qrcode-pix` pode não estar disponível em todas as versões. Se houver erro, podemos usar uma alternativa que gera QR Codes PIX manualmente conforme a especificação do Banco Central.
