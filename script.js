const URL = "https://script.google.com/macros/s/AKfycby8E3XNk7nS6GPar-u-kyqL4_33xeBFRGCfsEX11FgqDbwkmi8A3EK57HALJ568eoCjsw/exec";
let user = null;
let prods = [];
let cart = [];

async function call(action, data = {}) {
    const res = await fetch(URL, { method: "POST", body: JSON.stringify({ action, ...data }) });
    return res.json();
}

// LOGIN & NAVEGAÇÃO
function toggleLogin(reg) {
    document.getElementById('form-login').style.display = reg ? 'none' : 'block';
    document.getElementById('form-reg').style.display = reg ? 'block' : 'none';
}

async function fazerLogin() {
    const res = await call("login", { user: document.getElementById('l-user').value, pass: document.getElementById('l-pass').value });
    if (res.status === "success") {
        user = res.userData;
        document.getElementById('u-nome').innerText = user.nome;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        show('dashboard');
    } else alert(res.message);
}

function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById('s-' + id).style.display = 'block';
    if (id === 'estoque') loadEstoque();
    if (id === 'vender') loadPDV();
    if (id === 'dashboard') loadDash();
    if (id === 'config') loadConf();
}

// ESTOQUE
async function loadEstoque() {
    const res = await call("get_products");
    const tb = document.querySelector("#tbl-est tbody");
    tb.innerHTML = "";
    prods = res.products;
    prods.forEach(p => {
        tb.innerHTML += `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td>R$ ${p[4]}</td></tr>`;
    });
}

async function addProd() {
    const p = { codigo: document.getElementById('p-cod').value, nome: document.getElementById('p-nome').value, qtd: document.getElementById('p-qtd').value, pCompra: document.getElementById('p-compra').value, pVenda: document.getElementById('p-venda').value, desc: "" };
    await call("add_product", { productData: p });
    loadEstoque();
}

// PDV
function loadPDV() {
    const container = document.getElementById('items');
    container.innerHTML = "";
    prods.forEach(p => {
        container.innerHTML += `<div class="card" onclick="addCart('${p[0]}')" style="margin:5px; cursor:pointer"><b>${p[1]}</b><br>R$ ${p[4]}</div>`;
    });
}

function addCart(cod) {
    const p = prods.find(x => x[0] == cod);
    cart.push({ codigo: p[0], nome: p[1], qtd: 1, valorTotal: p[4] });
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-list');
    list.innerHTML = "";
    let t = 0;
    cart.forEach((i, idx) => {
        t += i.valorTotal;
        list.innerHTML += `<p>${i.nome} - R$ ${i.valorTotal} <button onclick="cart.splice(${idx},1);renderCart()" style="width:auto;padding:2px">x</button></p>`;
    });
    document.getElementById('total').innerText = `R$ ${t.toFixed(2)}`;
}

function abrirPgto() { document.getElementById('m-pgto').style.display = 'block'; }

function checkPix(v) {
    const area = document.getElementById('pix-area');
    area.style.display = v === 'Pix' ? 'block' : 'none';
    if(v === 'Pix') {
        new QRious({ element: document.getElementById('qr'), value: "00020126360014br.gov.bcb.pix0111849910006825204000053039865404" + document.getElementById('total').innerText.replace('R$ ','') + "5802BR5916Luciana Oliveira6012Ceara-Mirim62070503PDV6304", size: 150 });
    }
}

async function confirmarVenda() {
    const sale = {
        codigoVenda: "V" + Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: user.nome,
        metodo: document.getElementById('metodo').value,
        cpf: document.getElementById('cli-cpf').value,
        items: cart
    };
    await call("save_sale", { saleData: sale });
    alert("Venda Salva!");
    cart = [];
    renderCart();
    document.getElementById('m-pgto').style.display = 'none';
    show('dashboard');
}

// DASHBOARD
async function loadDash() {
    const res = await call("get_dashboard");
    const hoje = new Date().toLocaleDateString('pt-BR');
    let vHoje = 0, lMes = 0;
    let rank = {};

    const custos = {};
    res.estoque.forEach(e => custos[e[0]] = e[3]);

    res.vendas.forEach(v => {
        if(v[4] === hoje) vHoje += v[3];
        lMes += (v[3] - (custos[v[0]] * v[2]));
        rank[v[0]] = (rank[v[0]] || 0) + v[2];
    });

    document.getElementById('dash-hoje').innerText = `R$ ${vHoje.toFixed(2)}`;
    document.getElementById('dash-lucro').innerText = `R$ ${lMes.toFixed(2)}`;
    
    const list = document.getElementById('top-prod');
    list.innerHTML = "";
    Object.entries(rank).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(r => {
        list.innerHTML += `<li>Cód ${r[0]}: ${r[1]} unidades</li>`;
    });
}

// PONTO
setInterval(() => document.getElementById('relogio').innerText = new Date().toLocaleTimeString(), 1000);

function baterPonto() {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const d = getDist(pos.coords.latitude, pos.coords.longitude, -5.637772, -35.424153); // Ajuste Lat/Lng da Loja
        if(d > 0.2) return alert("Você não está na empresa!");
        
        await call("clock_in", { pointData: { usuario: user.nome, tipo: document.getElementById('pt-tipo').value, hora: new Date().toLocaleTimeString(), data: new Date().toLocaleDateString('pt-BR') }});
        alert("Ponto Registrado!");
    });
}

function getDist(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLa = (la2-la1)*Math.PI/180;
    const dLo = (lo2-lo1)*Math.PI/180;
    const a = Math.sin(dLa/2)**2 + Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
