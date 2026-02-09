// Detectar porta da API
const API_URL = (() => {
    // Produção (Railway)
    if (location.hostname.includes('railway.app')) {
        return 'https://SEU-BACKEND.up.railway.app/api';
    }

    // Dev local
    return 'http://localhost:5000/api';
})();

async function detectarPorta() {
    try {
        // Tentar primeiro com caminho relativo (quando servido pelo Flask)
        const response = await fetch('/api/servicos', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });
        
        if (response.ok) {
            API_URL = '/api';
            return true;
        }
    } catch (e) {
        console.log('Caminho relativo falhou, tentando portas...');
    }
    
    // Tentar portas comuns
    const portas = [5001, 5000, 5002, 5003];
    for (const porta of portas) {
        try {
            const response = await fetch(`http://localhost:${porta}/api/servicos`, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (response.ok) {
                API_URL = `http://localhost:${porta}/api`;
                return true;
            }
        } catch (e) {
            continue;
        }
    }
    
    return false;
}

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

// ============================================
// GERENCIAMENTO DE SERVIÇOS
// ============================================

let servicos = [];

async function carregarServicos() {
    const token = localStorage.getItem('admin_token');
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/servicos`, {
            method: 'GET',
            credentials: 'include',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar serviços');
        }
        
        servicos = await response.json();
        renderizarServicos();
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        document.getElementById('servicos-tbody').innerHTML = 
            '<tr><td colspan="5" style="color: red;">Erro ao carregar serviços</td></tr>';
    }
}

function renderizarServicos() {
    const tbody = document.getElementById('servicos-tbody');
    
    if (servicos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Nenhum serviço cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = servicos.map(servico => {
        const horas = Math.floor(servico.duracao_minutos / 60);
        const minutos = servico.duracao_minutos % 60;
        const duracaoFormatada = horas > 0 
            ? `${horas}h${minutos > 0 ? minutos + 'min' : ''}` 
            : `${minutos}min`;
        
        return `
            <tr>
                <td>${servico.nome}</td>
                <td>R$ ${servico.valor.toFixed(2).replace('.', ',')}</td>
                <td>${duracaoFormatada}</td>
                <td>
                    <span class="status-badge ${servico.ativo ? 'status-ativo' : 'status-inativo'}">
                        ${servico.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <button class="btn-edit" onclick="editarServico(${servico.id})">Editar</button>
                    <button class="btn-delete" onclick="deletarServico(${servico.id})">Deletar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalServico(servicoId = null) {
    const modal = document.getElementById('servicoModal');
    const form = document.getElementById('servicoForm');
    const title = document.getElementById('servicoModalTitle');
    
    form.reset();
    document.getElementById('servico-id').value = '';
    
    if (servicoId) {
        const servico = servicos.find(s => s.id === servicoId);
        if (servico) {
            title.textContent = 'Editar Serviço';
            document.getElementById('servico-id').value = servico.id;
            document.getElementById('servico-nome').value = servico.nome;
            document.getElementById('servico-valor').value = servico.valor;
            document.getElementById('servico-duracao').value = servico.duracao_minutos;
            document.getElementById('servico-ativo').checked = servico.ativo;
        }
    } else {
        title.textContent = 'Novo Serviço';
    }
    
    modal.classList.add('show');
}

function fecharModalServico() {
    document.getElementById('servicoModal').classList.remove('show');
}

document.getElementById('servicoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('admin_token');
    const servicoId = document.getElementById('servico-id').value;
    const nome = document.getElementById('servico-nome').value.trim();
    const valor = parseFloat(document.getElementById('servico-valor').value);
    const duracao = parseInt(document.getElementById('servico-duracao').value);
    const ativo = document.getElementById('servico-ativo').checked;
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        let response;
        if (servicoId) {
            // Atualizar
            response = await fetch(`${API_URL}/admin/servicos/${servicoId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify({
                    nome: nome,
                    valor: valor,
                    duracao_minutos: duracao,
                    ativo: ativo
                })
            });
        } else {
            // Criar
            response = await fetch(`${API_URL}/admin/servicos`, {
                method: 'POST',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify({
                    nome: nome,
                    valor: valor,
                    duracao_minutos: duracao,
                    ativo: ativo
                })
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            alert('✅ Serviço salvo com sucesso!');
            fecharModalServico();
            await carregarServicos();
        } else {
            alert(`❌ Erro: ${result.error || 'Erro ao salvar serviço'}`);
        }
    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        alert('❌ Erro ao conectar com o servidor.');
    }
});

async function editarServico(id) {
    abrirModalServico(id);
}

async function deletarServico(id) {
    if (!confirm('⚠️ Tem certeza que deseja deletar este serviço?\n\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    const token = localStorage.getItem('admin_token');
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/servicos/${id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: headers
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('✅ Serviço deletado com sucesso!');
            await carregarServicos();
        } else {
            alert(`❌ Erro: ${result.error || 'Erro ao deletar serviço'}`);
        }
    } catch (error) {
        console.error('Erro ao deletar serviço:', error);
        alert('❌ Erro ao conectar com o servidor.');
    }
}

// ============================================
// GERENCIAMENTO DE HORÁRIOS
// ============================================

let configHorarios = [];
const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

async function carregarHorarios() {
    const token = localStorage.getItem('admin_token');
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/config-horarios`, {
            method: 'GET',
            credentials: 'include',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar configurações de horários');
        }
        
        configHorarios = await response.json();
        renderizarHorarios();
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        document.getElementById('horarios-content').innerHTML = 
            '<div class="loading" style="color: red;">Erro ao carregar configurações</div>';
    }
}

function renderizarHorarios() {
    const content = document.getElementById('horarios-content');
    
    // Separar por tipo
    const diasSemanaConfigs = configHorarios.filter(c => c.tipo === 'dia_semana');
    const datasEspecificas = configHorarios.filter(c => c.tipo === 'data_especifica');
    
    let html = '<div class="dias-semana">';
    
    // Renderizar dias da semana
    for (let dia = 0; dia < 7; dia++) {
        const config = diasSemanaConfigs.find(c => c.dia_semana === dia);
        if (config) {
            html += criarCardDiaSemana(config);
        }
    }
    
    html += '</div>';
    
    // Renderizar datas específicas
    if (datasEspecificas.length > 0) {
        html += '<h3 style="margin-top: 30px; margin-bottom: 15px;">Datas Específicas</h3>';
        html += '<div class="table-container">';
        html += '<table><thead><tr><th>Data</th><th>Horário</th><th>Almoço</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
        
        datasEspecificas.forEach(config => {
            const dataObj = new Date(config.data_especifica + 'T00:00:00');
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            const almoco = config.tem_almoco 
                ? `${config.almoco_inicio} - ${config.almoco_fim}` 
                : 'Sem almoço';
            
            html += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td>${config.horario_inicio} - ${config.horario_fim}</td>
                    <td>${almoco}</td>
                    <td>
                        <span class="status-badge ${config.ativo ? 'status-ativo' : 'status-inativo'}">
                            ${config.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-edit" onclick="editarHorarioEspecifico(${config.id})">Editar</button>
                        <button class="btn-delete" onclick="deletarHorarioEspecifico(${config.id})">Deletar</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
    }
    
    content.innerHTML = html;
}

function criarCardDiaSemana(config) {
    const diaNome = diasSemana[config.dia_semana];
    const classeInativo = config.ativo ? '' : 'inativo';
    
    return `
        <div class="dia-card ${classeInativo}">
            <div class="dia-header">
                <h4>${diaNome}</h4>
                <label class="toggle-switch">
                    <input type="checkbox" ${config.ativo ? 'checked' : ''} 
                           onchange="toggleDiaSemana(${config.id}, this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="horario-config">
                <div>
                    <label>Início</label>
                    <input type="time" value="${config.horario_inicio}" 
                           onchange="atualizarHorarioDiaSemana(${config.id}, 'horario_inicio', this.value)">
                </div>
                <div>
                    <label>Fim</label>
                    <input type="time" value="${config.horario_fim}" 
                           onchange="atualizarHorarioDiaSemana(${config.id}, 'horario_fim', this.value)">
                </div>
            </div>
            <div style="margin-top: 10px;">
                <label>
                    <input type="checkbox" ${config.tem_almoco ? 'checked' : ''} 
                           onchange="toggleAlmocoDiaSemana(${config.id}, this.checked)">
                    Tem horário de almoço
                </label>
            </div>
            ${config.tem_almoco ? `
                <div class="horario-config" style="margin-top: 10px;">
                    <div>
                        <label>Almoço Início</label>
                        <input type="time" value="${config.almoco_inicio || ''}" 
                               onchange="atualizarHorarioDiaSemana(${config.id}, 'almoco_inicio', this.value)">
                    </div>
                    <div>
                        <label>Almoço Fim</label>
                        <input type="time" value="${config.almoco_fim || ''}" 
                               onchange="atualizarHorarioDiaSemana(${config.id}, 'almoco_fim', this.value)">
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

async function toggleDiaSemana(configId, ativo) {
    await atualizarConfigHorario(configId, { ativo: ativo });
}

async function toggleAlmocoDiaSemana(configId, temAlmoco) {
    const config = configHorarios.find(c => c.id === configId);
    const update = {
        tem_almoco: temAlmoco
    };
    
    if (!temAlmoco) {
        update.almoco_inicio = null;
        update.almoco_fim = null;
    } else if (config) {
        update.almoco_inicio = config.almoco_inicio || '12:00';
        update.almoco_fim = config.almoco_fim || '13:00';
    }
    
    await atualizarConfigHorario(configId, update);
}

async function atualizarHorarioDiaSemana(configId, campo, valor) {
    await atualizarConfigHorario(configId, { [campo]: valor });
}

async function atualizarConfigHorario(configId, campos) {
    const token = localStorage.getItem('admin_token');
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/config-horarios/${configId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: headers,
            body: JSON.stringify(campos)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            await carregarHorarios();
        } else {
            alert(`❌ Erro: ${result.error || 'Erro ao atualizar configuração'}`);
            await carregarHorarios(); // Recarregar para reverter mudanças visuais
        }
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        alert('❌ Erro ao conectar com o servidor.');
        await carregarHorarios(); // Recarregar para reverter mudanças visuais
    }
}

function abrirModalHorarioEspecifico(configId = null) {
    const modal = document.getElementById('horarioModal');
    const form = document.getElementById('horarioForm');
    const title = document.getElementById('horarioModalTitle');
    
    form.reset();
    document.getElementById('horario-id').value = '';
    document.getElementById('horario-tem-almoco').checked = true;
    document.getElementById('almoco-config').style.display = 'block';
    
    if (configId) {
        const config = configHorarios.find(c => c.id === configId);
        if (config && config.tipo === 'data_especifica') {
            title.textContent = 'Editar Data Específica';
            document.getElementById('horario-id').value = config.id;
            document.getElementById('horario-data').value = config.data_especifica;
            document.getElementById('horario-inicio').value = config.horario_inicio;
            document.getElementById('horario-fim').value = config.horario_fim;
            document.getElementById('horario-tem-almoco').checked = config.tem_almoco;
            document.getElementById('almoco-inicio').value = config.almoco_inicio || '';
            document.getElementById('almoco-fim').value = config.almoco_fim || '';
            document.getElementById('horario-ativo').checked = config.ativo;
            document.getElementById('almoco-config').style.display = config.tem_almoco ? 'block' : 'none';
        }
    } else {
        title.textContent = 'Nova Data Específica';
    }
    
    modal.classList.add('show');
}

function fecharModalHorario() {
    document.getElementById('horarioModal').classList.remove('show');
}

document.getElementById('horario-tem-almoco').addEventListener('change', function() {
    document.getElementById('almoco-config').style.display = this.checked ? 'block' : 'none';
});

document.getElementById('horarioForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('admin_token');
    const configId = document.getElementById('horario-id').value;
    const data = document.getElementById('horario-data').value;
    const horarioInicio = document.getElementById('horario-inicio').value;
    const horarioFim = document.getElementById('horario-fim').value;
    const temAlmoco = document.getElementById('horario-tem-almoco').checked;
    const almocoInicio = document.getElementById('almoco-inicio').value;
    const almocoFim = document.getElementById('almoco-fim').value;
    const ativo = document.getElementById('horario-ativo').checked;
    
    if (temAlmoco && (!almocoInicio || !almocoFim)) {
        alert('❌ Preencha os horários de almoço');
        return;
    }
    
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const dataBody = {
            tipo: 'data_especifica',
            data_especifica: data,
            horario_inicio: horarioInicio,
            horario_fim: horarioFim,
            tem_almoco: temAlmoco,
            almoco_inicio: temAlmoco ? almocoInicio : null,
            almoco_fim: temAlmoco ? almocoFim : null,
            ativo: ativo
        };
        
        let response;
        if (configId) {
            // Atualizar
            response = await fetch(`${API_URL}/admin/config-horarios/${configId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify(dataBody)
            });
        } else {
            // Criar
            response = await fetch(`${API_URL}/admin/config-horarios`, {
                method: 'POST',
                credentials: 'include',
                headers: headers,
                body: JSON.stringify(dataBody)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            alert('✅ Configuração salva com sucesso!');
            fecharModalHorario();
            await carregarHorarios();
        } else {
            alert(`❌ Erro: ${result.error || 'Erro ao salvar configuração'}`);
        }
    } catch (error) {
        console.error('Erro ao salvar configuração:', error);
        alert('❌ Erro ao conectar com o servidor.');
    }
});

async function editarHorarioEspecifico(id) {
    abrirModalHorarioEspecifico(id);
}

async function deletarHorarioEspecifico(id) {
    if (!confirm('⚠️ Tem certeza que deseja deletar esta configuração?\n\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    const token = localStorage.getItem('admin_token');
    
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
        };
        
        const response = await fetch(`${API_URL}/admin/config-horarios/${id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: headers
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('✅ Configuração deletada com sucesso!');
            await carregarHorarios();
        } else {
            alert(`❌ Erro: ${result.error || 'Erro ao deletar configuração'}`);
        }
    } catch (error) {
        console.error('Erro ao deletar configuração:', error);
        alert('❌ Erro ao conectar com o servidor.');
    }
}

// ============================================
// FUNÇÕES DE NAVEGAÇÃO
// ============================================

function mostrarAba(aba) {
    // Esconder todas as abas
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar aba selecionada
    document.getElementById(`${aba}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Carregar dados se necessário
    if (aba === 'servicos' && servicos.length === 0) {
        carregarServicos();
    } else if (aba === 'horarios' && configHorarios.length === 0) {
        carregarHorarios();
    }
}

// Inicializar
(async function() {
    await detectarPorta();
    
    // Verificar autenticação
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        return;
    }
    
    // Carregar dados iniciais
    await carregarServicos();
})();
