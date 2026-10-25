"""
Solver Service for GrainOpt 2.0.

Provides standard solver configuration matching original project parameters:
- timeLimit = 120 seconds
- gapRel = 0.05 (5% relative MIP gap)
- presolve = True
- cuts = True
"""

import pulp


def get_default_solver(msg: bool = False, time_limit: int = 120, gap_rel: float = 0.05):
    """
    Returns configured PULP_CBC_CMD solver matching original parameters.
    """
    return pulp.PULP_CBC_CMD(
        msg=msg,
        timeLimit=time_limit,
        gapRel=gap_rel,
        presolve=True,
        cuts=True
    )

