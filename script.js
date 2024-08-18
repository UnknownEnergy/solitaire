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
    cardElement.draggable = true;
    cardElement.dataset.suit = card.suit;
    cardElement.dataset.value = card.value;
    if (faceUp) {
        cardElement.innerHTML = `
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
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

function getCardData(cardElement) {
    const pile = cardElement.closest('.pile');
    let cards;
    if (pile) {
        cards = getMovableCards(pile, cardElement);
    } else {
        // Single card from waste
        cards = [{suit: cardElement.dataset.suit, value: cardElement.dataset.value}];
    }
    return {
        cards: cards.map(card => ({suit: card.suit || card.dataset.suit, value: card.value || card.dataset.value})),
        sourceIndex: pile ? pile.dataset.index : -1
    };
}

function addDragAndDropListeners() {
    const cards = document.querySelectorAll('.card');
    const piles = document.querySelectorAll('.pile');
    const deckElement = document.getElementById('deck');
    const wasteElement = document.getElementById('waste');

    cards.forEach(card => {
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('touchstart', touchStart, {passive: false});
        card.addEventListener('click', handleCardClick);
    });

    piles.forEach(pile => {
        pile.addEventListener('dragover', dragOver);
        pile.addEventListener('drop', drop);
    });

    deckElement.addEventListener('click', handleDeckClick);
    deckElement.addEventListener('touchend', handleDeckClick);

    wasteElement.addEventListener('click', handleWasteClick);
    wasteElement.addEventListener('touchend', handleWasteClick);

    document.addEventListener('touchmove', touchMove, {passive: false});
    document.addEventListener('touchend', touchEnd);
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


function touchStart(e) {
    e.preventDefault();
    const cardElement = e.target.closest('.card');
    if (cardElement) {
        cardElement.classList.add('dragging');
        cardElement.dataset.touchStartX = e.touches[0].clientX;
        cardElement.dataset.touchStartY = e.touches[0].clientY;
    }
}

function touchMove(e) {
    e.preventDefault();
    const cardElement = document.querySelector('.card.dragging');
    if (cardElement) {
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - cardElement.dataset.touchStartX;
        const deltaY = touchY - cardElement.dataset.touchStartY;

        cardElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
}

function touchEnd(e) {
    e.preventDefault();
    const cardElement = document.querySelector('.card.dragging');
    if (cardElement) {
        cardElement.style.transform = '';
        cardElement.classList.remove('dragging');

        const touch = e.changedTouches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetPile = targetElement.closest('.pile');

        if (targetPile) {
            const cardData = getCardData(cardElement);

            if (targetPile.classList.contains('foundation-pile')) {
                moveToFoundation(cardData.cards[0], parseInt(targetPile.dataset.index));
            } else if (targetPile.classList.contains('tableau-pile')) {
                moveToTableau(cardData, parseInt(targetPile.dataset.index));
            }
        }
    }
}


function dragStart(e) {
    const cardElement = e.target.closest('.card');
    if (cardElement) {
        const cardData = getCardData(cardElement);
        e.dataTransfer.setData('text/plain', JSON.stringify(cardData));
    }
}

function dragOver(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const targetPile = e.target.closest('.pile');
    if (!targetPile) return;

    try {
        const cardData = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (targetPile.classList.contains('foundation-pile')) {
            moveToFoundation(cardData.cards[0], parseInt(targetPile.dataset.index));
        } else if (targetPile.classList.contains('tableau-pile')) {
            moveToTableau(cardData, parseInt(targetPile.dataset.index));
        }
    } catch (error) {
        console.error("Error parsing drag data:", error);
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

function getMovableCards(pile, startCard) {
    const cards = Array.from(pile.querySelectorAll('.card'));
    const startIndex = cards.indexOf(startCard);
    return cards.slice(startIndex);
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
        const card = deck.pop();
        waste.push(card);
        flipCard(renderCard(card));
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
    const sound = document.getElementById(soundId);
    sound.currentTime = 0;
    sound.play();
}

function showRedoButton() {
    const redoButton = document.getElementById('redo-button');
    redoButton.style.display = 'inline-block';
}

function hideRedoButton() {
    const redoButton = document.getElementById('redo-button');
    redoButton.style.display = 'none';
}

function redoDeck() {
    deck = waste.reverse();
    waste = [];
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


function initGame() {
    deck = [];
    waste = [];
    foundation = [[], [], [], []];
    tableau = [[], [], [], [], [], [], []];

    const winMessage = document.getElementById('win-message');
    if (winMessage) winMessage.remove();

    const newGameButton = document.getElementById('new-game-button');
    if (newGameButton) newGameButton.remove();

    createDeck();
    dealCards();
    renderGame();
    hideRedoButton();
}

initGame();

// Add click event listener for drawing cards
document.getElementById('deck').addEventListener('click', drawCard);

// Add click event listener for redo button
document.getElementById('redo-button').addEventListener('click', redoDeck);
