import { G } from '../globals.js';
import { CONFIG } from '../config.js';
import { PixelDrawer } from '../drawing.js';
import { findPath } from '../pathfinding.js';
import { worldToGrid, findWalkableNeighbor } from '../helpers.js';
import { Entity } from './entity.js';
import { WorldObject } from './worldObject.js';

export class Animal extends Entity {
    constructor(type, x, y) {
        super();
        this.type = type; this.x = x; this.y = y;
        this.radius = {deer: 6, rabbit: 3}[type];
        this.path = []; this.task = 'wandering';
        this.targetedBy = null;
        this.isDead = false;
        this.resource = { deer: { type: 'food', amount: 8 }, rabbit: { type: 'food', amount: 3 }}[type];
    }
    getTooltip() { return this.type === 'deer' ? "Jelen" : "Zajíc"; }
    draw() {
        if (this.isDead) PixelDrawer.draw(G.ctx, {type: 'carcass', x: this.x, y: this.y});
        else PixelDrawer.draw(G.ctx, this);
    }
    update() {
        if (this.isDead) return;
        if (this.path.length === 0) {
            const randomX = this.x + (Math.random() - 0.5) * 200;
            const randomY = this.y + (Math.random() - 0.5) * 200;
            const end = findWalkableNeighbor(worldToGrid(randomX, randomY), worldToGrid(this.x, this.y));
            if (end) this.path = findPath(worldToGrid(this.x, this.y), end) || [];
        }
        if (this.path.length > 0) {
            const targetNode = this.path[0];
            const targetX = targetNode.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const targetY = targetNode.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const dx = targetX - this.x; const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            const speed = CONFIG.SETTLER_SPEED * (this.type === 'rabbit' ? 1.2 : 0.8);
            if (dist < speed) {
                this.x = targetX; this.y = targetY; this.path.shift();
            } else {
                this.x += (dx / dist) * speed; this.y += (dy / dist) * speed;
            }
        }
    }
    die() {
        this.isDead = true;
        this.targetedBy = null;
        const carcass = new WorldObject('carcass', this.x, this.y, this.resource.amount);
        G.state.worldObjects.push(carcass);
        G.state.animals = G.state.animals.filter(a => a !== this);
    }
}
