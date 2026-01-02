/** * FLIP 7 - ONE-SCREEN CHAMPIONSHIP 
 * FIXED: Action Card Chaining (Actions inside Flip 3 now trigger targeting)
 */

let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// --- DECK INITIALIZATION (94 Cards) ---
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
    if (players.length > 0) {
        deck = createDeck();
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';
        renderUI();
    }
};

// --- CORE GAMEPLAY ---
async function handleHit() {
    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    
    // Process the card (Check if it's an action)
    await processCardLogic(players[currentPlayerIndex], card);
    
    nextTurn();
}

async function processCardLogic(drawingPlayer, card) {
    // If it's a Freeze or Flip 3, we MUST prompt for a target
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const targetPlayer = await openTargetModal(card);
        
        if (card.val === 'FREEZE') {
            targetPlayer.status = 'stayed';
            targetPlayer.roundHand.push(card);
            bankScore(targetPlayer);
            log(`${targetPlayer.name} was FROZEN!`);
        } else if (card.val === 'FLIP 3') {
            targetPlayer.roundHand.push(card);
            log(`${targetPlayer.name} must FLIP 3!`);
            await executeFlip3(targetPlayer);
        }
    } else {
        // Otherwise, apply it normally to the drawing player
        applyCard(drawingPlayer, card);
    }
    renderUI();
}

function applyCard(player, card) {
    if (player.status !== 'active') return;

    if (card.val === 'CHANCE') {
        if (!player.hasSecondChance) {
            player.hasSecondChance = true;
            player.roundHand.push(card);
        }
    } else if (card.type === 'number') {
        let isDuplicate = card.val !== 0 && player.roundHand.some(c => c.val === card.val);
        if (isDuplicate) {
            if (player.hasSecondChance) {
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
                log(`🛡️ ${player.name} used 2nd Chance! Duplicate ${card.val} discarded.`);
            } else {
                player.status = 'busted';
                player.roundHand.push(card);
                log(`💥 ${player.name} BUSTED on ${card.val}!`);
            }
        } else {
            player.roundHand.push(card);
        }
    } else {
        player.roundHand.push(card);
    }

    // Check Flip 7 Cap
    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) {
        player.status = 'stayed';
        log(`🌟 ${player.name} HIT FLIP 7!`);
        bankScore(player);
    }
}

async function executeFlip3(p) {
    for (let i = 0; i < 3; i++) {
        if (p.status === 'active') {
            if (deck.length === 0) deck = createDeck();
            let nextCard = deck.pop();
            // This is the key update: check for action cards during Flip 3
            await processCardLogic(p, nextCard);
            await new Promise(r => setTimeout(r, 400));
        }
    }
}

// --- MODAL AS A PROMISE ---
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
                    resolve(p); // This sends the chosen player back to the logic
                };
                grid.appendChild(btn);
            }
        });
    });
}

// --- REMAINING UTILITIES ---
function getRoundTotal(player) {
    if (player.status === 'busted') return 0;
    let baseSum = 0, multiplier = 1, additions = 0, uniqueNums = new Set();
    player.roundHand.forEach(c => {
        if (c.type === 'number') { baseSum += c.val; if (c.val > 0) uniqueNums.add(c.val); }
        else if (c.type === 'mod') { if (c.mode === 'mult') multiplier = c.val; else additions += c.val; }
    });
    let total = (baseSum * multiplier) + additions;
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
        const row = document.createElement('div');
        row.className = `player-row ${idx === currentPlayerIndex ? 'active' : ''}`;
        row.innerHTML = `
