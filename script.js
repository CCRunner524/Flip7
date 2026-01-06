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

// --- POPUPS ---
function showNoticeModal(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        document.getElementById('modal-title-text').innerText = title;
        const grid = document.getElementById('target-buttons-grid');
        grid.innerHTML = `<p style="grid-column: span 3; color:white; font-size:1.1rem; margin:15px 0;">${message}</p>`;
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
                const b = document.createElement('button'); b.innerText = p.name; b.className = 'hit-btn';
                b.onclick = () => { overlay.style.display = 'none'; resolve(p); };
                grid.appendChild(b);
            }
