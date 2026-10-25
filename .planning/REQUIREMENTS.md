# GrainOpt 2.0 — Functional Requirements

## R1: Data & Modeling Integrity
- **R1.1**: Strict preservation of the 17-product, 2-line, 19-week, 12,556-tonne dataset.
- **R1.2**: Explicit separation between original baseline and improved formulations.
- **R1.3**: Independent validation engine verifying all constraints with $\le 10^{-4}$ tolerance.

## R2: Mathematical Optimization Engine
- **R2.1**: Baseline MILP solver reproducing 50 shifts and $69,191.66 operating cost.
- **R2.2**: Age-indexed cohort tracking for inoculated products with $I_{v,s,2} = 0$ and waste variable $W_{v,s}$.
- **R2.3**: Reproducible seasonal demand profiles summing to 1.0.

## R3: API & Application
- **R3.1**: FastAPI REST service exposing `/solve`, `/scenarios`, `/dataset`, and `/validate`.
- **R3.2**: React + TypeScript + Vite frontend with Tailwind CSS, Recharts, and KaTeX mathematical viewer.
- **R3.3**: Interactive Scenario Laboratory comparing Baseline, Seasonal-JIT, Expiry-Aware, and Combined models.

