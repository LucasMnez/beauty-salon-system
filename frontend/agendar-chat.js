// Agendamento guiado (chat) - JS puro
// Boas práticas: estado único + passos bem definidos

const API_URL = "https://backend-production-039a.up.railway.app/api";
const elActions = document.getElementById("chatActions");

const state = {
  step: "nome",
  nome: "",
  telefone: "",
  servico: null, // { id, nome, valor, duracao? }
  data: "",
  horario: "",
};

const elMessages = document.getElementById("chatMessages");
const elForm = document.getElementById("chatForm");
const elInput = document.getElementById("chatInput");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function labelDia(d) {
  const dias = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  const dia = dias[d.getDay()];
  return `${dia} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function proximosNDias(n = 14) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

const handleDiaSelect = async (iso, label) => {
  state.step = "dia";
  state.data = iso;
  clearActions();

  userSay(label);
  await botSayDelayed("Buscando horários disponíveis...", 900);

  let dataHorarios;
  try {
    dataHorarios = await apiGet(`/horarios-disponiveis?data=${iso}`);
  } catch (e) {
    await botSayDelayed("Falha ao carregar horários. Tente outro dia.", 900);
    renderDiasCarousel(dias, handleDiaSelect); // <-- retry certo
    return;
  }

  const horarios = dataHorarios?.horarios || [];
  if (!Array.isArray(horarios) || horarios.length === 0) {
    await botSayDelayed("Nesse dia não há horários. Escolha outro dia.", 900);
    renderDiasCarousel(dias, handleDiaSelect); // <-- retry certo
    return;
  }

  state.step = "horario";
  await botSayDelayed("Escolha um horário:", 700);

  renderHorariosGrid(horarios, async (h) => {
    state.horario = h;
    clearActions();

    userSay(h);

    await botSayDelayed("Confirmando seu agendamento...", 900);

    try {
      const payload = {
        nome: state.nome,
        telefone: state.telefone,
        data: state.data,
        horario: state.horario,
        servicos: [state.servico.nome],
      };

      const res = await apiPost("/agendar", payload);

      state.step = "done";
      await botSayDelayed("Agendamento cadastrado com sucesso!", 900);
      await botSayDelayed(`Código: #${res.agendamento_id}`, 700);
      await botSayDelayed(`Valor: R$ ${formatBRL(res.valor)}`, 700);

      elInput.disabled = true;
      document.getElementById("chatSend").disabled = true;
    } catch (err) {
      await botSayDelayed(`Não consegui cadastrar: ${err.message}`, 900);
      await botSayDelayed("Escolha outro horário:", 700);

      // <-- retry certo: volta o grid de horários
      renderHorariosGrid(horarios, async (h2) => {
        // dica: aqui você pode só setar state.horario = h2 e repetir o POST
        // (pra não duplicar código, o ideal depois é extrair handleHorarioSelect também)
      });
    }
  });
};

function renderDiasCarousel(diasISO, onSelect) {
  clearActions();

  const wrap = document.createElement("div");
  wrap.className = "chat-carousel";

  diasISO.forEach(({ iso, label }) => {
    const card = document.createElement("div");
    card.className = "chat-card";
    card.style.flexBasis = "160px";

    const title = document.createElement("div");
    title.className = "chat-card-title";
    title.textContent = label;

    const sub = document.createElement("div");
    sub.className = "chat-card-sub";
    sub.textContent = "Ver horários";

    card.appendChild(title);
    card.appendChild(sub);

    card.addEventListener("click", () => {
      [...wrap.querySelectorAll(".chat-card")].forEach((c) =>
        c.classList.remove("selected"),
      );
      card.classList.add("selected");
      onSelect(iso, label);
    });

    wrap.appendChild(card);
  });

  elActions.appendChild(wrap);
}

function renderHorariosGrid(horarios, onSelect) {
  clearActions();

  const grid = document.createElement("div");
  grid.className = "chat-times";

  horarios.forEach((h) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-time-btn";
    btn.textContent = h;
    btn.addEventListener("click", () => onSelect(h));
    grid.appendChild(btn);
  });

  elActions.appendChild(grid);
}

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

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
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

// ------------------------------
// Fluxo do chat (nome -> telefone -> serviço -> dia -> horário -> cria agendamento)
// ------------------------------

function setInputEnabled(enabled, placeholder) {
  elInput.disabled = !enabled;
  document.getElementById("chatSend").disabled = !enabled;
  if (placeholder) elInput.placeholder = placeholder;
  if (enabled) elInput.focus();
}

let busy = false;
function setBusy(v) {
  busy = v;
  // Evita double-click em cards/botões enquanto faz fetch/POST
  elActions.style.pointerEvents = v ? "none" : "auto";
  elActions.style.opacity = v ? "0.75" : "1";
}

async function iniciarSelecaoServico() {
  state.step = "servico";
  setInputEnabled(false);

  await botSayDelayed("Perfeito. Agora escolha um serviço:", 900);

  let servicos = [];
  try {
    setBusy(true);
    servicos = await apiGet("/servicos");
  } catch (e) {
    await botSayDelayed(
      "Não consegui carregar os serviços agora. Tente novamente em instantes.",
      900,
    );
    // Volta a permitir digitação (por exemplo pra recarregar a página / tentar depois)
    setInputEnabled(true, "(11) 99999-9999");
    return;
  } finally {
    setBusy(false);
  }

  renderServicoCarousel(servicos, handleServicoSelect);
}

async function handleServicoSelect(servico) {
  if (busy) return;

  state.servico = servico;
  state.step = "dia";
  clearActions();
  userSay(servico.nome);

  await botSayDelayed("Agora escolha o melhor dia:", 900);

  const dias = proximosNDias(14).map((d) => ({
    iso: toISODate(d),
    label: labelDia(d),
  }));

  // Reutilizável (serve para retry)
  const handleDiaSelect = async (iso, label) => {
    if (busy) return;

    state.data = iso;
    state.step = "horario";
    clearActions();
    userSay(label);

    await botSayDelayed("Buscando horários disponíveis...", 900);

    let dataHorarios;
    try {
      setBusy(true);
      dataHorarios = await apiGet(`/horarios-disponiveis?data=${iso}`);
    } catch (e) {
      await botSayDelayed("Falha ao carregar horários. Tente outro dia.", 900);
      renderDiasCarousel(dias, handleDiaSelect);
      return;
    } finally {
      setBusy(false);
    }

    const horarios = dataHorarios?.horarios || [];
    if (!Array.isArray(horarios) || horarios.length === 0) {
      await botSayDelayed("Nesse dia não há horários. Escolha outro dia.", 900);
      renderDiasCarousel(dias, handleDiaSelect);
      return;
    }

    await botSayDelayed("Escolha um horário:", 700);

    const handleHorarioSelect = async (h) => {
      if (busy) return;

      state.horario = h;
      clearActions();
      userSay(h);

      await botSayDelayed("Confirmando seu agendamento...", 900);

      try {
        setBusy(true);

        const payload = {
          nome: state.nome,
          telefone: state.telefone,
          data: state.data,
          horario: state.horario,
          servicos: [state.servico.nome], // backend espera lista de nomes
        };

        const res = await apiPost("/agendar", payload);

        state.step = "done";
        await botSayDelayed("Agendamento cadastrado com sucesso!", 900);
        await botSayDelayed(`Código: #${res.agendamento_id}`, 700);
        await botSayDelayed(`Valor: R$ ${formatBRL(res.valor)}`, 700);
        await botSayDelayed("Até mais!", 700);

        setInputEnabled(false);
      } catch (err) {
        await botSayDelayed(`Não consegui cadastrar: ${err.message}`, 900);
        await botSayDelayed("Escolha outro horário:", 700);

        // Retry correto: reexibe o grid do mesmo dia
        renderHorariosGrid(horarios, handleHorarioSelect);
      } finally {
        setBusy(false);
      }
    };

    renderHorariosGrid(horarios, handleHorarioSelect);
  };

  renderDiasCarousel(dias, handleDiaSelect);
}

elForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Se o input estiver desabilitado, não processa submit
  if (elInput.disabled) return;

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

    elInput.value = "";
    setInputEnabled(true, "(11) 99999-9999");
    return;
  }

  if (state.step === "telefone") {
    const phone = normalizePhone(text);

    // Validação simples: 10 ou 11 dígitos (com DDD)
    if (!(phone.length === 10 || phone.length === 11)) {
      await botSayDelayed(
        "Esse telefone parece inválido. Digite com DDD (ex: 11999999999).",
        900,
      );
      elInput.value = "";
      setInputEnabled(true, "(11) 99999-9999");
      return;
    }

    state.telefone = phone;
    elInput.value = "";
    await iniciarSelecaoServico();
  }
});

start();
