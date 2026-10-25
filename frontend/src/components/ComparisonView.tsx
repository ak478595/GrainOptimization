import React, { useState } from 'react';
import { SolveResponse } from '../types/api';
import { solveModel } from '../services/api';
import { GitCompare, Play, RotateCw, CheckCircle2, TrendingDown, DollarSign, Calendar, AlertCircle } from './icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface ComparisonViewProps {
  initialSolutions?: Record<string, SolveResponse>;
}

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
      desc: 'Bayá et al. reproduction: rigid weekly JIT for inoculated items.',
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
      desc: 'GrainOpt 2.0 cohort model enabling 2-week pre-building.',
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
        gap_rel: 0.05,
        time_limit_sec: 120,
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
  // Unsolved, running, or failed experiments have shifts and cost set to null so they are not plotted as 0.
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
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-emerald-400" />
            4-Way Scenario Laboratory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Systematic factorial evaluation of Baseline vs Expiry-Aware formulations across Flat and Seasonal Demand
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={isAnyLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
            isAnyLoading
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/25 active:scale-95'
          }`}
        >
          {isAnyLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
              Solving Laboratory Experiments...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Solve All 4 Scenarios Live
            </>
          )}
        </button>
      </div>

      {/* Illustrative Notice */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200/90 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Methodological Note on Seasonal Demand:</span> The seasonal harvest surge scenario employs normalized weekly weights (summing to 1.0) preserving each product's 19-week demand volume exactly (12,556 t total). This scenario is <span className="underline">illustrative</span> for evaluating smoothing and pre-building capacity, unless backed by empirical harvest data.
        </div>
      </div>

      {/* Grid of 4 Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {experiments.map((exp) => {
          const sol = solutions[exp.id];
          const isLoading = loadingMap[exp.id];
          const errorMsg = errorMap[exp.id];

          // Determine distinct execution status
          const statusBadge = isLoading ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800">
              <RotateCw className="w-3 h-3 mr-1 animate-spin text-amber-400" />
              Running
            </span>
          ) : errorMsg ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/70 text-rose-300 border border-rose-800">
              <AlertCircle className="w-3 h-3 mr-1 text-rose-400" />
              Failed
            </span>
          ) : sol ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
              Not Run
            </span>
          );

          return (
            <div key={exp.id} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{exp.name}</h3>
                    {statusBadge}
                  </div>
                  <button
                    onClick={() => runExperiment(exp.id)}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition disabled:opacity-50"
                    title="Solve Scenario"
                  >
                    {isLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-4">{exp.desc}</p>

                {errorMsg && (
                  <div className="mb-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Error: {errorMsg}</span>
                  </div>
                )}

                {isLoading ? (
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Solving via HiGHS Wasm...</span>
                  </div>
                ) : sol ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block">Total Shifts</span>
                        <span className="text-base font-bold text-emerald-400">{sol.total_shifts}</span>
                      </div>
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block">Operating Cost</span>
                        <span className="text-base font-bold text-white">${sol.objective_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block">Expired Waste</span>
                        {sol.expiry_waste_total === null ? (
                          <span className="text-xs font-semibold text-slate-400">Not modelled</span>
                        ) : (
                          <span className={`text-base font-bold ${sol.expiry_waste_total === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sol.expiry_waste_total.toFixed(3)} t
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-500">Best Dual Bound:</span>{' '}
                        <span className="text-slate-300 font-mono">${sol.best_bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Relative Gap:</span>{' '}
                        <span className="text-slate-300 font-mono">{(sol.relative_gap * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                    Not solved yet. Click play to execute solver.
                  </div>
                )}
              </div>

              {sol && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                  <span>Solve Duration: {sol.solve_time_seconds.toFixed(2)}s</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Solver Status: {sol.status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <h3 className="text-base font-semibold text-white mb-2">Total Operating Shifts by Scenario</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 60]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }} />
                <Bar dataKey="shifts" fill="#10b981" name="Shifts Required" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <h3 className="text-base font-semibold text-white mb-2">Total Facility Operating Cost ($)</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[60000, 75000]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }} />
                <Bar dataKey="cost" fill="#3b82f6" name="Total Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
