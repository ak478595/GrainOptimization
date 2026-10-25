"""
Pydantic API Schemas for GrainOpt 2.0.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    solver_available: bool
    solver_name: str


class ProductInfo(BaseModel):
    product_id: int
    product_class: str
    shelf_life_weeks: Optional[int] = None
    total_demand: float


class FacilityParametersResponse(BaseModel):
    products: List[int]
    lines: List[int]
    weeks: List[int]
    capacity: Dict[int, float]
    shift_hours: float
    working_days: float
    hours_per_shift: float
    max_shifts_per_line_week: int
    storage_capacity: float
    labour_cost_per_shift: float
    production_cost_coefficient: float
    shelf_life_weeks: int


class DatasetResponse(BaseModel):
    total_demand: float
    products: List[ProductInfo]
    parameters: FacilityParametersResponse
    weekly_total_demand: Dict[int, float]
    demand_matrix: Dict[str, Dict[str, float]]  # week -> {product_id: demand}


class SeasonalScenarioResponse(BaseModel):
    weights: Dict[int, float]
    is_normalized: bool
    total_weight: float
    description: str
    weekly_seasonal_demand: Dict[int, float]


class SolveRequest(BaseModel):
    model_type: str = Field("expiry", description="'baseline' or 'expiry'")
    scenario: str = Field("reference", description="'reference' or 'seasonal'")
    waste_penalty: Optional[float] = Field(10000.0, description="Penalty coefficient per unit of expired waste")
    gap_rel: Optional[float] = Field(0.05, description="Relative solver MIP gap (default 0.05)")
    time_limit: Optional[int] = Field(120, description="Solver time limit in seconds")
    demand_override: Optional[Dict[str, float]] = Field(None, description="Optional custom demand dictionary 'p,w' -> tonnes")


class ProductionEvent(BaseModel):
    product: int
    line: int
    week: int
    tonnes: float


class ShiftEvent(BaseModel):
    line: int
    week: int
    shifts: int


class SolverAudit(BaseModel):
    is_valid: bool
    violations_count: int
    violations: List[str]
    calculated_labour_cost: float
    calculated_production_cost: float
    calculated_total_cost: float


class SolveResponse(BaseModel):
    model_type: str
    scenario: str
    status: str
    is_optimal: bool
    objective_value: float
    operating_cost: float
    labour_cost: float
    production_cost: float
    waste_cost: float
    total_waste: float
    total_shifts: int
    shifts_by_line: Dict[int, int]
    total_production: float
    peak_inventory: float
    weekly_inventory: Dict[int, float]
    age_breakdown: Optional[Dict[int, float]] = None
    production_schedule: List[ProductionEvent]
    shift_schedule: List[ShiftEvent]
    audit: SolverAudit
    solver_metadata: Dict[str, Any]


class ValidateRequest(BaseModel):
    model_type: str = Field("expiry", description="'baseline' or 'expiry'")
    scenario: str = Field("reference", description="'reference' or 'seasonal'")
    production: Dict[str, float] = Field(..., description="Keyed as 'product,line,week'")
    shifts: Dict[str, int] = Field(..., description="Keyed as 'line,week'")
    waste: Optional[Dict[str, float]] = Field(default_factory=dict, description="Keyed as 'product,week'")
    consumption: Optional[Dict[str, float]] = Field(default_factory=dict, description="Keyed as 'product,week,age'")
    weekly_inventory: Optional[Dict[str, float]] = Field(default_factory=dict)
    objective_value: float


class ValidateResponse(BaseModel):
    is_valid: bool
    violations_count: int
    violations: List[str]
    calculated_labour_cost: float
    calculated_production_cost: float
    calculated_total_cost: float

