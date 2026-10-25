// Verify LP Generator and HiGHS solve in Node
declare const require: any;
const assert = require('assert');
const highs = require('highs');
import { facilityData } from '../src/core/dataset';
import { LpGenerator } from '../src/solver/lp_generator';
import { SolutionValidator } from '../src/core/validator';

async function testFullModels() {
  console.log('Testing LP Generator and HiGHS full model solutions...');
  const solver = await highs();
  const generator = new LpGenerator(facilityData);
  const validator = new SolutionValidator(facilityData);

  // 1. Solve Baseline Model
  console.log('Generating Baseline LP...');
  const baselineLp = generator.generateBaselineLp();
  console.log(`Baseline LP length: ${baselineLp.length} chars. Solving with HiGHS...`);
  const t0 = Date.now();
  const resBaseline = solver.solve(baselineLp, { time_limit: 120, mip_rel_gap: 0.05 });
  const tBaseline = (Date.now() - t0) / 1000;
  console.log(`Baseline solved in ${tBaseline.toFixed(2)}s: Status=${resBaseline.Status}, Obj=${resBaseline.ObjectiveValue}`);

  // Extract baseline shifts and production
  const baseShifts: Record<string, number> = {};
  const baseProd: Record<string, number> = {};
  let totalBaseShifts = 0;

  for (const [colName, col] of Object.entries(resBaseline.Columns)) {
    if (colName.startsWith('Shifts_')) {
      const parts = colName.split('_');
      const l = parts[1];
      const s = parts[2];
      const val = Math.round((col as any).Primal);
      baseShifts[`${l},${s}`] = val;
      totalBaseShifts += val;
    } else if (colName.startsWith('Production_')) {
      const parts = colName.split('_');
      const v = parts[1];
      const l = parts[2];
      const s = parts[3];
      const val = (col as any).Primal;
      if (val > 1e-6) {
        baseProd[`${v},${l},${s}`] = val;
      }
    }
  }

  console.log(`Baseline total shifts: ${totalBaseShifts}`);
  const baseAudit = validator.validateBaseline({
    production: baseProd,
    shifts: baseShifts,
    objective_value: resBaseline.ObjectiveValue,
  });
  console.log('Baseline Validator Audit:', baseAudit.is_valid ? 'PASSED ✓' : 'FAILED ✗');
  if (!baseAudit.is_valid) {
    console.error('Violations:', baseAudit.violations);
  }
  assert(baseAudit.is_valid, 'Baseline solution must pass all validator gates');

  // 2. Solve Expiry-Aware Model
  console.log('\nGenerating Expiry-Aware LP...');
  const expiryLp = generator.generateExpiryLp();
  console.log(`Expiry LP length: ${expiryLp.length} chars. Solving with HiGHS...`);
  const t1 = Date.now();
  const resExpiry = solver.solve(expiryLp, { time_limit: 120, mip_rel_gap: 0.05 });
  const tExpiry = (Date.now() - t1) / 1000;
  console.log(`Expiry solved in ${tExpiry.toFixed(2)}s: Status=${resExpiry.Status}, Obj=${resExpiry.ObjectiveValue}`);

  // Extract expiry shifts, production, waste, consumption
  const expShifts: Record<string, number> = {};
  const expProd: Record<string, number> = {};
  const expWaste: Record<string, number> = {};
  const expUse: Record<string, number> = {};
  let totalExpShifts = 0;
  let totalExpWaste = 0;

  for (const [colName, col] of Object.entries(resExpiry.Columns)) {
    if (colName.startsWith('Shifts_')) {
      const parts = colName.split('_');
      const l = parts[1];
      const s = parts[2];
      const val = Math.round((col as any).Primal);
      expShifts[`${l},${s}`] = val;
      totalExpShifts += val;
    } else if (colName.startsWith('Production_')) {
      const parts = colName.split('_');
      const v = parts[1];
      const l = parts[2];
      const s = parts[3];
      const val = (col as any).Primal;
      if (val > 1e-6) {
        expProd[`${v},${l},${s}`] = val;
      }
    } else if (colName.startsWith('WasteInoc_')) {
      const parts = colName.split('_');
      const v = parts[1];
      const s = parts[2];
      const val = (col as any).Primal;
      if (val > 1e-6) {
        expWaste[`${v},${s}`] = val;
        totalExpWaste += val;
      }
    } else if (colName.startsWith('UseInoc_')) {
      const parts = colName.split('_');
      const v = parts[1];
      const s = parts[2];
      const a = parts[3].replace('age', '');
      const val = (col as any).Primal;
      if (val > 1e-6) {
        expUse[`${v},${s},${a}`] = val;
      }
    }
  }

  console.log(`Expiry total shifts: ${totalExpShifts}, total waste: ${totalExpWaste.toFixed(2)} tonnes`);
  const expAudit = validator.validateExpiry({
    production: expProd,
    shifts: expShifts,
    waste: expWaste,
    consumption: expUse,
    objective_value: resExpiry.ObjectiveValue,
  });
  console.log('Expiry Validator Audit:', expAudit.is_valid ? 'PASSED ✓' : 'FAILED ✗');
  if (!expAudit.is_valid) {
    console.error('Violations:', expAudit.violations);
  }
  assert(expAudit.is_valid, 'Expiry solution must pass all validator gates');

  console.log('\nBoth MILP Formulations successfully solved by HiGHS and 100% validated!');
}

testFullModels().catch(console.error);
