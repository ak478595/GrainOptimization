/**
 * HighsSolverClient
 * Typed Promise-based client bridging the React UI / services to highs_worker.
 * Manages worker lifecycle, request serialization, concurrency, and timeouts.
 */

import { facilityData, FacilityData } from '../core/dataset';
import { LpGenerator } from './lp_generator';
import { SolutionValidator, ValidationAuditResult } from '../core/validator';
import type { SolverWorkerRequest, SolverWorkerResponse } from './highs_worker';
import type { SolveResponse, ShiftSchedule, CostBreakdown } from '../types/api';

export interface StandaloneSolveOptions {
  modelType: 'baseline' | 'expiry' | 'expiry_aware';
  scenario: 'reference' | 'seasonal';
  demandOverride?: Record<string, Record<string, number>>;
  timeLimitSeconds?: number;
  relativeGap?: number;
}

export class HighsSolverClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (val: SolverWorkerResponse) => void;
      reject: (err: any) => void;
      timer: any;
    }
  >();
  private data: FacilityData;

  constructor(data: FacilityData = facilityData) {
    this.data = data;
  }

  private initWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./highs_worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent<SolverWorkerResponse>) => {
        const res = e.data;
        const entry = this.pendingRequests.get(res.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pendingRequests.delete(res.id);
          entry.resolve(res);
        }
      };

      this.worker.onerror = (err) => {
        console.error('Highs Web Worker error:', err);
        for (const [, entry] of this.pendingRequests.entries()) {
          clearTimeout(entry.timer);
          entry.reject(new Error(`Web Worker runtime error: ${err.message}`));
        }
        this.pendingRequests.clear();
      };
    }
    return this.worker;
  }

  /**
   * Terminate and destroy worker (e.g. on unmount or hard reset).
   */
  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, entry] of this.pendingRequests.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Solver terminated.'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Dispatches an LP string to the background Web Worker with timeout safeguards.
   */
  public async executeLp(
    lpString: string,
    options?: { timeLimitSeconds?: number; relativeGap?: number }
  ): Promise<SolverWorkerResponse['solution']> {
    const worker = this.initWorker();
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timeoutMs = (options?.timeLimitSeconds ?? 180) * 1000 + 5000; // grace period

    const response = await new Promise<SolverWorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        // Do not leave worker hung
        this.terminate();
        reject(new Error(`Solve request timed out after ${(timeoutMs / 1000).toFixed(0)}s`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const requestMsg: SolverWorkerRequest = {
        id,
        action: 'solve',
        lpString,
        options,
      };

      worker.postMessage(requestMsg);
    });

    if (!response.success || !response.solution) {
      throw new Error(response.error || 'Solver returned an unsuccessful status');
    }

    return response.solution;
  }

  /**
   * Solves a complete model (Baseline or Expiry-Aware) and formats the result
   * identically to SolveResponse expected by the GrainOpt UI.
   */
  public async solveModel(options: StandaloneSolveOptions): Promise<SolveResponse> {
    const canonicalModel: 'baseline' | 'expiry' =
      options.modelType === 'expiry' || options.modelType === 'expiry_aware' ? 'expiry' : 'baseline';
    const isExpiry = canonicalModel === 'expiry';

    const generator = new LpGenerator(this.data, {
      demandOverride: options.demandOverride,
    });

    const lpString = isExpiry ? generator.generateExpiryLp() : generator.generateBaselineLp();

    const rawSol = await this.executeLp(lpString, {
      timeLimitSeconds: options.timeLimitSeconds ?? 120,
      relativeGap: options.relativeGap ?? 0.05,
    });

    // Maps for validation and output schemas
    const prodMap: Record<string, number> = {};
    const shiftMap: Record<string, number> = {};
    const wasteMap: Record<string, number> = {};
    const consumptionMap: Record<string, number> = {};

    // Nested structures matching backend SolveResponse
    const nestedProduction: Record<string, Record<string, Record<string, number>>> = {};
    const nestedInventory: Record<string, Record<string, number>> = {};
    const nestedCohortInventory: Record<string, Record<string, Record<string, number>>> = {};
    const nestedWaste: Record<string, Record<string, number>> = {};

    // Initialize nested maps
    for (const p of this.data.products) {
      nestedProduction[p.name] = { '1': {}, '2': {} };
      nestedInventory[p.name] = {};
      nestedCohortInventory[p.name] = {};
      nestedWaste[p.name] = {};
      for (const w of this.data.weeks) {
        nestedProduction[p.name]['1'][String(w)] = 0;
        nestedProduction[p.name]['2'][String(w)] = 0;
        nestedInventory[p.name][String(w)] = 0;
        nestedCohortInventory[p.name][String(w)] = { '0': 0, '1': 0, '2': 0 };
        nestedWaste[p.name][String(w)] = 0;
      }
    }

    const shiftSchedules: ShiftSchedule[] = [];
    const weeklyShifts: Record<number, Record<number, number>> = {};
    for (const w of this.data.weeks) {
      weeklyShifts[w] = { 1: 0, 2: 0 };
    }

    let totalProductionTonnes = 0;
    let totalWasteTonnes = 0;

    for (const [name, col] of Object.entries(rawSol.columns)) {
      const val = col.primal;

      if (name.startsWith('Shifts_')) {
        const [, lineStr, weekStr] = name.split('_');
        const l = parseInt(lineStr, 10);
        const w = parseInt(weekStr, 10);
        const sVal = Math.round(val);
        shiftMap[`${l},${w}`] = sVal;
        weeklyShifts[w][l] = sVal;
      } else if (name.startsWith('Production_')) {
        const [, prodStr, lineStr, weekStr] = name.split('_');
        const v = parseInt(prodStr, 10);
        const l = parseInt(lineStr, 10);
        const w = parseInt(weekStr, 10);

        if (val > 1e-6) {
          prodMap[`${v},${l},${w}`] = val;
          totalProductionTonnes += val;

          const prodObj = this.data.products.find((p) => p.id === v);
          if (prodObj) {
            nestedProduction[prodObj.name][String(l)][String(w)] = Math.round(val * 1000) / 1000;
          }
        }
      } else if (name.startsWith('WasteInoc_')) {
        const [, prodStr, weekStr] = name.split('_');
        const v = parseInt(prodStr, 10);
        const w = parseInt(weekStr, 10);
        if (val > 1e-6) {
          wasteMap[`${v},${w}`] = val;
          totalWasteTonnes += val;
          const prodObj = this.data.products.find((p) => p.id === v);
          if (prodObj) {
            nestedWaste[prodObj.name][String(w)] = Math.round(val * 1000) / 1000;
          }
        }
      } else if (name.startsWith('UseInoc_')) {
        const [, prodStr, weekStr, ageStr] = name.split('_');
        const v = parseInt(prodStr, 10);
        const w = parseInt(weekStr, 10);
        const a = parseInt(ageStr.replace('age', ''), 10);
        if (val > 1e-6) {
          consumptionMap[`${v},${w},${a}`] = val;
        }
      } else if (name.startsWith('InvInoc_')) {
        const [, prodStr, weekStr, ageStr] = name.split('_');
        const v = parseInt(prodStr, 10);
        const w = parseInt(weekStr, 10);
        const a = ageStr.replace('age', '');
        const prodObj = this.data.products.find((p) => p.id === v);
        if (prodObj && val > 1e-6) {
          nestedCohortInventory[prodObj.name][String(w)][a] = Math.round(val * 1000) / 1000;
          nestedInventory[prodObj.name][String(w)] =
            (nestedInventory[prodObj.name][String(w)] || 0) + Math.round(val * 1000) / 1000;
        }
      } else if (name.startsWith('InvTreated_')) {
        const [, prodStr, weekStr] = name.split('_');
        const v = parseInt(prodStr, 10);
        const w = parseInt(weekStr, 10);
        const prodObj = this.data.products.find((p) => p.id === v);
        if (prodObj && val > 1e-6) {
          nestedInventory[prodObj.name][String(w)] = Math.round(val * 1000) / 1000;
        }
      }
    }

    // Build ShiftSchedule list
    let totalShiftsCount = 0;
    for (const w of this.data.weeks) {
      for (const l of this.data.lines) {
        const sCount = weeklyShifts[w][l.id] ?? 0;
        totalShiftsCount += sCount;
        shiftSchedules.push({
          week: w,
          line: l.id,
          regular_shifts: Math.min(sCount, 2),
          overtime_shifts: Math.max(0, sCount - 2),
          total_shifts: sCount,
        });
      }
    }

    // Cost calculations
    let labourCost = 0;
    for (const l of this.data.lines) {
      for (const w of this.data.weeks) {
        labourCost += (shiftMap[`${l.id},${w}`] ?? 0) * this.data.parameters.labour_cost_per_shift;
      }
    }

    let productionCost = 0;
    for (const [k, val] of Object.entries(prodMap)) {
      const [, lineStr] = k.split(',');
      const l = parseInt(lineStr, 10);
      const lineObj = this.data.lines.find((ln) => ln.id === l);
      if (lineObj) {
        productionCost += (this.data.parameters.production_cost_coefficient * val) / lineObj.capacity_tonnes_per_hour;
      }
    }

    const wasteCost = totalWasteTonnes * this.data.parameters.waste_penalty;
    const totalCost = labourCost + productionCost + wasteCost;

    const costBreakdown: CostBreakdown = {
      regular_production_cost: Math.round(labourCost * 100) / 100,
      overtime_production_cost: Math.round(productionCost * 100) / 100,
      holding_cost: 0,
      waste_cost: Math.round(wasteCost * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
    };

    // Independent validation using scenario-specific demand
    const validator = new SolutionValidator(this.data, options.demandOverride);
    const validationResult: ValidationAuditResult = isExpiry
      ? validator.validateExpiry({
          production: prodMap,
          shifts: shiftMap,
          waste: wasteMap,
          consumption: consumptionMap,
          objective_value: rawSol.objectiveValue,
        })
      : validator.validateBaseline({
          production: prodMap,
          shifts: shiftMap,
          objective_value: rawSol.objectiveValue,
        });

    return {
      model_type: canonicalModel,
      scenario_name: options.scenario,
      status: rawSol.status,
      objective_value: Math.round(rawSol.objectiveValue * 100) / 100,
      best_bound: rawSol.bestBound !== null ? Math.round(rawSol.bestBound * 100) / 100 : 0,
      relative_gap: rawSol.relativeGap ?? 0,
      solve_time_seconds: Math.round(rawSol.solveTimeSeconds * 1000) / 1000,
      total_shifts: totalShiftsCount,
      total_production_tonnes: Math.round(totalProductionTonnes * 1000) / 1000,
      expiry_waste_total: isExpiry ? Math.round(totalWasteTonnes * 1000) / 1000 : null,
      cost_breakdown: costBreakdown,
      shift_schedule: shiftSchedules,
      production: nestedProduction,
      inventory: nestedInventory,
      cohort_inventory: isExpiry ? nestedCohortInventory : undefined,
      waste_by_week: isExpiry ? nestedWaste : undefined,
      validation: {
        is_valid: validationResult.is_valid,
        violations: validationResult.violations,
        summary: {
          violations_count: validationResult.violations_count,
          calculated_total_cost: validationResult.calculated_total_cost,
        },
      },
    };
  }
}

export const highsSolverClient = new HighsSolverClient();

