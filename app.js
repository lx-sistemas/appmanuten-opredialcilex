// =========================================================================
// FRONTEND - SISTEMA DE MANUTENÇÃO PREDIAL (NOVO MODELO)
// =========================================================================

// NOVA URL DA API 
const API_URL = 'https://script.google.com/macros/s/AKfycbxY3JojVBG2XrhXJlbbV3cijVB19AdfuTgPv8U1668DwIFoofR-YR-4aiXKSVeneLhI/exec';

let usuarioAdmin = null;
let tokenAdmin = null;
let todasOS = []; 
let osAbertaNoModal = null; 
let subTarefasAtuais = []; 
let estado = { filtroBusca: '', filtroStatusDash: null, ordenacaoAtiva: 'DATA', direcaoOrdenacao: -1 };

// Wrapper da API para sempre enviar o Token (Autenticação Forte)
async function apiCall(action, payload = {}) {
  // Injeta o token atual se houver
  if (tokenAdmin) payload.token = tokenAdmin;
  
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: action, payload: payload })
  });
  return await res.json();
}

// Inicialização e Controle de Sessão
function verificarSessao() {
  const t = localStorage.getItem('manutencao_token');
  const u = localStorage.getItem('manutencao_user');
  
  if (t && u) {
    tokenAdmin = t;
    usuarioAdmin = JSON.parse(u);
    document.body.classList.add('is-admin');
    document.getElementById('btn-login-modal').style.display = 'none';
    document.getElementById('user-profile').style.display = 'flex';
    document.getElementById('user-info-nome').textContent = 'Admin: ' + usuarioAdmin.nome;
  } else {
    fazerLogout(false);
  }
  carregarDadosAPI();
}

function fazerLogout(refresh = true) {
  localStorage.removeItem('manutencao_token');
  localStorage.removeItem('manutencao_user');
  tokenAdmin = null;
  usuarioAdmin = null;
  document.body.classList.remove('is-admin');
  document.getElementById('btn-login-modal').style.display = 'inline-flex';
  document.getElementById('user-profile').style.display = 'none';
  if(refresh) { fecharModais(); carregarDadosAPI(); }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); 
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();
  
  const btn = document.getElementById('btn-login');
  const msgBox = document.getElementById('login-msg');
  msgBox.style.display = 'none'; btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Validando...'; btn.disabled = true;

  try {
    const dados = await apiCall('login', { usuario: user, senha: pass });
    if (dados.status === 'sucesso') {
      localStorage.setItem('manutencao_token', dados.token);
      localStorage.setItem('manutencao_user', JSON.stringify(dados.usuario));
      fecharModais();
      verificarSessao();
    } else { 
      msgBox.style.display = 'block'; msgBox.textContent = dados.mensagem;
    }
  } catch (erro) { 
      msgBox.style.display = 'block'; msgBox.textContent = 'Erro de rede ao conectar ao servidor.';
  } finally {
      btn.innerHTML = '<span class="material-symbols-outlined">login</span> Acessar Administração'; btn.disabled = false;
  }
});

// Abertura de Modais
function abrirModalLogin() { document.getElementById('login-form').reset(); document.getElementById('login-msg').style.display='none'; document.getElementById('modal-login').classList.add('active'); checkModalsOpen(); }
function fecharModais() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); checkModalsOpen(); }
function checkModalsOpen() { document.body.classList.toggle('modal-open', Array.from(document.querySelectorAll('.modal-overlay')).some(m => m.classList.contains('active'))); }

// --- DADOS PÚBLICOS E FILTROS ---
async function carregarDadosAPI() {
  document.getElementById('os-container').innerHTML = '<div class="loading-state"><div class="spinner"></div>Buscando solicitações...</div>';
  try {
    const respDash = await apiCall('getDashboard');
    const respOS = await apiCall('getOS');
    
    if (respDash.status === 'sucesso') {
      document.getElementById('count-aberto').textContent = respDash.dashboard.naoIniciado;
      document.getElementById('count-pecas').textContent = respDash.dashboard.aguardandoPecas;
      document.getElementById('count-andamento').textContent = respDash.dashboard.emAndamento;
      document.getElementById('count-concluido').textContent = respDash.dashboard.concluido;
    }
    if (respOS.status === 'sucesso') { 
        todasOS = respOS.dados; aplicarFiltrosEOrdenacao(); 
    } else if (respOS.mensagem) {
        if(respOS.mensagem.includes('Acesso negado')) fazerLogout();
    }
  } catch (erro) { document.getElementById('os-container').innerHTML = '<div class="loading-state">Erro ao carregar dados.</div>'; }
}

function alternarFiltro(status, el) {
  if (estado.filtroStatusDash === status) { estado.filtroStatusDash = null; el.classList.remove('active'); document.getElementById('btn-todas').classList.add('active-all'); } 
  else { document.querySelectorAll('.dash-card').forEach(c => c.classList.remove('active')); estado.filtroStatusDash = status; el.classList.add('active'); document.getElementById('btn-todas').classList.remove('active-all'); } 
  aplicarFiltrosEOrdenacao();
}
function limparFiltros() { estado.filtroStatusDash = null; estado.filtroBusca = ''; document.getElementById('search-os').value = ''; document.querySelectorAll('.dash-card').forEach(c => c.classList.remove('active')); document.getElementById('btn-todas').classList.add('active-all'); aplicarFiltrosEOrdenacao(); }

document.getElementById('botoes-ordenacao').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip'); if (!btn || btn.id === 'btn-todas') return; 
  const tipo = btn.getAttribute('data-ordem');
  if (estado.ordenacaoAtiva === tipo) estado.direcaoOrdenacao *= -1; else { estado.ordenacaoAtiva = tipo; estado.direcaoOrdenacao = -1; }
  document.querySelectorAll('.chip').forEach(c => { if(c.hasAttribute('data-ordem')) { c.classList.remove('active'); c.querySelector('.sort-icon').style.opacity = '0'; } });
  btn.classList.add('active'); const ic = btn.querySelector('.sort-icon'); ic.style.opacity = '1'; ic.textContent = estado.direcaoOrdenacao === -1 ? 'arrow_downward' : 'arrow_upward';
  aplicarFiltrosEOrdenacao();
});
document.getElementById('search-os').addEventListener('input', (e) => { estado.filtroBusca = removerAcentos(e.target.value.toLowerCase().trim()); aplicarFiltrosEOrdenacao(); });

function removerAcentos(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function aplicarFiltrosEOrdenacao() {
  let filtrada = [...todasOS];
  if (estado.filtroStatusDash) {
    if (estado.filtroStatusDash === 'EM ABERTO') filtrada = filtrada.filter(o => String(o.status).toUpperCase().includes('ABERTO') || String(o.status).toUpperCase().includes('NÃO INICIADO'));
    else filtrada = filtrada.filter(o => String(o.status).toUpperCase().includes(estado.filtroStatusDash));
  }
  if (estado.filtroBusca) {
    filtrada = filtrada.filter(o => {
      let txt = `${o.id} ${o.descricao} ${o.setor} ${o.solicitante} ${o.status} ${o.prioridade}`;
      let nTxt = removerAcentos(txt.toLowerCase()); let termos = estado.filtroBusca.split(' ');
      return termos.every(t => nTxt.includes(t));
    });
  }
  filtrada.sort((a, b) => {
    let vA, vB;
    if (estado.ordenacaoAtiva === 'PRIORIDADE') { vA = (a.prioridade||'').includes('Urgente')?4:(a.prioridade||'').includes('Alta')?3:1; vB = (b.prioridade||'').includes('Urgente')?4:(b.prioridade||'').includes('Alta')?3:1; } 
    else if (estado.ordenacaoAtiva === 'PROGRESSO') { vA = parseFloat(a.progresso) || 0; vB = parseFloat(b.progresso) || 0; } 
    else { vA = a.id; vB = b.id; } 
    return vA < vB ? -1 * estado.direcaoOrdenacao : vA > vB ? 1 * estado.direcaoOrdenacao : 0;
  });
  renderizarListaOS(filtrada);
}

// --- RENDERIZAÇÃO DOS CARDS ---
function renderizarListaOS(lista) {
  const container = document.getElementById('os-container'); container.innerHTML = '';
  if (lista.length === 0) { container.innerHTML = `<div class="loading-state">Nenhuma solicitação encontrada.</div>`; return; }

  lista.forEach(os => {
    const pStr = String(os.prioridade||'Baixa').toUpperCase();
    const isRed = pStr==='ALTA'||pStr==='URGENTE';
    const sStr = String(os.status||'').toUpperCase();
    
    let cor = 'var(--status-aberto)';
    let isConcluido = sStr.includes('CONCLUÍDO') || sStr.includes('CONCLUIDO');
    if (sStr.includes('ANDAMENTO')) cor = 'var(--status-andamento)';
    else if (sStr.includes('PEÇAS') || sStr.includes('PECAS') || sStr.includes('MATERIAL')) cor = 'var(--status-pecas)';
    else if (isConcluido) cor = 'var(--status-concluido)';

    const progReal = isConcluido ? 100 : Math.round(parseFloat(os.progresso) || 0);
    
    const card = document.createElement('div'); card.className = 'os-card animate-hover'; card.style.borderLeft = `5px solid ${cor}`;
    
    let btnStatus = sStr.includes('PEÇAS') || sStr.includes('MATERIAL') 
      ? `<button class="btn-texto-card animate-pop admin-only" onclick="mudarStatusOS('${os.id}', 'Em Andamento', this)" title="Material Recebido"><span class="material-symbols-outlined" style="font-size:16px; color:var(--status-concluido);">check_circle</span> Chegou Material</button>`
      : `<button class="btn-texto-card animate-pop admin-only" onclick="mudarStatusOS('${os.id}', 'Aguardando Peças', this)" title="Falta Material"><span class="material-symbols-outlined" style="font-size:16px; color:var(--status-pecas);">inventory_2</span> Aguardando Material</button>`;

    let rowConclusao = isConcluido ? `<div class="meta-row" style="width:100%; margin-top:2px;"><span class="meta-lbl">Concluído em:</span><span class="meta-val"><span class="material-symbols-outlined" style="color:var(--status-concluido);">task_alt</span> ${os.dataconclusao || 'Data não registrada'}</span></div>` : '';

    card.innerHTML = `
      <div class="os-card-header">
        <span class="os-id"><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">handyman</span> ${os.id}</span>
        ${os.prioridade !== 'Padrão' ? `<span class="badge-prioridade" style="background:${isRed?'#fecaca':'#e2e8f0'}; color:${isRed?'#b91c1c':'#475569'};">Prioridade: ${isRed?'🚨 ':''}${os.prioridade}</span>` : ''}
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 2px;">Local: ${os.setor}</div>
      <h3 class="os-titulo">${os.descricao}</h3>
      
      <div class="os-meta-grid">
        <div class="meta-row"><span class="meta-lbl">Abertura:</span><span class="meta-val"><span class="material-symbols-outlined">calendar_today</span> ${os.datasolicitacao||''}</span></div>
        <div class="meta-row"><span class="meta-lbl">Previsão:</span><span class="meta-val"><span class="material-symbols-outlined">event_available</span> ${formatarPrevisao(os.previsao)}</span></div>
        <div class="meta-row" style="width: 100%;"><span class="meta-lbl">Solicitante:</span><span class="meta-val"><span class="material-symbols-outlined">person</span> ${os.solicitante||''}</span></div>
        ${rowConclusao}
      </div>
      
      <div class="os-footer" style="border-top:1px solid var(--border); padding-top:12px; margin-top:6px;">
        <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem; font-weight:600; width:100%; margin-bottom:10px;">
          <span style="color:${cor}">${os.status}</span>
          <div class="mini-progress-bg" style="flex:1;"><div class="mini-progress-fill" style="width:${progReal}%; background:${cor}"></div></div>
          <span style="color:var(--text-muted); font-size:0.75rem;">${progReal}%</span>
        </div>
        
        <div class="os-card-actions-grid admin-only">
          ${btnStatus}
          <button class="btn-texto-card animate-pop" onclick="abrirModalEdicaoOS('${os.id}')"><span class="material-symbols-outlined" style="font-size:16px; color:var(--primary);">edit</span> Editar OS</button>
        </div>
        <button class="btn-detalhes-full animate-pop" onclick="abrirDetalhesOS('${encodeURIComponent(JSON.stringify(os))}', '${cor}', ${progReal})">
          Visualizar Solicitação Completa <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function formatarPrevisao(dataRaw) {
    if (!dataRaw || dataRaw === 'Não informada') return 'Não informada';
    if (dataRaw.includes('-')) { let p = dataRaw.split('-'); if(p.length===3) return `${p[2]}/${p[1]}/${p[0]}`; }
    return dataRaw;
}
function formatarTextoComLinks(texto) {
  if (!texto) return "<i>Nenhuma informação adicional.</i>";
  let html = texto.replace(/https?:\/\/[^\s,]+/g, url => `<br><a href="${url}" target="_blank" class="btn-outline" style="display:inline-flex; margin-top:6px; font-size:0.75rem; text-decoration:none;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">link</span> Abrir Anexo / Documento</a>`);
  return html.replace(/\n/g, '<br>');
}
function rolarParaAnexos() { const area = document.getElementById('area-orientacoes-os'); if(area) area.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

// --- CRIAÇÃO / EDIÇÃO DE OS ---
function abrirModalNovaOS() { 
  document.getElementById('form-nova-os').reset();
  document.getElementById('edit-os-id').value = '';
  document.getElementById('titulo-modal-os').textContent = 'Criar Nova Solicitação';
  
  // Esconde controles administrativos se houver (Modo Criação)
  document.getElementById('admin-fields-os').style.display = 'none';
  document.getElementById('msg-aviso-publico').style.display = 'block';

  if(usuarioAdmin) document.getElementById('nova-os-solicitante').value = usuarioAdmin.nome;
  
  const btn = document.getElementById('btn-salvar-os'); btn.innerHTML = 'Salvar O.S.'; btn.disabled = false;
  document.getElementById('modal-nova-os').classList.add('active'); checkModalsOpen();
}

function abrirModalEdicaoOS(idOS) {
  const os = todasOS.find(o => o.id === idOS);
  if(!os) return;
  document.getElementById('titulo-modal-os').textContent = `Editar OS: ${idOS}`;
  document.getElementById('edit-os-id').value = idOS;
  document.getElementById('msg-aviso-publico').style.display = 'none';
  
  document.getElementById('nova-os-solicitante').value = os.solicitante;
  document.getElementById('nova-os-local').value = os.setor;
  document.getElementById('nova-os-desc').value = os.descricao;
  
  // Mostra campos administrativos
  document.getElementById('admin-fields-os').style.display = 'flex';
  document.getElementById('nova-os-prio').value = os.prioridade !== 'Padrão' ? os.prioridade : 'Média';
  
  // Tratamento de Data AAAA-MM-DD para o input=date HTML5
  if(os.previsao && os.previsao.includes('/')) {
      let p = os.previsao.split('/');
      if(p.length===3) document.getElementById('nova-os-prev').value = `${p[2]}-${p[1]}-${p[0]}`;
  } else { document.getElementById('nova-os-prev').value = os.previsao; }

  const btn = document.getElementById('btn-salvar-os'); btn.innerHTML = 'Salvar O.S.'; btn.disabled = false;
  document.getElementById('modal-nova-os').classList.add('active'); checkModalsOpen();
}

document.getElementById('form-nova-os').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-os'); btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Salvando...'; btn.disabled = true;
  
  const idEdicao = document.getElementById('edit-os-id').value;
  const acaoCall = idEdicao ? 'editarOS' : 'novaOS'; 
  
  let prevFormatada = document.getElementById('nova-os-prev').value;
  if(prevFormatada && prevFormatada.includes('-')) { let p = prevFormatada.split('-'); prevFormatada = `${p[2]}/${p[1]}/${p[0]}`; }

  const payload = {
    idOS: idEdicao,
    solicitante: document.getElementById('nova-os-solicitante').value.trim(),
    setor: document.getElementById('nova-os-local').value,
    descricao: document.getElementById('nova-os-desc').value,
    prioridade: idEdicao ? document.getElementById('nova-os-prio').value : 'Padrão',
    previsao: idEdicao ? prevFormatada : 'Não informada'
  };

  try {
    const res = await apiCall(acaoCall, payload);
    if(res.status==='sucesso') {
        fecharModais(); carregarDadosAPI(); 
        if(!idEdicao) alert(res.mensagem || 'OS Aberta com sucesso!');
    } else { alert("Acesso Negado ou Falha: " + res.mensagem); fazerLogout(false); }
  } catch(e) { alert('Erro de comunicação com o servidor.'); } 
  finally { btn.innerHTML = 'Salvar O.S.'; btn.disabled = false; }
});

// --- AÇÕES ADMINISTRATIVAS (OS) ---
async function mudarStatusOS(idOS, novoStatus, btnElement) {
  const htmlOriginal = btnElement.innerHTML; btnElement.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:16px;">sync</span>'; btnElement.disabled = true;
  const res = await apiCall('mudarStatusDireto', { idOS: idOS, novoStatus: novoStatus });
  if(res.status === 'sucesso') carregarDadosAPI(); else { alert('Erro: ' + res.mensagem); btnElement.innerHTML = htmlOriginal; btnElement.disabled = false;}
}

async function deletarOS(btnElement) {
  if(!confirm("Atenção Admin: Deseja EXCLUIR permanentemente esta O.S?")) return;
  const originalHTML = btnElement.innerHTML; btnElement.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Excluindo...'; btnElement.disabled = true;
  const res = await apiCall('excluirOS', { idOS: osAbertaNoModal });
  if(res.status === 'sucesso') { fecharModais(); carregarDadosAPI(); } else { alert('Erro: ' + res.mensagem); btnElement.innerHTML = originalHTML; btnElement.disabled = false; }
}

function editarObservacaoOS() {
    const os = todasOS.find(o => o.id === osAbertaNoModal); if(!os) return;
    const novoTexto = prompt("Admin: Edite as Orientações / Informações:", os.observacoes || '');
    if(novoTexto === null) return; 
    
    const btn = document.getElementById('btn-edit-obs-os'); if(btn) { btn.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:16px;">sync</span>'; btn.disabled = true; }
    apiCall('editarObservacaoOS', { idOS: osAbertaNoModal, observacao: novoTexto })
    .then(res => { if(res.status==='sucesso'){ os.observacoes = novoTexto; document.getElementById('modal-desc').innerHTML = formatarTextoComLinks(novoTexto); }else alert('Erro: ' + res.mensagem); })
    .finally(() => { if(btn) { btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">edit</span>'; btn.disabled = false; }});
}

// --- MODAL DETALHES ---
function abrirDetalhesOS(jsonOS, cor, progressoReal) {
  const os = JSON.parse(decodeURIComponent(jsonOS));
  osAbertaNoModal = os.id; 
  const isConcluido = String(os.status).toUpperCase().includes('CONCLUÍDO');

  document.getElementById('modal-id').textContent = osAbertaNoModal;
  document.getElementById('modal-status').textContent = os.status; document.getElementById('modal-status').style.color = cor;
  
  const isRed = String(os.prioridade||'').toUpperCase() === 'ALTA' || String(os.prioridade||'').toUpperCase() === 'URGENTE';
  document.getElementById('modal-prioridade').innerHTML = os.prioridade !== 'Padrão' ? `<span class="badge-prioridade" style="background:${isRed?'#fecaca':'#e2e8f0'}; color:${isRed?'#b91c1c':'#475569'};">Prioridade: ${isRed?'🚨 ':''}${os.prioridade}</span>` : '';
  document.getElementById('modal-titulo').textContent = `${os.setor} - ${os.descricao}`;

  let gridDatas = `<strong>Solicitante:</strong> ${os.solicitante||'N/D'}<br><strong>Abertura:</strong> ${os.datasolicitacao||''}<br><strong>Previsão Término:</strong> ${formatarPrevisao(os.previsao)}`;
  if (isConcluido) gridDatas += `<br><strong style="color:var(--status-concluido);">Concluído em:</strong> <span style="color:var(--status-concluido); font-weight:bold;">${os.dataconclusao||'Não registrada'}</span>`;
  document.getElementById('grid-datas-modal').innerHTML = gridDatas;
  
  document.getElementById('modal-progresso-txt').textContent = `${progressoReal}%`; document.getElementById('modal-progresso-bar').style.width = `${progressoReal}%`; document.getElementById('modal-progresso-bar').style.backgroundColor = cor;
  
  const btnConcluir = document.getElementById('btn-concluir-os-direto'); const btnReverter = document.getElementById('btn-reverter-os');
  btnConcluir.disabled = false;
  if(isConcluido) { btnConcluir.style.display = 'none'; btnReverter.style.display = 'flex'; } else { btnConcluir.style.display = 'flex'; btnReverter.style.display = 'none'; }

  document.getElementById('modal-desc').innerHTML = formatarTextoComLinks(os.observacoes);
  document.getElementById('modal-detalhes').classList.add('active'); checkModalsOpen();
  carregarSubTarefasDaOS(osAbertaNoModal);
}

// Botões rápidos de conclusão Admin
async function concluirOSDireto() {
  if(!confirm('Admin: Deseja dar esta OS como 100% CONCLUÍDA?')) return;
  const btn = document.getElementById('btn-concluir-os-direto'); btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Concluindo Tudo...'; btn.disabled = true;
  
  try {
    const pendentes = subTarefasAtuais.filter(s => !s.status.toUpperCase().includes('CONCLUÍDO'));
    if(pendentes.length > 0) {
      await Promise.all(pendentes.map(s => apiCall('atualizarStatusSub', { idSub: s.idSub, novoStatus: 'Concluído' })));
    }
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    await apiCall('atualizarProgressoOS', { idOS: osAbertaNoModal, novoProgresso: 100, novoStatus: 'Concluído', dataConclusao: dataHoje });
    fecharModais(); carregarDadosAPI();
  } catch(e) { alert('Erro ao concluir.'); } finally { btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">done_all</span> Concluir O.S. Imediatamente (100%)'; btn.disabled = false;}
}
async function reverterOSParaAndamento() {
  if(!confirm('Admin: Deseja REVERTER esta OS para "Em Andamento"?')) return;
  const btn = document.getElementById('btn-reverter-os'); btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Revertendo...'; btn.disabled = true;
  const res = await apiCall('atualizarProgressoOS', { idOS: osAbertaNoModal, novoProgresso: 50, novoStatus: 'Em Andamento', dataConclusao: '' });
  if(res.status==='sucesso'){ fecharModais(); carregarDadosAPI(); } else { alert('Erro.'); btn.innerHTML = 'Voltar para etapa em Andamento'; btn.disabled = false;}
}

// --- SUB-TAREFAS ---
function abrirNovaSubTarefa() { document.getElementById('form-sub-tarefa').style.display = 'flex'; }
async function salvarSubTarefa() {
  const desc = document.getElementById('sub-desc').value; const resp = document.getElementById('sub-resp').value;
  if(!desc) return alert('Preencha a descrição!');
  const res = await apiCall('novaSubTarefa', { idOS: osAbertaNoModal, descricao: desc, responsavel: resp });
  if(res.status==='sucesso') { document.getElementById('form-sub-tarefa').style.display = 'none'; document.getElementById('sub-desc').value = ''; document.getElementById('sub-resp').value = ''; carregarSubTarefasDaOS(osAbertaNoModal); recalcularProgressoGeral(); } else alert('Erro.');
}
async function deletarSubTarefa(idSub) { if(!confirm("Admin: Excluir esta sub-tarefa?")) return; await apiCall('excluirSubTarefa', { idSub: idSub }); carregarSubTarefasDaOS(osAbertaNoModal); recalcularProgressoGeral(); }
async function concluirSubTarefa(idSub) { await apiCall('atualizarStatusSub', { idSub: idSub, novoStatus: 'Concluído' }); carregarSubTarefasDaOS(osAbertaNoModal); recalcularProgressoGeral(); }
async function reverterSubTarefa(idSub) { await apiCall('atualizarStatusSub', { idSub: idSub, novoStatus: 'Em Andamento' }); carregarSubTarefasDaOS(osAbertaNoModal); recalcularProgressoGeral(); }

async function removerComentarioSub(idSub, btnElement) { if(!confirm("Limpar observação?")) return; btnElement.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:15px;">sync</span>'; btnElement.disabled = true; await apiCall('editarObservacaoSub', { idSub: idSub, observacao: '' }); carregarSubTarefasDaOS(osAbertaNoModal); }
async function editarComentarioSub(idSub, btnElement) {
    let textoAtual = decodeURIComponent(btnElement.getAttribute('data-obs') || ''); const limpo = textoAtual.replace(/\[.*?\]:\s*/, '');
    const novoTexto = prompt("Admin: Edite a observação:", limpo); if(novoTexto === null) return;
    btnElement.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:15px;">sync</span>'; btnElement.disabled = true;
    await apiCall('editarObservacaoSub', { idSub: idSub, observacao: novoTexto }); carregarSubTarefasDaOS(osAbertaNoModal);
}

async function carregarSubTarefasDaOS(idOS) {
  const lista = document.getElementById('lista-sub-tarefas'); lista.innerHTML = `<div class="spinner"></div>`;
  try {
    const json = await apiCall('getSubTarefas', { idOS: idOS });
    subTarefasAtuais = json.dados || []; renderizarSubTarefas(subTarefasAtuais);
  } catch(e) { lista.innerHTML = `Erro ao carregar sub-tarefas.`; }
}

function renderizarSubTarefas(subs) {
  const lista = document.getElementById('lista-sub-tarefas'); lista.innerHTML = '';
  if(subs.length === 0) { lista.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted);">Sem pendências cadastradas.</p>`; return; }
  subs.forEach(s => {
    let isConcluido = s.status.toUpperCase().includes('CONCLUÍDO');
    let display = `
      <div class="sub-task-item animate-hover" style="border-left: 4px solid ${isConcluido?'var(--status-concluido)':'var(--status-andamento)'}">
        <div class="sub-task-info">
          <strong style="color:${isConcluido?'var(--status-concluido)':'inherit'};">${s.descricao}</strong><br>
          <span style="font-size:0.78rem; color:var(--text-muted);">👤 ${s.responsavel} | 📊 ${s.status}</span>
        </div>
        <div class="sub-task-actions admin-only">
          <button class="btn-sub-acao animate-pop" title="Adicionar Comentário" onclick="prepararInteracao('SUB', 'OBS', '${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">chat</span></button>
          <button class="btn-sub-acao animate-pop" title="Editar Observação" data-obs="${encodeURIComponent(s.observacoes || '')}" onclick="editarComentarioSub('${s.idSub}', this)"><span class="material-symbols-outlined" style="font-size:16px;">edit</span></button>
          ${!isConcluido ? `<button class="btn-sub-acao ok animate-pop" onclick="concluirSubTarefa('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">check</span></button>` : `<button class="btn-sub-acao reverter animate-pop" onclick="reverterSubTarefa('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">undo</span></button>`}
          <button class="btn-sub-acao del animate-pop" onclick="deletarSubTarefa('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
        </div>
      </div>
    `;
    if(s.observacoes && s.observacoes.trim() !== '') {
        display += `
        <div class="sub-obs-container">
            <div class="sub-obs-content"><strong style="color:var(--text-muted);">📝 Observação:</strong><br>${formatarTextoComLinks(s.observacoes)}</div>
            <div class="sub-obs-actions admin-only"><button class="btn-mini-acao del animate-pop" onclick="removerComentarioSub('${s.idSub}', this)"><span class="material-symbols-outlined" style="font-size:15px;">delete</span></button></div>
        </div>`;
    }
    lista.innerHTML += display;
  });
}

// --- ARQUIVOS E ANEXOS (PÚBLICO E ADMIN) ---
let intAlvo = ''; let intTipo = ''; let intID = ''; let arquivoBase64 = null; let arquivoMime = null;
function prepararInteracao(alvo, tipo, idSub = '') {
  intAlvo = alvo; intTipo = tipo; intID = idSub || osAbertaNoModal;
  document.getElementById('interacao-titulo').textContent = tipo === 'FOTO' ? 'Anexar Foto' : tipo === 'ARQUIVO' ? 'Anexar Documento' : 'Adicionar Comentário';
  document.getElementById('area-foto').style.display = 'block'; 
  document.getElementById('input-foto').accept = tipo === 'FOTO' ? 'image/*' : '*/*';
  document.getElementById('icone-upload').textContent = tipo === 'FOTO' ? 'add_a_photo' : 'upload_file';
  
  // Se for comentario em sub-tarefa, oculta upload
  if(tipo === 'OBS') { document.getElementById('area-foto').style.display = 'none'; document.getElementById('lbl-nome-anexo').textContent = 'Digite seu comentário'; }
  else document.getElementById('lbl-nome-anexo').textContent = 'Seu nome (Quem está enviando)';

  document.getElementById('foto-selecionada').textContent = ''; document.getElementById('input-nome-interacao').value = usuarioAdmin ? usuarioAdmin.nome : '';
  arquivoBase64 = null; arquivoMime = null; document.getElementById('modal-interacao').classList.add('active'); checkModalsOpen();
}

document.getElementById('input-foto').addEventListener('change', function(e) {
  const file = e.target.files[0]; if(!file) return;
  document.getElementById('foto-selecionada').textContent = file.name; arquivoMime = file.type;
  const reader = new FileReader(); reader.onload = (ev) => { arquivoBase64 = ev.target.result; }; reader.readAsDataURL(file);
});

async function enviarInteracao() {
  const btn = document.getElementById('btn-salvar-interacao'); const textoOuAutor = document.getElementById('input-nome-interacao').value.trim();
  if(!textoOuAutor) return alert('Por favor, informe um nome ou comentário!');
  if((intTipo === 'FOTO' || intTipo === 'ARQUIVO') && !arquivoBase64) return alert('Selecione o arquivo/foto!');
  
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Enviando...'; btn.disabled = true;
  try {
    const res = await apiCall('addInteracao', { alvo: intAlvo, alvoID: intID, tipo: intTipo, base64: arquivoBase64, mimeType: arquivoMime, texto: intTipo==='OBS'?textoOuAutor:'', autor: intTipo==='OBS'?'':textoOuAutor });
    if(res.status === 'sucesso') {
       fecharModalInteracao(); await carregarDadosAPI(); 
       if(intAlvo === 'SUB') await carregarSubTarefasDaOS(osAbertaNoModal); 
       else { const osAt = todasOS.find(o => o.id === osAbertaNoModal); if(osAt) document.getElementById('modal-desc').innerHTML = formatarTextoComLinks(osAt.observacoes); }
    } else { alert("Erro: " + res.mensagem); }
  } catch(e) { alert('Erro no envio. Tente novamente.'); } 
  finally { btn.innerHTML = 'Enviar Anexo'; btn.disabled = false; }
}

async function recalcularProgressoGeral() {
  if(subTarefasAtuais.length === 0) return;
  const concluidas = subTarefasAtuais.filter(s => s.status.toUpperCase().includes('CONCLUÍDO')).length;
  let novoProgresso = Math.round((concluidas / subTarefasAtuais.length) * 100);
  let novoStatus = novoProgresso === 100 ? 'Concluído' : (novoProgresso > 0 ? 'Em Andamento' : 'Em Aberto');
  
  let payload = { idOS: osAbertaNoModal, novoProgresso: novoProgresso, novoStatus: novoStatus };
  if(novoProgresso === 100) payload.dataConclusao = new Date().toLocaleDateString('pt-BR');
  
  document.getElementById('modal-progresso-txt').textContent = novoProgresso + '%'; document.getElementById('modal-progresso-bar').style.width = novoProgresso + '%'; document.getElementById('modal-status').textContent = novoStatus;
  await apiCall('atualizarProgressoOS', payload); carregarDadosAPI(); 
}

// SCROLL ANIMATION
let ultimoScroll = window.scrollY; let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) { window.requestAnimationFrame(() => {
      let atualScroll = window.scrollY;
      if (atualScroll < 60) document.body.classList.remove('hide-cards');
      else { if (atualScroll > ultimoScroll + 15) document.body.classList.add('hide-cards'); else if (atualScroll < ultimoScroll - 15) document.body.classList.remove('hide-cards'); }
      ultimoScroll = atualScroll > 0 ? atualScroll : 0; ticking = false;
  }); ticking = true; }
});

// INITIALIZE
verificarSessao();