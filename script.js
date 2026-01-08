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
    demandL2: [], // 7 Days x 5 Products (Transposed)
    timeWeight: 50,
    costWeight: 50,
    lastResults: null
};

let chartInstances = {};

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

        // --- Sidebar Resizer Logic ---
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isResizing) return;
            // Limit width based on container boundaries
            const newWidth = Math.max(150, Math.min(e.clientX, 500));
            sidebar.style.width = newWidth + 'px';

            // Re-render chart if it's visible so it fits new width
            requestAnimationFrame(() => {
                Object.values(chartInstances).forEach(chart => chart.resize());
            });
        }

        function onMouseUp() {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }


        const batchInput = document.getElementById('maxBatchSize');
        if (batchInput) {
            batchInput.value = state.maxBatchSize; // Restore value
            batchInput.addEventListener('change', (e) => {
                state.maxBatchSize = parseInt(e.target.value) || 0;
                saveState();
            });
        }

        const timeWeightInput = document.getElementById('timeWeight');
        const costWeightInput = document.getElementById('costWeight');

        if (timeWeightInput && costWeightInput) {
            timeWeightInput.value = state.timeWeight;
            costWeightInput.value = state.costWeight;

            timeWeightInput.addEventListener('change', (e) => {
                let val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                state.timeWeight = val;
                state.costWeight = 100 - val;
                timeWeightInput.value = state.timeWeight;
                costWeightInput.value = state.costWeight;
                saveState();
            });

            costWeightInput.addEventListener('change', (e) => {
                let val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                state.costWeight = val;
                state.timeWeight = 100 - val;
                costWeightInput.value = state.costWeight;
                timeWeightInput.value = state.timeWeight;
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
    state.lastResults = {};

    types.forEach(type => {
        try {
            state.lastResults[type] = {
                L1: solveLineGlobal(state.demandL1, type),
                L2: solveLineGlobal(state.demandL2, type),
                strategyUsed: 'Global Branch & Bound (Exact)'
            };
        } catch (e) {
            console.error(`Error optimizing for ${type}:`, e);
            alert(`Error during ${type} optimization: ${e.message}`);
            state.lastResults[type] = {
                L1: { schedule: [], totalTime: 0, totalCost: 0, totalLostSales: 0 },
                L2: { schedule: [], totalTime: 0, totalCost: 0, totalLostSales: 0 },
                strategyUsed: 'Error'
            };
        }
    });

    try {
        switchView('results');
        saveState();
        renderCurrentResults();
    } catch (e) {
        console.error("Render Error:", e);
    }
}

/**
 * Global Branch & Bound Solver
 * Guarantees the absolute minimum based on the week-long objective function.
 */
function solveLineGlobal(demandMatrix, objectiveType) {
    let bestTotalScore = Infinity;
    let bestResult = null;
    let nodesExplored = 0;
    const MAX_NODES = 50000; // Safety limit to prevent browser hang

    // Weights for Combined Mode
    const wTime = objectiveType === 'combined' ? state.timeWeight / 100 : (objectiveType === 'time' ? 1 : 0);
    const wCost = objectiveType === 'combined' ? state.costWeight / 100 : (objectiveType === 'cost' ? 1 : 0);

    /**
     * Recursive search with pruning
     */
    function branchAndBound(day, inventory, backlog, lastProduct, currentPath, currentStats) {
        nodesExplored++;
        if (nodesExplored > MAX_NODES) return;

        if (day === 7) {
            let score = 0;
            const endingBacklogVal = backlog.reduce((a, b) => a + b, 0);

            if (objectiveType === 'lostSales') {
                // Include ending backlog in lost sales score as it represents future lost sales for repeated demand
                score = ((currentStats.totalLostSales + endingBacklogVal) * 1000000) + currentStats.totalTime;
            } else {
                // For other modes, we still penalize ending backlog to ensure demand is satisfied
                score = (currentStats.totalTime * wTime) + (currentStats.totalCost * wCost) + (endingBacklogVal * 1000);
            }

            if (score < bestTotalScore) {
                bestTotalScore = score;
                bestResult = {
                    schedule: JSON.parse(JSON.stringify(currentPath)),
                    ...currentStats
                };
            }
            return;
        }

        // Pruning: Look-ahead bound
        let currentScore = 0;
        if (objectiveType === 'lostSales') {
            currentScore = (currentStats.totalLostSales * 1000000) + currentStats.totalTime;
        } else {
            currentScore = (currentStats.totalTime * wTime) + (currentStats.totalCost * wCost);
        }
        if (currentScore >= bestTotalScore) return;

        const dailyPlans = generateDailyPlans(day, demandMatrix, inventory, backlog, objectiveType, lastProduct);

        for (const plan of dailyPlans) {
            const nextDayState = simulateDay(day, plan, inventory, backlog, lastProduct);

            branchAndBound(
                day + 1,
                nextDayState.inventory,
                nextDayState.backlog,
                nextDayState.lastProduct,
                [...currentPath, nextDayState.result],
                {
                    totalTime: currentStats.totalTime + nextDayState.time,
                    totalCost: currentStats.totalCost + nextDayState.cost,
                    totalLostSales: currentStats.totalLostSales + nextDayState.lostSales
                }
            );
            if (nodesExplored > MAX_NODES) return;
        }
    }

    function generateDailyPlans(day, demandMatrix, inv, bl, objType, lastP) {
        const productsWithInterest = [];
        for (let p = 0; p < 5; p++) {
            // A product is a candidate if it has current backlog OR any demand in the next 7 days (including next week)
            let futureDemand = 0;
            for (let i = 0; i < 7; i++) {
                futureDemand += demandMatrix[(day + i) % 7][p];
            }

            if (bl[p] > 0 || futureDemand > inv[p]) {
                productsWithInterest.push(p);
            }
        }

        // Basic choices
        let options = [[]];
        for (let p of productsWithInterest) options.push([p]);

        if (state.maxBatches >= 2) {
            for (let p1 of productsWithInterest) {
                for (let p2 of productsWithInterest) {
                    if (p1 === p2) continue;
                    options.push([p1, p2]);
                }
            }
        }

        if (state.maxBatches >= 3 && productsWithInterest.length >= 3) {
            for (let p1 of productsWithInterest) {
                for (let p2 of productsWithInterest) {
                    if (p1 === p2) continue;
                    for (let p3 of productsWithInterest) {
                        if (p3 === p1 || p3 === p2) continue;
                        options.push([p1, p2, p3]);
                    }
                }
            }
        }

        // Sort options heuristically: Prefer plans that satisfy immediate needs or clear high future volume
        options.sort((a, b) => {
            let clearA = 0, clearB = 0;
            a.forEach(p => {
                let futureDemand = 0;
                for (let i = 0; i < 7; i++) {
                    futureDemand += demandMatrix[(day + i) % 7][p];
                }
                clearA += Math.min(state.maxBatchSize, Math.max(0, futureDemand + bl[p] - inv[p]));
            });
            b.forEach(p => {
                let futureDemand = 0;
                for (let i = 0; i < 7; i++) {
                    futureDemand += demandMatrix[(day + i) % 7][p];
                }
                clearB += Math.min(state.maxBatchSize, Math.max(0, futureDemand + bl[p] - inv[p]));
            });
            if (clearA !== clearB) return clearB - clearA;

            let costA = 0, costB = 0;
            let lpA = lastP; a.forEach(p => { costA += getTransition(lpA, p).time; lpA = p; });
            let lpB = lastP; b.forEach(p => { costB += getTransition(lpB, p).time; lpB = p; });
            return costA - costB;
        });

        return options.slice(0, 12);
    }

    function simulateDay(day, pIndices, inv, bl, lastP) {
        let currentInv = [...inv];
        let currentBl = [...bl];
        let lp = lastP;
        let dayTime = 0, dayCost = 0, dayLost = 0;
        let events = [];
        let cap = state.dailyCapacity;

        for (let p = 0; p < 5; p++) {
            let demand = demandMatrix[day][p];
            if (currentInv[p] >= demand) {
                currentInv[p] -= demand;
                demand = 0;
            } else {
                demand -= currentInv[p];
                currentInv[p] = 0;
            }
            currentBl[p] += demand;
        }

        for (let pIdx of pIndices) {
            if (cap <= 0) break;
            const trans = getTransition(lp, pIdx);
            dayTime += trans.time;
            dayCost += trans.cost;
            lp = pIdx;

            // How much to produce? Look at total remaining demand (7-day lookahead assuming repeated demand)
            let totalRemainingDemand = currentBl[pIdx];
            for (let i = 1; i < 7; i++) {
                totalRemainingDemand += demandMatrix[(day + i) % 7][pIdx];
            }

            // Deduct what is already in inventory to find true need
            let netNeeded = Math.max(0, totalRemainingDemand - currentInv[pIdx]);

            // Produce up to batch size or capacity, but don't over-produce what isn't needed this week
            const amount = Math.min(netNeeded, cap, state.maxBatchSize);

            if (amount > 0) {
                cap -= amount;
                events.push({ p: pIdx, amount });

                // Satisfaction logic: reduce backlog first, then add to inventory
                let produced = amount;
                let satBacklog = Math.min(produced, currentBl[pIdx]);
                currentBl[pIdx] -= satBacklog;
                produced -= satBacklog;

                // Excess goes to inventory for future days
                currentInv[pIdx] += produced;
            }
        }

        const dayLostSales = Array(5).fill(0);
        for (let p = 0; p < 5; p++) {
            // Logic: Demand from yesterday that is STILL not met today is Lost.
            // Today's demand (demandMatrix[day][p]) can stay in backlog for tomorrow.
            const staleBacklog = Math.max(0, currentBl[p] - demandMatrix[day][p]);
            dayLost += staleBacklog;
            dayLostSales[p] = staleBacklog;

            // Carry over only up to today's unmet demand (clearing anything older)
            currentBl[p] = Math.min(currentBl[p], demandMatrix[day][p]);
        }

        return {
            inventory: currentInv, backlog: currentBl, lastProduct: lp,
            time: dayTime, cost: dayCost, lostSales: dayLost,
            result: { day, events, inventory: [...currentInv], lostSales: dayLostSales, dailyTime: dayTime, dailyCost: dayCost }
        };
    }

    // Run exact search
    branchAndBound(0, Array(5).fill(0), Array(5).fill(0), -1, [], { totalTime: 0, totalCost: 0, totalLostSales: 0 });

    if (!bestResult) {
        // Fallback to simple greedy if tree search failed (shouldn't happen with options.slice)
        return { schedule: [], totalTime: 0, totalCost: 0, totalLostSales: 0 };
    }

    return bestResult;
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
        <div style="display: flex; gap: 20px; margin-bottom: 20px; width: 100%; grid-column: 1 / -1;">
            <div class="card" style="flex: 1; min-width: 0;">
                <h3>Line 1 Performance (${type})</h3>
                <div style="display: flex; gap: 10px;">
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">${res.L1.totalTime} min</div><div class="stat-label">Trans. Time</div></div>
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">$${res.L1.totalCost}</div><div class="stat-label">Trans. Cost</div></div>
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">${res.L1.totalLostSales}</div><div class="stat-label">Lost Sales</div></div>
                </div>
            </div>
            <div class="card" style="flex: 1; min-width: 0;">
                <h3>Line 2 Performance (${type})</h3>
                <div style="display: flex; gap: 10px;">
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">${res.L2.totalTime} min</div><div class="stat-label">Trans. Time</div></div>
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">$${res.L2.totalCost}</div><div class="stat-label">Trans. Cost</div></div>
                    <div class="stat-box" style="flex: 1;"><div class="stat-value">${res.L2.totalLostSales}</div><div class="stat-label">Lost Sales</div></div>
                </div>
            </div>
        </div>
    `;

    html += renderLineTable('Line 1 Schedule', res.L1, 'L1');
    html += renderLineTable('Line 2 Schedule', res.L2, 'L2');

    container.innerHTML = html;
}

function renderLineTable(title, res, lineKey) {
    let html = `<div class="card full-width">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
            <h3 style="margin:0; border:none; padding:0;">${title}</h3>
            <button class="primary-btn" style="padding: 5px 12px; font-size: 0.8rem;" onclick="copyToExcel('${lineKey}', this)">Copy for Excel</button>
        </div>
        <table class="result-table">`;
    html += `<thead><tr>
        <th style="width:100px">Day</th>
        <th>Batch 1</th>
        <th>Batch 2</th>
        <th>Batch 3</th>
        <th style="width:80px; background:#f9f9f9; border-left: 2px solid #eee;">Time</th>
        <th style="width:80px; background:#f9f9f9;">Cost</th>
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
        html += `<td style="background:#f9f9f9; border-left: 2px solid #eee; font-weight:bold; color:#666;">${d.dailyTime}m</td>`;
        html += `<td style="background:#f9f9f9; font-weight:bold; color:#666;">$${d.dailyCost}</td>`;
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

function copyToExcel(lineKey, btn) {
    const type = document.getElementById('optGoal').value;
    if (!state.lastResults || !state.lastResults[type]) return;

    const res = state.lastResults[type][lineKey];
    if (!res) return;

    // 1. Create a hidden container for our table
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";

    // 2. Build a real HTML Table element (Excel's preferred format)
    // We add inline styles to ensure font size 11pt carries over to Excel
    let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">
        <thead>
            <tr style="background-color: #f2f2f2;">
                <th style="padding: 4px;">Day</th>
                <th style="padding: 4px;">Batch 1 Product</th><th style="padding: 4px;">Batch 1 Units</th>
                <th style="padding: 4px;">Batch 2 Product</th><th style="padding: 4px;">Batch 2 Units</th>
                <th style="padding: 4px;">Batch 3 Product</th><th style="padding: 4px;">Batch 3 Units</th>
                <th style="padding: 4px; background:#ddd;">Daily Time</th>
                <th style="padding: 4px; background:#ddd;">Daily Cost</th>
            </tr>
        </thead>
        <tbody>`;

    res.schedule.forEach(d => {
        tableHtml += `<tr><td style="padding: 4px;">${DAYS[d.day]}</td>`;
        for (let i = 0; i < 3; i++) {
            const event = d.events[i];
            if (event) {
                tableHtml += `<td style="padding: 4px;">${PRODUCTS[event.p]}</td><td style="padding: 4px;">${event.amount}</td>`;
            } else {
                tableHtml += `<td style="padding: 4px; color: #ccc;">-</td><td style="padding: 4px; color: #ccc;">-</td>`;
            }
        }
        tableHtml += `<td style="padding: 4px; background:#eee; font-weight:bold;">${d.dailyTime}m</td>`;
        tableHtml += `<td style="padding: 4px; background:#eee; font-weight:bold;">$${d.dailyCost}</td>`;
        tableHtml += "</tr>";
    });

    tableHtml += "</tbody></table>";
    container.innerHTML = tableHtml;
    document.body.appendChild(container);

    // 3. Select the table content
    const range = document.createRange();
    range.selectNode(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // 4. Execute Copy
    let success = false;
    try {
        success = document.execCommand("copy");
    } catch (err) {
        console.error("Copy command failed", err);
    }

    // 5. Cleanup
    selection.removeAllRanges();
    document.body.removeChild(container);

    if (success) {
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.style.background = "#27ae60";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "";
        }, 2000);
    } else {
        alert("Unable to copy automatically. Please try selecting the table manually.");
    }
}

// --- Dashboard Logic ---

function renderDashboard() {
    if (!state.lastResults) return;

    const line = document.getElementById('dashLine').value; // L1 or L2
    const types = ['time', 'cost', 'combined', 'lostSales'];
    const typeLabels = { time: 'Min Time', cost: 'Min Cost', combined: 'Combined', lostSales: 'Min Lost Sales' };
    const typeColors = { time: '#3498db', cost: '#e74c3c', combined: '#9b59b6', lostSales: '#f1c40f' };
    const productColors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22'];

    // Helper to destroy existing chart
    const resetChart = (id) => {
        if (chartInstances[id]) { chartInstances[id].destroy(); }
    };

    // 1. Daily Transition Time Comparison (Line Graph)
    resetChart('timeLineChart');
    const timeDatasets = types.map(t => ({
        label: typeLabels[t],
        data: state.lastResults[t][line].schedule.map(d => d.dailyTime),
        borderColor: typeColors[t],
        backgroundColor: typeColors[t] + '22',
        tension: 0.3,
        fill: false
    }));

    chartInstances['timeLineChart'] = new Chart(document.getElementById('timeLineChart'), {
        type: 'line',
        data: { labels: DAYS, datasets: timeDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 2. Daily Transition Cost Comparison (Line Graph)
    resetChart('costLineChart');
    const costDatasets = types.map(t => ({
        label: typeLabels[t],
        data: state.lastResults[t][line].schedule.map(d => d.dailyCost),
        borderColor: typeColors[t],
        backgroundColor: typeColors[t] + '22',
        tension: 0.3,
        fill: false
    }));

    chartInstances['costLineChart'] = new Chart(document.getElementById('costLineChart'), {
        type: 'line',
        data: { labels: DAYS, datasets: costDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 3. Inventory Buildup (Stacked Area) - For current selected optimization goal
    const activeGoal = document.getElementById('optGoal').value || 'combined';
    const schedule = state.lastResults[activeGoal][line].schedule;

    resetChart('inventoryAreaChart');
    const invDatasets = PRODUCTS.map((pName, pIdx) => ({
        label: pName,
        data: schedule.map(d => d.inventory[pIdx]),
        borderColor: productColors[pIdx],
        backgroundColor: productColors[pIdx] + '66',
        fill: true,
        tension: 0.2
    }));

    chartInstances['inventoryAreaChart'] = new Chart(document.getElementById('inventoryAreaChart'), {
        type: 'line',
        data: { labels: DAYS, datasets: invDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { stacked: true, title: { display: true, text: 'Stock' } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });

    // 4. Lost Sales per Product (Grouped Bar)
    resetChart('lostSalesBarChart');
    const lsDatasets = PRODUCTS.map((pName, pIdx) => ({
        label: pName,
        data: schedule.map(d => d.lostSales[pIdx]),
        backgroundColor: productColors[pIdx],
        borderRadius: 4
    }));

    chartInstances['lostSalesBarChart'] = new Chart(document.getElementById('lostSalesBarChart'), {
        type: 'bar',
        data: { labels: DAYS, datasets: lsDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Lost' } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });

    // 5. Daily Demand per Product (Line Graph)
    const demandMatrix = line === 'L1' ? state.demandL1 : state.demandL2;
    resetChart('demandLineChart');
    const demandDatasets = PRODUCTS.map((pName, pIdx) => ({
        label: pName,
        data: DAYS.map((_, dIdx) => demandMatrix[dIdx][pIdx]),
        borderColor: productColors[pIdx],
        backgroundColor: productColors[pIdx] + '22',
        tension: 0.3,
        fill: false
    }));

    chartInstances['demandLineChart'] = new Chart(document.getElementById('demandLineChart'), {
        type: 'line',
        data: { labels: DAYS, datasets: demandDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Units' } } },
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
        }
    });

    // Render Summary Table
    renderProductSummary(line, activeGoal);
}

function renderProductSummary(line, activeGoal) {
    const container = document.getElementById('productSummaryContainer');
    if (!state.lastResults) return;

    const res = state.lastResults[activeGoal][line];
    const demandMatrix = line === 'L1' ? state.demandL1 : state.demandL2;

    let html = `
        <table class="result-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Total Demand</th>
                    <th>Total Produced</th>
                    <th>Total Lost Sales</th>
                    <th>Service Level</th>
                    <th>Avg. Inventory</th>
                </tr>
            </thead>
            <tbody>
    `;

    PRODUCTS.forEach((pName, pIdx) => {
        let totalDemand = 0;
        for (let d = 0; d < 7; d++) totalDemand += demandMatrix[d][pIdx];

        let totalProduced = 0;
        res.schedule.forEach(day => {
            day.events.forEach(ev => {
                if (ev.p === pIdx) totalProduced += ev.amount;
            });
        });

        let totalLost = 0;
        res.schedule.forEach(day => totalLost += day.lostSales[pIdx]);

        let totalInv = 0;
        res.schedule.forEach(day => totalInv += day.inventory[pIdx]);
        const avgInv = (totalInv / 7).toFixed(1);

        const serviceLevel = totalDemand > 0 ? (((totalDemand - totalLost) / totalDemand) * 100).toFixed(1) : '100.0';

        html += `
            <tr>
                <td><strong>${pName}</strong></td>
                <td>${totalDemand}</td>
                <td>${totalProduced}</td>
                <td>${totalLost}</td>
                <td><span class="badge ${serviceLevel > 95 ? 'success' : 'warning'}">${serviceLevel}%</span></td>
                <td>${avgInv}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
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
