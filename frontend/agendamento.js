// Configuração da API
// Tentar detectar porta automaticamente (tentar 5001 se 5000 não funcionar)
let API_PORT = 5001;
//let API_URL = `http://localhost:${API_PORT}/api`;
const DEBUG = false;

const API_URL = "https://backend-production-039a.up.railway.app/api";
const toMoneyNumber = (v) => {
  const s = String(v ?? "0")
    .trim()
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
// Estado da aplicação
let servicos = {};
let servicosSelecionados = []; // Mudança: agora é uma lista para múltiplos serviços
let servicoSelecionado = null; // Manter para compatibilidade temporária
let dataSelecionada = null;
let horarioSelecionado = null;
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();
const anoLimite = anoAtual + 2; // Permitir até 2 anos à frente (março em diante)
let disponibilidade = {}; // { "2025-01-20": ["manhã", "tarde"] }

// Elementos DOM
const calendarGrid = document.getElementById("calendarGrid");
const currentMonthEl = document.getElementById("currentMonth");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const bookingFormContainer = document.getElementById("bookingFormContainer");
const form = document.getElementById("bookingForm");
const telefoneInput = document.getElementById("telefone");
const mensagemDiv = document.getElementById("mensagem");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
// PIX removido - pagamento será realizado quando o serviço for prestado
const linkContainer = document.getElementById("linkContainer");
const linkAgendamento = document.getElementById("linkAgendamento");
const copyLinkBtn = document.getElementById("copyLink");
const whatsappLink = document.getElementById("whatsappLink");

// agendamentoIdAtual removido - não é mais necessário sem PIX

// Máscara de telefone
telefoneInput.addEventListener("input", function (e) {
  let value = e.target.value.replace(/\D/g, "");
  if (value.length <= 11) {
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    if (value.length < 14) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    }
    e.target.value = value;
  }
});

// Carregar serviços (apenas para uso no modal, não renderiza na página)
async function carregarServicos() {
  try {
    if (DEBUG) console.log("Carregando serviços de:", `${API_URL}/servicos`);

    const response = await fetch(`${API_URL}/servicos`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const servicosList = await response.json();
    if (DEBUG) console.log("Serviços recebidos:", servicosList);

    if (!Array.isArray(servicosList) || servicosList.length === 0) {
      if (DEBUG) console.warn("Nenhum serviço retornado pela API");
      mostrarMensagem("Nenhum serviço disponível no momento.", "error");
      return;
    }

    // Armazenar serviços no objeto servicos para uso no modal
    servicosList.forEach((servico) => {
      servicos[servico.nome] = toMoneyNumber(servico.valor);
    });

    if (DEBUG) console.log("Serviços carregados com sucesso!");
  } catch (error) {
    if (DEBUG) console.error("Erro ao carregar serviços:", error);
    mostrarMensagem(
      "Erro ao carregar serviços. Verifique se o servidor está rodando.",
      "error",
    );
  }
}

function arrayHorariosParaPeriodos(lista) {
  const periodos = { manhã: [], tarde: [], noite: [] };
  (lista || []).forEach((h) => {
    const hora = parseInt(String(h).split(":")[0], 10);
    if (hora < 12) periodos.manhã.push(h);
    else if (hora < 17) periodos.tarde.push(h);
    else periodos.noite.push(h);
  });
  Object.keys(periodos).forEach((k) => {
    if (periodos[k].length === 0) delete periodos[k];
  });
  return periodos;
}

// Selecionar serviço (usado apenas internamente no modal)
function selecionarServico(nome, elemento) {
  servicoSelecionado = nome;
  if (elemento) {
    elemento.classList.add("selected");
  }
}

function normalizarDisponibilidadeDia(horariosDia) {
  if (!horariosDia) return {};
  if (Array.isArray(horariosDia)) {
    const periodos = { manhã: [], tarde: [], noite: [] };
    horariosDia.forEach((h) => {
      const hora = parseInt(String(h).split(":")[0], 10);
      if (hora < 12) periodos.manhã.push(h);
      else if (hora < 17) periodos.tarde.push(h);
      else periodos.noite.push(h);
    });
    if (periodos.manhã.length === 0) delete periodos.manhã;
    if (periodos.tarde.length === 0) delete periodos.tarde;
    if (periodos.noite.length === 0) delete periodos.noite;
    return periodos;
  }
  return horariosDia; // compat formato antigo
}
// Mostrar seleção de serviço em modal (quando clica no dia primeiro) - MÚLTIPLA SELEÇÃO
function mostrarSelecaoServico(data) {
  // Garantir que não há serviços selecionados
  servicosSelecionados = [];
  servicoSelecionado = null;

  // Criar modal de seleção de serviço
  const modal = document.createElement("div");
  modal.className = "horario-modal";

  let servicosHTML = "";
  Object.keys(servicos).forEach((nomeServico) => {
    const valor = toMoneyNumber(servicos[nomeServico]);
    const valorFormatado = valor.toFixed(2).replace(".", ",");
    const isSelected = servicosSelecionados.includes(nomeServico);
    servicosHTML += `
            <button type="button" class="servico-card-select servico-btn-modal ${isSelected ? "selected" : ""}" data-servico="${nomeServico}">
                <h4>${nomeServico}</h4>
                <p class="price">R$ ${toMoneyNumber(valorFormatado).toFixed(2).replace(".", ",")}</p>
                ${isSelected ? '<span class="check-mark">✓</span>' : ""}
            </button>
        `;
  });

  const dataObj = new Date(data + "T00:00:00");
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calcular valor total dos serviços selecionados
  const valorTotal = servicosSelecionados.reduce(
    (sum, servico) => sum + servicos[servico],
    0,
  );

  modal.innerHTML = `
        <div class="modal-content">
            <h3>Selecione os Serviços</h3>
            <p style="margin-bottom: 10px; color: #666;">Data selecionada: <strong>${dataFormatada}</strong></p>
            <p style="margin-bottom: 20px; color: #666; font-size: 0.9em;">Você pode selecionar múltiplos serviços</p>
            <div class="servicos-grid-modal">
                ${servicosHTML}
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 1.1em;"><strong>Valor Total: R$ ${valorTotal.toFixed(2).replace(".", ",")}</strong></p>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button type="button" class="btn-secondary" id="limparServicos">Limpar Seleção</button>
                <button type="button" class="cta-button" id="confirmarServicos" ${servicosSelecionados.length === 0 ? "disabled" : ""}>Confirmar (${servicosSelecionados.length})</button>
                <button type="button" class="btn-close-modal">Cancelar</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Função para atualizar o modal
  const atualizarModal = () => {
    const valorTotal = servicosSelecionados.reduce(
      (sum, servico) => sum + servicos[servico],
      0,
    );
    modal.querySelector('div[style*="background: #f5f5f5"] p').innerHTML =
      `<strong>Valor Total: R$ ${valorTotal.toFixed(2).replace(".", ",")}</strong>`;
    const btnConfirmar = modal.querySelector("#confirmarServicos");
    btnConfirmar.disabled = servicosSelecionados.length === 0;
    btnConfirmar.textContent = `Confirmar (${servicosSelecionados.length})`;

    // Atualizar visual dos botões
    modal.querySelectorAll(".servico-btn-modal").forEach((btn) => {
      const nomeServico = btn.dataset.servico;
      if (servicosSelecionados.includes(nomeServico)) {
        btn.classList.add("selected");
        if (!btn.querySelector(".check-mark")) {
          const checkMark = document.createElement("span");
          checkMark.className = "check-mark";
          checkMark.textContent = "✓";
          btn.appendChild(checkMark);
        }
      } else {
        btn.classList.remove("selected");
        const checkMark = btn.querySelector(".check-mark");
        if (checkMark) {
          checkMark.remove();
        }
      }
    });
  };

  // Toggle seleção de serviços - não fecha o modal
  modal.querySelectorAll(".servico-btn-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nomeServico = btn.dataset.servico;
      const index = servicosSelecionados.indexOf(nomeServico);

      if (index > -1) {
        // Desmarcar
        servicosSelecionados.splice(index, 1);
      } else {
        // Marcar
        servicosSelecionados.push(nomeServico);
      }

      atualizarModal();
    });
  });

  // Limpar seleção
  modal.querySelector("#limparServicos").addEventListener("click", () => {
    servicosSelecionados = [];
    atualizarModal();
  });

  // Confirmar seleção - só fecha quando confirmar
  modal
    .querySelector("#confirmarServicos")
    .addEventListener("click", async () => {
      if (servicosSelecionados.length === 0) {
        if (DEBUG)
          console.warn("⚠️ Tentativa de confirmar sem serviços selecionados");
        return;
      }

      if (DEBUG) console.log("✅ Serviços confirmados:", servicosSelecionados);

      // Definir servicoSelecionado como primeiro para compatibilidade (usado em outras partes)
      servicoSelecionado = servicosSelecionados[0];

      document.body.removeChild(modal);

      // Usar dados já carregados do mês (não precisa fazer nova requisição)
      if (DEBUG) console.log("🔍 Verificando disponibilidade para data:", data);
      if (DEBUG) console.log("📊 Disponibilidade completa:", disponibilidade);
      const horariosDisponiveis = normalizarDisponibilidadeDia(
        disponibilidade[data],
      );

      if (DEBUG)
        console.log(
          "⏰ Horários disponíveis para esta data:",
          horariosDisponiveis,
        );
      const periodosDisponiveis = Object.keys(horariosDisponiveis);
      if (DEBUG) console.log("📋 Períodos disponíveis:", periodosDisponiveis);

      if (periodosDisponiveis.length === 0) {
        if (DEBUG)
          console.error(
            "❌ Nenhum período disponível encontrado para a data:",
            data,
          );
        mostrarMensagem("Nenhum horário disponível para esta data", "error");
        dataSelecionada = null;
        servicosSelecionados = [];
        servicoSelecionado = null;
        // Remover seleção do dia no calendário
        document.querySelectorAll(".calendar-day").forEach((cell) => {
          if (cell.classList.contains("selected")) {
            cell.classList.remove("selected");
          }
        });
        return;
      }

      if (DEBUG) console.log("✅ Chamando mostrarSelecaoHorario()...");
      mostrarSelecaoHorario();
    });

  modal.querySelector(".btn-close-modal").addEventListener("click", () => {
    document.body.removeChild(modal);
    dataSelecionada = null;
    servicosSelecionados = [];
    servicoSelecionado = null;
    document.querySelectorAll(".calendar-day").forEach((cell) => {
      cell.classList.remove("selected");
    });
  });
}

// Carregar disponibilidade para uma data específica
async function carregarDisponibilidadeData(data) {
  try {
    const response = await fetch(
      `${API_URL}/horarios-disponiveis?data=${data}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    disponibilidade[data] = result.horarios || {};
  } catch (error) {
    if (DEBUG) console.error("Erro ao carregar disponibilidade:", error);
    mostrarMensagem("Erro ao carregar horários disponíveis.", "error");
  }
}

// Carregar disponibilidade do mês (OTIMIZADO - uma única requisição)
async function carregarDisponibilidadeMes() {
  // Renderizar calendário primeiro (sem dados) para mostrar estrutura rapidamente
  renderizarCalendario();

  // Formatar mês e ano para a API (mes começa em 0 no JS, então +1)
  const mesFormatado = String(mesAtual + 1).padStart(2, "0");
  const anoFormatado = String(anoAtual);

  try {
    if (DEBUG)
      console.log(
        `📅 Carregando disponibilidade do mês ${mesFormatado}/${anoFormatado}...`,
      );
    const inicio = performance.now();

    // Uma única requisição para todo o mês
    const response = await fetch(
      `${API_URL}/disponibilidade-mes?mes=${mesFormatado}&ano=${anoFormatado}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    disponibilidade = result.disponibilidade || {};

    const tempo = ((performance.now() - inicio) / 1000).toFixed(2);
    if (DEBUG) console.log(`✅ Disponibilidade carregada em ${tempo}s`);
    if (DEBUG) console.log("📊 Dados de disponibilidade:", disponibilidade);

    // Re-renderizar calendário com os dados carregados
    renderizarCalendario();
  } catch (error) {
    if (DEBUG) console.error("Erro ao carregar disponibilidade do mês:", error);
    mostrarMensagem(
      "Erro ao carregar disponibilidade. Tente novamente.",
      "error",
    );
    // Manter calendário renderizado mesmo com erro
  }
}

// Renderizar calendário
function renderizarCalendario() {
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  currentMonthEl.textContent = `${meses[mesAtual]} ${anoAtual}`;

  const primeiroDia = new Date(anoAtual, mesAtual, 1);
  const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay();

  calendarGrid.innerHTML = "";

  // Cabeçalho dos dias da semana
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  diasSemana.forEach((dia) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = dia;
    calendarGrid.appendChild(header);
  });

  // Espaços vazios antes do primeiro dia
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  // Dias do mês
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const data = new Date(anoAtual, mesAtual, dia);
    const dataStr = formatarData(data);
    const diaSemana = data.getDay();
    const isDomingo = diaSemana === 0;
    const isPassado = data < hoje;
    const horariosDisponiveis = disponibilidade[dataStr];
    const periodosDisponiveis = horariosDisponiveis
      ? Object.keys(horariosDisponiveis)
      : [];
    // Se não há dados carregados ainda, assumir disponível (será atualizado quando carregar)
    const temDisponibilidade =
      horariosDisponiveis === undefined || periodosDisponiveis.length > 0;

    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";

    if (isDomingo) {
      dayCell.classList.add("domingo");
    } else if (isPassado) {
      dayCell.classList.add("passado");
    } else if (horariosDisponiveis === undefined) {
      // Ainda não carregou disponibilidade - mostrar como disponível temporariamente
      dayCell.classList.add("available");
      dayCell.style.opacity = "0.7";
    } else if (temDisponibilidade && periodosDisponiveis.length > 0) {
      // Tem períodos disponíveis
      dayCell.classList.add("available");
      dayCell.style.opacity = "1";
    } else {
      // Verificar se realmente não tem disponibilidade ou se ainda não carregou
      if (
        horariosDisponiveis !== undefined &&
        periodosDisponiveis.length === 0
      ) {
        // Sem disponibilidade (todos períodos ocupados) - apenas se já carregou os dados
        dayCell.classList.add("unavailable");
      } else {
        // Ainda não carregou ou erro - mostrar como disponível temporariamente
        dayCell.classList.add("available");
        dayCell.style.opacity = "0.7";
      }
    }

    if (dataStr === dataSelecionada) {
      dayCell.classList.add("selected");
    }

    // Criar indicadores de períodos disponíveis (apenas se há dados carregados)
    let indicadores = "";
    if (horariosDisponiveis && periodosDisponiveis.length > 0) {
      if (DEBUG)
        console.log(
          `📅 Data ${dataStr}: períodos disponíveis =`,
          periodosDisponiveis,
        );
      indicadores = periodosDisponiveis
        .map((periodo) => {
          const letra = periodo.charAt(0).toUpperCase();
          return `<span class="horario-dot" title="${periodo}">${letra}</span>`;
        })
        .join("");
    } else if (horariosDisponiveis !== undefined) {
      if (DEBUG) console.log(`⚠️ Data ${dataStr}: sem períodos disponíveis`);
    }

    dayCell.innerHTML = `
            <span class="day-number">${dia}</span>
            <div class="horarios-indicators">
                ${indicadores}
            </div>
        `;

    // Verificar se o dia está disponível para clique
    const isUnavailable = dayCell.classList.contains("unavailable");
    // Permitir clique em qualquer dia disponível (não precisa ter serviço selecionado antes)
    const podeClicar = !isDomingo && !isPassado && !isUnavailable;

    if (podeClicar) {
      dayCell.style.cursor = "pointer";
      dayCell.style.pointerEvents = "auto";
      dayCell.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (DEBUG) console.log("Clique na data:", dataStr);
        selecionarData(dataStr, dayCell);
      });
    } else {
      // Domingo, passado ou unavailable - não permitir clique
      dayCell.style.pointerEvents = "none";
    }

    calendarGrid.appendChild(dayCell);
  }
}

// Selecionar data
async function selecionarData(data, elemento) {
  if (DEBUG) console.log("selecionarData chamado:", data);

  // Verificar se a célula está marcada como sem disponibilidade
  if (elemento.classList.contains("sem-disponibilidade")) {
    if (DEBUG) console.log("Data marcada como sem disponibilidade");
    mostrarMensagem("Esta data não está disponível", "error");
    return;
  }

  // Se já tem serviço selecionado, mostrar horários diretamente
  if (servicosSelecionados.length > 0) {
    dataSelecionada = data;
    horarioSelecionado = null;

    // Remover seleção anterior
    document.querySelectorAll(".calendar-day").forEach((cell) => {
      cell.classList.remove("selected");
    });

    elemento.classList.add("selected");

    // Mostrar horários diretamente
    mostrarSelecaoHorario();
  } else {
    // Se não tem serviço selecionado, mostrar modal de serviços
    dataSelecionada = data;
    horarioSelecionado = null;

    // Remover seleção anterior
    document.querySelectorAll(".calendar-day").forEach((cell) => {
      cell.classList.remove("selected");
    });

    elemento.classList.add("selected");

    // Mostrar modal para selecionar serviço
    mostrarSelecaoServico(data);
  }
}

// Mostrar seleção de horário
async function mostrarSelecaoHorario() {
  if (DEBUG)
    console.log("🔍 mostrarSelecaoHorario chamado para data:", dataSelecionada);
  if (DEBUG) console.log("📊 Serviços selecionados:", servicosSelecionados);

  if (!dataSelecionada) {
    if (DEBUG) console.error("❌ Nenhuma data selecionada!");
    return;
  }

  // Buscar horários disponíveis baseados na duração dos serviços selecionados
  try {
    const servicosParam =
      servicosSelecionados.length > 0 ? servicosSelecionados.join(",") : "";

    const response = await fetch(
      `${API_URL}/horarios-disponiveis?data=${dataSelecionada}&servicos=${servicosParam}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const horariosDisponiveis = result.horarios || [];

    if (DEBUG)
      console.log("⏰ Horários disponíveis retornados:", horariosDisponiveis);

    if (horariosDisponiveis.length === 0) {
      mostrarMensagem(
        "Nenhum horário disponível para esta data com os serviços selecionados",
        "error",
      );
      return;
    }

    // Ordenar horários
    horariosDisponiveis.sort();

    // Agrupar horários por período para melhor visualização
    const periodos = {
      manhã: [],
      tarde: [],
      noite: [],
    };

    horariosDisponiveis.forEach((horario) => {
      const hora = parseInt(horario.split(":")[0]);
      if (hora < 12) {
        periodos["manhã"].push(horario);
      } else if (hora < 17) {
        periodos["tarde"].push(horario);
      } else {
        periodos["noite"].push(horario);
      }
    });

    // Criar modal de seleção de horário
    const modal = document.createElement("div");
    modal.className = "horario-modal";

    // Criar HTML com períodos ordenados e seus horários específicos
    let horariosHTML = "";
    const ordemPeriodos = ["manhã", "tarde", "noite"];

    ordemPeriodos.forEach((periodo) => {
      const horariosPeriodo = periodos[periodo];
      if (horariosPeriodo.length > 0) {
        horariosHTML += `
                    <div class="periodo-group">
                        <h4>${periodo.charAt(0).toUpperCase() + periodo.slice(1)}</h4>
                        <div class="horarios-especificos">
                            ${horariosPeriodo
                              .map(
                                (horario) => `
                                <button type="button" class="horario-btn-modal" data-horario="${horario}">
                                    ${horario}
                                </button>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                `;
      }
    });

    modal.innerHTML = `
            <div class="modal-content">
                <h3>Selecione o Horário</h3>
                <div class="horarios-container-modal">
                    ${horariosHTML}
                </div>
                <button type="button" class="btn-close-modal">Cancelar</button>
            </div>
        `;

    document.body.appendChild(modal);

    modal.querySelectorAll(".horario-btn-modal").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Salvar o horário específico selecionado
        horarioSelecionado = btn.dataset.horario;
        document.body.removeChild(modal);
        mostrarFormulario();
      });
    });

    modal.querySelector(".btn-close-modal").addEventListener("click", () => {
      document.body.removeChild(modal);
      dataSelecionada = null;
      document.querySelectorAll(".calendar-day").forEach((cell) => {
        cell.classList.remove("selected");
      });
    });
  } catch (error) {
    if (DEBUG) console.error("Erro ao carregar horários disponíveis:", error);
    mostrarMensagem(
      "Erro ao carregar horários disponíveis. Tente novamente.",
      "error",
    );
  }
}

// Mostrar formulário
function mostrarFormulario() {
  const dataObj = new Date(dataSelecionada + "T00:00:00");
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Mostrar serviços selecionados (múltiplos)
  document.getElementById("resumo-servico").textContent =
    servicosSelecionados.join(", ");
  document.getElementById("resumo-data").textContent = dataFormatada;
  // Exibir horário específico (ex: 08:00, 14:00, etc)
  document.getElementById("resumo-horario").textContent = horarioSelecionado;

  // Calcular valor total dos serviços selecionados
  const valorTotal = servicosSelecionados.reduce(
    (sum, servico) => sum + servicos[servico],
    0,
  );
  document.getElementById("valor-total").textContent =
    `R$ ${valorTotal.toFixed(2).replace(".", ",")}`;

  bookingFormContainer.style.display = "block";
  bookingFormContainer.scrollIntoView({ behavior: "smooth" });
}

// Cancelar seleção
cancelBtn.addEventListener("click", () => {
  bookingFormContainer.style.display = "none";
  dataSelecionada = null;
  horarioSelecionado = null;
  servicosSelecionados = []; // Limpar seleção de serviços
  servicoSelecionado = null;
  document.querySelectorAll(".calendar-day").forEach((cell) => {
    cell.classList.remove("selected");
  });
  form.reset();
});

// Submeter formulário
form.addEventListener("submit", async function (e) {
  e.preventDefault();

  // Validação: deve ter pelo menos um serviço selecionado
  if (servicosSelecionados.length === 0) {
    mostrarMensagem("Por favor, selecione pelo menos um serviço", "error");
    return;
  }

  // Debug: verificar serviços selecionados
  if (DEBUG)
    console.log("DEBUG - Serviços selecionados:", servicosSelecionados);
  if (DEBUG) console.log("DEBUG - Tipo:", typeof servicosSelecionados);
  if (DEBUG)
    console.log("DEBUG - É array?", Array.isArray(servicosSelecionados));

  const formData = {
    nome: document.getElementById("nome").value.trim(),
    telefone: telefoneInput.value.replace(/\D/g, ""),
    servicos: servicosSelecionados, // Mudança: enviar lista de serviços
    data: dataSelecionada,
    horario: horarioSelecionado,
  };

  // Debug: verificar formData antes de enviar
  if (DEBUG) console.log("DEBUG - FormData completo:", formData);
  if (DEBUG) console.log("DEBUG - FormData.servicos:", formData.servicos);

  if (!formData.nome || !formData.telefone || formData.telefone.length < 10) {
    mostrarMensagem(
      "Por favor, preencha todos os campos corretamente",
      "error",
    );
    return;
  }

  if (!formData.horario) {
    mostrarMensagem("Por favor, selecione um horário", "error");
    return;
  }

  // Validação adicional: garantir que servicos é um array válido
  if (!Array.isArray(formData.servicos) || formData.servicos.length === 0) {
    if (DEBUG)
      console.error("ERRO: servicos não é um array válido!", formData.servicos);
    mostrarMensagem("Por favor, selecione pelo menos um serviço", "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Agendando...";

    const jsonBody = JSON.stringify(formData);
    if (DEBUG) console.log("DEBUG - JSON sendo enviado:", jsonBody);

    const response = await fetch(`${API_URL}/agendar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonBody,
    });

    const result = await response.json();

    if (DEBUG) console.log("Resposta do servidor:", result);

    if (response.ok) {
      // Esconder formulário e calendário
      bookingFormContainer.style.display = "none";
      const bookingGrid = document.getElementById("bookingGrid");
      const selecaoServicoInicial = document.getElementById(
        "selecaoServicoInicial",
      );
      const proximosHorarios = document.getElementById("proximosHorarios");

      if (bookingGrid) bookingGrid.style.display = "none";
      if (selecaoServicoInicial) selecaoServicoInicial.style.display = "none";
      if (proximosHorarios) proximosHorarios.style.display = "none";

      // Criar e mostrar mensagem de sucesso destacada
      const dataObj = new Date(formData.data + "T00:00:00");
      const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const servicosFormatados = formData.servicos.join(", ");
      const valorTotal =
        result.valor ||
        formData.servicos.reduce(
          (sum, servico) => sum + (servicos[servico] || 0),
          0,
        );

      const successMessage = `
                <div class="success-container" style="max-width: 600px; margin: 40px auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                    <h2 style="color: #28a745; margin-bottom: 20px; font-size: 28px;">Agendamento Confirmado!</h2>
                    <div style="text-align: left; background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>👤 Cliente:</strong> ${formData.nome}</p>
                        <p style="margin: 10px 0;"><strong>📅 Data:</strong> ${dataFormatada}</p>
                        <p style="margin: 10px 0;"><strong>⏰ Horário:</strong> ${formData.horario}</p>
                        <p style="margin: 10px 0;"><strong>💅 Serviços:</strong> ${servicosFormatados}</p>
                        <p style="margin: 10px 0;"><strong>💰 Valor Total:</strong> R$ ${valorTotal.toFixed(2).replace(".", ",")}</p>
                    </div>
                    <p style="color: #666; margin-top: 20px; line-height: 1.6;">
                        O pagamento pode ser realizado quando o serviço for prestado.<br>
                        A Raissa foi notificada automaticamente via WhatsApp.
                    </p>
                    <button onclick="location.reload()" class="cta-button" style="margin-top: 30px; padding: 12px 30px;">
                        Fazer Novo Agendamento
                    </button>
                </div>
            `;

      // Inserir mensagem de sucesso no container principal
      const mainContent = document.querySelector(".booking-section .container");
      if (mainContent) {
        mainContent.innerHTML = successMessage;
      }

      // Limpar formulário e resetar seleções
      form.reset();
      dataSelecionada = null;
      horarioSelecionado = null;
      servicosSelecionados = [];
      servicoSelecionado = null;
    } else {
      mostrarMensagem(result.error || "Erro ao realizar agendamento", "error");
    }
  } catch (error) {
    if (DEBUG) console.error("Erro ao agendar:", error);
    mostrarMensagem(
      "Erro ao conectar com o servidor. Verifique se o servidor está rodando.",
      "error",
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Criar Agendamento";
  }
});

// PIX removido - pagamento será realizado quando o serviço for prestado

// Notificar Raissa via WhatsApp Web quando um agendamento é criado
function notificarRaissaWhatsApp(dadosAgendamento, valorTotal) {
  // Telefone da Raissa (formato: 5511993940514 = 55 + 11 + 993940514)
  const telefoneRaissa = "5511993940514";

  // Formatar data para exibição
  const dataObj = new Date(dadosAgendamento.data + "T00:00:00");
  const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Formatar telefone para exibição (se ainda não estiver formatado)
  let telefoneFormatado = dadosAgendamento.telefone;
  if (telefoneFormatado.length === 11) {
    telefoneFormatado = telefoneFormatado.replace(
      /(\d{2})(\d{5})(\d{4})/,
      "($1) $2-$3",
    );
  } else if (telefoneFormatado.length === 10) {
    telefoneFormatado = telefoneFormatado.replace(
      /(\d{2})(\d{4})(\d{4})/,
      "($1) $2-$3",
    );
  }

  // Formatar lista de serviços (usar servicosSelecionados se disponível, senão usar do formData)
  const servicosLista =
    servicosSelecionados.length > 0
      ? servicosSelecionados
      : dadosAgendamento.servicos || [];
  const servicosFormatados = Array.isArray(servicosLista)
    ? servicosLista.join(", ")
    : servicosLista;

  // Criar mensagem formatada
  const mensagem =
    `🔔 *NOVO AGENDAMENTO CRIADO*\n\n` +
    `👤 *Cliente:* ${dadosAgendamento.nome}\n` +
    `📱 *Telefone:* ${telefoneFormatado}\n\n` +
    `📅 *Data:* ${dataFormatada}\n` +
    `⏰ *Horário:* ${dadosAgendamento.horario}\n\n` +
    `💅 *Serviços:*\n${servicosFormatados}\n\n` +
    `💰 *Valor Total:* R$ ${valorTotal.toFixed(2).replace(".", ",")}\n\n` +
    `📝 *Status:* Pendente\n` +
    `💳 *Pagamento:* Será realizado quando o serviço for prestado`;

  // Criar link do WhatsApp Web
  const whatsappUrl = `https://web.whatsapp.com/send?phone=${telefoneRaissa}&text=${encodeURIComponent(mensagem)}`;

  // Abrir WhatsApp Web em nova aba
  window.open(whatsappUrl, "_blank");

  if (DEBUG) console.log("Notificação WhatsApp enviada para Raissa");
}

// Mostrar link de agendamento
function mostrarLinkAgendamento(dados) {
  const baseUrl =
    window.location.origin +
    window.location.pathname.replace("agendamento.html", "");
  const link = `${baseUrl}agendamento.html?nome=${encodeURIComponent(dados.nome)}&servico=${encodeURIComponent(dados.servico)}&data=${dados.data}&horario=${dados.horario}`;

  linkAgendamento.value = link;

  const mensagemWhatsApp =
    `Olá ${dados.nome}! Seu agendamento foi confirmado:\n\n` +
    `📅 Data: ${new Date(dados.data + "T00:00:00").toLocaleDateString("pt-BR")}\n` +
    `⏰ Horário: ${dados.horario.charAt(0).toUpperCase() + dados.horario.slice(1)}\n` +
    `💅 Serviço: ${dados.servico}\n` +
    `💰 Valor: R$ ${servicos[dados.servico].toFixed(2).replace(".", ",")}\n\n` +
    `Link para confirmar: ${link}`;

  whatsappLink.href = `https://wa.me/5511993940514?text=${encodeURIComponent(mensagemWhatsApp)}`;

  linkContainer.style.display = "block";
  linkContainer.scrollIntoView({ behavior: "smooth" });
}

// Copiar link
copyLinkBtn.addEventListener("click", () => {
  linkAgendamento.select();
  document.execCommand("copy");
  copyLinkBtn.textContent = "✓ Copiado!";
  setTimeout(() => {
    copyLinkBtn.textContent = "Copiar Link";
  }, 2000);
});

// Navegação do calendário
prevMonthBtn.addEventListener("click", () => {
  const hoje = new Date();
  const mesHoje = hoje.getMonth();
  const anoHoje = hoje.getFullYear();

  mesAtual--;
  if (mesAtual < 0) {
    mesAtual = 11;
    anoAtual--;
  }

  // Não permitir voltar antes do mês atual
  if (anoAtual < anoHoje || (anoAtual === anoHoje && mesAtual < mesHoje)) {
    mesAtual = mesHoje;
    anoAtual = anoHoje;
  }

  carregarDisponibilidadeMes();
});

nextMonthBtn.addEventListener("click", () => {
  const anoLimiteCalculado = new Date().getFullYear() + 2; // Permitir até 2 anos à frente

  mesAtual++;
  if (mesAtual > 11) {
    mesAtual = 0;
    anoAtual++;
  }

  // Limitar até dezembro de 2 anos à frente
  if (anoAtual > anoLimiteCalculado) {
    anoAtual = anoLimiteCalculado;
    mesAtual = 11; // Dezembro do ano limite
    return; // Não fazer nada se já está no limite
  }

  carregarDisponibilidadeMes();
});

// Funções auxiliares
function formatarData(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mostrarMensagem(texto, tipo = "info", elemento = null) {
  const targetElement = elemento || mensagemDiv;
  targetElement.textContent = texto;
  targetElement.className = `mensagem ${tipo}`;
  targetElement.style.display = "block";

  // Scroll para a mensagem
  targetElement.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (tipo === "success") {
    setTimeout(() => {
      targetElement.style.display = "none";
    }, 5000);
  } else if (tipo === "error") {
    setTimeout(() => {
      targetElement.style.display = "none";
    }, 5000);
  }
}

// Carregar próximos horários disponíveis (hoje e amanhã)
async function carregarProximosHorarios() {
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const hojeStr = formatarData(hoje);
  const amanhaStr = formatarData(amanha);

  const horariosHojeAmanhaEl = document.getElementById("horariosHojeAmanha");
  const verMaisBtn = document.getElementById("verMaisHorariosBtn");

  try {
    if (DEBUG)
      console.log("📅 Carregando horários para:", {
        hoje: hojeStr,
        amanha: amanhaStr,
      });

    // Carregar disponibilidade para hoje e amanhã (sem serviços selecionados, retorna lista simples)
    const [hojeResponse, amanhaResponse] = await Promise.all([
      fetch(`${API_URL}/horarios-disponiveis?data=${hojeStr}`),
      fetch(`${API_URL}/horarios-disponiveis?data=${amanhaStr}`),
    ]);

    if (!hojeResponse.ok || !amanhaResponse.ok) {
      throw new Error("Erro ao buscar horários disponíveis");
    }

    const hojeData = await hojeResponse.json();
    const amanhaData = await amanhaResponse.json();

    if (DEBUG)
      console.log("📊 Dados recebidos:", {
        hoje: hojeData,
        amanha: amanhaData,
      });

    // O endpoint retorna {horarios: [...]} - sempre array agora
    let todosHorariosHoje = [];
    let todosHorariosAmanha = [];

    // Verificar se é array (novo formato) ou objeto (formato antigo)
    if (Array.isArray(hojeData.horarios)) {
      todosHorariosHoje = hojeData.horarios;
    } else if (hojeData.horarios && typeof hojeData.horarios === "object") {
      // Formato antigo com períodos - extrair todos os horários
      Object.values(hojeData.horarios).forEach((horarios) => {
        if (Array.isArray(horarios)) {
          todosHorariosHoje.push(...horarios);
        }
      });
    }

    if (Array.isArray(amanhaData.horarios)) {
      todosHorariosAmanha = amanhaData.horarios;
    } else if (amanhaData.horarios && typeof amanhaData.horarios === "object") {
      // Formato antigo com períodos - extrair todos os horários
      Object.values(amanhaData.horarios).forEach((horarios) => {
        if (Array.isArray(horarios)) {
          todosHorariosAmanha.push(...horarios);
        }
      });
    }

    if (DEBUG)
      console.log("⏰ Horários extraídos:", {
        hoje: todosHorariosHoje.length,
        amanha: todosHorariosAmanha.length,
        hojeLista: todosHorariosHoje.slice(0, 5),
        amanhaLista: todosHorariosAmanha.slice(0, 5),
      });

    // Ordenar horários
    todosHorariosHoje.sort();
    todosHorariosAmanha.sort();

    // Limitar a 6 horários por dia
    const horariosHojeLimitados = todosHorariosHoje.slice(0, 6);
    const horariosAmanhaLimitados = todosHorariosAmanha.slice(0, 6);

    let html = "";

    if (horariosHojeLimitados.length > 0) {
      const hojeFormatado = hoje.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      html += `<div class="horario-dia"><strong>Hoje (${hojeFormatado}):</strong> ${horariosHojeLimitados.join(", ")}</div>`;
    }

    if (horariosAmanhaLimitados.length > 0) {
      const amanhaFormatado = amanha.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      html += `<div class="horario-dia"><strong>Amanhã (${amanhaFormatado}):</strong> ${horariosAmanhaLimitados.join(", ")}</div>`;
    }

    if (html === "") {
      html =
        '<div class="horario-dia">Nenhum horário disponível para hoje ou amanhã</div>';
    }

    horariosHojeAmanhaEl.innerHTML = html;

    // Mostrar botão "Ver mais" se houver mais horários
    if (todosHorariosHoje.length > 6 || todosHorariosAmanha.length > 6) {
      verMaisBtn.style.display = "inline-block";
    } else {
      verMaisBtn.style.display = "none";
    }
  } catch (error) {
    if (DEBUG) console.error("❌ Erro ao carregar próximos horários:", error);
    if (DEBUG) console.error("   Stack:", error.stack);
    horariosHojeAmanhaEl.innerHTML =
      '<div class="horario-dia">Erro ao carregar horários. Tente novamente.</div>';
  }
}

// Renderizar serviços iniciais (seleção antes do calendário)
function renderizarServicosIniciais() {
  const servicosGridEl = document.getElementById("servicosGrid");
  if (!servicosGridEl) return;

  servicosGridEl.innerHTML = "";

  Object.keys(servicos).forEach((nomeServico) => {
    const valor = toMoneyNumber(servicos[nomeServico] || 0);
    const servicoCard = document.createElement("div");
    servicoCard.className = "servico-card-inicial";
    servicoCard.dataset.servico = nomeServico;

    servicoCard.innerHTML = `
    <h4>${nomeServico}</h4>
    <p class="price">R$ ${valor.toFixed(2).replace(".", ",")}</p>
  `;
    servicoCard.addEventListener("click", () => {
      // Selecionar serviço e mostrar calendário
      servicosSelecionados = [nomeServico];
      servicoSelecionado = nomeServico;

      // Esconder seleção de serviços e mostrar calendário
      document.getElementById("selecaoServicoInicial").style.display = "none";
      document.getElementById("bookingGrid").style.display = "grid";

      // Carregar disponibilidade
      carregarDisponibilidade14Dias();
    });

    servicosGridEl.appendChild(servicoCard);
  });
}

// Carregar disponibilidade apenas para próximos 14 dias
async function carregarDisponibilidade14Dias() {
  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 14);

  // Calcular mês inicial e final
  const mesInicial = hoje.getMonth() + 1;
  const anoInicial = hoje.getFullYear();
  const mesFinal = fim.getMonth() + 1;
  const anoFinal = fim.getFullYear();

  disponibilidade = {};

  try {
    // Carregar disponibilidade para os meses necessários
    const mesesParaCarregar = [];
    let mesAtual = mesInicial;
    let anoAtual = anoInicial;

    while (
      anoAtual < anoFinal ||
      (anoAtual === anoFinal && mesAtual <= mesFinal)
    ) {
      mesesParaCarregar.push({ mes: mesAtual, ano: anoAtual });
      mesAtual++;
      if (mesAtual > 12) {
        mesAtual = 1;
        anoAtual++;
      }
    }

    // Carregar todos os meses em paralelo
    const promises = mesesParaCarregar.map(({ mes, ano }) =>
      fetch(`${API_URL}/disponibilidade-mes?mes=${mes}&ano=${ano}`)
        .then((r) => r.json())
        .then((data) => ({ mes, ano, data: data.disponibilidade || {} })),
    );

    const resultados = await Promise.all(promises);

    // Consolidar dados
    resultados.forEach(({ data }) => {
      Object.assign(disponibilidade, data);
    });

    // Filtrar apenas próximos 14 dias e garantir que todos os dias tenham dados
    const disponibilidadeFiltrada = {};
    const promisesHorarios = [];

    for (let i = 0; i < 14; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + i);
      const dataStr = formatarData(data);

      if (disponibilidade[dataStr] !== undefined) {
        const v = disponibilidade[dataStr];
        disponibilidadeFiltrada[dataStr] = Array.isArray(v)
          ? arrayHorariosParaPeriodos(v)
          : v;
      } else {
        // Se não tem dados do mês, buscar individualmente (fallback)
        if (DEBUG)
          console.log(
            `⚠️ Data ${dataStr} não encontrada no mês, buscando individualmente...`,
          );
        promisesHorarios.push(
          fetch(`${API_URL}/horarios-disponiveis?data=${dataStr}`)
            .then((r) => r.json())
            .then((data) => {
              if (
                data.horarios &&
                Array.isArray(data.horarios) &&
                data.horarios.length > 0
              ) {
                // Converter lista de horários para formato de períodos
                const periodos = {};
                const ordem_periodos = ["manhã", "tarde", "noite"];
                const PERIODOS = {
                  manhã: [
                    "07:00",
                    "07:30",
                    "08:00",
                    "08:30",
                    "09:00",
                    "09:30",
                    "10:00",
                    "10:30",
                    "11:00",
                    "11:30",
                  ],
                  tarde: [
                    "13:00",
                    "13:30",
                    "14:00",
                    "14:30",
                    "15:00",
                    "15:30",
                    "16:00",
                    "16:30",
                    "17:00",
                    "17:30",
                  ],
                  noite: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"],
                };

                for (const periodo of ordem_periodos) {
                  const horarios_periodo = PERIODOS[periodo];
                  const horarios_disponiveis_periodo = horarios_periodo.filter(
                    (h) => data.horarios.includes(h),
                  );
                  if (horarios_disponiveis_periodo.length > 0) {
                    periodos[periodo] = horarios_disponiveis_periodo;
                  }
                }

                if (Object.keys(periodos).length > 0) {
                  disponibilidadeFiltrada[dataStr] = periodos;
                } else {
                  disponibilidadeFiltrada[dataStr] = {};
                }
              } else {
                disponibilidadeFiltrada[dataStr] = {};
              }
            })
            .catch((err) => {
              if (DEBUG) console.error(`Erro ao buscar ${dataStr}:`, err);
              disponibilidadeFiltrada[dataStr] = {};
            }),
        );
      }
    }

    // Aguardar todas as buscas individuais se necessário
    if (promisesHorarios.length > 0) {
      await Promise.all(promisesHorarios);
    }

    disponibilidade = disponibilidadeFiltrada;
    if (DEBUG)
      console.log(
        "📊 Disponibilidade final após filtro:",
        Object.keys(disponibilidade),
      );

    // Renderizar calendário apenas com próximos 14 dias
    renderizarCalendario14Dias();

    // Atualizar indicadores de lotação
    atualizarIndicadoresLotacao();
  } catch (error) {
    if (DEBUG) console.error("Erro ao carregar disponibilidade:", error);
    mostrarMensagem(
      "Erro ao carregar disponibilidade. Tente novamente.",
      "error",
    );
  }
}

// Renderizar calendário apenas com próximos 14 dias
function renderizarCalendario14Dias() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  calendarGrid.innerHTML = "";

  // Cabeçalho dos dias da semana
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  diasSemana.forEach((dia) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = dia;
    calendarGrid.appendChild(header);
  });
  // Alinhar o 1º dia na coluna correta (Dom=0 ... Sáb=6)
  const offset = hoje.getDay(); // se hoje é quinta, offset = 4
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  if (DEBUG) if (DEBUG) console.log("📅 Renderizando calendário 14 dias");
  if (DEBUG)
    if (DEBUG)
      console.log(
        "   Disponibilidade carregada:",
        Object.keys(disponibilidade),
      );

  // Renderizar próximos 14 dias
  for (let i = 0; i < 14; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() + i);
    const dataStr = formatarData(data);
    const diaSemana = data.getDay();
    const isDomingo = diaSemana === 0;

    const horariosDisponiveis = disponibilidade[dataStr];
    if (DEBUG)
      if (DEBUG)
        console.log(`   Dia ${i + 1} (${dataStr}):`, {
          diaSemana: diaSemana,
          isDomingo: isDomingo,
          temDisponibilidade: !!horariosDisponiveis,
          disponibilidade: horariosDisponiveis,
        });

    let totalHorarios = 0;

    if (Array.isArray(horariosDisponiveis)) {
      totalHorarios = horariosDisponiveis.length;
    } else if (horariosDisponiveis && typeof horariosDisponiveis === "object") {
      totalHorarios = Object.values(horariosDisponiveis).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
    }

    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";

    if (isDomingo) {
      dayCell.classList.add("domingo");
    } else if (totalHorarios === 0) {
      dayCell.classList.add("sem-disponibilidade");
    } else {
      dayCell.classList.add("clickable");
      if (totalHorarios <= 3) dayCell.classList.add("poucos-horarios");
      else if (totalHorarios >= 8) dayCell.classList.add("muitos-horarios");
    }

    if (dataStr === dataSelecionada) {
      dayCell.classList.add("selected");
    }

    const diaNumero = data.getDate();
    const mesNome = data.toLocaleDateString("pt-BR", { month: "short" });

    dayCell.innerHTML = `
            <span class="day-number">${diaNumero}</span>
            <span class="day-month">${mesNome}</span>
            ${totalHorarios > 0 ? `<span class="horarios-count">${totalHorarios} horários</span>` : ""}
        `;

    if (!isDomingo && totalHorarios > 0) {
      dayCell.style.cursor = "pointer";
      dayCell.addEventListener("click", () => {
        selecionarData(dataStr, dayCell);
      });
    }

    calendarGrid.appendChild(dayCell);
  }

  // Atualizar título do calendário
  currentMonthEl.textContent = "Próximos 14 dias";
  prevMonthBtn.style.display = "none";
  nextMonthBtn.style.display = "none";
}

// Atualizar indicadores de lotação
function atualizarIndicadoresLotacao() {
  const lotacaoInfoEl = document.getElementById("lotacaoInfo");
  if (!lotacaoInfoEl) return;

  let totalHorarios = 0;
  let diasComHorarios = 0;

  Object.values(disponibilidade).forEach((horarios) => {
    let count = 0;

    if (Array.isArray(horarios)) {
      count = horarios.length;
    } else if (horarios && typeof horarios === "object") {
      count = Object.values(horarios).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
    }

    if (count > 0) {
      totalHorarios += count;
      diasComHorarios++;
    }
  });

  let mensagem = "";
  if (totalHorarios <= 10) {
    mensagem = `⚠️ Restam apenas ${totalHorarios} horários disponíveis nos próximos dias`;
  } else if (totalHorarios <= 30) {
    mensagem = `📅 Agenda quase cheia - ${totalHorarios} horários disponíveis`;
  } else {
    mensagem = `✅ ${totalHorarios} horários disponíveis nos próximos 14 dias`;
  }

  lotacaoInfoEl.innerHTML = `<p class="lotacao-text">${mensagem}</p>`;
}

// Inicializar quando o DOM estiver pronto
async function inicializar() {
  if (DEBUG) console.log("Inicializando aplicação...");

  // Carregar serviços
  await carregarServicos();

  // Renderizar seleção inicial de serviços
  renderizarServicosIniciais();

  // Carregar próximos horários disponíveis
  await carregarProximosHorarios();

  // Botão "Ver mais horários" mostra o calendário
  document
    .getElementById("verMaisHorariosBtn")
    .addEventListener("click", () => {
      document.getElementById("proximosHorarios").style.display = "none";
      document.querySelector(".horarios-ajuda-grid").style.display = "none";
      document.getElementById("selecaoServicoInicial").style.display = "block";
    });
}

if (document.readyState === "loading") {
  // DOM ainda está carregando, aguardar evento
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  // DOM já está pronto
  if (DEBUG) console.log("DOM já estava pronto");
  inicializar();
}
