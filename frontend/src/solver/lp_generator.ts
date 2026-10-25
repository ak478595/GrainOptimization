/**
 * LP Generator for GrainOpt 2.0
 * Generates CPLEX LP format formulations for Baseline and Expiry-Aware models.
 * Strictly adheres to the mathematical formulations in:
 * - backend/app/models/milp_baseline.py
 * - backend/app/models/milp_expiry.py
 */

import { FacilityData } from '../core/dataset';

export interface LpGeneratorOptions {
  demandOverride?: Record<string, Record<string, number>>; // productName -> weekStr -> tonnes
  wastePenalty?: number; // default 10,000 $/tonne
}

export class LpGenerator {
  private data: FacilityData;
  private demand: Record<string, Record<string, number>>;
  private wastePenalty: number;

  constructor(data: FacilityData, options: LpGeneratorOptions = {}) {
    this.data = data;
    this.demand = options.demandOverride || data.demands;
    this.wastePenalty = options.wastePenalty ?? data.parameters.waste_penalty;
  }

  private getDemandVal(productName: string, week: number): number {
    return this.demand[productName]?.[String(week)] ?? 0;
  }

  /**
   * Generates CPLEX LP text for the Baseline model.
   * - Inoculated products (1-7): Weekly Just-In-Time demand satisfaction (sum_l x >= d).
   * - Treated products (8-17): Cumulative demand satisfaction (sum_{t<=s} sum_l x >= sum_{t<=s} d).
   * - Line capacity limits: sum_v x <= capacity_l * 41.25 * shifts_{l,s}.
   * - Storage limits: sum_{t<=s} sum_{v,l} x - sum_{t<=s} sum_v d <= 2700.
   * - Shifts: 0 <= shifts <= 3, integer.
   * - Objective: Labour ($1000/shift) + Production ($10 * x / cap_l).
   */
  public generateBaselineLp(): string {
    const lines: string[] = [];

    // 1. Objective: Minimize
    lines.push('Minimize');
    const objTerms: string[] = [];

    // Labour cost: 1000 * Shifts_{l}_{s}
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        objTerms.push(`${this.data.parameters.labour_cost_per_shift} Shifts_${l.id}_${s}`);
      }
    }

    // Production cost: (10.0 / cap_l) * Production_{v}_{l}_{s}
    for (const v of this.data.products) {
      for (const l of this.data.lines) {
        const unitCost = this.data.parameters.production_cost_coefficient / l.capacity_tonnes_per_hour;
        for (const s of this.data.weeks) {
          objTerms.push(`${unitCost.toFixed(6)} Production_${v.id}_${l.id}_${s}`);
        }
      }
    }

    lines.push(' obj: ' + objTerms.join(' + '));

    // 2. Subject To
    lines.push('Subject To');

    // Constraint 1: Inoculated weekly JIT demand
    for (const v of this.data.inoculatedProducts) {
      for (const s of this.data.weeks) {
        const d_s = this.getDemandVal(v.name, s);
        const lhs = this.data.lines.map((l) => `Production_${v.id}_${l.id}_${s}`).join(' + ');
        lines.push(` Inoc_Demand_${v.id}_${s}: ${lhs} >= ${d_s.toFixed(6)}`);
      }
    }

    // Constraint 2: Treated cumulative demand
    for (const v of this.data.treatedProducts) {
      let cumDemand = 0;
      for (const s of this.data.weeks) {
        cumDemand += this.getDemandVal(v.name, s);
        const prodTerms: string[] = [];
        for (let t = 1; t <= s; t++) {
          for (const l of this.data.lines) {
            prodTerms.push(`Production_${v.id}_${l.id}_${t}`);
          }
        }
        lines.push(` Treated_Demand_${v.id}_${s}: ${prodTerms.join(' + ')} >= ${cumDemand.toFixed(6)}`);
      }
    }

    // Constraint 3: Line capacity limits
    for (const l of this.data.lines) {
      const shiftCap = l.capacity_tonnes_per_hour * l.hours_per_shift;
      for (const s of this.data.weeks) {
        const prodTerms = this.data.products.map((v) => `Production_${v.id}_${l.id}_${s}`);
        lines.push(` Capacity_Line_${l.id}_Week_${s}: ${prodTerms.join(' + ')} - ${shiftCap.toFixed(6)} Shifts_${l.id}_${s} <= 0`);
      }
    }

    // Constraint 4: Storage capacity limits
    for (const s of this.data.weeks) {
      let cumTotalDemand = 0;
      const cumTotalProd: string[] = [];
      for (let t = 1; t <= s; t++) {
        for (const v of this.data.products) {
          cumTotalDemand += this.getDemandVal(v.name, t);
          for (const l of this.data.lines) {
            cumTotalProd.push(`Production_${v.id}_${l.id}_${t}`);
          }
        }
      }
      const rhs = this.data.parameters.storage_capacity + cumTotalDemand;
      lines.push(` Storage_Capacity_Week_${s}: ${cumTotalProd.join(' + ')} <= ${rhs.toFixed(6)}`);
    }

    // 3. Bounds
    lines.push('Bounds');
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        lines.push(` 0 <= Shifts_${l.id}_${s} <= ${this.data.parameters.max_shifts_per_line_week}`);
      }
    }
    for (const v of this.data.products) {
      for (const l of this.data.lines) {
        for (const s of this.data.weeks) {
          lines.push(` Production_${v.id}_${l.id}_${s} >= 0`);
        }
      }
    }

    // 4. Generals (Integer variables)
    lines.push('General');
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        lines.push(` Shifts_${l.id}_${s}`);
      }
    }

    lines.push('End');
    return lines.join('\n');
  }

  /**
   * Generates CPLEX LP text for the Expiry-Aware model.
   * - Inoculated products (1-7): Age-indexed tracking (age 0 in week s, usable in weeks s, s+1, s+2).
   *   - I[v, s, 0] = sum_l x[v, l, s] - u[v, s, 0]
   *   - I[v, s, 1] = I[v, s-1, 0] - u[v, s, 1] (for s >= 2)
   *   - u[v, s, 2] + W[v, s] = I[v, s-1, 1] (for s >= 3)
   *   - Initial / boundary: I[v, 0, a] = 0, u[v, 1, 1] = 0, u[v, s, 2] = 0 (s in {1,2}), W[v, s] = 0 (s in {1,2}).
   *   - Inoculated demand: sum_{a=0}^2 u[v, s, a] >= d[v, s].
   * - Treated products (8-17): Non-perishable inventory balance:
   *   - I_treated[v, s] = I_treated[v, s-1] + sum_l x[v, l, s] - d[v, s]
   * - Aggregate storage limit: sum_v (I[v, s, 0] + I[v, s, 1]) + sum_v I_treated[v, s] <= 2700.
   * - Production and shifts: identical to baseline.
   * - Objective: Labour ($1000/shift) + Production ($10*x/cap_l) + Waste Penalty ($10000/tonne).
   */
  public generateExpiryLp(): string {
    const lines: string[] = [];

    // 1. Objective: Minimize
    lines.push('Minimize');
    const objTerms: string[] = [];

    // Labour cost: 1000 * Shifts_{l}_{s}
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        objTerms.push(`${this.data.parameters.labour_cost_per_shift} Shifts_${l.id}_${s}`);
      }
    }

    // Production cost: (10.0 / cap_l) * Production_{v}_{l}_{s}
    for (const v of this.data.products) {
      for (const l of this.data.lines) {
        const unitCost = this.data.parameters.production_cost_coefficient / l.capacity_tonnes_per_hour;
        for (const s of this.data.weeks) {
          objTerms.push(`${unitCost.toFixed(6)} Production_${v.id}_${l.id}_${s}`);
        }
      }
    }

    // Waste cost: wastePenalty * WasteInoc_{v}_{s}
    for (const v of this.data.inoculatedProducts) {
      for (const s of this.data.weeks) {
        objTerms.push(`${this.wastePenalty.toFixed(2)} WasteInoc_${v.id}_${s}`);
      }
    }

    lines.push(' obj: ' + objTerms.join(' + '));

    // 2. Subject To
    lines.push('Subject To');

    // A. Inoculated Inventory Ageing & Cohort Balance
    for (const v of this.data.inoculatedProducts) {
      for (const s of this.data.weeks) {
        // Age 0 balance: I_inoc[v, s, 0] - sum_l x[v, l, s] + u[v, s, 0] = 0
        const prodTerms = this.data.lines.map((l) => `- Production_${v.id}_${l.id}_${s}`).join(' ');
        lines.push(` Inoc_Age0_Bal_${v.id}_${s}: InvInoc_${v.id}_${s}_age0 + UseInoc_${v.id}_${s}_age0 ${prodTerms} = 0`);

        // Age 1 balance: I_inoc[v, s, 1] - I_inoc[v, s-1, 0] + u[v, s, 1] = 0
        if (s === 1) {
          lines.push(` Inoc_Age1_InitUse_${v.id}_${s}: UseInoc_${v.id}_1_age1 = 0`);
          lines.push(` Inoc_Age1_InitInv_${v.id}_${s}: InvInoc_${v.id}_1_age1 = 0`);
        } else {
          lines.push(` Inoc_Age1_Bal_${v.id}_${s}: InvInoc_${v.id}_${s}_age1 + UseInoc_${v.id}_${s}_age1 - InvInoc_${v.id}_${s - 1}_age0 = 0`);
        }

        // Age 2 balance & Waste: u[v, s, 2] + W[v, s] - I_inoc[v, s-1, 1] = 0
        if (s === 1 || s === 2) {
          lines.push(` Inoc_Age2_BoundaryUse_${v.id}_${s}: UseInoc_${v.id}_${s}_age2 = 0`);
          lines.push(` Inoc_Age2_BoundaryWaste_${v.id}_${s}: WasteInoc_${v.id}_${s} = 0`);
        } else {
          lines.push(` Inoc_Age2_BalWaste_${v.id}_${s}: UseInoc_${v.id}_${s}_age2 + WasteInoc_${v.id}_${s} - InvInoc_${v.id}_${s - 1}_age1 = 0`);
        }

        // Inoculated Demand satisfaction: u[v, s, 0] + u[v, s, 1] + u[v, s, 2] >= d[v, s]
        const d_s = this.getDemandVal(v.name, s);
        lines.push(` Inoc_Demand_Sat_${v.id}_${s}: UseInoc_${v.id}_${s}_age0 + UseInoc_${v.id}_${s}_age1 + UseInoc_${v.id}_${s}_age2 >= ${d_s.toFixed(6)}`);
      }
    }

    // B. Treated Inventory Balance: I_treated[v, s] - I_treated[v, s-1] - sum_l x[v, l, s] = -d[v, s]
    for (const v of this.data.treatedProducts) {
      for (const s of this.data.weeks) {
        const d_s = this.getDemandVal(v.name, s);
        const prodTerms = this.data.lines.map((l) => `- Production_${v.id}_${l.id}_${s}`).join(' ');
        if (s === 1) {
          lines.push(` Treated_Bal_${v.id}_${s}: InvTreated_${v.id}_${s} ${prodTerms} = -${d_s.toFixed(6)}`);
        } else {
          lines.push(` Treated_Bal_${v.id}_${s}: InvTreated_${v.id}_${s} - InvTreated_${v.id}_${s - 1} ${prodTerms} = -${d_s.toFixed(6)}`);
        }
      }
    }

    // C. Line Capacity Limits
    for (const l of this.data.lines) {
      const shiftCap = l.capacity_tonnes_per_hour * l.hours_per_shift;
      for (const s of this.data.weeks) {
        const prodTerms = this.data.products.map((v) => `Production_${v.id}_${l.id}_${s}`);
        lines.push(` Capacity_Line_${l.id}_Week_${s}: ${prodTerms.join(' + ')} - ${shiftCap.toFixed(6)} Shifts_${l.id}_${s} <= 0`);
      }
    }

    // D. Aggregate Facility Storage Capacity: sum_v (InvInoc_age0 + InvInoc_age1) + sum_v InvTreated <= 2700
    for (const s of this.data.weeks) {
      const invTerms: string[] = [];
      for (const v of this.data.inoculatedProducts) {
        invTerms.push(`InvInoc_${v.id}_${s}_age0`);
        invTerms.push(`InvInoc_${v.id}_${s}_age1`);
      }
      for (const v of this.data.treatedProducts) {
        invTerms.push(`InvTreated_${v.id}_${s}`);
      }
      lines.push(` Storage_Capacity_Week_${s}: ${invTerms.join(' + ')} <= ${this.data.parameters.storage_capacity.toFixed(6)}`);
    }

    // 3. Bounds
    lines.push('Bounds');
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        lines.push(` 0 <= Shifts_${l.id}_${s} <= ${this.data.parameters.max_shifts_per_line_week}`);
      }
    }
    for (const v of this.data.products) {
      for (const l of this.data.lines) {
        for (const s of this.data.weeks) {
          lines.push(` Production_${v.id}_${l.id}_${s} >= 0`);
        }
      }
    }
    for (const v of this.data.inoculatedProducts) {
      for (const s of this.data.weeks) {
        lines.push(` UseInoc_${v.id}_${s}_age0 >= 0`);
        lines.push(` UseInoc_${v.id}_${s}_age1 >= 0`);
        lines.push(` UseInoc_${v.id}_${s}_age2 >= 0`);
        lines.push(` InvInoc_${v.id}_${s}_age0 >= 0`);
        lines.push(` InvInoc_${v.id}_${s}_age1 >= 0`);
        lines.push(` WasteInoc_${v.id}_${s} >= 0`);
      }
    }
    for (const v of this.data.treatedProducts) {
      for (const s of this.data.weeks) {
        lines.push(` InvTreated_${v.id}_${s} >= 0`);
      }
    }

    // 4. Generals (Integer variables)
    lines.push('General');
    for (const l of this.data.lines) {
      for (const s of this.data.weeks) {
        lines.push(` Shifts_${l.id}_${s}`);
      }
    }

    lines.push('End');
    return lines.join('\n');
  }
}
