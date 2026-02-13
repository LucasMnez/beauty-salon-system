// Agendamento guiado (chat) - JS puro
// Boas práticas: estado único + passos bem definidos

const state = {
  step: "nome",
  nome: "",
  telefone: "",
};

const elMessages = document.getElementById("chatMessages");
const elForm = document.getElementById("chatForm");
const elInput = document.getElementById("chatInput");

function appendMessage({ from, text }) {
  const wrap = document.createElement("div");
  wrap.className = `chat-bubble ${from === "bot" ? "bot" : "user"}`;

  const p = document.createElement("div");
  p.className = "chat-text";
  p.textContent = text;

  wrap.appendChild(p);
  elMessages.appendChild(wrap);
  elMessages.scrollTop = elMessages.scrollHeight;
}

function botSay(text) {
  appendMessage({ from: "bot", text });
}

function userSay(text) {
  appendMessage({ from: "user", text });
}

function normalizePhone(raw) {
  // Mantém só números; você pode melhorar depois (DDD obrigatório etc.)
  return String(raw || "").replace(/\D/g, "");
}

function setPlaceholder(text) {
  elInput.placeholder = text;
  elInput.value = "";
  elInput.focus();
}

function start() {
  botSay("Olá, tudo bem? Vou te ajudar a agendar.");
  botSay("Qual o seu nome e sobrenome?");
  setPlaceholder("Seu nome e sobrenome");
}

async function submit() {
  // Aqui por enquanto só valida e mostra resumo.
  // Depois você liga no backend (POST /api/agendamentos) se quiser.
  botSay("Perfeito! Dados coletados:");
  botSay(`Nome: ${state.nome}`);
  botSay(`Telefone: ${state.telefone}`);

  botSay("Em breve vou te mostrar os serviços e horários aqui mesmo.");
}

elForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = elInput.value.trim();
  if (!text) return;

  userSay(text);

  if (state.step === "nome") {
    state.nome = text;
    state.step = "telefone";
    botSay(`Prazer, ${state.nome}! Agora me informe seu telefone/WhatsApp.`);
    setPlaceholder("(11) 99999-9999");
    return;
  }

  if (state.step === "telefone") {
    const phone = normalizePhone(text);

    // Validação simples: 10 ou 11 dígitos (com DDD)
    if (!(phone.length === 10 || phone.length === 11)) {
      botSay(
        "Esse telefone parece inválido. Digite com DDD (ex: 11999999999).",
      );
      setPlaceholder("(11) 99999-9999");
      return;
    }

    state.telefone = phone;
    state.step = "done";
    elInput.disabled = true;
    document.getElementById("chatSend").disabled = true;
    await submit();
  }
});

start();
