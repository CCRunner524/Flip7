/** * FLIP 7 - FULL CHAINING VERSION
 * Updated: 
 * 1. Auto-sorting hand (Numbers 0-12, then Actions/Mods).
 * 2. Second Chance Popup/Notification.
 */

let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// --- 1. THE SHUFFLE ENGINE ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- 2. DECK INITIALIZATION ---
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

// --- SETUP ---
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
if (countInput) countInput.addEventListener('change', refreshInputs);
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

// --- GAMEPLAY CORE ---
async function handleHit() {
    toggleControls(false);
    
    if (deck.length === 0) {
        log("Deck empty! Reshuffling...");
        deck = createDeck(); 
    }
    
    let card = deck.pop();
    await processCard(players[currentPlayerIndex], card);
    
    nextTurn();
    toggleControls(true);
}

async function processCard(player, card) {
    if (player.status !== 'active') return;

    // A: Targetable Actions
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const target = await openTargetModal(card);
        target.roundHand.push(card);
        
        if (card.val === 'FREEZE') {
            target.status = 'stayed';
            bankScore(target);
            log(`${target.name} was FROZEN.`);
        } else {
            log(`${target.name} must FLIP 3!`);
            await executeFlip3(target);
        }
    } 
    // B: Simple Cards (Now Async to allow for the 2nd Chance Popup)
    else {
        await applySimpleCard(player, card);
    }
    renderUI();
}

async function applySimpleCard(player, card) {
    if (player.status !== 'active') return;

    if (card.val === 'CHANCE') {
        if (!player.hasSecondChance) {
            player.hasSecondChance = true;
            player.roundHand.push(card);
        }
    } else if (card.type === 'mod') {
        player.roundHand.push(card);
    } else if (card.type === 'number') {
        let isDuplicate = card.val !== 0 && player.roundHand.some(c => c.val === card.val);
        
        if (isDuplicate) {
            if (player.hasSecondChance) {
                // SECOND CHANCE POPUP LOGIC
                await showNoticeModal("🛡️ SECOND CHANCE!", `${player.name} drew a duplicate ${card.val}, but the Second Chance saved them! Card discarded.`);
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
                log(`🛡️ ${player.name} used 2nd Chance!`);
            } else {
                player.status = 'busted';
                player.roundHand.push(card);
                log(`💥 ${player.name} BUSTED on ${card.val}!`);
            }
        } else {
            player.roundHand.push(card);
        }
    }

    // Check Flip 7 Limit
    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) {
        player.status = 'stayed';
        bankScore(player);
        log(`🌟 ${player.name} hit FLIP 7!`);
    }
}

async function executeFlip3(target) {
    for (let i = 0; i < 3; i++) {
        if (target.status === 'active') {
            await new Promise(r => setTimeout(r, 500)); 
            if (deck.length === 0) deck = createDeck();
            let nextCard = deck.pop();
            await processCard(target, nextCard);
            renderUI();
        }
    }
}

// --- MODALS ---
function openTargetModal(card) {
    return new Promise((resolve) => {
        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-title-text').innerText = `Assign ${card.val}`;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = '';
        players.forEach((p) => {
            if (p.status === 'active') {
                const btn = document.createElement('button');
                btn.innerText = p.name;
                btn.className = 'hit-btn';
                btn.onclick = () => {
                    document.getElementById('modal-overlay').style.display = 'none';
                    resolve(p);
                };
                grid.appendChild(btn);
            }
        });
    });
}

// New helper for the Second Chance notification
function showNoticeModal(title, message) {
    return new Promise((resolve) => {
        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-title-text').innerText = title;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = `<div style="color:white; text-align:center; padding: 20px; font-size: 1.1em;">${message}</div>`;
        const btn = document.createElement('button');
        btn.innerText = "CONTINUE";
        btn.className = "hit-btn";
        btn.onclick = () => {
            document.getElementById('modal-overlay').style.display = 'none';
            resolve();
        };
        grid.appendChild(btn);
    });
}

// --- UTILS ---
function toggleControls(enable) {
    document.getElementById('hit-btn-main').disabled = !enable;
    document.getElementById('stay-btn-main').disabled = !enable;
    document.getElementById('game-controls').style.opacity = enable ? "1" : "0.5";
}

function getRoundTotal(player) {
    if (player.status === 'busted') return 0;
    let baseSum = 0, multiplier = 1, additives = 0, uniqueNums = new Set();
    player.roundHand.forEach(c => {
        if (c.type === 'number') { 
            baseSum += c.val; 
            if (c.val > 0) uniqueNums.add(c.val); 
        }
        else if (c.type === 'mod') { 
            if (c.mode === 'mult') multiplier = c.val; else additives += c.val; 
        }
    });
    let total = (baseSum * multiplier) + additives;
    if (uniqueNums.size === 7) total += 15;
    return total;
}

function nextTurn() {
    const actives = players.filter(p => p.status === 'active');
    if (actives.length === 0) { setTimeout(resetRound, 2000); return; }
    do { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; } 
    while (players[currentPlayerIndex].status !== 'active');
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
    players.forEach(p => { p.roundHand = []; p.status = 'active'; p.hasSecondChance = false; });
    currentPlayerIndex = 0;
    renderUI();
}

function renderUI() {
    document.getElementById('deck-count-display').innerText = deck.length;
    const lb = document.getElementById('leaderboard-display');
    lb.innerHTML = [...players].sort((a,b) => b.totalScore - a.totalScore)
        .map(p => `<div class="leader-tag">${p.name}: ${p.totalScore}</div>`).join('');

    const container = document.getElementById('players-list-display');
    container.innerHTML = '';
    
    players.forEach((p, idx) => {
        // --- FEATURE 1: SORTING THE HAND ---
        const sortedHand = [...p.roundHand].sort((a, b) => {
            // Sort numbers 0-12 low to high
            if (a.type === 'number' && b.type === 'number') return a.val - b.val;
            // Put numbers before actions/modifiers
            if (a.type === 'number' && b.type !== 'number') return -1;
            if (a.type !== 'number' && b.type === 'number') return 1;
            return 0;
        });

        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''}`;
        row.innerHTML = `
            <div class="player-info"><b>${p.name}</b><br><small>${p.status.toUpperCase()}</small></div>
            <div class="hand">${sortedHand.map(c => `<div class="card ${c.type}">${c.label}</div>`).join('')}</div>
            <div class="round-total-box"><small>ROUND</small><br><span class="round-score-val">${getRoundTotal(p)}</span></div>
        `;
        container.appendChild(row);
    });
    document.getElementById('turn-indicator').innerText = `${players[currentPlayerIndex].name}'s Turn`;
}

function log(msg) { document.getElementById('game-log-box').innerText = msg; }

document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = stayCurrentPlayer;
