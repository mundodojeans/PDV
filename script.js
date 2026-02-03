const API_URL = "https://script.google.com/macros/s/AKfycbwC7iGfE8cSJjNeR17m1EeRESNl11FWjTu4aq4chtSbmXtmqoUgy9q6ROIuD-6Ko4_0Gg/exec"; 

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

// === LOGIN ===
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

function logout() {
    location.reload();
}

// === NAVEGAÇÃO ===
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById('screen-' + screenId).style.display = 'block';
    if(screenId === 'dashboard') carregarDashboard();
}

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
