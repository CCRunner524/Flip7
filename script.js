/** * FLIP 7 - FULL MASTER CODE
 * Updates: Sorted Hands, Mod-Bust Fix, 2nd Chance Popup, Centered Win Screen, Round-End Win Check.
 */

let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// --- 1. ENGINE ---
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

// --- 2. SETUP ---
const countInput = document.getElementById('player-count-input');
const inputsContainer = document.getElementById('name-inputs-container');

function refreshInputs() {
    if (!inputsContainer) return;
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

// --- 3. GAMEPLAY ---
async function handleHit() {
    toggleControls(false);
    if (deck.length === 0) deck = createDeck();
    let card = deck.pop();
    await processCard(players[currentPlayerIndex], card);
    nextTurn();
    toggleControls(true);
}

async function processCard(player, card) {
    if (player.status !== 'active') return;

    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const target = await openTargetModal(card);
        target.roundHand.push(card);
        if (card.val === 'FREEZE') {
            target.status = 'stayed';
            bankScore(target);
        } else {
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
        if (!player.hasSecondChance) { player.hasSecondChance = true; player.roundHand.push(card); }
    } else if (card.type === 'mod') {
        player.roundHand.push(card);
    } else if (card.type === 'number') {
        // FIX: Only check duplicates against existing NUMBER cards
        let isDuplicate = card.val !== 0 && player.roundHand.some(c => c.type === 'number' && c.val === card.val);
        
        if (isDuplicate) {
            if (player.hasSecondChance) {
                await showNoticeModal("🛡️ SECOND CHANCE!", `${player.name} hit a duplicate ${card.val}. Shield saved them!`);
                player.hasSecondChance = false;
                player.roundHand = player.roundHand.filter(c => c.val !== 'CHANCE');
            } else {
                player.status = 'busted';
                player.roundHand.push(card);
            }
        } else {
            player.roundHand.push(card);
        }
    }

    const uniqueNums = new Set(player.roundHand.filter(c => c.type === 'number').map(c => c.val));
    if (uniqueNums.size === 7) { player.status = 'stayed'; bankScore(player); }
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

// --- 4. MODALS ---
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
        grid.innerHTML = `<p style="grid-column: span 2; color: white;">${message}</p>`;
        const btn = document.createElement('button');
        btn.innerText = "OK"; btn.className = "hit-btn";
        btn.style.gridColumn = "span 2";
        btn.onclick = () => { overlay.style.display = 'none'; resolve(); };
        grid.appendChild(btn);
    });
}

// --- 5. SCORING & ROUND END ---
function bankScore(p) {
    p.totalScore += getRoundTotal(p);
    // Logic for win check moved to resetRound()
}

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
        setTimeout(resetRound, 1500); 
        return; 
    }
    do { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; } 
    while (players[currentPlayerIndex].status !== 'active');
    renderUI();
}

function resetRound() {
    // WIN CHECK: See if anyone is over WIN_SCORE at the end of the round
    const winners = players.filter(p => p.totalScore >= WIN_SCORE);

    if (winners.length > 0) {
        // Find the highest score among those who passed the threshold
        winners.sort((a, b) => b.totalScore - a.totalScore);
        const topDog = winners[0];
        
        document.getElementById('winner-display-name').innerText = `${topDog.name} Wins!`;
        document.getElementById('win-screen').style.display = 'flex';
        return;
    }

    // Otherwise, clear and start next round
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
        // Hand Sorting: 0-12 first, then others
        const sortedHand = [...p.roundHand].sort((a,b) => {
            if (a.type === 'number' && b.type === 'number') return a.val - b.val;
            return (a.type === 'number') ? -1 : 1;
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
}

// --- CONTROLS ---
document.getElementById('hit-btn-main').onclick = handleHit;
document.getElementById('stay-btn-main').onclick = () => { 
    let p = players[currentPlayerIndex];
    p.status = 'stayed'; 
    bankScore(p); 
    nextTurn(); 
};

function toggleControls(enable) {
    document.getElementById('hit-btn-main').disabled = !enable;
    document.getElementById('stay-btn-main').disabled = !enable;
}
