// Constants
const PRODUCTS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LINES = ['L1', 'L2'];

// State
let state = {
    dailyCapacity: 480,
    maxBatchSize: 1000,
    maxBatches: 3,
    transitionTime: [], // 5x5
    transitionCost: [], // 5x5
    demandL1: [], // 7 Days x 5 Products (Transposed)
    demandL2: [], // 7 Days x 5 Products (Transposed)
    lastResults: null // Store results to switch views
};

const STATE_KEY = 'production_sequencer_state_v2';

function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save state", e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STATE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge loaded state with default structure to ensure compatibility
            state = { ...state, ...parsed };
            console.log("State loaded from storage");
        }
    } catch (e) {
        console.error("Failed to load state", e);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Initializing app...");
        loadState(); // Load state before init

        initTransitionGrids();
        initDemandGrids();

        // Bind global inputs
        const capInput = document.getElementById('dailyCapacity');
        if (capInput) {
            capInput.value = state.dailyCapacity; // Restore value
            capInput.addEventListener('change', (e) => {
                state.dailyCapacity = parseInt(e.target.value) || 0;
                saveState();
            });
        }

        const batchInput = document.getElementById('maxBatchSize');
        if (batchInput) {
            batchInput.value = state.maxBatchSize; // Restore value
            batchInput.addEventListener('change', (e) => {
                state.maxBatchSize = parseInt(e.target.value) || 0;
                saveState();
            });
        }

        // Add global paste listener to handle pasting into grids
        document.addEventListener('paste', handlePaste);
        console.log("App initialized successfully.");
    } catch (e) {
        console.error("Init Error:", e);
        document.body.innerHTML += `<div style="color:red; padding:20px; border:1px solid red; background:#xffeeb;">Error initializing app: ${e.message}<br><pre>${e.stack}</pre></div>`;
    }
});

window.onerror = function (msg, url, line, col, error) {
    document.body.innerHTML += `<div style="color:red; padding:20px; border:1px solid red; background:#xffeeb;">Global Error: ${msg} at line ${line}:${col}<br><pre>${error ? error.stack : ''}</pre></div>`;
    return false;
};

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById(viewId).classList.add('active');
    // Find nav button
    const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.getAttribute('onclick').includes(viewId));
    if (btn) btn.classList.add('active');

    if (viewId === 'results') renderCurrentResults();
    if (viewId === 'dashboard') renderDashboard();
}

// --- Grid Initialization ---

function initTransitionGrids() {
    // Time Grid
    createGrid('transTimeContainer', PRODUCTS.length + 1, PRODUCTS.length + 1, (r, c, cell) => {
        if (r === 0 && c === 0) cell.textContent = 'From\\To';
        else if (r === 0) { cell.textContent = PRODUCTS[c - 1]; cell.classList.add('grid-header'); }
        else if (c === 0) { cell.textContent = PRODUCTS[r - 1]; cell.classList.add('grid-header'); }
        else if (r === c) { cell.textContent = '-'; cell.style.background = '#eee'; }
        else {
            // Init state
            if (!state.transitionTime[r - 1]) state.transitionTime[r - 1] = [];
            if (state.transitionTime[r - 1][c - 1] === undefined) {
                state.transitionTime[r - 1][c - 1] = 30;
            }
            const val = state.transitionTime[r - 1][c - 1];

            const input = createInput(val, (v) => updateTransition('time', r - 1, c - 1, v));
            // Add data attributes for paste support
            input.dataset.row = r - 1;
            input.dataset.col = c - 1;
            input.dataset.grid = 'transitionTime';
            cell.appendChild(input);
        }
    });

    // Cost Grid
    createGrid('transCostContainer', PRODUCTS.length + 1, PRODUCTS.length + 1, (r, c, cell) => {
        if (r === 0 && c === 0) cell.textContent = 'From\\To';
        else if (r === 0) { cell.textContent = PRODUCTS[c - 1]; cell.classList.add('grid-header'); }
        else if (c === 0) { cell.textContent = PRODUCTS[r - 1]; cell.classList.add('grid-header'); }
        else if (r === c) { cell.textContent = '-'; cell.style.background = '#eee'; }
        else {
            // Init state
            if (!state.transitionCost[r - 1]) state.transitionCost[r - 1] = [];
            if (state.transitionCost[r - 1][c - 1] === undefined) {
                state.transitionCost[r - 1][c - 1] = 100;
            }
            const val = state.transitionCost[r - 1][c - 1];

            const input = createInput(val, (v) => updateTransition('cost', r - 1, c - 1, v));
            // Add data attributes for paste support
            input.dataset.row = r - 1;
            input.dataset.col = c - 1;
            input.dataset.grid = 'transitionCost';
            cell.appendChild(input);
        }
    });
}

function updateTransition(type, r, c, val) {
    if (type === 'time') state.transitionTime[r][c] = val;
    if (type === 'cost') state.transitionCost[r][c] = val;
    saveState();
}

function initDemandGrids() {
    // Transposed: Rows = Days, Cols = Products
    // Grid size: (7 Days + 1 Header) x (5 Products + 1 Header)

    const setupDemandGrid = (containerId, stateKey) => {
        // Init 7x5 if undefined or empty
        if (!state[stateKey] || state[stateKey].length === 0) {
            state[stateKey] = Array(7).fill().map(() => Array(5).fill(100));
        }
        // Ensure sub-arrays exist (integrity check)
        for (let i = 0; i < 7; i++) {
            if (!state[stateKey][i]) state[stateKey][i] = Array(5).fill(100);
        }

        createGrid(containerId, DAYS.length + 1, PRODUCTS.length + 1, (r, c, cell) => {
            if (r === 0 && c === 0) cell.textContent = 'Day\\Prod';
            else if (r === 0) { cell.textContent = PRODUCTS[c - 1]; cell.classList.add('grid-header'); }
            else if (c === 0) { cell.textContent = DAYS[r - 1]; cell.classList.add('grid-header'); }
            else {
                // r-1 is Day Index, c-1 is Product Index
                const val = state[stateKey][r - 1][c - 1];
                const input = createInput(val, (v) => {
                    state[stateKey][r - 1][c - 1] = v;
                    saveState();
                });
                input.dataset.row = r - 1;
                input.dataset.col = c - 1;
                input.dataset.grid = stateKey; // Mark for paste handler
                cell.appendChild(input);
            }
        });
    };

    setupDemandGrid('demandL1Container', 'demandL1');
    setupDemandGrid('demandL2Container', 'demandL2');
}

function createGrid(containerId, rows, cols, cellCallback) {
    const container = document.getElementById(containerId);
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.innerHTML = '';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cellCallback(r, c, cell);
            container.appendChild(cell);
        }
    }
}

function createInput(defaultVal, changeCallback) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = defaultVal;
    input.addEventListener('change', (e) => changeCallback(parseInt(e.target.value) || 0));
    return input;
}

// --- Excel Paste Support ---

function handlePaste(e) {
    // Find target input
    let target = e.target;
    // If user clicked the cell div, try to find the input inside
    if (!target.matches('input[data-grid]')) {
        target = target.querySelector('input[data-grid]');
    }

    if (!target || !target.matches('input[data-grid]')) return;

    e.preventDefault();
    const clipboardData = (e.clipboardData || window.clipboardData).getData('text');

    // Split by newline (rows) and tab (cols)
    const rows = clipboardData.split(/\r\n|\n|\r/).filter(r => r.trim() !== '');

    const startRow = parseInt(target.dataset.row);
    const startCol = parseInt(target.dataset.col);
    const gridKey = target.dataset.grid;

    // Find all inputs in this grid container
    const container = target.closest('.spreadsheet-grid');
    const inputs = Array.from(container.querySelectorAll('input[data-grid]'));

    let updatedCount = 0;

    rows.forEach((rowData, rIdx) => {
        const values = rowData.split('\t');
        values.forEach((val, cIdx) => {
            const targetRow = startRow + rIdx;
            const targetCol = startCol + cIdx;

            // Find input at this coordinate
            const input = inputs.find(i => parseInt(i.dataset.row) === targetRow && parseInt(i.dataset.col) === targetCol);

            if (input) {
                const numVal = parseInt(val.trim());
                if (!isNaN(numVal)) {
                    input.value = numVal;
                    input.style.backgroundColor = '#e8f0fe'; // Visual feedback
                    setTimeout(() => input.style.backgroundColor = '', 500);

                    // Update state
                    if (gridKey === 'transitionTime') state.transitionTime[targetRow][targetCol] = numVal;
                    else if (gridKey === 'transitionCost') state.transitionCost[targetRow][targetCol] = numVal;
                    else state[gridKey][targetRow][targetCol] = numVal;

                    saveState();

                    updatedCount++;
                }
            }
        });
    });

    console.log(`Pasted ${updatedCount} values into ${gridKey}`);
}

// --- Scheduler Logic ---

function runOptimization() {
    const types = ['time', 'cost', 'combined', 'lostSales'];
    state.lastResults = {}; // Reset before run


    types.forEach(type => {
        state.lastResults[type] = {
            L1: solveLine(state.demandL1, type),
            L2: solveLine(state.demandL2, type)
        };
    });

    switchView('results');
    saveState(); // Save results
    renderCurrentResults();
}

function solveLine(demandMatrix, type) {
    let weightTime = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') weightTime = 1;
    else if (type === 'cost') weightCost = 1;
    else if (type === 'combined') { weightTime = 1; weightCost = 1; }
    else if (type === 'lostSales') { weightLostSales = 1000; }

    let inventory = Array(5).fill(0);
    let backlog = Array(5).fill(0);
    let lastProduct = -1;

    let schedule = [];
    let totalTime = 0, totalCost = 0, totalLostSales = 0;

    for (let day = 0; day < 7; day++) {
        let daySchedule = [];
        let remainingTime = state.dailyCapacity;
        let batchesToday = 0;

        // Candidates logic
        let candidates = [];
        for (let p = 0; p < 5; p++) {
            let demandToday = demandMatrix[day][p];

            // Use inventory
            if (inventory[p] >= demandToday) {
                inventory[p] -= demandToday;
                demandToday = 0;
            } else {
                demandToday -= inventory[p];
                inventory[p] = 0;
            }

            let mandatory = backlog[p];
            let desirable = demandToday;

            if (mandatory > 0 || desirable > 0) {
                candidates.push({ p, mandatory, desirable });
            }
        }

        // Sort candidates
        candidates.sort((a, b) => {
            // Priority 1: Has Backlog (Mandatory)
            if (a.mandatory > 0 && b.mandatory === 0) return -1;
            if (b.mandatory > 0 && a.mandatory === 0) return 1;

            let transA = getTransition(lastProduct, a.p);
            let transB = getTransition(lastProduct, b.p);

            // Priority 2 (Only for Lost Sales optimization): Density Heuristic (Benefit / Cost)
            if (type === 'lostSales') {
                // Calculate potential production for A
                let maxPossibleA = remainingTime - transA.time;
                let producedA = Math.max(0, Math.min(a.mandatory, maxPossibleA, state.maxBatchSize));
                let timeSpentA = transA.time + producedA;
                let scoreA = timeSpentA > 0 ? (producedA / timeSpentA) : 0;

                // Calculate potential production for B
                let maxPossibleB = remainingTime - transB.time;
                let producedB = Math.max(0, Math.min(b.mandatory, maxPossibleB, state.maxBatchSize));
                let timeSpentB = transB.time + producedB;
                let scoreB = timeSpentB > 0 ? (producedB / timeSpentB) : 0;

                if (Math.abs(scoreA - scoreB) > 0.0001) {
                    return scoreB - scoreA; // Descending Score
                }

                // Tie-breaker: Absolute amount cleared
                if (producedA !== producedB) return producedB - producedA;
            }

            // Priority 3: Minimize Transition Cost/Time (Standard Efficiency)
            let costA = transA.time * weightTime + transA.cost * weightCost;
            let costB = transB.time * weightTime + transB.cost * weightCost;

            return costA - costB;
        });

        // Produce
        for (let cand of candidates) {
            if (batchesToday >= state.maxBatches) break; // Constraint Check

            let p = cand.p;
            let amountNeeded = cand.mandatory + cand.desirable;
            let trans = getTransition(lastProduct, p);

            if (remainingTime < trans.time) break;

            // Transition
            if (lastProduct !== p && lastProduct !== -1) {
                remainingTime -= trans.time;
                totalTime += trans.time;
                totalCost += trans.cost;
            }
            lastProduct = p;

            // Production
            let maxPossible = remainingTime;
            let amountToProduce = Math.min(amountNeeded, maxPossible, state.maxBatchSize);

            if (amountToProduce > 0) {
                remainingTime -= amountToProduce;
                batchesToday++;

                daySchedule.push({ p: p, amount: amountToProduce });

                // Update Backlog/Inventory
                let produced = amountToProduce;
                if (cand.mandatory > 0) {
                    let met = Math.min(produced, cand.mandatory);
                    cand.mandatory -= met;
                    produced -= met;
                    backlog[p] -= met;
                }
                if (produced > 0) {
                    let metToday = Math.min(produced, cand.desirable);
                    cand.desirable -= metToday;
                    produced -= metToday;
                    inventory[p] += produced;
                }
            }
        }

        // End of day
        let dayInventory = [...inventory];
        let dayLostSales = Array(5).fill(0);

        candidates.forEach(c => {
            if (c.mandatory > 0) {
                totalLostSales += c.mandatory;
                dayLostSales[c.p] = c.mandatory;
                backlog[c.p] = 0; // Lost sales are lost, not backlogged (assuming per user request "Total lost sales")
                // Or should it be backlogged? Usually lost sales means lost.
                // Let's assume lost sales are cleared from backlog.
            }
            if (c.desirable > 0) {
                backlog[c.p] += c.desirable;
            }
        });

        schedule.push({
            day,
            events: daySchedule,
            inventory: dayInventory,
            lostSales: dayLostSales
        });
    }

    return { schedule, totalTime, totalCost, totalLostSales };
}

function getTransition(fromP, toP) {
    if (fromP === -1 || fromP === toP) return { time: 0, cost: 0 };
    return {
        time: state.transitionTime[fromP][toP] || 0,
        cost: state.transitionCost[fromP][toP] || 0
    };
}

// --- Rendering ---

function renderCurrentResults() {
    const type = document.getElementById('optGoal').value;
    const container = document.getElementById('resultsContent');

    if (!state.lastResults) return;
    const res = state.lastResults[type];
    if (!res) return;

    let html = `
        <div class="card full-width">
            <h3>Performance Summary (${type})</h3>
            <div class="form-row">
                <div class="stat-box"><div class="stat-value">${res.L1.totalTime + res.L2.totalTime} min</div><div class="stat-label">Total Transit Time</div></div>
                <div class="stat-box"><div class="stat-value">$${res.L1.totalCost + res.L2.totalCost}</div><div class="stat-label">Total Transit Cost</div></div>
                <div class="stat-box"><div class="stat-value">${res.L1.totalLostSales + res.L2.totalLostSales} units</div><div class="stat-label">Lost Sales</div></div>
            </div>
        </div>
    `;

    html += renderLineTable('Line 1 Schedule', res.L1);
    html += renderLineTable('Line 2 Schedule', res.L2);

    container.innerHTML = html;
}

function renderLineTable(title, res) {
    let html = `<div class="card full-width"><h3>${title}</h3><table class="result-table">`;
    html += `<thead><tr>
        <th style="width:100px">Day</th>
        <th>Batch 1</th>
        <th>Batch 2</th>
        <th>Batch 3</th>
    </tr></thead><tbody>`;

    res.schedule.forEach(d => {
        html += `<tr><td>${DAYS[d.day]}</td>`;

        // Fill up to 3 batches
        for (let i = 0; i < 3; i++) {
            const event = d.events[i];
            if (event) {
                html += `<td><strong>${PRODUCTS[event.p]}</strong>: ${event.amount} units</td>`;
            } else {
                html += `<td><span style="color:#ccc">-</span></td>`;
            }
        }
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

// --- Dashboard Logic ---

function renderDashboard() {
    if (!state.lastResults) return;

    const line = document.getElementById('dashLine').value; // L1 or L2
    const types = ['time', 'cost', 'combined', 'lostSales'];
    const typeLabels = { time: 'Min Time', cost: 'Min Cost', combined: 'Combined', lostSales: 'Min Lost Sales' };

    // 1. Comparison Chart
    const chartContainer = document.getElementById('comparisonChart');
    let chartHtml = '';

    // Find max values for normalization
    let maxTime = 0, maxCost = 0, maxLost = 0;
    types.forEach(t => {
        const res = state.lastResults[t][line];
        if (res.totalTime > maxTime) maxTime = res.totalTime;
        if (res.totalCost > maxCost) maxCost = res.totalCost;
        if (res.totalLostSales > maxLost) maxLost = res.totalLostSales;
    });

    types.forEach(t => {
        const res = state.lastResults[t][line];

        // Calculate heights (percentage)
        const hTime = maxTime ? (res.totalTime / maxTime) * 100 : 0;
        const hCost = maxCost ? (res.totalCost / maxCost) * 100 : 0;
        const hLost = maxLost ? (res.totalLostSales / maxLost) * 100 : 0;

        chartHtml += `
            <div class="chart-group">
                <div class="chart-bars">
                    <div class="bar time" style="height: ${Math.max(hTime, 5)}%" data-value="Time: ${res.totalTime}m"></div>
                    <div class="bar cost" style="height: ${Math.max(hCost, 5)}%" data-value="Cost: $${res.totalCost}"></div>
                    <div class="bar lost" style="height: ${Math.max(hLost, 5)}%" data-value="Lost: ${res.totalLostSales}"></div>
                </div>
                <div class="chart-label">${typeLabels[t]}</div>
            </div>
        `;
    });

    // Add Legend
    chartContainer.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; align-items:center;">
            <div class="legend">
                <div class="legend-item"><div class="dot" style="background:#3498db"></div> Time</div>
                <div class="legend-item"><div class="dot" style="background:#e74c3c"></div> Cost</div>
                <div class="legend-item"><div class="dot" style="background:#f1c40f"></div> Lost Sales</div>
            </div>
            <div style="display:flex; width:100%; justify-content:space-around; align-items:flex-end; height:100%;">
                ${chartHtml}
            </div>
        </div>
    `;

    // 2. Inventory & Lost Sales Tables
    const currentOpt = document.getElementById('optGoal').value || 'combined';
    const currentRes = state.lastResults[currentOpt][line];

    renderDataTable('dashInventory', currentRes.schedule, 'inventory', `Inventory Levels (${typeLabels[currentOpt]})`);
    renderDataTable('dashLostSales', currentRes.schedule, 'lostSales', `Lost Sales (${typeLabels[currentOpt]})`);
}

function renderDataTable(containerId, schedule, key, title) {
    const container = document.getElementById(containerId);
    let html = `<p style="margin-bottom:5px; font-weight:bold; color:#666;">${title}</p>`;
    html += `<table class="dash-table"><thead><tr><th>Product</th>`;
    DAYS.forEach(d => html += `<th>${d}</th>`);
    html += `</tr></thead><tbody>`;

    PRODUCTS.forEach((p, pIdx) => {
        html += `<tr><td>${p}</td>`;
        schedule.forEach(day => {
            html += `<td>${day[key][pIdx]}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}
