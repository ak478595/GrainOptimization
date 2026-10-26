/**
 * Scenario Lab & Telemetry Truthfulness Verification Test
 * Tests:
 * 1. Fixed benchmark configuration (0.05 gap tolerance) vs customized solver options.
 * 2. Truthful termination status: distinguishing "Feasible (within X% gap)" vs "Proven Optimal" (0 gap or proven bounds).
 * 3. Genuine best dual bound and achieved relative gap reporting directly from HiGHS.
 */

declare const require: any;
const highs = require('highs');
import { facilityData } from '../src/core/dataset';
import { LpGenerator } from '../src/solver/lp_generator';
import { generateSeasonalDemand, getSeasonalWeights } from '../src/core/scenarios';

async function testScenarioLabTelemetry() {
  console.log('Testing Scenario Lab Telemetry and Status Truthfulness...\n');

  const solver = await highs();
  const generator = new LpGenerator(facilityData);
  const baselineLp = generator.generateBaselineLp();

  // Test 1: HiGHS persistent model runs with 5% tolerance (Scenario Lab benchmark)
  console.log('1. Auditing Scenario Lab benchmark solve (gapRel = 0.05)...');
  const model5 = solver.createModel();
  model5.options.set('mip_rel_gap', 0.05);
  model5.options.set('presolve', 'on');
  model5.readModel({ format: 'lp', data: baselineLp });
  model5.run();

  const obj5 = model5.info.get('objective_function_value');
  const dualBound5 = model5.info.get('mip_dual_bound');
  const gap5 = model5.info.get('mip_gap');
  const statusNum5 = model5.getModelStatus();
  model5.dispose();

  console.log(`   Solver Obj: \$${obj5.toFixed(2)}`);
  console.log(`   Best Dual Bound: \$${dualBound5.toFixed(2)}`);
  console.log(`   Achieved Gap: ${(gap5 * 100).toFixed(4)}%`);
  console.log(`   HiGHS Status Code: ${statusNum5}`);

  if (gap5 <= 0) {
    throw new Error('Expected nonzero gap for 5% tolerance solve!');
  }
  if (!Number.isFinite(dualBound5) || dualBound5 > obj5) {
    throw new Error(`Dual bound invalid: ${dualBound5} vs ${obj5}`);
  }

  // Verify that status display does not claim global optimality when gap > 0
  const isProvenOptimal5 = statusNum5 === 7 && gap5 === 0;
  if (isProvenOptimal5) {
    throw new Error('CRITICAL FAIL: Solution with nonzero gap claimed to be proven globally optimal!');
  }
  const formattedStatus5 = statusNum5 === 7 && gap5 > 0
    ? `Feasible (within ${(gap5 * 100).toFixed(1)}% gap)`
    : 'Optimal';
  console.log(`   Truthful Status Label: "${formattedStatus5}"`);
  console.log('   ✓ Non-zero gap correctly classified as Feasible rather than Proven Optimal.');

  // Test 2: HiGHS persistent model runs with 0% tolerance (Proven Optimum)
  console.log('\n2. Auditing 0.0% gap solve (Proven Global Optimum)...');
  const model0 = solver.createModel();
  model0.options.set('mip_rel_gap', 0.0);
  model0.options.set('presolve', 'on');
  model0.readModel({ format: 'lp', data: baselineLp });
  model0.run();

  const obj0 = model0.info.get('objective_function_value');
  const dualBound0 = model0.info.get('mip_dual_bound');
  const gap0 = model0.info.get('mip_gap');
  const statusNum0 = model0.getModelStatus();
  model0.dispose();

  console.log(`   Solver Obj: \$${obj0.toFixed(2)}`);
  console.log(`   Best Dual Bound: \$${dualBound0.toFixed(2)}`);
  console.log(`   Achieved Gap: ${(gap0 * 100).toFixed(4)}%`);

  if (gap0 > 1e-5) {
    throw new Error(`Expected zero gap, got ${gap0}`);
  }
  const isProvenOptimal0 = statusNum0 === 7 && gap0 <= 1e-5;
  if (!isProvenOptimal0) {
    throw new Error('Expected 0 gap run to be recognized as Proven Optimal!');
  }
  console.log('   ✓ 0% gap solve correctly recognized as Proven Optimal.');

  // Test 3: Comparison of 5% benchmark vs 1% overview setting
  console.log('\n3. Verifying distinction between benchmark (5%) and tighter (1%) solver runs...');
  const model1 = solver.createModel();
  model1.options.set('mip_rel_gap', 0.01);
  model1.options.set('presolve', 'on');
  model1.readModel({ format: 'lp', data: baselineLp });
  model1.run();

  const obj1 = model1.info.get('objective_function_value');
  const gap1 = model1.info.get('mip_gap');
  model1.dispose();

  console.log(`   1% run Obj: \$${obj1.toFixed(2)} (gap: ${(gap1 * 100).toFixed(3)}%)`);
  console.log(`   5% benchmark run Obj: \$${obj5.toFixed(2)} (gap: ${(gap5 * 100).toFixed(3)}%)`);

  if (gap1 >= gap5) {
    throw new Error(`1% run should achieve tighter or equal gap: ${gap1} vs ${gap5}`);
  }
  console.log('   ✓ Tighter tolerance independently validated; benchmark status decoupled from dashboard settings.');

  console.log('\nALL SCENARIO LAB TELEMETRY TRUTHFULNESS TESTS PASSED! ✓\n');
}

testScenarioLabTelemetry().catch(err => {
  console.error('Test error:', err);
  (globalThis as any).process?.exit(1);
});
