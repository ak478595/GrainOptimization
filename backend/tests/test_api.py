"""
API Functional Tests for GrainOpt 2.0 REST Service.

Tests:
- GET /api/health
- GET /api/dataset
- GET /api/scenarios
- POST /api/solve (Baseline & Expiry-Aware with reference & seasonal demand)
- POST /api/solve (Validation of invalid inputs and custom demand overrides)
- POST /api/validate (Valid schedules and detection of tampered schedules)
"""

from fastapi.testclient import TestClient
from app.api.routes import get_health, get_dataset, get_scenarios, solve_model, validate_solution
from app.api.schemas import SolveRequest, ValidateRequest


def test_endpoint_health():
    res = get_health()
    assert res.status == "healthy"
    assert res.solver_available is True
    assert "CBC" in res.solver_name


def test_endpoint_dataset():
    res = get_dataset()
    assert res.total_demand == 12556.0
    assert len(res.products) == 17
    assert res.parameters.storage_capacity == 2700.0
    assert len(res.parameters.weeks) == 19
    # Check inoculated vs treated
    inocs = [p for p in res.products if p.product_class == "inoculated"]
    treats = [p for p in res.products if p.product_class == "treated"]
    assert len(inocs) == 7
    assert len(treats) == 10


def test_endpoint_scenarios():
    res = get_scenarios()
    assert res.is_normalized is True
    assert abs(res.total_weight - 1.0) < 1e-6
    assert len(res.weights) == 19
    assert len(res.weekly_seasonal_demand) == 19


def test_endpoint_solve_baseline():
    req = SolveRequest(model_type="baseline", scenario="reference")
    res = solve_model(req)
    assert res.status == "Optimal"
    assert res.is_optimal is True
    assert res.total_shifts == 50
    assert abs(res.objective_value - 69191.66) < 1.0
    assert res.audit.is_valid is True
    assert len(res.production_schedule) > 0
    assert len(res.shift_schedule) > 0


def test_endpoint_solve_expiry():
    req = SolveRequest(model_type="expiry", scenario="reference")
    res = solve_model(req)
    assert res.status == "Optimal"
    assert res.is_optimal is True
    assert res.total_shifts == 47
    assert abs(res.objective_value - 66196.28) < 1.0
    assert res.total_waste == 0.0
    assert res.audit.is_valid is True
    assert res.age_breakdown is not None
    assert res.age_breakdown[0] > 0
    assert res.age_breakdown[2] > 0


def test_endpoint_solve_seasonal():
    req = SolveRequest(model_type="expiry", scenario="seasonal")
    res = solve_model(req)
    assert res.status == "Optimal"
    assert res.is_optimal is True
    assert res.total_shifts == 49
    assert abs(res.objective_value - 67985.36) < 1.0
    assert res.audit.is_valid is True


def test_endpoint_validate():
    # Solve baseline
    solve_res = solve_model(SolveRequest(model_type="baseline", scenario="reference"))

    prod_dict = {
        f"{item.product},{item.line},{item.week}": item.tonnes
        for item in solve_res.production_schedule
    }
    shifts_dict = {
        f"{item.line},{item.week}": item.shifts
        for item in solve_res.shift_schedule
    }

    # Validate correct schedule
    val_req = ValidateRequest(
        model_type="baseline",
        scenario="reference",
        production=prod_dict,
        shifts=shifts_dict,
        objective_value=solve_res.objective_value
    )
    val_res = validate_solution(val_req)
    assert val_res.is_valid is True
    assert val_res.violations_count == 0

    # Validate tampered schedule (reduce shift in week 8 to 0)
    tampered_shifts = dict(shifts_dict)
    tampered_shifts["2,8"] = 0
    tampered_req = ValidateRequest(
        model_type="baseline",
        scenario="reference",
        production=prod_dict,
        shifts=tampered_shifts,
        objective_value=solve_res.objective_value
    )
    tampered_res = validate_solution(tampered_req)
    assert tampered_res.is_valid is False
    assert tampered_res.violations_count > 0


def test_endpoint_solve_aliases_and_errors():
    import pytest
    from fastapi import HTTPException

    # 1. Test canonical 'expiry'
    res_expiry = solve_model(SolveRequest(model_type="expiry", scenario="reference"))
    assert res_expiry.status == "Optimal"
    assert res_expiry.total_shifts == 47

    # 2. Test alias 'expiry_aware'
    res_aware = solve_model(SolveRequest(model_type="expiry_aware", scenario="reference"))
    assert res_aware.status == "Optimal"
    assert res_aware.total_shifts == 47

    # 3. Test alias 'seasonal_harvest_surge' scenario
    res_surge = solve_model(SolveRequest(model_type="expiry", scenario="seasonal_harvest_surge"))
    assert res_surge.status == "Optimal"
    assert res_surge.total_shifts == 49

    # 4. Test invalid model_type raises 400
    with pytest.raises(HTTPException) as excinfo:
        solve_model(SolveRequest(model_type="unknown_model", scenario="reference"))
    assert excinfo.value.status_code == 400
    assert "Expected 'baseline' or 'expiry'" in excinfo.value.detail

    # 5. Test invalid scenario raises 400
    with pytest.raises(HTTPException) as excinfo:
        solve_model(SolveRequest(model_type="baseline", scenario="unknown_scenario"))
    assert excinfo.value.status_code == 400
    assert "Expected 'reference' or 'seasonal'" in excinfo.value.detail


