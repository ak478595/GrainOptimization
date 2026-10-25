# GrainOpt 2.0 — Standalone Web Optimization Platform

GrainOpt 2.0 is an academic/research-grade Mixed-Integer Linear Programming (MILP) web platform for grain production planning, seasonal harvest surge management, and perishable inventory expiry tracking.

The application operates as a **100% standalone, serverless web application**: optimization models are generated and solved entirely in the user's browser using a native **HiGHS WebAssembly (WASM)** solver executed off the UI thread via a dedicated Web Worker. No local Python backend or HTTP API is required at runtime.

---

## 1. Scientific Background & Mathematical Formulations

GrainOpt 2.0 models the operational planning problem of an industrial grain-processing facility across a **19-week planning horizon**, processing **17 grain products** across **2 production lines** with **12,556.0 tonnes** of total demand.

### Facility Dimensions & Parameters
- **Planning Horizon**: 19 weeks ($s \in \{1..19\}$)
- **Products**: 17 total ($v \in \{1..17\}$)
  - 7 Inoculated (perishable, strict 2-week shelf life: $v \in \{1..7\}$)
  - 10 Treated (non-perishable: $v \in \{8..17\}$)
- **Production Lines**: 2 lines ($l \in \{1, 2\}$)
  - Line 1 Capacity: **6.175 tonnes/hour** ($254.72\text{ t/shift}$)
  - Line 2 Capacity: **6.650 tonnes/hour** ($274.31\text{ t/shift}$)
  - Hours per shift: **41.25 hours** ($7.5\text{ h/day} \times 5.5\text{ days/week}$)
  - Maximum shifts per line per week: **3 shifts**
- **Warehouse Storage Limit**: **2,700.0 tonnes** maximum aggregate inventory
- **Cost Coefficients**:
  - Labour Cost: **\$1,000.00 / shift**
  - Production Cost: **\$10.00** coefficient normalized by line capacity ($\frac{\$10.00}{\text{cap}_l} \times x_{v,l,s}$)
  - Expiry Waste Penalty: **\$10,000.00 / tonne**
- **Explicit Exclusions**: No cleaning time, cleaning cost, or changeover sequencing constraints (as established by the reference model).

---

## 2. Models & Formulations

### A. Baseline Model (Rigid Weekly JIT)
- **Inoculated Products**: Must be produced in the exact week of demand:
  $$\sum_{l=1}^2 x_{v,l,s} \ge d_{v,s} \quad \forall v \in \{1..7\}, s \in \{1..19\}$$
- **Treated Products**: Cumulative demand fulfillment:
  $$\sum_{t=1}^s \sum_{l=1}^2 x_{v,l,t} \ge \sum_{t=1}^s d_{v,t} \quad \forall v \in \{8..17\}, s \in \{1..19\}$$
- **Line Capacity**:
  $$\sum_{v=1}^{17} x_{v,l,s} \le \text{cap}_l \times 41.25 \times \text{shifts}_{l,s} \quad \forall l \in \{1, 2\}, s \in \{1..19\}$$
- **Warehouse Storage**:
  $$\sum_{t=1}^s \sum_{v=1}^{17} \sum_{l=1}^2 x_{v,l,t} - \sum_{t=1}^s \sum_{v=1}^{17} d_{v,t} \le 2700.0 \quad \forall s \in \{1..19\}$$
- **Objective**:
  $$\min \sum_{l=1}^2 \sum_{s=1}^{19} 1000 \times \text{shifts}_{l,s} + \sum_{v=1}^{17} \sum_{l=1}^2 \sum_{s=1}^{19} \left(\frac{10.0}{\text{cap}_l}\right) x_{v,l,s}$$

### B. Expiry-Aware Model (Perishable Cohort Tracking)
- **Age-Indexed Cohorts**: Inoculated inventory tracked by age $a \in \{0, 1\}$ (where age 2 terminates at end of week $s$):
  $$I_{v,s,0} = \sum_{l=1}^2 x_{v,l,s} - u_{v,s,0}$$
  $$I_{v,s,1} = I_{v,s-1,0} - u_{v,s,1} \quad (s \ge 2)$$
  $$u_{v,s,2} + W_{v,s} = I_{v,s-1,1} \quad (s \ge 3)$$
  $$I_{v,s,2} = 0 \quad (\text{leftover age 2 transitions to waste } W_{v,s})$$
- **Inoculated Demand Satisfaction**:
  $$\sum_{a=0}^2 u_{v,s,a} \ge d_{v,s} \quad \forall v \in \{1..7\}, s \in \{1..19\}$$
- **Treated Inventory Balance**:
  $$I^{\text{treated}}_{v,s} = I^{\text{treated}}_{v,s-1} + \sum_{l=1}^2 x_{v,l,s} - d_{v,s} \quad \forall v \in \{8..17\}, s \in \{1..19\}$$
- **Facility Storage Limit**:
  $$\sum_{v=1}^7 \left(I_{v,s,0} + I_{v,s,1}\right) + \sum_{v=8}^{17} I^{\text{treated}}_{v,s} \le 2700.0 \quad \forall s \in \{1..19\}$$
- **Objective**:
  $$\min \sum_{l=1}^2 \sum_{s=1}^{19} 1000 \times \text{shifts}_{l,s} + \sum_{v=1}^{17} \sum_{l=1}^2 \sum_{s=1}^{19} \left(\frac{10.0}{\text{cap}_l}\right) x_{v,l,s} + 10000 \sum_{v=1}^7 \sum_{s=1}^{19} W_{v,s}$$

---

## 3. Four Supported Optimization Scenarios

GrainOpt 2.0 supports a $2 \times 2$ factorial scenario matrix:

1. **Baseline + Reference Demand**: Rigid JIT weekly demand on the historical baseline dataset.
2. **Baseline + Seasonal Surge Demand**: Rigid JIT on a three-phase agricultural harvest surge (pre-plant dormancy, planting ramp-up, peak harvest, post-harvest tapering) that strictly conserves each product's 19-week total demand.
3. **Expiry-Aware + Reference Demand**: 2-week shelf life buffer for inoculated grain, unlocking batch production and shift smoothing.
4. **Expiry-Aware + Seasonal Surge Demand**: Perishable cohort buffer under harvest surge conditions.

---

## 4. Solver Settings, Optimality Telemetry & Bound Semantics

### Solver Configuration
- **Engine**: HiGHS WebAssembly v1.15.4 (compiled official C++ solver by Antoine Lovasoa).
- **Execution Thread**: Off-thread Web Worker (`highs_worker.ts`).
- **Default MIP Relative Gap**: `mip_rel_gap = 0.05` (5.0% relative gap tolerance).
- **Default Time Limit**: 120 seconds (`time_limit = 120`).

### Feasible Incumbent vs. Gap-Accepted vs. Proven Global Optimum
In Mixed-Integer Programming:
1. **Feasible Incumbent**: Any integer assignment to shifts and production flows that satisfies all constraints without proof of quality.
2. **Accepted Solution within MIP Gap**: The solver terminates once the difference between the best integer solution (Primal) and the continuous relaxation bound (Dual) is within the relative tolerance:
   $$\frac{\text{Primal} - \text{Dual}}{\text{Primal}} \le \text{gapRel}$$
   *A status of `Optimal` at `gapRel = 0.05` certifies that the solution is within 5% of the absolute best possible bound.*
3. **Proven Global Optimum**: When `gapRel = 0.0` is configured, branch-and-bound continues until the tree is exhausted and the gap reaches $0.0\%$.

---

## 5. Regression Matrix & Solution Verification

The table below records the verified outcomes across both Python CBC and HiGHS WebAssembly:

| Scenario | Engine | MIP Gap | Shifts | Waste | Objective | Proven Status | 6-Gate Audit |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Baseline + Reference** | Python CBC | 5.0% | 50 | 0.00 t | \$69,191.66 | Optimal within 5% | **PASSED** |
| | **HiGHS Wasm** | **5.0%** | **49** | **0.00 t** | **\$68,191.65** | **Optimal within 5%** | **PASSED** |
| | HiGHS Wasm | 0.0% | 48 | 0.00 t | \$67,191.65 | Proven Global Optimum | **PASSED** |
| **2. Baseline + Seasonal** | Python CBC | 5.0% | 51 | 0.00 t | \$70,003.68 | Optimal within 5% | **PASSED** |
| | **HiGHS Wasm** | **5.0%** | **51** | **0.00 t** | **\$69,985.36** | **Optimal within 5%** | **PASSED** |
| **3. Expiry-Aware + Reference** | Python CBC | 5.0% | 47 | 0.00 t | \$66,196.28 | Optimal within 5% | **PASSED** |
| | **HiGHS Wasm** | **5.0%** | **47** | **0.00 t** | **\$66,196.28** | **Optimal within 5%** | **PASSED** |
| **4. Expiry-Aware + Seasonal** | Python CBC | 5.0% | 49 | 0.00 t | \$67,985.36 | Optimal within 5% | **PASSED** |
| | **HiGHS Wasm** | **5.0%** | **49** | **0.00 t** | **\$67,985.36** | **Optimal within 5%** | **PASSED** |

> **Note on Baseline Shift Count**:
> At `gapRel = 0.05`, both 50 shifts (\$69,191.66) and 49 shifts (\$68,191.65) are valid feasible incumbents within the 5% window above the proven global lower bound of 48 shifts (\$67,191.65). Both solutions satisfy 100% of the 6 validation gates. Zero benchmark results are hardcoded in the frontend.

---

## 6. Architecture & Independent TypeScript Validator

```
                     ┌────────────────────────────────────────┐
                     │            React + Vite UI             │
                     │  (Dashboard, 4-Way Lab, Recharts, KaTeX)│
                     └──────────────────┬─────────────────────┘
                                        │ User clicks "Solve"
                                        ▼
                     ┌────────────────────────────────────────┐
                     │          HighsSolverClient             │
                     │      (src/solver/solver_client.ts)     │
                     └─────────┬────────────────────┬─────────┘
        Generate CPLEX LP Text │                    │ Validate Solution
                               ▼                    ▼
        ┌──────────────────────────────┐    ┌──────────────────────────────┐
        │         LpGenerator          │    │      SolutionValidator       │
        │  (src/solver/lp_generator.ts)│    │   (src/core/validator.ts)    │
        └──────────────┬───────────────┘    │  Independent 6-Gate Audit    │
                       │                    └──────────────────────────────┘
                       ▼
        ┌──────────────────────────────┐
        │      Dedicated Web Worker    │
        │ (src/solver/highs_worker.ts) │
        └──────────────┬───────────────┘
                       │ PostMessage
                       ▼
        ┌──────────────────────────────┐
        │     HiGHS WebAssembly        │
        │ (highs-*.wasm in dist/assets)│
        └──────────────────────────────┘
```

### The 6 Independent Validation Gates
All solver solutions are independently verified by `src/core/validator.ts` with numerical tolerance $\le 10^{-4}$:
1. **Gate 1**: Demand fulfillment (weekly JIT for baseline; cohort consumption sum $\sum_a u = d$ for expiry).
2. **Gate 2**: Inoculated cohort inventory flow balance across ages $\{0, 1, 2\}$, strict 2-week expiry ($I_{v,s,2} = 0$), and unrecorded waste detection ($u_{v,s,2} + W_{v,s} = I_{v,s-1,1}$).
3. **Gate 3**: Shift bounds and integrality ($0 \le \text{shifts}_{l,s} \le 3$, integer).
4. **Gate 4**: Line capacity limits ($\sum_v x_{v,l,s} \le \text{cap}_l \times 41.25 \times \text{shifts}_{l,s}$).
5. **Gate 5**: Warehouse storage bounds ($\sum I \le 2700.0\text{ tonnes}$).
6. **Gate 6**: Non-negativity ($x \ge 0, u \ge 0, I \ge 0, W \ge 0$) and independent cost recalculation.

---

## 7. Development, Testing & Production Build

### Prerequisites
- Node.js $\ge 18$ (tested on Node.js v24)
- Python $\ge 3.10$ (only if running the optional backend regression test suite)

### Installation
```bash
cd frontend
npm install
```

### Running the Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. Solvers execute directly in your browser.

### Running Frontend Tests
```bash
# Compile and run core data, scenario conservation, and 6-gate validation unit tests:
node_modules\.bin\tsc -p tsconfig.test.json
node dist-test/tests/core_test.js

# Run the 4-way full scenario regression matrix with HiGHS Wasm:
node dist-test/tests/run_matrix.js
```

### Running Optional Python Backend Regression Suite
The Python backend and test suite remain intact in `backend/` as an offline mathematical reference:
```bash
python -m pytest backend/tests -v -o pythonpath=backend
```

### Building for Production
```bash
cd frontend
npm run build
```
Build output is generated in `frontend/dist/`. The WebAssembly binary `highs-*.wasm` (3.53 MB) is bundled locally into `frontend/dist/assets/`.

### Previewing the Production Build
```bash
npm run preview
```
Open `http://localhost:4173` to test the production build with zero external network access.

---

## 8. Static Hosting & Deployment Instructions

GrainOpt 2.0 can be hosted on any static web hosting service (GitHub Pages, Cloudflare Pages, Netlify, Vercel, AWS S3 / CloudFront, Nginx, Apache).

### Key Deployment Requirements
1. **MIME Type for WASM**:
   Ensure the static web server serves `.wasm` files with `Content-Type: application/wasm`. (Default on modern static hosts).
2. **Local Asset Serving**:
   All WASM assets are bundled in `dist/assets/`. No external CDN or internet connection is required after the initial static assets are downloaded.
3. **SPA Fallback Routing**:
   Configure URL rewriting so that all routes serve `/index.html`.
   - **Nginx**:
     ```nginx
     location / {
       try_files $uri $uri/ /index.html;
     }
     location ~* \.wasm$ {
       default_type application/wasm;
     }
     ```
   - **Netlify**: A `_redirects` file with `/*  /index.html  200`.
   - **Vercel**: A `vercel.json` with `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`.

