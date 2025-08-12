import { G } from './globals.js';
import { CONFIG } from './config.js';
import { screenToWorld, setNotification, updateGridForObject, worldToGrid } from './helpers.js';
import { Building } from './classes/building.js';

export function addEventListeners() {
    window.addEventListener('resize', resizeCanvas);
    G.ui.jobManagement.addEventListener('click', e => {
        if (e.target.tagName !== 'BUTTON') return;
        const job = e.target.dataset.job; const change = parseInt(e.target.dataset.change);
        const assignedWorkers = Object.values(G.state.jobQuotas).reduce((a, b) => a + b, 0);
        const adultPopulation = G.state.settlers.filter(s => !s.isChild).length;
        if (change > 0 && assignedWorkers < adultPopulation) G.state.jobQuotas[job]++;
        else if (change < 0 && G.state.jobQuotas[job] > 0) G.state.jobQuotas[job]--;
    });
    G.ui.buildManagement.addEventListener('click', e => {
        const button = e.target.closest('button'); if (!button) return;
        const buildId = button.dataset.build;
        const upgradeId = button.dataset.upgrade;

        if (buildId) {
            G.state.buildMode = buildId; 
            G.canvas.classList.add('build-mode');
            setNotification(`Vyber místo pro stavbu: ${CONFIG.BUILDINGS[buildId].name}`);
        } else if (upgradeId) {
            const upgradeInfo = CONFIG.UPGRADES[upgradeId];
            const targetBuilding = G.state.buildings.find(b => b.type === upgradeId && !b.isUpgrading && !b.isUnderConstruction);
            if (targetBuilding) {
                targetBuilding.isUpgrading = true;
                targetBuilding.cost = { ...upgradeInfo.cost };
                targetBuilding.delivered = Object.keys(upgradeInfo.cost).reduce((acc, key) => ({...acc, [key]: 0 }), {});
                targetBuilding.enRoute = Object.keys(upgradeInfo.cost).reduce((acc, key) => ({...acc, [key]: 0 }), {});
                setNotification(`Zahájeno vylepšování: ${CONFIG.BUILDINGS[targetBuilding.type].name}`);
            } else {
                setNotification(`Žádná ${CONFIG.BUILDINGS[upgradeId].name} k vylepšení.`);
            }
        }
    });
    G.canvas.addEventListener('mousemove', e => {
        const rect = G.canvas.getBoundingClientRect();
        G.state.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
    G.canvas.addEventListener('click', handleBuild);
    G.canvas.addEventListener('contextmenu', handleCancel);
    window.addEventListener('keydown', e => { G.state.keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { G.state.keysPressed[e.key.toLowerCase()] = false; if(e.key === 'escape') { G.state.buildMode = null; G.canvas.classList.remove('build-mode'); setNotification(''); }});
    
    G.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const worldPosBeforeZoom = screenToWorld(e.offsetX, e.offsetY);
        const zoomAmount = e.deltaY * -0.001;
        const oldZoom = G.state.camera.zoom;
        G.state.camera.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, oldZoom + zoomAmount));

        if (G.state.camera.zoom !== oldZoom) {
            const worldPosAfterZoom = screenToWorld(e.offsetX, e.offsetY);
            G.state.camera.x += worldPosBeforeZoom.x - worldPosAfterZoom.x;
            G.state.camera.y += worldPosBeforeZoom.y - worldPosAfterZoom.y;
        }
    });
}

function handleBuild(e) { 
    if (!G.state.buildMode) return;
    const worldMouse = screenToWorld(G.state.mousePos.x, G.state.mousePos.y);
    const blueprint = CONFIG.BUILDINGS[G.state.buildMode];
    let canPlace = true;
    const start = worldToGrid(worldMouse.x - blueprint.size.w/2, worldMouse.y - blueprint.size.h/2);
    const end = worldToGrid(worldMouse.x + blueprint.size.w/2, worldMouse.y + blueprint.size.h/2);
    for(let y = start.y; y <= end.y; y++) {
        for(let x = start.x; x <= end.x; x++) {
            if(!G.state.grid[y]?.[x] || !G.state.grid[y][x].walkable) {
                canPlace = false; break;
            }
        }
        if(!canPlace) break;
    }
    if (!canPlace) { setNotification('Zde nelze stavět!', 2000); return; }
    
    const newBuilding = new Building(G.state.buildMode, worldMouse.x, worldMouse.y);
    G.state.buildings.push(newBuilding); 
    updateGridForObject(newBuilding, false);
    G.state.buildMode = null; 
    G.canvas.classList.remove('build-mode'); 
    setNotification('');
}

function handleCancel(e) { 
    e.preventDefault();
    if (G.state.buildMode) {
        G.state.buildMode = null; 
        G.canvas.classList.remove('build-mode'); 
        setNotification('');
        return;
    }
    if (G.state.hoveredObject && (G.state.hoveredObject.isUnderConstruction || G.state.hoveredObject.isUpgrading)) {
        const building = G.state.hoveredObject;
        
        Object.entries(building.delivered).forEach(([res, amount]) => {
            if (amount > 0) G.state.resources[res] += Math.floor(amount);
        });

        Object.entries(building.enRoute).forEach(([res, amount]) => {
            if (amount > 0) G.state.resources[res] += Math.floor(amount);
        });

        G.state.settlers.forEach(s => {
            if (s.target === building || s.secondaryTarget === building) {
                s.resetTask();
            }
        });

        updateGridForObject(building, true);
        G.state.buildings = G.state.buildings.filter(b => b !== building);
        setNotification(`Stavba zrušena.`);
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
