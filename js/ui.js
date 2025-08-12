import { G } from './globals.js';
import { CONFIG } from './config.js';
import { getUiIcon } from './helpers.js';

export function populateUI() { 
    G.ui.iconWood.textContent = getUiIcon('wood');
    G.ui.iconStone.textContent = getUiIcon('stone');
    G.ui.iconFood.textContent = getUiIcon('food');
    G.ui.iconSettler.textContent = '🧑';
    G.ui.iconHousing.textContent = '🏠';
    G.ui.iconDay.textContent = '☀️';

    G.ui.jobManagement.innerHTML = '';
    const laborerDiv = document.createElement('div');
    laborerDiv.className = 'flex justify-between items-center mt-2 pt-2 border-t border-gray-600';
    laborerDiv.innerHTML = `<span class="text-gray-300">Dělníci (bez práce)</span><span id="laborerCount" class="text-gray-300 font-semibold">0</span>`;
    
    Object.keys(CONFIG.JOBS).forEach(jobId => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center';
        div.id = `job-control-${jobId}`;
        div.innerHTML = `<span>${CONFIG.JOBS[jobId].name}</span><div class="flex items-center gap-2 job-control"><button class="btn-action" data-job="${jobId}" data-change="-1">-</button><span id="${jobId}Count" class="w-6 text-center">0</span><button class="btn-action" data-job="${jobId}" data-change="1">+</button></div>`;
        G.ui.jobManagement.appendChild(div);
    });
    G.ui.jobManagement.appendChild(laborerDiv);
    
    G.ui.buildManagement.innerHTML = '';
    Object.keys(CONFIG.BUILDINGS).filter(b => b !== 'stockpile' && b !== 'stone_house').forEach(buildId => {
        const b = CONFIG.BUILDINGS[buildId];
        const costString = Object.entries(b.cost).map(([res, val]) => `${val} ${getUiIcon(res)}`).join(' ');
        const button = document.createElement('button');
        button.className = 'btn-action font-bold py-2 px-4 rounded-lg w-full text-left';
        button.dataset.build = buildId;
        button.innerHTML = `${b.name} <span class="text-sm font-normal float-right">${costString}</span>`;
        G.ui.buildManagement.appendChild(button);
    });
    const upgradeHeader = document.createElement('div');
    upgradeHeader.className = 'text-lg font-semibold border-t-2 border-green-700 mt-3 pt-2';
    upgradeHeader.innerText = 'Vylepšení';
    G.ui.buildManagement.appendChild(upgradeHeader);

    Object.keys(CONFIG.UPGRADES).forEach(upgradeId => {
        const u = CONFIG.UPGRADES[upgradeId];
        const costString = Object.entries(u.cost).map(([res, val]) => `${val} ${getUiIcon(res)}`).join(' ');
        const button = document.createElement('button');
        button.className = 'btn-action font-bold py-2 px-4 rounded-lg w-full text-left';
        button.dataset.upgrade = upgradeId;
        button.innerHTML = `${u.name} <span class="text-sm font-normal float-right">${costString}</span>`;
        G.ui.buildManagement.appendChild(button);
    });
}

export function updateUIDisplay() { 
    G.ui.wood.textContent = Math.floor(G.state.resources.wood); 
    G.ui.stone.textContent = Math.floor(G.state.resources.stone);
    G.ui.food.textContent = Math.floor(G.state.resources.food); 
    G.ui.day.textContent = G.state.day;
    G.ui.settlers.textContent = G.state.settlers.length;
    G.ui.housing.textContent = G.state.buildings.reduce((sum, b) => sum + ((b.type === 'hut' || b.type === 'stone_house') && !b.isUnderConstruction && !b.isUpgrading ? CONFIG.BUILDINGS[b.type].housing : 0), 0);
    
    const jobCounts = G.state.settlers.filter(s => !s.isChild).reduce((acc, s) => {
        acc[s.job] = (acc[s.job] || 0) + 1;
        return acc;
    }, {});
    
    document.getElementById('laborerCount').textContent = jobCounts['laborer'] || 0;

    Object.keys(CONFIG.JOBS).forEach(jobId => {
        const el = document.getElementById(`${jobId}Count`);
        if (el) el.textContent = G.state.jobQuotas[jobId];

        const jobInfo = CONFIG.JOBS[jobId];
        const jobControlEl = document.getElementById(`job-control-${jobId}`);
        if (jobInfo.requires) {
            const hasRequiredBuilding = G.state.buildings.some(b => b.type === jobInfo.requires && !b.isUnderConstruction);
            jobControlEl.querySelectorAll('button').forEach(btn => {
                btn.disabled = !hasRequiredBuilding;
                btn.title = btn.disabled ? `Vyžaduje postavit: ${CONFIG.BUILDINGS[jobInfo.requires].name}` : '';
            });
            if (!hasRequiredBuilding && G.state.jobQuotas[jobId] > 0) {
                G.state.jobQuotas[jobId] = 0;
            }
        }
    });
}
