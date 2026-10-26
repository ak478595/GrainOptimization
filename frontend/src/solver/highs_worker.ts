/**
 * Web Worker for running HiGHS WebAssembly MILP solver off the main UI thread.
 * Handles solver execution, progress telemetry, time limits, and error handling.
 */

import highs from 'highs';
import highsWasmUrl from 'highs/runtime?url';

export interface SolverWorkerRequest {
  id: string;
  action: 'solve' | 'health_check';
  lpString?: string;
  options?: {
    timeLimitSeconds?: number;
    relativeGap?: number;
  };
}

export interface SolverWorkerResponse {
  id: string;
  success: boolean;
  hasFeasibleSolution?: boolean;
  solution?: {
    status: string;
    hasFeasibleSolution: boolean;
    objectiveValue: number | null;
    bestBound: number | null;
    relativeGap: number | null;
    solveTimeSeconds: number;
    columns: Record<string, { primal: number; type: string }>;
  };
  error?: string;
}

let highsInstancePromise: Promise<any> | null = null;

async function getHighs() {
  if (!highsInstancePromise) {
    highsInstancePromise = highs({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return highsWasmUrl;
        }
        return file;
      },
    });
  }
  return highsInstancePromise;
}

self.onmessage = async (e: MessageEvent<SolverWorkerRequest>) => {
  const req = e.data;
  if (!req) {
    return;
  }

  // Handle genuine health/readiness check: instantiate HiGHS and solve a 1-variable trivial LP
  if (req.action === 'health_check') {
    try {
      const solver = await getHighs();
      const model = solver.createModel();
      try {
        model.readModel({ format: 'lp', data: 'Minimize\n obj: x\nSubject To\n c1: x >= 1\nBounds\n 0 <= x <= 10\nEnd\n' });
        model.run();
        const status = model.getModelStatus();
        const ok = status === 7;
        self.postMessage({ id: req.id, success: ok });
      } finally {
        model.dispose();
      }
    } catch (err: any) {
      self.postMessage({ id: req.id, success: false, error: err?.message || String(err) });
    }
    return;
  }

  if (req.action !== 'solve' || !req.lpString) {
    return;
  }

  const startTime = performance.now();

  try {
    const solver = await getHighs();

    // Use persistent Model API to access genuine solver telemetry:
    // incumbent objective, dual bound, achieved MIP gap, and exact termination status.
    const model = solver.createModel();
    try {
      model.options.set('presolve', 'on');
      if (req.options?.timeLimitSeconds) {
        model.options.set('time_limit', req.options.timeLimitSeconds);
      }
      if (req.options?.relativeGap !== undefined) {
        model.options.set('mip_rel_gap', req.options.relativeGap);
      }

      model.readModel({ format: 'lp', data: req.lpString });
      model.run();

      const durationSeconds = (performance.now() - startTime) / 1000;

      // Check whether model contains integer decision variables
      const dim = model.getDimensions();
      let isMip = false;
      for (let i = 0; i < dim.numCols; i++) {
        if (model.getColIntegrality(i) === 1) {
          isMip = true;
          break;
        }
      }

      const statusNum = model.getModelStatus();
      const statusNameMap: Record<number, string> = {
        0: 'Not Set',
        1: 'Load Error',
        2: 'Model Error',
        3: 'Presolve Error',
        4: 'Solve Error',
        5: 'Postsolve Error',
        6: 'Empty',
        7: 'Optimal',
        8: 'Infeasible',
        9: 'Unbounded Or Infeasible',
        10: 'Unbounded',
        11: 'Objective Bound Reached',
        12: 'Objective Target Reached',
        13: 'Time Limit Reached',
        14: 'Iteration Limit Reached',
        15: 'Unknown',
        16: 'Solution Limit Reached',
        17: 'Interrupted',
      };
      const statusStr = statusNameMap[statusNum] || 'Unknown';

      // Installed HiGHS constants.solutionStatus: { none: 0, infeasible: 1, feasible: 2 }
      // A feasible incumbent exists if and only if primal_solution_status === 2
      // AND the objective value is a finite number.
      const primalStatus = model.info.get('primal_solution_status');
      const rawObj = model.info.get('objective_function_value');
      const hasFeasibleSolution = primalStatus === 2 && typeof rawObj === 'number' && Number.isFinite(rawObj);

      const objVal: number | null = hasFeasibleSolution ? rawObj : null;

      let bestBound: number | null = null;
      let achievedGap: number | null = null;

      if (isMip) {
        const rawDualBound = model.info.get('mip_dual_bound');
        const rawGap = model.info.get('mip_gap');

        if (rawDualBound != null && typeof rawDualBound === 'number' && Number.isFinite(rawDualBound)) {
          bestBound = rawDualBound;
        }
        if (rawGap != null && typeof rawGap === 'number' && Number.isFinite(rawGap)) {
          achievedGap = rawGap;
        }
      } else {
        // Continuous LP: dual bound equals incumbent objective when optimal
        if (statusNum === 7 && objVal !== null) {
          bestBound = objVal;
          achievedGap = 0;
        }
      }

      // Extract column values only when a feasible solution exists
      const columns: Record<string, { primal: number; type: string }> = {};
      let validFeasibleSolution = hasFeasibleSolution;

      if (hasFeasibleSolution) {
        const sol = model.getSolution();
        if (!sol || !sol.colValue || sol.colValue.length < dim.numCols) {
          validFeasibleSolution = false;
        } else {
          for (let i = 0; i < dim.numCols; i++) {
            const name = model.getColName(i);
            const val = sol.colValue[i];
            // Verify that every extracted column value is a finite number
            // Do not silently substitute 0 for missing, undefined, NaN, or non-finite values
            if (val === undefined || val === null || typeof val !== 'number' || !Number.isFinite(val)) {
              validFeasibleSolution = false;
              break;
            }
            const type = model.getColIntegrality(i) === 1 ? 'Integer' : 'Continuous';
            columns[name] = {
              primal: val,
              type,
            };
          }
        }
      }

      if (hasFeasibleSolution && !validFeasibleSolution) {
        const response: SolverWorkerResponse = {
          id: req.id,
          success: false,
          hasFeasibleSolution: false,
          error: `Solver produced invalid or non-finite decision variable values despite status "${statusStr}".`,
        };
        self.postMessage(response);
        return;
      }

      const response: SolverWorkerResponse = {
        id: req.id,
        success: true,
        hasFeasibleSolution: validFeasibleSolution,
        solution: {
          status: statusStr,
          hasFeasibleSolution: validFeasibleSolution,
          objectiveValue: validFeasibleSolution ? objVal : null,
          bestBound,
          relativeGap: achievedGap,
          solveTimeSeconds: durationSeconds,
          columns: validFeasibleSolution ? columns : {},
        },
      };

      self.postMessage(response);
    } finally {
      model.dispose();
    }
  } catch (err: any) {
    const response: SolverWorkerResponse = {
      id: req.id,
      success: false,
      error: err?.message || String(err),
    };
    self.postMessage(response);
  }
};

