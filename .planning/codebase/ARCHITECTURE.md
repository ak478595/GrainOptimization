# GrainOpt 2.0 — Codebase Architecture & Structure

## Overview
GrainOpt 2.0 is a Mixed-Integer Linear Programming (MILP) web platform for grain production optimization with two primary research improvements:
1. **Explicit Seasonal-Demand Scenarios** (conserving 19-week product demand totals)
2. **Expiry-Aware Inventory Tracking by Age Cohort** ($a \in \{0, 1, 2\}$, with strict 2-week shelf life and waste accounting)

## Standalone Architecture (Zero Backend HTTP Dependency)
The application has been refactored into a **fully standalone web application**. All MILP formulations are solved directly in the browser using the official **HiGHS WebAssembly (WASM)** solver via a background Web Worker.

### Key Components:
- `frontend/src/data/dataset.json`: Verified multi-sheet facility data extracted from the official Excel dataset (17 products, 2 lines, 19 weeks, 12,556 t demand).
- `frontend/src/core/dataset.ts`: Pure TypeScript loader and dataset validator.
- `frontend/src/core/scenarios.ts`: Normalized seasonal demand distribution preserving product totals.
- `frontend/src/core/validator.ts`: Independent 6-gate TypeScript validation engine ($10^{-4}$ tolerance).
- `frontend/src/solver/lp_generator.ts`: Pure CPLEX LP format generator for Baseline and Expiry-Aware models.
- `frontend/src/solver/highs_worker.ts`: Web Worker compiling and running HiGHS WebAssembly off the UI thread.
- `frontend/src/solver/solver_client.ts`: Typed Promise-based client bridging the UI to the Web Worker.
- `frontend/src/services/api.ts`: Service layer cut over to `highsSolverClient`, eliminating runtime HTTP calls.
- `backend/`: Preserved Python PuLP/CBC implementation serving as the offline mathematical reference.
