// Mulberry32 PRNG
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const worldContainer = document.getElementById('WorldZero');
const coords = document.getElementById('coords');
const statusDiv = document.getElementById('status');
const statusImageDiv = document.getElementById('status-image');
const tileImage = document.getElementById('tile-image');
const characterOptionsIcon = document.getElementById('character-options-icon');
const characterNameSpan = document.getElementById('character-name');
const characterPanel = document.getElementById('character-panel');
const characterNameInput = document.getElementById('character-name-input');
const worldSeedInput = document.getElementById('world-seed-input');
const saveCharacterButton = document.getElementById('save-character-button');
const saveSettingsButton = document.getElementById('save-settings-button');
const infoIcon = document.getElementById('info-icon');
const infoPanel = document.getElementById('info-panel');
const teleportTransition = document.getElementById('teleport-transition');

const setRecallAudio = document.getElementById('set-recall-audio');
const recallAudio = document.getElementById('recall-audio');

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
let worldZeroData = new Map(); // y -> Map(x -> char)
let worldZeroOffset = { x: 0, y: 0 };
let worldSeed = 0; // Will be initialized from localStorage or generated
let loadedPlayerLocation = null;
let recallLocations = [null, null, null];

let lastPlayerCoords = '';
let lastPlayerStatus = '';
let lastPlayerImage = '';

// Define zoom levels
const zoomLevels = [
    { fontSize: 38, tileSize: 48 }, // Max Zoom
    { fontSize: 28, tileSize: 36 }, // Mid Zoom (Default)
    { fontSize: 18, tileSize: 24 }  // Min Zoom
];
let currentZoomLevelIndex = 1; // Start zoom (0:max, 1:mid, 2:min)

function getRandomChar(prng) {
    const chars = Object.keys(charData);
    const weights = chars.map(char => parseFloat(charData[char].chance));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = prng() * totalWeight;
    
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
    '~': { color: '#0066cc', description: 'Lake', chance: '0.3', image: 'lake.jpg', rule: 'cluster' },
    'M': { color: 'grey', description: 'Mountains', chance: '0.2' , image: 'mountains.jpg', rule: 'cluster' }, //8
    'm': { color: 'green', description: 'Hills', chance: '2', image: 'hills.jpg' },
    '·': { color: 'seagreen', description: 'Grass', chance: '65', image: 'grass.jpg' },
    'Ħ': { color: 'white', description: 'Shrine', chance: '0.01', image: 'shrine.jpg' },
    '∩': { color: 'white', bg: 'black', description: 'Cave', chance: '0.01', image: 'cave.jpg' }
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
        #WorldZero.day {
            background-color: ${cycleConfig.dayColor};
        }
        #WorldZero.night {
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
        worldContainer.classList.add('day');
        worldContainer.classList.remove('night');
    } else {
        // It's nighttime
        worldContainer.classList.add('night');
        worldContainer.classList.remove('day');
    }
}

function setTile(x, y, char) {
    if (!worldZeroData.has(y)) {
        worldZeroData.set(y, new Map());
    }
    // Do not overwrite existing tiles to allow for natural cluster shapes.
    if (!worldZeroData.get(y).has(x)) {
        worldZeroData.get(y).set(x, char);
        return true; // Tile was set
    }
    return false; // Tile was not set
}

function generateCluster(startX, startY, char, prng) {
    const clusterSize = Math.floor(prng() * (64 - 8 + 1)) + 8;
    const frontier = [[startX, startY]];
    const clusterTiles = new Set([`${startX},${startY}`]);
    
    if (!setTile(startX, startY, char)) {
        return; // Start tile was already set, so don't generate a cluster here.
    }

    let count = 1;

    while (frontier.length > 0 && count < clusterSize) {
        const randomIndex = Math.floor(prng() * frontier.length);
        const [cx, cy] = frontier.splice(randomIndex, 1)[0];

        const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
        ];

        // Shuffle neighbors to make it more random
        for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
        }

        for (const [nx, ny] of neighbors) {
            if (count >= clusterSize) break;

            const key = `${nx},${ny}`;
            if (!clusterTiles.has(key)) {
                // Add some randomness to the expansion
                if (prng() < 0.6) { // 60% chance to expand to a neighbor
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
    if (!worldZeroData.has(y)) {
        worldZeroData.set(y, new Map());
    }
    if (!worldZeroData.get(y).has(x)) {
        // Create a unique seed for this tile based on worldSeed and its coordinates
        // Using a simple hash function for combining seeds
        const tileSeed = worldSeed + x * 31 + y * 17; // Prime numbers for better distribution
        const tilePrng = mulberry32(tileSeed);

        let char;
        if (x === 0 && y === 0) {
            char = 'Ħ';
        } else {
            char = getRandomChar(tilePrng);
        }

        if (charData[char].rule === 'cluster') {
            generateCluster(x, y, char, tilePrng);
        } else if (charData[char].rule === 'cavespawn') {
            // First, place the cave tile itself.
            setTile(x, y, char);
            // Then, generate a mountain cluster next to it.
            // We'll pick a random adjacent tile to start the cluster.
            const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
            const [nx, ny] = neighbors[Math.floor(tilePrng() * neighbors.length)];
            generateCluster(nx, ny, 'M', tilePrng); // 'M' for mountain
        } else {
            setTile(x, y, char);
        }
        // Fallback to ensure a tile is always set
        if (!worldZeroData.get(y).has(x)) {
            setTile(x, y, char);
        }
    }
    return worldZeroData.get(y).get(x);
}

// Function to apply zoom level
function applyZoom() {
    const oldTileSize = zoomLevels[currentZoomLevelIndex].tileSize;
    const centerX = worldZeroOffset.x + Math.floor(viewSize.width / 2);
    const centerY = worldZeroOffset.y + Math.floor(viewSize.height / 2);

    const { fontSize, tileSize } = zoomLevels[currentZoomLevelIndex];
    document.documentElement.style.setProperty('--world-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--tile-size', `${tileSize}px`);

    onResize(); // Recalculate viewSize based on new tileSize

    // Adjust worldOffset to keep the same world coordinate centered
    worldZeroOffset.x = centerX - Math.floor(viewSize.width / 2);
    worldZeroOffset.y = centerY - Math.floor(viewSize.height / 2);
    render(); // Re-render with adjusted offset
}

function saveGame() {
    characterName = characterNameInput.value;
    worldSeed = parseInt(worldSeedInput.value) || worldSeed;

    localStorage.setItem('characterName', characterName);
    localStorage.setItem('characterAttributes', JSON.stringify(characterAttributes));
    localStorage.setItem('startTime', startTime);
    localStorage.setItem('worldSeed', worldSeed);
    // worldZeroData is no longer saved to localStorage as it's generated on-the-fly
    const playerLocation = {
        x: worldZeroOffset.x + Math.floor(viewSize.width / 2),
        y: worldZeroOffset.y + Math.floor(viewSize.height / 2)
    };
    localStorage.setItem('playerLocation', JSON.stringify(playerLocation));
    localStorage.setItem('currentZoomLevelIndex', currentZoomLevelIndex);
    localStorage.setItem('recallLocations', JSON.stringify(recallLocations));
    updateCharacterName();
    closeCharacterPanel();

    const saveMessage = document.getElementById('save-message');
    saveMessage.classList.add('show');
    setTimeout(() => {
        saveMessage.classList.remove('show');
    }, 2000);
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

    const savedWorldSeed = localStorage.getItem('worldSeed');
    if (savedWorldSeed) {
        worldSeed = parseInt(savedWorldSeed);
    } else {
        worldSeed = Date.now();
        localStorage.setItem('worldSeed', worldSeed);
    }

    // worldZeroData will now be generated on-the-fly based on the seed

    const savedLocation = localStorage.getItem('playerLocation');
    if (savedLocation) {
        loadedPlayerLocation = JSON.parse(savedLocation);
    }

    const savedZoomLevel = localStorage.getItem('currentZoomLevelIndex');
    if (savedZoomLevel !== null) {
        currentZoomLevelIndex = parseInt(savedZoomLevel);
    }

    const savedRecallLocations = localStorage.getItem('recallLocations');
    if (savedRecallLocations) {
        recallLocations = JSON.parse(savedRecallLocations);
    } else {
        recallLocations[0] = {x: 0, y: 0};
    }
}

function updatePanelInfo() {
    const playerWorldX = worldZeroOffset.x + Math.floor(viewSize.width / 2);
    const playerWorldY = worldZeroOffset.y + Math.floor(viewSize.height / 2);
    const newCoords = `Coords: X${playerWorldX}, Y${-playerWorldY}`;

    if (newCoords !== lastPlayerCoords) {
        coords.innerHTML = newCoords;
        lastPlayerCoords = newCoords;
    }

    const playerTileChar = getTile(playerWorldX, playerWorldY);
    statusDiv.innerHTML = `Loc: ${charData[playerTileChar].description}`;

    const imageName = charData[playerTileChar].image;
    if (imageName) {
        const newSrc = `images/${imageName}`;
        if (tileImage.src !== newSrc) {
            tileImage.src = newSrc;
            tileImage.alt = charData[playerTileChar].description;
        }
        tileImage.classList.remove('hidden');
    } else {
        tileImage.classList.add('hidden');
    }
}

function render() {
    updatePanelInfo();

    worldContainer.innerHTML = '';
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
                const worldX = worldZeroOffset.x + x;
                const worldY = worldZeroOffset.y + y;
                const char = getTile(worldX, worldY);
                tileDiv.innerHTML = char;
                tileDiv.style.color = charData[char].color;
                if (charData[char].bg) {
                    tileDiv.style.backgroundColor = charData[char].bg;
                }
            }
            rowDiv.appendChild(tileDiv);
        }
        worldContainer.appendChild(rowDiv);
    }
}

document.addEventListener('keydown', (event) => {
    // If the character name input is focused, prevent world movement
    if (document.activeElement === characterNameInput) {
        return;
    }

    switch (event.key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            worldZeroOffset.y--;
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            worldZeroOffset.y++;
            break;
        case 'a':
        case 'A':
        case 'ArrowLeft':
            worldZeroOffset.x--;
            break;
        case 'd':
        case 'D':
        case 'ArrowRight':
            worldZeroOffset.x++;
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
    const centerX = worldZeroOffset.x + Math.floor(viewSize.width / 2);
    const centerY = worldZeroOffset.y + Math.floor(viewSize.height / 2);

    const currentTileSize = zoomLevels[currentZoomLevelIndex].tileSize;
    viewSize.width = Math.floor(worldContainer.clientWidth / currentTileSize);
    viewSize.height = Math.floor(worldContainer.clientHeight / currentTileSize);

    // Adjust worldOffset to keep the same world coordinate centered
    worldZeroOffset.x = centerX - Math.floor(viewSize.width / 2);
    worldZeroOffset.y = centerY - Math.floor(viewSize.height / 2);
    render();
}

window.addEventListener('resize', onResize);

function updateRecallUI() {
    for (let i = 0; i < recallLocations.length; i++) {
        const recallCoords = document.getElementById(`recall-coords-${i + 1}`);
        if (recallLocations[i]) {
            recallCoords.textContent = `X${recallLocations[i].x},Y${-recallLocations[i].y}`;
        } else {
            recallCoords.textContent = 'Not set.';
        }
    }
}

function updateCharacterName() {
    characterNameSpan.textContent = characterName;
    characterNameInput.value = characterName;
}

function openCharacterPanel() {
    worldSeedInput.value = worldSeed;
    characterPanel.classList.add('open');
}

function closeCharacterPanel() {
    characterPanel.classList.remove('open');
}

function openInfoPanel() {
    infoPanel.classList.add('open');
}

function closeInfoPanel() {
    infoPanel.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
        localStorage.removeItem('characterName');
        localStorage.removeItem('characterAttributes');
        localStorage.removeItem('startTime');
        localStorage.removeItem('worldSeed');
        localStorage.removeItem('playerLocation');
        localStorage.removeItem('currentZoomLevelIndex');
        localStorage.removeItem('recallLocations');
        // Redirect to clean URL to prevent accidental re-reset on refresh
        window.location.replace(window.location.origin + window.location.pathname);
        return; // Stop further execution as we're resetting
    }

    loadGame();
    updateRecallUI();

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });

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
    infoIcon.addEventListener('click', openInfoPanel);
    document.getElementById('save-icon').addEventListener('click', saveGame);
    saveCharacterButton.addEventListener('click', saveGame);
    saveSettingsButton.addEventListener('click', saveGame);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCharacterPanel();
            closeInfoPanel();
        }
    });

    for (let i = 0; i < 3; i++) {
        document.getElementById(`set-recall-${i + 1}`).addEventListener('click', (e) => {
            e.preventDefault();
            setRecallAudio.play();
            const playerWorldX = worldZeroOffset.x + Math.floor(viewSize.width / 2);
            const playerWorldY = worldZeroOffset.y + Math.floor(viewSize.height / 2);
            recallLocations[i] = { x: playerWorldX, y: playerWorldY };
            updateRecallUI();
            saveGame();
        });

        document.getElementById(`recall-${i + 1}`).addEventListener('click', (e) => {
            e.preventDefault();
            if (recallLocations[i]) {
                recallAudio.play();
                teleportTransition.classList.add('active');

                setTimeout(() => {
                    worldZeroOffset.x = recallLocations[i].x - Math.floor(viewSize.width / 2);
                    worldZeroOffset.y = recallLocations[i].y - Math.floor(viewSize.height / 2);
                    render();

                    setTimeout(() => {
                        teleportTransition.classList.remove('active');
                    }, 100); // Short delay to allow render to start
                }, 500); // Corresponds to the transition duration
            }
        });
    }

    // Day/Night Cycle Initialisation
    applyCycleStyles();
    updateDayNightCycle(startTime); // Set initial state instantly (no transition class yet)

    // Use a short timeout to allow the initial color to be rendered,
    // then enable transitions for all future changes.
    setTimeout(() => {
        worldContainer.classList.add('enable-transition');
    }, 50); // 50ms is enough for the initial paint

    setInterval(() => updateDayNightCycle(startTime), 1000); // Check for phase change every second

    // Initial setup
    updateCharacterName();
    updateAttributesUI();
    applyZoom(); // Apply initial zoom level (or loaded zoom level)
    if (loadedPlayerLocation) {
        worldZeroOffset.x = loadedPlayerLocation.x - Math.floor(viewSize.width / 2);
        worldZeroOffset.y = loadedPlayerLocation.y - Math.floor(viewSize.height / 2);
    } else {
        // Center the initial view
        worldZeroOffset.x = -Math.floor(viewSize.width / 2);
        worldZeroOffset.y = -Math.floor(viewSize.height / 2);
    }
    render();
});