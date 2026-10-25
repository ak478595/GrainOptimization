export interface ProductInfo {
  name: string;
  type: 'inoculated' | 'treated';
  holding_cost: number;
}

export interface LineInfo {
  id: number;
  name: string;
  hours_per_shift: number;
  regular_hourly_cost: number;
  overtime_hourly_cost: number;
  max_shifts_per_week: number;
  rates: Record<string, number>;
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  weights: number[];
}

export interface DatasetInfo {
  products: ProductInfo[];
  lines: LineInfo[];
  weeks: number[];
  demands: Record<string, Record<string, number>>;
  total_demand_tonnes: number;
  holding_capacities: Record<string, number>;
  max_total_shifts_per_week: number;
}

export interface SolveRequest {
  model_type: 'baseline' | 'expiry';
  scenario_name: string;
  time_limit_sec?: number;
  gap_rel?: number;
}

export interface ShiftSchedule {
  week: number;
  line: number;
  regular_shifts: number;
  overtime_shifts: number;
  total_shifts: number;
}

export interface CostBreakdown {
  regular_production_cost: number;
  overtime_production_cost: number;
  holding_cost: number;
  waste_cost: number;
  total_cost: number;
}

export interface SolveResponse {
  model_type: 'baseline' | 'expiry';
  scenario_name: string;
  status: string;
  objective_value: number;
  best_bound: number;
  relative_gap: number;
  solve_time_seconds: number;
  total_shifts: number;
  total_production_tonnes: number;
  expiry_waste_total: number | null;
  cost_breakdown: CostBreakdown;
  shift_schedule: ShiftSchedule[];
  production: Record<string, Record<string, Record<string, number>>>; // [product][line][week]
  inventory: Record<string, Record<string, number>>; // [product][week]
  cohort_inventory?: Record<string, Record<string, Record<string, number>>>; // [product][week][age]
  waste_by_week?: Record<string, Record<string, number>>; // [product][week]
  validation: {
    is_valid: boolean;
    violations: string[];
    summary: Record<string, any>;
  };
}

export interface ValidationRequest {
  production: Record<string, Record<string, Record<string, number>>>;
  shifts: ShiftSchedule[];
  scenario_name: string;
  model_type: string;
}

export interface ValidationResponse {
  is_valid: boolean;
  violations: string[];
  summary: Record<string, any>;
}

