"""
Unit test for Expiry Boundary Conditions using a hand-checkable small instance.
Confirms that stock produced in week 1 cannot satisfy week 4 demand,
while stock produced in week 2 can satisfy week 4 demand.
"""

import pulp
from app.core.dataset_loader import FacilityData
from app.models.milp_expiry import ExpiryModel


class MockFacilityData:
    def __init__(self):
        self.products = [1]
        self.inoculated_products = [1]
        self.treated_products = []
        self.lines = [1]
        self.weeks = [1, 2, 3, 4]
        self.capacity = {1: 10.0}
        self.hours_per_shift = 10.0
        self.max_shifts_per_line_week = 1
        self.storage_capacity = 500.0
        self.labour_cost_per_shift = 100.0
        self.production_cost_coefficient = 1.0


def test_expiry_boundary_hand_checkable():
    """
    Instance with demand only in week 4 (60 tonnes).
    If we force production only in week 1, week 4 demand must either be unmet or force waste in week 3.
    """
    mock_data = MockFacilityData()
    demand = {(1, 1): 0.0, (1, 2): 0.0, (1, 3): 0.0, (1, 4): 60.0}

    # Model A: Normal optimization
    # The solver should choose to produce in week 2, 3, or 4 (never in week 1) to avoid waste
    model_a = ExpiryModel(mock_data, demand_override=demand, waste_penalty=10000.0)
    sol_a = model_a.solve()

    assert sol_a["is_optimal"] is True
    assert sol_a["total_waste"] == 0.0
    # Production in week 1 should be 0 because producing in week 1 would expire before week 4
    p_w1 = sol_a["production"].get((1, 1, 1), 0.0)
    assert abs(p_w1) < 1e-4

    # Model B: Force production in week 1 and disallow production in weeks 2, 3, 4
    model_b = ExpiryModel(mock_data, demand_override=demand, waste_penalty=10000.0)
    # Force x[1, 1, 1] == 60, and others == 0
    model_b.prob += model_b.x[1, 1, 1] == 60.0
    model_b.prob += model_b.x[1, 1, 2] == 0.0
    model_b.prob += model_b.x[1, 1, 3] == 0.0
    model_b.prob += model_b.x[1, 1, 4] == 0.0

    sol_b = model_b.solve()
    # In Model B, the 60 tonnes produced in week 1 MUST expire at the end of week 3:
    # W[1, 3] == 60, and week 4 demand cannot be satisfied (infeasible status)
    # Because demand satisfaction is >= 60, but available unexpired stock in week 4 is 0:
    assert sol_b["status"] == "Infeasible" or sol_b["is_optimal"] is False

