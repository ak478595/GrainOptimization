import rawDataset from '../data/dataset.json';

export interface Product {
  id: number;
  name: string;
  type: 'inoculated' | 'treated';
  shelf_life_weeks: number | null;
  total_demand: number;
  holding_cost: number;
}

export interface Line {
  id: number;
  name: string;
  capacity_tonnes_per_hour: number;
  hours_per_shift: number;
  shift_hours: number;
  working_days: number;
  regular_hourly_cost: number;
  overtime_hourly_cost: number;
  labour_cost_per_shift: number;
  max_shifts_per_week: number;
  rates: Record<string, number>;
}

export interface FacilityParameters {
  storage_capacity: number;
  max_shifts_per_line_week: number;
  max_facility_shifts_per_week: number;
  labour_cost_per_shift: number;
  production_cost_coefficient: number;
  shelf_life_weeks: number;
  waste_penalty: number;
  total_demand_tonnes: number;
  weeks: number[];
  weekly_totals: Record<string, number>;
}

export interface FacilityDataset {
  products: Product[];
  lines: Line[];
  demands: Record<string, Record<string, number>>; // [product_name][week_str] -> tonnes
  parameters: FacilityParameters;
}

export class FacilityData {
  public products: Product[];
  public lines: Line[];
  public demands: Record<string, Record<string, number>>;
  public parameters: FacilityParameters;

  public inoculatedProducts: Product[];
  public treatedProducts: Product[];
  public weeks: number[];
  public totalDemandTonnes: number;

  constructor(customData?: FacilityDataset) {
    const data = customData || (rawDataset as FacilityDataset);
    this.products = data.products;
    this.lines = data.lines;
    this.demands = data.demands;
    this.parameters = data.parameters;

    this.inoculatedProducts = this.products.filter((p) => p.type === 'inoculated');
    this.treatedProducts = this.products.filter((p) => p.type === 'treated');
    this.weeks = data.parameters.weeks;
    this.totalDemandTonnes = data.parameters.total_demand_tonnes;

    this.validate();
  }

  public validate(): void {
    if (this.products.length !== 17) {
      throw new Error(`Invalid product count: expected 17, got ${this.products.length}`);
    }
    if (this.inoculatedProducts.length !== 7 || this.treatedProducts.length !== 10) {
      throw new Error(
        `Invalid product classification: expected 7 inoculated and 10 treated, got ${this.inoculatedProducts.length} and ${this.treatedProducts.length}`
      );
    }
    if (this.lines.length !== 2) {
      throw new Error(`Invalid line count: expected 2, got ${this.lines.length}`);
    }
    if (this.weeks.length !== 19) {
      throw new Error(`Invalid planning horizon: expected 19 weeks, got ${this.weeks.length}`);
    }

    // Verify demand total across all 17 products and 19 weeks
    let totalComputed = 0;
    for (const p of this.products) {
      for (const w of this.weeks) {
        const val = this.demands[p.name]?.[String(w)] ?? 0;
        totalComputed += val;
      }
    }

    if (Math.abs(totalComputed - 12556.0) > 1e-4) {
      throw new Error(`Demand total mismatch: expected 12556.0 tonnes, got ${totalComputed}`);
    }
  }

  public getDemand(product: string | number, week: number): number {
    const pName = typeof product === 'number' ? `P${product}` : product;
    return this.demands[pName]?.[String(week)] ?? 0.0;
  }
}

// Global cached singleton instance
export const facilityData = new FacilityData();

