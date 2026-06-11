const TOTAL_FIGURINHAS = 150;
const FIGURINHAS_POR_PAGINA = 9;
let paginaAtual = 1;
let database = [];
const extensoesSuportadas = ['.avif', '.webp', '.jpg', '.jpeg', '.png'];

let bloqueioAtivo = false;
let raspadinhaAtivaId = null;

function dispararNotificacaoApp(texto, tipoPremium = false) {
    const toast = document.createElement('div');
    toast.className = tipoPremium ? 'toast-premium-app' : 'toast-fragmento';
    toast.innerHTML = texto;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), tipoPremium ? 4000 : 2000);
}

function descobrirEfitarImagem(imgElement, idDoCard, estiloBackgroundElement = null) {
    let indiceExtensao = 0;
    function tentarProximaExtensao() {
        if (indiceExtensao >= extensoesSuportadas.length) return;
        const caminhoTeste = `img/${idDoCard}${extensoesSuportadas[indiceExtensao]}`;
        const imagemTeste = new Image();
        imagemTeste.onload = function () {
            if (imgElement) imgElement.src = caminhoTeste;
            if (estiloBackgroundElement) estiloBackgroundElement.style.backgroundImage = `url('${caminhoTeste}')`;
        };
        imagemTeste.onerror = function () {
            indiceExtensao++;
            tentarProximaExtensao();
        };
        imagemTeste.src = caminhoTeste;
    }
    tentarProximaExtensao();
}

function inicializarBancoDados() {
    for (let i = 1; i <= TOTAL_FIGURINHAS; i++) {
        let raridade = "comum";
        if (i <= 70) raridade = "comum";
        else if (i <= 115) raridade = "incomum";
        else if (i <= 140) raridade = "raro";
        else raridade = "lendario";

        database.push({ id: i, raridade: raridade });
    }
}

let progresso = JSON.parse(localStorage.getItem('bts_album_fragments_v11')) || {
    coladas: [],
    inventario: [],
    fragmentos: 0,
    proximoPacote: 0
};

function alternarAba(nomeAba) {
    document.querySelectorAll('.secao-aba').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('active'));

    if (nomeAba === 'banca') {
        document.getElementById('secao-banca').classList.add('active');
        document.getElementById('tab-banca').classList.add('active');
        document.getElementById('carteira-loja').style.display = 'inline-flex';
    } else {
        document.getElementById('secao-album').classList.add('active');
        document.getElementById('tab-album').classList.add('active');
        document.getElementById('carteira-loja').style.display = 'none';
        renderizarPagina();
    }
}

function atualizarPainelFragmentos() {
    const agora = new Date().getTime();
    const diarioDisponivel = (agora >= progresso.proximoPacote);

    document.getElementById('carteira-loja').innerText = `💎 ${progresso.fragmentos} ${progresso.fragmentos === 1 ? 'Fragmento' : 'Fragmentos'}`;

    const btnRoleta = document.getElementById('btn-rodar-roleta');
    if (diarioDisponivel) {
        btnRoleta.disabled = true;
        btnRoleta.title = "Abra o pacote diário primeiro!";
    } else {
        // Preço 5 fragmentos
        btnRoleta.disabled = progresso.fragmentos < 5 || bloqueioAtivo;
    }

    const btnRaspadinha = document.getElementById('btn-comprar-raspadinha');
    // Preço 10 fragmentos
    if (progresso.fragmentos >= 10 && progresso.coladas.length < TOTAL_FIGURINHAS && !bloqueioAtivo) {
        btnRaspadinha.disabled = false;
    } else {
        btnRaspadinha.disabled = true;
    }
}

function rodarRoletaSorte() {
    if (progresso.fragmentos < 5 || bloqueioAtivo) return;

    bloqueioAtivo = true;
    progresso.fragmentos -= 5;
    salvarDados();

    const disco = document.getElementById('disco-roleta');
    const voltasExtras = Math.floor(Math.random() * 4) + 4;
    const grauSorteado = Math.floor(Math.random() * 360);
    const anguloTotal = (voltasExtras * 360) + grauSorteado;

    disco.style.transform = `rotate(${anguloTotal}deg)`;

    setTimeout(() => {
        const anguloFinalVerdadeiro = grauSorteado % 360;
        let premio = "pack";

        if (anguloFinalVerdadeiro >= 0 && anguloFinalVerdadeiro < 90) premio = "lendario";
        else if (anguloFinalVerdadeiro >= 90 && anguloFinalVerdadeiro < 180) premio = "raro";
        else if (anguloFinalVerdadeiro >= 180 && anguloFinalVerdadeiro < 270) premio = "reembolso";
        else premio = "pack";

        if (premio === "pack") {
            let s1 = sortearFigurinhaGeral(), s2 = sortearFigurinhaGeral(), s3 = sortearFigurinhaGeral();
            adicionarAoInventarioFluxo([s1, s2, s3]);
            dispararNotificacaoApp("🛍️ <b>Prêmio da Roleta!</b><br>Você ganhou um Pack Extra de 3 Cards!");
        } else if (premio === "reembolso") {
            progresso.fragmentos += 2;
            dispararNotificacaoApp("💎 <b>Quase!</b><br>A roleta devolveu 2 fragmentos de reembolso.");
        } else if (premio === "raro") {
            let cardRaro = sortearPorRaridadeEstrita("raro");
            adicionarAoInventarioFluxo([cardRaro]);
            dispararNotificacaoApp("✨ <b>Uau!</b><br>A roleta parou no setor de Card Raro Garantido!");
        } else if (premio === "lendario") {
            let cardLendario = sortearPorRaridadeEstrita("lendario");
            adicionarAoInventarioFluxo([cardLendario]);
            dispararNotificacaoApp("👑 <b>INCRÍVEL!</b><br>Giro de Sorte! Ganhou um Card Lendário Garantido!");
        }

        disco.style.transition = 'none';
        disco.style.transform = `rotate(${anguloFinalVerdadeiro}deg)`;
        disco.offsetHeight;
        disco.style.transition = 'transform 3.5s cubic-bezier(0.25, 1, 0.2, 1)';

        bloqueioAtivo = false;
        salvarDados();
        renderizarInventario();
    }, 3600);
}

function gerarNovaRaspadinha() {
    if (progresso.fragmentos < 10 || bloqueioAtivo) return;

    let listaFaltantes = [];
    for (let i = 1; i <= TOTAL_FIGURINHAS; i++) {
        if (!progresso.coladas.includes(i) && !progresso.inventario.includes(i)) {
            listaFaltantes.push(i);
        }
    }

    if (listaFaltantes.length === 0) {
        dispararNotificacaoApp("⚠️ Você já coletou todos os cards restantes!");
        return;
    }

    bloqueioAtivo = true;
    progresso.fragmentos -= 10;

    raspadinhaAtivaId = listaFaltantes[Math.floor(Math.random() * listaFaltantes.length)];
    salvarDados();

    document.getElementById('raspadinha-placeholder').style.display = 'none';
    const widget = document.getElementById('raspadinha-game');
    widget.style.display = 'block';

    const imgFundo = document.getElementById('raspadinha-imagem-fundo');
    imgFundo.style.display = 'block';
    descobrirEfitarImagem(null, raspadinhaAtivaId, imgFundo);

    const canvas = document.getElementById('raspadinha-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 200;
    canvas.height = 266;

    ctx.fillStyle = '#777788';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#555566';
    for (let i = 0; i < canvas.width; i += 6) {
        for (let j = 0; j < canvas.height; j += 6) {
            if (Math.random() > 0.7) ctx.fillRect(i, j, 3, 3);
        }
    }

    let pintando = false;
    const totalPixels = canvas.width * canvas.height;

    function rasparTraço(x, y) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
        verificarProgressoRaspagem();
    }

    function verificarProgressoRaspagem() {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let apagados = 0;
        for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] === 0) apagados++;
        }

        if (apagados / totalPixels > 0.65 && raspadinhaAtivaId !== null) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            finalizarRaspadinhaEEnviarInventario();
        }
    }

    function finalizarRaspadinhaEEnviarInventario() {
        const idGanho = raspadinhaAtivaId;
        raspadinhaAtivaId = null;

        progresso.inventario.push(idGanho);
        salvarDados();
        renderizarInventario();

        dispararNotificacaoApp(`🔮 <b>Raspadinha Concluída!</b><br>O Photocard #${idGanho} foi enviado para colagem.`);

        setTimeout(() => {
            widget.style.display = 'none';
            document.getElementById('raspadinha-placeholder').style.display = 'flex';
            bloqueioAtivo = false;
            atualizarPainelFragmentos();
            document.getElementById('bloco-inventario-separado').scrollIntoView({ behavior: 'smooth' });
        }, 1000);
    }

    canvas.onmousedown = (e) => { pintando = true; rasparTraço(e.offsetX, e.offsetY); };
    canvas.onmousemove = (e) => { if (pintando) rasparTraço(e.offsetX, e.offsetY); };
    window.addEventListener('mouseup', () => pintando = false);

    canvas.addEventListener('touchstart', (e) => {
        pintando = true;
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        rasparTraço(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (!pintando) return;
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        rasparTraço(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: true });
}

function sortearFigurinhaGeral() {
    const rand = Math.random() * 100;
    let raridade = "comum";
    if (rand < 1) raridade = "lendario"; // Lendaria 1% 
    else if (rand < 11) raridade = "raro"; // Rara 10%
    else if (rand < 45) raridade = "incomum";
    const opcionais = database.filter(f => f.raridade === raridade);
    return opcionais[Math.floor(Math.random() * opcionais.length)].id;
}

function sortearPorRaridadeEstrita(raridadeAlvo) {
    const opcionais = database.filter(f => f.raridade === raridadeAlvo);
    return opcionais[Math.floor(Math.random() * opcionais.length)].id;
}

function adicionarAoInventarioFluxo(listaIds) {
    listaIds.forEach(id => {
        if (progresso.coladas.includes(id) || progresso.inventario.includes(id)) {
            progresso.fragmentos++;
        } else {
            progresso.inventario.push(id);
        }
    });
}

function salvarDados() {
    localStorage.setItem('bts_album_fragments_v11', JSON.stringify(progresso));
    document.getElementById('progresso-total').innerText = `Photocards Colados: ${progresso.coladas.length} / ${TOTAL_FIGURINHAS} 💜`;
    atualizarPainelFragmentos();
}

function entrarNoAlbum() {
    document.getElementById('capa-album').style.display = 'none';
    document.getElementById('conteudo-principal').style.display = 'flex';
    renderizarPagina();
    atualizarVisualBooster();
}

function renderizarPagina() {
    const grid = document.getElementById('album-grid');
    grid.innerHTML = '';
    const inicio = (paginaAtual - 1) * FIGURINHAS_POR_PAGINA;
    const fim = Math.min(inicio + FIGURINHAS_POR_PAGINA, TOTAL_FIGURINHAS);
    const totalPaginas = Math.ceil(TOTAL_FIGURINHAS / FIGURINHAS_POR_PAGINA);

    for (let i = inicio; i < fim; i++) {
        const fig = database[i];
        const jaColada = progresso.coladas.includes(fig.id);
        const vaga = document.createElement('div');
        vaga.id = `vaga-album-${fig.id}`;
        vaga.className = `vaga-figurinha ${jaColada ? 'colada' : ''} raridade-${fig.raridade}`;
        vaga.onclick = () => expandirFigurinha(fig.id);

        vaga.innerHTML = `
                    <span class="badge-raridade" style="background-color: var(--${fig.raridade}); color: ${fig.raridade === 'comum' ? '#222' : '#fff'}">${fig.raridade}</span>
                    <div class="slot-foto">
                        ${jaColada ? `<div class="badge-numero">#${fig.id}</div>` : ''}
                        <span>#${fig.id}</span>
                        <img class="img-figurinha" id="img-card-${fig.id}" alt="Card ${fig.id}">
                    </div>
                `;
        grid.appendChild(vaga);

        if (jaColada) {
            const imgElement = document.getElementById(`img-card-${fig.id}`);
            imgElement.className = "img-figurinha fade-smooth";
            descobrirEfitarImagem(imgElement, fig.id);
        }
    }
    document.getElementById('indicador-pagina').innerText = `Página ${paginaAtual} de ${totalPaginas}`;
    document.getElementById('btn-ant').disabled = paginaAtual === 1;
    document.getElementById('btn-prox').disabled = paginaAtual === totalPaginas;
}

function mudarPagina(direcao) {
    paginaAtual += direcao;
    renderizarPagina();
}

function expandirFigurinha(id) {
    if (!progresso.coladas.includes(id)) return;
    executarAberturaModalComGarantia(id);
}

function expandirFigurinhaLojinha(id) {
    executarAberturaModalComGarantia(id);
}

function executarAberturaModalComGarantia(id) {
    const modalImg = document.getElementById('modal-img');
    document.getElementById('modal-badge-id').innerText = `#${id}`;
    descobrirEfitarImagem(modalImg, id);
    document.getElementById('modal-zoom').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal-zoom').style.display = 'none';
}

function engatilharAbertura() {
    const agora = new Date().getTime();
    if (agora < progresso.proximoPacote || bloqueioAtivo) return;

    bloqueioAtivo = true;

    const pack = document.getElementById('pack-virtual');
    const btn = document.getElementById('btn-abrir');
    const area = document.getElementById('booster-area-container');

    btn.disabled = true;
    pack.className = "booster-pack shake";

    setTimeout(() => {
        pack.className = "booster-pack burst";
        setTimeout(() => {
            pack.style.display = "none";
            area.classList.add('hidden');
            abrirPacoteLogica();
        }, 580);
    }, 850);
}

function abrirPacoteLogica() {
    const agora = new Date().getTime();
    let sorteadas = [sortearFigurinhaGeral(), sortearFigurinhaGeral(), sortearFigurinhaGeral()];
    let teveRepetida = false;

    sorteadas.forEach(id => {
        if (progresso.coladas.includes(id)) {
            progresso.fragmentos++;
            teveRepetida = true;
        } else {
            if (!progresso.inventario.includes(id)) {
                progresso.inventario.push(id);
            } else {
                progresso.fragmentos++;
                teveRepetida = true;
            }
        }
    });

    if (teveRepetida) dispararNotificacaoApp("✨ +1 Fragmento por Card Repetido!");

    progresso.proximoPacote = agora + (24 * 60 * 60 * 1000);
    bloqueioAtivo = false;
    salvarDados();
    renderizarInventario();

    setTimeout(() => {
        const blocoInventario = document.getElementById('bloco-inventario-separado');
        if (blocoInventario) {
            blocoInventario.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
}

function renderizarInventario() {
    const container = document.getElementById('pack-opening');
    const blocoInventario = document.getElementById('bloco-inventario-separado');

    if (progresso.inventario.length === 0) {
        blocoInventario.classList.remove('active');
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';
    blocoInventario.classList.add('active');

    progresso.inventario.forEach((id, index) => {
        const fig = database.find(f => f.id === id);
        const item = document.createElement('div');

        let classeAnimacao = 'spawn-comum';
        if (fig.raridade === 'raro') classeAnimacao = 'spawn-rara';
        if (fig.raridade === 'lendario') classeAnimacao = 'spawn-lendaria';

        item.className = `sticker-item ${classeAnimacao}`;
        item.id = `inv-item-${id}`;
        item.style.borderColor = `var(--${fig.raridade})`;
        item.style.animationDelay = `${index * 0.15}s`;

        item.innerHTML = `<div class="badge-numero">#${id}</div>`;

        let pressTimer = null;
        let startX = 0;
        let startY = 0;
        let isScrolling = false;

        const iniciarToque = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            isScrolling = false;

            pressTimer = setTimeout(() => {
                if (!isScrolling) {
                    expandirFigurinhaLojinha(id);
                    pressTimer = null;
                }
            }, 500);
        };

        const moverToque = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            if (Math.abs(touch.clientX - startX) > 8 || Math.abs(touch.clientY - startY) > 8) {
                isScrolling = true;
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            }
        };

        const finalizarToque = (e) => {
            if (pressTimer !== null) {
                clearTimeout(pressTimer);
                pressTimer = null;
                if (!isScrolling) {
                    colarFigurinha(id);
                }
            }
        };

        item.onmousedown = iniciarToque;
        item.onmouseup = finalizarToque;
        item.onmouseleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

        item.addEventListener('touchstart', iniciarToque, { passive: true });
        item.addEventListener('touchmove', moverToque, { passive: true });
        item.addEventListener('touchend', finalizarToque, { passive: true });

        container.appendChild(item);

        const elInv = document.getElementById(`inv-item-${id}`);
        descobrirEfitarImagem(null, id, elInv);
    });
}

function colarTodasAsFigurinhasDoInventario() {
    if (progresso.inventario.length === 0) return;

    const listaParaColar = [...progresso.inventario];

    listaParaColar.forEach(id => {
        if (!progresso.coladas.includes(id)) progresso.coladas.push(id);

        const vagaAlbum = document.getElementById(`vaga-album-${id}`);
        if (vagaAlbum) {
            vagaAlbum.classList.add('colada');

            const figInfo = database.find(f => f.id === id);
            vagaAlbum.innerHTML = `
                        <span class="badge-raridade" style="background-color: var(--${figInfo.raridade}); color: ${figInfo.raridade === 'comum' ? '#222' : '#fff'}">${figInfo.raridade}</span>
                        <div class="slot-foto">
                            <div class="badge-numero">#${id}</div>
                            <span>#${id}</span>
                            <img class="img-figurinha just-pasted" id="img-card-${id}" alt="Card ${id}">
                        </div>
                    `;
            const imgElement = document.getElementById(`img-card-${id}`);
            descobrirEfitarImagem(imgElement, id);
        }
    });

    progresso.inventario = [];

    salvarDados();
    document.getElementById('bloco-inventario-separado').classList.remove('active');
    document.getElementById('pack-opening').innerHTML = '';

    if (progresso.coladas.length === TOTAL_FIGURINHAS) {
        dispararNotificacaoApp("🎉 <b>APOBANGPO!</b> 👑<br>Você completou o álbum definitivo do BTS! 💜", true);
    } else {
        dispararNotificacaoApp("⚡ Photocards colados automaticamente no Álbum!");
    }
}

function colarFigurinha(id) {
    const cardElement = document.getElementById(`inv-item-${id}`);
    if (!cardElement) return;

    cardElement.classList.add('clicked-out');

    setTimeout(() => {
        if (!progresso.coladas.includes(id)) progresso.coladas.push(id);
        const index = progresso.inventario.indexOf(id);
        if (index > -1) progresso.inventario.splice(index, 1);

        salvarDados();
        cardElement.remove();

        if (progresso.inventario.length === 0) {
            document.getElementById('bloco-inventario-separado').classList.remove('active');
        }

        const vagaAlbum = document.getElementById(`vaga-album-${id}`);
        if (vagaAlbum) {
            vagaAlbum.classList.add('colada');

            const figInfo = database.find(f => f.id === id);
            vagaAlbum.innerHTML = `
                        <span class="badge-raridade" style="background-color: var(--${figInfo.raridade}); color: ${figInfo.raridade === 'comum' ? '#222' : '#fff'}">${figInfo.raridade}</span>
                        <div class="slot-foto">
                            <div class="badge-numero">#${id}</div>
                            <span>#${id}</span>
                            <img class="img-figurinha just-pasted" id="img-card-${id}" alt="Card ${id}">
                        </div>
                    `;

            const imgElement = document.getElementById(`img-card-${id}`);
            descobrirEfitarImagem(imgElement, id);
        }

        if (progresso.coladas.length === TOTAL_FIGURINHAS) {
            dispararNotificacaoApp("🎉 <b>APOBANGPO!</b> 👑<br>Você completou o álbum definitivo do BTS! 💜", true);
        }
    }, 220);
}

function atualizarVisualBooster() {
    const pack = document.getElementById('pack-virtual');
    const btn = document.getElementById('btn-abrir');
    const area = document.getElementById('booster-area-container');
    const agora = new Date().getTime();

    if (agora >= progresso.proximoPacote) {
        area.classList.remove('hidden');
        if (pack) {
            pack.style.display = "flex";
            pack.className = "booster-pack";
        }
        btn.disabled = false;
        btn.innerText = "Abrir Pacotinho 🛍️";
    } else {
        area.classList.add('hidden');
        btn.disabled = true;
    }
    salvarDados();
}

function iniciarTimer() {
    const btn = document.getElementById('btn-abrir');
    const timerDiv = document.getElementById('timer');

    setInterval(() => {
        const agora = new Date().getTime();
        const tempoRestanteReal = progresso.proximoPacote - agora;

        if (tempoRestanteReal <= 0) {
            atualizarVisualBooster();
            timerDiv.innerText = "Seu novo pack de Photocards chegou!";
        } else {
            btn.disabled = true;
            const horas = Math.floor((tempoRestanteReal % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((tempoRestanteReal % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((tempoRestanteReal % (1000 * 60)) / 1000);

            btn.innerText = `Pacotinho indisponível (${horas}h ${minutos}m ${segundos}s)`;
            timerDiv.innerText = "Volte amanhã ou junte fragmentos na Roleta de Sorte ao lado!";
        }
    }, 1000);
}

function resetarTempo() {
    progresso.proximoPacote = 0;
    salvarDados();
    atualizarVisualBooster();
}

inicializarBancoDados();
salvarDados();
renderizarInventario();
iniciarTimer();

//Funções ADM:
function pularTempo() {
    progresso.proximoPacote = 0;
    localStorage.setItem('bts_album_fragments_v11', JSON.stringify(progresso));
    atualizarVisualBooster();
}

function completar100() {
    progresso.coladas = Array.from({ length: 150 }, (_, i) => i + 1);
    progresso.inventario = [];
    localStorage.setItem('bts_album_fragments_v11', JSON.stringify(progresso));
    location.reload();

}

function zerrarAlbum() {
    localStorage.removeItem('bts_album_fragments_v11');
    location.reload();
}

function abrirFigurinhas(quantidade) {
    for (let i = 0; i < quantidade; i++) { progresso.inventario.push(sortearFigurinhaGeral()); }
    localStorage.setItem('bts_album_fragments_v11', JSON.stringify(progresso));
    renderizarInventario();
    document.getElementById('bloco-inventario-separado').scrollIntoView({ behavior: 'smooth' });
}