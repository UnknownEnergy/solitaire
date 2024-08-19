const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let deck, waste, foundation, tableau;
let drawCount = 1, soundEnabled = true, handPreference = 'right';

function initGame() {
    [deck, waste, foundation, tableau] = [[], [], [[], [], [], []], [[], [], [], [], [], [], []]];
    loadSettings();
    createDeck();
    dealCards();
    renderGame();
    addEventListeners();
}

function createDeck() {
    deck = suits.flatMap(suit => values.map(value => ({suit, value, faceUp: false})));
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function dealCards() {
    for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
            tableau[j].push(deck.pop());
        }
        tableau[i][tableau[i].length - 1].faceUp = true;
    }
}

function renderGame() {
    ['deck', 'waste', 'foundation', 'tableau'].forEach(renderArea);
    addDragAndDropListeners();
    deck.length === 0 && waste.length > 0 ? showRedoButton() : hideRedoButton();
    checkWin() && displayWin();
}

function renderArea(area) {
    const element = document.getElementById(area);
    element.innerHTML = '';
    if (area === 'deck') {
        deck.length > 0 && element.appendChild(renderCard(deck[deck.length - 1], false));
    } else if (area === 'waste') {
        waste.length > 0 && element.appendChild(renderCard(waste[waste.length - 1]));
    } else if (area === 'foundation' || area === 'tableau') {
        const piles = area === 'foundation' ? foundation : tableau;
        piles.forEach((pile, i) => {
            const pileElement = document.createElement('div');
            pileElement.classList.add('pile', `${area}-pile`);
            pileElement.dataset.index = i;
            pile.forEach((card, j) => {
                const cardElement = renderCard(card, card.faceUp);
                if (area === 'tableau') {
                    cardElement.style.top = `${j * 20}px`;
                } else {
                    // For foundation, don't add vertical offset
                    cardElement.style.top = '0';
                }
                pileElement.appendChild(cardElement);
            });
            element.appendChild(pileElement);
        });
    }
}

function renderCard(card, faceUp = true) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card', faceUp ? (card.suit === '♥' || card.suit === '♦' ? 'red' : 'black') : 'back');
    cardElement.draggable = faceUp;
    cardElement.dataset.suit = card.suit;
    cardElement.dataset.value = card.value;
    if (faceUp) {
        cardElement.innerHTML = `
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
            <span class="card-symbol">${card.suit}</span>
        `;
    }
    return cardElement;
}

function addEventListeners() {
    document.getElementById('deck').addEventListener('click', drawCard);
    document.getElementById('redo-button').addEventListener('click', redoDeck);
    document.getElementById('settings-button').addEventListener('click', toggleSettingsMenu);
    document.getElementById('draw-option').addEventListener('change', updateDrawOption);
    document.getElementById('sound-toggle').addEventListener('change', updateSoundSetting);
    document.getElementById('hand-preference').addEventListener('change', updateHandPreference);
}

function addDragAndDropListeners() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', handleCardClick);
    });
    document.getElementById('waste').addEventListener('click', handleWasteCardClick);
    document.getElementById('foundation').addEventListener('click', handleFoundationCardClick);
}

function drawCard() {
    if (deck.length > 0) {
        const cardsToMove = Math.min(drawCount, deck.length);
        for (let i = 0; i < cardsToMove; i++) {
            const card = deck.pop();
            card.faceUp = true;
            waste.push(card);
            i === cardsToMove - 1 && flipCard(renderCard(card));
        }
        renderGame();
    }
    deck.length === 0 && showRedoButton();
}

function handleCardClick(e) {
    e.preventDefault();
    const cardElement = e.target.closest('.card');
    if (!cardElement) return;

    const pile = cardElement.closest('.pile');
    if (pile) {
        if (pile.classList.contains('tableau-pile')) {
            handleTableauCardClick(cardElement, pile);
        } else if (pile.id === 'waste') {
            handleWasteCardClick();
        } else if (pile.classList.contains('foundation-pile')) {
            handleFoundationCardClick(e);
        }
    }
}

function handleTableauCardClick(cardElement, pile) {
    const sourceIndex = parseInt(pile.dataset.index);
    const allCards = Array.from(pile.querySelectorAll('.card'));
    const clickedCardIndex = allCards.indexOf(cardElement);

    if (clickedCardIndex === -1 || !tableau[sourceIndex][clickedCardIndex].faceUp) return;

    const cardsToMove = tableau[sourceIndex].slice(clickedCardIndex);

    if (cardsToMove.length > 0) {
        const bestMove = findBestMove(cardsToMove[0]);
        if (bestMove) {
            if (bestMove.type === 'foundation' && cardsToMove.length === 1) {
                moveToFoundation(cardsToMove[0], bestMove.index);
            } else if (bestMove.type === 'tableau') {
                moveToTableau({cards: cardsToMove, sourceIndex}, bestMove.index);
            }
        }
    }
}

function handleWasteCardClick() {
    if (waste.length > 0) {
        const wasteCard = waste[waste.length - 1];
        const bestMove = findBestMove(wasteCard);
        if (bestMove) {
            if (bestMove.type === 'foundation') {
                moveToFoundation(wasteCard, bestMove.index);
            } else if (bestMove.type === 'tableau') {
                moveToTableau({cards: [wasteCard], sourceIndex: -1}, bestMove.index);
            }
        }
    }
}

function handleFoundationCardClick(e) {
    const cardElement = e.target.closest('.card');
    if (!cardElement) return;

    const pile = cardElement.closest('.pile');
    if (pile && pile.classList.contains('foundation-pile')) {
        const foundationIndex = parseInt(pile.dataset.index);
        const foundationPile = foundation[foundationIndex];
        if (foundationPile.length > 0) {
            const foundationCard = foundationPile[foundationPile.length - 1];
            const bestMove = findBestTableauMove(foundationCard);
            if (bestMove) {
                moveFromFoundationToTableau(foundationCard, foundationIndex, bestMove.index);
            }
        }
    }
}

function findBestTableauMove(card) {
    for (let i = 0; i < 7; i++) {
        if (isValidTableauMove(card, i)) return {type: 'tableau', index: i};
    }
    return null;
}

function moveFromFoundationToTableau(card, foundationIndex, tableauIndex) {
    if (isValidTableauMove(card, tableauIndex)) {
        foundation[foundationIndex].pop();
        tableau[tableauIndex].push(card);
        playSound('card-place-sound');
        renderGame();
    }
}

function moveToFoundation(card, foundationIndex) {
    if (isValidFoundationMove(card, foundationIndex)) {
        const sourceIndex = removeCardFromSource(card);
        foundation[foundationIndex].push(card);
        // Flip the card underneath if it exists and is face-down
        if (sourceIndex >= 0 && tableau[sourceIndex].length > 0 && !tableau[sourceIndex][tableau[sourceIndex].length - 1].faceUp) {
            tableau[sourceIndex][tableau[sourceIndex].length - 1].faceUp = true;
        }
        playSound('card-place-sound');
        renderGame();
    }
}

function moveToTableau(cardData, tableauIndex) {
    const sourceCards = cardData.sourceIndex >= 0 ? cardData.cards : cardData.cards.map(findCard);
    const sourceIndex = cardData.sourceIndex;

    if (sourceCards.length > 0 && isValidTableauMove(sourceCards[0], tableauIndex)) {
        if (sourceIndex >= 0) {
            tableau[sourceIndex].splice(tableau[sourceIndex].indexOf(sourceCards[0]));
            // Flip the card underneath if it exists and is face-down
            if (tableau[sourceIndex].length > 0 && !tableau[sourceIndex][tableau[sourceIndex].length - 1].faceUp) {
                tableau[sourceIndex][tableau[sourceIndex].length - 1].faceUp = true;
            }
        } else {
            // Remove card from waste
            waste.pop();
        }
        tableau[tableauIndex].push(...sourceCards);
        playSound('card-place-sound');
        renderGame();
    }
}

function removeCardFromSource(card) {
    for (let i = 0; i < tableau.length; i++) {
        const index = tableau[i].findIndex(c => c.suit === card.suit && c.value === card.value);
        if (index !== -1) {
            tableau[i].splice(index, 1);
            return i;
        }
    }
    const wasteIndex = waste.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (wasteIndex !== -1) {
        waste.splice(wasteIndex, 1);
    }
    return -1;
}

function findCard(cardData) {
    for (let pile of [...tableau, waste]) {
        const card = pile.find(c => c.suit === cardData.suit && c.value === cardData.value);
        if (card) return card;
    }
    return null;
}

function isValidFoundationMove(card, foundationIndex) {
    const foundationPile = foundation[foundationIndex];
    return foundationPile.length === 0 ? card.value === 'A' :
        card.suit === foundationPile[foundationPile.length - 1].suit &&
        values.indexOf(card.value) === values.indexOf(foundationPile[foundationPile.length - 1].value) + 1;
}

function isValidTableauMove(card, tableauIndex) {
    const tableauPile = tableau[tableauIndex];
    if (tableauPile.length === 0) {
        return card.value === 'K';
    } else {
        const topCard = tableauPile[tableauPile.length - 1];
        return (card.suit === '♠' || card.suit === '♣') !== (topCard.suit === '♠' || topCard.suit === '♣') &&
            values.indexOf(card.value) === values.indexOf(topCard.value) - 1;
    }
}

function findBestMove(card) {
    for (let i = 0; i < 4; i++) {
        if (isValidFoundationMove(card, i)) return {type: 'foundation', index: i};
    }
    for (let i = 0; i < 7; i++) {
        if (isValidTableauMove(card, i)) return {type: 'tableau', index: i};
    }
    return null;
}

function flipCard(cardElement) {
    cardElement.classList.add('flip');
    playSound('card-flip-sound');
    setTimeout(() => cardElement.classList.remove('flip'), 300);
}

function playSound(soundId) {
    if (soundEnabled) {
        const sound = document.getElementById(soundId);
        sound.currentTime = 0;
        sound.play();
    }
}

function showRedoButton() {
    document.getElementById('redo-button').style.display = 'flex';
}

function hideRedoButton() {
    document.getElementById('redo-button').style.display = 'none';
}

function redoDeck() {
    deck = waste.reverse();
    waste = [];
    deck.forEach(card => card.faceUp = false);
    hideRedoButton();
    renderGame();
}

function checkWin() {
    return foundation.every(pile => pile.length === 13);
}

function displayWin() {
    const winMessage = document.createElement('div');
    winMessage.id = 'win-message';
    winMessage.textContent = 'Congratulations! You won!';
    document.body.appendChild(winMessage);

    const newGameButton = document.createElement('button');
    newGameButton.id = 'new-game-button';
    newGameButton.textContent = 'Start New Game';
    newGameButton.addEventListener('click', initGame);
    document.body.appendChild(newGameButton);
}

function toggleSettingsMenu() {
    document.getElementById('settings-menu').classList.toggle('hidden');
}

function updateDrawOption(e) {
    drawCount = parseInt(e.target.value);
    saveSettings();
}

function updateHandPreference(e) {
    handPreference = e.target.value;
    applyHandPreference();
    saveSettings();
}

function applyHandPreference() {
    const topArea = document.querySelector('.top-area');
    const deckAndWaste = document.querySelector('.deck-and-waste');
    [topArea, deckAndWaste].forEach(el => {
        if (el) el.classList.toggle('right-handed', handPreference === 'right');
    });
}

function saveSettings() {
    localStorage.setItem('solitaireSettings', JSON.stringify({drawCount, soundEnabled, handPreference}));
}

function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('solitaireSettings'));
    if (savedSettings) {
        ({drawCount = 1, soundEnabled = true, handPreference = 'right'} = savedSettings);
        document.getElementById('draw-option').value = drawCount;
        document.getElementById('hand-preference').value = handPreference;
        document.getElementById('sound-toggle').checked = soundEnabled;
        applyHandPreference();
    }
}

function updateSoundSetting(e) {
    soundEnabled = e.target.checked;
    saveSettings();
}

initGame();