import { G } from '../globals.js';
import { CONFIG } from '../config.js';
import { PixelDrawer } from '../drawing.js';
import { Entity } from './entity.js';
import { getUiIcon } from '../helpers.js';

export class Building extends Entity { 
    constructor(type, x, y) {
        super();
        this.type = type; this.x = x; this.y = y;
        const blueprint = CONFIG.BUILDINGS[type];
        this.size = { ...blueprint.size };
        this.isUnderConstruction = type !== 'stockpile';
        this.isUpgrading = false;
        this.cost = { ...(blueprint.cost || {}) };
        this.delivered = Object.keys(this.cost).reduce((acc, key) => ({...acc, [key]: 0 }), {});
        this.enRoute = Object.keys(this.cost).reduce((acc, key) => ({...acc, [key]: 0 }), {});
        this.targetedBy = null;
        this.targetedByHaulers = [];
        this.upgradable = blueprint.upgradable;

        if (type === 'farm') { this.farmState = 'fallow'; this.growth = 0; }
        if (type === 'hut' || type === 'stone_house') {
             this.residents = [];
             this.reproductionCooldown = 0;
        }
    }

    getTooltip() {
        const name = CONFIG.BUILDINGS[this.type].name;
        
        if (this.isUnderConstruction || this.isUpgrading) {
            const cost = this.isUpgrading ? CONFIG.UPGRADES[this.type]?.cost : this.cost;
            const status = this.isUpgrading ? 'Vylepšování' : 'Stavba';
            
            let needed = Object.entries(cost || {}).map(([res, val]) => {
                const delivered = Math.floor(this.delivered[res]);
                const enRoute = Math.floor(this.enRoute[res] || 0);
                const icon = getUiIcon(res);
                return `<div class="text-xs">${icon} ${res.charAt(0).toUpperCase() + res.slice(1)}: ${delivered}/${val} (+${enRoute} na cestě)</div>`;
            }).join('');
            
            return `<div class="font-bold">${name} (${status})</div><div class="mt-1">${needed || 'Připraveno k práci'}</div><div class="text-xs text-gray-400 mt-2">[Pravý klik pro zrušení]</div>`;
        }
        if (this.type === 'farm') return `<div>${name}</div><div>Stav: ${this.farmState} (${Math.floor(this.growth * 100)}%)</div>`;
        if (this.type === 'hut' || this.type === 'stone_house') return `<div>${name}</div><div>Obyvatelé: ${this.residents.length}/${CONFIG.BUILDINGS[this.type].housing}</div>`;
        return name;
    }

    hasMaterials() { 
        const cost = this.isUpgrading ? CONFIG.UPGRADES[this.type]?.cost : this.cost;
        if (!cost || Object.keys(cost).length === 0) return true;
        return Object.keys(cost).every(res => this.delivered[res] >= cost[res]); 
    }
    
    draw() {
        if (this.isUnderConstruction || this.isUpgrading) {
            const totalCost = Object.values(this.cost).reduce((sum, val) => sum + val, 0) || 1;
            const currentProgress = Object.values(this.delivered).reduce((sum, val) => sum + val, 0);
            const progress = Math.min(1, currentProgress / totalCost);

            G.ctx.globalAlpha = 0.4;
            const finalForm = this.isUpgrading ? CONFIG.UPGRADES[this.type].to : this.type;
            PixelDrawer.draw(G.ctx, { ...this, type: finalForm });
            G.ctx.globalAlpha = 1;

            G.ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            G.ctx.fillRect(this.x - this.size.w / 2, this.y + this.size.h / 2 + 2, this.size.w, 5);
            G.ctx.fillStyle = 'rgba(100, 220, 100, 0.8)';
            G.ctx.fillRect(this.x - this.size.w / 2, this.y + this.size.h / 2 + 2, this.size.w * progress, 5);
        } else { 
            PixelDrawer.draw(G.ctx, this); 
        }
    }
    update(deltaTime) {
        if (this.type === 'farm' && this.farmState === 'growing' && this.growth < 1) {
            const isFarmerPresent = G.state.settlers.some(s => s.job === 'farmer' && Math.hypot(s.x - this.x, s.y - this.y) < this.size.w);
            const boost = isFarmerPresent ? CONFIG.FARM_BOOST : 1;
            this.growth += (deltaTime / (CONFIG.DAY_LENGTH_MS * CONFIG.FARM_GROWTH_DAYS)) * boost;
            if (this.growth >= 1) { this.growth = 1; this.farmState = 'harvestable'; }
        }
        if (this.reproductionCooldown > 0) {
             this.reproductionCooldown -= deltaTime / CONFIG.DAY_LENGTH_MS;
        }
    }
}
