/** * FLIP 7 - ONE-SCREEN CHAMPIONSHIP
 * FIXED: Initialization, Targeting, and Second Chance Logic
 */

let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// --- DECK INITIALIZATION (94 Cards) ---
function createDeck() {
    let d = [];
    // Number cards 0 to 12 (specific counts per prompt)
    for (let n = 0; n <= 12; n++) {
        let count = (n === 0 || n === 1) ? 1 : n;
        for (let i = 0; i < count; i++) d.push({ type: 'number', val: n, label: n.toString() });
    }
    // Action Cards (3 of each)
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FREEZE', label: 'FRZ' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3', label: 'FL3' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'CHANCE', label: '2nd' });
    // Modifier Cards
    [2, 4, 6, 8, 10].forEach(v => d.push({ type: 'mod', val: v, mode: 'add', label: '+' + v }));
    d.push({ type: 'mod', val: 2, mode: 'mult', label: 'x2' });

    return d.sort(() => Math.random() - 0.5);
}

// --- SETUP SCREEN LOGIC ---
const countInput = document.getElementById('player-count-input');
const inputsContainer = document.getElementById('name-inputs-container');

function refreshInputs() {
    inputsContainer.innerHTML = '';
    let count = parseInt(countInput.value) || 1;
    for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Player ${i + 1}`;
        input.className = 'player-name-field';
        inputsContainer.appendChild(input);
    }
}

countInput.addEventListener('change', refreshInputs);
refreshInputs(); // Run once at start

document.getElementById('start-game-btn').onclick = () => {
    const fields = document.querySelectorAll('.player-name-field');
    players = Array.from(fields).map(f => ({
        name: f.value || f.placeholder,
        totalScore: 0,
        roundHand: [],
        status: 'active',
        hasSecondChance: false
    }));

    if (players.length > 0) {
        deck = createDeck();
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        renderUI();
    }
};

// --- GAMEPLAY MECHANICS ---
function handleHit() {
    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    let player = players[currentPlayerIndex];

    // Only Freeze and Flip 3 trigger the targeting popup
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        openTargetModal(card);
    } else {
        applyCard(player, card);
        nextTurn();
    }
}

function applyCard(player, card) {
    if (player.status !== 'active') return;

    // 1. Check Second Chance Logic (Max 1 per hand)
    if (card.val === 'CHANCE') {
        if (!player.hasSecondChance) {
            player.hasSecondChance = true;
            player.roundHand.push(card);
        } else {
            // Already has one, card is essentially discarded/ignored
            log(`${player.name} already has a Second Chance.`);
        }
    } 
    // 2. Number Cards & Busting
    else if (card.type === 'number') {
        let isDuplicate = card.val !== 0 && player.roundHand.some(c => c.val === card.val);
        
        if (isDuplicate) {
            if (player.hasSecondChance) {
                // Remove the Second Chance card and ignore the new card
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
                log(`🛡️ ${player.name} used Second Chance! Duplicate ${card.val} discarded.`);
            } else {
                player.status = 'busted';
                player.roundHand.push(card);
                log(`💥 ${player.name} BUSTED on ${card.val}!`);
            }
        } else {
            player.roundHand.push(card);
        }
    } 
    // 3. Modifiers (+X or x2)
    else {
        player.roundHand.push(card);
    }

    // 4. Check for Flip 7 Bonus (7 Unique Number cards)
    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) {
        player.status = 'stayed';
        log(`🌟 ${player.name} ACHIEVED FLIP 7!`);
        bankScore(player);
    }

    renderUI();
}

// --- SCORING: (Sum * Mult) + Additive ---
function getRoundTotal(player) {
    if (player.status === 'busted') return 0;
    
    let baseSum = 0;
    let multiplier = 1;
    let additions = 0;
    let uniqueNums = new Set();

    player.roundHand.forEach(c => {
        if (c.type === 'number') {
            baseSum += c.val;
            if (c.val > 0) uniqueNums.add(c.val);
        } else if (c.type === 'mod') {
            if (c.mode === 'mult') multiplier = c.val;
            else additions += c.val;
        }
    });

    let total = (baseSum * multiplier) + additions;
    if (uniqueNums.size === 7) total += 15; // Flip 7 Bonus
    return total;
}

// --- TURN & TARGETING ---
function openTargetModal(card) {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-title-text').innerText = `Assign ${card.val}`;
    const grid = document.getElementById('target-buttons-grid');
    grid.innerHTML = '';

    players.forEach((p, idx) => {
        if (p.status === 'active') {
            const btn = document.createElement('button');
            btn.innerText = p.name;
            btn.className = 'hit-btn';
            btn.onclick = () => {
                if (card.val === 'FREEZE') {
                    p.status = 'stayed';
                    p.roundHand.push(card);
                    bankScore(p);
                } else if (card.val === 'FLIP 3') {
                    p.roundHand.push(card);
                    executeFlip3(p);
                }
                document.getElementById('modal-overlay').style.display = 'none';
                nextTurn();
            };
            grid.appendChild(btn);
        }
    });
}

async function executeFlip3(p) {
    for (let i = 0; i < 3; i++) {
        if (p.status === 'active') {
            if (deck.length === 0) deck = createDeck();
            applyCard(p, deck.pop());
            await new Promise(r => setTimeout(r, 300)); // Delay for visual flip
        }
    }
}

function nextTurn() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) {
        setTimeout(resetRound, 2000);
        return;
    }

    do {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    } while (players[currentPlayerIndex].status !== 'active');
    
    renderUI();
}

function stayCurrentPlayer() {
    let p = players[currentPlayerIndex];
    p.status = 'stayed';
    bankScore(p);
    nextTurn();
}

function bankScore(p) {
    p.totalScore += getRoundTotal(p);
    if (p.totalScore >= WIN_SCORE) {
        document.getElementById('winner-display-name').innerText = `${p.name} WINS!`;
        document.getElementById('win-screen').style.display = 'flex';
    }
}

function resetRound() {
    players.forEach(p => {
        p.roundHand = [];
        p.status = 'active';
        p.hasSecondChance = false;
    });
    currentPlayerIndex = 0;
    log("New Round Started!");
    renderUI();
}

// --- UI UPDATE ---
function renderUI() {
    document.getElementById('deck-count-display').innerText = deck.length;
    
    const lb = document.getElementById('leaderboard-display');
    lb.innerHTML = [...players].sort((a,b) => b.totalScore - a.totalScore)
        .map(p => `<div class="leader-tag">${p.name}: ${p.totalScore}</div>`).join('');

    const container = document.getElementById('players-list-display');
    container.innerHTML = '';
    
    players.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''}`;
        row.innerHTML = `
            <div class="player-info">
                <b>${p.name}</b><br>
                <small>${p.status.toUpperCase()}</small>
                ${p.hasSecondChance ? '<br><small>🛡️ CHANCE</small>' : ''}
            </div>
            <div class="hand">
                ${p.roundHand.map(c => `<div class="card ${c.type}">${c.label}</div>`).join('')}
            </div>
            <div class="round-total-box">
                <small>ROUND</small><br>
                <span class="round-score-val">${getRoundTotal(p)}</span>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('turn-indicator').innerText = `${players[currentPlayerIndex].name}'s Turn`;
}

function log(msg) { document.getElementById('game-log-box').innerText = msg; }

document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = stayCurrentPlayer;
