import React from 'react';
import { SolveResponse } from '../types/api';
import { MathFormula } from './MathFormula';
import { CheckCircle2, ShieldCheck, AlertCircle, FileText, Check, Cpu } from './icons';

interface ValidationViewProps {
  solution: SolveResponse | null;
}

export const ValidationView: React.FC<ValidationViewProps> = ({ solution }) => {
  const isValid = solution?.validation?.is_valid ?? null;
  const violations = solution?.validation?.violations || [];

  const gate1Violations = violations.filter(v => v.includes('Gate 1'));
  const gate2Violations = violations.filter(v => v.includes('Gate 2'));
  const gate3Violations = violations.filter(v => v.includes('Gate 3'));
  const gate4Violations = violations.filter(v => v.includes('Gate 4'));
  const gate5Violations = violations.filter(v => v.includes('Gate 5'));
  const gate6Violations = violations.filter(v => v.includes('Gate 6'));

  const renderBadge = (gateViolations: string[]) => {
    if (!solution) {
      return (
        <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          Awaiting Run
        </span>
      );
    }
    if (gateViolations.length === 0) {
      return (
        <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
          Verified
        </span>
      );
    }
    return (
      <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
        Failed ({gateViolations.length})
      </span>
    );
  };

  const renderIcon = (gateViolations: string[]) => {
    if (!solution) {
      return (
        <div className="p-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 mt-0.5 flex-shrink-0 shadow-soft-xs">
          <ShieldCheck className="w-4 h-4" />
        </div>
      );
    }
    if (gateViolations.length === 0) {
      return (
        <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 mt-0.5 flex-shrink-0 shadow-soft-xs">
          <Check className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="p-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 mt-0.5 flex-shrink-0 shadow-soft-xs">
        <AlertCircle className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
              <ShieldCheck className="w-5 h-5" />
            </span>
            Independent Solution Audit & Methodology
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 ml-1">
            Zero-tolerance verification of flow conservation, shift capacity limits, and storage bounds across all 6 gates.
          </p>
        </div>
        <div>
          {solution ? (
            isValid ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-sm shadow-soft-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span className="text-emerald-900 font-bold">Live Audit: All 6 Gates Passed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl text-sm shadow-soft-xs">
                <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0" />
                <span className="text-rose-950 font-bold">Audit Violations Detected ({violations.length})</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-sm text-slate-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              <span>Awaiting Solver Run</span>
            </div>
          )}
        </div>
      </div>

      {/* Violations notice if any */}
      {violations.length > 0 && (
        <div className="soft-card p-5 border-l-4 border-l-rose-600 bg-rose-50/70 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-950 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-rose-700" />
            <span>Audit Non-Compliance Report:</span>
          </div>
          <ul className="list-disc list-inside text-sm text-rose-900 space-y-1 font-mono font-medium">
            {violations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Solver Status Card */}
      {solution && (
        <div className="soft-card p-6">
          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-3.5 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-700" />
            Solver Execution Metadata
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="soft-well p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Solver Engine</span>
              <span className="text-slate-900 font-bold text-base">HiGHS (WASM)</span>
            </div>
            <div className="soft-well p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Termination Status</span>
              <span className="text-emerald-800 font-bold text-base">
                {solution.status === 'Optimal' && solution.relative_gap > 0
                  ? `Feasible (${(solution.relative_gap * 100).toFixed(1)}% Gap)`
                  : solution.status}
              </span>
            </div>
            <div className="soft-well p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Relative MIP Gap</span>
              <span className="text-slate-900 font-bold text-base font-mono tabular-nums">
                {solution.relative_gap !== null && solution.relative_gap !== undefined
                  ? `${(solution.relative_gap * 100).toFixed(2)}%`
                  : 'Unavailable'}
              </span>
            </div>
            <div className="soft-well p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Execution Duration</span>
              <span className="text-teal-800 font-bold text-base font-mono tabular-nums">{solution.solve_time_seconds.toFixed(2)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Check Matrix */}
      <div className="soft-card p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Independent Audit Protocol (6 Verification Gates)</h3>
          <p className="text-sm text-slate-600 mt-0.5">Independent client-side validator checks solutions against exact formulation constraints and physical bounds.</p>
        </div>

        <div className="space-y-3.5 text-sm">
          {/* Gate 1 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate1Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 1: Exact Horizon Demand Conservation</span>
                {renderBadge(gate1Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Every unit of customer demand across 17 products and 19 weeks is satisfied without stockouts (<MathFormula math="\sum \text{Demand} = 12,556.0\text{ t}" />).
              </p>
            </div>
          </div>

          {/* Gate 2 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate2Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 2: Inoculated Cohort Flow & Expiry Conservation</span>
                {renderBadge(gate2Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Stock produced in week <MathFormula math="s" /> is strictly consumed at age 0, age 1, age 2, or accounted for as waste <MathFormula math="W_{v,s}" />. Age-2 carryover <MathFormula math="I_{v,s,2} = 0" /> strictly verified.
              </p>
            </div>
          </div>

          {/* Gate 3 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate3Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 3: Shift Bounds & Integrality</span>
                {renderBadge(gate3Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Weekly shift totals on Line 1 and Line 2 do not exceed maximum operational capacity (<MathFormula math="\le 3\text{ shifts/line/week}" />) and are strictly integer-valued.
              </p>
            </div>
          </div>

          {/* Gate 4 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate4Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 4: Production Line Capacity</span>
                {renderBadge(gate4Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Total weekly production on each line cannot exceed available processing time (<MathFormula math="\text{Prod}_{l,w} \le \text{rate}_l \times \text{hours} \times \text{shifts}_{l,w}" />).
              </p>
            </div>
          </div>

          {/* Gate 5 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate5Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 5: Warehouse Storage Bounds & Non-Negativity</span>
                {renderBadge(gate5Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Weekly physical inventory does not exceed aggregate warehouse storage (<MathFormula math="\le 2,700\text{ t}" />) and closing stock balances are non-negative (<MathFormula math="I_w \ge 0" />).
              </p>
            </div>
          </div>

          {/* Gate 6 */}
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex items-start gap-3.5">
            {renderIcon(gate6Violations)}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 block text-sm">Gate 6: Objective Cost Reconciliation</span>
                {renderBadge(gate6Violations)}
              </div>
              <p className="text-slate-700 mt-1 leading-relaxed text-sm">
                Independent recomputation of regular labor, overtime labor, and waste penalty matches solver objective within numerical tolerance (<MathFormula math="|\Delta| \le \$0.05" />).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scientific Citation */}
      <div className="soft-card p-6 text-sm text-slate-600 space-y-2 border-t-2 border-t-slate-200">
        <h4 className="font-bold text-slate-800 flex items-center gap-2 tracking-tight text-sm">
          <FileText className="w-4 h-4 text-teal-700" />
          Academic Reference & Attribution
        </h4>
        <p className="leading-relaxed text-slate-700">
          Bayá, G., Canale, E., Nesmachnow, S., Robledo, F., & Sartor, P. (2022). <em>Production Optimization in a Grain Facility through Mixed-Integer Linear Programming</em>. Applied Sciences, 12(16), 8212.
        </p>
        <p className="text-xs text-slate-500 font-medium">
          Rebuilt and enhanced for GrainOpt 2.0 with explicit age-cohort perishable inventory dynamics and reproducible seasonal demand profiles.
        </p>
      </div>
    </div>
  );
};
