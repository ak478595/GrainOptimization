import React, { useState } from 'react';
import { SolveResponse } from '../types/api';
import { solveModel } from '../services/api';
import { GitCompare, Play, RotateCw, CheckCircle2, AlertCircle } from './icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ComparisonViewProps {
  initialSolutions?: Record<string, SolveResponse>;
}

const BENCHMARK_GAP_REL = 0.05;
const BENCHMARK_TIME_LIMIT_SEC = 120;

export const ComparisonView: React.FC<ComparisonViewProps> = () => {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});
  const [solutions, setSolutions] = useState<Record<string, SolveResponse | null>>({
    'exp1_baseline_flat': null,
    'exp2_baseline_seasonal': null,
    'exp3_expiry_flat': null,
    'exp4_expiry_seasonal': null,
  });

  const experiments = [
    {
      id: 'exp1_baseline_flat',
      name: 'Experiment 1: Baseline Historical (Flat Demand)',
      model_type: 'baseline' as const,
      scenario_name: 'reference_flat',
      desc: 'Bayá et al. reproduction: rigid weekly JIT for perishable inoculated items.',
    },
    {
      id: 'exp2_baseline_seasonal',
      name: 'Experiment 2: Baseline with Seasonal Demand',
      model_type: 'baseline' as const,
      scenario_name: 'seasonal_harvest_surge',
      desc: 'Historical JIT tested against harvest surge demand profile.',
    },
    {
      id: 'exp3_expiry_flat',
      name: 'Experiment 3: Expiry-Aware (Flat Demand)',
      model_type: 'expiry' as const,
      scenario_name: 'reference_flat',
      desc: 'GrainOpt 2.0 cohort model enabling 2-week pre-building capacity.',
    },
    {
      id: 'exp4_expiry_seasonal',
      name: 'Experiment 4: Expiry-Aware with Seasonal Demand',
      model_type: 'expiry' as const,
      scenario_name: 'seasonal_harvest_surge',
      desc: 'Combined model smoothing harvest surge without inventory expiry.',
    },
  ];

  const runExperiment = async (expId: string) => {
    const exp = experiments.find((e) => e.id === expId);
    if (!exp) return;

    setLoadingMap((prev) => ({ ...prev, [expId]: true }));
    setErrorMap((prev) => ({ ...prev, [expId]: null }));
    setSolutions((prev) => ({ ...prev, [expId]: null }));
    try {
      const res = await solveModel({
        model_type: exp.model_type,
        scenario_name: exp.scenario_name,
        gap_rel: BENCHMARK_GAP_REL,
        time_limit_sec: BENCHMARK_TIME_LIMIT_SEC,
      });
      setSolutions((prev) => ({ ...prev, [expId]: res }));
    } catch (err: any) {
      console.error(`Failed to solve ${expId}:`, err);
      setErrorMap((prev) => ({ ...prev, [expId]: err?.message || 'Solver execution failed' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [expId]: false }));
    }
  };

  const isAnyLoading = Object.values(loadingMap).some(Boolean);

  const runAll = async () => {
    for (const exp of experiments) {
      await runExperiment(exp.id);
    }
  };

  // Prepare comparison chart data directly from dynamic solution objects.
  const comparisonData = experiments.map((exp) => {
    const sol = solutions[exp.id];
    const isExpiry = exp.model_type === 'expiry';
    return {
      name: exp.id.includes('exp1') ? 'Exp 1: Base/Flat' :
            exp.id.includes('exp2') ? 'Exp 2: Base/Seas' :
            exp.id.includes('exp3') ? 'Exp 3: Exp/Flat' : 'Exp 4: Exp/Seas',
      shifts: sol ? sol.total_shifts : null,
      cost: sol ? Math.round(sol.objective_value * 100) / 100 : null,
      waste: sol && isExpiry && sol.expiry_waste_total !== null ? Math.round(sol.expiry_waste_total * 1000) / 1000 : null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
              <GitCompare className="w-5 h-5" />
            </span>
            4-Way Scenario Laboratory
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 ml-1">
            Factorial comparative matrix: Baseline vs Expiry-Aware formulations across Flat and Seasonal harvest demand profiles.
          </p>
          <div className="flex items-center gap-2 mt-2 ml-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Benchmark Configuration: Fixed {(BENCHMARK_GAP_REL * 100).toFixed(1)}% MIP Gap · {BENCHMARK_TIME_LIMIT_SEC}s Time Limit
            </span>
            <span className="text-xs text-slate-500 italic">
              (Independent of Overview &amp; Solver controls)
            </span>
          </div>
        </div>
        <button
          onClick={runAll}
          disabled={isAnyLoading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
            isAnyLoading
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'soft-button-primary shadow-soft-sm hover:shadow-soft-md active:scale-95'
          }`}
        >
          {isAnyLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Solving Laboratory Experiments...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Solve All 4 Scenarios Live</span>
            </>
          )}
        </button>
      </div>

      {/* Methodological Notice */}
      <div className="soft-card p-4.5 border-l-4 border-l-amber-500 bg-amber-50/60 flex items-start gap-3.5">
        <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 mt-0.5 flex-shrink-0">
          <AlertCircle className="w-4 h-4" />
        </span>
        <div className="text-sm text-amber-950 leading-relaxed">
          <span className="font-bold text-amber-900">Methodological Note on Seasonal Demand:</span> The seasonal harvest surge scenario employs normalized weekly weights (summing to 1.0) preserving each product's 19-week demand volume exactly (12,556 t total). This scenario is <span className="underline font-semibold">illustrative</span> for evaluating smoothing and pre-building capacity, unless backed by empirical harvest data.
        </div>
      </div>

      {/* Grid of 4 Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {experiments.map((exp) => {
          const sol = solutions[exp.id];
          const isLoading = loadingMap[exp.id];
          const errorMsg = errorMap[exp.id];

          // Determine distinct execution status badge
          const statusBadge = isLoading ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-soft-xs">
              <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-amber-700" />
              Running
            </span>
          ) : errorMsg ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-soft-xs">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-rose-700" />
              Failed
            </span>
          ) : sol ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-soft-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Not Run
            </span>
          );

          return (
            <div key={exp.id} className="soft-card p-6 flex flex-col justify-between hover:shadow-soft-md transition-shadow duration-200">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">{exp.name}</h3>
                    <div>{statusBadge}</div>
                  </div>
                  <button
                    onClick={() => runExperiment(exp.id)}
                    disabled={isLoading}
                    className="p-2.5 rounded-xl soft-button text-slate-700 hover:text-teal-800 text-sm transition-all disabled:opacity-50"
                    title="Solve Scenario"
                    aria-label={`Solve ${exp.name}`}
                  >
                    {isLoading ? <RotateCw className="w-4 h-4 animate-spin text-teal-700" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">{exp.desc}</p>

                {errorMsg && (
                  <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-sm flex items-center gap-2.5 shadow-soft-xs">
                    <AlertCircle className="w-4 h-4 text-rose-700 flex-shrink-0" />
                    <span>Error: {errorMsg}</span>
                  </div>
                )}

                {isLoading ? (
                  <div className="p-6 rounded-2xl soft-well text-center text-sm text-slate-600 flex flex-col items-center justify-center gap-2">
                    <RotateCw className="w-5 h-5 animate-spin text-teal-700" />
                    <span className="font-bold text-slate-800">Solving via HiGHS WebAssembly...</span>
                    <span className="text-xs text-slate-500">Executing branch-and-bound optimization</span>
                  </div>
                ) : sol ? (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-3 gap-2.5 text-sm">
                      <div className="soft-well p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider mb-0.5">Total Shifts</span>
                        <span className="text-xl font-bold text-teal-800 tabular-nums">{sol.total_shifts}</span>
                      </div>
                      <div className="soft-well p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider mb-0.5">Operating Cost</span>
                        <span className="text-xl font-bold text-slate-900 tabular-nums">
                          ${sol.objective_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="soft-well p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-600 block uppercase tracking-wider mb-0.5">Expired Waste</span>
                        {sol.expiry_waste_total === null ? (
                          <span className="text-sm font-semibold text-slate-600 italic block mt-1">Not modelled</span>
                        ) : (
                          <span className={`text-xl font-bold tabular-nums ${sol.expiry_waste_total === 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                            {sol.expiry_waste_total.toFixed(3)} t
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm soft-well p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-600 font-medium">Best Dual Bound:</span>{' '}
                        <span className="text-slate-900 font-mono font-bold tabular-nums">
                          {sol.best_bound !== null && sol.best_bound !== undefined
                            ? `$${sol.best_bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'Unavailable'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 font-medium">Achieved Gap:</span>{' '}
                        <span className="text-slate-900 font-mono font-bold tabular-nums">
                          {sol.relative_gap !== null && sol.relative_gap !== undefined
                            ? `${(sol.relative_gap * 100).toFixed(2)}%`
                            : 'Unavailable'}
                        </span>
                        <span className="text-xs text-slate-500 block font-sans">
                          (Tolerance: {(BENCHMARK_GAP_REL * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl soft-well text-center text-sm text-slate-500 font-medium">
                    Benchmark scenario ready for execution. Click play to solve with {(BENCHMARK_GAP_REL * 100).toFixed(1)}% gap tolerance.
                  </div>
                )}
              </div>

              {sol && (
                <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs sm:text-sm text-slate-600 gap-2">
                  <span className="font-mono font-medium">Solve Duration: {sol.solve_time_seconds.toFixed(2)}s</span>
                  {sol.status === 'Optimal' && (sol.relative_gap === null || sol.relative_gap === 0) ? (
                    <span className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Status: Proven Optimal
                    </span>
                  ) : sol.status === 'Optimal' ? (
                    <span className="flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" /> Status: Feasible — optimality not proven
                    </span>
                  ) : sol.status.includes('Time Limit') ? (
                    <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Status: Time Limit Reached
                    </span>
                  ) : sol.status.includes('Iteration Limit') ? (
                    <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Status: Iteration Limit Reached
                    </span>
                  ) : sol.status.includes('Interrupted') ? (
                    <span className="flex items-center gap-1.5 font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Status: Interrupted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Status: {sol.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="soft-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Total Operating Shifts by Scenario</h3>
            <p className="text-sm text-slate-600 mt-0.5">Required crew shifts across 19-week planning horizon</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.6} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} />
                <YAxis stroke="#475569" fontSize={12} domain={[0, 60]} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderColor: '#CBD5E1', 
                    borderRadius: '0.75rem', 
                    boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.1)',
                    color: '#0F172A',
                    fontSize: '12px',
                    fontWeight: 600
                  }} 
                />
                <Bar dataKey="shifts" fill="#0D9488" name="Shifts Required" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="soft-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Total Facility Operating Cost ($)</h3>
            <p className="text-sm text-slate-600 mt-0.5">Direct labour, production volume, and waste penalty costs</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.6} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} />
                <YAxis stroke="#475569" fontSize={12} domain={[60000, 75000]} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    borderColor: '#CBD5E1', 
                    borderRadius: '0.75rem', 
                    boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.1)',
                    color: '#0F172A',
                    fontSize: '12px',
                    fontWeight: 600
                  }} 
                />
                <Bar dataKey="cost" fill="#0284C7" name="Total Cost ($)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
