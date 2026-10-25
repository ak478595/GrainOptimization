# GrainOpt 2.0 — Development Roadmap

## Phase 1: Project Inspection & Mathematical Planning [COMPLETED]
- Inspected `reference/` archive and Excel dataset.
- Reconstructed existing MILP and documented discrepancies.
- Formulated Improvements A (Seasonal Demand) and B (Age Cohorts).

## Phase 2: Backend MILP Engine & Mathematical Validation [COMPLETED]
- Implemented `dataset_loader.py` and `scenarios.py`.
- Implemented `milp_baseline.py` (50 shifts, $69,191.66 at 5% gap; 48 shifts, $67,191.66 at 1% gap).
- Implemented `milp_expiry.py` (47 shifts, $66,196.28, 0 waste).
- Built independent validation auditor `validation.py`.
- Automated test suite passing all tests.

## Phase 3: REST API & Service Layer [COMPLETED]
- Built FastAPI routes and Pydantic schemas.
- Endpoints for dataset introspection, scenario generation, solve execution, and constraint validation.
- API test coverage (15 total backend tests passing).

## Phase 4: Frontend Development (React + TypeScript + Vite) [COMPLETED]
- Full academic UI built with React + Vite + TypeScript + Tailwind CSS.
- KaTeX mathematical formulation rendering engine.
- Recharts visualizations for shift allocations, demand breakdowns, and inventory ageing cohorts.
- 4-Way Scenario Laboratory for factorial comparisons.
- Independent validation gates dashboard view.

## Phase 5: Standalone Migration (WebAssembly MILP Solver) [COMPLETED]
- Ported dataset and seasonal scenarios to pure TypeScript (`src/data/dataset.json`, `src/core/scenarios.ts`).
- Ported the 6-gate independent validation engine to TypeScript (`src/core/validator.ts`).
- Built CPLEX LP generator (`src/solver/lp_generator.ts`) preserving identical objective coefficients and constraints.
- Integrated `highs` WebAssembly MILP solver inside a dedicated Web Worker (`src/solver/highs_worker.ts`).
- Created Promise-based typed client (`src/solver/solver_client.ts`) with timeout handling.
- Cut over `src/services/api.ts` to solve and validate models 100% locally in-browser with zero HTTP server dependencies.
- Verified 4-way factorial scenario regression matrix against Python CBC.
- Preserved Python backend and dataset intact as mathematical regression references.
