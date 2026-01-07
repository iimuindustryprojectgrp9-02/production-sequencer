# Production Sequencer - Optimization Logic

This document details the calculations and Simulated Annealing logic used by the solver to generate production schedules.

## 1. Core Engine: Simulated Annealing (Global Search)
The system uses a randomized global search algorithm (Simulated Annealing) to explore the solution space. For every optimization run, the system:
1.  Executes **100 randomized iterations** of the production sequence.
2.  Assigns a **Score** to each iteration based on the selected Optimization Goal.
3.  Selects the iteration with the **lowest score** as the final result.

## 2. Optimization Goal Objectives
The solver targets a specific metric for each goal. Other metrics are ignored in the scoring process for the specialized modes.

### Minimum Transit Time
Optimizes strictly for the lowest total transition time in minutes.
$$\text{Score} = \text{Total Transit Time (min)}$$

### Minimum Transit Cost
Optimizes strictly for the lowest financial cost of transitions.
$$\text{Score} = \text{Total Transit Cost ($)}$$

### Minimum Lost Sales
Optimizes strictly to minimize the total number of units not produced.
$$\text{Score} = \text{Total Lost Sales (units)}$$

### Combined Time & Cost
Uses user-defined weights to balance capacity and cost, with a high penalty for lost sales to ensure feasibility.
$$\text{Score} = (\text{Total Time} \times W_T) + (\text{Total Cost} \times W_C) + (\text{Lost Sales} \times 100,000)$$

---

## 3. Daily Production Heuristics
Each randomized iteration follows these basic rules:
1.  **Capacity**: Daily capacity is strictly units-based.
2.  **Transitions**: Transition time (minutes) and cost ($) are incurred when switching products but do not consume the unit-based production capacity.
3.  **Randomization**: Candidates are picked using a randomized greedy approach (15% chance to pick a non-optimal product) to ensure broad exploration of the sequence space.

---

## 4. Lost Sales Policy
Any demand (Backlog or Today's Demand) that is not produced by the end of the day is counted as a **Lost Sale** and removed from the system. This provides a clear signal of capacity constraints.

