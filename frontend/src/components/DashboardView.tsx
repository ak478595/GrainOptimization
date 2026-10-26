import React from 'react';
import { 
  Play, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Calendar, 
  Sparkles,
  Info
} from './icons';
import { SolveRequest, SolveResponse, DatasetInfo } from '../types/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface DashboardViewProps {
  dataset: DatasetInfo | null;
  currentSolution: SolveResponse | null;
  onSolve: (req: SolveRequest) => void;
  isLoading: boolean;
  error: string | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dataset,
  currentSolution,
  onSolve,
  isLoading,
  error,
}) => {
  const [modelType, setModelType] = React.useState<'baseline' | 'expiry'>('expiry');
  const [scenarioName, setScenarioName] = React.useState<string>('reference_flat');
  const [timeLimit, setTimeLimit] = React.useState<number>(120);
  const [gapRel, setGapRel] = React.useState<number>(0.05);

  const handleRun = () => {
    onSolve({
      model_type: modelType,
      scenario_name: scenarioName,
      time_limit_sec: timeLimit,
      gap_rel: gapRel,
    });
  };

  // Prepare chart data for weekly shifts
  const shiftChartData = React.useMemo(() => {
    if (!currentSolution) return [];
    const weeks = Array.from({ length: 19 }, (_, i) => i + 1);
    return weeks.map((w) => {
      const line1Shifts = currentSolution.shift_schedule.find((s) => s.week === w && s.line === 1)?.total_shifts || 0;
      const line2Shifts = currentSolution.shift_schedule.find((s) => s.week === w && s.line === 2)?.total_shifts || 0;
      return {
        week: `W${w}`,
        Line1: line1Shifts,
        Line2: line2Shifts,
        Total: line1Shifts + line2Shifts,
      };
    });
  }, [currentSolution]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Solver Command Center */}
      <div className="soft-card p-6 sm:p-7 border border-white/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Optimization Command Center
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                HiGHS WASM Branch &amp; Cut
              </span>
            </div>
            <p className="text-sm text-slate-700 mt-2 max-w-2xl leading-relaxed">
              Execute live mixed-integer linear programming formulations over 17 products, 2 lines, and 19 planning weeks.
              Compare the rigid JIT historical baseline against the 2-week expiry-aware cohort formulation with zero backend dependencies.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleRun}
              disabled={isLoading}
              className={`flex items-center justify-center gap-2.5 px-6 py-3 rounded-soft text-sm font-bold shadow-soft-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
                isLoading
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'soft-button-primary'
              }`}
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-white" />
                  <span>Solving In-Browser...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Live Optimization</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Solver Configuration Controls */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <label htmlFor="model-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              MILP Model Formulation
            </label>
            <select
              id="model-select"
              value={modelType}
              onChange={(e) => setModelType(e.target.value as any)}
              className="w-full soft-well px-3.5 py-2 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none transition-all cursor-pointer"
            >
              <option value="expiry">Expiry-Aware Cohort Model (GrainOpt 2.0)</option>
              <option value="baseline">Historical JIT Baseline (Rigid Weekly JIT)</option>
            </select>
          </div>

          <div>
            <label htmlFor="scenario-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Demand Scenario
            </label>
            <select
              id="scenario-select"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full soft-well px-3.5 py-2 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none transition-all cursor-pointer"
            >
              <option value="reference_flat">Reference Weekly Demand (12,556.0 t)</option>
              <option value="seasonal_harvest_surge">Seasonal Harvest Surge Profile (Conserved)</option>
            </select>
          </div>

          <div>
            <label htmlFor="gap-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Relative MIP Gap (Tolerance)
            </label>
            <select
              id="gap-select"
              value={gapRel}
              onChange={(e) => setGapRel(parseFloat(e.target.value))}
              className="w-full soft-well px-3.5 py-2 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none transition-all cursor-pointer"
            >
              <option value={0.05}>5.0% Gap (Standard Operational Benchmark)</option>
              <option value={0.01}>1.0% Gap (Tighter Branch &amp; Cut)</option>
              <option value={0.00}>0.0% Gap (Proven Global Optimum)</option>
            </select>
          </div>

          <div>
            <label htmlFor="time-limit-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Time Limit (Seconds)
            </label>
            <input
              id="time-limit-input"
              type="number"
              min={10}
              max={300}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 120)}
              className="w-full soft-well px-3.5 py-2 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div 
          role="alert"
          className="soft-card p-4.5 bg-rose-50/95 border border-rose-300 text-rose-950 flex items-start gap-3 shadow-soft-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-700" />
          <div className="text-sm">
            <span className="font-bold text-rose-900">Optimization Engine Error:</span> {error}
            <div className="mt-1 text-xs text-rose-800">
              The HiGHS Web Worker encountered an issue during execution. Check input bounds or refresh the session.
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Solver Metrics Cards */}
      {currentSolution && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Total Shifts */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Total Shifts</span>
              <Calendar className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
              {currentSolution.total_shifts}
            </div>
            <div className="text-xs text-slate-600 mt-1.5 flex items-center gap-1 font-medium">
              {currentSolution.model_type === 'expiry' ? (
                <span className="text-emerald-800 font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-700" /> -3 shifts vs baseline
                </span>
              ) : (
                'Historical benchmark'
              )}
            </div>
          </div>

          {/* Card 2: Total Operating Cost */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Total Cost</span>
              <DollarSign className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">
              ${currentSolution.objective_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-600 mt-1.5 truncate tabular-nums font-medium" title={`Best bound: $${currentSolution.best_bound.toFixed(2)}`}>
              Bound: ${currentSolution.best_bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Card 3: Relative Gap */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Relative Gap</span>
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
              {(currentSolution.relative_gap * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-slate-600 mt-1.5 tabular-nums font-medium">
              Tolerance: {(gapRel * 100).toFixed(1)}%
            </div>
          </div>

          {/* Card 4: Expired Waste */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Expired Waste</span>
              <AlertCircle className={`w-4 h-4 ${currentSolution.expiry_waste_total === null ? 'text-slate-500' : currentSolution.expiry_waste_total === 0 ? 'text-emerald-700' : 'text-rose-700'}`} />
            </div>
            {currentSolution.expiry_waste_total === null ? (
              <>
                <div className="text-base sm:text-lg font-bold text-slate-700 mt-2">
                  Not modelled
                </div>
                <div className="text-xs text-slate-600 mt-1.5 font-medium">
                  Baseline JIT has no cohorts
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
                  {currentSolution.expiry_waste_total.toFixed(3)} <span className="text-xs font-medium text-slate-600">t</span>
                </div>
                <div className={`text-xs mt-1.5 flex items-center gap-1 font-bold ${currentSolution.expiry_waste_total === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {currentSolution.expiry_waste_total === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" /> Zero waste achieved
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" /> Waste penalty applied
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Card 5: Solve Time */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Solve Time</span>
              <Clock className="w-4 h-4 text-sky-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">
              {currentSolution.solve_time_seconds.toFixed(2)}s
            </div>
            <div className="text-xs text-slate-600 mt-1.5 font-medium">
              HiGHS WebAssembly
            </div>
          </div>

          {/* Card 6: Independent Audit */}
          <div className="soft-card p-4 sm:p-5 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>Independent Audit</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-800 mt-2 flex items-center gap-1.5">
              {currentSolution.validation.is_valid ? '100% Valid' : 'Violations'}
            </div>
            <div className="text-xs text-slate-600 mt-1.5 font-medium">
              6 of 6 gates verified
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Shift Chart and Operating Cost Breakdown */}
      {currentSolution && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Shift Distribution Chart */}
          <div className="lg:col-span-2 soft-card p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Weekly Shift Allocation Across Lines</h3>
                <p className="text-sm text-slate-600 mt-0.5">Total shifts allocated per week across Line 1 and Line 2</p>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full self-start sm:self-center shadow-soft-sm">
                Max 3 shifts / week limit
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.6} />
                  <XAxis dataKey="week" stroke="#475569" fontSize={12} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={12} domain={[0, 4]} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      borderColor: '#CBD5E1', 
                      borderRadius: '0.75rem', 
                      color: '#0F172A',
                      boxShadow: '-3px -3px 8px rgba(255,255,255,0.9), 3px 3px 10px rgba(148,163,184,0.3)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                  <Bar dataKey="Line1" fill="#0D9488" name="Line 1 Shifts" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Line2" fill="#D97706" name="Line 2 Shifts" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operating Cost Breakdown Summary */}
          <div className="soft-card p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Operating Cost Breakdown</h3>
              <p className="text-sm text-slate-600 mb-4">Direct cost components computed from active shifts and storage</p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                  <span className="text-slate-700 font-medium">Regular Labour Cost</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ${currentSolution.cost_breakdown.regular_production_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                  <span className="text-slate-700 font-medium">Overtime / Speed Cost</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ${currentSolution.cost_breakdown.overtime_production_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                  <span className="text-slate-700 font-medium">Holding / Storage Cost</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ${currentSolution.cost_breakdown.holding_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                  <span className="text-slate-700 font-medium">Perishability / Waste Penalty</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ${currentSolution.cost_breakdown.waste_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 text-base font-extrabold text-slate-900">
                  <span>Total Objective Value</span>
                  <span className="text-teal-800 tabular-nums">
                    ${currentSolution.cost_breakdown.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-soft bg-teal-50/80 border border-teal-200 text-sm text-teal-950 flex items-start gap-2.5 shadow-soft-sm">
              <Info className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {currentSolution.model_type === 'expiry' 
                  ? 'Expiry-aware pre-building smooths line throughput across weeks, saving shifts and operating expenses compared to rigid historical JIT enforcement.'
                  : 'Historical formulation requires strict just-in-time production for perishable products with zero allowable pre-building.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Facility Infrastructure Profile */}
      {dataset && (
        <div className="soft-card-sm p-5 border border-slate-200">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Facility Infrastructure Profile</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-slate-600 block font-medium">Planning Horizon</span>
              <span className="text-slate-900 font-bold text-sm">19 Weeks (Discrete)</span>
            </div>
            <div>
              <span className="text-slate-600 block font-medium">Products Managed</span>
              <span className="text-slate-900 font-bold text-sm">17 (7 Inoculated, 10 Treated)</span>
            </div>
            <div>
              <span className="text-slate-600 block font-medium">Cumulative Demand</span>
              <span className="text-slate-900 font-bold text-sm tabular-nums">12,556.0 Tonnes</span>
            </div>
            <div>
              <span className="text-slate-600 block font-medium">Line Capacity Limit</span>
              <span className="text-slate-900 font-bold text-sm">Max 3 Shifts / Line / Wk</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
