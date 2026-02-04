const URL = "https://script.google.com/macros/s/AKfycby8E3XNk7nS6GPar-u-kyqL4_33xeBFRGCfsEX11FgqDbwkmi8A3EK57HALJ568eoCjsw/exec";
let user = null;
let prods = [];
let cart = [];

// --- CHAMADA API ---
async function call(action, data = {}) {
    try {
        const res = await fetch(URL, { method: "POST", body: JSON.stringify({ action, ...data }) });
        return await res.json();
    } catch (err) {
        console.error("Erro na API:", err);
        return { status: "error", message: "Erro de conexão." };
    }
}

// --- LOGIN & NAVEGAÇÃO ---
function toggleLogin(reg) {
    document.getElementById('form-login').style.display = reg ? 'none' : 'block';
    document.getElementById('form-reg').style.display = reg ? 'block' : 'none';
}

async function fazerLogin() {
    const u = document.getElementById('l-user').value;
    const p = document.getElementById('l-pass').value;
    if (!u || !p) return alert("Preencha tudo!");

    const btn = document.querySelector("#form-login button");
    btn.innerText = "Verificando...";
    
    const res = await call("login", { user: u, pass: p });
    if (res.status === "success") {
        user = res.userData;
        document.getElementById('u-nome').innerText = user.nome;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        show('dashboard');
    } else {
        alert(res.message);
    }
    btn.innerText = "Entrar";
}

function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const target = document.getElementById('s-' + id);
    if (target) target.style.display = 'block';

    if (id === 'estoque') loadEstoque();
    if (id === 'vender') loadPDV();
    if (id === 'dashboard') loadDash();
    if (id === 'config') loadConf();
}

// --- ESTOQUE ---
async function loadEstoque() {
    const res = await call("get_products");
    const tb = document.querySelector("#tbl-est tbody");
    tb.innerHTML = "";
    prods = res.products || [];
    prods.forEach(p => {
        tb.innerHTML += `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td>R$ ${parseFloat(p[4]).toFixed(2)}</td></tr>`;
    });
}

async function addProd() {
    const pData = { 
        codigo: document.getElementById('p-cod').value, 
        nome: document.getElementById('p-nome').value, 
        qtd: document.getElementById('p-qtd').value, 
        pCompra: document.getElementById('p-compra').value, 
        pVenda: document.getElementById('p-venda').value 
    };
    await call("add_product", { productData: pData });
    alert("Produto salvo!");
    loadEstoque();
}

// --- PDV (VENDER) ---
async function loadPDV() {
    const container = document.getElementById('items');
    container.innerHTML = "Carregando...";
    const res = await call("get_products");
    if (res.status === "success") {
        prods = res.products || [];
        container.innerHTML = "";
        prods.forEach(p => {
            if (parseInt(p[2]) > 0) {
                container.innerHTML += `<div class="card" onclick="addCart('${p[0]}')" style="margin:5px; cursor:pointer; background:#222;">
                    <b>${p[1]}</b><br><small>Cód: ${p[0]} | Est: ${p[2]}</small><br><b>R$ ${parseFloat(p[4]).toFixed(2)}</b>
                </div>`;
            }
        });
    }
}

function addCart(cod) {
    const p = prods.find(x => String(x[0]) === String(cod));
    const itemExistente = cart.find(i => String(i.codigo) === String(cod));
    if (itemExistente) {
        itemExistente.qtd += 1;
        itemExistente.valorTotal = itemExistente.qtd * parseFloat(p[4]);
    } else {
        cart.push({ codigo: p[0], nome: p[1], qtd: 1, valorUnitario: parseFloat(p[4]), valorTotal: parseFloat(p[4]) });
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-list');
    list.innerHTML = "";
    let t = 0;
    cart.forEach((i, idx) => {
        t += i.valorTotal;
        list.innerHTML += `<div class="cart-item" style="color:#000; border-bottom:1px solid #ccc; padding:5px;">
            ${i.qtd}x ${i.nome} - R$ ${i.valorTotal.toFixed(2)} 
            <button onclick="cart.splice(${idx},1);renderCart()" style="width:auto; background:red; color:#fff;">X</button>
        </div>`;
    });
    document.getElementById('total').innerText = `R$ ${t.toFixed(2)}`;
}

function abrirPgto() {
    if (cart.length === 0) return alert("Carrinho vazio!");
    document.getElementById('m-pgto').style.display = 'block';
    atualizarInterfacePgto(document.getElementById('metodo').value);
}

function atualizarInterfacePgto(m) {
    document.getElementById('area-parcelas').style.display = (m === 'Cartão de Crédito') ? 'block' : 'none';
    document.getElementById('pix-area').style.display = (m === 'Pix') ? 'block' : 'none';
}

async function confirmarVenda() {
    const m = document.getElementById('metodo').value;
    const cpf = document.getElementById('cli-cpf').value;
    const tel = document.getElementById('cli-tel').value;

    if (m === 'Crediário' && (!cpf || !tel)) return alert("CPF e Telefone obrigatórios para Crediário!");

    const btn = document.querySelector("#m-pgto button");
    btn.innerText = "Salvando...";

    const sale = {
        codigoVenda: "V" + Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: user.nome,
        metodo: m,
        parcelas: document.getElementById('p-parcelas').value,
        cpf: cpf,
        telefone: tel,
        items: cart
    };

    const res = await call("save_sale", { saleData: sale });
    if (res.status === "success") {
        const conf = await call("get_config");
        gerarCupomTXT(sale, conf.config);
        alert("Sucesso!");
        cart = [];
        renderCart();
        document.getElementById('m-pgto').style.display = 'none';
        show('dashboard');
    }
    btn.innerText = "Confirmar e Gerar Cupom";
}

function gerarCupomTXT(venda, config) {
    let cupom = `LOJA: ${config.loja}\nDATA: ${venda.data} ${venda.hora}\nVENDEDOR: ${venda.vendedor}\n-----------\n`;
    venda.items.forEach(i => { cupom += `${i.nome} ${i.qtd}x R$ ${i.valorTotal.toFixed(2)}\n`; });
    cupom += `-----------\nTOTAL: R$ ${document.getElementById('total').innerText}\nPGTO: ${venda.metodo}\nOBRIGADO!`;
    const blob = new Blob([cupom], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Venda_${venda.codigoVenda}.txt`;
    link.click();
}

// --- DASHBOARD ---
async function loadDash() {
    const res = await call("get_dashboard");
    if (res.status !== "success") return;

    const agora = new Date();
    const hojeStr = agora.toLocaleDateString('pt-BR');
    const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
    const anoAtual = String(agora.getFullYear());

    let vHoje = 0, vMes = 0, vAno = 0, lucroBrutoMes = 0;
    let rankMes = {}, rankAno = {}, rankVend = {};
    const custos = {};

    res.estoque.forEach(e => custos[String(e[0])] = parseFloat(e[3]) || 0);

    res.vendas.forEach(v => {
        const valor = parseFloat(v[3]) || 0;
        const qtd = parseInt(v[2]) || 0;
        const cod = String(v[0]);
        const dataV = String(v[4]);
        const vend = v[6] || "Sistema";
        const partes = dataV.split('/');

        if (dataV === hojeStr) vHoje += valor;
        if (partes[1] === mesAtual && partes[2] === anoAtual) {
            vMes += valor;
            lucroBrutoMes += (valor - ((custos[cod] || 0) * qtd));
            rankMes[cod] = (rankMes[cod] || 0) + qtd;
            rankVend[vend] = (rankVend[vend] || 0) + valor;
        }
        if (partes[2] === anoAtual) {
            vAno += valor;
            rankAno[cod] = (rankAno[cod] || 0) + qtd;
        }
    });

    const c = res.config || {};
    const despesas = (parseFloat(c.agua)||0)+(parseFloat(c.luz)||0)+(parseFloat(c.aluguel)||0)+(parseFloat(c.internet)||0)+(parseFloat(c.func)||0)+(parseFloat(c.gerais)||0);

    document.getElementById('dash-hoje').innerText = `R$ ${vHoje.toFixed(2)}`;
    document.getElementById('dash-mes').innerText = `R$ ${vMes.toFixed(2)}`;
    document.getElementById('dash-ano').innerText = `R$ ${vAno.toFixed(2)}`;
    document.getElementById('dash-lucro').innerText = `R$ ${(lucroBrutoMes - despesas).toFixed(2)}`;
    
    const topV = Object.entries(rankVend).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('dash-vendedor').innerText = topV ? topV[0] : "-";

    renderRank('top-prod-mes', rankMes);
    renderRank('top-prod-ano', rankAno);
}

function renderRank(id, data) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(r => {
        el.innerHTML += `<li>Cód ${r[0]}: ${r[1]} un</li>`;
    });
}

// --- CONFIG & PONTO ---
async function loadConf() {
    const res = await call("get_config");
    if (res.status === "success" && res.config) {
        const c = res.config;
        document.getElementById('v-loja').innerText = c.loja;
        document.getElementById('v-end').innerText = c.rua + ", " + c.bairro;
        document.getElementById('c-loja').value = c.loja;
        document.getElementById('c-rua').value = c.rua;
        // ... preencha os outros inputs de despesas de forma similar
    }
}

async function saveConf() {
    const c = { 
        loja: document.getElementById('c-loja').value, 
        rua: document.getElementById('c-rua').value,
        bairro: document.getElementById('c-bairro').value,
        cidade: document.getElementById('c-cidade').value,
        agua: document.getElementById('c-agua').value,
        luz: document.getElementById('c-luz').value,
        aluguel: document.getElementById('c-aluguel').value,
        internet: document.getElementById('c-internet').value,
        func: document.getElementById('c-func').value,
        gerais: document.getElementById('c-gerais').value
    };
    await call("save_config", { configData: c });
    alert("Configurações salvas!");
    loadConf();
}

function toggleEditConfig(e) {
    document.getElementById('config-view').style.display = e ? 'none' : 'block';
    document.getElementById('config-edit').style.display = e ? 'block' : 'none';
}
