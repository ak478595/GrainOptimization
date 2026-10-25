"""
Baseline MILP Formulation for GrainOpt 2.0.

Faithful implementation of the original main.py formulation:
- Inoculated products (1-7): Weekly Just-In-Time demand satisfaction (sum_l x >= d).
- Treated products (8-17): Cumulative demand satisfaction (sum_t<=s sum_l x >= sum_t<=s d).
- Shift limits: max 3 shifts per line per week.
- Capacity limits: sum_v x <= capacity_l * 41.25 * shifts_{l,s}.
- Storage limits: cumulative production - cumulative demand <= 2700.
- No cleaning time, costs, or changeover sequencing.
"""

from typing import Dict, Tuple, Any
import pulp
from app.core.dataset_loader import FacilityData


class BaselineModel:
    def __init__(self, data: FacilityData, demand_override: Dict[Tuple[int, int], float] = None):
        self.data = data
        self.demand = demand_override if demand_override is not None else data.demand
        self.prob = pulp.LpProblem("GrainOpt_Baseline", pulp.LpMinimize)

        # Decision Variables
        # x[v, l, s]: Production of product v on line l in week s (continuous >= 0)
        self.x = {
            (v, l, s): pulp.LpVariable(
                f"Production_{v}_{l}_{s}",
                lowBound=0.0,
                cat=pulp.LpContinuous
            )
            for v in self.data.products
            for l in self.data.lines
            for s in self.data.weeks
        }

        # shifts[l, s]: Number of shifts allocated to line l in week s (integer 0..3)
        self.shifts = {
            (l, s): pulp.LpVariable(
                f"Shifts_{l}_{s}",
                lowBound=0,
                upBound=self.data.max_shifts_per_line_week,
                cat=pulp.LpInteger
            )
            for l in self.data.lines
            for s in self.data.weeks
        }

        self._build_constraints()
        self._build_objective()

    def _build_constraints(self):
        # 1. Inoculated products: Weekly JIT demand
        for v in self.data.inoculated_products:
            for s in self.data.weeks:
                self.prob += (
                    pulp.lpSum(self.x[v, l, s] for l in self.data.lines) >= self.demand[v, s],
                    f"Inoculated_Demand_{v}_{s}"
                )

        # 2. Treated products: Cumulative demand satisfaction
        for v in self.data.treated_products:
            for s in self.data.weeks:
                cum_prod = pulp.lpSum(
                    self.x[v, l, t]
                    for l in self.data.lines
                    for t in self.data.weeks
                    if t <= s
                )
                cum_dem = sum(self.demand[v, t] for t in self.data.weeks if t <= s)
                self.prob += (
                    cum_prod >= cum_dem,
                    f"Treated_Demand_{v}_{s}"
                )

        # 3. Production capacity limits per line per week
        for l in self.data.lines:
            for s in self.data.weeks:
                total_prod = pulp.lpSum(self.x[v, l, s] for v in self.data.products)
                avail_hours = self.data.hours_per_shift * self.shifts[l, s]
                self.prob += (
                    total_prod <= self.data.capacity[l] * avail_hours,
                    f"Capacity_Line_{l}_Week_{s}"
                )

        # 4. Storage capacity limits
        for s in self.data.weeks:
            cum_prod_total = pulp.lpSum(
                self.x[v, l, t]
                for v in self.data.products
                for l in self.data.lines
                for t in self.data.weeks
                if t <= s
            )
            cum_dem_total = sum(
                self.demand[v, t]
                for v in self.data.products
                for t in self.data.weeks
                if t <= s
            )
            self.prob += (
                cum_prod_total - cum_dem_total <= self.data.storage_capacity,
                f"Storage_Capacity_Week_{s}"
            )

    def _build_objective(self):
        labour_cost = pulp.lpSum(
            self.data.labour_cost_per_shift * self.shifts[l, s]
            for l in self.data.lines
            for s in self.data.weeks
        )
        production_cost = pulp.lpSum(
            self.data.production_cost_coefficient * self.x[v, l, s] / self.data.capacity[l]
            for v in self.data.products
            for l in self.data.lines
            for s in self.data.weeks
        )
        self.prob += labour_cost + production_cost, "Total_Operating_Cost"

    def solve(self, solver=None) -> Dict[str, Any]:
        if solver is None:
            solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=120, gapRel=0.05, presolve=True, cuts=True)
        self.prob.solve(solver)

        status_str = pulp.LpStatus[self.prob.status]
        is_optimal = (self.prob.status == pulp.constants.LpStatusOptimal)

        # Extract solution values
        prod_results = {}
        shifts_results = {}
        for (v, l, s), var in self.x.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                prod_results[(v, l, s)] = val

        for (l, s), var in self.shifts.items():
            shifts_results[(l, s)] = int(round(pulp.value(var) or 0))

        # Calculate exact cost breakdown
        tot_shifts = sum(shifts_results.values())
        labour_cost = tot_shifts * self.data.labour_cost_per_shift
        prod_cost = sum(
            self.data.production_cost_coefficient * val / self.data.capacity[l]
            for (v, l, s), val in prod_results.items()
        )
        total_cost = labour_cost + prod_cost

        # Calculate weekly and peak inventory
        weekly_inventory = {}
        cum_p = 0.0
        cum_d = 0.0
        for s in self.data.weeks:
            p_s = sum(prod_results.get((v, l, s), 0.0) for v in self.data.products for l in self.data.lines)
            d_s = sum(self.demand.get((v, s), 0.0) for v in self.data.products)
            cum_p += p_s
            cum_d += d_s
            weekly_inventory[s] = cum_p - cum_d

        peak_inv = max(weekly_inventory.values()) if weekly_inventory else 0.0

        return {
            "status": status_str,
            "status_code": self.prob.status,
            "is_optimal": is_optimal,
            "objective_value": total_cost,
            "labour_cost": labour_cost,
            "production_cost": prod_cost,
            "total_shifts": tot_shifts,
            "shifts_by_line": {
                1: sum(shifts_results.get((1, s), 0) for s in self.data.weeks),
                2: sum(shifts_results.get((2, s), 0) for s in self.data.weeks)
            },
            "total_production": sum(prod_results.values()),
            "peak_inventory": peak_inv,
            "weekly_inventory": weekly_inventory,
            "shifts": shifts_results,
            "production": prod_results,
            "total_waste": 0.0  # Baseline has no waste tracking
        }
