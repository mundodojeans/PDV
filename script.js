// Substitua pela URL gerada ao implantar o Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycby2nG5yjrf8oU8Rn7DNt8s6UP8itOVUmuQNLkdpVx82tB60D_vI0SejU-6Wq6mqemcCyg/exec"; 

// ESTADO GLOBAL
let currentUser = null;
let cart = [];
let allProducts = [];
let allSales = [];
let storeData = {};
let companyLocation = { lat: -5.637721, lon: -35.424134 };

// --- INICIALIZAÇÃO E UTILITÁRIOS ---
window.onload = () => {
    setInterval(updateClock, 1000);
};

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function formatDate(date) {
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

// --- COMUNICAÇÃO COM API (APPS SCRIPT) ---
async function apiCall(action, data = {}) {
    showLoading(true);
    try {
        // Devido ao CORS do Apps Script, usamos POST para envio e leitura em alguns casos ou no-cors
        // mas aqui vamos usar a estrutura de redirecionamento padrão do Apps Script
        const response = await fetch(API_URL + "?action=" + action, {
            method: "POST",
            body: JSON.stringify(data)
        });
        const json = await response.json();
        showLoading(false);
        return json;
    } catch (error) {
        showLoading(false);
        alert("Erro de conexão: " + error);
        return null;
    }
}

// --- LOGIN & CADASTRO ---
function toggleLogin(mode) {
    if(mode === 'signup') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    } else {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
    }
}

async function fazerLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    
    if(!user || !pass) return alert("Preencha todos os campos");
    
    // Requisição real
    const res = await apiCall("login", {user, pass});
    
    if(res && res.status === 'success') {
        currentUser = { user: user, name: res.name, pass: pass }; // Salva pass para confirmar ponto
        document.getElementById('welcome-msg').innerText = "Olá, " + res.name;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        carregarDadosSistema(); // Carrega tudo ao entrar
        showView('dashboard');
    } else {
        alert(res ? res.message : "Erro ao logar");
    }
}

async function criarConta() {
    const data = {
        user: document.getElementById('sign-user').value,
        pass: document.getElementById('sign-pass').value,
        name: document.getElementById('sign-name').value,
        cpf: document.getElementById('sign-cpf').value,
        phone: document.getElementById('sign-phone').value
    };
    if(!data.user || !data.pass) return alert("Campos obrigatórios faltando");

    const res = await apiCall("register", data);
    if(res && res.status === 'success') {
        alert("Conta criada! Faça login.");
        toggleLogin('login');
    } else {
        alert("Erro: " + (res ? res.message : "Desconhecido"));
    }
}

function logout() {
    location.reload();
}

// --- NAVEGAÇÃO E DADOS ---
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
}

async function carregarDadosSistema() {
    const res = await apiCall("getData");
    if(res && res.status === 'success') {
        allProducts = res.estoque;
        allSales = res.vendas;
        storeData = res.loja[0] || {};
        
        renderDashboard();
        renderEstoque();
        renderPOSProducts();
        fillStoreForm();
    }
}

// --- DASHBOARD ---
function renderDashboard() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const hojeStr = hoje.toLocaleDateString();

    let totalHoje = 0, totalMes = 0, totalAno = 0;
    let lucroMes = 0;
    let vendasPorUser = {};
    let produtosQtd = {};

    allSales.forEach(v => {
        const vDate = new Date(v['data da venda']);
        const val = parseFloat(v.valor);
        
        // Totais
        if(vDate.toLocaleDateString() === hojeStr) totalHoje += val;
        if(vDate.getMonth() === mesAtual && vDate.getFullYear() === anoAtual) {
            totalMes += val;
            
            // Lucro: Venda - (Custo * Qtd)
            // Nota: Simplificação usando custo atual, pois histórico de custo não existe na tabela itens_vendidos
            const prod = allProducts.find(p => p['código do produto'] == v['codigo do produto']);
            const custo = prod ? parseFloat(prod['preço de compra']) : 0;
            lucroMes += val - (custo * parseFloat(v['quantidade vendida']));

            // Top User
            vendasPorUser[v['vendedor no caixa']] = (vendasPorUser[v['vendedor no caixa']] || 0) + 1;
        }
        if(vDate.getFullYear() === anoAtual) totalAno += val;

        // Top Produtos (Geral para simplificar ou filtrar por mês)
        if(vDate.getMonth() === mesAtual) {
            produtosQtd[v['codigo do produto']] = (produtosQtd[v['codigo do produto']] || 0) + parseFloat(v['quantidade vendida']);
        }
    });

    // Despesas Fixas
    const despesas = (parseFloat(storeData['valor medio mensal da agua']||0) + 
                     parseFloat(storeData['valor medio mensal da luz']||0) + 
                     parseFloat(storeData['valor mensal da internet']||0) + 
                     parseFloat(storeData['valor do aluguel']||0) + 
                     parseFloat(storeData['despesas com embalagens']||0) + 
                     parseFloat(storeData['despesas com funcionarios']||0) + 
                     parseFloat(storeData['despesas gerais']||0));
    
    lucroMes -= despesas;

    // Atualiza DOM
    document.getElementById('kpi-today').innerText = formatCurrency(totalHoje);
    document.getElementById('kpi-month').innerText = formatCurrency(totalMes);
    document.getElementById('kpi-year').innerText = formatCurrency(totalAno);
    document.getElementById('kpi-profit').innerText = formatCurrency(lucroMes);

    // Top Vendedor
    let topUser = Object.keys(vendasPorUser).reduce((a, b) => vendasPorUser[a] > vendasPorUser[b] ? a : b, "---");
    document.getElementById('top-seller').innerText = topUser;

    // Top Produtos
    const sortedProds = Object.entries(produtosQtd)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10);
    
    const list = document.getElementById('top-products-list');
    list.innerHTML = "";
    sortedProds.forEach(([code, qtd]) => {
        const p = allProducts.find(x => x['código do produto'] == code);
        const li = document.createElement('li');
        li.innerText = `${qtd}x - ${p ? p['nome do produto'] : code}`;
        list.appendChild(li);
    });
}

async function exportarRelatorioPDF() {
    showLoading(true);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(212, 175, 55); // Dourado
    doc.text("RELATÓRIO PDV - MUNDO DO JEANS", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 10, 30);
    doc.text(`Solicitado por: ${currentUser.name}`, 10, 36);

    const kpiToday = document.getElementById('kpi-today').innerText;
    const kpiMonth = document.getElementById('kpi-month').innerText;
    const kpiProfit = document.getElementById('kpi-profit').innerText;

    doc.text("Resumo Financeiro:", 10, 50);
    doc.autoTable({
        startY: 55,
        head: [['Hoje', 'Mês', 'Lucro Líquido (Mês)']],
        body: [[kpiToday, kpiMonth, kpiProfit]],
        theme: 'grid'
    });

    doc.save("Relatorio_MundoDoJeans.pdf");
    showLoading(false);
}

// --- VENDER / POS ---
function renderPOSProducts() {
    const container = document.getElementById('pos-product-list');
    container.innerHTML = "";
    allProducts.forEach(p => {
        const div = document.createElement('div');
        div.className = 'prod-card';
        div.innerHTML = `
            <div style="font-weight:bold; color:var(--gold)">${p['nome do produto']}</div>
            <div style="font-size:0.8em">${p['descrição']}</div>
            <div style="margin-top:5px">R$ ${p['preço de revenda']}</div>
        `;
        div.onclick = () => addToCart(p);
        container.appendChild(div);
    });
}

function filtrarProdutosPOS() {
    const term = document.getElementById('search-pos').value.toLowerCase();
    const cards = document.querySelectorAll('.prod-card');
    cards.forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none';
    });
}

function addToCart(product) {
    const existing = cart.find(item => item.prod_id === product['código do produto']);
    if(existing) {
        existing.qty++;
        existing.total = existing.qty * existing.price;
    } else {
        cart.push({
            prod_id: product['código do produto'],
            name: product['nome do produto'],
            qty: 1,
            price: product['preço de revenda'],
            total: product['preço de revenda']
        });
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    container.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
        total += item.total;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <span>${item.qty}x ${item.name}</span>
            <span>R$ ${item.total.toFixed(2)}</span>
        `;
        container.appendChild(div);
    });
    document.getElementById('cart-total-value').innerText = formatCurrency(total);
}

function checkPaymentMethod() {
    const method = document.getElementById('pay-method').value;
    document.getElementById('credit-details').classList.toggle('hidden', method !== 'Crédito');
    document.getElementById('crediario-details').classList.toggle('hidden', method !== 'Crediário');
    // NOVO: Se escolher Pix, abre a janelinha do QR Code automaticamente
    if(method === 'Pix') {
        abrirPix();
    }
}

async function finalizarVenda() {
    if(cart.length === 0) return alert("Carrinho vazio!");
    
    const method = document.getElementById('pay-method').value;
    let payDesc = method;
    let cpf = "", phone = "";

    if(method === 'Crédito') {
        const parc = document.getElementById('installments').value;
        if(!parc) return alert("Informe parcelas");
        payDesc = `Crédito - ${parc}x`;
    } else if(method === 'Crediário') {
        cpf = document.getElementById('client-cpf').value;
        phone = document.getElementById('client-phone').value;
        if(!cpf || !phone) return alert("CPF e Telefone obrigatórios para crediário");
    }

    const saleId = "VND-" + Date.now().toString(36).toUpperCase();
    const now = new Date();

    const saleData = {
        items: cart,
        sale_id: saleId,
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR'),
        seller: currentUser.user,
        payment: payDesc,
        client_cpf: cpf,
        client_phone: phone
    };

    const res = await apiCall("saveSale", saleData);
    
    if(res && res.status === 'success') {
        gerarCupomTXT(saleData, cart, document.getElementById('cart-total-value').innerText);
        alert("Venda realizada com sucesso!");
        cart = [];
        updateCartUI();
        carregarDadosSistema(); // Atualiza estoque e dashboard
    } else {
        alert("Erro ao salvar venda.");
    }
}

function gerarCupomTXT(data, items, totalStr) {
    let txt = `MUNDO DO JEANS - CUPOM FISCAL\n`;
    txt += `--------------------------------\n`;
    txt += `Venda: ${data.sale_id}\n`;
    txt += `Data: ${data.date} - Hora: ${data.time}\n`;
    txt += `Cliente: ${data.client_cpf || 'Não inf.'}\n`;
    txt += `--------------------------------\n`;
    items.forEach(i => {
        txt += `${i.qty}x ${i.name} ... R$ ${i.total.toFixed(2)}\n`;
    });
    txt += `--------------------------------\n`;
    txt += `TOTAL: ${totalStr}\n`;
    txt += `Pagamento: ${data.payment}\n`;
    
    const blob = new Blob([txt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cupom_${data.sale_id}.txt`;
    link.click();
}

// --- ESTOQUE ---
function renderEstoque() {
    const tbody = document.querySelector('#stock-table tbody');
    tbody.innerHTML = "";
    allProducts.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p['código do produto']}</td>
            <td>${p['nome do produto']}</td>
            <td>${p['quantidade em estoque']}</td>
            <td>R$ ${p['preço de compra']}</td>
            <td>R$ ${p['preço de revenda']}</td>
            <td>${p['descrição']}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarEstoque() {
    const term = document.getElementById('search-stock').value.toLowerCase();
    const rows = document.querySelectorAll('#stock-table tbody tr');
    rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
}

function abrirModalProduto() {
    document.getElementById('modal-produto').classList.remove('hidden');
    document.getElementById('new-prod-id').value = "PROD-" + Math.random().toString(36).substr(2, 6).toUpperCase();
}
function fecharModalProduto() { document.getElementById('modal-produto').classList.add('hidden'); }

async function salvarNovoProduto() {
    const d = {
        id: document.getElementById('new-prod-id').value,
        name: document.getElementById('new-prod-name').value,
        qty: document.getElementById('new-prod-qty').value,
        buy_price: document.getElementById('new-prod-buy').value,
        sell_price: document.getElementById('new-prod-sell').value,
        desc: document.getElementById('new-prod-desc').value
    };
    
    const res = await apiCall("addProduct", d);
    if(res.status === 'success') {
        alert("Produto adicionado!");
        fecharModalProduto();
        carregarDadosSistema();
    }
}

// --- PONTO ---
function updateClock() {
    const now = new Date();
    document.getElementById('digital-clock').innerText = now.toLocaleTimeString();
    document.getElementById('date-display').innerText = now.toLocaleDateString();
}

function baterPonto() {
    if(!navigator.geolocation) return alert("Geolocalização não suportada.");
    
    const password = prompt("Confirme sua senha para bater o ponto:");
    if(password !== currentUser.pass) return alert("Senha incorreta.");

    showLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        // Calcular distância (Haversine simples)
        const R = 6371e3; // Metros
        const φ1 = lat * Math.PI/180;
        const φ2 = companyLocation.lat * Math.PI/180;
        const Δφ = (companyLocation.lat-lat) * Math.PI/180;
        const Δλ = (companyLocation.lon-lon) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = R * c;

        if(dist > 150) {
            showLoading(false);
            return alert(`Você está a ${Math.round(dist)}m da empresa. Limite é 150m. Ponto negado.`);
        }

        const now = new Date();
        const data = {
            user: currentUser.user,
            pass: password, // Envia para validar no backend tb
            type: document.getElementById('ponto-type').value,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString()
        };

        const res = await apiCall("savePonto", data);
        if(res.status === 'success') alert("Ponto batido com sucesso!");
        else alert("Erro: " + res.message);
        
    }, (err) => {
        showLoading(false);
        alert("Erro de GPS: " + err.message);
    });
}

// --- MINHA LOJA ---
function fillStoreForm() {
    if(!storeData) return;
    document.getElementById('lj-nome').value = storeData['nome da loja'] || '';
    document.getElementById('lj-rua').value = storeData['rua'] || '';
    document.getElementById('lj-cidade').value = storeData['cidade'] || '';
    document.getElementById('lj-bairro').value = storeData['bairro'] || '';
    document.getElementById('lj-num').value = storeData['numero'] || '';
    document.getElementById('lj-cep').value = storeData['cep'] || '';
    
    document.getElementById('lj-agua').value = storeData['valor medio mensal da agua'] || '';
    document.getElementById('lj-luz').value = storeData['valor medio mensal da luz'] || '';
    document.getElementById('lj-net').value = storeData['valor mensal da internet'] || '';
    document.getElementById('lj-aluguel').value = storeData['valor do aluguel'] || '';
    document.getElementById('lj-emb').value = storeData['despesas com embalagens'] || '';
    document.getElementById('lj-func').value = storeData['despesas com funcionarios'] || '';
    document.getElementById('lj-geral').value = storeData['despesas gerais'] || '';
}

async function editarLoja() {
    const data = {
        nome: document.getElementById('lj-nome').value,
        rua: document.getElementById('lj-rua').value,
        cidade: document.getElementById('lj-cidade').value,
        bairro: document.getElementById('lj-bairro').value,
        num: document.getElementById('lj-num').value,
        cep: document.getElementById('lj-cep').value,
        agua: document.getElementById('lj-agua').value,
        luz: document.getElementById('lj-luz').value,
        net: document.getElementById('lj-net').value,
        aluguel: document.getElementById('lj-aluguel').value,
        emb: document.getElementById('lj-emb').value,
        func: document.getElementById('lj-func').value,
        geral: document.getElementById('lj-geral').value,
    };
    
    const res = await apiCall("updateStore", data);
    if(res.status === 'success') alert("Dados atualizados!");
}

// --- HISTÓRICO MINHAS VENDAS ---
function abrirMinhasVendas() {
    document.getElementById('modal-vendas').classList.remove('hidden');
    renderHistoricoVendas();
}
function fecharModalVendas() { document.getElementById('modal-vendas').classList.add('hidden'); }

function renderHistoricoVendas() {
    const tbody = document.querySelector('#sales-history-table tbody');
    tbody.innerHTML = "";
    // Filtra últimas 50 vendas ou todas
    allSales.slice(-50).reverse().forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(new Date(v['data da venda']))}</td>
            <td>${v['cpf do cliente'] || 'Avulso'}</td>
            <td>${v['codigo do produto']} (x${v['quantidade vendida']})</td>
            <td>${formatCurrency(v['valor'])}</td>
        `;
        tbody.appendChild(tr);
    });
}
function filtrarHistoricoVendas() {
    const term = document.getElementById('search-sales-hist').value.toLowerCase();
    const rows = document.querySelectorAll('#sales-history-table tbody tr');
    rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
}
// CONFIGURAÇÃO DO SEU PIX
const MINHA_CHAVE_PIX = "+5584991096792"; // Pode ser CPF, CNPJ, Email ou Aleatória
const NOME_LOJA = "MUNDO DO JEANS";
const CIDADE_LOJA = "CEARAMIRIM"; // Sem acentos

function gerarPayloadPix(valor) {
    const v = parseFloat(valor).toFixed(2);
    
    // Função para formatar o tamanho do campo (padrão EMV)
    const f = (id, conteudo) => id + String(conteudo.length).padStart(2, '0') + conteudo;

    // Estrutura básica do Payload Pix Estático
    let payload = "000201"; // Versão do payload
    payload += "26" + (31 + MINHA_CHAVE_PIX.length); // Domínio da conta
    payload += f("00", "br.gov.bcb.pix");
    payload += f("01", MINHA_CHAVE_PIX);
    payload += "52040000"; // Categoria do negócio
    payload += "5303986";  // Moeda (BRL)
    payload += f("54", v); // VALOR DA VENDA
    payload += "5802BR";   // Código do país
    payload += f("59", NOME_LOJA);
    payload += f("60", CIDADE_LOJA);
    payload += "62070503***"; // ID da transação (fixo como ***)
    
    // Cálculo do CRC16 (validação final do código)
    payload += "6304";
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
            else crc <<= 1;
        }
    }
    payload += (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    
    return payload;
}

// Funções de Interface do Pix
function abrirPix() {
    const totalRaw = document.getElementById('cart-total-value').innerText;
    const total = totalRaw.replace('R$', '').replace('.', '').replace(',', '.').trim();
    
    if(parseFloat(total) <= 0) return alert("Carrinho vazio!");

    const payload = gerarPayloadPix(total);
    document.getElementById('pix-copia-cola').value = payload;
    
    // Limpa QR Code anterior e gera novo
    document.getElementById('qrcode-container').innerHTML = "";
    new QRCode(document.getElementById("qrcode-container"), {
        text: payload,
        width: 180,
        height: 180
    });

    document.getElementById('modal-pix').classList.remove('hidden');
}

function fecharModalPix() {
    document.getElementById('modal-pix').classList.add('hidden');
}

function confirmarPagamentoPix() {
    fecharModalPix();
    finalizarVenda(); // Chama sua função original de salvar na planilha
}
