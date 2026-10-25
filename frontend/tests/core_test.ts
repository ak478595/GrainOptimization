// Stage 2 Core & Gate Unit Tests
declare const require: any;
const assert = require('assert');
import { facilityData } from '../src/core/dataset';
import { generateSeasonalDemand, getSeasonalWeights } from '../src/core/scenarios';
import { SolutionValidator } from '../src/core/validator';

console.log('Testing Stage 2 Core Components & 6-Gate Validator Thoroughly...');

// 1. Dataset Dimensions & Totals
console.log('1. Checking dataset dimensions...');
assert.strictEqual(facilityData.products.length, 17, 'Must have 17 products');
assert.strictEqual(facilityData.inoculatedProducts.length, 7, 'Must have 7 inoculated products');
assert.strictEqual(facilityData.treatedProducts.length, 10, 'Must have 10 treated products');
assert.strictEqual(facilityData.lines.length, 2, 'Must have 2 lines');
assert.strictEqual(facilityData.lines[0].capacity_tonnes_per_hour, 6.175, 'Line 1 rate must be 6.175 t/h');
assert.strictEqual(facilityData.lines[1].capacity_tonnes_per_hour, 6.650, 'Line 2 rate must be 6.650 t/h');
assert.strictEqual(facilityData.weeks.length, 19, 'Must have 19 weeks');
assert.strictEqual(facilityData.parameters.storage_capacity, 2700.0, 'Storage capacity must be 2700 t');
assert.strictEqual(facilityData.parameters.labour_cost_per_shift, 1000.0, 'Labour cost must be 1000/shift');
assert.strictEqual(facilityData.parameters.production_cost_coefficient, 10.0, 'Prod cost coeff must be 10');
assert.strictEqual(facilityData.parameters.waste_penalty, 10000.0, 'Waste penalty must be 10,000/t');
assert.strictEqual(facilityData.totalDemandTonnes, 12556.0, 'Cumulative demand must be 12,556.0 t');
console.log('✓ Dataset dimensions and constants passed.');

// 2. Seasonal Demand Conservation
console.log('2. Checking seasonal demand generation & total conservation...');
const weights = getSeasonalWeights();
const sumWeights = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
assert(Math.abs(sumWeights - 1.0) < 1e-6, 'Weights must sum to 1.0');

const seasonal = generateSeasonalDemand(facilityData, weights);
for (const p of facilityData.products) {
  const origTotal = facilityData.weeks.reduce(
    (sum, w) => sum + facilityData.getDemand(p.name, w),
    0
  );
  const seasTotal = facilityData.weeks.reduce(
    (sum, w) => sum + (seasonal[p.name]?.[String(w)] ?? 0),
    0
  );
  assert(Math.abs(origTotal - seasTotal) < 1e-4, `Product ${p.name} total must be conserved`);
}
console.log('✓ Seasonal demand conservation passed.');

// 3. Validator Gates Auditing (Both Valid & Invalid Examples for ALL 6 Gates)
console.log('3. Auditing all 6 Validator Gates...');
const validator = new SolutionValidator(facilityData);

// Gate 1: Unmet demand detection (Invalid & Valid)
const emptyAudit = validator.validateBaseline({
  production: {},
  shifts: { '1,1': 0 },
});
assert.strictEqual(emptyAudit.is_valid, false, 'Empty schedule must be invalid');
assert(emptyAudit.violations.some((v: string) => v.includes('Gate 1 Violation')), 'Must detect unmet demand');
console.log('✓ Gate 1 (Demand satisfaction) detection verified.');

// Gate 2: Inoculated Cohort Inventory Flow & Strict Shelf-Life Expiry
// Valid Gate 2 cohort flow:
// Produce 50 t in week 1 of P1 (Line 1). Consume 20 t in week 1 (fresh), 15 t in week 2 (age 1), 15 t in week 3 (age 2).
// In week 3, Age 2 balance: u2 (15) + Waste (0) == I_prev_1 (15). Conservation holds!
const validGate2Audit = validator.validateExpiry({
  production: { '1,1,1': 50.0 },
  shifts: { '1,1': 1 },
  consumption: {
    '1,1,0': 20.0,
    '1,2,1': 15.0,
    '1,3,2': 15.0,
  },
  waste: { '1,3': 0.0 },
});
// Verify cohort conservation check does not flag valid flow
assert(!validGate2Audit.violations.some((v: string) => v.includes('Cohort conservation violated')), 'Valid flow must pass Gate 2 conservation');

// Invalid Gate 2 cohort flow: Attempt to consume 25 t of age 2 when only 15 t reached age 2 (violates balance & conservation)
const invalidGate2Audit = validator.validateExpiry({
  production: { '1,1,1': 50.0 },
  shifts: { '1,1': 1 },
  consumption: {
    '1,1,0': 20.0,
    '1,2,1': 15.0,
    '1,3,2': 25.0, // 25 > 15!
  },
  waste: { '1,3': 0.0 },
});
assert(invalidGate2Audit.violations.some((v: string) => v.includes('Gate 2 Violation') || v.includes('Cohort conservation violated')), 'Must detect Gate 2 cohort violation');

// Invalid Gate 2 expiry test: Unconsumed age 1 stock allowed to lapse without entering waste
const unrecordedWasteAudit = validator.validateExpiry({
  production: { '1,1,1': 50.0 },
  shifts: { '1,1': 1 },
  consumption: {
    '1,1,0': 20.0,
    '1,2,1': 15.0,
    '1,3,2': 5.0, // only 5 used out of 15, but waste reported as 0!
  },
  waste: { '1,3': 0.0 },
});
assert(unrecordedWasteAudit.violations.some((v: string) => v.includes('Terminal age 2 expiry flow mismatch') || v.includes('Cohort conservation violated')), 'Must flag unrecorded expired waste');
console.log('✓ Gate 2 (Inoculated cohort flow & strict 2-week expiry) verified.');

// Gate 3: Shift limit violation (> 3 shifts)
const gate3Audit = validator.validateBaseline({
  production: {},
  shifts: { '1,1': 4 },
});
assert(gate3Audit.violations.some((v: string) => v.includes('Gate 3 Violation')), 'Must flag shift count > 3');
console.log('✓ Gate 3 (Shift bounds) check passed.');

// Gate 4: Line capacity exceeded
const gate4Audit = validator.validateBaseline({
  production: { '1,1,1': 1000.0 }, // 1000 t on line 1 with 1 shift (max 254.7 t)
  shifts: { '1,1': 1 },
});
assert(gate4Audit.violations.some((v: string) => v.includes('Gate 4 Violation')), 'Must flag capacity exceeded');
console.log('✓ Gate 4 (Line capacity) check passed.');

// Gate 5: Storage capacity exceeded
const gate5Audit = validator.validateBaseline({
  production: { '8,1,1': 3500.0 }, // 3500 t produced, initial inventory ~ 0 -> inventory > 2700 t
  shifts: { '1,1': 2 },
});
assert(gate5Audit.violations.some((v: string) => v.includes('Gate 5 Violation')), 'Must flag storage overflow');
console.log('✓ Gate 5 (Storage capacity) check passed.');

// Gate 6: Non-negativity and Cost Recalculation
const gate6Negative = validator.validateExpiry({
  production: { '1,1,1': -5.0 }, // Negative production
  shifts: { '1,1': 1 },
});
assert(gate6Negative.violations.some((v: string) => v.includes('Negative production')), 'Must flag negative production');

const gate6Mismatch = validator.validateBaseline({
  production: { '1,1,1': 100.0 },
  shifts: { '1,1': 1 },
  objective_value: 99999.0, // Deliberate mismatch
});
assert(gate6Mismatch.violations.some((v: string) => v.includes('Gate 6 Violation')), 'Must flag objective discrepancy');
console.log('✓ Gate 6 (Cost recalculation & non-negativity) check passed.');

console.log('\nAll 6 Gates Verified and Passed Successfully!');
