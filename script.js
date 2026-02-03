const API_URL = "https://script.google.com/macros/s/AKfycbyH4yeUzeYME_Fo1CWc3Yamf_-8T7tkMwXMswii-f6PV6tNCW6Wfk5yM37KvvWZz00RSw/exec"; 

// Configuração da Geolocalização da Loja (EXEMPLO - ALTERE PARA OS DADOS REAIS)
const LOJA_LAT = -5.637711; // Latitude de Ceará-Mirim (Exemplo)
const LOJA_LNG = -35.424138; // Longitude de Ceará-Mirim (Exemplo)
const RAIO_PERMITIDO_METROS = 100;

let currentUser = null;
let products = [];
let cart = [];

// === INICIALIZAÇÃO ===
document.addEventListener("DOMContentLoaded", () => {
    setInterval(() => {
        const now = new Date();
        const relogio = document.getElementById("ponto-relogio");
        if(relogio) relogio.innerText = now.toLocaleTimeString();
    }, 1000);
});

// === CADASTRO E LOGIN===
function toggleRegister() {
    const loginArea = document.getElementById('form-login-area');
    const regArea = document.getElementById('form-register-area');
    const msg = document.getElementById('login-msg');
    
    msg.innerText = ""; // Limpa mensagens anteriores

    if (loginArea.style.display === 'none') {
        loginArea.style.display = 'block';
        regArea.style.display = 'none';
    } else {
        loginArea.style.display = 'none';
        regArea.style.display = 'block';
    }
}

async function fazerLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.querySelector('button');
    const msg = document.getElementById('login-msg');

    btn.disabled = true;
    msg.innerText = "Verificando...";

    try {
        const res = await callApi({ action: "login", user: user, pass: pass });
        if (res.status === "success") {
            currentUser = res.userData;
            document.getElementById('display-user').innerText = currentUser.nome;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            carregarDadosIniciais();
        } else {
            msg.innerText = res.message;
        }
    } catch (e) {
        msg.innerText = "Erro de conexão.";
    }
    btn.disabled = false;
}

async function registrarNovoUsuario() {
    const nome = document.getElementById('reg-nome').value;
    const user = document.getElementById('reg-user').value;
    const pass = document.getElementById('reg-pass').value;
    const cpf = document.getElementById('reg-cpf').value;
    const tel = document.getElementById('reg-tel').value;
    const msg = document.getElementById('login-msg');

    if (!nome || !user || !pass || !cpf) {
        msg.innerText = "Preencha todos os campos obrigatórios.";
        msg.style.color = "orange";
        return;
    }

    msg.innerText = "Cadastrando...";
    msg.style.color = "white";

    const userData = {
        nome: nome,
        user: user,
        pass: pass,
        cpf: cpf,
        tel: tel
    };

    try {
        const res = await callApi({ action: "register_user", userData: userData });
        
        if (res.status === "success") {
            msg.innerText = "Cadastro realizado! Faça login.";
            msg.style.color = "lime";
            
            // Limpa os campos
            document.getElementById('reg-nome').value = "";
            document.getElementById('reg-user').value = "";
            document.getElementById('reg-pass').value = "";
            document.getElementById('reg-cpf').value = "";
            document.getElementById('reg-tel').value = "";

            // Volta para a tela de login após 2 segundos
            setTimeout(() => {
                toggleRegister();
                msg.innerText = "";
            }, 2000);
        } else {
            msg.innerText = res.message;
            msg.style.color = "red";
        }
    } catch (e) {
        msg.innerText = "Erro ao conectar.";
        msg.style.color = "red";
    }
}


function logout() {
    location.reload();
}

// === NAVEGAÇÃO ===


// === API HELPER ===
async function callApi(data) {
    const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return await response.json();
}

// === PDV / VENDAS ===
async function carregarDadosIniciais() {
    const res = await callApi({ action: "get_products" });
    if(res.status === "success") {
        products = res.products;
        renderCatalogo(products);
    }
}

function renderCatalogo(lista) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";
    lista.forEach(p => {
        const div = document.createElement('div');
        div.className = "product-item";
        div.innerHTML = `
            <div>
                <strong>${p.nome}</strong><br>
                <small>Ref: ${p.codigo}</small><br>
                <span>R$ ${p.preco_revenda}</span>
            </div>
            <button onclick="addToCart('${p.codigo}')" style="width:auto; padding:5px 10px;">+</button>
        `;
        container.appendChild(div);
    });
}

function filtrarProdutos() {
    const term = document.getElementById('search-product').value.toLowerCase();
    const filtered = products.filter(p => p.nome.toLowerCase().includes(term) || String(p.codigo).includes(term));
    renderCatalogo(filtered);
}

function addToCart(codigo) {
    const produto = products.find(p => p.codigo == codigo);
    const itemInCart = cart.find(i => i.codigo == codigo);

    if (itemInCart) {
        itemInCart.qtd++;
        itemInCart.valorTotal = itemInCart.qtd * itemInCart.precoUnitario;
    } else {
        cart.push({
            codigo: produto.codigo,
            nome: produto.nome,
            qtd: 1,
            precoUnitario: produto.preco_revenda,
            valorTotal: produto.preco_revenda
        });
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    list.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        total += item.valorTotal;
        const li = document.createElement('li');
        li.innerHTML = `${item.nome} x${item.qtd} - R$ ${item.valorTotal.toFixed(2)} <span onclick="cart.splice(${index},1);renderCart()" style="color:red;cursor:pointer;">(x)</span>`;
        list.appendChild(li);
    });

    totalEl.innerText = "R$ " + total.toFixed(2);
}

// === PAGAMENTO E PIX ===
function abrirPagamento() {
    if(cart.length === 0) return alert("Carrinho vazio!");
    const total = cart.reduce((acc, item) => acc + item.valorTotal, 0);
    document.getElementById('modal-total-value').innerText = "R$ " + total.toFixed(2);
    document.getElementById('modal-pagamento').style.display = 'block';
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

function checkMetodo() {
    const metodo = document.getElementById('pagamento-metodo').value;
    const credOptions = document.getElementById('credito-options');
    const pixArea = document.getElementById('pix-area');

    credOptions.style.display = (metodo === 'Crediário' || metodo === 'Cartão Crédito') ? 'block' : 'none';
    pixArea.style.display = 'none';

    if (metodo === 'Pix') {
        pixArea.style.display = 'block';
        gerarPix();
    }
}

function gerarPix() {
    const total = cart.reduce((acc, item) => acc + item.valorTotal, 0);
    const orderId = "PED" + Date.now().toString().slice(-6); // ID curto
    
    // Geração Simplificada do Payload Pix (Copia e Cola BR Code)
    // Nota: Para produção crítica, use uma lib robusta de CRC16.
    // Chave: 84991000682, Nome: Luciana Oliveira, Cidade: Ceara-Mirim
    const payload = generatePixPayload("84991000682", "Luciana Oliveira", "Ceara-Mirim", total.toFixed(2), orderId);
    
    const qr = new QRious({
        element: document.getElementById('qr-pix'),
        value: payload,
        size: 200
    });
}

async function confirmarVenda() {
    const metodo = document.getElementById('pagamento-metodo').value;
    const cpf = document.getElementById('cli-cpf').value;
    const tel = document.getElementById('cli-tel').value;

    if ((metodo === 'Crediário' || metodo === 'Pix') && !cpf) {
        return alert("CPF é obrigatório para este método.");
    }

    const saleData = {
        codigoVenda: "V" + Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR'),
        vendedor: currentUser.nome,
        metodo: metodo,
        cpf: cpf,
        telefone: tel,
        items: cart
    };

    if(confirm("Confirmar a venda?")) {
        const res = await callApi({ action: "save_sale", saleData: saleData });
        if(res.status === "success") {
            alert("Venda realizada com sucesso!");
            cart = [];
            renderCart();
            fecharModal('modal-pagamento');
            carregarDadosIniciais(); // Atualiza estoque
        } else {
            alert("Erro: " + res.message);
        }
    }
}

// === PONTO / GEOLOCALIZAÇÃO ===
function registrarPonto() {
    if (!navigator.geolocation) return alert("Geolocalização não suportada.");
    
    const senha = document.getElementById('ponto-senha').value;
    if(!senha) return alert("Digite sua senha para confirmar.");

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Calculo de distância simples
        const dist = getDistanceFromLatLonInKm(lat, lng, LOJA_LAT, LOJA_LNG) * 1000; // em metros

        if (dist > RAIO_PERMITIDO_METROS) {
            document.getElementById('ponto-msg').innerText = `Desculpe, você está a ${Math.round(dist)}m da loja. É necessário estar na empresa.`;
            document.getElementById('ponto-msg').style.color = "red";
            return;
        }

        const pointData = {
            usuario: currentUser.nome,
            passConfirm: senha,
            tipo: document.getElementById('ponto-tipo').value,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            lat: lat, 
            lng: lng
        };

        const res = await callApi({ action: "clock_in", pointData: pointData });
        document.getElementById('ponto-msg').innerText = res.message;
        document.getElementById('ponto-msg').style.color = res.status === "success" ? "lime" : "red";

    }, (err) => {
        alert("Erro ao obter localização. Permita o acesso ao GPS.");
    });
}

// Função auxiliar de distância (Haversine)
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; 
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
function deg2rad(deg) { return deg * (Math.PI/180); }

// === AUXILIAR PIX (Gerador de String EMV) ===
function generatePixPayload(key, name, city, amount, txid) {
    // Formatação básica do padrão EMV QRCPS
    const format = (id, value) => {
        const size = value.length.toString().padStart(2, "0");
        return `${id}${size}${value}`;
    };
    
    // 00-Format, 26-Merchant Acct (00-Gui, 01-Key), 52-Category, 53-Currency, 54-Amount, 58-Country, 59-Name, 60-City, 62-Add. Data (05-TxID), 63-CRC
    let payload = 
        format("00", "01") + 
        format("26", format("00", "br.gov.bcb.pix") + format("01", key)) +
        format("52", "0000") +
        format("53", "986") +
        format("54", amount) +
        format("58", "BR") +
        format("59", name) +
        format("60", city) +
        format("62", format("05", txid));
    
    payload += "6304"; // Adiciona ID do CRC

    // Calcular CRC16 CCITT-FALSE
    const crc = crc16(payload);
    return payload + crc;
}

function crc16(str) {
    let crc = 0xFFFF;
    for (let c = 0; c < str.length; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
            else crc = crc << 1;
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}
// === GESTÃO DE ESTOQUE ===

// Função para gerar código automático único
function gerarCodigoAuto() {
    const code = "PROD" + Date.now().toString().slice(-5) + Math.floor(Math.random() * 99);
    document.getElementById('prod-cod').value = code;
}

async function adicionarProduto() {
    const nome = document.getElementById('prod-nome').value;
    const cod = document.getElementById('prod-cod').value;
    const qtd = document.getElementById('prod-qtd').value;
    const pCompra = document.getElementById('prod-compra').value;
    const pVenda = document.getElementById('prod-venda').value;
    const desc = document.getElementById('prod-desc').value;

    if(!nome || !cod || !pVenda) return alert("Preencha pelo menos Nome, Código e Preço de Venda.");

    const productData = {
        nome: nome,
        codigo: cod,
        qtd: qtd || 0,
        pCompra: pCompra || 0,
        pVenda: pVenda,
        desc: desc
    };

    if(confirm("Cadastrar produto?")) {
        const res = await callApi({ action: "add_product", productData: productData });
        if(res.status === "success") {
            alert("Produto salvo!");
            // Limpar campos
            document.getElementById('prod-nome').value = "";
            document.getElementById('prod-cod').value = "";
            document.getElementById('prod-qtd').value = "";
            document.getElementById('prod-compra').value = "";
            document.getElementById('prod-venda').value = "";
            document.getElementById('prod-desc').value = "";
            
            // Recarregar lista
            carregarEstoqueVisual(); 
            carregarDadosIniciais(); // Recarrega para o PDV também
        } else {
            alert("Erro: " + res.message);
        }
    }
}

async function carregarEstoqueVisual() {
    const res = await callApi({ action: "get_products" });
    const tbody = document.getElementById('estoque-tabela-body');
    tbody.innerHTML = "";
    
    if(res.status === "success") {
        res.products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px; border-bottom:1px solid #444;">${p.codigo}</td>
                <td style="padding:10px; border-bottom:1px solid #444;">${p.nome}</td>
                <td style="padding:10px; border-bottom:1px solid #444; text-align:center;">${p.estoque}</td>
                <td style="padding:10px; border-bottom:1px solid #444; text-align:right;">R$ ${p.preco_revenda}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Atualize a função showScreen para carregar o estoque quando abrir a aba
const oldShowScreen = showScreen; // Guardar referencia se quiser
showScreen = function(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById('screen-' + screenId).style.display = 'block';
    
    if(screenId === 'dashboard') carregarDashboard();
    if(screenId === 'estoque') carregarEstoqueVisual();
    if(screenId === 'config') carregarConfiguracoes();
}

// === MINHA LOJA / CONFIGURAÇÕES ===

async function carregarConfiguracoes() {
    const res = await callApi({ action: "get_config" });
    if(res.status === "success" && res.config) {
        const c = res.config;
        document.getElementById('conf-loja').value = c.loja;
        document.getElementById('conf-rua').value = c.rua;
        document.getElementById('conf-cidade').value = c.cidade;
        document.getElementById('conf-bairro').value = c.bairro;
        document.getElementById('conf-numero').value = c.numero;
        document.getElementById('conf-cep').value = c.cep;
        
        document.getElementById('conf-agua').value = c.agua;
        document.getElementById('conf-luz').value = c.luz;
        document.getElementById('conf-internet').value = c.internet;
        document.getElementById('conf-aluguel').value = c.aluguel;
        document.getElementById('conf-embalagens').value = c.embalagens;
        document.getElementById('conf-func').value = c.func;
        document.getElementById('conf-gerais').value = c.gerais;
    }
}

async function salvarConfiguracoes() {
    const configData = {
        loja: document.getElementById('conf-loja').value,
        rua: document.getElementById('conf-rua').value,
        cidade: document.getElementById('conf-cidade').value,
        bairro: document.getElementById('conf-bairro').value,
        numero: document.getElementById('conf-numero').value,
        cep: document.getElementById('conf-cep').value,
        
        agua: document.getElementById('conf-agua').value,
        luz: document.getElementById('conf-luz').value,
        internet: document.getElementById('conf-internet').value,
        aluguel: document.getElementById('conf-aluguel').value,
        embalagens: document.getElementById('conf-embalagens').value,
        func: document.getElementById('conf-func').value,
        gerais: document.getElementById('conf-gerais').value
    };

    const msg = document.getElementById('conf-msg');
    msg.innerText = "Salvando...";
    
    const res = await callApi({ action: "save_config", configData: configData });
    if(res.status === "success") {
        msg.innerText = "Dados atualizados com sucesso!";
        msg.style.color = "lime";
    } else {
        msg.innerText = "Erro ao salvar.";
        msg.style.color = "red";
    }
}
