
// Mock State
const PRODUCTS = ['P1', 'P2', 'P3', 'P4', 'P5'];
let state = {
    dailyCapacity: 1000,
    maxBatchSize: 1000,
    maxBatches: 3,
    transitionPenalty: Array(5).fill().map(() => Array(5).fill(30)),
    transitionCost: Array(5).fill().map(() => Array(5).fill(100)),
    demandL1: Array(7).fill().map(() => Array(5).fill(100)), // High demand
    demandL2: Array(7).fill().map(() => Array(5).fill(100))
};

// Make transitions distinct to see effects
// P1 is "far" from everyone else in penalty
for (let i = 0; i < 5; i++) {
    state.transitionPenalty[0][i] = 100; // From P1 to others is slow
    state.transitionPenalty[i][0] = 100; // From others to P1 is slow
}
// P2-P5 are fast transitions (10)
for (let i = 1; i < 5; i++) {
    for (let j = 1; j < 5; j++) {
        if (i !== j) state.transitionPenalty[i][j] = 10;
    }
}

function getTransition(fromP, toP) {
    if (fromP === -1 || fromP === toP) return { penalty: 0, cost: 0 };
    return {
        penalty: state.transitionPenalty[fromP][toP] || 0,
        cost: state.transitionCost[fromP][toP] || 0
    };
}

function solveLine(demandMatrix, type) {
    let weightPenalty = 0, weightCost = 0, weightLostSales = 0;
    if (type === 'time') weightPenalty = 1;
    else if (type === 'cost') weightCost = 1;
    else if (type === 'combined') { weightPenalty = 1; weightCost = 1; }
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
            if (batchesToday >= state.maxBatches) break;
            let p = cand.p;
            let amountNeeded = cand.mandatory + cand.desirable;
            let trans = getTransition(lastProduct, p);

            if (remainingCapacity < trans.penalty) break;

            if (lastProduct !== p && lastProduct !== -1) {
                remainingCapacity -= trans.penalty;
                totalPenalty += trans.penalty;
                totalCost += trans.cost;
            }
            lastProduct = p;

            let maxPossible = remainingCapacity;

            let amountToProduce = Math.min(amountNeeded, maxPossible, state.maxBatchSize);

            if (amountToProduce > 0) {
                remainingCapacity -= amountToProduce;
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
    return { totalPenalty, totalCost, totalLostSales };
}

console.log("Running Sim...");
const resPenalty = solveLine(state.demandL1, 'time');
console.log(`Type: time (Min Penalty) | Lost: ${resPenalty.totalLostSales} | TransPenalty: ${resPenalty.totalPenalty}`);

const resLost = solveLine(state.demandL1, 'lostSales');
console.log(`Type: lostSales | Lost: ${resLost.totalLostSales} | TransPenalty: ${resLost.totalPenalty}`);
