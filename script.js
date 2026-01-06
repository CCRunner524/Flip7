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
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FREEZE', label: 'FREEZE' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3', label: 'FLIP 3' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'CHANCE', label: '2nd CHANCE' });
    [2, 4, 6, 8, 10].forEach(v => d.push({ type: 'mod', val: v, mode: 'add', label: '+' + v }));
    d.push({ type: 'mod', val: 2, mode: 'mult', label: 'x2' });
    return shuffle(d);
}

function log(msg) { document.getElementById('game-log-box').innerText = msg; }

// --- MODAL POPUPS ---
function showNoticeModal(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-title-text').innerText = title;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = `<p style="grid-column: span 3; color:white; font-size:1.1rem; margin:15px 0; line-height:1.5;">${message}</p>`;
        const btn = document.createElement('button');
        btn.innerText = "CONTINUE"; 
        btn.className = "hit-btn";
        btn.style.gridColumn = "span 3";
        btn.onclick = () => { overlay.style.display = 'none'; resolve(); };
        grid.appendChild(btn);
    });
}

function openTargetModal(card) {
    return new Promise(resolve => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-title-text').innerText = `Assign ${card.label} to:`;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = '';
        players.forEach(p => {
            if (p.status === 'active') {
                const b = document.createElement('button'); b.innerText = p.name; b.className = "hit-btn";
                b.onclick = () => { overlay.style.display = 'none'; resolve(p); };
                grid.appendChild(b);
            }
        });
    });
}

// --- SETUP ---
const countInput = document.getElementById('player-count-input');
const inputsContainer = document.getElementById('name-inputs-container');

function refreshInputs() {
    inputsContainer.innerHTML = '';
    let count = Math.min(parseInt(countInput.value) || 2, 14);
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

// --- GAMEPLAY & TURN LOGIC ---
async function handleHit() {
    toggleControls(false);
    let p = players[currentPlayerIndex];
    if (p.status !== 'active') { toggleControls(true); return; }

    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    log(`${p.name} drew ${card.label}`);
    
    await processCard(p, card);
    
    // Logic to prevent skipping: Only move turn if still active, otherwise wait for status display
    if (p.status !== 'active') {
        setTimeout(nextTurn, 1000);
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
            target.totalScore += getRoundTotal(target);
        } else {
            log(`${target.name} must Flip 3!`);
            await executeFlip3(target);
        }
    } else {
        await applySimpleCard(player, card);
    }
    renderUI();
}

async function applySimpleCard(player, card) {
    if (card.val === 'CHANCE') {
        if (!player.hasSecondChance) { player.hasSecondChance = true; log(`${player.name} shielded!`); }
        player.roundHand.push(card);
    } 
    else if (card.type === 'mod') {
        player.roundHand.push(card);
    } 
    else if (card.type === 'number') {
        let isDup = card.val !== 0 && player.roundHand.some(c => c.type === 'number' && c.val === card.val);
        
        if (isDup) {
            if (player.hasSecondChance) {
                // POPUP NOTIFYING OF DUPLICATE
                await showNoticeModal("🛡️ SHIELD USED!", `${player.name} drew a duplicate [ ${card.val} ]. The shield saved them!`);
                player.hasSecondChance = false;
                const chanceIdx = player.roundHand.findIndex(c => c.label === '2nd CHANCE');
                if (chanceIdx > -1) player.roundHand.splice(chanceIdx, 1);
                player.roundHand.push(card);
            } else {
                log(`${player.name} Busted on ${card.val}!`);
                player.status = 'busted';
                player.roundHand.push(card);
            }
        } else {
            player.roundHand.push(card);
        }
    }

    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) {
        log("FLIP 7 BONUS!");
        player.status = 'stayed';
        player.totalScore += (getRoundTotal(player) + 15);
    }
}

async function executeFlip3(target) {
    for (let i = 0; i < 3; i++) {
        if (target.status === 'active') {
            await new Promise(r => setTimeout(r, 600));
            if (deck.length === 0) deck = createDeck();
            await processCard(target, deck.pop());
            renderUI();
        }
    }
}

function getRoundTotal(p) {
    if (p.status === 'busted') return 0;
    let sum = 0, mult = 1, add = 0;
    p.roundHand.forEach(c => {
        if (c.type === 'number') sum += c.val;
        else if (c.type === 'mod') { if (c.mode === 'mult') mult = c.val; else add += c.val; }
    });
    return (sum * mult) + add;
}

// Fixed Turn Progression
function nextTurn() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) { setTimeout(resetRound, 1500); return; }

    let nextIndex = (currentPlayerIndex + 1) % players.length;
    let attempts = 0;
    while (players[nextIndex].status !== 'active' && attempts < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        attempts++;
    }
    currentPlayerIndex = nextIndex;
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
    log("NEW ROUND STARTED");
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
        // NUMERICAL SORTING
        const sortedHand = [...p.roundHand].sort((a, b) => {
            if (a.type === 'number' && b.type === 'number') return a.val - b.val;
            if (a.type === 'number') return -1;
            if (b.type === 'number') return 1;
            return 0;
        });

        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''}`;
        row.innerHTML = `<div class="player-info"><b>${p.name}</b> ${p.hasSecondChance ? '🛡️' : ''}<br><small>${p.status.toUpperCase()}</small></div>
            <div class="hand">${sortedHand.map(c => `<div class="card ${c.type}">${c.label}</div>`).join('')}</div>
            <div class="round-total-box"><small>ROUND</small><br><span class="round-score-val">${getRoundTotal(p)}</span></div>`;
        container.appendChild(row);
    });
}

function toggleControls(en) {
    document.getElementById('hit-btn-main').disabled = !en;
    document.getElementById('stay-btn-main').disabled = !en;
}

document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = () => {
    let p = players[currentPlayerIndex]; 
    log(`${p.name} stayed at ${getRoundTotal(p)}`);
    p.status = 'stayed'; 
    p.totalScore += getRoundTotal(p); 
    renderUI();
    setTimeout(nextTurn, 500);
};
