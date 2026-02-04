// script.js - Frontend logic
// Defina a URL do seu Web App do Google Apps Script aqui:
const API_URL = 'https://script.google.com/macros/s/AKfycbxG5xxM-n-4CePPQ4PRdzyWPLUf3jljyMhdR1o8qOYUbLE5Fp4JaTMp3hPVhxbWIrKsQA/exec';

let currentUser = null;
let productsCache = [];
let cart = {};

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

async function api(action, payload = {}){
  const body = Object.assign({action}, payload);
  const res = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  return res.json();
}

/* ---------- Auth ---------- */
qs('#show-register').addEventListener('click', ()=>{ hide(qs('#login-form')); show(qs('#register-form')); });
qs('#show-login').addEventListener('click', ()=>{ show(qs('#login-form')); hide(qs('#register-form')); });

qs('#btn-login').addEventListener('click', async ()=>{
  const u = qs('#login-username').value.trim();
  const p = qs('#login-password').value.trim();
  if(!u||!p) return showMsg('#auth-msg','Preencha usuário e senha.');
  show(qs('#auth-spinner'));
  const r = await api('login',{username:u,password:p});
  hide(qs('#auth-spinner'));
  if(r.ok){
    currentUser = r.user;
    initApp();
  } else showMsg('#auth-msg', r.message || 'Erro no login.');
});

qs('#btn-register').addEventListener('click', async ()=>{
  const u = qs('#reg-username').value.trim();
  const p = qs('#reg-password').value.trim();
  const nome = qs('#reg-nome').value.trim();
  const cpf = qs('#reg-cpf').value.trim();
  const tel = qs('#reg-telefone').value.trim();
  if(!u||!p||!nome) return showMsg('#auth-msg','Preencha os campos obrigatórios.');
  show(qs('#auth-spinner'));
  const r = await api('register',{username:u,password:p,nome,cpf,telefone:tel});
  hide(qs('#auth-spinner'));
  if(r.ok){
    showMsg('#auth-msg','Conta criada. Faça login.');
    show(qs('#login-form')); hide(qs('#register-form'));
  } else showMsg('#auth-msg', r.message || 'Erro ao criar conta.');
});

function showMsg(sel, text){
  const el = qs(sel);
  el.textContent = text;
  setTimeout(()=> el.textContent = '', 5000);
}

/* ---------- Init App ---------- */
function initApp(){
  hide(qs('#auth'));
  show(qs('#main'));
  qs('#hello-name').textContent = currentUser.nome || currentUser.username;
  qs('#user-welcome').textContent = currentUser.nome || currentUser.username;
  bindMenu();
  loadDashboard();
  startClock();
  loadProducts();
}

qs('#logout').addEventListener('click', ()=>{
  location.reload();
});

/* ---------- Menu ---------- */
function bindMenu(){
  qsa('.menu-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      qsa('.menu-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      qsa('.view').forEach(v=>v.classList.add('hidden'));
      qs('#view-'+view).classList.remove('hidden');
      if(view === 'dashboard') loadDashboard();
      if(view === 'vender') loadProducts();
      if(view === 'estoque') loadEstoque();
      if(view === 'minha-loja') loadStore();
    });
  });
}

/* ---------- Dashboard ---------- */
async function loadDashboard(){
  show(qs('#dashboard-spinner'));
  const r = await api('getDashboard',{});
  hide(qs('#dashboard-spinner'));
  if(!r.ok) return showMsg('#auth-msg','Erro ao carregar dashboard.');
  qs('#vendas-hoje').textContent = formatMoney(r.totals.today);
  qs('#vendas-mes').textContent = formatMoney(r.totals.month);
  qs('#vendas-ano').textContent = formatMoney(r.totals.year);
  qs('#lucro-mes').textContent = formatMoney(r.lucro.mes);
  qs('#top-vendedor').textContent = r.topVendedorMes || '—';
  renderList('#top10-mes', r.top10Mes || []);
  renderList('#top10-ano', r.top10Ano || []);
}

function renderList(sel, arr){
  const el = qs(sel);
  el.innerHTML = '';
  (arr||[]).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = `${item.codigo} — ${item.quantidade}`;
    el.appendChild(li);
  });
}

qs('#export-dashboard').addEventListener('click', async ()=>{
  show(qs('#export-spinner'));
  const r = await api('getDashboard',{});
  hide(qs('#export-spinner'));
  if(!r.ok) return showMsg('#auth-msg','Erro ao exportar.');
  // gerar PDF com jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('PDV MUNDO DO JEANS - Relatório', 14, 20);
  doc.setFontSize(12);
  doc.text(`Usuário: ${currentUser.nome || currentUser.username}`, 14, 30);
  doc.text(`Vendas Hoje: ${formatMoney(r.totals.today)}`, 14, 40);
  doc.text(`Vendas Mês: ${formatMoney(r.totals.month)}`, 14, 48);
  doc.text(`Vendas Ano: ${formatMoney(r.totals.year)}`, 14, 56);
  doc.text(`Lucro Mês: ${formatMoney(r.lucro.mes)}`, 14, 64);
  doc.save(`relatorio_pdv_${Date.now()}.pdf`);
});

/* ---------- Produtos / Vender ---------- */
async function loadProducts(){
  show(qs('#products-spinner'));
  const r = await api('getProducts',{});
  hide(qs('#products-spinner'));
  if(!r.ok) return showMsg('#auth-msg','Erro ao carregar produtos.');
  productsCache = r.products || [];
  renderProducts(productsCache);
}

function renderProducts(list){
  const container = qs('#products-list');
  container.innerHTML = '';
  list.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `<div><strong>${p['nome do produto'] || p['nome']}</strong><div class="muted">${p['descricao']||''}</div></div><div>R$ ${Number(p['preço de revenda']||p['preco de revenda']||0).toFixed(2)}</div>`;
    div.addEventListener('click', ()=> addToCart(p));
    container.appendChild(div);
  });
}

function addToCart(product){
  const code = product['código do produto'] || product['codigo do produto'] || product['codigo'];
  if(!cart[code]) cart[code] = {product, quantidade:0};
  cart[code].quantidade += 1;
  renderCart();
}

function renderCart(){
  const el = qs('#cart-list');
  el.innerHTML = '';
  Object.keys(cart).forEach(code=>{
    const item = cart[code];
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `<div>${item.product['nome do produto'] || item.product['nome']} x ${item.quantidade}</div><div><button class="btn" data-code="${code}">-</button> <button class="btn" data-code-add="${code}">+</button></div>`;
    el.appendChild(div);
  });
  qsa('#cart-list .btn').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const code = ev.target.dataset.code;
      if(code){
        cart[code].quantidade = Math.max(0, cart[code].quantidade - 1);
        if(cart[code].quantidade === 0) delete cart[code];
        renderCart();
      }
      const codeAdd = ev.target.dataset.codeAdd;
      if(codeAdd){
        cart[codeAdd].quantidade += 1;
        renderCart();
      }
    });
  });
}

/* pagamento extra fields */
qs('#payment-method').addEventListener('change', ()=>{
  const val = qs('#payment-method').value;
  const container = qs('#payment-extra');
  container.innerHTML = '';
  if(val === 'Crediário'){
    container.innerHTML = `<input id="crediario-cpf" placeholder="CPF do cliente" /><input id="crediario-tel" placeholder="Telefone do cliente" />`;
  } else if(val === 'Cartão'){
    container.innerHTML = `<input id="cartao-parcelas" type="number" placeholder="Número de parcelas" />`;
  }
});

qs('#finalize-sale').addEventListener('click', async ()=>{
  if(Object.keys(cart).length === 0) return showMsg('#auth-msg','Carrinho vazio.');
  const method = qs('#payment-method').value;
  let cpf = '', tel = '', parcelas = '';
  if(method === 'Crediário'){
    cpf = qs('#crediario-cpf') ? qs('#crediario-cpf').value.trim() : '';
    tel = qs('#crediario-tel') ? qs('#crediario-tel').value.trim() : '';
    if(!cpf || !tel) return showMsg('#auth-msg','CPF e telefone são obrigatórios para crediário.');
  }
  if(method === 'Cartão'){
    parcelas = qs('#cartao-parcelas') ? qs('#cartao-parcelas').value.trim() : '';
    if(!parcelas) return showMsg('#auth-msg','Informe o número de parcelas.');
  }

  // montar vendas e salvar
  show(qs('#sale-spinner'));
  const saleCode = generateCode('V');
  const now = new Date();
  const dateStr = now.toISOString().slice(0,10);
  const timeStr = now.toTimeString().slice(0,8);
  for(const code in cart){
    const item = cart[code];
    const valorUnit = Number(item.product['preço de revenda'] || item.product['preco de revenda'] || 0);
    const quantidade = item.quantidade;
    const valorTotal = valorUnit * quantidade;
    const saleRow = {
      'codigo do produto': code,
      'código da venda': saleCode,
      'quantidade vendida': quantidade,
      'valor': valorTotal,
      'data da venda': dateStr,
      'hora da venda': timeStr,
      'vendedor no caixa': currentUser.username,
      'método de pagamento': method === 'Cartão' ? `Crédito - ${parcelas}` : method,
      'cpf do cliente': cpf,
      'telefone do cliente': tel
    };
    await api('addSale',{sale: saleRow});
  }
  hide(qs('#sale-spinner'));
  // gerar cupom txt
  generateReceiptTxt(saleCode, cart, method, cpf, tel);
  cart = {};
  renderCart();
  showMsg('#auth-msg','Venda finalizada e registrada.');
});

function generateReceiptTxt(saleCode, cartObj, method, cpf, tel){
  let text = `CUPOM FISCAL - PDV MUNDO DO JEANS\nCÓDIGO VENDA: ${saleCode}\nDATA: ${new Date().toLocaleString()}\n\nITENS:\n`;
  let total = 0;
  for(const code in cartObj){
    const it = cartObj[code];
    const nome = it.product['nome do produto'] || it.product['nome'];
    const qtd = it.quantidade;
    const valorUnit = Number(it.product['preço de revenda'] || it.product['preco de revenda'] || 0);
    const subtotal = qtd * valorUnit;
    total += subtotal;
    text += `${code} | ${nome} | Qtd: ${qtd} | R$ ${valorUnit.toFixed(2)} | Sub: R$ ${subtotal.toFixed(2)}\n`;
  }
  text += `\nTOTAL: R$ ${total.toFixed(2)}\nMÉTODO: ${method}\nCPF: ${cpf}\nTELEFONE: ${tel}\n\nObrigado pela preferência!\n`;
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cupom_${saleCode}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* Minhas vendas modal */
qs('#my-sales').addEventListener('click', ()=> show(qs('#modal-sales')));
qs('#close-sales-modal').addEventListener('click', ()=> hide(qs('#modal-sales')));
qs('#search-sales').addEventListener('input', debounce(async (e)=>{
  const q = e.target.value.trim();
  if(!q) return qs('#sales-results').innerHTML = '';
  const r = await api('searchSales',{query:q});
  if(!r.ok) return showMsg('#auth-msg','Erro na busca.');
  const el = qs('#sales-results');
  el.innerHTML = '';
  (r.results||[]).forEach(s=>{
    const d = document.createElement('div');
    d.className = 'product-item';
    d.textContent = `${s['código da venda'] || s['codigo da venda'] || ''} | ${s['codigo do produto'] || s['codigo do produto'] || ''} | R$ ${Number(s['valor']||0).toFixed(2)}`;
    el.appendChild(d);
  });
}, 400));

/* ---------- Estoque ---------- */
qs('#btn-add-product').addEventListener('click', ()=>{
  qs('#new-codigo').value = generateCode('P');
  show(qs('#modal-add-product'));
});
qs('#close-add-product').addEventListener('click', ()=> hide(qs('#modal-add-product')));
qs('#save-product').addEventListener('click', async ()=>{
  const prod = {
    'código do produto': qs('#new-codigo').value,
    'nome do produto': qs('#new-nome').value,
    'quantidade em estoque': qs('#new-quantidade').value,
    'preço de compra': qs('#new-preco-compra').value,
    'preço de revenda': qs('#new-preco-revenda').value,
    'descrição': qs('#new-descricao').value
  };
  show(qs('#add-product-spinner'));
  const r = await api('addProduct',{product:prod});
  hide(qs('#add-product-spinner'));
  if(r.ok){
    hide(qs('#modal-add-product'));
    loadEstoque();
    showMsg('#auth-msg','Produto adicionado.');
  } else showMsg('#auth-msg','Erro ao adicionar produto.');
});

async function loadEstoque(){
  show(qs('#estoque-spinner'));
  const r = await api('getProducts',{});
  hide(qs('#estoque-spinner'));
  if(!r.ok) return showMsg('#auth-msg','Erro ao carregar estoque.');
  const list = r.products || [];
  const container = qs('#estoque-list');
  container.innerHTML = '';
  // headers
  const headers = ['código do produto','nome do produto','quantidade em estoque','preço de compra','preço de revenda','descrição'];
  const headerRow = document.createElement('div');
  headerRow.className = 'row';
  headers.forEach(h=>{
    const c = document.createElement('div'); c.className='cell'; c.textContent = h; headerRow.appendChild(c);
  });
  container.appendChild(headerRow);
  list.forEach(p=>{
    const row = document.createElement('div'); row.className='row';
    headers.forEach(h=>{
      const c = document.createElement('div'); c.className='cell'; c.textContent = p[h] || p[h.replace('ç','c')] || '';
      row.appendChild(c);
    });
    container.appendChild(row);
  });
}

/* ---------- Ponto ---------- */
function startClock(){
  setInterval(()=>{
    const now = new Date();
    qs('#clock').textContent = now.toLocaleTimeString();
  }, 1000);
}

qs('#btn-punch').addEventListener('click', async ()=>{
  const tipo = qs('#tipo-ponto').value;
  show(qs('#punch-spinner'));
  // obter geolocalização
  if(!navigator.geolocation){
    hide(qs('#punch-spinner'));
    return showMsg('#punch-msg','Geolocalização não suportada.');
  }
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    // pedir senha
    const senha = prompt('Confirme sua senha para bater o ponto:');
    if(!senha){ hide(qs('#punch-spinner')); return; }
    const r = await api('punchClock',{username: currentUser.username, tipo, latitude: lat, longitude: lon, senha});
    hide(qs('#punch-spinner'));
    if(r.ok) showMsg('#punch-msg', r.message || 'Ponto batido.');
    else showMsg('#punch-msg', r.message || 'Erro ao bater ponto.');
  }, (err)=>{
    hide(qs('#punch-spinner'));
    showMsg('#punch-msg','Não foi possível obter localização.');
  }, {enableHighAccuracy:true, timeout:10000});
});

/* ---------- Minha loja ---------- */
qs('#edit-store').addEventListener('click', ()=> {
  show(qs('#modal-edit-store'));
});
qs('#close-edit-store').addEventListener('click', ()=> hide(qs('#modal-edit-store')));
qs('#save-store').addEventListener('click', async ()=>{
  const store = {
    'nome da loja': qs('#store-nome').value,
    'rua': qs('#store-rua').value,
    'cidade': qs('#store-cidade').value,
    'bairro': qs('#store-bairro').value,
    'numero': qs('#store-numero').value,
    'cep': qs('#store-cep').value,
    'valor medio mensal da agua': qs('#store-agua').value,
    'valor medio mensal da luz': qs('#store-luz').value,
    'valor mensal da internet': qs('#store-internet').value,
    'valor do aluguel': qs('#store-aluguel').value,
    'despesas com embalagens': qs('#store-embalagens').value,
    'despesas com funcionarios': qs('#store-func').value,
    'despesas gerais': qs('#store-gerais').value,
    'latitude': qs('#store-lat').value,
    'longitude': qs('#store-lon').value
  };
  show(qs('#save-store-spinner'));
  const r = await api('updateStore',{store});
  hide(qs('#save-store-spinner'));
  if(r.ok){
    hide(qs('#modal-edit-store'));
    loadStore();
    showMsg('#auth-msg','Dados da loja atualizados.');
  } else showMsg('#auth-msg','Erro ao salvar dados.');
});

async function loadStore(){
  show(qs('#store-spinner'));
  const r = await api('getStore',{});
  hide(qs('#store-spinner'));
  if(!r.ok) return showMsg('#auth-msg','Erro ao carregar dados da loja.');
  const s = r.store || {};
  qs('#store-address').innerHTML = `<strong>${s['nome da loja']||''}</strong><div>${s['rua']||''}, ${s['numero']||''} - ${s['bairro']||''} - ${s['cidade']||''} - CEP ${s['cep']||''}</div>`;
  qs('#store-expenses').innerHTML = `<div>Água: R$ ${Number(s['valor medio mensal da agua']||0).toFixed(2)}</div><div>Luz: R$ ${Number(s['valor medio mensal da luz']||0).toFixed(2)}</div><div>Internet: R$ ${Number(s['valor mensal da internet']||0).toFixed(2)}</div><div>Aluguel: R$ ${Number(s['valor do aluguel']||0).toFixed(2)}</div>`;
  // preencher modal
  qs('#store-nome').value = s['nome da loja']||'';
  qs('#store-rua').value = s['rua']||'';
  qs('#store-cidade').value = s['cidade']||'';
  qs('#store-bairro').value = s['bairro']||'';
  qs('#store-numero').value = s['numero']||'';
  qs('#store-cep').value = s['cep']||'';
  qs('#store-agua').value = s['valor medio mensal da agua']||'';
  qs('#store-luz').value = s['valor medio mensal da luz']||'';
  qs('#store-internet').value = s['valor mensal da internet']||'';
  qs('#store-aluguel').value = s['valor do aluguel']||'';
  qs('#store-embalagens').value = s['despesas com embalagens']||'';
  qs('#store-func').value = s['despesas com funcionarios']||'';
  qs('#store-gerais').value = s['despesas gerais']||'';
  qs('#store-lat').value = s['latitude']||'';
  qs('#store-lon').value = s['longitude']||'';
}

/* ---------- Utilitários ---------- */
function formatMoney(v){
  return 'R$ ' + Number(v||0).toFixed(2);
}

function generateCode(prefix){
  const s = Math.random().toString(36).substring(2,8).toUpperCase();
  return `${prefix}${s}${Date.now().toString().slice(-4)}`;
}

function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this,args), wait);
  };
}
