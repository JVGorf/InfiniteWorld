const world = document.getElementById('world');
const coords = document.getElementById('coords');

let viewSize = {
    width: 0,
    height: 0,
};

const worldData = new Map(); // y -> Map(x -> char)
let worldOffset = { x: 0, y: 0 };

// Define zoom levels
const zoomLevels = [
    { fontSize: 38, tileSize: 48 }, // Default/Max Zoom
    { fontSize: 28, tileSize: 36 }, // Mid Zoom
    { fontSize: 18, tileSize: 24 }  // Min Zoom
];
let currentZoomLevelIndex = 0; // Start at default zoom

function getRandomChar() {
    return String.fromCharCode(Math.floor(Math.random() * 26) + 97);
}

function getTile(x, y) {
    if (!worldData.has(y)) {
        worldData.set(y, new Map());
    }
    if (!worldData.get(y).has(x)) {
        worldData.get(y).set(x, getRandomChar());
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
                tileDiv.innerHTML = 'X';
                tileDiv.classList.add('player');
            } else {
                const worldX = worldOffset.x + x;
                const worldY = worldOffset.y + y;
                tileDiv.innerHTML = getTile(worldX, worldY);
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