// Configuração da API
// Usar caminho relativo quando servido pelo mesmo servidor Flask
// Isso evita problemas de CORS e funciona independente da porta
const API_URL = "https://backend-production-039a.up.railway.app/api";
const toNumber = (v) => Number(v ?? 0);

let agendamentos = [];
let filtros = {
  dataInicio: null,
  dataFim: null,
  status: "",
  nome: "",
  telefone: "",
};

// Carregar agendamentos
async function carregarAgendamentos() {
  const loading = document.getElementById("loading");
  const table = document.getElementById("agendamentos-table");
  const tbody = document.getElementById("agendamentos-tbody");

  loading.style.display = "block";
  table.style.display = "none";

  // Tentar detectar porta antes de fazer requisição
  //const portaDetectada = await detectarPorta();
  //if (!portaDetectada) {
  //    loading.innerHTML = '<div style="color: red; padding: 20px; text-align: center;"><>❌ Erro de Conexão<///strong><br><br>Não foi possível conectar ao servidor Flask.<br><br>Verifique se o servidor está rodando:<br><code>cd //backend && python3 app.py</code><br><br>Tentando portas: 5000, 5001, 5002, 5003</div>';
  //    console.error('❌ Não foi possível detectar a porta do servidor');
  //    return;
  //}

  try {
    const params = new URLSearchParams();
    if (filtros.dataInicio) params.append("data_inicio", filtros.dataInicio);
    if (filtros.dataFim) params.append("data_fim", filtros.dataFim);
    if (filtros.status) params.append("status", filtros.status);
    if (filtros.nome) params.append("nome", filtros.nome);
    if (filtros.telefone) params.append("telefone", filtros.telefone);

    // Adicionar timestamp para evitar cache
    params.append("_t", Date.now());

    // Obter token do localStorage
    const token = localStorage.getItem("admin_token");

    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    // Adicionar token no header Authorization se existir
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const urlCompleta = `${API_URL}/admin/agendamentos?${params.toString()}`;
    console.log("📥 Carregando agendamentos...", urlCompleta);
    console.log("   API_URL:", API_URL);
    console.log("   URL completa:", urlCompleta);

    console.log("📤 Fazendo requisição:", {
      url: urlCompleta,
      method: "GET",
      headers: headers,
      temToken: !!token,
    });

    let response;
    try {
      response = await fetch(urlCompleta, {
        credentials: "include",
        method: "GET",
        headers: headers,
        cache: "no-store", // Forçar sem cache
        mode: "cors", // Garantir modo CORS
      });
    } catch (fetchError) {
      console.error("❌ Erro na requisição fetch:", fetchError);
      console.error("   Tipo:", fetchError.name);
      console.error("   Mensagem:", fetchError.message);
      throw new Error(
        `Erro de conexão: ${fetchError.message}. Verifique se o servidor Flask está rodando na porta correta.`,
      );
    }

    console.log("📊 Status da resposta:", response.status);
    console.log("📊 Response OK:", response.ok);
    console.log(
      "📊 Response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "login.html";
        return;
      }
      const errorText = await response.text();
      console.error("❌ Erro na resposta:", errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("📋 Agendamentos recebidos:", data.length, "itens");
    console.log("📋 Dados completos:", data);

    // Verificar se há dados quando não deveria ter
    if (data.length > 0) {
      console.log(
        "⚠️ ATENÇÃO: Recebidos agendamentos do servidor:",
        data.length,
      );
      console.log(
        "   Primeiros IDs:",
        data.slice(0, 5).map((a) => a.id),
      );
    } else {
      console.log("✅ Nenhum agendamento recebido (banco vazio)");
    }

    agendamentos = data;
    renderizarAgendamentos();
    atualizarStats();

    loading.style.display = "none";
    table.style.display = "table";
  } catch (error) {
    console.error("❌ Erro ao carregar agendamentos:", error);
    console.error("   Tipo:", error.name);
    console.error("   Mensagem:", error.message);
    console.error("   Stack:", error.stack);
    console.error("   API_URL:", API_URL);

    const urlTentada = `${API_URL}/admin/agendamentos`;

    let mensagemErro = "Erro ao carregar agendamentos.";
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.name === "TypeError"
    ) {
      mensagemErro = `<div style="color: red; padding: 20px; text-align: center;">
                <strong>❌ Erro de Conexão</strong><br><br>
                Não foi possível conectar ao servidor Flask.<br><br>
                <strong>Verifique se o servidor está rodando:</strong><br>
                <code style="background: #f5f5f5; padding: 5px; border-radius: 3px;">cd backend && python3 app.py</code><br><br>
                <strong>URL tentada:</strong> ${urlTentada}<br>
                <strong>API_URL configurada:</strong> ${API_URL}<br><br>
                <small>Erro: ${error.message}</small>
            </div>`;
    } else {
      mensagemErro = `<div style="color: red; padding: 20px;">
                <strong>Erro:</strong> ${error.message}<br>
                <strong>URL:</strong> ${urlTentada}
            </div>`;
    }

    loading.innerHTML = mensagemErro;
  }
}

// Renderizar agendamentos na tabela
function renderizarAgendamentos() {
  const tbody = document.getElementById("agendamentos-tbody");

  if (agendamentos.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <div>📭</div>
                    <div>Nenhum agendamento encontrado</div>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = agendamentos
    .map((ag) => {
      const dataObj = new Date(ag.data + "T00:00:00");
      const dataFormatada = dataObj.toLocaleDateString("pt-BR");
      const valorFormatado = `R$ ${toNumber(ag.valor).toFixed(2).replace(".", ",")}`;

      // Determinar ações disponíveis
      const acoes = [];
      if (ag.status === "pendente") {
        acoes.push({
          label: "✓ Confirmar",
          status: "confirmado",
          class: "confirmar",
        });
      }
      if (ag.status !== "cancelado" && ag.status !== "concluido") {
        acoes.push({
          label: "✕ Cancelar",
          status: "cancelado",
          class: "cancelar",
        });
      }
      if (ag.status === "confirmado") {
        acoes.push({
          label: "✓ Concluir",
          status: "concluido",
          class: "concluir",
        });
      }

      // Criar menu dropdown com todas as ações
      const menuId = `menu-${ag.id}`;
      const menuHtml = `
            <div class="actions-menu">
                <button class="menu-toggle" onclick="toggleMenu('${menuId}')" title="Ações">⋯</button>
                <div class="menu-dropdown" id="${menuId}">
                    <button class="menu-item editar" onclick="editarAgendamento(${ag.id}); toggleMenu('${menuId}');">
                        ✏️ Editar
                    </button>
                    ${acoes
                      .map(
                        (acao) => `
                        <button class="menu-item ${acao.class}" onclick="atualizarStatus(${ag.id}, '${acao.status}'); toggleMenu('${menuId}');">
                            ${acao.label}
                        </button>
                    `,
                      )
                      .join("")}
                    <button class="menu-item deletar" onclick="deletarAgendamento(${ag.id}); toggleMenu('${menuId}');">
                        🗑️ Deletar
                    </button>
                </div>
            </div>
        `;

      // Formatar status
      const statusFormatado =
        {
          pendente: "Pendente",
          confirmado: "Confirmado",
          cancelado: "Cancelado",
          concluido: "Concluído",
        }[ag.status] || ag.status;

      // Formatar forma de pagamento
      const formasPagamento = {
        pendente: "Pendente",
        pix: "PIX",
        cartao: "Cartão",
      };
      const formaPagamentoFormatada =
        formasPagamento[ag.forma_pagamento] || ag.forma_pagamento || "Pendente";
      const formaPagamentoClasse = ag.forma_pagamento || "pendente";

      // Formatar status de pagamento
      const pago = ag.pago || false;
      const dataPagamento = ag.data_pagamento
        ? new Date(ag.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")
        : "-";
      const pagoBadge = pago
        ? '<span class="status-badge status-concluido">✓ Pago</span>'
        : '<span class="status-badge status-pendente">Pendente</span>';

      return `
            <tr>
                <td><strong style="color: #D4A574;">#${ag.id}</strong></td>
                <td>${ag.nome}</td>
                <td style="color: #6C757D;">${formatarTelefone(ag.telefone)}</td>
                <td>${ag.servico}</td>
                <td>${dataFormatada}</td>
                <td>${ag.horario}</td>
                <td><strong style="color: #28A745;">${valorFormatado}</strong></td>
                <td><span class="status-badge status-${ag.status}">${statusFormatado}</span></td>
                <td><span class="pagamento-badge pagamento-${formaPagamentoClasse}">${formaPagamentoFormatada}</span></td>
                <td>${pagoBadge}</td>
                <td style="color: #6C757D; font-size: 13px;">${dataPagamento}</td>
                <td>${menuHtml}</td>
            </tr>
        `;
    })
    .join("");

  // Fechar menus ao clicar fora
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".actions-menu")) {
      document.querySelectorAll(".menu-dropdown").forEach((menu) => {
        menu.classList.remove("show");
      });
    }
  });
}

// Atualizar estatísticas
function atualizarStats() {
  const total = agendamentos.length;
  const pendentes = agendamentos.filter((a) => a.status === "pendente").length;
  const confirmados = agendamentos.filter(
    (a) => a.status === "confirmado",
  ).length;
  const concluidos = agendamentos.filter(
    (a) => a.status === "concluido",
  ).length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-pendentes").textContent = pendentes;
  document.getElementById("stat-confirmados").textContent = confirmados;
  document.getElementById("stat-concluidos").textContent = concluidos;
}

// Atualizar status do agendamento
async function atualizarStatus(id, novoStatus) {
  if (!confirm(`Deseja realmente alterar o status para "${novoStatus}"?`)) {
    return;
  }

  try {
    // Obter token do localStorage
    const token = localStorage.getItem("admin_token");

    const headers = {
      "Content-Type": "application/json",
    };

    // Adicionar token no header Authorization se existir
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/admin/agendamentos/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: headers,
      body: JSON.stringify({ status: novoStatus }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await carregarAgendamentos();
    alert("Status atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    alert("Erro ao atualizar status. Tente novamente.");
  }
}

// Aplicar filtros
function aplicarFiltros() {
  filtros.dataInicio = document.getElementById("filter-data-inicio").value;
  filtros.dataFim = document.getElementById("filter-data-fim").value;
  filtros.status = document.getElementById("filter-status").value;
  filtros.nome = document.getElementById("filter-nome").value.trim();
  filtros.telefone = document
    .getElementById("filter-telefone")
    .value.trim()
    .replace(/\D/g, "");

  carregarAgendamentos();
}

// Limpar filtros
function limparFiltros() {
  document.getElementById("filter-data-inicio").value = "";
  document.getElementById("filter-data-fim").value = "";
  document.getElementById("filter-status").value = "";
  document.getElementById("filter-nome").value = "";
  document.getElementById("filter-telefone").value = "";

  filtros = {
    dataInicio: null,
    dataFim: null,
    status: "",
    nome: "",
    telefone: "",
  };

  carregarAgendamentos();
}

// Formatar telefone
function formatarTelefone(telefone) {
  const apenasNumeros = telefone.replace(/\D/g, "");
  if (apenasNumeros.length === 11) {
    return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 7)}-${apenasNumeros.substring(7)}`;
  } else if (apenasNumeros.length === 10) {
    return `(${apenasNumeros.substring(0, 2)}) ${apenasNumeros.substring(2, 6)}-${apenasNumeros.substring(6)}`;
  }
  return telefone;
}

// Verificar autenticação
async function verificarAutenticacao() {
  try {
    // Obter token do localStorage
    const token = localStorage.getItem("admin_token");

    const headers = {
      "Cache-Control": "no-cache",
    };

    // Adicionar token no header Authorization se existir
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/admin/verify`, {
      credentials: "include",
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Não autenticado - redirecionar para login
        console.log("Não autenticado, redirecionando para login...");
        window.location.href = "login.html";
        return false;
      }
      // Outro erro HTTP - tentar novamente uma vez antes de redirecionar
      console.warn("Erro HTTP ao verificar autenticação:", response.status);
      return false;
    }

    const result = await response.json();
    if (!result.authenticated) {
      console.log("Sessão não autenticada, redirecionando para login...");
      window.location.href = "login.html";
      return false;
    }

    console.log("✅ Autenticação verificada com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao verificar autenticação:", error);
    // Não redirecionar imediatamente em caso de erro de rede
    // Pode ser um problema temporário
    return false;
  }
}

// Toggle menu dropdown
function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  const allMenus = document.querySelectorAll(".menu-dropdown");

  // Fechar todos os outros menus
  allMenus.forEach((m) => {
    if (m.id !== menuId) {
      m.classList.remove("show");
    }
  });

  // Toggle do menu atual
  menu.classList.toggle("show");
}

// Logout
function fazerLogout() {
  if (confirm("Deseja realmente sair?")) {
    // Remover token do localStorage
    localStorage.removeItem("admin_token");

    fetch(`${API_URL}/admin/logout`, {
      method: "POST",
      credentials: "include",
    }).then(() => {
      window.location.href = "login.html";
    });
  }
}

// Limpar todos os agendamentos
async function limparTodosAgendamentos() {
  const confirmacao = prompt(
    '⚠️ ATENÇÃO: Isso vai deletar TODOS os agendamentos!\n\nDigite "LIMPAR" para confirmar:',
  );

  if (confirmacao !== "LIMPAR") {
    alert("Operação cancelada.");
    return;
  }

  const token = localStorage.getItem("admin_token");

  if (!token) {
    alert("❌ Erro: Você precisa estar logado para limpar agendamentos.");
    return;
  }

  try {
    console.log("🗑️ Iniciando limpeza de agendamentos...");
    console.log("Token:", token ? token.substring(0, 20) + "..." : "Nenhum");
    console.log("API_URL:", API_URL);

    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${token}`,
    };

    console.log(
      "Enviando requisição para:",
      `${API_URL}/admin/limpar-agendamentos`,
    );

    const response = await fetch(`${API_URL}/admin/limpar-agendamentos`, {
      method: "POST",
      credentials: "include",
      headers: headers,
    });

    console.log("Status da resposta:", response.status);
    console.log("Status OK?", response.ok);

    const data = await response.json();
    console.log("Resposta do servidor:", data);

    if (response.ok && data.success) {
      alert(`✅ ${data.message}`);
      // Limpar array local também
      agendamentos = [];
      // Limpar filtros
      filtros = {
        dataInicio: null,
        dataFim: null,
        status: "",
        nome: "",
        telefone: "",
      };
      // Limpar campos de filtro na interface
      document.getElementById("filter-data-inicio").value = "";
      document.getElementById("filter-data-fim").value = "";
      document.getElementById("filter-status").value = "";
      document.getElementById("filter-nome").value = "";
      document.getElementById("filter-telefone").value = "";
      // Aguardar um pouco antes de recarregar (garantir que o banco foi atualizado)
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Recarregar lista (deve estar vazia agora) - forçar sem cache
      await carregarAgendamentos();
      // Forçar atualização das estatísticas
      atualizarStats();
    } else {
      console.error("Erro na resposta:", data);
      if (response.status === 401) {
        alert("❌ Erro: Você não está autenticado. Faça login novamente.");
        window.location.href = "login.html";
      } else {
        alert(`❌ Erro: ${data.error || "Erro ao limpar agendamentos"}`);
      }
    }
  } catch (error) {
    console.error("Erro ao limpar agendamentos:", error);
    alert(`❌ Erro ao conectar com o servidor: ${error.message}`);
  }
}

// Botão de logout já está no HTML, não precisa criar dinamicamente

// Variável global para serviços
let servicosDisponiveis = [];

// Carregar serviços disponíveis
async function carregarServicos() {
  try {
    const response = await fetch(`${API_URL}/servicos`);
    if (response.ok) {
      servicosDisponiveis = await response.json();
    }
  } catch (error) {
    console.error("Erro ao carregar serviços:", error);
  }
}

// Editar agendamento
async function editarAgendamento(id) {
  const token = localStorage.getItem("admin_token");

  try {
    const headers = {
      "Cache-Control": "no-cache",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Carregar serviços se ainda não carregou
    if (servicosDisponiveis.length === 0) {
      await carregarServicos();
    }

    // Buscar dados do agendamento
    const response = await fetch(`${API_URL}/admin/agendamentos/${id}`, {
      credentials: "include",
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const agendamento = await response.json();

    // Preencher formulário
    document.getElementById("edit-id").value = agendamento.id;
    document.getElementById("edit-nome").value = agendamento.nome;
    document.getElementById("edit-telefone").value = agendamento.telefone;
    document.getElementById("edit-data").value = agendamento.data;
    document.getElementById("edit-horario").value = agendamento.horario;
    document.getElementById("edit-valor").value = toNumber(
      agendamento.valor,
    ).toFixed(2);
    document.getElementById("edit-status").value = agendamento.status;
    document.getElementById("edit-forma-pagamento").value =
      agendamento.forma_pagamento || "pendente";
    document.getElementById("edit-pago").value = agendamento.pago
      ? "true"
      : "false";
    document.getElementById("edit-data-pagamento").value =
      agendamento.data_pagamento || "";

    // Preencher serviços (múltiplos)
    const servicosSelect = document.getElementById("edit-servicos");
    servicosSelect.innerHTML = "";
    servicosDisponiveis.forEach((servico) => {
      const option = document.createElement("option");
      option.value = servico.nome;
      option.textContent = `${servico.nome} - R$ ${servico.toNumber(servico.valor).toFixed(2)}`;
      // Marcar como selecionado se estiver na lista de serviços do agendamento
      const servicosAgendamento = agendamento.servico
        .split(", ")
        .map((s) => s.trim());
      if (servicosAgendamento.includes(servico.nome)) {
        option.selected = true;
      }
      servicosSelect.appendChild(option);
    });

    // Mostrar modal
    document.getElementById("editModal").classList.add("show");
  } catch (error) {
    console.error("Erro ao carregar agendamento:", error);
    alert("Erro ao carregar dados do agendamento.");
  }
}

// Fechar modal
function fecharModal() {
  document.getElementById("editModal").classList.remove("show");
  document.getElementById("editForm").reset();
}

// Abrir modal de criar agendamento
async function abrirModalCriar() {
  // Carregar serviços se ainda não foram carregados
  if (servicosDisponiveis.length === 0) {
    await carregarServicos();
  }

  // Preencher select de serviços
  const servicosSelect = document.getElementById("create-servicos");
  servicosSelect.innerHTML = "";
  servicosDisponiveis.forEach((servico) => {
    const option = document.createElement("option");
    option.value = servico.nome;
    option.textContent = `${servico.nome} - R$ ${toNumber(servico.valor).toFixed(2).replace(".", ",")}`;
    servicosSelect.appendChild(option);
  });

  // Limpar formulário
  document.getElementById("createForm").reset();

  // Resetar campo de horário
  const horarioSelect = document.getElementById("create-horario");
  horarioSelect.innerHTML =
    '<option value="">Selecione primeiro os serviços e a data</option>';
  horarioSelect.disabled = true;
  document.getElementById("create-horario-loading").style.display = "none";
  document.getElementById("create-horario-empty").style.display = "none";

  // Remover restrição de data mínima para permitir criação de histórico retroativo
  document.getElementById("create-data").removeAttribute("min");

  // Configurar autocomplete de clientes quando o modal é aberto
  configurarAutocompleteClientes();

  // Mostrar modal
  document.getElementById("createModal").classList.add("show");
}

// Flag para evitar adicionar listeners múltiplas vezes
let autocompleteConfigurado = false;

// Configurar autocomplete de clientes (chamado quando modal é aberto)
function configurarAutocompleteClientes() {
  const nomeInputCreate = document.getElementById("create-nome");
  const telefoneInputCreate = document.getElementById("create-telefone");
  const suggestionsDiv = document.getElementById("clientes-suggestions");
  const clienteIndicator = document.getElementById("cliente-indicator");

  if (!nomeInputCreate || !telefoneInputCreate || !suggestionsDiv) {
    console.warn("⚠️ Elementos do autocomplete não encontrados:", {
      nomeInput: !!nomeInputCreate,
      telefoneInput: !!telefoneInputCreate,
      suggestionsDiv: !!suggestionsDiv,
    });
    return;
  }

  // Se já foi configurado, não configurar novamente
  if (
    autocompleteConfigurado &&
    nomeInputCreate.dataset.autocompleteConfigurado === "true"
  ) {
    console.log("✅ Autocomplete já configurado, pulando...");
    return;
  }

  // Marcar como configurado
  nomeInputCreate.dataset.autocompleteConfigurado = "true";
  autocompleteConfigurado = true;

  const nomeInput = nomeInputCreate;
  let timeoutBusca = null;

  // Mostrar sugestões ao focar no campo (mesmo vazio)
  nomeInput.addEventListener("focus", function () {
    console.log("🔍 Campo de nome focado, buscando clientes...");
    buscarClientes(this.value);
  });

  nomeInput.addEventListener("input", function () {
    const nomeDigitado = this.value.trim();
    console.log("⌨️ Digitando no campo de nome:", nomeDigitado);

    // Resetar indicador
    if (clienteIndicator) {
      clienteIndicator.textContent = "🔍";
      clienteIndicator.style.color = "#999";
    }

    // Limpar timeout anterior
    if (timeoutBusca) {
      clearTimeout(timeoutBusca);
    }

    // Buscar imediatamente se vazio (para mostrar todos) ou após 300ms se digitando
    if (nomeDigitado.length === 0) {
      console.log("📋 Campo vazio, buscando todos os clientes...");
      buscarClientes("");
    } else {
      timeoutBusca = setTimeout(async () => {
        console.log("🔍 Buscando clientes com nome:", nomeDigitado);
        await buscarClientes(nomeDigitado);
      }, 300);
    }
  });

  // Permitir navegação com teclado nas sugestões
  nomeInput.addEventListener("keydown", function (e) {
    const items = suggestionsDiv.querySelectorAll(".suggestion-item");
    const currentIndex = Array.from(items).findIndex((item) =>
      item.classList.contains("highlighted"),
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items.forEach((item, idx) => {
        item.classList.toggle("highlighted", idx === nextIndex);
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items.forEach((item, idx) => {
        item.classList.toggle("highlighted", idx === prevIndex);
      });
    } else if (e.key === "Enter" && currentIndex >= 0) {
      e.preventDefault();
      items[currentIndex].click();
    } else if (e.key === "Escape") {
      suggestionsDiv.classList.remove("show");
    }
  });

  // Esconder sugestões ao clicar fora
  document.addEventListener("click", function (e) {
    if (!nomeInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.classList.remove("show");
    }
  });
}

// Buscar horários disponíveis para criar agendamento
async function buscarHorariosDisponiveisCriar() {
  const servicosSelect = document.getElementById("create-servicos");
  const dataInput = document.getElementById("create-data");
  const horarioSelect = document.getElementById("create-horario");
  const loadingMsg = document.getElementById("create-horario-loading");
  const emptyMsg = document.getElementById("create-horario-empty");

  // Obter serviços selecionados
  const servicosSelecionados = Array.from(servicosSelect.selectedOptions).map(
    (opt) => opt.value,
  );
  const dataSelecionada = dataInput.value;

  // Resetar campo de horário
  horarioSelect.innerHTML = '<option value="">Carregando...</option>';
  horarioSelect.disabled = true;
  loadingMsg.style.display = "none";
  emptyMsg.style.display = "none";

  // Verificar se tem serviços e data selecionados
  if (servicosSelecionados.length === 0 || !dataSelecionada) {
    horarioSelect.innerHTML =
      '<option value="">Selecione primeiro os serviços e a data</option>';
    return;
  }

  // Mostrar loading
  loadingMsg.style.display = "block";

  try {
    // Construir parâmetro de serviços (separado por vírgula)
    const servicosParam = servicosSelecionados.join(",");

    // Buscar horários disponíveis
    const response = await fetch(
      `${API_URL}/horarios-disponiveis?data=${dataSelecionada}&servicos=${encodeURIComponent(servicosParam)}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const horariosDisponiveis = result.horarios || [];

    console.log("⏰ Horários disponíveis retornados:", horariosDisponiveis);

    // Limpar loading
    loadingMsg.style.display = "none";

    // Preencher select com horários disponíveis
    horarioSelect.innerHTML = "";

    if (horariosDisponiveis.length === 0) {
      horarioSelect.innerHTML =
        '<option value="">Nenhum horário disponível</option>';
      horarioSelect.disabled = true;
      emptyMsg.style.display = "block";
    } else {
      // Ordenar horários
      horariosDisponiveis.sort();

      // Adicionar opções
      horariosDisponiveis.forEach((horario) => {
        const option = document.createElement("option");
        option.value = horario;
        option.textContent = horario;
        horarioSelect.appendChild(option);
      });

      horarioSelect.disabled = false;
      emptyMsg.style.display = "none";
    }
  } catch (error) {
    console.error("Erro ao buscar horários disponíveis:", error);
    loadingMsg.style.display = "none";
    horarioSelect.innerHTML =
      '<option value="">Erro ao carregar horários</option>';
    horarioSelect.disabled = true;
    alert("Erro ao buscar horários disponíveis. Tente novamente.");
  }
}

function fecharModalCriar() {
  document.getElementById("createModal").classList.remove("show");
  document.getElementById("createForm").reset();
  // Esconder sugestões ao fechar modal
  const suggestionsDiv = document.getElementById("clientes-suggestions");
  if (suggestionsDiv) {
    suggestionsDiv.classList.remove("show");
  }
  // Resetar flag para permitir reconfiguração quando modal for reaberto
  const nomeInput = document.getElementById("create-nome");
  if (nomeInput) {
    nomeInput.dataset.autocompleteConfigurado = "false";
  }
}

// Buscar clientes para autocomplete
async function buscarClientes(nome) {
  console.log("🔍 buscarClientes chamado com nome:", nome);
  const token = localStorage.getItem("admin_token");
  const suggestionsDiv = document.getElementById("clientes-suggestions");
  const telefoneInput = document.getElementById("create-telefone");
  const nomeInput = document.getElementById("create-nome");
  const clienteIndicator = document.getElementById("cliente-indicator");

  if (!suggestionsDiv || !telefoneInput || !nomeInput) {
    console.error("❌ Elementos não encontrados:", {
      suggestionsDiv: !!suggestionsDiv,
      telefoneInput: !!telefoneInput,
      nomeInput: !!nomeInput,
    });
    return;
  }

  // Se campo vazio, mostrar todos os clientes recentes
  if (!nome || nome.trim().length === 0) {
    nome = "";
  } else {
    nome = nome.trim();
  }

  try {
    const headers = {
      "Cache-Control": "no-cache",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Se não há texto, buscar últimos clientes cadastrados (passar string vazia)
    const url = `${API_URL}/admin/clientes?nome=${nome.length > 0 ? encodeURIComponent(nome) : ""}`;
    console.log("📡 Buscando clientes na URL:", url);

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: headers,
    });

    console.log("📥 Resposta recebida:", response.status, response.statusText);

    if (!response.ok) {
      console.error(
        "❌ Erro na resposta:",
        response.status,
        response.statusText,
      );
      suggestionsDiv.classList.remove("show");
      return;
    }

    const clientes = await response.json();
    console.log("✅ Clientes recebidos:", clientes.length, clientes);

    // Sempre mostrar sugestões, mesmo se vazio (para permitir cadastrar novo)
    suggestionsDiv.innerHTML = "";

    // Se encontrou clientes, mostrar lista
    if (clientes.length > 0) {
      // Se encontrou apenas um cliente e o nome é exato (case-insensitive), preencher automaticamente
      if (
        clientes.length === 1 &&
        nome.length > 0 &&
        clientes[0].nome.toLowerCase() === nome.toLowerCase()
      ) {
        nomeInput.value = clientes[0].nome;
        telefoneInput.value = clientes[0].telefone.replace(/\D/g, "");
        clienteIndicator.textContent = "✓";
        clienteIndicator.style.color = "#28a745";
        suggestionsDiv.classList.remove("show");
        return;
      }

      // Mostrar lista de clientes encontrados
      clientes.forEach((cliente) => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.innerHTML = `
                    <div class="suggestion-nome">${cliente.nome}</div>
                    <div class="suggestion-telefone">${formatarTelefone(cliente.telefone)}</div>
                `;
        item.addEventListener("click", function () {
          nomeInput.value = cliente.nome;
          telefoneInput.value = cliente.telefone.replace(/\D/g, "");
          clienteIndicator.textContent = "✓";
          clienteIndicator.style.color = "#28a745";
          suggestionsDiv.classList.remove("show");
        });
        suggestionsDiv.appendChild(item);
      });
    }

    // Sempre mostrar opção para cadastrar novo cliente
    const novoClienteItem = document.createElement("div");
    novoClienteItem.className = "suggestion-item";
    novoClienteItem.style.borderTop = "2px solid #ddd";
    novoClienteItem.style.background = "#f8f9fa";
    novoClienteItem.style.fontWeight = "600";
    novoClienteItem.innerHTML = `
            <div style="color: #D4A574;">➕ Cadastrar novo cliente: "${nome || "..."}"</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Clique para usar este nome e cadastrar</div>
        `;
    novoClienteItem.addEventListener("click", function () {
      // Manter o nome digitado e permitir preencher telefone manualmente
      if (nome.length > 0) {
        nomeInput.value = nome;
      }
      clienteIndicator.textContent = "✎";
      clienteIndicator.style.color = "#D4A574";
      telefoneInput.focus(); // Focar no campo de telefone para preencher
      suggestionsDiv.classList.remove("show");
    });
    suggestionsDiv.appendChild(novoClienteItem);

    suggestionsDiv.classList.add("show");
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    suggestionsDiv.classList.remove("show");
  }
}

// Salvar alterações do agendamento
document.addEventListener("DOMContentLoaded", function () {
  const editForm = document.getElementById("editForm");
  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const id = document.getElementById("edit-id").value;
      const nome = document.getElementById("edit-nome").value.trim();
      const telefone = document
        .getElementById("edit-telefone")
        .value.replace(/\D/g, "");
      const data = document.getElementById("edit-data").value;
      const horario = document.getElementById("edit-horario").value;
      const valor = parseFloat(document.getElementById("edit-valor").value);
      const status = document.getElementById("edit-status").value;
      const formaPagamento = document.getElementById(
        "edit-forma-pagamento",
      ).value;
      const pago = document.getElementById("edit-pago").value === "true";
      const dataPagamento =
        document.getElementById("edit-data-pagamento").value || null;

      // Obter serviços selecionados
      const servicosSelect = document.getElementById("edit-servicos");
      const servicosSelecionados = Array.from(
        servicosSelect.selectedOptions,
      ).map((opt) => opt.value);

      if (servicosSelecionados.length === 0) {
        alert("Selecione pelo menos um serviço.");
        return;
      }

      const token = localStorage.getItem("admin_token");

      try {
        const headers = {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/admin/agendamentos/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: headers,
          body: JSON.stringify({
            nome: nome,
            telefone: telefone,
            servico: servicosSelecionados,
            data: data,
            horario: horario,
            valor: valor,
            status: status,
            forma_pagamento: formaPagamento,
            pago: pago,
            data_pagamento: dataPagamento,
          }),
        });

        const responseDataEdit = await response.json();

        if (response.ok && responseDataEdit.success) {
          alert("✅ Agendamento atualizado com sucesso!");
          fecharModal();
          await carregarAgendamentos();
        } else {
          alert(
            `❌ Erro: ${responseDataEdit.error || "Erro ao atualizar agendamento"}`,
          );
        }
      } catch (error) {
        console.error("Erro ao atualizar agendamento:", error);
        alert("❌ Erro ao conectar com o servidor.");
      }
    });

    // Fechar modal ao clicar fora
    const editModal = document.getElementById("editModal");
    if (editModal) {
      editModal.addEventListener("click", function (e) {
        if (e.target === this) {
          fecharModal();
        }
      });
    }

    // Event listener para modal de criar
    const createModal = document.getElementById("createModal");
    if (createModal) {
      createModal.addEventListener("click", function (e) {
        if (e.target === this) {
          fecharModalCriar();
        }
      });
    }

    // Event listeners para buscar horários quando serviços ou data mudarem (adicionar apenas uma vez)
    const servicosSelectCreate = document.getElementById("create-servicos");
    const dataInputCreate = document.getElementById("create-data");
    if (servicosSelectCreate && dataInputCreate) {
      // Adicionar listeners (usar {once: false} para permitir múltiplas chamadas)
      servicosSelectCreate.addEventListener(
        "change",
        buscarHorariosDisponiveisCriar,
      );
      dataInputCreate.addEventListener(
        "change",
        buscarHorariosDisponiveisCriar,
      );
    }

    // Autocomplete será configurado quando o modal for aberto (em abrirModalCriar)

    // Formulário de criar agendamento
    const createForm = document.getElementById("createForm");
    if (createForm) {
      createForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nome = document.getElementById("create-nome").value.trim();
        const telefone = document
          .getElementById("create-telefone")
          .value.replace(/\D/g, "");
        const dataAgendamento = document.getElementById("create-data").value;
        const horario = document.getElementById("create-horario").value;
        const status = document.getElementById("create-status").value;
        const formaPagamento = document.getElementById(
          "create-forma-pagamento",
        ).value;
        const pago = document.getElementById("create-pago").value === "true";
        const dataPagamento =
          document.getElementById("create-data-pagamento").value || null;

        const servicosSelect = document.getElementById("create-servicos");
        const servicosSelecionados = Array.from(
          servicosSelect.selectedOptions,
        ).map((opt) => opt.value);

        if (servicosSelecionados.length === 0) {
          alert("Selecione pelo menos um serviço.");
          return;
        }

        if (!nome || !telefone || !dataAgendamento || !horario) {
          alert("Preencha todos os campos obrigatórios.");
          return;
        }

        const token = localStorage.getItem("admin_token");

        // Garantir que a porta foi detectada antes de fazer a requisição
        //const portaOk = await detectarPorta();
        //if (!portaOk) {
        //    alert('❌ Erro: Não foi possível conectar ao servidor Flask.\n\nVerifique se o servidor está rodando:\ncd //backend && python3 app.py');
        //    return;
        //}

        try {
          // Preparar dados do agendamento (igual à página de agendamento)
          const formData = {
            nome: nome,
            telefone: telefone,
            servicos: servicosSelecionados,
            data: dataAgendamento,
            horario: horario,
          };

          // Se status foi fornecido e não é 'pendente', adicionar ao formData
          if (status && status !== "pendente") {
            formData.status = status;
          }

          // Adicionar forma de pagamento
          if (formaPagamento) {
            formData.forma_pagamento = formaPagamento;
          }

          // Adicionar campos de pagamento
          formData.pago = pago;
          if (dataPagamento) {
            formData.data_pagamento = dataPagamento;
          }

          const jsonBody = JSON.stringify(formData);
          console.log("📤 Criando agendamento:", formData);
          console.log("📤 JSON sendo enviado:", jsonBody);
          console.log("📤 API_URL:", API_URL);
          console.log("📤 URL completa:", `${API_URL}/agendar`);

          // Fazer requisição igual à página de agendamento
          const response = await fetch(`${API_URL}/agendar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: jsonBody,
          });

          const result = await response.json();
          console.log("📥 Resposta do servidor:", result);

          if (response.ok) {
            alert("✅ Agendamento criado com sucesso!");
            fecharModalCriar();
            await carregarAgendamentos();
          } else {
            alert(`❌ Erro: ${result.error || "Erro ao criar agendamento"}`);
          }
        } catch (error) {
          console.error("❌ Erro ao criar agendamento:", error);
          console.error("   Tipo:", error.name);
          console.error("   Mensagem:", error.message);
          console.error("   Stack:", error.stack);
          console.error("   API_URL atual:", API_URL);

          let mensagemErro = "❌ Erro ao conectar com o servidor.";
          if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError")
          ) {
            mensagemErro = `❌ Erro de Conexão\n\nNão foi possível conectar ao servidor Flask.\n\nVerifique se o servidor está rodando:\ncd backend && python3 app.py\n\nURL tentada: ${API_URL}/agendar\n\nErro: ${error.message}`;
          } else {
            mensagemErro = `❌ Erro: ${error.message}\n\nURL tentada: ${API_URL}/agendar`;
          }

          alert(mensagemErro);
        }
      });
    }
  }
});

// Deletar agendamento
async function deletarAgendamento(id) {
  if (
    !confirm(
      "⚠️ Tem certeza que deseja deletar este agendamento?\n\nEsta ação não pode ser desfeita!",
    )
  ) {
    return;
  }

  const token = localStorage.getItem("admin_token");

  try {
    const headers = {
      "Cache-Control": "no-cache",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/admin/agendamentos/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: headers,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alert("✅ Agendamento deletado com sucesso!");
      await carregarAgendamentos();
    } else {
      alert(`❌ Erro: ${data.error || "Erro ao deletar agendamento"}`);
    }
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error);
    alert("❌ Erro ao conectar com o servidor.");
  }
}

// Inicializar
(async function () {
  // Carregar serviços disponíveis
  await carregarServicos();

  // Aguardar um pouco antes de verificar autenticação (permite que cookies sejam salvos)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Verificar autenticação antes de carregar dados
  const autenticado = await verificarAutenticacao();
  if (!autenticado) {
    // Tentar mais uma vez após 1 segundo (pode ser delay do cookie)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const autenticado2 = await verificarAutenticacao();
    if (!autenticado2) {
      return; // Redirecionado para login
    }
  }

  await carregarAgendamentos();

  // Verificar autenticação periodicamente (a cada 5 minutos)
  setInterval(async () => {
    const aindaAutenticado = await verificarAutenticacao();
    if (!aindaAutenticado) {
      // Se perder autenticação, recarregar a página
      window.location.reload();
    }
  }, 300000);

  // Auto-atualizar agendamentos a cada 30 segundos
  setInterval(carregarAgendamentos, 30000);
})();
