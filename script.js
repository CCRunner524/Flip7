let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function createDeck() {
    let d = [];
    for (let n = 0; n <= 12; n++) {
        let count = (n === 0 || n === 1) ? 1 : n;
        for (let i = 0; i < count; i++) d.push({ type: 'number', val: n, label: n.toString() });
    }
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FREEZE', label: 'FRZ' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3', label: 'FL3' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'CHANCE', label: '2nd' });
    [2, 4, 6, 8, 10].forEach(v => d.push({ type: 'mod', val: v, mode: 'add', label: '+' + v }));
    d.push({ type: 'mod', val: 2, mode: 'mult', label: 'x2' });
    return shuffle(d);
}

function log(msg) { document.getElementById('game-log-box').innerText = msg; }

// --- SETUP ---
const countInput = document.getElementById('player-count-input');
const inputsContainer = document.getElementById('name-inputs-container');

function refreshInputs() {
    inputsContainer.innerHTML = '';
    let count = parseInt(countInput.value) || 2;
    for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = `Player ${i + 1}`;
        input.className = 'player-name-field';
        inputsContainer.appendChild(input);
    }
}
countInput.addEventListener('change', refreshInputs);
refreshInputs();

document.getElementById('start-game-btn').onclick = () => {
    const fields = document.querySelectorAll('.player-name-field');
    players = Array.from(fields).map(f => ({
        name: f.value || f.placeholder, totalScore: 0, roundHand: [],
        status: 'active', hasSecondChance: false
    }));
    deck = createDeck();
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    renderUI();
};

// --- GAMEPLAY ---
async function handleHit() {
    toggleControls(false);
    let p = players[currentPlayerIndex];
    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    log(`${p.name} drew ${card.label}`);
    await processCard(p, card);
    
    if (p.status !== 'active') {
        setTimeout(nextTurn, 1200);
    } else {
        nextTurn();
    }
    toggleControls(true);
}

async function processCard(player, card) {
    if (player.status !== 'active') return;
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const target = await openTargetModal(card);
        target.roundHand.push(card);
        if (card.val === 'FREEZE') {
            log(`${target.name} frozen!`);
            target.status = 'stayed';
            bankScore(target);
        } else {
            log(`${target.name} Flip 3!`);
            await executeFlip3(target);
        }
    } else {
        await applySimpleCard(player, card);
    }
    renderUI();
}

async function applySimpleCard(player, card) {
    if (card.val === 'CHANCE') { player.hasSecondChance = true; player.roundHand.push(card); }
    else if (card.type === 'mod') { player.roundHand.push(card); }
    else if (card.type === 'number') {
        let isDup = card.val !== 0 && player.roundHand.some(c => c.type === 'number' && c.val === card.val);
        if (isDup) {
            if (player.hasSecondChance) {
                log("Shield Used!");
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
            } else {
                log("Bust!");
                player.status = 'busted';
                player.roundHand.push(card);
            }
        } else {
            player.roundHand.push(card);
        }
    }
    if (new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val)).size === 7) {
        log("Flip 7!"); player.status = 'stayed'; bankScore(player);
    }
}

async function executeFlip3(target) {
    for (let i = 0; i < 3; i++) {
        if (target.status === 'active') {
            await new Promise(r => setTimeout(r, 700));
            if (deck.length === 0) deck = createDeck();
            await processCard(target, deck.pop());
            renderUI();
        }
    }
}

// --- UI & TURNS ---
function bankScore(p) { p.totalScore += getRoundTotal(p); }

function getRoundTotal(p) {
    if (p.status === 'busted') return 0;
    let sum = 0, mult = 1, add = 0, unique = new Set();
    p.roundHand.forEach(c => {
        if (c.type === 'number') { sum += c.val; if (c.val > 0) unique.add(c.val); }
        else if (c.type === 'mod') { if (c.mode === 'mult') mult = c.val; else add += c.val; }
    });
    let total = (sum * mult) + add;
    if (unique.size === 7) total += 15;
    return total;
}

function nextTurn() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) { setTimeout(resetRound, 1500); return; }
    do { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; } 
    while (players[currentPlayerIndex].status !== 'active');
    renderUI();
}

function resetRound() {
    const winners = players.filter(p => p.totalScore >= WIN_SCORE);
    if (winners.length > 0) {
        winners.sort((a,b) => b.totalScore - a.totalScore);
        document.getElementById('winner-display-name').innerText = `${winners[0].name} Wins!`;
        document.getElementById('win-screen').style.display = 'flex';
        return;
    }
    players.forEach(p => { p.roundHand = []; p.status = 'active'; p.hasSecondChance = false; });
    currentPlayerIndex = 0;
    renderUI();
    log("New Round!");
}

function renderUI() {
    document.getElementById('deck-count-display').innerText = deck.length;
    document.getElementById('turn-indicator').innerText = `${players[currentPlayerIndex].name}'s Turn`;
    document.getElementById('final-dash-banner').style.display = players.some(p => p.totalScore >= WIN_SCORE) ? 'block' : 'none';
    
    const lb = document.getElementById('leaderboard-display');
    lb.innerHTML = [...players].sort((a,b) => b.totalScore - a.totalScore)
        .map(p => `<div class="leader-tag ${p.totalScore >= 180 ? 'match-point' : ''}">${p.name}: ${p.totalScore}</div>`).join('');

    const container = document.getElementById('players-list-display');
    container.innerHTML = '';
    players.forEach((p, idx) => {
        const sorted = [...p.roundHand].sort((a,b) => (a.type === 'number' && b.type === 'number') ? a.val - b.val : (a.type === 'number' ? -1 : 1));
        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''} ${p.totalScore >= 180 ? 'match-point' : ''}`;
        row.innerHTML = `<div class="player-info"><b>${p.name}</b><br><small>${p.status}</small></div>
            <div class="hand">${sorted.map(c => `<div class="card ${c.type}">${c.label}</div>`).join('')}</div>
            <div class="round-total-box"><small>ROUND</small><br><span class="round-score-val">${getRoundTotal(p)}</span></div>`;
        container.appendChild(row);
    });
}

// Modal Helpers
function openTargetModal(card) {
    return new Promise(resolve => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = '';
        players.forEach(p => {
            if (p.status === 'active') {
                const b = document.createElement('button'); b.innerText = p.name; b.className = 'hit-btn';
                b.onclick = () => { overlay.style.display = 'none'; resolve(p); };
                grid.appendChild(b);
            }
        });
    });
}

function toggleControls(en) {
    document.getElementById('hit-btn-main').disabled = !en;
    document.getElementById('stay-btn-main').disabled = !en;
}

document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = () => {
    let p = players[currentPlayerIndex]; p.status = 'stayed'; bankScore(p); nextTurn();
};
