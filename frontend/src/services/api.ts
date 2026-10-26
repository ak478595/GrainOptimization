import { DatasetInfo, ScenarioInfo, SolveRequest, SolveResponse, ValidationRequest, ValidationResponse } from '../types/api';
import { facilityData } from '../core/dataset';
import { SCENARIOS, SEASONAL_WEIGHTS, generateSeasonalDemand, getSeasonalWeights } from '../core/scenarios';
import { highsSolverClient } from '../solver/solver_client';
import { SolutionValidator } from '../core/validator';

/**
 * Health check in standalone mode:
 * Performs an active initialization check on the HiGHS WASM solver worker
 * and reports genuine readiness.
 */
export async function checkHealth(): Promise<{ status: string; solver_available: boolean }> {
  return await highsSolverClient.checkHealth();
}

/**
 * Sourced directly from local verified dataset (17 products, 2 lines, 19 weeks, 12,556 t).
 */
export async function fetchDataset(): Promise<DatasetInfo> {
  const products = facilityData.products.map((p) => ({
    name: p.name,
    type: p.type,
    holding_cost: p.holding_cost,
  }));

  const lines = facilityData.lines.map((l) => ({
    id: l.id,
    name: l.name,
    hours_per_shift: l.hours_per_shift,
    regular_hourly_cost: l.regular_hourly_cost,
    overtime_hourly_cost: l.overtime_hourly_cost,
    max_shifts_per_week: l.max_shifts_per_week,
    rates: l.rates,
  }));

  return {
    products,
    lines,
    weeks: facilityData.weeks,
    demands: facilityData.demands,
    total_demand_tonnes: facilityData.totalDemandTonnes,
    holding_capacities: { warehouse: facilityData.parameters.storage_capacity },
    max_total_shifts_per_week: facilityData.parameters.max_facility_shifts_per_week,
  };
}

/**
 * Returns available scenario definitions from core scenarios.
 */
export async function fetchScenarios(): Promise<{ scenarios: ScenarioInfo[] }> {
  const scenarios: ScenarioInfo[] = SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    weights: Object.values(SEASONAL_WEIGHTS),
  }));
  return { scenarios };
}

/**
 * Solves the MILP model entirely in-browser using HiGHS WebAssembly.
 * Fully preserves all constraints, integer variables, telemetry, and independent validation.
 */
export async function solveModel(req: SolveRequest): Promise<SolveResponse> {
  const isSeasonal = req.scenario_name.toLowerCase().includes('seasonal');
  const scenarioType: 'reference' | 'seasonal' = isSeasonal ? 'seasonal' : 'reference';

  let demandOverride: Record<string, Record<string, number>> | undefined = undefined;
  if (isSeasonal) {
    const weights = getSeasonalWeights();
    demandOverride = generateSeasonalDemand(facilityData, weights);
  }

  return await highsSolverClient.solveModel({
    modelType: req.model_type,
    scenario: scenarioType,
    demandOverride,
    timeLimitSeconds: req.time_limit_sec ?? 120,
    relativeGap: req.gap_rel ?? 0.05,
  });
}

/**
 * Independently validates any solution using the client-side 6-gate SolutionValidator.
 */
export async function validateSolution(req: ValidationRequest): Promise<ValidationResponse> {
  const isSeasonal = req.scenario_name.toLowerCase().includes('seasonal');
  let demand: Record<string, Record<string, number>> | undefined = undefined;
  if (isSeasonal) {
    const weights = getSeasonalWeights();
    demand = generateSeasonalDemand(facilityData, weights);
  }

  const validator = new SolutionValidator(facilityData, demand);

  // Flatten production into [product_id,line_id,week] keys
  const prodMap: Record<string, number> = {};
  for (const [pName, lines] of Object.entries(req.production)) {
    const pObj = facilityData.products.find((p) => p.name === pName || `P${p.id}` === pName);
    const pId = pObj?.id ?? parseInt(pName.replace('P', ''), 10);
    for (const [lStr, weeks] of Object.entries(lines)) {
      const lId = parseInt(lStr, 10);
      for (const [wStr, val] of Object.entries(weeks)) {
        const w = parseInt(wStr, 10);
        if (val > 0) {
          prodMap[`${pId},${lId},${w}`] = val;
        }
      }
    }
  }

  // Flatten shifts
  const shiftMap: Record<string, number> = {};
  for (const s of req.shifts) {
    shiftMap[`${s.line},${s.week}`] = s.total_shifts;
  }

  const isExpiry = req.model_type === 'expiry' || req.model_type === 'expiry_aware';
  const audit = isExpiry
    ? validator.validateExpiry({
        production: prodMap,
        shifts: shiftMap,
      })
    : validator.validateBaseline({
        production: prodMap,
        shifts: shiftMap,
      });

  return {
    is_valid: audit.is_valid,
    violations: audit.violations,
    summary: {
      violations_count: audit.violations_count,
      calculated_total_cost: audit.calculated_total_cost,
    },
  };
}
