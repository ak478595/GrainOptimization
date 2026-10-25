"""
Seasonal Demand Scenarios for GrainOpt 2.0.

Provides reproducible, normalized weekly demand profiles that strictly preserve
each product's total demand across the 19-week planning horizon.
"""

from typing import Dict, List, Tuple


# Normalized illustrative weekly weights summing exactly to 1.00000
# Represents an agricultural cycle:
# - Weeks 1-5: Low / dormant pre-planting activity
# - Weeks 6-9: Planting ramp-up
# - Weeks 10-13: Peak harvest demand
# - Weeks 14-19: Post-harvest tapering
SEASONAL_WEIGHTS: Dict[int, float] = {
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
}


def get_seasonal_weights() -> Dict[int, float]:
    """Returns a copy of the normalized seasonal weights dictionary."""
    return dict(SEASONAL_WEIGHTS)


def generate_seasonal_demand(
    base_demand: Dict[Tuple[int, int], float],
    products: List[int],
    weeks: List[int],
    weights: Dict[int, float] = None
) -> Dict[Tuple[int, int], float]:
    """
    Generates a seasonal demand distribution that strictly preserves each product's
    total demand over the horizon.
    """
    if weights is None:
        weights = SEASONAL_WEIGHTS

    total_weight = sum(weights[w] for w in weeks)
    if abs(total_weight - 1.0) > 1e-6:
        raise ValueError(f"Seasonal weights must sum to 1.0, got {total_weight}")

    seasonal_demand: Dict[Tuple[int, int], float] = {}

    for p in products:
        p_total = sum(base_demand.get((p, w), 0.0) for w in weeks)
        allocated_so_far = 0.0

        for w in weeks[:-1]:
            val = round(p_total * weights[w], 2)
            seasonal_demand[(p, w)] = val
            allocated_so_far += val

        # Final week absorbs any sub-cent rounding discrepancy to preserve total
        seasonal_demand[(p, weeks[-1])] = round(p_total - allocated_so_far, 2)

    return seasonal_demand

