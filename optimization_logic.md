# Production Sequencer - Optimization Logic

This document details the calculations and heuristic logic used by the solver to generate production schedules.

## 1. Core Logic: Greedy Heuristic
The solver uses a **Greedy Heuristic with Look-Back (State)**. It processes the schedule day by day, from Monday to Sunday, making the "best" local decision at each step.

### Daily Processing Loop
For each day:
1.  **Capacity Tracking**: Initialize `remainingCapacity` to the global `Daily Capacity`.
2.  **Constraint Check**: Limit to `Max Batches/Day` (default 3) and `Max Batch Size`.
3.  **Candidate Selection**: Identify products with pending demand (Backlog from previous days + Demand for today).
4.  **Scoring & Sorting**: Rank candidates based on the selected Optimization Goal (see Formulas below).
5.  **Sequential Production**: Produce the top-ranked candidates until capacity or batch limits are reached.

---

## 2. Optimization Goal Formulas

The solver calculates a "Cost" or "Priority" for each transition from the `lastProduct` produced to a potential `nextProduct`.

### Symbols
- $T_{from, to}$: Transition Penalty (Capacity units)
- $C_{from, to}$: Transition Cost (\$)
- $W_T$: Penalty Weight ($0.0 \dots 1.0$)
- $W_C$: Cost Weight ($0.0 \dots 1.0$)
- $P_{mandatory}$: Units required to clear backlog.

### Minimum Transit Penalty
Prioritize the transition with the lowest capacity loss.
$$\text{Score} = T_{last, next}$$
*(Lower is better)*

### Minimum Transit Cost
Prioritize the transition with the lowest financial cost.
$$\text{Score} = C_{last, next}$$
*(Lower is better)*

### Combined Penalty & Cost
Uses user-defined weights to balance capacity and cost.
$$\text{Score} = (T_{last, next} \times W_T) + (C_{last, next} \times W_C)$$
*(Lower is better)*

### Minimum Lost Sales (Density Heuristic)
Uses a **Benefit-to-Cost Ratio** to maximize production of overdue items.
$$\text{Produced} = \min(P_{mandatory}, \text{RemainingCapacity} - T_{last, next}, \text{MaxBatchSize})$$
$$\text{Score} = \frac{\text{Produced}}{\text{Produced} + T_{last, next}}$$
*(Higher is better. This ensures we pick the product that gives the most "bang for the buck" in terms of capacity usage.)*

---

### Lost Sales Policy
Any demand (Backlog or Today's Demand) that is not produced by the end of the day is counted as a **Lost Sale** and removed from the system. This ensures that capacity constraints are strictly highlighted and prevents unreasonable backlog accumulation.

---

## 4. Advanced Optimization Methods (V2.0)
The system now automatically benchmarks multiple strategies and selects the most efficient one for your current data.

### Production Leveling (Demand Smoothing)
Pre-processes the demand matrix to distribute high-load spikes to adjacent days. This helps "flatten the curve" and reduces the likelihood of exceeding daily capacity, thereby minimizing Lost Sales.

### Multi-day Look-ahead
A greedy heuristic that looks one day into the future. It calculates the transition penalty for *today* PLUS a discounted penalty for potential transitions *tomorrow*. This prevents making a cheap decision today that locks the line into an expensive sequence tomorrow.

### Simulated Annealing (Global Search)
Our "MILP-lite" alternative. It performs 50 randomized iterations of the scheduling sequence, using a "temperature" to explore less-obvious paths. It then selects the result with the lowest global objective function (Penalty + Cost + Lost Sales).

## 5. Automatic Benchmarking
Whenever you click "Run Optimization", the system follows this logic:
1.  **Manual Override**: If you have selected a specific engine (e.g., "Multi-day Look-ahead") in the Global Parameters, that engine is used directly.
2.  **Auto-Select**: If "Auto-Select" is chosen, the system runs a mini-benchmark:
    - It executes all 4 strategies (Greedy, Leveling, Look-ahead, Search).
    - It calculates a **Composite Score**: $$\text{Score} = \text{Total Penalty} + \text{Total Cost} + (\text{Lost Sales} \times 5000)$$
    - The strategy with the lowest score is selected and applied.
