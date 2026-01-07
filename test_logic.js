
// Mock State
const PRODUCTS = ['P1', 'P2', 'P3', 'P4', 'P5'];
let state = {
    dailyCapacity: 480,
    maxBatchSize: 1000,
    maxBatches: 3,
    transitionTime: Array(5).fill().map(() => Array(5).fill(30)),
    transitionCost: Array(5).fill().map(() => Array(5).fill(100)),
    demandL1: Array(7).fill().map(() => Array(5).fill(100)), // High demand
    demandL2: Array(7).fill().map(() => Array(5).fill(100))
};

// Make transitions distinct to see effects
// P1 is "far" from everyone else in time
for (let i = 0; i < 5; i++) {
    state.transitionTime[0][i] = 100; // From P1 to others is slow
    state.transitionTime[i][0] = 100; // From others to P1 is slow
}
// P2-P5 are fast transitions (10)
for (let i = 1; i < 5; i++) {
    for (let j = 1; j < 5; j++) {
        if (i !== j) state.transitionTime[i][j] = 10;
    }
}

function getTransition(fromP, toP) {
    if (fromP === -1 || fromP === toP) return { time: 0, cost: 0 };
    return {
        time: state.transitionTime[fromP][toP] || 0,
        cost: state.transitionCost[fromP][toP] || 0
    };
}

function solveLine(demandMatrix, type) {
    let weightTime = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') weightTime = 1;
    else if (type === 'cost') weightCost = 1;
    else if (type === 'combined') { weightTime = 1; weightCost = 1; }
    else if (type === 'lostSales') weightLostSales = 1000;

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
            if (batchesToday >= state.maxBatches) break;
            let p = cand.p;
            let amountNeeded = cand.mandatory + cand.desirable;
            let trans = getTransition(lastProduct, p);

            if (remainingTime < trans.time) break;

            if (lastProduct !== p && lastProduct !== -1) {
                remainingTime -= trans.time;
                totalTime += trans.time;
                totalCost += trans.cost;
            }
            lastProduct = p;

            let maxPossible = remainingTime; // 1 unit = 1 min (implicit?) No, code doesn't specify unit time. 
            // Wait, original code:
            // let amountToProduce = Math.min(amountNeeded, maxPossible, state.maxBatchSize);
            // This implies 1 unit takes 1 minute of capacity?
            // "maxPossible" is "remainingTime"
            // Yes, unit production rate seems to be 1 unit/min.

            let amountToProduce = Math.min(amountNeeded, maxPossible, state.maxBatchSize);

            if (amountToProduce > 0) {
                remainingTime -= amountToProduce;
                batchesToday++;
                daySchedule.push({ p: p, amount: amountToProduce });

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
        candidates.forEach(c => {
            if (c.mandatory > 0) {
                totalLostSales += c.mandatory;
                backlog[c.p] = 0;
            }
            if (c.desirable > 0) {
                backlog[c.p] += c.desirable;
            }
        });
    }
    return { totalTime, totalCost, totalLostSales };
}

console.log("Running Sim...");
const resTime = solveLine(state.demandL1, 'time');
console.log(`Type: time | Lost: ${resTime.totalLostSales} | TransTime: ${resTime.totalTime}`);

const resLost = solveLine(state.demandL1, 'lostSales');
console.log(`Type: lostSales | Lost: ${resLost.totalLostSales} | TransTime: ${resLost.totalTime}`);

if (resLost.totalLostSales > resTime.totalLostSales) {
    console.log("CONFIRMED: Lost sales higher in lostSales mode.");
} else {
    console.log("NOT CONFIRMED: Lost sales not higher.");
}
