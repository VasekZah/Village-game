import { G } from '../globals.js';
import { CONFIG } from '../config.js';
import { PixelDrawer } from '../drawing.js';
import { Entity } from './entity.js';
import { getUiIcon, updateGridForObject } from '../helpers.js';

export class WorldObject extends Entity {
    constructor(type, x, y, amountOverride = null) {
        super();
        this.type = type; this.x = x; this.y = y; this.growth = 0;
        this.resource = { 
            tree: { type: 'wood', amount: 5 }, stone: { type: 'stone', amount: 5 }, 
            bush: { type: 'food', amount: 2 }, wood_pile: { type: 'wood', amount: 5 },
            stone_pile: { type: 'stone', amount: 5 }, food_pile: { type: 'food', amount: 2 },
            carcass: { type: 'food', amount: 8 }
        }[type];
        if (this.resource && amountOverride !== null) {
            this.resource.amount = amountOverride;
        }
        this.radius = {tree: 8, stone: 6, bush: 4, sapling: 2, wood_pile: 4, stone_pile: 4, food_pile: 4, carcass: 4, stump: 4}[type] || 4;
        this.targetedBy = null;
    }
    getTooltip() {
        if (this.type === 'stump') return 'Pařez';
        const name = CONFIG.WORLD_OBJECTS[this.type]?.name || this.type.replace('_', ' ');
        if (this.resource) return `${name} (${this.resource.amount} ${getUiIcon(this.resource.type)})`;
        return `${name.charAt(0).toUpperCase() + name.slice(1)}`;
    }
    draw() {
        PixelDrawer.draw(G.ctx, this);
    }
    update() { 
        if (this.type === 'stump' && this.growth < 100) this.growth += 0.01; 
        if (this.type === 'sapling' && this.growth < 100) this.growth += 0.05;
        if(this.growth >= 100) {
            this.type = 'tree'; this.growth = 0; this.resource = { type: 'wood', amount: 5 }; this.radius = 8;
            updateGridForObject(this, false);
        }
    }
}
