import { G } from './globals.js';
import { CONFIG } from './config.js';
import { drawFullGround, drawGroundTile } from './drawing.js';
import { updateUIDisplay } from './ui.js';
import { Settler, Building, WorldObject, Animal } from './classes/index.js';
import { updateGridForObject, assignHomes, screenToWorld, worldToGrid } from './helpers.js';

export function initGame() {
    const gridW = CONFIG.WORLD_WIDTH / CONFIG.GRID_SIZE; 
    const gridH = CONFIG.WORLD_HEIGHT / CONFIG.GRID_SIZE;
    G.state.grid = Array.from({ length: gridH }, (_, y) => 
        Array.from({ length: gridW }, (_, x) => ({
            x, y, walkable: true, wear: 0, g: Infinity, f: Infinity, parent: null,
            detail: Math.random() > 0.9 ? (Math.random() > 0.5 ? 'flower' : 'pebble') : null
        }))
    );

    G.state.camera.x = CONFIG.WORLD_WIDTH / 2 - G.canvas.width / (2 * G.state.camera.zoom);
    G.state.camera.y = CONFIG.WORLD_HEIGHT / 2 - G.canvas.height / (2 * G.state.camera.zoom);
    
    const centerX = CONFIG.WORLD_WIDTH / 2; 
    const centerY = CONFIG.WORLD_HEIGHT / 2;

    G.state.settlers.push(new Settler('Jan', centerX, centerY), new Settler('Eva', centerX + 30, centerY), new Settler('Adam', centerX - 30, centerY));
    const stockpile = new Building('stockpile', centerX, centerY + 50);
    G.state.buildings.push(stockpile);
    
    for (let i = 0; i < 200; i++) G.state.worldObjects.push(new WorldObject('tree', Math.random() * CONFIG.WORLD_WIDTH, Math.random() * CONFIG.WORLD_HEIGHT));
    for (let i = 0; i < 120; i++) G.state.worldObjects.push(new WorldObject('stone', Math.random() * CONFIG.WORLD_WIDTH, Math.random() * CONFIG.WORLD_HEIGHT));
    for (let i = 0; i < 150; i++) G.state.worldObjects.push(new WorldObject('bush', Math.random() * CONFIG.WORLD_HEIGHT, Math.random() * CONFIG.WORLD_HEIGHT));
    for (let i = 0; i < 8; i++) G.state.animals.push(new Animal('deer', Math.random() * CONFIG.WORLD_WIDTH, Math.random() * CONFIG.WORLD_HEIGHT));
    for (let i = 0; i < 15; i++) G.state.animals.push(new Animal('rabbit', Math.random() * CONFIG.WORLD_WIDTH, Math.random() * CONFIG.WORLD_HEIGHT));
    
    [...G.state.buildings, ...G.state.worldObjects.filter(o => o.type === 'tree' || o.type === 'stone')].forEach(obj => updateGridForObject(obj, false));
    assignHomes();
    
    resizeCanvas(); 
}

let lastTime = 0;
let timeAccumulator = 0;

export function gameLoop(timestamp) {
    let deltaTime = timestamp - lastTime || 0;
    lastTime = timestamp;

    deltaTime = Math.min(deltaTime, 100); 

    timeAccumulator += deltaTime;
    while (timeAccumulator >= CONFIG.DAY_LENGTH_MS) {
        dailyUpdate();
        timeAccumulator -= CONFIG.DAY_LENGTH_MS;
    }
    G.state.timeOfDay = timeAccumulator / CONFIG.DAY_LENGTH_MS;

    update(deltaTime); 
    draw();
    requestAnimationFrame(gameLoop);
}

function dailyUpdate() {
    const { state } = G;
    state.day++;
    const totalHousingCapacity = state.buildings.reduce((sum, b) => sum + ((b.type === 'hut' || b.type === 'stone_house') && !b.isUnderConstruction && !b.isUpgrading ? CONFIG.BUILDINGS[b.type].housing : 0), 0);
    if (state.settlers.length < totalHousingCapacity) {
        const fertileHuts = state.buildings.filter(b => (b.type === 'hut' || b.type === 'stone_house') && b.reproductionCooldown <= 0 && b.residents.filter(r => !r.isChild).length >= 2);
        if (fertileHuts.length > 0) {
            const home = fertileHuts[Math.floor(Math.random() * fertileHuts.length)];
            const newChild = new Settler(`Dítě ${state.settlers.length + 1}`, home.x, home.y, true);
            home.residents.push(newChild);
            newChild.home = home;
            state.settlers.push(newChild);
            home.reproductionCooldown = CONFIG.REPRODUCTION_COOLDOWN_DAYS;
            setNotification('Narodil se nový osadník!');
        }
    }
    if (state.animals.length < CONFIG.MAX_ANIMALS && Math.random() < CONFIG.ANIMAL_REPRODUCTION_CHANCE) {
        const parent = state.animals[Math.floor(Math.random() * state.animals.length)];
        if (parent) {
            const newAnimal = new Animal(parent.type, parent.x + (Math.random()-0.5)*20, parent.y + (Math.random()-0.5)*20);
            state.animals.push(newAnimal);
        }
    }
    for(let y = 0; y < state.grid.length; y++) for(let x = 0; x < state.grid[y].length; x++) {
        const tile = state.grid[y][x];
        if (tile.wear > 0) {
            tile.wear = Math.max(0, tile.wear - CONFIG.PATH_DECAY_RATE);
            state.dirtyGroundTiles.add(`${x},${y}`);
        }
    }
}

function update(deltaTime) {
    updateCamera(deltaTime); 
    assignJobs();

    G.state.settlers.forEach(s => s.update(deltaTime));
    G.state.worldObjects.forEach(o => o.update(deltaTime));
    G.state.buildings.forEach(b => b.update?.(deltaTime));
    G.state.animals.forEach(a => a.update(deltaTime));
    G.state.projectiles = G.state.projectiles.filter(p => p.update(deltaTime));
    
    updateHoveredObject();
}

function draw() { 
    const { state } = G;
    G.ctx.save();
    G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    G.ctx.imageSmoothingEnabled = false;
    
    state.dirtyGroundTiles.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        drawGroundTile(x, y);
    });
    state.dirtyGroundTiles.clear();
    
    G.ctx.translate(-state.camera.x * state.camera.zoom, -state.camera.y * state.camera.zoom);
    G.ctx.scale(state.camera.zoom, state.camera.zoom);

    const view = {
        x: state.camera.x, y: state.camera.y,
        w: G.canvas.width / state.camera.zoom,
        h: G.canvas.height / state.camera.zoom
    };

    G.ctx.drawImage(G.groundCanvas, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);

    const visibleObjects = [...state.worldObjects, ...state.buildings, ...state.animals, ...state.settlers, ...state.projectiles].filter(o => {
        const size = o.size ? Math.max(o.size.w, o.size.h) : (o.radius || 2) * 2;
        return o.x + size > view.x && o.x - size < view.x + view.w && o.y + size > view.y && o.y - size < view.y + view.h;
    });

    visibleObjects.sort((a, b) => a.y - b.y);
    visibleObjects.forEach(o => {
        if (o.draw) {
            o.draw();
        }
    });

    if (state.hoveredObject) {
        G.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; G.ctx.lineWidth = 1.5 / state.camera.zoom; G.ctx.beginPath();
        const size = state.hoveredObject.radius || (state.hoveredObject.size ? Math.max(state.hoveredObject.size.w, state.hoveredObject.size.h)/2 + 2 : 10);
        G.ctx.rect(state.hoveredObject.x - size, state.hoveredObject.y - size, size * 2, size * 2);
        G.ctx.stroke();
    }
    if (state.buildMode) {
        const worldMouse = screenToWorld(state.mousePos.x, state.mousePos.y);
        const blueprint = CONFIG.BUILDINGS[state.buildMode];
        
        let canPlace = true;
        const start = worldToGrid(worldMouse.x - blueprint.size.w/2, worldMouse.y - blueprint.size.h/2);
        const end = worldToGrid(worldMouse.x + blueprint.size.w/2, worldMouse.y + blueprint.size.h/2);
        for(let y = start.y; y <= end.y; y++) {
            for(let x = start.x; x <= end.x; x++) {
                if(!state.grid[y]?.[x] || !state.grid[y][x].walkable) {
                    canPlace = false; break;
                }
            }
            if(!canPlace) break;
        }
        G.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
        G.ctx.strokeStyle = canPlace ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
        G.ctx.lineWidth = 2 / state.camera.zoom;
        G.ctx.fillRect(worldMouse.x - blueprint.size.w/2, worldMouse.y - blueprint.size.h/2, blueprint.size.w, blueprint.size.h);
        G.ctx.strokeRect(worldMouse.x - blueprint.size.w/2, worldMouse.y - blueprint.size.h/2, blueprint.size.w, blueprint.size.h);
    }
    
    G.ctx.restore();
    
    const tooltip = G.ui.tooltip;
    if (state.hoveredObject && state.hoveredObject.getTooltip) {
        tooltip.innerHTML = state.hoveredObject.getTooltip();
        tooltip.style.display = 'block';
        tooltip.style.left = `${state.mousePos.x + 15}px`;
        tooltip.style.top = `${state.mousePos.y + 15}px`;
    } else {
        tooltip.style.display = 'none';
    }
    updateUIDisplay();
}

function updateCamera(deltaTime) {
    const { state } = G;
    const panSpeed = (CONFIG.CAMERA_PAN_SPEED / state.camera.zoom) * (deltaTime / 16.67);
    if (state.keysPressed['w']) state.camera.y -= panSpeed;
    if (state.keysPressed['s']) state.camera.y += panSpeed;
    if (state.keysPressed['a']) state.camera.x -= panSpeed;
    if (state.keysPressed['d']) state.camera.x += panSpeed;

    state.camera.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - G.canvas.width / state.camera.zoom, state.camera.x));
    state.camera.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT - G.canvas.height / state.camera.zoom, state.camera.y));
}

function updateHoveredObject() {
    const { state } = G;
    const worldMouse = screenToWorld(state.mousePos.x, state.mousePos.y);
    state.hoveredObject = null; 
    let minDist = Infinity;
    
    const allObjects = [...state.settlers, ...state.worldObjects, ...state.buildings, ...state.animals];
    for (const obj of allObjects) {
        const size = obj.radius || (obj.size ? Math.max(obj.size.w, obj.size.h)/2 : 10);
        const dist = Math.hypot(worldMouse.x - obj.x, worldMouse.y - obj.y);
        if (dist < size && dist < minDist) { 
            minDist = dist; 
            state.hoveredObject = obj; 
        }
    }
}

function resizeCanvas() {
    const container = G.canvas.parentElement;
    G.canvas.width = container.offsetWidth; G.canvas.height = container.offsetHeight;
    if (G.groundCanvas.width !== CONFIG.WORLD_WIDTH || G.groundCanvas.height !== CONFIG.WORLD_HEIGHT) {
        G.groundCanvas.width = CONFIG.WORLD_WIDTH; 
        G.groundCanvas.height = CONFIG.WORLD_HEIGHT;
        drawFullGround();
    }
}

function assignJobs() { 
    const { state } = G;
    const availableAdults = state.settlers.filter(s => !s.isChild);
    const jobCounts = availableAdults.reduce((acc, s) => {
        acc[s.job] = (acc[s.job] || 0) + 1;
        return acc;
    }, {});
    
    Object.keys(CONFIG.JOBS).forEach(jobId => {
        const currentCount = jobCounts[jobId] || 0;
        const quota = state.jobQuotas[jobId];
        let diff = quota - currentCount;

        if (diff > 0) {
            const laborers = availableAdults.filter(s => s.job === 'laborer');
            for(let i=0; i < Math.min(diff, laborers.length); i++) {
                laborers[i].job = jobId;
                laborers[i].resetTask();
            }
        } else if (diff < 0) {
            const workers = availableAdults.filter(s => s.job === jobId);
            for(let i=0; i < Math.min(-diff, workers.length); i++) {
                workers[i].job = 'laborer';
                workers[i].resetTask();
            }
        }
    });
}
