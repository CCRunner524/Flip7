/** * FLIP 7 - FULL CHAINING VERSION
 * Updated with Fisher-Yates Shuffle for true randomization.
 */

let deck = [];
let players = [];
let currentPlayerIndex = 0;
const WIN_SCORE = 200;

// --- DECK INITIALIZATION & SHUFFLE ---
function createDeck() {
    let d = [];
    // Build Number Cards
    for (let n = 0; n <= 12; n++) {
        let count = (n === 0 || n === 1) ? 1 : n;
        for (let i = 0; i < count; i++) d.push({ type: 'number', val: n, label: n.toString() });
    }
    // Build Action Cards
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FREEZE', label: 'FRZ' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'FLIP 3', label: 'FL3' });
    for (let i = 0; i < 3; i++) d.push({ type: 'action', val: 'CHANCE', label: '2nd' });
    
    // Build Modifiers
    [2, 4, 6, 8, 10].forEach(v => d.push({ type: 'mod', val: v, mode: 'add', label: '+' + v }));
    d.push({ type: 'mod', val: 2, mode: 'mult', label: 'x2' });

    // FISHER-YATES SHUFFLE
    // This loops through the array backwards, swapping each element with a random one before it.
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    
    return d;
}

// --- SETUP ---
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

if (countInput) {
    countInput.addEventListener('change', refreshInputs);
    refreshInputs();
}

document.getElementById('start-game-btn').onclick = () => {
    const fields = document.querySelectorAll('.player-name-field');
    players = Array.from(fields).map(f => ({
        name: f.value || f.placeholder, 
        totalScore: 0, 
        roundHand: [],
        status: 'active', 
        hasSecondChance: false
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
        log("Reshuffling new deck...");
        deck = createDeck();
    }
    
    let card = deck.pop();
    await processCard(players[currentPlayerIndex], card);
    
    nextTurn();
    toggleControls(true);
}

async function processCard(player, card) {
    if (player.status !== 'active') return;

    // A: Action Cards requiring targeting (Freeze / Flip 3)
    if (card.val === 'FREEZE' || card.val === 'FLIP 3') {
        const target = await openTargetModal(card);
        target.roundHand.push
