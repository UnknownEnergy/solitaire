const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let deck = [];
let waste = [];
let foundation = [[], [], [], []];
let tableau = [[], [], [], [], [], [], []];

function createDeck() {
    for (let suit of suits) {
        for (let value of values) {
            deck.push({suit, value, faceUp: false});
        }
    }
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
    }
}

function renderCard(card, faceUp = true) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    cardElement.draggable = faceUp;
    cardElement.dataset.suit = card.suit;
    cardElement.dataset.value = card.value;
    if (faceUp) {
        cardElement.innerHTML = `
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
            <span class="card-symbol">${card.suit}</span>
        `;
        cardElement.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    } else {
        cardElement.textContent = '🂠';
    }
    return cardElement;
}


function renderGame() {
    const deckElement = document.getElementById('deck');
    const wasteElement = document.getElementById('waste');
    const foundationElement = document.getElementById('foundation');
    const tableauElement = document.getElementById('tableau');

    deckElement.innerHTML = '';
    wasteElement.innerHTML = '';
    foundationElement.innerHTML = '';
    tableauElement.innerHTML = '';

    // Render deck
    if (deck.length > 0) {
        deckElement.appendChild(renderCard(deck[deck.length - 1], false));
    }

    // Render waste
    if (waste.length > 0) {
        wasteElement.appendChild(renderCard(waste[waste.length - 1]));
    }

    // Render foundation
    for (let i = 0; i < 4; i++) {
        const pile = document.createElement('div');
        pile.classList.add('pile', 'foundation-pile');
        pile.dataset.index = i;
        if (foundation[i].length > 0) {
            pile.appendChild(renderCard(foundation[i][foundation[i].length - 1]));
        }
        foundationElement.appendChild(pile);
    }

    // Render tableau
    for (let i = 0; i < 7; i++) {
        const pile = document.createElement('div');
        pile.classList.add('pile', 'tableau-pile');
        pile.dataset.index = i;
        for (let j = 0; j < tableau[i].length; j++) {
            const card = tableau[i][j];
            const faceUp = j === tableau[i].length - 1 || card.faceUp;
            const cardElement = renderCard(card, faceUp);
            cardElement.style.top = `${j * 20}px`; // Stack cards with 20px offset
            pile.appendChild(cardElement);
            if (faceUp) {
                card.faceUp = true; // Mark the card as face up for future renders
            }
        }
        tableauElement.appendChild(pile);
    }

    addDragAndDropListeners();

    if (deck.length === 0 && waste.length > 0) {
        showRedoButton();
    } else {
        hideRedoButton();
    }

    if (checkWin()) {
        displayWin();
    }
}

function addDragAndDropListeners() {
    const cards = document.querySelectorAll('.card');
    const piles = document.querySelectorAll('.pile');
    const deckElement = document.getElementById('deck');
    const wasteElement = document.getElementById('waste');

    cards.forEach(card => {
        card.addEventListener('click', handleCardClick);
        deckElement.addEventListener('touchend', handleCardClick);
    });

    deckElement.addEventListener('click', handleDeckClick);
    deckElement.addEventListener('touchend', handleDeckClick);

    wasteElement.addEventListener('click', handleWasteClick);
    wasteElement.addEventListener('touchend', handleWasteClick);
}

function handleDeckClick(e) {
    e.preventDefault();
    drawCard();
}

function handleWasteClick(e) {
    e.preventDefault();
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

function moveToFoundation(cardData, foundationIndex) {
    const sourceCard = findCard(cardData);
    if (sourceCard && isValidFoundationMove(sourceCard, foundationIndex)) {
        removeCardFromSource(sourceCard);
        foundation[foundationIndex].push(sourceCard);
        playSound('card-place-sound');
        renderGame();
    }
}

function moveToTableau(cardData, tableauIndex) {
    const sourceCards = cardData.cards.map(findCard);
    const sourceIndex = parseInt(cardData.sourceIndex);

    if (sourceCards.length > 0 && isValidTableauMove(sourceCards[0], tableauIndex)) {
        // Remove cards from the source
        if (sourceIndex >= 0) {
            // Remove cards from tableau
            const startIndex = tableau[sourceIndex].indexOf(sourceCards[0]);
            if (startIndex !== -1) {
                tableau[sourceIndex].splice(startIndex);
            }
        } else {
            // Remove card from waste
            const wasteIndex = waste.findIndex(c => c.suit === sourceCards[0].suit && c.value === sourceCards[0].value);
            if (wasteIndex !== -1) {
                waste.splice(wasteIndex, 1);
            }
        }

        // Add cards to the target tableau pile
        tableau[tableauIndex].push(...sourceCards);
        playSound('card-place-sound');
        renderGame();
    }
}

function removeCardFromSource(card) {
    // Check tableau
    for (let i = 0; i < 7; i++) {
        const index = tableau[i].findIndex(c => c.suit === card.suit && c.value === card.value);
        if (index !== -1) {
            tableau[i].splice(index, 1);
            return;
        }
    }
    // Check waste
    const wasteIndex = waste.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (wasteIndex !== -1) {
        waste.splice(wasteIndex, 1);
    }
}

function findCard(cardData) {
    // Check tableau
    for (let i = 0; i < 7; i++) {
        const card = tableau[i].find(c => c.suit === cardData.suit && c.value === cardData.value);
        if (card) return card;
    }
    // Check waste
    const wasteCard = waste.find(c => c.suit === cardData.suit && c.value === cardData.value);
    if (wasteCard) return wasteCard;

    // If not found, return null or throw an error
    return null;
}

function isValidFoundationMove(card, foundationIndex) {
    const foundationPile = foundation[foundationIndex];
    if (foundationPile.length === 0) {
        return card.value === 'A';
    }
    const topCard = foundationPile[foundationPile.length - 1];
    return card.suit === topCard.suit && values.indexOf(card.value) === values.indexOf(topCard.value) + 1;
}

function isValidTableauMove(card, tableauIndex) {
    const tableauPile = tableau[tableauIndex];
    if (tableauPile.length === 0) {
        return card.value === 'K';
    }
    const topCard = tableauPile[tableauPile.length - 1];
    return (card.suit === '♠' || card.suit === '♣') !== (topCard.suit === '♠' || topCard.suit === '♣') &&
        values.indexOf(card.value) === values.indexOf(topCard.value) - 1;
}

function drawCard() {
    if (deck.length > 0) {
        const cardsToMove = Math.min(drawCount, deck.length);
        for (let i = 0; i < cardsToMove; i++) {
            const card = deck.pop();
            card.faceUp = true;
            waste.push(card);
            if (i === cardsToMove - 1) {
                flipCard(renderCard(card));
            }
        }
        renderGame();
    }

    if (deck.length === 0) {
        showRedoButton();
    }
}

function flipCard(cardElement) {
    cardElement.classList.add('flip');
    playSound('card-flip-sound');
    setTimeout(() => {
        cardElement.classList.remove('flip');
    }, 300);
}

function playSound(soundId) {
    if (soundEnabled) {
        const sound = document.getElementById(soundId);
        sound.currentTime = 0;
        sound.play();
    }
}

function showRedoButton() {
    const redoButton = document.getElementById('redo-button');
    redoButton.style.display = 'flex';
}

function hideRedoButton() {
    const redoButton = document.getElementById('redo-button');
    redoButton.style.display = 'none';
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

function findBestMove(card) {
    // Check foundation first
    for (let i = 0; i < 4; i++) {
        if (isValidFoundationMove(card, i)) {
            return {type: 'foundation', index: i};
        }
    }

    // Check tableau
    for (let i = 0; i < 7; i++) {
        if (isValidTableauMove(card, i)) {
            return {type: 'tableau', index: i};
        }
    }

    return null;
}

function handleCardClick(e) {
    e.preventDefault();
    const cardElement = e.target.closest('.card');
    if (!cardElement) return;

    const pile = cardElement.closest('.pile');

    if (pile && pile.classList.contains('tableau-pile')) {
        const sourceIndex = parseInt(pile.dataset.index);
        const allCards = Array.from(pile.querySelectorAll('.card'));
        const clickedCardIndex = allCards.indexOf(cardElement);

        // Check if the clicked card is face-up
        if (!tableau[sourceIndex][clickedCardIndex].faceUp) {
            return; // Exit the function if the card is face-down
        }

        const cardsToMove = tableau[sourceIndex].slice(clickedCardIndex);

        if (cardsToMove.length > 0) {
            const bestMove = findBestMove(cardsToMove[0]);
            if (bestMove) {
                if (bestMove.type === 'foundation' && cardsToMove.length === 1) {
                    moveToFoundation(cardsToMove[0], bestMove.index);
                } else if (bestMove.type === 'tableau') {
                    moveToTableau({cards: cardsToMove, sourceIndex: sourceIndex}, bestMove.index);
                }
            }
        }
    }
}

function toggleSettingsMenu() {
    settingsMenu.classList.toggle('hidden');
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

    if (topArea) {
        if (handPreference === 'right') {
            topArea.classList.add('right-handed');
        } else {
            topArea.classList.remove('right-handed');
        }
    }

    if (deckAndWaste) {
        if (handPreference === 'right') {
            deckAndWaste.classList.add('right-handed');
        } else {
            deckAndWaste.classList.remove('right-handed');
        }
    }
}

function saveSettings() {
    const settings = {
        drawCount: drawCount,
        soundEnabled: soundEnabled,
        handPreference: handPreference
    };
    localStorage.setItem('solitaireSettings', JSON.stringify(settings));
}

let drawCount = 1;
let soundEnabled = true;
let handPreference = 'right';

const settingsButton = document.getElementById('settings-button');
const settingsMenu = document.getElementById('settings-menu');
const drawOption = document.getElementById('draw-option');

const soundToggle = document.getElementById('sound-toggle');

soundToggle.addEventListener('change', updateSoundSetting);

loadSettings();

function loadSettings() {
    const savedSettings = localStorage.getItem('solitaireSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        drawCount = settings.drawCount || 1;
        soundEnabled = settings.soundEnabled !== undefined ? settings.soundEnabled : true;
        handPreference = settings.handPreference || 'right';

        // Update UI
        const drawOptionSelect = document.getElementById('draw-option');
        if (drawOptionSelect) {
            drawOptionSelect.value = drawCount;
        }
        const handPreferenceSelect = document.getElementById('hand-preference');
        if (handPreferenceSelect) {
            handPreferenceSelect.value = handPreference;
        }
        soundToggle.checked = soundEnabled;
        applyHandPreference();
    }
}


function updateSoundSetting(e) {
    soundEnabled = e.target.checked;
    saveSettings();
}

function initGame() {
    deck = [];
    waste = [];
    foundation = [[], [], [], []];
    tableau = [[], [], [], [], [], [], []];

    const winMessage = document.getElementById('win-message');
    if (winMessage) winMessage.remove();

    const newGameButton = document.getElementById('new-game-button');
    if (newGameButton) newGameButton.remove();

    loadSettings();

    settingsButton.addEventListener('click', toggleSettingsMenu);
    drawOption.addEventListener('change', updateDrawOption);
    soundToggle.addEventListener('change', updateSoundSetting);
    document.getElementById('hand-preference').addEventListener('change', updateHandPreference);

    createDeck();
    dealCards();
    renderGame();
    hideRedoButton();

    soundToggle.checked = soundEnabled;
    applyHandPreference();
}

initGame();

// Add click event listener for drawing cards
document.getElementById('deck').addEventListener('click', drawCard);

// Add click event listener for redo button
document.getElementById('redo-button').addEventListener('click', redoDeck);
