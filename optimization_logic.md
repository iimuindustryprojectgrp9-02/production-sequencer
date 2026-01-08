# Production Sequencer - Optimization Logic

This document details the calculations and Simulated Annealing logic used by the solver to generate production schedules.

## 1. Core Engine: Global Branch & Bound (Exact Solver)
The system uses a **Global Branch & Bound** algorithm to guarantee the mathematical global minimum for the selected objective. 
1.  **Tree Search**: The solver explores the tree of all possible production sequences across the 7-day horizon.
2.  **Pruning**: It calculates a lower bound for every branch; if a branch cannot possibly beat the current best solution, it is "pruned" (discarded).
3.  **Global Optimality**: Unlike randomized search, this method continues until it has mathematically proven that no better schedule exists.

## 2. Optimization Goal Objectives
The solver targets a specific metric for each goal. Other metrics are ignored in the scoring process for the specialized modes.

### Minimum Transition Time
Optimizes strictly for the lowest total transition time (minutes).
$$\text{Score} = \text{Total Transition Time}$$

### Minimum Transition Cost
Optimizes strictly for the lowest financial cost of transitions ($).
$$\text{Score} = \text{Total Transition Cost}$$

### Minimum Lost Sales
Optimizes primarily for the lowest number of units not produced. If multiple solutions have the same minimum lost sales, the one with the lowest transition time is selected as a tie-breaker.
$$\text{Score} = (\text{Total Lost Sales} \times 1,000,000) + \text{Total Transition Time}$$

### Combined Time & Cost
Optimizes for the weighted sum of transition time and cost based on user-defined percentages ($W_T$ and $W_C$).
$$\text{Score} = (\text{Total Time} \times W_T) + (\text{Total Cost} \times W_C)$$

---

## 3. Daily Production Heuristics
Each randomized iteration follows these basic rules:
1.  **Capacity**: Daily capacity is strictly units-based.
2.  **Transitions**: Transition time (minutes) and cost ($) are incurred when switching products but do not consume the unit-based production capacity.
3.  **Randomization**: Candidates are picked using a randomized greedy approach (15% chance to pick a non-optimal product) to ensure broad exploration of the sequence space.

---

## 4. Lost Sales Policy
Any demand that is not produced by the end of **the day after it was received** is counted as a **Lost Sale** and removed from the system. This means demand today can be satisfied "latest by tomorrow," giving the solver a 24-hour grace period to manage capacity spikes.

## 5. Repeated Demand & Last-Day Planning
The solver assumes the weekly demand profile is **cyclical** (repeats for the next week). 
1.  **Circular Look-ahead**: When evaluating production on any given day, the solver looks ahead 7 days into the future. On Sunday, this look-ahead wraps around to include next Monday, Tuesday, etc.
2.  **Ending Backlog Penalty**: To ensure the "last day" (Sunday) plans for the start of the next cycle, any unmet demand remaining on Sunday night is added to the optimization score as a penalty. This motivates the solver to use Sunday's spare capacity to stock up for Monday.
