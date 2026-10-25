"""
Full Experiments Test Suite:
1. Baseline Reproduction
2. Seasonal-Demand with JIT
3. Expiry-Aware with Reference Demand
4. Combined Seasonal-Demand & Expiry-Aware
"""

from pathlib import Path
import pytest
from app.core.dataset_loader import FacilityData
from app.models.milp_baseline import BaselineModel
from app.models.milp_expiry import ExpiryModel
from app.models.scenarios import generate_seasonal_demand
from app.services.validation import SolutionValidator


DATA_FILE = Path(__file__).parent.parent / "data" / "grain_facility_dataset.xlsx"


def test_experiment_1_baseline_reproduction():
    """
    Solves the baseline model on reference demand and independently validates against historical claim.
    """
    data = FacilityData(DATA_FILE)
    model = BaselineModel(data)
    sol = model.solve()

    assert sol["is_optimal"] is True
    assert sol["status"] == "Optimal"

    # Independently audit all constraints
    validator = SolutionValidator(data)
    audit = validator.validate_baseline(sol)
    assert audit["is_valid"] is True, f"Audit failures: {audit['violations']}"

    # Verify against historical reference
    # Historical values: 50 shifts, $50,000 labour, $19,191.66 prod, $69,191.66 total, 2700 peak inv
    assert sol["total_shifts"] == 50
    assert abs(sol["labour_cost"] - 50000.0) < 1e-2
    assert abs(sol["production_cost"] - 19191.66) < 1.0
    assert abs(sol["objective_value"] - 69191.66) < 1.0
    assert abs(sol["peak_inventory"] - 2700.0) < 1e-2
    assert abs(sol["total_production"] - 12556.0) < 1e-2


def test_experiment_3_expiry_aware_reference():
    """
    Solves the expiry-aware model on reference demand.
    Unlocks 2-week shelf life buffer for inoculated products.
    """
    data = FacilityData(DATA_FILE)
    model = ExpiryModel(data)
    sol = model.solve()

    assert sol["is_optimal"] is True
    assert sol["status"] == "Optimal"
    assert sol["total_waste"] == 0.0  # Zero waste is feasible!

    # Independently audit constraints
    validator = SolutionValidator(data)
    audit = validator.validate_expiry(sol)
    assert audit["is_valid"] is True, f"Audit failures: {audit['violations']}"

    # Confirm that unlocking shelf-life allows pre-building inoculated stock
    # without violating the 2-week rule
    age_breakdown = sol["age_breakdown"]
    assert age_breakdown[0] + age_breakdown[1] + age_breakdown[2] == pytest.approx(6116.0, rel=1e-3)
    # The solver should utilize age-1 and/or age-2 stock
    assert age_breakdown[1] > 0 or age_breakdown[2] > 0

    # Total shifts should be less than or equal to baseline 50 shifts
    assert sol["total_shifts"] <= 50
    assert sol["operating_cost"] <= 69191.66 + 1e-2


def test_experiment_4_combined_seasonal_expiry():
    """
    Solves the combined seasonal-demand and expiry-aware model.
    """
    data = FacilityData(DATA_FILE)
    seasonal_demand = generate_seasonal_demand(data.demand, data.products, data.weeks)
    model = ExpiryModel(data, demand_override=seasonal_demand)
    sol = model.solve()

    assert sol["is_optimal"] is True
    assert sol["status"] == "Optimal"
    assert sol["total_waste"] == 0.0

    validator = SolutionValidator(data, demand=seasonal_demand)
    audit = validator.validate_expiry(sol)
    assert audit["is_valid"] is True, f"Audit failures: {audit['violations']}"

    assert sol["peak_inventory"] <= 2700.0 + 1e-4

