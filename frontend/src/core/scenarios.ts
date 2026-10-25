import { FacilityData } from './dataset';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  isSeasonal: boolean;
}

// Normalized illustrative weekly weights summing exactly to 1.00000
// Represents an agricultural cycle:
// - Weeks 1-5: Low / dormant pre-planting activity (1.5% per week)
// - Weeks 6-9: Planting ramp-up (4%, 6%, 8%, 10%)
// - Weeks 10-13: Peak harvest demand (12.5%, 13.5%, 13%, 11%)
// - Weeks 14-19: Post-harvest tapering
export const SEASONAL_WEIGHTS: Record<number, number> = {
  1: 0.015,
  2: 0.015,
  3: 0.015,
  4: 0.015,
  5: 0.015,
  6: 0.040,
  7: 0.060,
  8: 0.080,
  9: 0.100,
  10: 0.125,
  11: 0.135,
  12: 0.130,
  13: 0.110,
  14: 0.060,
  15: 0.040,
  16: 0.020,
  17: 0.015,
  18: 0.007,
  19: 0.003,
};

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'reference',
    name: 'Reference Weekly Demand',
    description: 'Empirical historical demand profile from Bayá et al. (2022).',
    isSeasonal: false,
  },
  {
    id: 'seasonal',
    name: 'Seasonal Harvest Surge Profile',
    description: 'Three-Phase Agricultural Cycle (Pre-planting, harvest peak, tapering) preserving product demand totals.',
    isSeasonal: true,
  },
];

export function getSeasonalWeights(): Record<number, number> {
  return { ...SEASONAL_WEIGHTS };
}

/**
 * Generates seasonal demand distribution preserving each product's 19-week demand volume:
 * demand[p, w] = product_total[p] * gamma[w]
 */
export function generateSeasonalDemand(
  facility: FacilityData,
  weights: Record<number, number> = SEASONAL_WEIGHTS
): Record<string, Record<string, number>> {
  // Validate weights sum to 1.0 within tolerance
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(totalWeight - 1.0) > 1e-6) {
    throw new Error(`Seasonal weights must sum to 1.0. Current sum: ${totalWeight}`);
  }

  const seasonalDemands: Record<string, Record<string, number>> = {};

  for (const p of facility.products) {
    seasonalDemands[p.name] = {};
    const pTotal = facility.weeks.reduce(
      (sum, w) => sum + facility.getDemand(p.name, w),
      0
    );

    for (const w of facility.weeks) {
      const weight = weights[w] ?? 0.0;
      seasonalDemands[p.name][String(w)] = pTotal * weight;
    }
  }

  return seasonalDemands;
}

