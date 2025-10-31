const world = document.getElementById('world');
const coords = document.getElementById('coords');
const statusDiv = document.getElementById('status');
const statusImageDiv = document.getElementById('status-image');
const characterOptionsIcon = document.getElementById('character-options-icon');
const characterNameSpan = document.getElementById('character-name');
const characterPanel = document.getElementById('character-panel');
const characterNameInput = document.getElementById('character-name-input');
const saveCharacterButton = document.getElementById('save-character-button');

const strValue = document.getElementById('str-value');
const spdValue = document.getElementById('spd-value');
const intValue = document.getElementById('int-value');
const pointsValue = document.getElementById('points-value');

const strUp = document.getElementById('str-up');
const strDown = document.getElementById('str-down');
const spdUp = document.getElementById('spd-up');
const spdDown = document.getElementById('spd-down');
const intUp = document.getElementById('int-up');
const intDown = document.getElementById('int-down');

const totalPoints = 21;
let characterAttributes = {
    strength: 7,
    speed: 7,
    intelligence: 7
};

const randomNames = ['Arion', 'Elora', 'Kael', 'Seraphina', 'Thorne'];

function getRandomName() {
    return randomNames[Math.floor(Math.random() * randomNames.length)];
}

let characterName = getRandomName();

let viewSize = {
    width: 0,
    height: 0,
};

let startTime = Date.now();
let worldData = new Map(); // y -> Map(x -> char)
let worldOffset = { x: 0, y: 0 };
let loadedPlayerLocation = null;

// Define zoom levels
const zoomLevels = [
    { fontSize: 38, tileSize: 48 }, // Max Zoom
    { fontSize: 28, tileSize: 36 }, // Mid Zoom (Default)
    { fontSize: 18, tileSize: 24 }  // Min Zoom
];
let currentZoomLevelIndex = 1; // Start zoom (0:max, 1:mid, 2:min)

function getRandomChar() {
    const chars = Object.keys(charData);
    const weights = chars.map(char => parseFloat(charData[char].chance));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < chars.length; i++) {
        if (random < weights[i]) {
            return chars[i];
        }
        random -= weights[i];
    }
    
    // Fallback
    return chars[chars.length - 1];
}

const charData = {
    'v': { color: 'wheat', description: 'Crops', chance: '2', image: 'crops.jpg' },
    't': { color: 'brown', description: 'Trees', chance: '28', image: 'trees.jpg' },
    '~': { color: '#0066cc', description: 'Water', chance: '0.3', image: 'lake.jpg', rule: 'cluster' },
    'M': { color: 'grey', description: 'Mountains', chance: '0.2' , image: 'mountains.jpg', rule: 'cluster' }, //8
    'm': { color: 'green', description: 'Hills', chance: '2', image: 'hills.jpg' },
    '·': { color: 'seagreen', description: 'Grass', chance: '65', image: 'grass.jpg' },
    'Ħ': { color: 'white', description: 'Temple', chance: '0.01', image: 'temple.jpg' }
};

// --- Day/Night Cycle Configuration ---
const cycleConfig = {
    dayDurationMinutes: 90,    // 2 hours = 120
    nightDurationMinutes: 45,  // 1 hour = 60
    dayColor: '#8FBC8F',       // A medium green for daytime
    nightColor: '#202020'      // A dark grey for nighttime
};
// --- End Day/Night Cycle Configuration ---

/**
 * Injects CSS rules into the document head to control the day/night background colors.
 * This allows the colors to be configured in the cycleConfig object.
 */
function applyCycleStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #world.day {
            background-color: ${cycleConfig.dayColor};
        }
        #world.night {
            background-color: ${cycleConfig.nightColor};
        }
    `;
    document.head.appendChild(style);
}

/**
 * Calculates the current phase of the day/night cycle and applies the correct CSS class.
 * Uses the modulo operator on the current timestamp to create a repeating cycle.
 */
function updateDayNightCycle(startTime) {
    const totalCycleMinutes = cycleConfig.dayDurationMinutes + cycleConfig.nightDurationMinutes;
    const totalCycleMillis = totalCycleMinutes * 60 * 1000;
    const dayDurationMillis = cycleConfig.dayDurationMinutes * 60 * 1000;

    const elapsedTime = Date.now() - startTime;
    const currentCyclePosition = elapsedTime % totalCycleMillis;

    if (currentCyclePosition < dayDurationMillis) {
        // It's daytime
        world.classList.add('day');
        world.classList.remove('night');
    } else {
        // It's nighttime
        world.classList.add('night');
        world.classList.remove('day');
    }
}

function setTile(x, y, char) {
    if (!worldData.has(y)) {
        worldData.set(y, new Map());
    }
    // Do not overwrite existing tiles to allow for natural cluster shapes.
    if (!worldData.get(y).has(x)) {
        worldData.get(y).set(x, char);
        return true; // Tile was set
    }
    return false; // Tile was not set
}

function generateCluster(startX, startY, char) {
    const clusterSize = Math.floor(Math.random() * (64 - 8 + 1)) + 8;
    const frontier = [[startX, startY]];
    const clusterTiles = new Set([`${startX},${startY}`]);
    
    if (!setTile(startX, startY, char)) {
        return; // Start tile was already set, so don't generate a cluster here.
    }

    let count = 1;

    while (frontier.length > 0 && count < clusterSize) {
        const randomIndex = Math.floor(Math.random() * frontier.length);
        const [cx, cy] = frontier.splice(randomIndex, 1)[0];

        const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
        ];

        // Shuffle neighbors to make it more random
        for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }

        for (const [nx, ny] of neighbors) {
            if (count >= clusterSize) break;

            const key = `${nx},${ny}`;
            if (!clusterTiles.has(key)) {
                // Add some randomness to the expansion
                if (Math.random() < 0.6) { // 60% chance to expand to a neighbor
                    if (setTile(nx, ny, char)) {
                        count++;
                        clusterTiles.add(key);
                        frontier.push([nx, ny]);
                    }
                } else {
                    // Even if we don't expand, mark it as considered to avoid getting stuck in loops
                    clusterTiles.add(key);
                }
            }
        }
    }
}

function getTile(x, y) {
    if (!worldData.has(y)) {
        worldData.set(y, new Map());
    }
    if (!worldData.get(y).has(x)) {

        let char;
        if (x === 0 && y === 0) {
            char = 'Ħ';
        } else {
            char = getRandomChar();
        }

        if (charData[char].rule === 'cluster') {
            generateCluster(x, y, char);
        } else {
            setTile(x, y, char);
        }
        // Fallback to ensure a tile is always set
        if (!worldData.get(y).has(x)) {
            setTile(x, y, char);
        }
    }
    return worldData.get(y).get(x);
}

// Function to apply zoom level
function applyZoom() {
    const oldTileSize = zoomLevels[currentZoomLevelIndex].tileSize;
    const centerX = worldOffset.x + Math.floor(viewSize.width / 2);
    const centerY = worldOffset.y + Math.floor(viewSize.height / 2);

    const { fontSize, tileSize } = zoomLevels[currentZoomLevelIndex];
    document.documentElement.style.setProperty('--world-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--tile-size', `${tileSize}px`);

    onResize(); // Recalculate viewSize based on new tileSize

    // Adjust worldOffset to keep the same world coordinate centered
    worldOffset.x = centerX - Math.floor(viewSize.width / 2);
    worldOffset.y = centerY - Math.floor(viewSize.height / 2);
    render(); // Re-render with adjusted offset
}

function saveGame() {
    characterName = characterNameInput.value;
    localStorage.setItem('characterName', characterName);
    localStorage.setItem('characterAttributes', JSON.stringify(characterAttributes));
    localStorage.setItem('startTime', startTime);
    const worldDataArray = Array.from(worldData.entries()).map(([y, row]) => [y, Array.from(row.entries())]);
    localStorage.setItem('worldData', JSON.stringify(worldDataArray));
    const playerLocation = {
        x: worldOffset.x + Math.floor(viewSize.width / 2),
        y: worldOffset.y + Math.floor(viewSize.height / 2)
    };
    localStorage.setItem('playerLocation', JSON.stringify(playerLocation));
    updateCharacterName();
    closeCharacterPanel();
}

function loadGame() {
    const savedName = localStorage.getItem('characterName');
    if (savedName) {
        characterName = savedName;
    }

    const savedAttributes = localStorage.getItem('characterAttributes');
    if (savedAttributes) {
        characterAttributes = JSON.parse(savedAttributes);
    }

    const savedStartTime = localStorage.getItem('startTime');
    if (savedStartTime) {
        startTime = parseInt(savedStartTime);
    }

    const savedWorldData = localStorage.getItem('worldData');
    if (savedWorldData) {
        const worldDataArray = JSON.parse(savedWorldData);
        worldData = new Map(worldDataArray.map(([y, rowArray]) => [y, new Map(rowArray)]));
    }

    const savedLocation = localStorage.getItem('playerLocation');
    if (savedLocation) {
        loadedPlayerLocation = JSON.parse(savedLocation);
    }
}

function render() {
    const playerWorldX = worldOffset.x + Math.floor(viewSize.width / 2);
    const playerWorldY = worldOffset.y + Math.floor(viewSize.height / 2);
    coords.innerHTML = `Coords: X${playerWorldX}, Y${-playerWorldY}`;

    const playerTileChar = getTile(playerWorldX, playerWorldY);
    statusDiv.innerHTML = `Loc: ${charData[playerTileChar].description}`;

    const imageName = charData[playerTileChar].image;
    if (imageName) {
        statusImageDiv.innerHTML = `<img src="images/${imageName}" alt="${charData[playerTileChar].description}">`;
    } else {
        statusImageDiv.innerHTML = '';
    }

    world.innerHTML = '';
    const playerX = Math.floor(viewSize.width / 2);
    const playerY = Math.floor(viewSize.height / 2);

    for (let y = 0; y < viewSize.height; y++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('row');
        for (let x = 0; x < viewSize.width; x++) {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('tile');

            if (x === playerX && y === playerY) {
                tileDiv.innerHTML = 'ǒ';
                tileDiv.classList.add('player');
            } else {
                const worldX = worldOffset.x + x;
                const worldY = worldOffset.y + y;
                const char = getTile(worldX, worldY);
                tileDiv.innerHTML = char;
                tileDiv.style.color = charData[char].color;
            }
            rowDiv.appendChild(tileDiv);
        }
        world.appendChild(rowDiv);
    }
}

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            worldOffset.y--;
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            worldOffset.y++;
            break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
            worldOffset.x--;
            break;
        case 'd':
        case 'D':
        case 'ArrowRight':
            worldOffset.x++;
            break;
        case '+':
        case '=': // Zoom in
            if (currentZoomLevelIndex > 0) {
                currentZoomLevelIndex--;
                applyZoom();
            }
            break;
        case '-': // Zoom out
            if (currentZoomLevelIndex < zoomLevels.length - 1) {
                currentZoomLevelIndex++;
                applyZoom();
            }
            break;
    }
    render();
});

function onResize() {
    const centerX = worldOffset.x + Math.floor(viewSize.width / 2);
    const centerY = worldOffset.y + Math.floor(viewSize.height / 2);

    const currentTileSize = zoomLevels[currentZoomLevelIndex].tileSize;
    viewSize.width = Math.floor(world.clientWidth / currentTileSize);
    viewSize.height = Math.floor(world.clientHeight / currentTileSize);

    // Adjust worldOffset to keep the same world coordinate centered
    worldOffset.x = centerX - Math.floor(viewSize.width / 2);
    worldOffset.y = centerY - Math.floor(viewSize.height / 2);
    render();
}

window.addEventListener('resize', onResize);

function updateCharacterName() {
    characterNameSpan.textContent = characterName;
    characterNameInput.value = characterName;
}

function openCharacterPanel() {
    characterPanel.classList.add('open');
}

function closeCharacterPanel() {
    characterPanel.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
    loadGame();

    function updateAttributesUI() {
        strValue.textContent = String(characterAttributes.strength).padStart(2, '0');
        spdValue.textContent = String(characterAttributes.speed).padStart(2, '0');
        intValue.textContent = String(characterAttributes.intelligence).padStart(2, '0');
        const usedPoints = characterAttributes.strength + characterAttributes.speed + characterAttributes.intelligence;
        pointsValue.textContent = totalPoints - usedPoints;
    }

    function changeAttribute(attribute, direction) {
        const currentSum = characterAttributes.strength + characterAttributes.speed + characterAttributes.intelligence;
        if (direction === 'up') {
            if (characterAttributes[attribute] < 10 && currentSum < totalPoints) {
                characterAttributes[attribute]++;
            }
        } else if (direction === 'down') {
            if (characterAttributes[attribute] > 1) {
                characterAttributes[attribute]--;
            }
        }
        updateAttributesUI();
    }

    strUp.addEventListener('click', () => changeAttribute('strength', 'up'));
    strDown.addEventListener('click', () => changeAttribute('strength', 'down'));
    spdUp.addEventListener('click', () => changeAttribute('speed', 'up'));
    spdDown.addEventListener('click', () => changeAttribute('speed', 'down'));
    intUp.addEventListener('click', () => changeAttribute('intelligence', 'up'));
    intDown.addEventListener('click', () => changeAttribute('intelligence', 'down'));

    characterOptionsIcon.addEventListener('click', openCharacterPanel);
    saveCharacterButton.addEventListener('click', saveGame);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCharacterPanel();
        }
    });

    // Day/Night Cycle Initialisation
    applyCycleStyles();
    updateDayNightCycle(startTime); // Set initial state instantly (no transition class yet)

    // Use a short timeout to allow the initial color to be rendered,
    // then enable transitions for all future changes.
    setTimeout(() => {
        world.classList.add('enable-transition');
    }, 50); // 50ms is enough for the initial paint

    setInterval(() => updateDayNightCycle(startTime), 1000); // Check for phase change every second

    // Initial setup
    updateCharacterName();
    updateAttributesUI();
    applyZoom(); // Apply initial zoom level
    if (loadedPlayerLocation) {
        worldOffset.x = loadedPlayerLocation.x - Math.floor(viewSize.width / 2);
        worldOffset.y = loadedPlayerLocation.y - Math.floor(viewSize.height / 2);
    } else {
        // Center the initial view
        worldOffset.x = -Math.floor(viewSize.width / 2);
        worldOffset.y = -Math.floor(viewSize.height / 2);
    }
    render();
});