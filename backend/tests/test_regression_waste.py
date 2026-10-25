"""
Regression tests for forced waste generation and exact conservation of flow.
"""

from pathlib import Path
import pytest
from app.core.dataset_loader import FacilityData
from app.models.milp_expiry import ExpiryModel
from app.services.validation import SolutionValidator


DATA_FILE = Path(__file__).parent.parent / "data" / "grain_facility_dataset.xlsx"


def test_forced_waste_generation_and_accounting():
    """
    Forces 100 tonnes of Product 1 to be produced in Week 1, but forbids its
    consumption in Weeks 1, 2, and 3. Under the 2-week shelf-life rule, this stock
    MUST expire at the end of Week 3, generating exactly 100 tonnes of waste W[1, 3] = 100.
    """
    data = FacilityData(DATA_FILE)
    model = ExpiryModel(data)

    # Force 100t produced in week 1 on line 1
    model.prob += model.x[1, 1, 1] == 100.0
    # Forbid consumption of product 1 in weeks 1, 2, 3
    model.prob += model.u[1, 1, 0] == 0.0
    model.prob += model.u[1, 2, 0] == 0.0
    model.prob += model.u[1, 2, 1] == 0.0
    model.prob += model.u[1, 3, 0] == 0.0
    model.prob += model.u[1, 3, 1] == 0.0
    model.prob += model.u[1, 3, 2] == 0.0

    sol = model.solve()

    assert sol["is_optimal"] is True
    # The 100 tonnes cannot be carried past Week 3, so W[1, 3] must be 100
    waste_w3 = sol["waste"].get((1, 3), 0.0)
    assert abs(waste_w3 - 100.0) < 1e-3, f"Expected 100t waste in week 3, got {waste_w3}"
    assert abs(sol["total_waste"] - 100.0) < 1e-3
    assert abs(sol["waste_cost"] - 100.0 * model.waste_penalty) < 1e-2

    # Validate full conservation of flow with waste present
    validator = SolutionValidator(data)
    audit = validator.validate_expiry(sol)
    assert audit["is_valid"] is True, f"Validation failed with forced waste: {audit['violations']}"

