# GrainOpt 2.0 — Current State

- **Current Status**: Standalone WebAssembly Architecture Verified and Production-Ready.
- **Architecture**: React + TypeScript + Vite + Tailwind CSS + HiGHS WebAssembly (WASM).
- **Serverless Verification**:
  - FastAPI server stopped; all `/api/*` network requests removed.
  - Sourced dataset locally from `frontend/src/data/dataset.json`.
  - LP generation and solving executed client-side via dedicated Web Worker.
  - Solution validation independently performed client-side across all 6 gates.
- **Regression Parity Matrix**:
  - Baseline + Reference: HiGHS 49 shifts ($68,191.65) vs CBC 50 shifts ($69,191.66) at 5% gap; proven global optimum is 48 shifts ($67,191.65).
  - Baseline + Seasonal: HiGHS 51 shifts ($69,985.36) vs CBC 51 shifts ($70,003.68).
  - Expiry-Aware + Reference: HiGHS 47 shifts ($66,196.28) vs CBC 47 shifts ($66,196.28), 0.00 t waste.
  - Expiry-Aware + Seasonal: HiGHS 49 shifts ($67,985.36) vs CBC 49 shifts ($67,985.36), 0.00 t waste.
- **Validation**: 0 constraint violations across all four scenarios.
- **Build Status**: Production bundle compiled in `frontend/dist/` (includes local `highs-*.wasm` binary).
- **Backend**: Preserved in `backend/` with all 15 tests passing.
