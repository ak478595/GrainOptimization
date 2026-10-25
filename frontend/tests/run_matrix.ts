/**
 * 4-Way Scenario Regression Matrix Runner
 * Compares HiGHS Wasm solutions against Python CBC reference across:
 * 1. Baseline + Reference
 * 2. Baseline + Seasonal
 * 3. Expiry-Aware + Reference
 * 4. Expiry-Aware + Seasonal
 */

declare const require: any;
const highs = require('highs');
const fs = require('fs');
import { facilityData } from '../src/core/dataset';
import { generateSeasonalDemand, getSeasonalWeights } from '../src/core/scenarios';
import { LpGenerator } from '../src/solver/lp_generator';
import { SolutionValidator, ValidationAuditResult } from '../src/core/validator';

interface ScenarioResult {
  scenarioName: string;
  modelType: 'baseline' | 'expiry';
  status: string;
  solverObj: number;
  recalculatedObj: number;
  objDiscrepancy: number;
  shifts: number;
  wasteTonnes: number;
  solveDurationSec: number;
  validatorResult: ValidationAuditResult;
}

async function runMatrix() {
  console.log('================================================================');
  console.log('GrainOpt 2.0: 4-Way Scenario Full Regression Matrix (HiGHS Wasm)');
  console.log('================================================================\n');

  const solver = await highs();
  const weights = getSeasonalWeights();
  const seasonalDemand = generateSeasonalDemand(facilityData, weights);

  const runs: Array<{
    name: string;
    modelType: 'baseline' | 'expiry';
    demand: Record<string, Record<string, number>> | undefined;
    demandLabel: string;
  }> = [
    { name: 'Experiment 1: Baseline + Reference', modelType: 'baseline', demand: undefined, demandLabel: 'Reference' },
    { name: 'Experiment 2: Baseline + Seasonal', modelType: 'baseline', demand: seasonalDemand, demandLabel: 'Seasonal' },
    { name: 'Experiment 3: Expiry-Aware + Reference', modelType: 'expiry', demand: undefined, demandLabel: 'Reference' },
    { name: 'Experiment 4: Expiry-Aware + Seasonal', modelType: 'expiry', demand: seasonalDemand, demandLabel: 'Seasonal' },
  ];

  const results: ScenarioResult[] = [];

  for (const exp of runs) {
    console.log(`--- Running ${exp.name} ---`);
    const validator = new SolutionValidator(facilityData, exp.demand);
    const generator = new LpGenerator(facilityData, { demandOverride: exp.demand });

    const isExpiry = exp.modelType === 'expiry';
    const lpString = isExpiry ? generator.generateExpiryLp() : generator.generateBaselineLp();

    const t0 = performance.now();
    const rawSol = solver.solve(lpString, { time_limit: 120, mip_rel_gap: 0.05, presolve: 'on' });
    const durationSec = (performance.now() - t0) / 1000;

    const prodMap: Record<string, number> = {};
    const shiftMap: Record<string, number> = {};
    const wasteMap: Record<string, number> = {};
    const consumptionMap: Record<string, number> = {};

    let totalShifts = 0;
    let totalWaste = 0;

    for (const [colName, col] of Object.entries(rawSol.Columns)) {
      const c = col as any;
      const val = c.Primal ?? 0;

      if (colName.startsWith('Shifts_')) {
        const [, l, s] = colName.split('_');
        const sVal = Math.round(val);
        shiftMap[`${l},${s}`] = sVal;
        totalShifts += sVal;
      } else if (colName.startsWith('Production_')) {
        const [, v, l, s] = colName.split('_');
        if (val > 1e-6) {
          prodMap[`${v},${l},${s}`] = val;
        }
      } else if (colName.startsWith('WasteInoc_')) {
        const [, v, s] = colName.split('_');
        if (val > 1e-6) {
          wasteMap[`${v},${s}`] = val;
          totalWaste += val;
        }
      } else if (colName.startsWith('UseInoc_')) {
        const [, v, s, aStr] = colName.split('_');
        const a = aStr.replace('age', '');
        if (val > 1e-6) {
          consumptionMap[`${v},${s},${a}`] = val;
        }
      }
    }

    const audit = isExpiry
      ? validator.validateExpiry({
          production: prodMap,
          shifts: shiftMap,
          waste: wasteMap,
          consumption: consumptionMap,
          objective_value: rawSol.ObjectiveValue,
        })
      : validator.validateBaseline({
          production: prodMap,
          shifts: shiftMap,
          objective_value: rawSol.ObjectiveValue,
        });

    const diff = Math.abs(rawSol.ObjectiveValue - audit.calculated_total_cost);

    results.push({
      scenarioName: exp.name,
      modelType: exp.modelType,
      status: rawSol.Status,
      solverObj: rawSol.ObjectiveValue,
      recalculatedObj: audit.calculated_total_cost,
      objDiscrepancy: diff,
      shifts: totalShifts,
      wasteTonnes: totalWaste,
      solveDurationSec: durationSec,
      validatorResult: audit,
    });

    console.log(`  Status: ${rawSol.Status}`);
    console.log(`  Shifts: ${totalShifts}`);
    console.log(`  Waste: ${totalWaste.toFixed(2)} t`);
    console.log(`  Solver Objective: \$${rawSol.ObjectiveValue.toFixed(2)}`);
    console.log(`  Recalculated Objective: \$${audit.calculated_total_cost.toFixed(2)} (diff: \$${diff.toFixed(4)})`);
    console.log(`  Duration: ${durationSec.toFixed(3)}s`);
    console.log(`  Validation: ${audit.is_valid ? 'PASSED (0 violations) ✓' : 'FAILED (' + audit.violations_count + ' violations) ✗'}\n`);
    if (!audit.is_valid) {
      console.error('  Violations:', audit.violations);
    }
  }

  // Summary Table
  console.log('========================================================================================');
  console.log('Summary Matrix: HiGHS Wasm 4-Scenario Evaluation');
  console.log('========================================================================================');
  for (const r of results) {
    console.log(
      `${r.scenarioName.padEnd(38)} | Status: ${r.status.padEnd(7)} | Shifts: ${String(r.shifts).padEnd(2)} | Waste: ${r.wasteTonnes.toFixed(2).padEnd(6)} t | Obj: \$${r.solverObj.toFixed(2).padEnd(9)} | Valid: ${r.validatorResult.is_valid ? 'YES' : 'NO'}`
    );
  }
}

runMatrix().catch(console.error);

