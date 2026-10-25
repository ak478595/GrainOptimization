"""
Expiry-Aware MILP Formulation for GrainOpt 2.0.

Features:
- Inoculated products (1-7): Age-indexed tracking (age 0 in production week s, usable in weeks s, s+1, s+2).
  - I[v, s, 0] = sum_l x[v, l, s] - u[v, s, 0]
  - I[v, s, 1] = I[v, s-1, 0] - u[v, s, 1] (for s >= 2)
  - u[v, s, 2] + W[v, s] = I[v, s-1, 1] (for s >= 3)
  - I[v, s, 2] = 0 (leftover stock expires at end of week s and transitions to waste W)
  - Strict initial conditions: I[v, 0, a] = 0, u[v, 1, 1] = 0, u[v, s, 2] = 0 for s in {1, 2}.
- Treated products (8-17): Explicit non-perishable inventory balance:
  - I_treated[v, s] = I_treated[v, s-1] + sum_l x[v, l, s] - d[v, s].
- Demand satisfaction:
  - Inoculated: sum_a u[v, s, a] >= d[v, s].
  - Treated: directly bounded by non-negative inventory balance I_treated[v, s] >= 0.
- Facility storage capacity:
  - Total end-of-week warehouse inventory across all products (I[v, s, 0] + I[v, s, 1] + I_treated[v, s]) <= 2700.
- Production and shift constraints: identical to baseline.
- Waste/spoilage penalty: M_waste * sum_{v, s} W[v, s].
"""

from typing import Dict, Tuple, Any
import pulp
from app.core.dataset_loader import FacilityData


class ExpiryModel:
    def __init__(
        self,
        data: FacilityData,
        demand_override: Dict[Tuple[int, int], float] = None,
        waste_penalty: float = 10000.0
    ):
        self.data = data
        self.demand = demand_override if demand_override is not None else data.demand
        self.waste_penalty = waste_penalty
        self.prob = pulp.LpProblem("GrainOpt_ExpiryAware", pulp.LpMinimize)

        # 1. Production Variables x[v, l, s] >= 0
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

        # 2. Shift Allocation Variables shifts[l, s] in {0, 1, 2, 3}
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

        # 3. Inoculated Cohort Consumption Variables u[v, s, a] >= 0 for a in {0, 1, 2}
        self.u = {
            (v, s, a): pulp.LpVariable(
                f"UseInoc_{v}_{s}_age{a}",
                lowBound=0.0,
                cat=pulp.LpContinuous
            )
            for v in self.data.inoculated_products
            for s in self.data.weeks
            for a in [0, 1, 2]
        }

        # 4. Inoculated Inventory Variables I[v, s, a] >= 0 for a in {0, 1}
        # (I[v, s, 2] is fixed to 0 since age 2 expires at end of week s)
        self.I_inoc = {
            (v, s, a): pulp.LpVariable(
                f"InvInoc_{v}_{s}_age{a}",
                lowBound=0.0,
                cat=pulp.LpContinuous
            )
            for v in self.data.inoculated_products
            for s in self.data.weeks
            for a in [0, 1]
        }

        # 5. Inoculated Waste Variables W[v, s] >= 0
        self.W = {
            (v, s): pulp.LpVariable(
                f"WasteInoc_{v}_{s}",
                lowBound=0.0,
                cat=pulp.LpContinuous
            )
            for v in self.data.inoculated_products
            for s in self.data.weeks
        }

        # 6. Treated Inventory Variables I_treated[v, s] >= 0
        self.I_treated = {
            (v, s): pulp.LpVariable(
                f"InvTreated_{v}_{s}",
                lowBound=0.0,
                cat=pulp.LpContinuous
            )
            for v in self.data.treated_products
            for s in self.data.weeks
        }

        self._build_constraints()
        self._build_objective()

    def _build_constraints(self):
        # -------------------------------------------------------------
        # A. Inoculated Inventory Ageing & Balance
        # -------------------------------------------------------------
        for v in self.data.inoculated_products:
            for s in self.data.weeks:
                # Age 0 balance: fresh production enters as age 0
                self.prob += (
                    self.I_inoc[v, s, 0] == pulp.lpSum(self.x[v, l, s] for l in self.data.lines) - self.u[v, s, 0],
                    f"Inoc_Age0_Balance_{v}_{s}"
                )

                # Age 1 balance: carried over from age 0 at end of s-1
                if s == 1:
                    # Boundary: initial inventory is 0
                    self.prob += self.u[v, 1, 1] == 0.0, f"Inoc_Age1_InitUse_{v}_{s}"
                    self.prob += self.I_inoc[v, 1, 1] == 0.0, f"Inoc_Age1_InitInv_{v}_{s}"
                else:
                    self.prob += (
                        self.I_inoc[v, s, 1] == self.I_inoc[v, s - 1, 0] - self.u[v, s, 1],
                        f"Inoc_Age1_Balance_{v}_{s}"
                    )

                # Age 2 balance & Expiry / Waste accounting:
                # Carried over from age 1 at end of s-1. Cannot be held past end of s.
                if s in [1, 2]:
                    # Boundary: cannot have 2-week-old stock in week 1 or week 2
                    self.prob += self.u[v, s, 2] == 0.0, f"Inoc_Age2_BoundaryUse_{v}_{s}"
                    self.prob += self.W[v, s] == 0.0, f"Inoc_Age2_BoundaryWaste_{v}_{s}"
                else:
                    self.prob += (
                        self.u[v, s, 2] + self.W[v, s] == self.I_inoc[v, s - 1, 1],
                        f"Inoc_Age2_BalanceWaste_{v}_{s}"
                    )

                # Inoculated Demand satisfaction: sum of eligible unexpired cohorts >= demand
                self.prob += (
                    self.u[v, s, 0] + self.u[v, s, 1] + self.u[v, s, 2] >= self.demand[v, s],
                    f"Inoc_Demand_Satisfaction_{v}_{s}"
                )

        # -------------------------------------------------------------
        # B. Treated Inventory Balance
        # -------------------------------------------------------------
        for v in self.data.treated_products:
            for s in self.data.weeks:
                prev_inv = self.I_treated[v, s - 1] if s > 1 else 0.0
                self.prob += (
                    self.I_treated[v, s] == prev_inv + pulp.lpSum(self.x[v, l, s] for l in self.data.lines) - self.demand[v, s],
                    f"Treated_Inventory_Balance_{v}_{s}"
                )

        # -------------------------------------------------------------
        # C. Production Capacity Limits
        # -------------------------------------------------------------
        for l in self.data.lines:
            for s in self.data.weeks:
                total_prod = pulp.lpSum(self.x[v, l, s] for v in self.data.products)
                avail_hours = self.data.hours_per_shift * self.shifts[l, s]
                self.prob += (
                    total_prod <= self.data.capacity[l] * avail_hours,
                    f"Capacity_Line_{l}_Week_{s}"
                )

        # -------------------------------------------------------------
        # D. Aggregate Storage Capacity Limits
        # -------------------------------------------------------------
        for s in self.data.weeks:
            inoc_stock = pulp.lpSum(
                self.I_inoc[v, s, 0] + self.I_inoc[v, s, 1]
                for v in self.data.inoculated_products
            )
            treated_stock = pulp.lpSum(
                self.I_treated[v, s]
                for v in self.data.treated_products
            )
            self.prob += (
                inoc_stock + treated_stock <= self.data.storage_capacity,
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
        waste_cost = pulp.lpSum(
            self.waste_penalty * self.W[v, s]
            for v in self.data.inoculated_products
            for s in self.data.weeks
        )
        self.prob += labour_cost + production_cost + waste_cost, "Total_Operating_Cost_With_Waste"

    def solve(self, solver=None) -> Dict[str, Any]:
        if solver is None:
            solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=120, gapRel=0.05, presolve=True, cuts=True)
        self.prob.solve(solver)

        status_str = pulp.LpStatus[self.prob.status]
        is_optimal = (self.prob.status == pulp.constants.LpStatusOptimal)

        # Extract solution values
        prod_results = {}
        shifts_results = {}
        waste_results = {}
        consumption_results = {}
        inoc_inv_results = {}
        treated_inv_results = {}

        for (v, l, s), var in self.x.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                prod_results[(v, l, s)] = val

        for (l, s), var in self.shifts.items():
            shifts_results[(l, s)] = int(round(pulp.value(var) or 0))

        for (v, s), var in self.W.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                waste_results[(v, s)] = val

        for (v, s, a), var in self.u.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                consumption_results[(v, s, a)] = val

        for (v, s, a), var in self.I_inoc.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                inoc_inv_results[(v, s, a)] = val

        for (v, s), var in self.I_treated.items():
            val = pulp.value(var) or 0.0
            if abs(val) > 1e-6:
                treated_inv_results[(v, s)] = val

        tot_shifts = sum(shifts_results.values())
        labour_cost = tot_shifts * self.data.labour_cost_per_shift
        prod_cost = sum(
            self.data.production_cost_coefficient * val / self.data.capacity[l]
            for (v, l, s), val in prod_results.items()
        )
        total_waste = sum(waste_results.values())
        waste_cost = total_waste * self.waste_penalty
        operating_cost = labour_cost + prod_cost

        # Weekly warehouse inventory
        weekly_inventory = {}
        for s in self.data.weeks:
            inoc_s = sum(inoc_inv_results.get((v, s, a), 0.0) for v in self.data.inoculated_products for a in [0, 1])
            treat_s = sum(treated_inv_results.get((v, s), 0.0) for v in self.data.treated_products)
            weekly_inventory[s] = inoc_s + treat_s

        peak_inv = max(weekly_inventory.values()) if weekly_inventory else 0.0

        # Cohort age breakdown of consumption
        age_breakdown = {
            0: sum(consumption_results.get((v, s, 0), 0.0) for v in self.data.inoculated_products for s in self.data.weeks),
            1: sum(consumption_results.get((v, s, 1), 0.0) for v in self.data.inoculated_products for s in self.data.weeks),
            2: sum(consumption_results.get((v, s, 2), 0.0) for v in self.data.inoculated_products for s in self.data.weeks)
        }

        return {
            "status": status_str,
            "status_code": self.prob.status,
            "is_optimal": is_optimal,
            "objective_value": operating_cost + waste_cost,
            "operating_cost": operating_cost,
            "labour_cost": labour_cost,
            "production_cost": prod_cost,
            "waste_cost": waste_cost,
            "total_waste": total_waste,
            "total_shifts": tot_shifts,
            "shifts_by_line": {
                1: sum(shifts_results.get((1, s), 0) for s in self.data.weeks),
                2: sum(shifts_results.get((2, s), 0) for s in self.data.weeks)
            },
            "total_production": sum(prod_results.values()),
            "peak_inventory": peak_inv,
            "weekly_inventory": weekly_inventory,
            "age_breakdown": age_breakdown,
            "shifts": shifts_results,
            "production": prod_results,
            "waste": waste_results,
            "consumption": consumption_results
        }
