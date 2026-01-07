// Constants
const PRODUCTS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LINES = ['L1', 'L2'];

// State
let state = {
    dailyCapacity: 1000,
    maxBatchSize: 1000,
    maxBatches: 3,
    penaltyWeight: 50,
    costWeight: 50,
    optimizationMethod: 'auto',
    transitionPenalty: [], // 5x5
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

/**
 * Merges saved state into the current defaults to handle property additions.
 */
function loadState() {
    const saved = localStorage.getItem('erp_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Deep merge logic to avoid losing new default properties
            state = { ...state, ...parsed };
            return true;
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }
    return false;
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

        // Bind weights
        const pWeightInput = document.getElementById('penaltyWeight');
        const cWeightInput = document.getElementById('costWeight');

        if (pWeightInput && cWeightInput) {
            pWeightInput.value = state.penaltyWeight;
            cWeightInput.value = state.costWeight;

            pWeightInput.addEventListener('change', (e) => {
                let val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                state.penaltyWeight = val;
                state.costWeight = 100 - val;
                pWeightInput.value = state.penaltyWeight;
                cWeightInput.value = state.costWeight;
                saveState();
            });

            cWeightInput.addEventListener('change', (e) => {
                let val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                state.costWeight = val;
                state.penaltyWeight = 100 - val;
                cWeightInput.value = state.costWeight;
                pWeightInput.value = state.penaltyWeight;
                saveState();
            });
        }

        const engineInput = document.getElementById('optimizationEngine');
        if (engineInput) {
            engineInput.value = state.optimizationMethod || 'auto';
            engineInput.addEventListener('change', (e) => {
                state.optimizationMethod = e.target.value;
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
    // Penalty Grid
    createGrid('transTimeContainer', PRODUCTS.length + 1, PRODUCTS.length + 1, (r, c, cell) => {
        if (r === 0 && c === 0) cell.textContent = 'From\\To';
        else if (r === 0) { cell.textContent = PRODUCTS[c - 1]; cell.classList.add('grid-header'); }
        else if (c === 0) { cell.textContent = PRODUCTS[r - 1]; cell.classList.add('grid-header'); }
        else if (r === c) { cell.textContent = '-'; cell.style.background = '#eee'; }
        else {
            // Init state
            if (!state.transitionPenalty[r - 1]) state.transitionPenalty[r - 1] = [];
            if (state.transitionPenalty[r - 1][c - 1] === undefined) {
                state.transitionPenalty[r - 1][c - 1] = 30;
            }
            const val = state.transitionPenalty[r - 1][c - 1];

            const input = createInput(val, (v) => updateTransition('penalty', r - 1, c - 1, v));
            // Add data attributes for paste support
            input.dataset.row = r - 1;
            input.dataset.col = c - 1;
            input.dataset.grid = 'transitionPenalty';
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
    if (type === 'penalty') state.transitionPenalty[r][c] = val;
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
                    if (gridKey === 'transitionPenalty') state.transitionPenalty[targetRow][targetCol] = numVal;
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

// --- Advanced Optimization Helpers ---

/**
 * Smoothens demand across the week to avoid capacity spikes.
 * Moves excess demand from high-load days to earlier low-load days (if inventory permits)
 * or later days (backlog).
 */
function levelDemand(demandMatrix) {
    let matrix = demandMatrix.map(row => [...row]);
    let totalCap = state.dailyCapacity * 7;

    for (let p = 0; p < 5; p++) {
        let totalDemand = matrix.reduce((sum, row) => sum + row[p], 0);
        let avgDemand = totalDemand / 7;

        // Simple smoothing: if a day is > 1.5x avg, try to move some to neighbors
        for (let d = 0; d < 7; d++) {
            if (matrix[d][p] > avgDemand * 1.2) {
                let excess = matrix[d][p] - avgDemand;
                // Move back if possible (d-1)
                if (d > 0 && matrix[d - 1][p] < avgDemand) {
                    let shift = Math.min(excess, avgDemand - matrix[d - 1][p]);
                    matrix[d - 1][p] += shift;
                    matrix[d][p] -= shift;
                    excess -= shift;
                }
                // Move forward (d+1) - this naturally happens via backlog, but leveling helps sequence
                if (d < 6 && excess > 0 && matrix[d + 1][p] < avgDemand) {
                    let shift = Math.min(excess, avgDemand - matrix[d + 1][p]);
                    matrix[d + 1][p] += shift;
                    matrix[d][p] -= shift;
                }
            }
        }
    }
    return matrix;
}

/**
 * Calculates a "look-ahead" score for a candidate by simulating the next day's potential transitions.
 */
function getLookAheadScore(day, currentP, nextP, demandMatrix, type, weightPenalty, weightCost) {
    if (day >= 6) return 0; // No more days to look ahead

    let nextDayDemand = demandMatrix[day + 1];
    let bestNextScore = Infinity;

    // Check all possible products we might produce on the next day after nextP
    for (let pAfter = 0; pAfter < 5; pAfter++) {
        if (nextDayDemand[pAfter] > 0) {
            let trans = getTransition(nextP, pAfter);
            let score = trans.penalty * weightPenalty + trans.cost * weightCost;
            if (score < bestNextScore) bestNextScore = score;
        }
    }

    return bestNextScore === Infinity ? 0 : bestNextScore * 0.5; // Discounted future cost
}

// --- Scheduler Logic ---

function runOptimization() {
    const types = ['time', 'cost', 'combined', 'lostSales'];
    state.lastResults = {}; // Reset before run

    const strategiesMap = {
        'greedy': { name: 'Greedy (Standard)', solve: solveLine },
        'leveling': { name: 'Production Leveling', solve: (m, t) => solveLine(levelDemand(m), t) },
        'lookahead': { name: 'Multi-day Look-ahead', solve: solveLineLookAhead },
        'search': { name: 'Simulated Annealing (Global)', solve: solveLineSearch }
    };

    types.forEach(type => {
        let bestStrategy;
        if (state.optimizationMethod && state.optimizationMethod !== 'auto') {
            bestStrategy = strategiesMap[state.optimizationMethod];
        } else {
            // Find the best strategy SPECIFICALLY for this type
            bestStrategy = findBestStrategyForType(type);
        }

        state.lastResults[type] = {
            L1: bestStrategy.solve(state.demandL1, type),
            L2: bestStrategy.solve(state.demandL2, type),
            strategyUsed: bestStrategy.name
        };
    });

    switchView('results');
    saveState(); // Save results
    renderCurrentResults();
}

/**
 * Benchmarks all algorithms for a specific optimization goal.
 */
function findBestStrategyForType(type) {
    const strategies = [
        { name: 'Greedy (Standard)', solve: solveLine },
        { name: 'Production Leveling', solve: (m, t) => solveLine(levelDemand(m), t) },
        { name: 'Multi-day Look-ahead', solve: solveLineLookAhead },
        { name: 'Simulated Annealing (Global)', solve: solveLineSearch }
    ];

    let best = strategies[0];
    let minScore = Infinity;

    strategies.forEach(s => {
        try {
            const res = s.solve(state.demandL1, type);
            // Score specifically for the requested goal
            let score = 0;
            if (type === 'time') score = res.totalPenalty;
            else if (type === 'cost') score = res.totalCost;
            else if (type === 'combined') score = (res.totalPenalty * (state.penaltyWeight / 100)) + (res.totalCost * (state.costWeight / 100));
            else if (type === 'lostSales') score = res.totalLostSales;

            // Apply extreme penalty for lost sales in all modes to ensure capacity feasibility
            // Note: If one strategy has 50 lost sales and another has 0, the one with 0 should almost always win.
            score += (res.totalLostSales * 100000);

            if (score < minScore) {
                minScore = score;
                best = s;
            }
        } catch (e) { }
    });

    return best;
}

/**
 * Runs a mini-benchmark to see which algorithm variant performs best for the current data.
 * Tests: Greedy, Leveling+Greedy, Look-Ahead.
 */
function findBestStrategy() {
    const strategies = [
        { name: 'Greedy (Standard)', solve: solveLine },
        { name: 'Production Leveling', solve: (m, t) => solveLine(levelDemand(m), t) },
        { name: 'Multi-day Look-ahead', solve: solveLineLookAhead },
        { name: 'Simulated Annealing (Global)', solve: solveLineSearch }
    ];

    let best = strategies[0];
    let minScore = Infinity;

    // Use L1 demand and 'combined' type as the proxy for "best"
    strategies.forEach(s => {
        try {
            const res = s.solve(state.demandL1, 'combined');
            const score = res.totalPenalty + res.totalCost + (res.totalLostSales * 5000);
            if (score < minScore) {
                minScore = score;
                best = s;
            }
        } catch (e) { console.error(`Strategy ${s.name} failed`, e); }
    });

    return best;
}

function solveLine(demandMatrix, type) {
    let weightPenalty = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') {
        weightPenalty = 1;
    } else if (type === 'cost') {
        weightCost = 1;
    } else if (type === 'combined') {
        weightPenalty = state.penaltyWeight / 100;
        weightCost = state.costWeight / 100;
    } else if (type === 'lostSales') {
        weightLostSales = 1000;
    }

    let inventory = Array(5).fill(0);
    let backlog = Array(5).fill(0);
    let lastProduct = -1;

    let schedule = [];
    let totalPenalty = 0, totalCost = 0, totalLostSales = 0;

    for (let day = 0; day < 7; day++) {
        let daySchedule = [];
        let remainingCapacity = state.dailyCapacity;
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
                let maxPossibleA = remainingCapacity - transA.penalty;
                let producedA = Math.max(0, Math.min(a.mandatory, maxPossibleA, state.maxBatchSize));
                let capacityUsedA = transA.penalty + producedA;
                let scoreA = capacityUsedA > 0 ? (producedA / capacityUsedA) : 0;

                // Calculate potential production for B
                let maxPossibleB = remainingCapacity - transB.penalty;
                let producedB = Math.max(0, Math.min(b.mandatory, maxPossibleB, state.maxBatchSize));
                let capacityUsedB = transB.penalty + producedB;
                let scoreB = capacityUsedB > 0 ? (producedB / capacityUsedB) : 0;

                if (Math.abs(scoreA - scoreB) > 0.0001) {
                    return scoreB - scoreA; // Descending Score
                }

                // Tie-breaker: Absolute amount cleared
                if (producedA !== producedB) return producedB - producedA;
            }

            // Priority 3: Minimize Transition Cost/Penalty (Standard Efficiency)
            let costA = transA.penalty * weightPenalty + transA.cost * weightCost;
            let costB = transB.penalty * weightPenalty + transB.cost * weightCost;

            return costA - costB;
        });

        // Produce
        for (let cand of candidates) {
            if (batchesToday >= state.maxBatches) break; // Constraint Check

            let p = cand.p;
            let amountNeeded = cand.mandatory + cand.desirable;
            let trans = getTransition(lastProduct, p);

            // Transition Calculation (Minutes, does not consume Units capacity)
            if (lastProduct !== p && lastProduct !== -1) {
                totalPenalty += trans.penalty;
                totalCost += trans.cost;
            }
            lastProduct = p;

            // Production (Consumes Units capacity)
            let maxPossible = remainingCapacity;
            let amountToProduce = Math.min(amountNeeded, maxPossible, state.maxBatchSize);

            if (amountToProduce > 0) {
                remainingCapacity -= amountToProduce;
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
            let unmet = c.mandatory + c.desirable;
            if (unmet > 0) {
                totalLostSales += unmet;
                dayLostSales[c.p] = unmet;
                backlog[c.p] = 0; // Everything unmet is LOST immediately
            }
        });

        schedule.push({
            day,
            events: daySchedule,
            inventory: dayInventory,
            lostSales: dayLostSales
        });
    }

    return { schedule, totalPenalty, totalCost, totalLostSales };
}

/**
 * Enhanced Solver with Multi-day Look-ahead
 */
function solveLineLookAhead(demandMatrix, type) {
    let weightPenalty = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') weightPenalty = 1;
    else if (type === 'cost') weightCost = 1;
    else if (type === 'combined') { weightPenalty = state.penaltyWeight / 100; weightCost = state.costWeight / 100; }
    else if (type === 'lostSales') weightLostSales = 1000;

    let inventory = Array(5).fill(0);
    let backlog = Array(5).fill(0);
    let lastProduct = -1;
    let schedule = [];
    let totalPenalty = 0, totalCost = 0, totalLostSales = 0;

    for (let day = 0; day < 7; day++) {
        let daySchedule = [];
        let remainingCapacity = state.dailyCapacity;
        let batchesToday = 0;
        let candidates = [];

        for (let p = 0; p < 5; p++) {
            let demandToday = demandMatrix[day][p];
            if (inventory[p] >= demandToday) { inventory[p] -= demandToday; demandToday = 0; }
            else { demandToday -= inventory[p]; inventory[p] = 0; }
            let mandatory = backlog[p], desirable = demandToday;
            if (mandatory > 0 || desirable > 0) candidates.push({ p, mandatory, desirable });
        }

        candidates.sort((a, b) => {
            if (a.mandatory > 0 && b.mandatory === 0) return -1;
            if (b.mandatory > 0 && a.mandatory === 0) return 1;

            let transA = getTransition(lastProduct, a.p);
            let transB = getTransition(lastProduct, b.p);

            // Added Look-ahead weight to the standard transition cost
            let scoreA = (transA.penalty * weightPenalty + transA.cost * weightCost) +
                getLookAheadScore(day, lastProduct, a.p, demandMatrix, type, weightPenalty, weightCost);
            let scoreB = (transB.penalty * weightPenalty + transB.cost * weightCost) +
                getLookAheadScore(day, lastProduct, b.p, demandMatrix, type, weightPenalty, weightCost);

            return scoreA - scoreB;
        });

        for (let cand of candidates) {
            if (batchesToday >= state.maxBatches) break;
            let trans = getTransition(lastProduct, cand.p);
            // Transition Calculation (Minutes, does not consume Units capacity)
            if (lastProduct !== cand.p && lastProduct !== -1) {
                totalPenalty += trans.penalty;
                totalCost += trans.cost;
            }
            lastProduct = cand.p;

            // Production (Consumes Units capacity)
            let amountToProduce = Math.min(cand.mandatory + cand.desirable, remainingCapacity, state.maxBatchSize);
            if (amountToProduce > 0) {
                remainingCapacity -= amountToProduce;
                batchesToday++;
                daySchedule.push({ p: cand.p, amount: amountToProduce });
                let produced = amountToProduce;
                if (cand.mandatory > 0) { let met = Math.min(produced, cand.mandatory); cand.mandatory -= met; produced -= met; backlog[cand.p] -= met; }
                if (produced > 0) { let metToday = Math.min(produced, cand.desirable); cand.desirable -= metToday; produced -= metToday; inventory[cand.p] += produced; }
            }
        }

        let dayInventory = [...inventory], dayLostSales = Array(5).fill(0);
        candidates.forEach(c => {
            if (c.mandatory > 0) { totalLostSales += c.mandatory; dayLostSales[c.p] = c.mandatory; backlog[c.p] = 0; }
            if (c.desirable > 0) backlog[c.p] += c.desirable;
        });
        schedule.push({ day, events: daySchedule, inventory: dayInventory, lostSales: dayLostSales });
    }
    return { schedule, totalPenalty, totalCost, totalLostSales };
}

/**
 * Global Optimization using Simulated Annealing.
 * Explores multiple production sequences to find a better global path.
 */
function solveLineSearch(demandMatrix, type) {
    let bestRes = null;
    let minScore = Infinity;

    // Run 100 iterations with randomization
    for (let i = 0; i < 100; i++) {
        const res = solveLineRandomized(demandMatrix, type, 0.15); // 15% randomness
        const score = res.totalPenalty + res.totalCost + (res.totalLostSales * 100000);
        if (score < minScore) {
            minScore = score;
            bestRes = res;
        }
    }
    return bestRes;
}

/**
 * Standard solveLine but with a "temperature" for random picking.
 */
function solveLineRandomized(demandMatrix, type, randomness = 0.1) {
    let weightPenalty = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') weightPenalty = 1;
    else if (type === 'cost') weightCost = 1;
    else if (type === 'combined') { weightPenalty = state.penaltyWeight / 100; weightCost = state.costWeight / 100; }
    else if (type === 'lostSales') weightLostSales = 1000;

    let inventory = Array(5).fill(0), backlog = Array(5).fill(0), lastProduct = -1;
    let schedule = [], totalPenalty = 0, totalCost = 0, totalLostSales = 0;

    for (let day = 0; day < 7; day++) {
        let daySchedule = [], remainingCapacity = state.dailyCapacity, batchesToday = 0, candidates = [];

        for (let p = 0; p < 5; p++) {
            let demandToday = demandMatrix[day][p];
            if (inventory[p] >= demandToday) { inventory[p] -= demandToday; demandToday = 0; }
            else { demandToday -= inventory[p]; inventory[p] = 0; }
            let mandatory = backlog[p], desirable = demandToday;
            if (mandatory > 0 || desirable > 0) candidates.push({ p, mandatory, desirable });
        }

        while (candidates.length > 0 && batchesToday < state.maxBatches) {
            // Sort by score
            candidates.sort((a, b) => {
                let sA = (getTransition(lastProduct, a.p).penalty * weightPenalty + getTransition(lastProduct, a.p).cost * weightCost);
                let sB = (getTransition(lastProduct, b.p).penalty * weightPenalty + getTransition(lastProduct, b.p).cost * weightCost);
                if (a.mandatory > 0 && b.mandatory === 0) return -1;
                if (b.mandatory > 0 && a.mandatory === 0) return 1;
                return sA - sB;
            });

            // With chance 'randomness', pick a random candidate instead of the best
            let idx = (Math.random() < randomness) ? Math.floor(Math.random() * candidates.length) : 0;
            let cand = candidates.splice(idx, 1)[0];

            let trans = getTransition(lastProduct, cand.p);
            // Transition Calculation (Minutes, does not consume Units capacity)
            if (lastProduct !== cand.p && lastProduct !== -1) {
                totalPenalty += trans.penalty;
                totalCost += trans.cost;
            }
            lastProduct = cand.p;

            // Production (Consumes Units capacity)
            let amountToProduce = Math.min(cand.mandatory + cand.desirable, remainingCapacity, state.maxBatchSize);
            if (amountToProduce > 0) {
                remainingCapacity -= amountToProduce;
                batchesToday++;
                daySchedule.push({ p: cand.p, amount: amountToProduce });
                let produced = amountToProduce;
                if (cand.mandatory > 0) { let met = Math.min(produced, cand.mandatory); cand.mandatory -= met; produced -= met; backlog[cand.p] -= met; }
                if (produced > 0) { let metToday = Math.min(produced, cand.desirable); cand.desirable -= metToday; produced -= metToday; inventory[cand.p] += produced; }
            }
        }

        let dayInventory = [...inventory], dayLostSales = Array(5).fill(0);
        candidates.forEach(c => {
            let unmet = c.mandatory + c.desirable;
            if (unmet > 0) {
                totalLostSales += unmet;
                dayLostSales[c.p] = unmet;
                backlog[c.p] = 0;
            }
        });
        schedule.push({ day, events: daySchedule, inventory: dayInventory, lostSales: dayLostSales });
    }
    return { schedule, totalPenalty, totalCost, totalLostSales };
}

function getTransition(fromP, toP) {
    if (fromP === -1 || fromP === toP) return { penalty: 0, cost: 0 };
    return {
        penalty: state.transitionPenalty[fromP][toP] || 0,
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
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Performance Summary (${type})</h3>
                <div style="text-align:right">
                    <div style="font-size:0.9em; color:#666; margin-bottom:4px;">
                        Strategy: 
                        <select id="strategySelector" onchange="state.optimizationMethod = this.value; saveState(); runOptimization();" style="font-weight:bold; border:1px solid #ccc; border-radius:4px; padding:2px 4px; background:white;">
                            <option value="auto" ${state.optimizationMethod === 'auto' ? 'selected' : ''}>Auto-Select (Best Performer)</option>
                            <option value="greedy" ${state.optimizationMethod === 'greedy' ? 'selected' : ''}>Standard Greedy</option>
                            <option value="leveling" ${state.optimizationMethod === 'leveling' ? 'selected' : ''}>Production Leveling</option>
                            <option value="lookahead" ${state.optimizationMethod === 'lookahead' ? 'selected' : ''}>Multi-day Look-ahead</option>
                            <option value="search" ${state.optimizationMethod === 'search' ? 'selected' : ''}>Global Search (Simulated Annealing)</option>
                        </select>
                    </div>
                    <div style="font-size:0.8rem; color:#888;">
                        Used: <strong>${res.strategyUsed || 'Unknown'}</strong>
                        ${type === 'combined' ? ` | Weights: ${state.penaltyWeight}% / ${state.costWeight}%` : ''}
                    </div>
                </div>
            </div>
            <div class="form-row" style="margin-top:10px;">
                <div class="stat-box"><div class="stat-value">${(res.L1.totalPenalty + res.L2.totalPenalty).toFixed(0)} min</div><div class="stat-label">Total Transit Time</div></div>
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
    const lineId = title.includes('Line 1') ? 'L1' : 'L2';
    let html = `<div class="card full-width">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #eee; margin-bottom: 10px; padding-bottom: 10px;">
            <h3 style="margin:0; border:none; padding:0;">${title}</h3>
            <button class="secondary-btn" onclick="copyLineToClipboard('${lineId}')" title="Copy for Excel">
                <svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" /></svg>
                Copy for Excel
            </button>
        </div>
        <table class="result-table">`;
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

function copyLineToClipboard(lineId) {
    const type = document.getElementById('optGoal').value;
    if (!state.lastResults || !state.lastResults[type]) return;

    const res = state.lastResults[type][lineId];
    if (!res) return;

    // Build TSV string
    let tsv = "Day\tBatch 1\tBatch 2\tBatch 3\n";

    res.schedule.forEach(d => {
        let row = [DAYS[d.day]];
        for (let i = 0; i < 3; i++) {
            const event = d.events[i];
            if (event) {
                row.push(`${PRODUCTS[event.p]}: ${event.amount} units`);
            } else {
                row.push("-");
            }
        }
        tsv += row.join("\t") + "\n";
    });

    navigator.clipboard.writeText(tsv).then(() => {
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.innerHTML = "Copied!";
        btn.classList.add('success-btn');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('success-btn');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    });
}

// --- Dashboard Logic ---

function renderDashboard() {
    if (!state.lastResults) return;

    const line = document.getElementById('dashLine').value; // L1 or L2
    const types = ['time', 'cost', 'combined', 'lostSales'];
    const typeLabels = { time: 'Min Transit Time', cost: 'Min Cost', combined: 'Combined', lostSales: 'Min Lost Sales' };

    // 1. Comparison Chart
    const chartContainer = document.getElementById('comparisonChart');
    let chartHtml = '';

    // Find max values for normalization
    let maxPenalty = 0, maxCost = 0, maxLost = 0;
    types.forEach(t => {
        const res = state.lastResults[t][line];
        if (res.totalPenalty > maxPenalty) maxPenalty = res.totalPenalty;
        if (res.totalCost > maxCost) maxCost = res.totalCost;
        if (res.totalLostSales > maxLost) maxLost = res.totalLostSales;
    });

    types.forEach(t => {
        const res = state.lastResults[t][line];

        // Calculate heights (percentage)
        const hPenalty = maxPenalty ? (res.totalPenalty / maxPenalty) * 100 : 0;
        const hCost = maxCost ? (res.totalCost / maxCost) * 100 : 0;
        const hLost = maxLost ? (res.totalLostSales / maxLost) * 100 : 0;

        chartHtml += `
            <div class="chart-group">
                <div class="chart-bars">
                    <div class="bar time" style="height: ${Math.max(hPenalty, 5)}%" data-value="Transit Time: ${res.totalPenalty} min"></div>
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
                <div class="legend-item"><div class="dot" style="background:#3498db"></div> Transit Time (min)</div>
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
