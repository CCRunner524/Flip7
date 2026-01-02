let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// 1. Deck Generation (94 Cards Total)
function createDeck() {
    let d = [];
    // Numbers: 0(1), 1(1), 2(2)... 12(12) = 79 cards
    for (let n = 0; n <= 12; n++) {
        let count = (n === 0 || n === 1) ? 1 : n;
        for (let i = 0; i < count; i++) d.push({ type: 'number', val: n });
    }
    // Actions
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FREEZE' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'CHANCE' });
    // Modifiers
    [2, 4, 6, 8, 10].forEach(v => d.push({ type: 'mod', val: v, mode: 'add' }));
    d.push({ type: 'mod', val: 2, mode: 'mult' });

    return d.sort(() => Math.random() - 0.5);
}

// 2. Setup Logic
const playerCountInput = document.getElementById('player-count');
playerCountInput.addEventListener('input', updateNameInputs);

function updateNameInputs() {
    const container = document.getElementById('name-inputs');
    container.innerHTML = '';
    for (let i = 0; i < playerCountInput.value; i++) {
        container.innerHTML += `<input type="text" placeholder="Player ${i+1}" class="p-name">`;
    }
}
updateNameInputs();

document.getElementById('start-game-btn').onclick = () => {
    const names = Array.from(document.querySelectorAll('.p-name')).map(i => i.value || i.placeholder);
    players = names.map(n => ({ 
        name: n, totalScore: 0, roundHand: [], status: 'active', hasSecondChance: false 
    }));
    deck = createDeck();
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    renderUI();
};

// 3. Core Mechanics
function processHit() {
    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    let player = players[currentPlayerIndex];

    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        showTargetModal(card);
    } else {
        applyCard(player, card);
        moveToNextPlayer();
    }
}

function applyCard(player, card) {
    if (player.status !== 'active') return;

    // Second Chance Logic
    if (card.val === 'CHANCE') {
        player.hasSecondChance = true;
        player.roundHand.push(card);
    } 
    // Modifier/Number Logic
    else if (card.type === 'number') {
        if (checkBust(player, card.val)) {
            if (player.hasSecondChance) {
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
                log(`${player.name} used Second Chance! Bust avoided.`);
            } else {
                player.status = 'busted';
                log(`${player.name} BUSTED!`);
            }
        } else {
            player.roundHand.push(card);
        }
    } else {
        player.roundHand.push(card);
    }
    
    // Check Flip 7 Limit (Unique Number Cards Only)
    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size >= 7) {
        player.status = 'stayed';
        bankScore(player);
        log(`${player.name} reached 7 unique cards!`);
    }

    renderUI();
}

function checkBust(player, newVal) {
    if (newVal === 0) return false;
    return player.roundHand.some(c => c.val === newVal);
}

// 4. Scoring Order: (Numbers * Mult) + Additives
function calculateRoundScore(player) {
    if (player.status === 'busted') return 0;
    let numSum = 0;
    let multiplier = 1;
    let additives = 0;

    player.roundHand.forEach(c => {
        if (c.type === 'number') numSum += c.val;
        if (c.type === 'mod') {
            if (c.mode === 'mult') multiplier = c.val;
            else additives += c.val;
        }
    });

    let score = (numSum * multiplier) + additives;
    // Flip 7 Bonus
    const uniqueCount = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val)).size;
    if (uniqueCount >= 7) score += 15;
    
    return score;
}

// 5. Action Handlers (Targeting)
function showTargetModal(card) {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-title').innerText = `Assign ${card.val}`;
    const list = document.getElementById('target-buttons');
    const container = document.getElementById('target-list');
    container.innerHTML = '';

    players.forEach((p, idx) => {
        if (p.status === 'active') {
            const btn = document.createElement('button');
            btn.innerText = p.name;
            btn.className = 'hit-btn';
            btn.onclick = () => {
                if (card.val === 'FREEZE') {
                    p.status = 'stayed';
                    bankScore(p);
                } else if (card.val === 'FLIP 3') {
                    executeFlip3(p);
                }
                document.getElementById('modal-overlay').style.display = 'none';
                moveToNextPlayer();
            };
            container.appendChild(btn);
        }
    });
}

async function executeFlip3(player) {
    for (let i = 0; i < 3; i++) {
        if (player.status === 'active') {
            if (deck.length === 0) deck = createDeck();
            applyCard(player, deck.pop());
            await new Promise(r => setTimeout(r, 400)); // Visual delay
        }
    }
}

// 6. Turn Management
function moveToNextPlayer() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) {
        startNewRound();
        return;
    }

    do {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    } while (players[currentPlayerIndex].status !== 'active');
    
    renderUI();
}

function bankScore(player) {
    player.totalScore += calculateRoundScore(player);
    if (player.totalScore >= WIN_SCORE) {
        document.getElementById('winner-name').innerText = `${player.name} WINS!`;
        document.getElementById('win-screen').style.display = 'flex';
    }
}

function startNewRound() {
    log("Round Over. Resetting hands...");
    setTimeout(() => {
        players.forEach(p => {
            if (p.status === 'active') bankScore(p); // Bank those who stayed
            p.roundHand = [];
            p.status = 'active';
            p.hasSecondChance = false;
        });
        currentPlayerIndex = 0;
        renderUI();
    }, 2000);
}

// 7. UI Update
function renderUI() {
    document.getElementById('deck-count').innerText = deck.length;
    
    // Leaderboard
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = [...players].sort((a,b) => b.totalScore - a.totalScore)
        .map(p => `<div class="leader-tag">${p.name}: ${p.totalScore}</div>`).join('');

    // Player Rows
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = `player-row ${i === currentPlayerIndex ? 'active' : ''}`;
        row.innerHTML = `
            <div class="player-info">
                <strong>${p.name}</strong><br>
                <small>${p.status.toUpperCase()}</small>
            </div>
            <div class="hand">
                ${p.roundHand.map(c => `<div class="card ${c.type}">${c.type === 'mod' ? (c.mode==='mult'?'x'+c.val:'+'+c.val) : c.val}</div>`).join('')}
            </div>
            <div class="round-total">${calculateRoundScore(p)}</div>
        `;
        container.appendChild(row);
    });

    document.getElementById('turn-indicator').innerText = `${players[currentPlayerIndex].name}'s Turn`;
}

function log(m) { document.getElementById('game-log').innerText = m; }

document.getElementById('hit-btn').onclick = processHit;
document.getElementById('stay-btn').onclick = () => {
    players[currentPlayerIndex].status = 'stayed';
    bankScore(players[currentPlayerIndex]);
    moveToNextPlayer();
};
