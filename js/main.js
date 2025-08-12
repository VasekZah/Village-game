import { G } from './globals.js';
import { CONFIG } from './config.js';
import { initGame, gameLoop } from './game.js';
import { addEventListeners } from './events.js';
import { populateUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    G.canvas = document.getElementById('gameCanvas');
    G.ctx = G.canvas.getContext('2d');
    
    G.ui = {
        wood: document.getElementById('woodCount'), stone: document.getElementById('stoneCount'),
        food: document.getElementById('foodCount'), settlers: document.getElementById('settlerCount'),
        housing: document.getElementById('housingCapacity'), day: document.getElementById('dayCount'),
        jobManagement: document.querySelector('#job-management .space-y-2'),
        buildManagement: document.querySelector('#build-management .space-y-2'),
        notificationArea: document.getElementById('notificationArea'),
        tooltip: document.getElementById('tooltip'),
        iconWood: document.getElementById('icon-wood'),
        iconStone: document.getElementById('icon-stone'),
        iconFood: document.getElementById('icon-food'),
        iconSettler: document.getElementById('icon-settler'),
        iconHousing: document.getElementById('icon-housing'),
        iconDay: document.getElementById('icon-day'),
    };
    
    G.groundCanvas = document.createElement('canvas');
    G.groundCtx = G.groundCanvas.getContext('2d');
    
    G.state = {
        resources: { wood: 50, food: 40, stone: 10 },
        settlers: [], worldObjects: [], buildings: [], animals: [], grid: [], projectiles: [],
        jobQuotas: Object.keys(CONFIG.JOBS).reduce((acc, key) => ({...acc, [key]: 0 }), { laborer: 0 }),
        buildMode: null, mousePos: { x: 0, y: 0 },
        camera: { x: 0, y: 0, zoom: 1.5 },
        keysPressed: {}, hoveredObject: null,
        day: 1, timeOfDay: 0,
        dirtyGroundTiles: new Set(),
    };
    
    initGame();
    populateUI();
    addEventListeners();
    gameLoop();
});
