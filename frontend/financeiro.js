// Detectar porta da API
const API_URL = 'https://backend-production-039a.up.railway.app/api';

// Verificar autenticação
async function verificarAutenticacao() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/verify`, {
            method: 'GET',
            credentials: 'include',
            headers: headers
        });
        
        if (!response.ok) {
            localStorage.removeItem('admin_token');
            window.location.href = 'login.html';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('admin_token');
        window.location.href = 'login.html';
        return false;
    }
}

// Variáveis globais
let dadosFinanceiros = null;

// Carregar dados financeiros
async function carregarDadosFinanceiros() {
    const token = localStorage.getItem('admin_token');
    const loading = document.getElementById('loading');
    const tabela = document.getElementById('tabela-detalhada');
    
    // Obter filtros
    const cliente = document.getElementById('filter-cliente').value.trim();
    const mes = document.getElementById('filter-mes').value;
    const formaPagamento = document.getElementById('filter-forma-pagamento').value;
    const status = document.getElementById('filter-status').value;
    const pago = document.getElementById('filter-pago').value;
    const dataInicio = document.getElementById('filter-data-inicio').value;
    const dataFim = document.getElementById('filter-data-fim').value;
    
    // Construir query string
    const params = new URLSearchParams();
    if (cliente) params.append('cliente', cliente);
    if (mes) params.append('mes', mes);
    if (formaPagamento) params.append('forma_pagamento', formaPagamento);
    if (status) params.append('status', status);
    if (pago) params.append('pago', pago);
    if (dataInicio) params.append('data_inicio', dataInicio);
    if (dataFim) params.append('data_fim', dataFim);
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/financeiro?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        dadosFinanceiros = await response.json();
        
        // Atualizar interface
        atualizarResumo();
        atualizarTabelasResumo();
        atualizarTabelaDetalhada();
        
        loading.style.display = 'none';
        tabela.style.display = 'table';
        
    } catch (error) {
        console.error('Erro ao carregar dados financeiros:', error);
        loading.innerHTML = `<div style="color: red; padding: 20px;">Erro ao carregar dados: ${error.message}</div>`;
    }
}

// Atualizar cards de resumo
function atualizarResumo() {
    if (!dadosFinanceiros || !dadosFinanceiros.resumo) return;
    
    const resumo = dadosFinanceiros.resumo;
    
    // Total faturado
    document.getElementById('total-faturado').textContent = 
        formatarMoeda(resumo.total_faturado || 0);
    
    // Total recebido
    document.getElementById('total-recebido').textContent = 
        formatarMoeda(resumo.total_recebido || 0);
    
    // Total pendente
    document.getElementById('total-pendente').textContent = 
        formatarMoeda(resumo.total_pendente || 0);
    
    // Total de agendamentos
    document.getElementById('total-agendamentos').textContent = 
        resumo.total_agendamentos || 0;
    
    // Ticket médio
    const ticketMedio = resumo.total_agendamentos > 0 
        ? resumo.total_faturado / resumo.total_agendamentos 
        : 0;
    document.getElementById('ticket-medio').textContent = 
        formatarMoeda(ticketMedio);
}

// Atualizar tabelas de resumo
function atualizarTabelasResumo() {
    if (!dadosFinanceiros || !dadosFinanceiros.resumo) return;
    
    const resumo = dadosFinanceiros.resumo;
    
    // Tabela por forma de pagamento
    const tbodyForma = document.getElementById('tabela-forma-pagamento');
    const formasPagamento = {
        'pix': 'PIX',
        'cartao': 'Cartão',
        'pendente': 'Pendente'
    };
    
    if (Object.keys(resumo.total_por_forma_pagamento).length === 0) {
        tbodyForma.innerHTML = '<tr><td colspan="2" class="empty-state">Nenhum dado</td></tr>';
    } else {
        tbodyForma.innerHTML = Object.entries(resumo.total_por_forma_pagamento)
            .sort((a, b) => b[1] - a[1])
            .map(([forma, total]) => `
                <tr>
                    <td>${formasPagamento[forma] || forma}</td>
                    <td class="valor">${formatarMoeda(total)}</td>
                </tr>
            `).join('');
    }
    
    // Tabela por status
    const tbodyStatus = document.getElementById('tabela-status');
    const statusLabels = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'concluido': 'Concluído',
        'cancelado': 'Cancelado'
    };
    
    if (Object.keys(resumo.total_por_status).length === 0) {
        tbodyStatus.innerHTML = '<tr><td colspan="2" class="empty-state">Nenhum dado</td></tr>';
    } else {
        tbodyStatus.innerHTML = Object.entries(resumo.total_por_status)
            .sort((a, b) => b[1] - a[1])
            .map(([status, total]) => `
                <tr>
                    <td>${statusLabels[status] || status}</td>
                    <td class="valor">${formatarMoeda(total)}</td>
                </tr>
            `).join('');
    }
    
    // Tabela por cliente
    const tbodyCliente = document.getElementById('tabela-cliente');
    if (resumo.total_por_cliente.length === 0) {
        tbodyCliente.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum dado</td></tr>';
    } else {
        tbodyCliente.innerHTML = resumo.total_por_cliente
            .slice(0, 10) // Top 10 clientes
            .map(cliente => `
                <tr>
                    <td>${cliente.nome}</td>
                    <td>${cliente.quantidade}</td>
                    <td class="valor">${formatarMoeda(cliente.total)}</td>
                </tr>
            `).join('');
    }
    
    // Tabela por mês
    const tbodyMes = document.getElementById('tabela-mes');
    if (resumo.total_por_mes.length === 0) {
        tbodyMes.innerHTML = '<tr><td colspan="2" class="empty-state">Nenhum dado</td></tr>';
    } else {
        tbodyMes.innerHTML = resumo.total_por_mes
            .map(item => {
                const [ano, mes] = item.mes.split('-');
                const mesNome = new Date(ano, parseInt(mes) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return `
                    <tr>
                        <td>${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}</td>
                        <td class="valor">${formatarMoeda(item.total)}</td>
                    </tr>
                `;
            }).join('');
    }
    
    // Tabela por status de pagamento
    const tbodyStatusPagamento = document.getElementById('tabela-status-pagamento');
    const statusPagamento = {
        'total_pago': 'Pago',
        'total_nao_pago': 'Não Pago'
    };
    
    const statusPagamentoData = [
        { label: 'Pago', valor: resumo.total_pago || 0 },
        { label: 'Não Pago', valor: resumo.total_nao_pago || 0 }
    ];
    
    if (statusPagamentoData.every(item => item.valor === 0)) {
        tbodyStatusPagamento.innerHTML = '<tr><td colspan="2" class="empty-state">Nenhum dado</td></tr>';
    } else {
        tbodyStatusPagamento.innerHTML = statusPagamentoData
            .filter(item => item.valor > 0)
            .map(item => `
                <tr>
                    <td>${item.label}</td>
                    <td class="valor">${formatarMoeda(item.valor)}</td>
                </tr>
            `).join('');
    }
}

// Atualizar tabela detalhada
function atualizarTabelaDetalhada() {
    if (!dadosFinanceiros || !dadosFinanceiros.agendamentos) return;
    
    const tbody = document.getElementById('tabela-detalhada-body');
    const agendamentos = dadosFinanceiros.agendamentos;
    
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
    
    const formasPagamento = {
        'pix': 'PIX',
        'cartao': 'Cartão',
        'pendente': 'Pendente'
    };
    
    const statusLabels = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'concluido': 'Concluído',
        'cancelado': 'Cancelado'
    };
    
    tbody.innerHTML = agendamentos.map(ag => {
        const dataObj = new Date(ag.data + 'T00:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        const valorFormatado = formatarMoeda(ag.valor);
        const formaPagFormatada = formasPagamento[ag.forma_pagamento] || ag.forma_pagamento || 'Pendente';
        const statusFormatado = statusLabels[ag.status] || ag.status;
        
        // Status de pagamento
        const pago = ag.pago || false;
        const dataPagamento = ag.data_pagamento ? new Date(ag.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
        const pagoBadge = pago 
            ? '<span class="status-badge" style="background: #D4EDDA; color: #155724;">✓ Pago</span>' 
            : '<span class="status-badge" style="background: #FFF3CD; color: #856404;">Pendente</span>';
        
        return `
            <tr>
                <td><strong>#${ag.id}</strong></td>
                <td>${ag.nome}</td>
                <td>${dataFormatada}</td>
                <td>${ag.horario}</td>
                <td>${ag.servico}</td>
                <td><strong>${valorFormatado}</strong></td>
                <td><span class="status-badge" style="background: #E9ECEF; color: #495057;">${formaPagFormatada}</span></td>
                <td><span class="status-badge status-${ag.status}">${statusFormatado}</span></td>
                <td>${pagoBadge}</td>
                <td style="color: #6C757D; font-size: 13px;">${dataPagamento}</td>
            </tr>
        `;
    }).join('');
}

// Aplicar filtros
function aplicarFiltros() {
    carregarDadosFinanceiros();
}

// Limpar filtros
function limparFiltros() {
    document.getElementById('filter-cliente').value = '';
    document.getElementById('filter-mes').value = '';
    document.getElementById('filter-forma-pagamento').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-pago').value = '';
    document.getElementById('filter-data-inicio').value = '';
    document.getElementById('filter-data-fim').value = '';
    carregarDadosFinanceiros();
}

// Formatar moeda
function formatarMoeda(valor) {
    return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Inicializar
(async function() {
    // Verificar autenticação
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return;
    }
    
    // Carregar dados iniciais
    await carregarDadosFinanceiros();
    
    // Auto-atualizar a cada 30 segundos
    setInterval(carregarDadosFinanceiros, 30000);
})();
