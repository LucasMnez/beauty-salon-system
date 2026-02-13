// Agendamento guiado (chat) - JS puro
// Boas práticas: estado único + passos bem definidos

const API_URL = "https://backend-production-039a.up.railway.app/api";
const elActions = document.getElementById("chatActions");

const state = {
  step: "nome",
  nome: "",
  telefone: "",
  servico: null, // { id, nome, valor, duracao? }
};

const elMessages = document.getElementById("chatMessages");
const elForm = document.getElementById("chatForm");
const elInput = document.getElementById("chatInput");

function renderServicoCarousel(servicos, onSelect) {
  clearActions();

  const wrap = document.createElement("div");
  wrap.className = "chat-carousel";

  servicos.forEach((s) => {
    const card = document.createElement("div");
    card.className = "chat-card";

    const check = document.createElement("div");
    check.className = "chat-check";

    const title = document.createElement("div");
    title.className = "chat-card-title";
    title.textContent = s.nome;

    const sub = document.createElement("div");
    sub.className = "chat-card-sub";
    sub.innerHTML = `<span>R$ ${formatBRL(s.valor)}</span><span>${s.duracao_minutos ? s.duracao_minutos + "min" : ""}</span>`;

    card.appendChild(check);
    card.appendChild(title);
    card.appendChild(sub);

    card.addEventListener("click", () => {
      // marca visualmente
      [...wrap.querySelectorAll(".chat-card")].forEach((c) =>
        c.classList.remove("selected"),
      );
      card.classList.add("selected");

      // chama callback
      onSelect(s);
    });

    wrap.appendChild(card);
  });

  elActions.appendChild(wrap);
}

function clearActions() {
  elActions.innerHTML = "";
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function formatBRL(n) {
  const v = Number(n || 0);
  return v.toFixed(2).replace(".", ",");
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let typingEl = null;

function showTyping() {
  if (typingEl) return;
  typingEl = document.createElement("div");
  typingEl.className = "chat-bubble bot";

  const t = document.createElement("div");
  t.className = "chat-text chat-typing";
  t.textContent = "digitando...";

  typingEl.appendChild(t);
  elMessages.appendChild(typingEl);
  elMessages.scrollTop = elMessages.scrollHeight;
}

function hideTyping() {
  if (!typingEl) return;
  typingEl.remove();
  typingEl = null;
}

async function botSayDelayed(text, ms = 800) {
  showTyping();
  await sleep(ms);
  hideTyping();
  botSay(text);
}

async function botSaySequence(lines, baseDelay = 700) {
  for (let i = 0; i < lines.length; i++) {
    // delay levemente variável dá sensação mais natural
    const d = baseDelay + Math.floor(Math.random() * 400);
    await botSayDelayed(lines[i], d);
  }
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

async function start() {
  await botSaySequence([
    "Olá, tudo bem? Vou te ajudar a agendar.",
    "Qual o seu nome e sobrenome?",
  ]);
  setPlaceholder("Seu nome e sobrenome");
}

async function submit() {
  await botSayDelayed("Perfeito! Dados coletados:", 900);
  await botSayDelayed(`Nome: ${state.nome}`, 700);
  await botSayDelayed(`Telefone: ${state.telefone}`, 700);
  await botSayDelayed(
    "Em breve vou te mostrar os serviços e horários aqui mesmo.",
    1000,
  );
}
elForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = elInput.value.trim();
  if (!text) return;

  userSay(text);

  if (state.step === "nome") {
    state.nome = text;
    state.step = "telefone";
    await botSayDelayed(
      `Prazer, ${state.nome}! Agora me informe seu telefone/WhatsApp.`,
      900,
    );
    setPlaceholder("(11) 99999-9999");
    return;
  }

  if (state.step === "telefone") {
    const phone = normalizePhone(text);
    if (!(phone.length === 10 || phone.length === 11)) {
      await botSayDelayed(
        "Esse telefone parece inválido. Digite com DDD (ex: 11999999999).",
        900,
      );
      setPlaceholder("(11) 99999-9999");
      return;
    }

    state.telefone = phone;
    state.step = "servico";

    await botSayDelayed("Perfeito. Agora escolha um serviço:", 900);

    let servicos = [];
    try {
      servicos = await apiGet("/servicos");
    } catch (e) {
      await botSayDelayed(
        "Não consegui carregar os serviços agora. Tente novamente em instantes.",
        900,
      );
      return;
    }

    renderServicoCarousel(servicos, async (servico) => {
      state.servico = servico;
      clearActions();

      userSay(servico.nome);
      //await botSayDelayed(`Boa! Você escolheu: ${servico.nome}.`, 800);

      // próximo passo: dia/horário (a gente implementa em seguida)
      await botSayDelayed(
        "Agora vou te mostrar os dias e horários disponíveis.",
        900,
      );
    });

    // enquanto está em "servico", você pode desabilitar o input pra evitar digitar:
    elInput.value = "";
    elInput.disabled = true;
    document.getElementById("chatSend").disabled = true;

    return;
  }
});

start();
