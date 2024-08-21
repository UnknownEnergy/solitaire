const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let deck, waste, foundation, tableau;
let drawCount = 1, soundEnabled = true, handPreference = 'right';
let draggedCard = null;
let draggedCardElement = null;
let dragOffset = {x: 0, y: 0};
let isDragging = false;
let dragStartTime;
let originalPosition;
let movesCount = 0;
let timerInterval;
let elapsedTime = 0;
let cardBackColor = '#007bff'; // Default color
let backgroundColor = '#2c8f30'; // Default color

function initGame() {
    [deck, waste, foundation, tableau] = [[], [], [[], [], [], []], [[], [], [], [], [], [], []]];
    loadSettings();
    resetMovesCounter();
    resetTimer();
    createDeck();
    dealCards();
    updateDeckCounter();
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
    applyCardBackColor();
    applyBackgroundColor();
    checkWin() && displayWin();
}

function renderArea(area) {
    const element = document.getElementById(area);

    if (area === 'deck') {
        const cardElements = element.querySelectorAll('.card');
        cardElements.forEach(card => card.remove());

        if (deck.length > 0) {
            element.appendChild(renderCard(deck[deck.length - 1], false));
        }
    } else if (area === 'waste') {
        const wasteCards = element.querySelectorAll('.card');
        wasteCards.forEach(card => card.remove());

        if (waste.length > 0) {
            element.appendChild(renderCard(waste[waste.length - 1]));
        }
    } else if (area === 'foundation' || area === 'tableau') {
        const piles = area === 'foundation' ? foundation : tableau;
        element.innerHTML = '';

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
    document.getElementById('card-back-color').addEventListener('change', updateCardBackColor);
    document.getElementById('background-color').addEventListener('change', updateBackgroundColor);

}

function addDragAndDropListeners() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousedown', handleDragStart);
        card.addEventListener('touchstart', handleDragStart, {passive: true});
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
        updateDeckCounter();
        renderGame();
    }
    deck.length === 0 && showRedoButton();
}

function handleDragStart(e) {
    const cardElement = e.target.closest('.card');
    if (!cardElement || !cardElement.draggable) return;

    dragStartTime = Date.now();

    draggedCardElement = cardElement;
    draggedCard = {
        suit: cardElement.dataset.suit,
        value: cardElement.dataset.value
    };

    originalPosition = {
        x: cardElement.offsetLeft,
        y: cardElement.offsetTop
    };

    const rect = cardElement.getBoundingClientRect();
    dragOffset = {
        x: (e.clientX || e.touches[0].clientX) - rect.left,
        y: (e.clientY || e.touches[0].clientY) - rect.top
    };

    // We'll start the actual dragging in the move event
    isDragging = false;

    if (e.type === 'mousedown') {
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    } else if (e.type === 'touchstart') {
        document.addEventListener('touchmove', handleDragMove, {passive: false});
        document.addEventListener('touchend', handleDragEnd);
    }
}

function handleDragMove(e) {
    if (!draggedCardElement) return;

    if (!isDragging) {
        // Start dragging only if the mouse has moved a certain distance
        const moveThreshold = 5;
        const currentX = e.clientX || e.touches[0].clientX;
        const currentY = e.clientY || e.touches[0].clientY;
        const deltaX = Math.abs(currentX - (dragOffset.x + draggedCardElement.getBoundingClientRect().left));
        const deltaY = Math.abs(currentY - (dragOffset.y + draggedCardElement.getBoundingClientRect().top));

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            isDragging = true;
            draggedCardElement.style.position = 'fixed';
            draggedCardElement.style.zIndex = '1000';
        }
    }

    if (isDragging) {
        e.preventDefault(); // Prevent scrolling when dragging
        updateDragPosition(e);
    }
}

function handleDragEnd(e) {
    if (!draggedCardElement) return;

    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchend', handleDragEnd);

    const currentElement = draggedCardElement;

    if (isDragging) {
        const x = e.clientX || e.changedTouches[0].clientX;
        const y = e.clientY || e.changedTouches[0].clientY;
        const targetInfo = findTargetPile(x, y);

        let moveMade = false;

        if (targetInfo) {
            const bestMove = findBestMove(draggedCard);
            const sourceInfo = findCardSource(draggedCard);

            if (bestMove && bestMove.type === targetInfo.area && bestMove.index === targetInfo.index) {
                if (bestMove.type === 'foundation') {
                    moveToFoundation(draggedCard, bestMove.index);
                    moveMade = true;
                } else if (bestMove.type === 'tableau') {
                    let cardsToMove;
                    if (sourceInfo.area === 'tableau') {
                        cardsToMove = tableau[sourceInfo.index].slice(sourceInfo.cardIndex);
                    } else if (sourceInfo.area === 'waste') {
                        cardsToMove = [waste[waste.length - 1]];
                    } else {
                        cardsToMove = [draggedCard];
                    }
                    moveToTableau({
                        cards: cardsToMove,
                        sourceIndex: sourceInfo.area === 'tableau' ? sourceInfo.index : -1
                    }, bestMove.index);
                    moveMade = true;
                }
            }
        }

        if (!moveMade) {
            // Move the card back to its original position
            currentElement.style.transition = 'all 0.3s';
            currentElement.style.left = `${originalPosition.x}px`;
            currentElement.style.top = `${originalPosition.y}px`;
            setTimeout(() => {
                if (currentElement.parentNode) {  // Check if the element is still in the DOM
                    currentElement.style.transition = '';
                    currentElement.style.position = '';
                    currentElement.style.left = '';
                    currentElement.style.top = '';
                    currentElement.style.zIndex = '';
                }
            }, 300);
        } else {
            // Reset the dragged card's style immediately
            currentElement.style.position = '';
            currentElement.style.left = '';
            currentElement.style.top = '';
            currentElement.style.zIndex = '';
        }

        renderGame();
    } else {
        // It's a click, not a drag
        const dragDuration = Date.now() - dragStartTime;
        if (dragDuration < 200) { // Threshold for considering it a click
            handleCardClick(e);
        }
    }

    draggedCard = null;
    draggedCardElement = null;
    isDragging = false;
}

function findCardSource(card) {
    for (let i = 0; i < tableau.length; i++) {
        const cardIndex = tableau[i].findIndex(c => c.suit === card.suit && c.value === card.value);
        if (cardIndex !== -1) {
            return {area: 'tableau', index: i, cardIndex: cardIndex};
        }
    }
    const wasteIndex = waste.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (wasteIndex !== -1) {
        return {area: 'waste', index: wasteIndex};
    }
    for (let i = 0; i < foundation.length; i++) {
        const cardIndex = foundation[i].findIndex(c => c.suit === card.suit && c.value === card.value);
        if (cardIndex !== -1) {
            return {area: 'foundation', index: i, cardIndex: cardIndex};
        }
    }
    return null;
}

function findTargetPile(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (let element of elements) {
        // Check if the element itself is a pile
        if (element.classList.contains('pile')) {
            const areaElement = element.closest('#tableau, #foundation'); // Using IDs
            return {
                pile: element,
                area: areaElement ? areaElement.id : null, // Get the ID if found
                index: parseInt(element.dataset.index)
            };
        }
    }
    return null;
}

function updateDragPosition(e) {
    if (!draggedCardElement) return;

    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    draggedCardElement.style.left = `${clientX - dragOffset.x}px`;
    draggedCardElement.style.top = `${clientY - dragOffset.y}px`;
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
        incrementMovesCounter();
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
        incrementMovesCounter();
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
        incrementMovesCounter();
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
    incrementMovesCounter();
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
    updateDeckCounter();
    hideRedoButton();
    renderGame();
}

function checkWin() {
    return foundation.every(pile => pile.length === 13);
}

function displayWin() {
    clearInterval(timerInterval);
    const winMessage = document.createElement('div');
    winMessage.id = 'win-message';
    winMessage.textContent = 'Congratulations! You won!';
    document.body.appendChild(winMessage);

    const newGameButton = document.createElement('button');
    newGameButton.id = 'new-game-button';
    newGameButton.textContent = 'Start New Game';
    newGameButton.addEventListener('click', () => {
        document.body.removeChild(winMessage);
        document.body.removeChild(newGameButton);
        initGame();
    });
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
    const redoButton = document.querySelector('#redo-button');
    const deckCounter = document.querySelector('#deck-counter');
    [topArea, deckAndWaste, redoButton, deckCounter].forEach(el => {
        if (el) el.classList.toggle('right-handed', handPreference === 'right');
    });
}

function saveSettings() {
    localStorage.setItem('solitaireSettings', JSON.stringify({drawCount, soundEnabled, handPreference, cardBackColor, backgroundColor}));
}

function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('solitaireSettings'));
    if (savedSettings) {
        ({drawCount = 1, soundEnabled = true, handPreference = 'right', cardBackColor = '#007bff', backgroundColor = '#2c8f30'} = savedSettings);
        document.getElementById('draw-option').value = drawCount;
        document.getElementById('hand-preference').value = handPreference;
        document.getElementById('sound-toggle').checked = soundEnabled;
        document.getElementById('card-back-color').value = cardBackColor;
        document.getElementById('background-color').value = backgroundColor;
        applyHandPreference();
        applyCardBackColor();
        applyBackgroundColor();
    }
}

function updateSoundSetting(e) {
    soundEnabled = e.target.checked;
    saveSettings();
}

function resetMovesCounter() {
    movesCount = 0;
    updateMovesDisplay();
}

function incrementMovesCounter() {
    movesCount++;
    updateMovesDisplay();
}

function updateMovesDisplay() {
    document.getElementById('moves-counter').textContent = `Moves: ${movesCount}`;
}

function resetTimer() {
    clearInterval(timerInterval);
    elapsedTime = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        elapsedTime++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    document.getElementById('timer').textContent = `Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function updateDeckCounter() {
    document.getElementById('deck-counter').textContent = deck.length;
}

function updateCardBackColor(e) {
    cardBackColor = e.target.value;
    applyCardBackColor();
    saveSettings();
}

function applyCardBackColor() {
    const cardBacks = document.querySelectorAll('.card.back');

    cardBacks.forEach(card => {
        // Set the background color and gradient based on the selected color
        const darkerColor = darkenColor(cardBackColor, 25); // Function to darken the color
        card.style.background = `
            ${cardBackColor} linear-gradient(135deg, ${cardBackColor} 25%, ${darkerColor} 25%, ${darkerColor} 50%, ${cardBackColor} 50%, ${cardBackColor} 75%, ${darkerColor} 75%, ${darkerColor} 100%)
        `;
        card.style.backgroundSize = '20px 20px';
        card.style.color = 'transparent';
        card.style.border = `2px solid ${darkerColor}`;
    });
}

// Function to darken a hex color by a percentage
function darkenColor(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Adjust the RGB values
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));

    // Convert back to hex
    const toHex = (c) => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applyBackgroundColor() {
    const darkerColor = darkenColor(backgroundColor, 10); // Darken the background color slightly
    document.body.style.backgroundColor = backgroundColor;
    document.body.style.backgroundImage = `
        linear-gradient(90deg, ${backgroundColor} 25%, ${darkerColor} 25%, 
        ${darkerColor} 50%, ${backgroundColor} 50%, 
        ${backgroundColor} 75%, ${darkerColor} 75%, 
        ${darkerColor} 100%)
    `;
    document.body.style.backgroundSize = '40px 40px';
}

function updateBackgroundColor(e) {
    backgroundColor = e.target.value;
    applyBackgroundColor();
    saveSettings();
}

initGame();