# Configuração de Notificação Automática via WhatsApp

## Como Funciona

O sistema agora envia notificações automáticas via WhatsApp quando um agendamento é criado, usando a biblioteca `pywhatkit`.

## Requisitos

1. **Instalar dependências:**
   ```bash
   pip install pywhatkit pyautogui
   ```
   Ou instalar todas as dependências:
   ```bash
   pip install -r requirements.txt
   ```

2. **WhatsApp Web deve estar aberto:**
   - Abra o WhatsApp Web no navegador padrão do sistema
   - Faça login com seu WhatsApp
   - Mantenha a aba aberta (pode minimizar, mas não fechar)

## Configuração

No arquivo `app.py`, você pode configurar:

```python
# Telefone da Raissa (formato internacional sem +)
WHATSAPP_RAISSA = '5511993940514'

# Ativar/desativar envio automático
ENVIAR_WHATSAPP_AUTO = True  # Mude para False para desativar
```

## Como Funciona

1. Quando um agendamento é criado, o sistema:
   - Formata uma mensagem com todos os detalhes do agendamento
   - Abre automaticamente o WhatsApp Web (se não estiver aberto)
   - Envia a mensagem para o número configurado
   - Fecha a aba automaticamente após enviar

2. A mensagem inclui:
   - Nome e telefone do cliente
   - Data e horário do agendamento
   - Lista de serviços selecionados
   - Valor total
   - Status e informações de pagamento

## Limitações

⚠️ **Importante:**
- Requer que o WhatsApp Web esteja aberto no navegador padrão
- O navegador padrão precisa estar configurado corretamente
- Pode levar alguns segundos para enviar (abre WhatsApp Web automaticamente)
- Funciona melhor em Windows/Linux com interface gráfica

## Soluções Alternativas (Mais Robustas)

Se você precisar de uma solução mais confiável e profissional, considere:

### 1. WhatsApp Business API (Oficial)
- Requer aprovação da Meta
- Pago (mas confiável)
- Não precisa manter WhatsApp Web aberto
- Documentação: https://developers.facebook.com/docs/whatsapp

### 2. Twilio API for WhatsApp
- Serviço pago mas confiável
- API oficial e estável
- Não precisa WhatsApp Web
- Site: https://www.twilio.com/whatsapp

### 3. Evolution API (Self-hosted)
- Gratuito e open-source
- Requer servidor próprio
- Mais complexo de configurar
- Site: https://evolution-api.com

## Troubleshooting

**Problema:** Mensagem não está sendo enviada
- Verifique se WhatsApp Web está aberto
- Verifique se o navegador padrão está configurado
- Veja os logs do servidor para erros

**Problema:** Erro ao importar pywhatkit
- Execute: `pip install pywhatkit pyautogui`
- Verifique se Python está atualizado

**Problema:** WhatsApp Web não abre automaticamente
- Configure o navegador padrão do sistema
- Certifique-se de que o navegador está instalado

## Desativar Notificações

Para desativar temporariamente, edite `app.py`:

```python
ENVIAR_WHATSAPP_AUTO = False
```
