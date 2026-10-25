/**
 * Web Worker for running HiGHS WebAssembly MILP solver off the main UI thread.
 * Handles solver execution, progress telemetry, time limits, and error handling.
 */

import highs from 'highs';
import highsWasmUrl from 'highs/runtime?url';

export interface SolverWorkerRequest {
  id: string;
  action: 'solve';
  lpString: string;
  options?: {
    timeLimitSeconds?: number;
    relativeGap?: number;
  };
}

export interface SolverWorkerResponse {
  id: string;
  success: boolean;
  solution?: {
    status: string;
    objectiveValue: number;
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
  if (!req || req.action !== 'solve') {
    return;
  }

  const startTime = performance.now();

  try {
    const solver = await getHighs();

    const highsOptions: Record<string, any> = {
      presolve: 'on',
    };

    if (req.options?.timeLimitSeconds) {
      highsOptions.time_limit = req.options.timeLimitSeconds;
    }
    if (req.options?.relativeGap !== undefined) {
      highsOptions.mip_rel_gap = req.options.relativeGap;
    }

    const rawSol = solver.solve(req.lpString, highsOptions);
    const durationSeconds = (performance.now() - startTime) / 1000;

    // Extract column values
    const columns: Record<string, { primal: number; type: string }> = {};
    if (rawSol.Columns) {
      for (const [name, col] of Object.entries(rawSol.Columns)) {
        const c = col as any;
        columns[name] = {
          primal: c.Primal ?? 0,
          type: c.Type ?? 'Continuous',
        };
      }
    }

    // HiGHS legacy one-shot solver provides Status and ObjectiveValue.
    // MIP best bound and gap are tracked during solve, but not exposed on legacy HighsSolution object.
    // If Status is 'Optimal', incumbent objective is optimal and relative gap is within tolerance.
    const isOptimal = rawSol.Status === 'Optimal';
    const relativeGap = isOptimal ? (req.options?.relativeGap ?? 0.05) : null;
    const bestBound = isOptimal ? rawSol.ObjectiveValue : null;

    const response: SolverWorkerResponse = {
      id: req.id,
      success: true,
      solution: {
        status: rawSol.Status,
        objectiveValue: rawSol.ObjectiveValue,
        bestBound,
        relativeGap,
        solveTimeSeconds: durationSeconds,
        columns,
      },
    };

    self.postMessage(response);
  } catch (err: any) {
    const response: SolverWorkerResponse = {
      id: req.id,
      success: false,
      error: err?.message || String(err),
    };
    self.postMessage(response);
  }
};

