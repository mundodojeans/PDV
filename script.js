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
    document.getElementById('msg').innerText = ""; // Limpa avisos
}
async function fazerLogin() {
    const btn = document.querySelector("#form-login button");
    const originalText = btn.innerText;
    
    btn.innerText = "Verificando...";
    btn.classList.add("loading");

    try {
        const res = await call("login", { 
            user: document.getElementById('l-user').value, 
            pass: document.getElementById('l-pass').value 
        });

        if (res.status === "success") {
            user = res.userData;
            document.getElementById('u-nome').innerText = user.nome;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            show('dashboard');
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert("Erro na conexão com o servidor.");
    } finally {
        btn.innerText = originalText;
        btn.classList.remove("loading");
    }
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
async function loadPDV() {
    const container = document.getElementById('items');
    container.innerHTML = "Carregando produtos...";
    
    const res = await call("get_products");
    if (res.status === "success") {
        prods = res.products;
        container.innerHTML = "";
        prods.forEach(p => {
            if(parseInt(p[2]) > 0) { // Só mostra se tiver estoque
                container.innerHTML += `
                <div class="card" onclick="addCart('${p[0]}')" style="margin:5px; cursor:pointer; background:#222; border:1px solid #444">
                    <b style="color:var(--gold)">${p[1]}</b><br>
                    <small>Cód: ${p[0]} | Est: ${p[2]}</small><br>
                    <b>R$ ${parseFloat(p[4]).toFixed(2)}</b>
                </div>`;
            }
        });
    }
}
function addCart(cod) {
    const p = prods.find(x => String(x[0]) === String(cod));
    if (!p) return;

    // Verifica se o item já está no carrinho
    const itemExistente = cart.find(item => String(item.codigo) === String(cod));

    if (itemExistente) {
        // Se já existe, apenas aumenta a quantidade e atualiza o valor total
        itemExistente.qtd += 1;
        itemExistente.valorTotal = itemExistente.qtd * parseFloat(p[4]);
    } else {
        // Se é novo, adiciona o objeto completo
        cart.push({
            codigo: p[0],
            nome: p[1],
            qtd: 1,
            valorUnitario: parseFloat(p[4]),
            valorTotal: parseFloat(p[4])
        });
    }
    renderCart();
}
function renderCart() {
    const list = document.getElementById('cart-list');
    list.innerHTML = "";
    let t = 0;
    
    cart.forEach((i, idx) => {
        t += i.valorTotal;
        list.innerHTML += `
            <div class="cart-item">
                <div>
                    <b>${i.nome}</b><br>
                    <small>${i.qtd}x R$ ${i.valorUnitario.toFixed(2)}</small>
                </div>
                <div>
                    <b>R$ ${i.valorTotal.toFixed(2)}</b>
                    <button onclick="cart.splice(${idx},1);renderCart()" style="width:auto; background:none; border:none; color:red; margin-left:10px">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
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
    const metodo = document.getElementById('metodo').value;
    const cpf = document.getElementById('cli-cpf').value;
    const tel = document.getElementById('cli-tel').value;

    if (metodo === 'Crediário' && (!cpf || !tel)) {
        return alert("Para Crediário, CPF e Telefone são obrigatórios!");
    }

    if (cart.length === 0) return alert("Carrinho vazio!");

    const btn = document.querySelector("#m-pgto button");
    btn.innerText = "Salvando Venda...";
    btn.classList.add("loading");

    const sale = {
        codigoVenda: "V" + Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: user.nome,
        metodo: metodo,
        parcelas: document.getElementById('p-parcelas').value,
        telefone: tel,
        cpf: cpf,
        items: cart
    };

    try {
        // AQUI ESTAVA O ERRO: Esta função PRECISA ser async para usar o await abaixo
        const res = await call("save_sale", { saleData: sale });
        const resConfig = await call("get_config"); 
        
        if (res.status === "success") {
            gerarCupomTXT(sale, resConfig.config);
            alert("Venda Finalizada e Cupom Gerado!");
            cart = [];
            renderCart();
            document.getElementById('m-pgto').style.display = 'none';
            show('dashboard');
        }
    } catch (e) {
        alert("Erro ao salvar venda. Verifique a conexão.");
    } finally {
        btn.innerText = "Confirmar e Gerar Cupom";
        btn.classList.remove("loading");
    }
}
// DASHBOARD
async function loadDash() {
    const res = await call("get_dashboard");
    if (res.status !== "success") return;

    const agora = new Date();
    // Força a data de hoje no formato DD/MM/AAAA para bater com a planilha
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hojeStr = `${dia}/${mes}/${ano}`;

    let vHoje = 0, vMes = 0, vAno = 0, lucroMesTotal = 0;
    let rankMes = {}, rankAno = {}, rankVendedores = {};

    const custos = {};
    res.estoque.forEach(e => custos[String(e[0])] = parseFloat(e[3]) || 0);

    res.vendas.forEach(v => {
        const codProd = String(v[0]);
        const qtd = parseInt(v[2]) || 0;
        const valorVenda = parseFloat(v[3]) || 0;
        const dataV = String(v[4]); // "DD/MM/AAAA"
        const vendedor = v[6] || "Sistema";

        // Divide a data para comparar mês e ano
        const partes = dataV.split('/');
        const vDia = partes[0];
        const vMes = partes[1];
        const vAno = partes[2];

        // 1. Vendas Hoje
        if (dataV === hojeStr) {
            vHoje += valorVenda;
        }

        // 2. Vendas Mês Atual
        if (vMes == mes && vAno == ano) {
            vMes += valorVenda;
            const custoTotal = (custos[codProd] || 0) * qtd;
            lucroMesTotal += (valorVenda - custoTotal);
            rankMes[codProd] = (rankMes[codProd] || 0) + qtd;
            rankVendedores[vendedor] = (rankVendedores[vendedor] || 0) + valorVenda;
        }

        // 3. Vendas Ano Atual
        if (vAno == ano) {
            vAno += valorVenda;
            rankAno[codProd] = (rankAno[codProd] || 0) + qtd;
        }
    });

    // Despesas fixas (vem da aba config.)
    const c = res.config || {};
    const despesas = (parseFloat(c.agua)||0)+(parseFloat(c.luz)||0)+(parseFloat(c.aluguel)||0)+(parseFloat(c.internet)||0)+(parseFloat(c.func)||0)+(parseFloat(c.gerais)||0);
    
    // Atualiza a tela
    document.getElementById('dash-hoje').innerText = `R$ ${vHoje.toFixed(2)}`;
    document.getElementById('dash-mes').innerText = `R$ ${vMes.toFixed(2)}`;
    document.getElementById('dash-ano').innerText = `R$ ${vAno.toFixed(2)}`;
    document.getElementById('dash-lucro').innerText = `R$ ${(lucroMesTotal - despesas).toFixed(2)}`;
    
    // Top Vendedor
    const topV = Object.entries(rankVendedores).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('dash-vendedor').innerText = topV ? topV[0] : "-";

    renderRank('top-prod-mes', rankMes);
    renderRank('top-prod-ano', rankAno);
}

// Garanta que a função abrirPgto existe para o botão funcionar
function abrirPgto() {
    if (cart.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }
    document.getElementById('m-pgto').style.display = 'block';
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
function toggleEditConfig(edit) {
    document.getElementById('config-view').style.display = edit ? 'none' : 'block';
    document.getElementById('config-edit').style.display = edit ? 'block' : 'none';
}

async function loadConf() {
    const res = await call("get_config");
    if (res.status === "success" && res.config) {
        const c = res.config;
        // Preenche View
        document.getElementById('v-loja').innerText = c.loja;
        document.getElementById('v-end').innerText = `${c.rua}, ${c.bairro} - ${c.cidade}`;
        const totalGastos = (parseFloat(c.agua)||0)+(parseFloat(c.luz)||0)+(parseFloat(c.aluguel)||0)+(parseFloat(c.internet)||0)+(parseFloat(c.func)||0)+(parseFloat(c.gerais)||0);
        document.getElementById('v-gastos').innerText = totalGastos.toFixed(2);

        // Preenche Inputs para edição
        document.getElementById('c-loja').value = c.loja;
        document.getElementById('c-rua').value = c.rua;
        document.getElementById('c-bairro').value = c.bairro;
        document.getElementById('c-cidade').value = c.cidade;
        document.getElementById('c-agua').value = c.agua;
        document.getElementById('c-luz').value = c.luz;
        document.getElementById('c-aluguel').value = c.aluguel;
        document.getElementById('c-internet').value = c.internet;
        document.getElementById('c-func').value = c.func;
        document.getElementById('c-gerais').value = c.gerais;
    }
}

async function saveConf() {
    const configData = {
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
    await call("save_config", { configData });
    alert("Configurações salvas!");
    toggleEditConfig(false);
    loadConf();
}
function renderRank(id, data) {
    const el = document.getElementById(id);
    el.innerHTML = "";
    Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(r => {
        el.innerHTML += `<li>Cód ${r[0]}: ${r[1]} un</li>`;
    });
}
function gerarCupomTXT(venda, config) {
    let cupom = `
=========================================
        ${config.loja.toUpperCase()}
=========================================
Endereço: ${config.rua}, ${config.bairro}
Cidade: ${config.cidade}
Data: ${venda.data}   Hora: ${venda.hora}
Vendedor: ${venda.vendedor}
-----------------------------------------
ITEM         QTD    UNID       TOTAL
`;

    venda.items.forEach(item => {
        let nomeLimitado = item.nome.substring(0, 12).padEnd(12, ' ');
        cupom += `${nomeLimitado} ${item.qtd.toString().padEnd(6, ' ')} R$ ${item.valorUnitario.toFixed(2).padEnd(8, ' ')} R$ ${item.valorTotal.toFixed(2)}\n`;
    });

    cupom += `-----------------------------------------
TOTAL A PAGAR:          R$ ${document.getElementById('total').innerText}
FORMA DE PGTO:          ${venda.metodo} ${venda.parcelas > 1 ? '('+venda.parcelas+'x)' : ''}
-----------------------------------------
Cliente: ${venda.cpf || 'Nao informado'}
Tel: ${venda.telefone || 'Nao informado'}
=========================================
      OBRIGADO PELA PREFERENCIA!
=========================================`;

    const blob = new Blob([cupom], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Cupom_${venda.codigoVenda}.txt`;
    link.click();
}
function atualizarInterfacePgto(metodo) {
    document.getElementById('area-parcelas').style.display = (metodo === 'Cartão de Crédito') ? 'block' : 'none';
    document.getElementById('pix-area').style.display = (metodo === 'Pix') ? 'block' : 'none';
    
    // Torna obrigatório no visual se for crediário
    const inputs = document.querySelectorAll('#area-cliente input');
    if (metodo === 'Crediário') {
        inputs.forEach(i => i.style.border = "2px solid #D4AF37");
    } else {
        inputs.forEach(i => i.style.border = "1px solid #444");
    }
}
