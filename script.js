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

// Fixed Log Function
function log(msg) {
    const lb = document.getElementById('game-log-box');
    if (lb) {
        lb.innerText = msg;
        // Visual flash to show update
        lb.style.color = "#fff";
        setTimeout(() => { lb.style.color = "var(--hit)"; }, 150);
    }
}

const countInput = document.getElementById('player-count-input');
const inputsContainer = document.getElementById('name-inputs-container');

function refreshInputs() {
    inputsContainer.innerHTML = '';
    let count = parseInt(countInput.value) || 1;
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
    log("GAME STARTED - " + players[0].name + " GOES FIRST");
};

// FIXED: Handle Hit now logs BEFORE moving to next turn
async function handleHit() {
    toggleControls(false);
    if (deck.length === 0) deck = createDeck();
    
    let activePlayer = players[currentPlayerIndex];
    let card = deck.pop();
    
    log(activePlayer.name + " DREW " + card.label);
    
    await processCard(activePlayer, card);
    
    // Only move turn if they didn't bust or freeze
    if (activePlayer.status === 'active') {
        nextTurn();
    } else {
        // If they busted/stayed, wait a moment so players see the result, then next turn
        setTimeout(nextTurn, 1000);
    }
    
    toggleControls(true);
}

async function processCard(player, card) {
    if (player.status !== 'active') return;
    
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const target = await openTargetModal(card);
        target.roundHand.push(card);
        if (card.val === 'FREEZE') {
            log(target.name + " WAS FROZEN!");
            target.status = 'stayed';
            bankScore(target);
        } else {
            log(target.name + " MUST FLIP 3!");
            await executeFlip3(target);
        }
    } else {
        await applySimpleCard(player, card);
    }
    renderUI();
}

async function applySimpleCard(player, card) {
    if (player.status !== 'active') return;
    
    if (card.val === 'CHANCE') {
        player.hasSecondChance = true;
        player.roundHand.push(card);
    } else if (card.type === 'mod') {
        player.roundHand.push(card);
    } else if (card.type === 'number') {
        let isDuplicate = card.val !== 0 && player.roundHand.some(c => c.type === 'number' && c.val === card.val);
        if (isDuplicate) {
            if (player.hasSecondChance) {
                await showNoticeModal("🛡️ SECOND CHANCE!", player.name + " used their shield!");
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
            } else {
                log(player.name + " BUSTED ON A " + card.val + "!");
                player.status = 'busted';
                player.roundHand.push(card);
            }
        } else {
            player.roundHand.push(card);
        }
    }
    
    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) { 
        log(player.name + " GOT ALL 7!");
        player.status = 'stayed'; 
        bankScore(player); 
    }
}

async function executeFlip3(target) {
    for (let i = 0; i < 3; i++) {
        if (target.status === 'active') {
            await new Promise(r => setTimeout(r, 800));
            if (deck.length === 0) deck = createDeck();
            await processCard(target, deck.pop());
            renderUI();
        }
    }
}

function openTargetModal(card) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-title-text').innerText = `Assign ${card.val}`;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = '';
        players.forEach(p => {
            if (p.status === 'active') {
                const btn = document.createElement('button');
                btn.innerText = p.name;
                btn.className = 'hit-btn';
                btn.onclick = () => { overlay.style.display = 'none'; resolve(p); };
                grid.appendChild(btn);
            }
        });
    });
}

function showNoticeModal(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-title-text').innerText = title;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = `<p style="grid-column: span 2; color:white;">${message}</p>`;
        const btn = document.createElement('button');
        btn.innerText = "OK"; btn.className = "hit-btn";
        btn.style.gridColumn = "span 2";
        btn.onclick = () => { overlay.style.display = 'none'; resolve(); };
        grid.appendChild(btn);
    });
}

function bankScore(p) { p.totalScore += getRoundTotal(p); }

function getRoundTotal(player) {
    if (player.status === 'busted') return 0;
    let sum = 0, mult = 1, add = 0, unique = new Set();
    player.roundHand.forEach(c => {
        if (c.type === 'number') { sum += c.val; if (c.val > 0) unique.add(c.val); }
        else if (c.type === 'mod') { if (c.mode === 'mult') mult = c.val; else add += c.val; }
    });
    let total = (sum * mult) + add;
    if (unique.size === 7) total += 15;
    return total;
}

function nextTurn() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) { 
        log("ROUND OVER - CALCULATING...");
        setTimeout(resetRound, 1500); 
        return; 
    }
    
    // Cycle to next active player
    let attempts = 0;
    do { 
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length; 
        attempts++;
    } while (players[currentPlayerIndex].status !== 'active' && attempts < players.length);
    
    renderUI();
}

function resetRound() {
    const winners = players.filter(p => p.totalScore >= WIN_SCORE);
    if (winners.length > 0) {
        winners.sort((a, b) => b.totalScore - a.totalScore);
        document.getElementById('winner-display-name').innerText = `${winners[0].name} Wins!`;
        document.getElementById('win-screen').style.display = 'flex';
        return;
    }
    
    players.forEach(p => { 
        p.roundHand = []; 
        p.status = 'active'; 
        p.hasSecondChance = false; 
    });
    currentPlayerIndex = 0;
    log("NEW ROUND BEGUN!");
    renderUI();
}

function renderUI() {
    const someoneHit200 = players.some(p => p.totalScore >= WIN_SCORE);
    document.getElementById('final-dash-banner').style.display = someoneHit200 ? 'block' : 'none';
    document.getElementById('turn-indicator').innerText = players[currentPlayerIndex].name + "'s Turn";
    document.getElementById('deck-count-display').innerText = deck.length;
    
    const lb = document.getElementById('leaderboard-display');
    lb.innerHTML = [...players].sort((a,b) => b.totalScore - a.totalScore)
        .map(p => `<div class="leader-tag ${p.totalScore >= 180 ? 'match-point' : ''}">${p.name}: ${p.totalScore}</div>`).join('');

    const container = document.getElementById('players-list-display');
    container.innerHTML = '';
    
    players.forEach((p, idx) => {
        const isMatchPoint = p.totalScore >= 180;
        const sortedHand = [...p.roundHand].sort((a,b) => {
            if (a.type === 'number' && b.type === 'number') return a.val - b.val;
            return (a.type === 'number' ? -1 : 1);
        });
        
        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''} ${isMatchPoint ? 'match-point' : ''}`;
        row.innerHTML = `
            <div class="player-info">
                <b>${p.name}</b><br><small>${p.status.toUpperCase()}</small>
                ${isMatchPoint ? '<br><span class="match-point-badge">Match Point</span>' : ''}
            </div>
            <div class="hand">${sortedHand.map(c => `<div class="card ${c.type}">${c.label}</div>`).join('')}</div>
            <div class="round-total-box"><small>ROUND</small><br><span class="round-score-val">${getRoundTotal(p)}</span></div>
        `;
        container.appendChild(row);
    });
}

function toggleControls(enable) {
    document.getElementById('hit-btn-main').disabled = !enable;
    document.getElementById('stay-btn-main').disabled = !enable;
}

document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = () => { 
    let p = players[currentPlayerIndex];
    log(p.name + " STAYED AT " + getRoundTotal(p));
    p.status = 'stayed'; 
    bankScore(p); 
    nextTurn(); 
};
