import { FacilityData } from './dataset';

export interface ValidationAuditResult {
  is_valid: boolean;
  violations_count: number;
  violations: string[];
  calculated_labour_cost: number;
  calculated_production_cost: number;
  calculated_waste_cost: number;
  calculated_total_cost: number;
}

export interface SolutionPayload {
  production: Record<string, number>; // Keyed as "product_id,line_id,week" or object
  shifts: Record<string, number>;     // Keyed as "line_id,week"
  waste?: Record<string, number>;      // Keyed as "product_id,week"
  consumption?: Record<string, number>;// Keyed as "product_id,week,age"
  objective_value?: number;
}

export class SolutionValidator {
  private data: FacilityData;
  private demand: Record<string, Record<string, number>>;
  private tol: number;

  constructor(
    data: FacilityData,
    demandOverride?: Record<string, Record<string, number>>,
    tolerance: number = 1e-4
  ) {
    this.data = data;
    this.demand = demandOverride || data.demands;
    this.tol = tolerance;
  }

  private parseProdKey(key: string): [number, number, number] {
    const parts = key.split(',').map((s) => s.trim().replace(/^P/, ''));
    return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
  }

  private parseShiftKey(key: string): [number, number] {
    const parts = key.split(',').map((s) => s.trim().replace(/^L/, ''));
    return [parseInt(parts[0]), parseInt(parts[1])];
  }

  /**
   * Gate 1-6 Baseline Audit:
   * Gate 1: Inoculated JIT demand satisfaction
   * Gate 2: Treated cumulative demand satisfaction
   * Gate 3: Shift integer bounds (0 <= shifts <= 3)
   * Gate 4: Line capacity limits (production <= capacity * hours_per_shift * shifts)
   * Gate 5: Warehouse storage bounds (inventory <= 2700 tonnes)
   * Gate 6: Independent cost recalculation and objective reconciliation
   */
  public validateBaseline(sol: SolutionPayload): ValidationAuditResult {
    const violations: string[] = [];
    const prodMap = sol.production;
    const shiftMap = sol.shifts;

    // Gate 1: Inoculated JIT demand satisfaction
    for (const p of this.data.inoculatedProducts) {
      for (const w of this.data.weeks) {
        let p_w = 0;
        for (const l of this.data.lines) {
          p_w += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }
        const d_w = this.demand[p.name]?.[String(w)] ?? 0;
        if (p_w < d_w - this.tol) {
          violations.push(
            `Gate 1 Violation (Inoculated JIT unmet): ${p.name}, Week ${w} (Produced: ${p_w.toFixed(3)}, Demand: ${d_w.toFixed(3)})`
          );
        }
      }
    }

    // Gate 2: Treated cumulative demand satisfaction
    for (const p of this.data.treatedProducts) {
      let cum_p = 0;
      let cum_d = 0;
      for (const w of this.data.weeks) {
        for (const l of this.data.lines) {
          cum_p += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }
        cum_d += this.demand[p.name]?.[String(w)] ?? 0;
        if (cum_p < cum_d - this.tol) {
          violations.push(
            `Gate 2 Violation (Treated cumulative unmet): ${p.name}, Week ${w} (CumProd: ${cum_p.toFixed(3)}, CumDem: ${cum_d.toFixed(3)})`
          );
        }
      }
    }

    // Gate 3: Shift bounds and integrality
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        const sh = shiftMap[`${l.id},${w}`] ?? 0;
        if (sh < 0 || sh > this.data.parameters.max_shifts_per_line_week || !Number.isInteger(sh)) {
          violations.push(
            `Gate 3 Violation (Shift bounds/integrality): Line ${l.id}, Week ${w} has ${sh} shifts`
          );
        }
      }
    }

    // Gate 4: Line capacity limits
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        let tot_p = 0;
        for (const p of this.data.products) {
          tot_p += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }
        const sh = shiftMap[`${l.id},${w}`] ?? 0;
        const max_avail = l.capacity_tonnes_per_hour * l.hours_per_shift * sh;
        if (tot_p > max_avail + this.tol) {
          violations.push(
            `Gate 4 Violation (Line capacity exceeded): Line ${l.id}, Week ${w} (Prod: ${tot_p.toFixed(3)}, Max: ${max_avail.toFixed(3)})`
          );
        }
      }
    }

    // Gate 5: Warehouse storage bounds
    let cum_p_tot = 0;
    let cum_d_tot = 0;
    for (const w of this.data.weeks) {
      for (const p of this.data.products) {
        for (const l of this.data.lines) {
          cum_p_tot += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }
        cum_d_tot += this.demand[p.name]?.[String(w)] ?? 0;
      }
      const inv = cum_p_tot - cum_d_tot;
      if (inv > this.data.parameters.storage_capacity + this.tol) {
        violations.push(
          `Gate 5 Violation (Storage limit exceeded): Week ${w} inventory ${inv.toFixed(3)} > ${this.data.parameters.storage_capacity}`
        );
      }
    }

    // Gate 6: Cost Recalculation
    let calc_labour = 0;
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        calc_labour += (shiftMap[`${l.id},${w}`] ?? 0) * this.data.parameters.labour_cost_per_shift;
      }
    }

    let calc_prod = 0;
    for (const [k, val] of Object.entries(prodMap)) {
      if (val > 0) {
        const [, lineId] = this.parseProdKey(k);
        const line = this.data.lines.find((l) => l.id === lineId);
        if (line) {
          calc_prod += (this.data.parameters.production_cost_coefficient * val) / line.capacity_tonnes_per_hour;
        }
      }
    }

    const calc_total = calc_labour + calc_prod;
    if (sol.objective_value !== undefined && Math.abs(calc_total - sol.objective_value) > 0.05) {
      violations.push(
        `Gate 6 Violation (Objective mismatch): Solver ${sol.objective_value.toFixed(2)} != Calculated ${calc_total.toFixed(2)}`
      );
    }

    return {
      is_valid: violations.length === 0,
      violations_count: violations.length,
      violations,
      calculated_labour_cost: calc_labour,
      calculated_production_cost: calc_prod,
      calculated_waste_cost: 0,
      calculated_total_cost: calc_total,
    };
  }

  /**
   * Gate 1-6 Expiry-Aware Audit:
   * Gate 1: Inoculated cohort demand fulfillment (sum_a u[v,s,a] == d[v,s])
   * Gate 2: Cohort inventory flow conservation & 2-week expiry (I[v,s,2] == 0)
   * Gate 3: Shift integer bounds (0 <= shifts <= 3)
   * Gate 4: Line capacity limits (production <= capacity * hours_per_shift * shifts)
   * Gate 5: Warehouse storage bounds (I_inoc + I_treated <= 2700)
   * Gate 6: Independent cost recalculation including waste penalty (10,000 $/tonne)
   */
  public validateExpiry(sol: SolutionPayload): ValidationAuditResult {
    const violations: string[] = [];
    const prodMap = sol.production;
    const shiftMap = sol.shifts;
    const wasteMap = sol.waste || {};
    const consumptionMap = sol.consumption || {};

    // Non-negativity check
    for (const [k, val] of Object.entries(prodMap)) {
      if (val < -this.tol) {
        violations.push(`Negative production in ${k}: ${val}`);
      }
    }

    // Gate 1: Inoculated Demand Satisfaction from Eligible Cohorts
    for (const p of this.data.inoculatedProducts) {
      for (const w of this.data.weeks) {
        const u0 = consumptionMap[`${p.id},${w},0`] ?? 0;
        const u1 = consumptionMap[`${p.id},${w},1`] ?? 0;
        const u2 = consumptionMap[`${p.id},${w},2`] ?? 0;
        const tot_u = u0 + u1 + u2;
        const d_w = this.demand[p.name]?.[String(w)] ?? 0;
        if (Math.abs(tot_u - d_w) > this.tol) {
          violations.push(
            `Gate 1 Violation (Inoculated cohort demand mismatch): ${p.name}, Week ${w} (Consumed: ${tot_u.toFixed(3)}, Demand: ${d_w.toFixed(3)})`
          );
        }
      }
    }

    // Gate 2: Cohort Transitions and Expiry Balances
    for (const p of this.data.inoculatedProducts) {
      let I_prev_0 = 0;
      let I_prev_1 = 0;

      for (const w of this.data.weeks) {
        let p_w = 0;
        for (const l of this.data.lines) {
          p_w += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }

        const u0 = consumptionMap[`${p.id},${w},0`] ?? 0;
        const u1 = consumptionMap[`${p.id},${w},1`] ?? 0;
        const u2 = consumptionMap[`${p.id},${w},2`] ?? 0;
        const waste_w = wasteMap[`${p.id},${w}`] ?? 0;

        // Age 0 balance: I[v, w, 0] = Production - u0
        const I_curr_0 = p_w - u0;
        if (I_curr_0 < -this.tol) {
          violations.push(
            `Gate 2 Violation (Negative fresh cohort): ${p.name}, Week ${w} (Prod: ${p_w.toFixed(3)} < Consumed Age0: ${u0.toFixed(3)})`
          );
        }

        // Age 1 balance: I[v, w, 1] = I_prev_0 - u1
        const I_curr_1 = I_prev_0 - u1;
        if (I_curr_1 < -this.tol) {
          violations.push(
            `Gate 2 Violation (Age 1 overconsumed): ${p.name}, Week ${w} (Available Age1: ${I_prev_0.toFixed(3)} < Consumed: ${u1.toFixed(3)})`
          );
        }

        // Age 2 terminal balance: u2 + waste = I_prev_1
        const terminal_outflow = u2 + waste_w;
        if (Math.abs(terminal_outflow - I_prev_1) > this.tol) {
          violations.push(
            `Gate 2 Violation (Terminal age 2 expiry flow mismatch): ${p.name}, Week ${w} (Available: ${I_prev_1.toFixed(3)}, Used+Waste: ${terminal_outflow.toFixed(3)})`
          );
        }

        I_prev_0 = I_curr_0;
        I_prev_1 = I_curr_1;
      }
    }

    // Gate 3: Shift bounds and integrality
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        const sh = shiftMap[`${l.id},${w}`] ?? 0;
        if (sh < 0 || sh > this.data.parameters.max_shifts_per_line_week || !Number.isInteger(sh)) {
          violations.push(
            `Gate 3 Violation (Shift bounds/integrality): Line ${l.id}, Week ${w} has ${sh} shifts`
          );
        }
      }
    }

    // Gate 4: Line capacity limits
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        let tot_p = 0;
        for (const p of this.data.products) {
          tot_p += prodMap[`${p.id},${l.id},${w}`] ?? 0;
        }
        const sh = shiftMap[`${l.id},${w}`] ?? 0;
        const max_avail = l.capacity_tonnes_per_hour * l.hours_per_shift * sh;
        if (tot_p > max_avail + this.tol) {
          violations.push(
            `Gate 4 Violation (Line capacity exceeded): Line ${l.id}, Week ${w} (Prod: ${tot_p.toFixed(3)}, Max: ${max_avail.toFixed(3)})`
          );
        }
      }
    }

    // Gate 5: Warehouse storage bounds (perishable I_inoc + non-perishable I_treated <= 2700)
    for (const w of this.data.weeks) {
      let tot_stock_w = 0;

      // Inoculated stock
      for (const p of this.data.inoculatedProducts) {
        // Reconstruct closing inventory for week w
        let cum_prod = 0;
        let cum_use = 0;
        for (let s = 1; s <= w; s++) {
          for (const l of this.data.lines) {
            cum_prod += prodMap[`${p.id},${l.id},${s}`] ?? 0;
          }
          const u0 = consumptionMap[`${p.id},${s},0`] ?? 0;
          const u1 = consumptionMap[`${p.id},${s},1`] ?? 0;
          const u2 = consumptionMap[`${p.id},${s},2`] ?? 0;
          const wst = wasteMap[`${p.id},${s}`] ?? 0;
          cum_use += u0 + u1 + u2 + wst;
        }
        tot_stock_w += Math.max(0, cum_prod - cum_use);
      }

      // Treated stock
      for (const p of this.data.treatedProducts) {
        let cum_prod = 0;
        let cum_dem = 0;
        for (let s = 1; s <= w; s++) {
          for (const l of this.data.lines) {
            cum_prod += prodMap[`${p.id},${l.id},${s}`] ?? 0;
          }
          cum_dem += this.demand[p.name]?.[String(s)] ?? 0;
        }
        tot_stock_w += Math.max(0, cum_prod - cum_dem);
      }

      if (tot_stock_w > this.data.parameters.storage_capacity + this.tol) {
        violations.push(
          `Gate 5 Violation (Storage limit exceeded): Week ${w} stock ${tot_stock_w.toFixed(3)} > ${this.data.parameters.storage_capacity}`
        );
      }
    }

    // Gate 6: Cost Recalculation
    let calc_labour = 0;
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        calc_labour += (shiftMap[`${l.id},${w}`] ?? 0) * this.data.parameters.labour_cost_per_shift;
      }
    }

    let calc_prod = 0;
    for (const [k, val] of Object.entries(prodMap)) {
      if (val > 0) {
        const [, lineId] = this.parseProdKey(k);
        const line = this.data.lines.find((l) => l.id === lineId);
        if (line) {
          calc_prod += (this.data.parameters.production_cost_coefficient * val) / line.capacity_tonnes_per_hour;
        }
      }
    }

    let total_waste = 0;
    for (const val of Object.values(wasteMap)) {
      total_waste += val;
    }
    const calc_waste = total_waste * this.data.parameters.waste_penalty;
    const calc_total = calc_labour + calc_prod + calc_waste;

    if (sol.objective_value !== undefined && Math.abs(calc_total - sol.objective_value) > 0.05) {
      violations.push(
        `Gate 6 Violation (Objective mismatch): Solver ${sol.objective_value.toFixed(2)} != Calculated ${calc_total.toFixed(2)}`
      );
    }

    return {
      is_valid: violations.length === 0,
      violations_count: violations.length,
      violations,
      calculated_labour_cost: calc_labour,
      calculated_production_cost: calc_prod,
      calculated_waste_cost: calc_waste,
      calculated_total_cost: calc_total,
    };
  }
}

