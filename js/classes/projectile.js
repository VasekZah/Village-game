import { G } from '../globals.js';
import { PixelDrawer } from '../drawing.js';
import { Entity } from './entity.js';

export class Projectile extends Entity {
    constructor(x, y, target) {
        super();
        this.type = 'arrow';
        this.x = x; this.y = y; this.target = target;
        this.speed = 4;
        const dx = target.x - x; const dy = target.y - y;
        this.angle = Math.atan2(dy, dx);
    }
    draw() { 
        PixelDrawer.draw(G.ctx, this); 
    }
    update() {
        if (this.target.isDead) return false;
        const dx = this.target.x - this.x; const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.speed) {
            this.target.die();
            return false;
        }
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        return true;
    }
}
