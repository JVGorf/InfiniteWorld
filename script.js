const world = document.getElementById('world');
const debug = document.getElementById('debug');

let viewSize = {
    width: 0,
    height: 0,
};

const worldData = new Map(); // y -> Map(x -> char)
let worldOffset = { x: 0, y: 0 };

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

function render() {
    debug.innerHTML = `x: ${worldOffset.x}<br>y: ${worldOffset.y}`;

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
            worldOffset.y--;
            break;
        case 's':
            worldOffset.y++;
            break;
        case 'a':
            worldOffset.x--;
            break;
        case 'd':
            worldOffset.x++;
            break;
    }
    render();
});

function onResize() {
    viewSize.width = Math.floor(world.clientWidth / 12);
    viewSize.height = Math.floor(world.clientHeight / 12);
    render();
}

window.addEventListener('resize', onResize);

document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    viewSize.width = Math.floor(world.clientWidth / 12);
    viewSize.height = Math.floor(world.clientHeight / 12);
    // Center the initial view
    worldOffset.x = -Math.floor(viewSize.width / 2);
    worldOffset.y = -Math.floor(viewSize.height / 2);
    render();
});