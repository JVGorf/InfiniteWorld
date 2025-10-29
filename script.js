const world = document.getElementById('world');
const coords = document.getElementById('coords');
const statusDiv = document.getElementById('status');

let viewSize = {
    width: 0,
    height: 0,
};

const worldData = new Map(); // y -> Map(x -> char)
let worldOffset = { x: 0, y: 0 };

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
    'v': { color: 'wheat', description: 'Crops', chance: '2' },
    't': { color: 'brown', description: 'Trees', chance: '28' },
    '~': { color: '#0066cc', description: 'Water', chance: '0.3', rule: 'cluster' },
    'M': { color: 'grey', description: 'Mountains', chance: '0.2' , rule: 'cluster' }, //8
    'm': { color: 'green', description: 'Hills', chance: '2' },
    '.': { color: 'seagreen', description: 'Grass', chance: '65' }
};

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
        const char = getRandomChar();
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

function render() {
    const playerWorldX = worldOffset.x + Math.floor(viewSize.width / 2);
    const playerWorldY = worldOffset.y + Math.floor(viewSize.height / 2);
    coords.innerHTML = `Coords: X${playerWorldX}, Y${-playerWorldY}`;

    const playerTileChar = getTile(playerWorldX, playerWorldY);
    statusDiv.innerHTML = `Status: ${charData[playerTileChar].description}`;

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

document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    applyZoom(); // Apply initial zoom level
    // Center the initial view
    worldOffset.x = -Math.floor(viewSize.width / 2);
    worldOffset.y = -Math.floor(viewSize.height / 2);
    render();
});