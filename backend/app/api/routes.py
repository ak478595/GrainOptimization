"""
REST API Routes for GrainOpt 2.0.
"""

from pathlib import Path
from typing import Dict, Tuple
from fastapi import APIRouter, HTTPException, status
import pulp

from app.core.dataset_loader import FacilityData
from app.models.milp_baseline import BaselineModel
from app.models.milp_expiry import ExpiryModel
from app.models.scenarios import get_seasonal_weights, generate_seasonal_demand
from app.services.validation import SolutionValidator
from app.services.solver_service import get_default_solver
from app.api.schemas import (
    HealthResponse,
    DatasetResponse,
    ProductInfo,
    FacilityParametersResponse,
    SeasonalScenarioResponse,
    SolveRequest,
    SolveResponse,
    ProductionEvent,
    ShiftEvent,
    SolverAudit,
    ValidateRequest,
    ValidateResponse,
)

router = APIRouter(prefix="/api")

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "grain_facility_dataset.xlsx"


def _get_facility_data() -> FacilityData:
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset file missing at {DATA_PATH}"
        )
    return FacilityData(DATA_PATH)


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint reporting solver availability and API status."""
    cbc_solver = pulp.PULP_CBC_CMD()
    is_avail = bool(cbc_solver.available())
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        solver_available=is_avail,
        solver_name="Coin-or CBC" if is_avail else "None"
    )


@router.get("/dataset", response_model=DatasetResponse)
def get_dataset():
    """Returns factory parameters, product classifications, and reference demand matrix."""
    data = _get_facility_data()

    products_info = []
    for p in data.products:
        p_class = "inoculated" if p in data.inoculated_products else "treated"
        shelf_life = data.shelf_life_weeks if p in data.inoculated_products else None
        tot_d = data.product_totals.get(p, 0.0)
        products_info.append(
            ProductInfo(
                product_id=p,
                product_class=p_class,
                shelf_life_weeks=shelf_life,
                total_demand=tot_d
            )
        )

    # Format demand matrix: week -> {product_id: demand}
    demand_matrix = {}
    for w in data.weeks:
        demand_matrix[str(w)] = {
            str(p): data.demand.get((p, w), 0.0)
            for p in data.products
        }

    params = FacilityParametersResponse(
        products=data.products,
        lines=data.lines,
        weeks=data.weeks,
        capacity=data.capacity,
        shift_hours=data.shift_hours,
        working_days=data.working_days,
        hours_per_shift=data.hours_per_shift,
        max_shifts_per_line_week=data.max_shifts_per_line_week,
        storage_capacity=data.storage_capacity,
        labour_cost_per_shift=data.labour_cost_per_shift,
        production_cost_coefficient=data.production_cost_coefficient,
        shelf_life_weeks=data.shelf_life_weeks
    )

    return DatasetResponse(
        total_demand=sum(data.product_totals.values()),
        products=products_info,
        parameters=params,
        weekly_total_demand=data.weekly_totals,
        demand_matrix=demand_matrix
    )


@router.get("/scenarios", response_model=SeasonalScenarioResponse)
def get_scenarios():
    """Returns the normalized seasonal weights and weekly aggregated demand profile."""
    data = _get_facility_data()
    weights = get_seasonal_weights()
    tot_weight = sum(weights.values())
    seasonal_d = generate_seasonal_demand(data.demand, data.products, data.weeks, weights)

    weekly_totals = {
        w: sum(seasonal_d.get((p, w), 0.0) for p in data.products)
        for w in data.weeks
    }

    return SeasonalScenarioResponse(
        weights=weights,
        is_normalized=abs(tot_weight - 1.0) < 1e-6,
        total_weight=tot_weight,
        description="Three-Phase Agricultural Cycle (Pre-planting, harvest peak, tapering)",
        weekly_seasonal_demand=weekly_totals
    )


@router.post("/solve", response_model=SolveResponse)
def solve_model(req: SolveRequest):
    """
    Solves the chosen MILP model formulation with CBC and returns full schedules,
    costs, cohort age breakdowns, waste, and independent validation audit results.
    """
    data = _get_facility_data()

    # 1. Determine demand profile
    scen = req.scenario.lower()
    if req.demand_override:
        # Parse custom demand
        demand = {}
        for k, v in req.demand_override.items():
            parts = k.split(",")
            if len(parts) == 2:
                demand[(int(parts[0]), int(parts[1]))] = float(v)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid demand_override key format '{k}'. Expected 'product,week'."
                )
    elif scen in ["seasonal", "seasonal_harvest_surge"]:
        demand = generate_seasonal_demand(data.demand, data.products, data.weeks)
    elif scen in ["reference", "reference_flat"]:
        demand = data.demand
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown scenario '{req.scenario}'. Expected 'reference' or 'seasonal'."
        )

    # 2. Build model
    raw_type = req.model_type.lower()
    if raw_type in ["baseline"]:
        model_type = "baseline"
        model = BaselineModel(data, demand_override=demand)
    elif raw_type in ["expiry", "expiry_aware"]:
        model_type = "expiry"
        model = ExpiryModel(data, demand_override=demand, waste_penalty=req.waste_penalty)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model_type '{req.model_type}'. Expected 'baseline' or 'expiry'."
        )

    # 3. Solver configuration
    solver = get_default_solver(
        msg=False,
        time_limit=req.time_limit or 120,
        gap_rel=req.gap_rel or 0.05
    )

    # 4. Solve
    import time
    start_time = time.time()
    sol = model.solve(solver=solver)
    elapsed_time = round(time.time() - start_time, 3)

    if not sol["is_optimal"] and sol["status"] not in ["Optimal", "Not Solved"]:
        # Infeasible or error
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Optimization failed. Solver returned status: {sol['status']}"
        )

    # 5. Independent validation
    validator = SolutionValidator(data, demand=demand)
    if model_type == "baseline":
        audit_res = validator.validate_baseline(sol)
    else:
        audit_res = validator.validate_expiry(sol)

    # 6. Format response
    prod_schedule = [
        ProductionEvent(product=v, line=l, week=s, tonnes=tonnes)
        for (v, l, s), tonnes in sol["production"].items()
    ]
    shift_schedule = [
        ShiftEvent(line=l, week=s, shifts=cnt)
        for (l, s), cnt in sol["shifts"].items()
        if cnt > 0
    ]

    solver_metadata = {
        "solver": "Coin-or CBC",
        "time_limit": req.time_limit,
        "gap_rel": req.gap_rel,
        "status_code": sol["status_code"],
        "solve_time": elapsed_time
    }

    return SolveResponse(
        model_type=model_type,
        scenario=req.scenario,
        status=sol["status"],
        is_optimal=sol["is_optimal"],
        objective_value=sol["objective_value"],
        operating_cost=sol.get("operating_cost", sol["objective_value"]),
        labour_cost=sol["labour_cost"],
        production_cost=sol["production_cost"],
        waste_cost=sol.get("waste_cost", 0.0),
        total_waste=sol.get("total_waste", 0.0),
        total_shifts=sol["total_shifts"],
        shifts_by_line=sol["shifts_by_line"],
        total_production=sol["total_production"],
        peak_inventory=sol["peak_inventory"],
        weekly_inventory=sol["weekly_inventory"],
        age_breakdown=sol.get("age_breakdown"),
        production_schedule=prod_schedule,
        shift_schedule=shift_schedule,
        audit=SolverAudit(
            is_valid=audit_res["is_valid"],
            violations_count=audit_res["violations_count"],
            violations=audit_res["violations"],
            calculated_labour_cost=audit_res["calculated_labour_cost"],
            calculated_production_cost=audit_res["calculated_production_cost"],
            calculated_total_cost=audit_res["calculated_total_cost"]
        ),
        solver_metadata=solver_metadata
    )


@router.post("/validate", response_model=ValidateResponse)
def validate_solution(req: ValidateRequest):
    """
    Independently audits any provided production and shift schedule without re-solving.
    """
    data = _get_facility_data()
    scen = req.scenario.lower()
    demand = (
        generate_seasonal_demand(data.demand, data.products, data.weeks)
        if scen in ["seasonal", "seasonal_harvest_surge"]
        else data.demand
    )

    # Reconstruct dictionary keys
    prod_dict = {}
    for k, v in req.production.items():
        p, l, s = map(int, k.split(","))
        prod_dict[(p, l, s)] = float(v)

    shifts_dict = {}
    for k, v in req.shifts.items():
        l, s = map(int, k.split(","))
        shifts_dict[(l, s)] = int(v)

    waste_dict = {}
    for k, v in req.waste.items():
        p, s = map(int, k.split(","))
        waste_dict[(p, s)] = float(v)

    consumption_dict = {}
    for k, v in req.consumption.items():
        p, s, a = map(int, k.split(","))
        consumption_dict[(p, s, a)] = float(v)

    # If consumption was not provided for expiry model, attempt FIFO cohort reconstruction
    if req.model_type.lower() in ["expiry", "expiry_aware"] and not consumption_dict:
        # Reconstruct cohort consumption via FIFO from production
        # Inventory queues per product: list of [production_week, remaining_tonnes]
        for p in data.inoculated_products:
            inventory_batches = []
            for s in data.weeks:
                # Add fresh production from week s
                prod_s = sum(prod_dict.get((p, l, s), 0.0) for l in data.lines)
                if prod_s > 0:
                    inventory_batches.append([s, prod_s])

                dem_s = demand.get((p, s), 0.0)
                # Satisfy dem_s from oldest eligible unexpired batch
                # Eligible batches have s - batch_week in {0, 1, 2}
                rem_dem = dem_s
                for b in inventory_batches:
                    age = s - b[0]
                    if 0 <= age <= 2 and b[1] > 0 and rem_dem > 0:
                        used = min(b[1], rem_dem)
                        consumption_dict[(p, s, age)] = consumption_dict.get((p, s, age), 0.0) + used
                        b[1] -= used
                        rem_dem -= used

                # Any batch with age == 2 at end of week s expires into waste W[p, s]
                for b in inventory_batches:
                    age = s - b[0]
                    if age == 2 and b[1] > 0:
                        waste_dict[(p, s)] = waste_dict.get((p, s), 0.0) + b[1]
                        b[1] = 0.0

    # Calculate weekly inventory if not provided
    weekly_inv = {int(k): float(v) for k, v in req.weekly_inventory.items()}
    if not weekly_inv:
        # Compute end of week inventory
        cum_p = 0.0
        cum_d = 0.0
        for s in data.weeks:
            cum_p += sum(prod_dict.get((p, l, s), 0.0) for p in data.products for l in data.lines)
            cum_d += sum(demand.get((p, s), 0.0) for p in data.products)
            weekly_inv[s] = cum_p - cum_d

    sol_obj = {
        "production": prod_dict,
        "shifts": shifts_dict,
        "waste": waste_dict,
        "consumption": consumption_dict,
        "weekly_inventory": weekly_inv,
        "objective_value": req.objective_value
    }

    validator = SolutionValidator(data, demand=demand)
    if req.model_type.lower() == "baseline":
        res = validator.validate_baseline(sol_obj)
    elif req.model_type.lower() in ["expiry", "expiry_aware"]:
        res = validator.validate_expiry(sol_obj)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model_type '{req.model_type}'. Expected 'baseline' or 'expiry'."
        )

    return ValidateResponse(
        is_valid=res["is_valid"],
        violations_count=res["violations_count"],
        violations=res["violations"],
        calculated_labour_cost=res["calculated_labour_cost"],
        calculated_production_cost=res["calculated_production_cost"],
        calculated_total_cost=res["calculated_total_cost"]
    )
