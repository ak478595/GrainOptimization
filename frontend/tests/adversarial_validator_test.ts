import { facilityData } from '../src/core/dataset';
import { SolutionValidator, SolutionPayload } from '../src/core/validator';
import { LpGenerator } from '../src/solver/lp_generator';
import highsLoader from 'highs';

async function runAdversarialAudit() {
  console.log('Running Comprehensive Adversarial Validation Tests...\n');

  const highs = await highsLoader();
  const generator = new LpGenerator(facilityData);
  const expiryLp = generator.generateExpiryLp();
  const rawSol = highs.solve(expiryLp, { mip_rel_gap: 0.05 });

  // Extract valid solution payload
  const prodMap: Record<string, number> = {};
  const shiftMap: Record<string, number> = {};
  const wasteMap: Record<string, number> = {};
  const consumptionMap: Record<string, number> = {};

  for (const [name, col] of Object.entries(rawSol.Columns || {})) {
    const val = (col as any).Primal ?? 0;
    if (name.startsWith('Shifts_')) {
      const [, lineStr, weekStr] = name.split('_');
      shiftMap[`${lineStr},${weekStr}`] = Math.round(val);
    } else if (name.startsWith('Production_')) {
      const [, prodStr, lineStr, weekStr] = name.split('_');
      if (val > 1e-6) prodMap[`${prodStr},${lineStr},${weekStr}`] = val;
    } else if (name.startsWith('WasteInoc_')) {
      const [, prodStr, weekStr] = name.split('_');
      if (val > 1e-6) wasteMap[`${prodStr},${weekStr}`] = val;
    } else if (name.startsWith('UseInoc_')) {
      const [, prodStr, weekStr, ageStr] = name.split('_');
      const a = parseInt(ageStr.replace('age', ''), 10);
      if (val > 1e-6) consumptionMap[`${prodStr},${weekStr},${a}`] = val;
    }
  }

  const validPayload: SolutionPayload = {
    production: { ...prodMap },
    shifts: { ...shiftMap },
    waste: { ...wasteMap },
    consumption: { ...consumptionMap },
    objective_value: rawSol.ObjectiveValue,
  };

  const validator = new SolutionValidator(facilityData);

  // 0. Base solution must pass
  const baseResult = validator.validateExpiry(validPayload);
  if (!baseResult.is_valid) {
    throw new Error(`Base solution unexpectedly failed validation: ${baseResult.violations.join(', ')}`);
  }
  console.log('✓ Valid Expiry solution verified clean (0 violations).');

  // Test 1: Adversarial False-Pass Case — Remove all treated product production & recompute objective
  {
    console.log('\nTest 1: Removing all treated product production with recalculated objective...');
    const advProd = { ...prodMap };
    for (const key of Object.keys(advProd)) {
      const [prodId] = key.split(',').map(Number);
      if (facilityData.treatedProducts.some(p => p.id === prodId)) {
        delete advProd[key];
      }
    }
    // Recalculate objective honestly to avoid Gate 6 catch
    let labour = 0;
    for (const l of facilityData.lines) {
      for (const w of facilityData.weeks) {
        labour += (shiftMap[`${l.id},${w}`] ?? 0) * facilityData.parameters.labour_cost_per_shift;
      }
    }
    let prod = 0;
    for (const [k, val] of Object.entries(advProd)) {
      const [, lineId] = k.split(',').map(Number);
      const line = facilityData.lines.find(l => l.id === lineId)!;
      prod += (facilityData.parameters.production_cost_coefficient * val) / line.capacity_tonnes_per_hour;
    }
    let wst = 0;
    for (const val of Object.values(wasteMap)) wst += val;
    const recalcObj = labour + prod + wst * facilityData.parameters.waste_penalty;

    const advPayload: SolutionPayload = {
      production: advProd,
      shifts: shiftMap,
      waste: wasteMap,
      consumption: consumptionMap,
      objective_value: recalcObj,
    };

    const res = validator.validateExpiry(advPayload);
    if (res.is_valid) {
      throw new Error('CRITICAL FAIL: Removing all treated production falsely passed validation!');
    }
    const gate1Violations = res.violations.filter(v => v.includes('Gate 1 Violation') && v.includes('Treated cumulative unmet'));
    if (gate1Violations.length === 0) {
      throw new Error(`CRITICAL FAIL: Treated product unmet demand was not caught in Gate 1! Violations: ${res.violations.join('; ')}`);
    }
    console.log(`✓ Caught ${gate1Violations.length} Gate 1 violations and ${res.violations.length} total violations when treated production was removed.`);
  }

  // Test 2: Negative inventory & consumption & waste domain violations
  {
    console.log('\nTest 2: Negative production, consumption, and waste domain checks...');
    const advPayload: SolutionPayload = {
      production: { ...prodMap, '1,1,1': -10 },
      shifts: { ...shiftMap },
      waste: { ...wasteMap, '1,1': -5 },
      consumption: { ...consumptionMap, '1,1,0': -8 },
      objective_value: validPayload.objective_value,
    };
    const res = validator.validateExpiry(advPayload);
    if (res.is_valid) throw new Error('CRITICAL FAIL: Negative values passed validation!');
    const domainViolations = res.violations.filter(v => v.includes('Domain Violation'));
    if (domainViolations.length < 3) {
      throw new Error(`Expected at least 3 Domain Violations, got: ${domainViolations.join('; ')}`);
    }
    console.log(`✓ Caught ${domainViolations.length} domain violations for negative values.`);
  }

  // Test 3: Missing objective value
  {
    console.log('\nTest 3: Missing objective value...');
    const advPayload: SolutionPayload = {
      production: { ...prodMap },
      shifts: { ...shiftMap },
      waste: { ...wasteMap },
      consumption: { ...consumptionMap },
      objective_value: undefined,
    };
    const res = validator.validateExpiry(advPayload);
    if (res.is_valid) throw new Error('CRITICAL FAIL: Undefined objective value passed validation!');
    const objViolation = res.violations.find(v => v.includes('Gate 6 Violation (Missing objective value)'));
    if (!objViolation) throw new Error(`Missing objective value violation not found: ${res.violations.join('; ')}`);
    console.log('✓ Caught missing objective value in Gate 6.');
  }

  // Test 4: Missing or invalid required payload structures
  {
    console.log('\nTest 4: Missing required payload structures...');
    const badPayload1 = { shifts: shiftMap } as any;
    const res1 = validator.validateExpiry(badPayload1);
    if (res1.is_valid || !res1.violations.some(v => v.includes('Missing or invalid production map'))) {
      throw new Error('CRITICAL FAIL: Missing production map passed validation!');
    }
    const badPayload2 = { production: prodMap } as any;
    const res2 = validator.validateExpiry(badPayload2);
    if (res2.is_valid || !res2.violations.some(v => v.includes('Missing or invalid shifts map'))) {
      throw new Error('CRITICAL FAIL: Missing shifts map passed validation!');
    }
    console.log('✓ Caught missing payload structures.');
  }

  // Test 5: Over-service in rigid baseline JIT
  {
    console.log('\nTest 5: Over-service in Baseline model...');
    const baseProd = { ...prodMap };
    // Add extra 50 tonnes of inoculated product P1 in week 1
    baseProd['1,1,1'] = (baseProd['1,1,1'] ?? 0) + 50;
    const res = validator.validateBaseline({
      production: baseProd,
      shifts: shiftMap,
      objective_value: 70000,
    });
    if (res.is_valid) throw new Error('CRITICAL FAIL: Baseline over-service passed validation!');
    const overService = res.violations.filter(v => v.includes('over-service'));
    if (overService.length === 0) throw new Error(`Expected over-service violation, got: ${res.violations.join('; ')}`);
    console.log(`✓ Caught baseline over-service: ${overService[0]}`);
  }

  // Test 6: Fractional shifts & shift bounds
  {
    console.log('\nTest 6: Fractional shifts and bounds...');
    const advShifts = { ...shiftMap, '1,1': 2.5 };
    const res = validator.validateExpiry({
      ...validPayload,
      shifts: advShifts,
    });
    if (res.is_valid) throw new Error('CRITICAL FAIL: Fractional shift passed validation!');
    const shiftViolations = res.violations.filter(v => v.includes('Gate 3 Violation'));
    if (shiftViolations.length === 0) throw new Error(`Expected Gate 3 shift violation, got: ${res.violations.join('; ')}`);
    console.log(`✓ Caught fractional shift: ${shiftViolations[0]}`);
  }

  // Test 7: Warehouse storage capacity violation
  {
    console.log('\nTest 7: Warehouse storage capacity violation...');
    const advProd = { ...prodMap };
    // Produce 3500 tonnes of treated product P4 in week 1 on Line 1 with enough shifts
    advProd['4,1,1'] = 3500;
    const advShifts = { ...shiftMap, '1,1': 3 };
    const res = validator.validateExpiry({
      ...validPayload,
      production: advProd,
      shifts: advShifts,
      objective_value: 100000,
    });
    if (res.is_valid) throw new Error('CRITICAL FAIL: Storage capacity exceedance passed validation!');
    const storageViolations = res.violations.filter(v => v.includes('Gate 5 Violation (Storage limit exceeded)'));
    if (storageViolations.length === 0) throw new Error(`Expected Gate 5 storage violation, got: ${res.violations.join('; ')}`);
    console.log(`✓ Caught storage capacity exceedance: ${storageViolations[0]}`);
  }

  console.log('\nALL 7 ADVERSARIAL VALIDATION TESTS PASSED WITH 100% SUCCESS! ✓\n');
}

runAdversarialAudit().catch(err => {
  console.error('\nAdversarial test error:', err);
  (globalThis as any).process?.exit(1);
});
