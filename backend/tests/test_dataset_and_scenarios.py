"""
Tests for Dataset Loading and Seasonal Scenarios.
"""

from pathlib import Path
import pytest
from app.core.dataset_loader import FacilityData
from app.models.scenarios import get_seasonal_weights, generate_seasonal_demand


DATA_FILE = Path(__file__).parent.parent / "data" / "grain_facility_dataset.xlsx"


def test_dataset_loader():
    assert DATA_FILE.exists(), f"Dataset file does not exist at {DATA_FILE}"
    data = FacilityData(DATA_FILE)

    assert len(data.products) == 17
    assert len(data.inoculated_products) == 7
    assert len(data.treated_products) == 10
    assert len(data.lines) == 2
    assert len(data.weeks) == 19

    assert data.capacity[1] == 6.175
    assert data.capacity[2] == 6.650
    assert data.storage_capacity == 2700.0
    assert data.max_shifts_per_line_week == 3
    assert data.hours_per_shift == 41.25

    # Check total demand
    total_demand = sum(data.demand.values())
    assert abs(total_demand - 12556.0) < 1e-4

    # Check demand is 0 in weeks 1-7 and week 19
    for w in [1, 2, 3, 4, 5, 6, 7, 19]:
        assert data.weekly_totals[w] == 0.0


def test_seasonal_scenario_preservation():
    data = FacilityData(DATA_FILE)
    weights = get_seasonal_weights()

    # 1. Weights sum exactly to 1.0
    assert abs(sum(weights.values()) - 1.0) < 1e-6

    # 2. Generate seasonal demand
    seasonal_demand = generate_seasonal_demand(data.demand, data.products, data.weeks, weights)

    # 3. Product demand totals are strictly preserved
    for p in data.products:
        orig_p_total = data.product_totals[p]
        seasonal_p_total = sum(seasonal_demand[(p, w)] for w in data.weeks)
        assert abs(orig_p_total - seasonal_p_total) < 1e-3, f"Mismatch for product {p}"

    # 4. Total facility demand is strictly preserved
    total_seasonal = sum(seasonal_demand.values())
    assert abs(total_seasonal - 12556.0) < 1e-3

