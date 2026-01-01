const NUM_PLAYERS = 13;
const WIN_SCORE = 200;
let deck = [];
let players = [];
let currentPlayerIndex = 0;
let pendingActionCard = null;

// --- DECK LOGIC ---
function createDeck() {
    let d = [];
    // Number Cards
    d.push({ type: 'number', val: 0, label: '0' });
    for (let n = 1; n <= 7; n++) {
        for (let i = 0; i < n; i++) d.push({ type: 'number', val: n, label: n.toString() });
    }
    // Action Cards
    for (let i = 0; i < 4; i++) d.push({ type: 'action', val: 'FREEZE', label: 'FRZ' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3', label: 'FL3' });
    for (let i = 0; i < 4; i++) d.push({ type: 'action', val: 'CHANCE', label: '2nd' });
    // Modifiers
    for (let i = 0; i < 3; i++) d.push({ type: 'multiplier', val: 2, label: 'x2' });
    for (let i = 0; i < 5; i++) d.push({ type: 'bonus', val: 10, label: '+10' });
    for (let i = 0; i < 8; i++) d.push({ type: 'bonus', val: 5, label: '+5' });

    return d.sort(() => Math.random() - 0.5);
}

function checkDeck() {
    if (deck.length === 0) {
        log("Deck depleted! Reshuffling new deck...");
        deck = createDeck();
    }
}

// --- GAME CORE ---
function initGame() {
    players = Array.from({ length: NUM_PLAYERS }, (_, i) => ({
        id: i, name: `P${i + 1}`, totalScore: 0, roundHand: [],
        status: 'active', hasSecondChance: false
    }));
    deck = createDeck();
    currentPlayerIndex = 0;
    document.getElementById('action-btns').style.display = 'block';
    updateUI();
}

function twist() {
    checkDeck();
    let card = deck.pop();
    let player = players[currentPlayerIndex];

    if (card.type === 'action' || card.type === 'multiplier' || card.type === 'bonus') {
        openTargetModal(card);
    } else {
        processCard(player, card);
    }
}

function processCard(player, card) {
    player.roundHand.push(card);

    if (card.val === 'CHANCE') player.hasSecondChance = true;

    if (card.type === 'number') {
        if (hasDuplicate(player) && card.val !== 0) {
            if (player.hasSecondChance) {
                player.hasSecondChance = false;
                log(`${player.name} used 2nd Chance! Duplicate removed.`);
                player.roundHand = player.roundHand.filter(c => c !== card && c.val !== 'CHANCE');
            } else {
                player.status = 'busted';
                log(`${player.name} BUSTED!`);
                if (player.id === currentPlayerIndex) nextTurn();
            }
        }
    }

    if (card.val === 'FREEZE') {
        player.status = 'stayed';
        bankScore(player);
        log(`${player.name} is FROZEN!`);
        if (player.id === currentPlayerIndex) nextTurn();
    }

    if (card.val === 'FLIP 3') {
        log(`${player.name} Flips 3!`);
        for (let i = 0; i < 3; i++) {
            if (player.status === 'active') {
                checkDeck();
                processCard(player, deck.pop());
            }
        }
    }
    updateUI();
}

function stay() {
    let p = players[currentPlayerIndex];
    p.status = 'stayed';
    bankScore(p);
    nextTurn();
}

function bankScore(player) {
    let sum = 0, mult = 1, unique = new Set();
    player.roundHand.forEach(c => {
        if (typeof c.val === 'number') { sum += c.val; if (c.val > 0) unique.add(c.val); }
        if (c.type === 'bonus') sum += c.val;
        if (c.val === 2) mult = 2;
    });
    let roundTotal = sum * mult;
    if (unique.size >= 7) roundTotal += 15;
    player.totalScore += roundTotal;
    checkWinner(player);
}

function checkWinner(player) {
    if (player.totalScore >= WIN_SCORE) {
        document.getElementById('winner-name').innerText = `${player.name.toUpperCase()} WINS!`;
        document.getElementById('winner-score').innerText = player.totalScore;
        document.getElementById('winner-modal').style.display = 'flex';
    }
}

function nextTurn() {
    let actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) return resetRound();

    do {
        currentPlayerIndex = (currentPlayerIndex + 1) % NUM_PLAYERS;
    } while (players[currentPlayerIndex].status !== 'active');
    updateUI();
}

function resetRound() {
    log("Round complete. Starting next round...");
    setTimeout(() => {
        players.forEach(p => { p.roundHand = []; p.status = 'active'; p.hasSecondChance = false; });
        updateUI();
    }, 2000);
}

// --- MODALS ---
function openTargetModal(card) {
    pendingActionCard = card;
    document.getElementById('action-card-name').innerText = card.label;
    const btns = document.getElementById('target-buttons');
    btns.innerHTML = '';

    players.forEach(p => {
        if (p.status === 'active') {
            let b = document.createElement('button');
            b.innerText = p.name;
            b.className = (p.id === currentPlayerIndex) ? 'hit' : 'stay';
            b.onclick = () => {
                processCard(p, pendingActionCard);
                document.getElementById('target-modal').style.display = 'none';
                if (players[currentPlayerIndex].status !== 'active') nextTurn();
            };
            btns.appendChild(b);
        }
    });
    document.getElementById('target-modal').style.display = 'flex';
}

function hasDuplicate(player) {
    let nums = player.roundHand.filter(c => c.type === 'number' && c.val > 0).map(c => c.val);
    return new Set(nums).size !== nums.length;
}

function log(msg) { document.getElementById('game-log').innerText = msg; }

function updateUI() {
    document.getElementById('deck-count-circle').innerText = deck.length;
    let sorted = [...players].sort((a,b) => b.totalScore - a.totalScore);
    document.getElementById('leaderboard-list').innerHTML = sorted.map(p => `
        <div class="leader-item">${p.name}: <b>${p.totalScore}</b></div>
    `).join('');

    const list = document.getElementById('players-list');
    list.innerHTML = '';
    players.forEach((p, i) => {
        let div = document.createElement('div');
        div.className = `player-row ${i === currentPlayerIndex ? 'active-turn' : ''}`;
        div.innerHTML = `
            <div class="player-info">
                <b>${p.name}</b> [${p.totalScore}]<br>
                <small style="color:${p.status === 'active' ? '#00ff87' : '#ff4b2b'}">${p.status.toUpperCase()}</small>
            </div>
            <div class="hand-container">
                ${p.roundHand.map(c => `<div class="card ${c.type} ${p.status === 'busted' ? 'busted' : ''}">${c.label}</div>`).join('')}
            </div>
        `;
        list.appendChild(div);
    });
    if (players[currentPlayerIndex]) document.getElementById('turn-display').innerText = `${players[currentPlayerIndex].name}'s Turn`;
}

document.getElementById('start-btn').onclick = initGame;
document.getElementById('twist-btn').onclick = twist;
document.getElementById('stay-btn').onclick = stay;

