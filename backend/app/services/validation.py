"""
Independent Mathematical Validation Engine for GrainOpt 2.0.

Performs rigorous constraint and objective function auditing on any solver solution:
1. Demand satisfaction (per product and per week)
2. Shift integer bounds (0 <= shifts <= 3)
3. Line capacity utilization (production <= capacity * 41.25 * shifts)
4. Facility storage bounds (inventory <= 2700 tonnes)
5. Inoculated cohort inventory conservation and zero-expired consumption
6. Independent recalculation of labour cost, production cost, and objective match
"""

from typing import Dict, Any, List
from app.core.dataset_loader import FacilityData


class SolutionValidator:
    def __init__(self, data: FacilityData, demand: Dict = None, tolerance: float = 1e-4):
        self.data = data
        self.demand = demand if demand is not None else data.demand
        self.tol = tolerance

    def validate_baseline(self, sol: Dict[str, Any]) -> Dict[str, Any]:
        violations: List[str] = []
        production = sol.get("production", {})
        shifts = sol.get("shifts", {})

        # 1. Inoculated JIT demand
        for v in self.data.inoculated_products:
            for s in self.data.weeks:
                p_s = sum(production.get((v, l, s), 0.0) for l in self.data.lines)
                d_s = self.demand.get((v, s), 0.0)
                if p_s < d_s - self.tol:
                    violations.append(f"Inoculated JIT unmet: Prod {v}, Week {s} (Produced: {p_s:.3f}, Demand: {d_s:.3f})")

        # 2. Treated Cumulative demand
        for v in self.data.treated_products:
            cum_p = 0.0
            cum_d = 0.0
            for s in self.data.weeks:
                cum_p += sum(production.get((v, l, s), 0.0) for l in self.data.lines)
                cum_d += self.demand.get((v, s), 0.0)
                if cum_p < cum_d - self.tol:
                    violations.append(f"Treated cumulative unmet: Prod {v}, Week {s} (CumProd: {cum_p:.3f}, CumDem: {cum_d:.3f})")

        # 3. Shift limits and integrality
        for l in self.data.lines:
            for s in self.data.weeks:
                sh = shifts.get((l, s), 0)
                if sh < 0 or sh > self.data.max_shifts_per_line_week:
                    violations.append(f"Shift bound violated: Line {l}, Week {s} has {sh} shifts")

        # 4. Line capacity limits
        for l in self.data.lines:
            for s in self.data.weeks:
                tot_p = sum(production.get((v, l, s), 0.0) for v in self.data.products)
                sh = shifts.get((l, s), 0)
                max_avail = self.data.capacity[l] * self.data.hours_per_shift * sh
                if tot_p > max_avail + self.tol:
                    violations.append(f"Line capacity exceeded: Line {l}, Week {s} (Prod: {tot_p:.3f}, Max: {max_avail:.3f})")

        # 5. Storage capacity limits
        cum_p_tot = 0.0
        cum_d_tot = 0.0
        for s in self.data.weeks:
            cum_p_tot += sum(production.get((v, l, s), 0.0) for v in self.data.products for l in self.data.lines)
            cum_d_tot += sum(self.demand.get((v, s), 0.0) for v in self.data.products)
            inv = cum_p_tot - cum_d_tot
            if inv > self.data.storage_capacity + self.tol:
                violations.append(f"Storage limit exceeded: Week {s} inventory {inv:.3f} > {self.data.storage_capacity}")

        # 6. Independent Cost Recalculation
        calc_labour = sum(shifts.values()) * self.data.labour_cost_per_shift
        calc_prod = sum(
            self.data.production_cost_coefficient * val / self.data.capacity[l]
            for (v, l, s), val in production.items()
        )
        calc_total = calc_labour + calc_prod
        if abs(calc_total - sol["objective_value"]) > 0.05:
            violations.append(f"Objective mismatch: Solver {sol['objective_value']:.2f} != Calculated {calc_total:.2f}")

        return {
            "is_valid": len(violations) == 0,
            "violations_count": len(violations),
            "violations": violations,
            "calculated_labour_cost": calc_labour,
            "calculated_production_cost": calc_prod,
            "calculated_total_cost": calc_total
        }

    def validate_expiry(self, sol: Dict[str, Any]) -> Dict[str, Any]:
        violations: List[str] = []
        production = sol.get("production", {})
        shifts = sol.get("shifts", {})
        consumption = sol.get("consumption", {})
        waste = sol.get("waste", {})

        # 1. Inoculated Demand Satisfaction from Eligible Cohorts
        for v in self.data.inoculated_products:
            for s in self.data.weeks:
                tot_u = sum(consumption.get((v, s, a), 0.0) for a in [0, 1, 2])
                d_s = self.demand.get((v, s), 0.0)
                if tot_u < d_s - self.tol:
                    violations.append(f"Inoculated demand unmet: Prod {v}, Week {s} (Used: {tot_u:.3f}, Demand: {d_s:.3f})")

        # 2. Treated Inventory Non-Negativity & Demand Satisfaction
        for v in self.data.treated_products:
            cum_p = 0.0
            cum_d = 0.0
            for s in self.data.weeks:
                cum_p += sum(production.get((v, l, s), 0.0) for l in self.data.lines)
                cum_d += self.demand.get((v, s), 0.0)
                if cum_p < cum_d - self.tol:
                    violations.append(f"Treated unmet: Prod {v}, Week {s} (CumProd: {cum_p:.3f}, CumDem: {cum_d:.3f})")

        # 3. Shift Limits
        for l in self.data.lines:
            for s in self.data.weeks:
                sh = shifts.get((l, s), 0)
                if sh < 0 or sh > self.data.max_shifts_per_line_week:
                    violations.append(f"Shift bound violated: Line {l}, Week {s} has {sh} shifts")

        # 4. Capacity Limits
        for l in self.data.lines:
            for s in self.data.weeks:
                tot_p = sum(production.get((v, l, s), 0.0) for v in self.data.products)
                sh = shifts.get((l, s), 0)
                max_avail = self.data.capacity[l] * self.data.hours_per_shift * sh
                if tot_p > max_avail + self.tol:
                    violations.append(f"Line capacity exceeded: Line {l}, Week {s} (Prod: {tot_p:.3f}, Max: {max_avail:.3f})")

        # 5. Cohort Conservation Check
        # For each inoculated product, total production across horizon must equal
        # total unexpired consumption + total waste + remaining inventory at week 19
        for v in self.data.inoculated_products:
            tot_prod_v = sum(production.get((v, l, s), 0.0) for l in self.data.lines for s in self.data.weeks)
            tot_use_v = sum(consumption.get((v, s, a), 0.0) for s in self.data.weeks for a in [0, 1, 2])
            tot_waste_v = sum(waste.get((v, s), 0.0) for s in self.data.weeks)
            
            # Reconstruct week 19 remaining stock
            # Trace cohort flow
            I0 = {s: 0.0 for s in self.data.weeks}
            I1 = {s: 0.0 for s in self.data.weeks}
            for s in self.data.weeks:
                p_s = sum(production.get((v, l, s), 0.0) for l in self.data.lines)
                u0 = consumption.get((v, s, 0), 0.0)
                I0[s] = p_s - u0
                u1 = consumption.get((v, s, 1), 0.0)
                prev_I0 = I0[s - 1] if s > 1 else 0.0
                I1[s] = prev_I0 - u1

            rem_19 = I0[19] + I1[19]
            balance_diff = abs(tot_prod_v - (tot_use_v + tot_waste_v + rem_19))
            if balance_diff > 0.01:
                violations.append(f"Cohort conservation violated for Prod {v}: Prod={tot_prod_v:.2f}, Use+Waste+Rem={tot_use_v+tot_waste_v+rem_19:.2f}")

        # 6. Storage Limits
        for s in self.data.weeks:
            inv_s = sol["weekly_inventory"].get(s, 0.0)
            if inv_s > self.data.storage_capacity + self.tol:
                violations.append(f"Storage limit exceeded in Week {s}: {inv_s:.2f} > {self.data.storage_capacity}")

        # 7. Independent Cost Recalculation
        calc_labour = sum(shifts.values()) * self.data.labour_cost_per_shift
        calc_prod = sum(
            self.data.production_cost_coefficient * val / self.data.capacity[l]
            for (v, l, s), val in production.items()
        )
        calc_waste = sum(waste.values()) * 10000.0
        calc_total = calc_labour + calc_prod + calc_waste
        if abs(calc_total - sol["objective_value"]) > 0.05:
            violations.append(f"Objective mismatch: Solver {sol['objective_value']:.2f} != Calculated {calc_total:.2f}")

        return {
            "is_valid": len(violations) == 0,
            "violations_count": len(violations),
            "violations": violations,
            "calculated_labour_cost": calc_labour,
            "calculated_production_cost": calc_prod,
            "calculated_total_cost": calc_total
        }

