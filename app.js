// =========================================================================
// LÓGICA E CONTROLE (FRONTEND) - app.js
// =========================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxY3JojVBG2XrhXJlbbV3cijVB19AdfuTgPv8U1668DwIFoofR-YR-4aiXKSVeneLhI/exec';

let usuarioAtual = null;
let todasOS = []; 
let osAbertaNoModal = null; 
let subTarefasAtuais = []; 

let estado = { filtroBusca: '', filtroStatusDash: null, ordenacaoAtiva: 'DATA', direcaoOrdenacao: -1 };

function formatarPrevisao(os) {
  let prev = os.previsao || os.previsaodeentrega || os.previsaodeconclusao || os.prev || 'Não informada';
  let prevRaw = os.previsao_raw || os.previsaodeentrega_raw || os.previsaodeconclusao_raw || os.prev_raw || null;
  
  if (prevRaw && prevRaw.includes('-')) {
    let p = prevRaw.split('-');
    if(p.length === 3) return { exibicao: `${p[2]}/${p[1]}/${p[0]}`, raw: prevRaw };
  }
  if (prev.includes('-')) {
    let p = prev.split('-');
    if(p.length === 3) return { exibicao: `${p[2]}/${p[1]}/${p[0]}`, raw: prev };
  }
  if (prev.includes('/')) {
    let p = prev.split('/');
    if(p.length === 3) return { exibicao: prev, raw: `${p[2]}-${p[1]}-${p[0]}` };
  }
  return { exibicao: prev, raw: '' };
}

// --- LOGIN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); 
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();
  if (!user || !pass) return;

  const btn = document.getElementById('btn-login');
  const icone = document.getElementById('login-icon-btn');
  const texto = document.getElementById('login-text');
  const msgBox = document.getElementById('login-msg');
  
  msgBox.style.display = 'none';
  btn.disabled = true;
  texto.textContent = 'Validando acesso...';
  icone.textContent = 'sync';
  icone.classList.add('spinning-icon');

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify({ action: 'login', payload: { usuario: user, senha: pass } })
    });
    const dados = await resp.json();

    if (dados.status === 'sucesso') {
      texto.textContent = 'Entrando...';
      icone.textContent = 'check_circle';
      icone.classList.remove('spinning-icon');
      localStorage.setItem('manutencao_user', JSON.stringify(dados));
      entrarNoSistema(dados);
    } else { 
      msgBox.style.display = 'block';
      msgBox.textContent = dados.mensagem;
      texto.textContent = 'Entrar no Sistema';
      icone.textContent = 'login';
      icone.classList.remove('spinning-icon');
      btn.disabled = false;
    }
  } catch (erro) { 
      msgBox.style.display = 'block';
      msgBox.textContent = 'Sem resposta do servidor. (Se estiver no AI Studio, abra numa aba externa).';
      texto.textContent = 'Entrar no Sistema';
      icone.textContent = 'login';
      icone.classList.remove('spinning-icon');
      btn.disabled = false;
  } 
});

function abrirModalCadastro() {
  document.getElementById('form-cadastro').reset();
  document.getElementById('cad-msg').style.display = 'none';
  document.getElementById('modal-cadastro').classList.add('active');
}

document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-cad');
  const msgBox = document.getElementById('cad-msg');
  const texto = document.getElementById('cad-text');
  const icone = document.getElementById('cad-icon-btn');

  msgBox.style.display = 'none';
  btn.disabled = true;
  texto.textContent = 'Processando...';
  icone.textContent = 'sync';
  icone.classList.add('spinning-icon');

  const payload = {
    senhaMestra: document.getElementById('cad-senha-mestra').value,
    nome: document.getElementById('cad-nome').value,
    usuario: document.getElementById('cad-user').value,
    senha: document.getElementById('cad-senha').value,
    funcao: document.getElementById('cad-funcao').value
  };

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify({ action: 'cadastrarUsuario', payload })
    });
    const res = await resp.json();
    
    if(res.status === 'sucesso') {
      alert('Usuário cadastrado com sucesso! Faça login.');
      fecharModais();
    } else {
      msgBox.style.display = 'block';
      msgBox.textContent = res.mensagem;
    }
  } catch(e) { 
    msgBox.style.display = 'block';
    msgBox.textContent = 'Erro na conexão.';
  } finally { 
    texto.textContent = 'Cadastrar Usuário'; 
    icone.textContent = 'person_add';
    icone.classList.remove('spinning-icon');
    btn.disabled = false; 
  }
});

function entrarNoSistema(dados) {
  usuarioAtual = dados;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('user-info').textContent = `Logado como: ${dados.nome} (${dados.funcao})`;
  carregarDadosAPI();
}

function checarSessaoAutomatica() {
  const s = localStorage.getItem('manutencao_user');
  if (s) { try { entrarNoSistema(JSON.parse(s)); } catch (e) { localStorage.removeItem('manutencao_user'); } }
}

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('manutencao_user'); window.location.reload();
});

// --- BUSCA E FILTROS ---
async function carregarDadosAPI() {
  try {
    const [respDash, respOS] = await Promise.all([
      fetch(`${API_URL}?action=getDashboard`).then(r => r.json()),
      fetch(`${API_URL}?action=getOS`).then(r => r.json())
    ]);

    if (respDash.status === 'sucesso') {
      document.getElementById('count-aberto').textContent = respDash.dashboard.naoIniciado;
      document.getElementById('count-pecas').textContent = respDash.dashboard.aguardandoPecas;
      document.getElementById('count-andamento').textContent = respDash.dashboard.emAndamento;
      document.getElementById('count-concluido').textContent = respDash.dashboard.concluido;
    }
    if (respOS.status === 'sucesso') {
      todasOS = respOS.dados;
      aplicarFiltrosEOrdenacao();
    }
  } catch (erro) { document.getElementById('os-container').innerHTML = '<div class="loading-state">Erro ao carregar dados.</div>'; }
}

function alternarFiltro(status, el) {
  if (estado.filtroStatusDash === status) { 
     estado.filtroStatusDash = null; 
     el.classList.remove('active'); 
     document.getElementById('btn-todas').classList.add('active-all'); 
  } else { 
     document.querySelectorAll('.dash-card').forEach(c => c.classList.remove('active')); 
     estado.filtroStatusDash = status; 
     el.classList.add('active'); 
     document.getElementById('btn-todas').classList.remove('active-all'); 
  }
  aplicarFiltrosEOrdenacao();
}

function limparFiltros() {
  estado.filtroStatusDash = null;
  estado.filtroBusca = '';
  document.getElementById('search-os').value = '';
  document.querySelectorAll('.dash-card').forEach(c => c.classList.remove('active'));
  document.getElementById('btn-todas').classList.add('active-all'); 
  aplicarFiltrosEOrdenacao();
}

document.getElementById('botoes-ordenacao').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn || btn.id === 'btn-todas') return; 
  
  const tipo = btn.getAttribute('data-ordem');
  if (estado.ordenacaoAtiva === tipo) estado.direcaoOrdenacao *= -1; 
  else { estado.ordenacaoAtiva = tipo; estado.direcaoOrdenacao = -1; }

  document.querySelectorAll('.chip').forEach(c => { 
    if(c.hasAttribute('data-ordem')) { c.classList.remove('active'); c.querySelector('.sort-icon').style.opacity = '0'; }
  });
  btn.classList.add('active');
  const ic = btn.querySelector('.sort-icon'); ic.style.opacity = '1';
  ic.textContent = estado.direcaoOrdenacao === -1 ? 'arrow_downward' : 'arrow_upward';
  aplicarFiltrosEOrdenacao();
});

document.getElementById('search-os').addEventListener('input', (e) => { 
  estado.filtroBusca = removerAcentos(e.target.value.toLowerCase().trim()); 
  aplicarFiltrosEOrdenacao(); 
});

function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aplicarFiltrosEOrdenacao() {
  let filtrada = [...todasOS];
  if (estado.filtroStatusDash) {
    if (estado.filtroStatusDash === 'EM ABERTO') {
      filtrada = filtrada.filter(o => String(o.status).toUpperCase().includes('ABERTO') || String(o.status).toUpperCase().includes('NÃO INICIADO'));
    } else {
      filtrada = filtrada.filter(o => String(o.status).toUpperCase().includes(estado.filtroStatusDash));
    }
  }
  
  if (estado.filtroBusca) {
    filtrada = filtrada.filter(o => {
      let textoCompleto = `${o.idservico||o.id} ${o.descricaodoservico||o.descricao} ${o.setorlocal||o.setor} ${o.solicitante} ${o.status} ${o.prioridade}`;
      let textoNormalizado = removerAcentos(textoCompleto.toLowerCase());
      let termos = estado.filtroBusca.split(' ');
      return termos.every(termo => textoNormalizado.includes(termo));
    });
  }

  filtrada.sort((a, b) => {
    let vA, vB;
    if (estado.ordenacaoAtiva === 'PRIORIDADE') { vA = (a.prioridade||'').includes('Urgente')?4:(a.prioridade||'').includes('Alta')?3:1; vB = (b.prioridade||'').includes('Urgente')?4:(b.prioridade||'').includes('Alta')?3:1; } 
    else if (estado.ordenacaoAtiva === 'PROGRESSO') { vA = parseFloat(a.progresso) || 0; vB = parseFloat(b.progresso) || 0; } 
    else { vA = a.idservico || a.id; vB = b.idservico || b.id; } 
    return vA < vB ? -1 * estado.direcaoOrdenacao : vA > vB ? 1 * estado.direcaoOrdenacao : 0;
  });

  renderizarListaOS(filtrada);
}

function renderizarListaOS(lista) {
  const container = document.getElementById('os-container'); container.innerHTML = '';
  if (lista.length === 0) { container.innerHTML = `<div class="loading-state">Nenhuma OS encontrada.</div>`; return; }

  lista.forEach(os => {
    const pStr = String(os.prioridade||'Baixa').toUpperCase();
    const isRed = pStr==='ALTA'||pStr==='URGENTE';
    const sStr = String(os.status||'').toUpperCase();
    
    let cor = 'var(--status-aberto)';
    if (sStr.includes('ANDAMENTO')) cor = 'var(--status-andamento)';
    else if (sStr.includes('PEÇAS') || sStr.includes('PECAS') || sStr.includes('MATERIAL')) cor = 'var(--status-pecas)';
    else if (sStr.includes('CONCLUÍDO') || sStr.includes('CONCLUIDO')) cor = 'var(--status-concluido)';

    const progReal = Math.round(parseFloat(os.progresso) || 0);
    const osID = os.idservico || os.id;
    
    const prevObj = formatarPrevisao(os);
    const prevExibicao = prevObj.exibicao;

    const card = document.createElement('div');
    card.className = 'os-card animate-hover'; card.style.borderLeft = `5px solid ${cor}`;
    card.innerHTML = `
      <div class="os-card-header">
        <span class="os-id"><span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px;">handyman</span> ${osID}</span>
        <span class="badge-prioridade" style="background:${isRed?'#fecaca':'#e2e8f0'}; color:${isRed?'#b91c1c':'#475569'};">${isRed?'🚨 ':''}${os.prioridade}</span>
      </div>
      <h3 class="os-titulo">${os.setorlocal||os.setor} - ${os.descricaodoservico||os.descricao}</h3>
      <div class="os-meta">
        <span><span class="material-symbols-outlined" style="font-size:15px;">calendar_today</span> ${os.datasolicitacao||''}</span>
        <span><span class="material-symbols-outlined" style="font-size:15px;">event_available</span> Prev: ${prevExibicao}</span>
        <span><span class="material-symbols-outlined" style="font-size:15px;">person</span> ${os.solicitante||''}</span>
      </div>
      <div class="os-footer">
        <div style="display:flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:600;">
          <span style="color:${cor}">${os.status}</span>
          <div class="mini-progress-bg"><div class="mini-progress-fill" style="width:${progReal}%; background:${cor}"></div></div>
          <span style="color:var(--text-muted); font-size:0.7rem;">${progReal}%</span>
        </div>
        <div class="os-card-actions">
          ${sStr.includes('PEÇAS') || sStr.includes('PECAS') || sStr.includes('MATERIAL') 
            ? `<button class="btn-texto-card animate-pop" onclick="mudarStatusOS('${osID}', 'Em Andamento')" title="Material Recebido"><span class="material-symbols-outlined" style="font-size:15px; color:var(--status-concluido);">check_circle</span> Recebido</button>`
            : `<button class="btn-texto-card animate-pop" onclick="mudarStatusOS('${osID}', 'Aguardando Peças')" title="Aguardando Material"><span class="material-symbols-outlined" style="font-size:15px; color:var(--status-pecas);">inventory_2</span> Aguardar</button>`
          }
          <button class="btn-texto-card animate-pop" onclick="abrirModalEdicaoOS('${osID}')" title="Editar OS"><span class="material-symbols-outlined" style="font-size:15px; color:var(--primary);">edit</span> Editar</button>
          <button class="btn-detalhes animate-pop" onclick="abrirDetalhesOS('${encodeURIComponent(JSON.stringify(os))}', '${cor}', ${progReal})">
            Detalhes <span class="material-symbols-outlined" style="font-size:15px;">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function fecharModais() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }

function abrirModalNovaOS() { 
  document.getElementById('form-nova-os').reset();
  document.getElementById('edit-os-id').value = '';
  document.getElementById('grupo-num-os').style.display = 'block'; 
  document.getElementById('titulo-modal-os').textContent = 'Criar Nova Ordem de Serviço';
  
  const btn = document.getElementById('btn-salvar-os');
  btn.innerHTML = 'Salvar O.S.';
  btn.disabled = false;
  
  document.getElementById('modal-nova-os').classList.add('active'); 
}

function abrirModalEdicaoOS(idOS) {
  const os = todasOS.find(o => (o.idservico||o.id) === idOS);
  if(!os) return;
  
  document.getElementById('titulo-modal-os').textContent = `Editar OS: ${idOS}`;
  document.getElementById('edit-os-id').value = idOS;
  document.getElementById('grupo-num-os').style.display = 'none'; 
  document.getElementById('nova-os-local').value = os.setorlocal||os.setor;
  document.getElementById('nova-os-desc').value = os.descricaodoservico||os.descricao;
  document.getElementById('nova-os-prio').value = os.prioridade;
  
  const btn = document.getElementById('btn-salvar-os');
  btn.innerHTML = 'Salvar O.S.';
  btn.disabled = false;

  const prevObj = formatarPrevisao(os);
  document.getElementById('nova-os-prev').value = prevObj.raw;

  document.getElementById('modal-nova-os').classList.add('active');
}

document.getElementById('form-nova-os').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-os');
  
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Salvando O.S...'; 
  btn.disabled = true;
  
  const idEdicao = document.getElementById('edit-os-id').value;
  const actionCall = idEdicao ? 'editarOS' : 'novaOS';

  const payload = {
    idOS: idEdicao || document.getElementById('nova-os-numero').value.trim(),
    solicitante: usuarioAtual.nome,
    setor: document.getElementById('nova-os-local').value,
    descricao: document.getElementById('nova-os-desc').value,
    prioridade: document.getElementById('nova-os-prio').value,
    previsao: document.getElementById('nova-os-prev').value 
  };

  try {
    const resp = await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: actionCall, payload }) });
    const res = await resp.json();
    if(res.status==='sucesso') { 
      fecharModais(); 
      carregarDadosAPI(); 
    } else {
      alert(res.mensagem);
    }
  } catch(e) { 
    alert('Erro de envio ao servidor.'); 
  } finally { 
    btn.innerHTML = 'Salvar O.S.'; 
    btn.disabled = false; 
  }
});

async function mudarStatusOS(idOS, novoStatus) {
  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'mudarStatusDireto', payload: { idOS: idOS, novoStatus: novoStatus } }) });
    carregarDadosAPI();
  } catch(e) { alert('Erro ao alterar status.'); }
}

async function deletarOS(btnElement) {
  if(!confirm("Tem certeza que deseja EXCLUIR permanentemente esta O.S?")) return;
  
  const originalHTML = btnElement.innerHTML;
  btnElement.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Excluindo...';
  btnElement.disabled = true;

  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'excluirOS', payload: { idOS: osAbertaNoModal } }) });
    fecharModais();
    carregarDadosAPI();
  } catch(e) { 
    alert("Erro ao excluir OS."); 
  } finally {
    btnElement.innerHTML = originalHTML;
    btnElement.disabled = false;
  }
}

function abrirDetalhesOS(jsonOS, cor, progressoReal) {
  const os = JSON.parse(decodeURIComponent(jsonOS));
  osAbertaNoModal = os.idservico || os.id; 
  const prevObj = formatarPrevisao(os);

  document.getElementById('modal-id').textContent = osAbertaNoModal;
  
  document.getElementById('modal-status').textContent = os.status;
  document.getElementById('modal-status').style.color = cor;
  
  const isRed = String(os.prioridade||'').toUpperCase() === 'ALTA' || String(os.prioridade||'').toUpperCase() === 'URGENTE';
  document.getElementById('modal-prioridade').innerHTML = `<span class="badge-prioridade" style="background:${isRed?'#fecaca':'#e2e8f0'}; color:${isRed?'#b91c1c':'#475569'};">${isRed?'🚨 ':''}${os.prioridade||'Baixa'}</span>`;
  
  document.getElementById('modal-titulo').textContent = `${os.setorlocal||''} - ${os.descricaodoservico||''}`;
  document.getElementById('modal-solicitante').textContent = os.solicitante||'N/D';
  document.getElementById('modal-data').textContent = os.datasolicitacao||'';
  document.getElementById('modal-previsao').textContent = prevObj.exibicao;
  
  document.getElementById('modal-progresso-txt').textContent = `${progressoReal}%`;
  document.getElementById('modal-progresso-bar').style.width = `${progressoReal}%`;
  document.getElementById('modal-progresso-bar').style.backgroundColor = cor;
  
  const btnConcluir = document.getElementById('btn-concluir-os-direto');
  btnConcluir.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">done_all</span> Concluir O.S. Imediatamente (100%)';
  btnConcluir.disabled = false;

  if(String(os.status).toUpperCase().includes('CONCLUÍDO')) {
    btnConcluir.style.display = 'none';
  } else {
    btnConcluir.style.display = 'flex';
  }

  const obsOS = os.observacoes ? String(os.observacoes).replace(/\n/g, '<br>') : "<i>Nenhuma informação adicional.</i>";
  document.getElementById('modal-desc').innerHTML = obsOS;

  document.getElementById('modal-detalhes').classList.add('active');
  carregarSubTarefasDaOS(osAbertaNoModal);
}

async function concluirOSDireto() {
  if(!confirm('Deseja dar esta OS como 100% CONCLUÍDA?')) return;
  const btn = document.getElementById('btn-concluir-os-direto');
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Concluindo...';
  btn.disabled = true;
  
  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'atualizarProgressoOS', payload: { idOS: osAbertaNoModal, novoProgresso: 100, novoStatus: 'Concluído' } })});
    fecharModais();
    carregarDadosAPI();
  } catch(e) {
    alert('Erro ao concluir OS.');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">done_all</span> Concluir O.S. Imediatamente (100%)';
    btn.disabled = false;
  }
}

function abrirNovaSubTarefa() { document.getElementById('form-sub-tarefa').style.display = 'block'; }

async function salvarSubTarefa() {
  const desc = document.getElementById('sub-desc').value;
  const resp = document.getElementById('sub-resp').value;
  if(!desc) return alert('Preencha a descrição!');

  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'novaSubTarefa', payload: { idOS: osAbertaNoModal, descricao: desc, responsavel: resp } })});
    document.getElementById('form-sub-tarefa').style.display = 'none';
    document.getElementById('sub-desc').value = ''; document.getElementById('sub-resp').value = '';
    await carregarSubTarefasDaOS(osAbertaNoModal);
    recalcularProgressoGeral(); 
  } catch(e) { alert('Erro ao salvar.'); }
}

async function deletarSubTarefa(idSub) {
  if(!confirm("Deseja excluir esta sub-tarefa?")) return;
  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'excluirSubTarefa', payload: { idSub: idSub } }) });
    await carregarSubTarefasDaOS(osAbertaNoModal);
    recalcularProgressoGeral(); 
  } catch(e) { alert('Erro ao excluir.'); }
}

function removerComentarioSub(idSub) {
    if(!confirm("Deseja apagar este comentário?")) return;
    fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'addInteracao', payload: { alvo: 'SUB', alvoID: idSub, tipo: 'OBS', base64: null, mimeType: null, texto: ' ', autor: 'Sistema' } })})
    .then(() => carregarSubTarefasDaOS(osAbertaNoModal))
    .catch(() => alert('Erro ao remover observação.'));
}

function editarComentarioSub(idSub, textoAtual) {
    const limpo = textoAtual.replace(/\[.*?\]:\s*/, '');
    const novoTexto = prompt("Edite a observação da tarefa:", limpo);
    if(novoTexto === null || novoTexto.trim() === '') return;
    
    fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'addInteracao', payload: { alvo: 'SUB', alvoID: idSub, tipo: 'OBS', base64: null, mimeType: null, texto: novoTexto, autor: usuarioAtual.nome } })})
    .then(() => carregarSubTarefasDaOS(osAbertaNoModal))
    .catch(() => alert('Erro ao editar observação.'));
}

async function carregarSubTarefasDaOS(idOS) {
  const lista = document.getElementById('lista-sub-tarefas');
  lista.innerHTML = `<div class="spinner"></div>`;
  try {
    const res = await fetch(`${API_URL}?action=getSubTarefas&idOS=${idOS}`);
    const json = await res.json();
    subTarefasAtuais = json.dados || [];
    renderizarSubTarefas(subTarefasAtuais);
  } catch(e) { lista.innerHTML = `Erro ao carregar sub-tarefas.`; }
}

function renderizarSubTarefas(subs) {
  const lista = document.getElementById('lista-sub-tarefas');
  lista.innerHTML = '';
  if(subs.length === 0) { lista.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted);">Sem pendências cadastradas.</p>`; return; }

  subs.forEach(s => {
    let isConcluido = s.status.toUpperCase().includes('CONCLUÍDO');
    let display = `
      <div class="sub-task-item animate-hover" style="border-left: 4px solid ${isConcluido?'var(--status-concluido)':'var(--status-andamento)'}">
        <div class="sub-task-info">
          <strong style="text-decoration:${isConcluido?'line-through':'none'}">${s.descricao}</strong><br>
          <span style="font-size:0.78rem; color:var(--text-muted);">👤 ${s.responsavel} | 📊 ${s.status}</span>
        </div>
        <div class="sub-task-actions">
          <button class="btn-sub-acao animate-pop" title="Adicionar Comentário" onclick="prepararInteracao('SUB', 'OBS', '${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">chat</span></button>
          ${!isConcluido ? `<button class="btn-sub-acao ok animate-pop" title="Concluir Tarefa" onclick="concluirSubTarefa('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">check</span></button>` : ''}
          <button class="btn-sub-acao del animate-pop" title="Excluir Tarefa" onclick="deletarSubTarefa('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
        </div>
      </div>
    `;
    
    if(s.observacoes && s.observacoes.trim() !== '') {
        const obsLimpa = String(s.observacoes).replace(/'/g, "\\'");
        display += `
        <div class="sub-obs-container">
            <div class="sub-obs-content">
                <strong style="color:var(--text-muted);">📝 Observação:</strong><br>
                ${String(s.observacoes).replace(/\n/g, '<br>')}
            </div>
            <div class="sub-obs-actions">
                <button class="btn-mini-acao animate-pop" title="Editar" onclick="editarComentarioSub('${s.idSub}', '${obsLimpa}')"><span class="material-symbols-outlined" style="font-size:15px;">edit</span></button>
                <button class="btn-mini-acao del animate-pop" title="Apagar" onclick="removerComentarioSub('${s.idSub}')"><span class="material-symbols-outlined" style="font-size:15px;">delete</span></button>
            </div>
        </div>`;
    }
    lista.innerHTML += display;
  });
}

let intAlvo = ''; let intTipo = ''; let intID = ''; let arquivoBase64 = null; let arquivoMime = null;

function prepararInteracao(alvo, tipo, idSub = '') {
  intAlvo = alvo; intTipo = tipo; intID = idSub || osAbertaNoModal;
  document.getElementById('interacao-titulo').textContent = tipo === 'FOTO' ? 'Anexar Foto' : tipo === 'ARQUIVO' ? 'Anexar Documento' : 'Adicionar Comentário';
  
  if (tipo === 'FOTO' || tipo === 'ARQUIVO') {
    document.getElementById('area-foto').style.display = 'block'; document.getElementById('area-obs').style.display = 'none';
    document.getElementById('input-foto').accept = tipo === 'FOTO' ? 'image/*' : '*/*';
    document.getElementById('icone-upload').textContent = tipo === 'FOTO' ? 'add_a_photo' : 'upload_file';
  } else {
    document.getElementById('area-foto').style.display = 'none'; document.getElementById('area-obs').style.display = 'block';
  }
  document.getElementById('foto-selecionada').textContent = ''; document.getElementById('input-obs').value = '';
  arquivoBase64 = null; arquivoMime = null;
  document.getElementById('modal-interacao').classList.add('active');
}

document.getElementById('input-foto').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if(!file) return;
  document.getElementById('foto-selecionada').textContent = file.name;
  arquivoMime = file.type;
  const reader = new FileReader(); reader.onload = (ev) => { arquivoBase64 = ev.target.result; }; reader.readAsDataURL(file);
});

async function enviarInteracao() {
  const btn = document.getElementById('btn-salvar-interacao');
  const texto = document.getElementById('input-obs').value;
  if((intTipo === 'FOTO' || intTipo === 'ARQUIVO') && !arquivoBase64) return alert('Selecione o arquivo/foto!');
  if(intTipo === 'OBS' && !texto) return alert('Digite o comentário!');
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> Enviando...'; btn.disabled = true;
  try {
    await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'addInteracao', payload: { alvo: intAlvo, alvoID: intID, tipo: intTipo, base64: arquivoBase64, mimeType: arquivoMime, texto: texto, autor: usuarioAtual.nome } })});
    document.getElementById('modal-interacao').classList.remove('active');
    if(intAlvo === 'SUB') carregarSubTarefasDaOS(osAbertaNoModal); else { fecharModais(); carregarDadosAPI(); } 
  } catch(e) { alert('Erro.'); } finally { btn.innerHTML = 'Enviar'; btn.disabled = false; }
}

async function concluirSubTarefa(idSub) {
  if(!confirm("Marcar pendência como concluída?")) return;
  await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'atualizarStatusSub', payload: { idSub: idSub, novoStatus: 'Concluído' } })});
  subTarefasAtuais.forEach(s => { if(s.idSub === idSub) s.status = 'Concluído'; });
  recalcularProgressoGeral();
  carregarSubTarefasDaOS(osAbertaNoModal); 
}

async function recalcularProgressoGeral() {
  if(subTarefasAtuais.length === 0) return;
  const totalSubs = subTarefasAtuais.length;
  const concluidas = subTarefasAtuais.filter(s => s.status.toUpperCase().includes('CONCLUÍDO')).length;
  
  let novoProgresso = Math.round((concluidas / totalSubs) * 100);
  
  let novoStatus = 'Em Aberto';
  if (novoProgresso === 100) {
    novoStatus = 'Concluído';
  } else if (novoProgresso > 0) {
    novoStatus = 'Em Andamento';
  }

  document.getElementById('modal-progresso-txt').textContent = novoProgresso + '%';
  document.getElementById('modal-progresso-bar').style.width = novoProgresso + '%';
  document.getElementById('modal-status').textContent = novoStatus;

  await fetch(API_URL, { method: 'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({ action: 'atualizarProgressoOS', payload: { idOS: osAbertaNoModal, novoProgresso: novoProgresso, novoStatus: novoStatus } })});
  carregarDadosAPI(); 
}

checarSessaoAutomatica();