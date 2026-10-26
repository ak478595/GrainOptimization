import React, { useState } from 'react';
import { SolveResponse, DatasetInfo } from '../types/api';
import { Calendar, Filter } from './icons';

interface ScheduleViewProps {
  solution: SolveResponse | null;
  dataset: DatasetInfo | null;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ solution, dataset }) => {
  const [selectedLine, setSelectedLine] = useState<number | 'ALL'>('ALL');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);

  if (!solution || !dataset) {
    return (
      <div className="soft-card p-12 text-center text-slate-600 font-semibold text-base">
        Run the optimization from the Overview tab to view the production schedule.
      </div>
    );
  }

  const weeks = Array.from({ length: 19 }, (_, i) => i + 1);

  // Group scheduled shifts by week and line
  const shiftMatrix: Record<string, { reg: number; ot: number; tot: number }> = {};
  solution.shift_schedule.forEach((s) => {
    shiftMatrix[`${s.week}-${s.line}`] = {
      reg: s.regular_shifts,
      ot: s.overtime_shifts,
      tot: s.total_shifts,
    };
  });

  // Calculate product production per week/line
  const productionRows: Array<{
    product: string;
    type: string;
    line: number;
    weeklyTons: number[];
    totalTons: number;
  }> = [];

  dataset.products.forEach((prod) => {
    [1, 2].forEach((line) => {
      const weekly = weeks.map((w) => solution.production[prod.name]?.[String(line)]?.[String(w)] || 0);
      const total = weekly.reduce((a, b) => a + b, 0);

      if (!filterActiveOnly || total > 0.001) {
        if (selectedLine === 'ALL' || selectedLine === line) {
          productionRows.push({
            product: prod.name,
            type: prod.type,
            line,
            weeklyTons: weekly,
            totalTons: total,
          });
        }
      }
    });
  });

  // Line summaries
  const line1TotalShifts = weeks.reduce((sum, w) => sum + (shiftMatrix[`${w}-1`]?.tot || 0), 0);
  const line2TotalShifts = weeks.reduce((sum, w) => sum + (shiftMatrix[`${w}-2`]?.tot || 0), 0);

  return (
    <div className="space-y-6">
      {/* Schedule Header Banner */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
              <Calendar className="w-5 h-5" />
            </span>
            Optimized Production Schedule
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 ml-1">
            Weekly shift assignments and product-line batch quantities across the 19-week planning horizon.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-slate-600" />
            <label htmlFor="schedule-line-filter" className="sr-only">Filter by Processing Line</label>
            <select
              id="schedule-line-filter"
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
              className="soft-well border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
            >
              <option value="ALL">All Lines (Line 1 & 2)</option>
              <option value={1}>Line 1 Only</option>
              <option value={2}>Line 2 Only</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-800 soft-well px-3.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="rounded text-teal-700 focus:ring-teal-600 border-slate-300"
            />
            <span>Active Batches Only</span>
          </label>
        </div>
      </div>

      {/* Line Comparison Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="soft-card p-5 flex items-center justify-between border-l-4 border-l-teal-600">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Line 1 (6.175 t/h)</span>
            <span className="text-sm text-slate-600 font-medium">Max 2 Reg + 1 OT/wk</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-teal-800 tabular-nums">{line1TotalShifts}</span>
            <span className="text-xs text-slate-600 font-medium ml-1">shifts</span>
          </div>
        </div>

        <div className="soft-card p-5 flex items-center justify-between border-l-4 border-l-sky-600">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Line 2 (6.650 t/h)</span>
            <span className="text-sm text-slate-600 font-medium">Max 2 Reg + 1 OT/wk</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-sky-800 tabular-nums">{line2TotalShifts}</span>
            <span className="text-xs text-slate-600 font-medium ml-1">shifts</span>
          </div>
        </div>

        <div className="soft-card p-5 flex items-center justify-between border-l-4 border-l-slate-700">
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Facility Total</span>
            <span className="text-sm text-slate-600 font-medium">Max 3 Shifts Combined/wk</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{solution.total_shifts}</span>
            <span className="text-xs text-slate-600 font-medium ml-1">shifts</span>
          </div>
        </div>
      </div>

      {/* Shift Allocation Table */}
      <div className="soft-card p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Weekly Line Shift Allocations</h3>
          <p className="text-sm text-slate-600 mt-0.5">Crew scheduling per line. Facility capacity limit is 3 shifts combined in any single week.</p>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-soft-xs">
          <table className="w-full text-center text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-700 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-left sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">
                  Line / Shift Type
                </th>
                {weeks.map((w) => (
                  <th key={w} scope="col" className="py-3.5 px-2.5">W{w}</th>
                ))}
                <th scope="col" className="py-3.5 px-4 font-bold text-slate-900 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {/* Line 1 */}
              {(selectedLine === 'ALL' || selectedLine === 1) && (
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-left font-bold text-teal-900 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0] whitespace-nowrap">
                    Line 1 Shifts
                  </td>
                  {weeks.map((w) => {
                    const shifts = shiftMatrix[`${w}-1`]?.tot || 0;
                    return (
                      <td key={w} className={`py-2.5 px-2.5 font-mono tabular-nums ${shifts > 0 ? 'text-teal-900 font-bold bg-teal-50/70' : 'text-slate-400'}`}>
                        {shifts > 0 ? shifts : '-'}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 font-bold font-mono text-teal-900 text-right tabular-nums">
                    {line1TotalShifts}
                  </td>
                </tr>
              )}

              {/* Line 2 */}
              {(selectedLine === 'ALL' || selectedLine === 2) && (
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-left font-bold text-sky-900 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0] whitespace-nowrap">
                    Line 2 Shifts
                  </td>
                  {weeks.map((w) => {
                    const shifts = shiftMatrix[`${w}-2`]?.tot || 0;
                    return (
                      <td key={w} className={`py-2.5 px-2.5 font-mono tabular-nums ${shifts > 0 ? 'text-sky-900 font-bold bg-sky-50/70' : 'text-slate-400'}`}>
                        {shifts > 0 ? shifts : '-'}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 font-bold font-mono text-sky-900 text-right tabular-nums">
                    {line2TotalShifts}
                  </td>
                </tr>
              )}

              {/* Combined Total */}
              {selectedLine === 'ALL' && (
                <tr className="bg-slate-50/90 font-bold border-t-2 border-slate-200">
                  <td className="py-3.5 px-4 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0] whitespace-nowrap">
                    Combined Facility (Max 3)
                  </td>
                  {weeks.map((w) => {
                    const tot = (shiftMatrix[`${w}-1`]?.tot || 0) + (shiftMatrix[`${w}-2`]?.tot || 0);
                    const isExceeded = tot > 3;
                    return (
                      <td 
                        key={w} 
                        className={`py-2.5 px-2.5 font-mono tabular-nums ${
                          isExceeded 
                            ? 'text-rose-800 font-extrabold bg-rose-100' 
                            : tot > 0 
                            ? 'text-slate-900 font-bold' 
                            : 'text-slate-400'
                        }`}
                        title={isExceeded ? `Capacity exceeded: ${tot} shifts` : `${tot} shifts scheduled`}
                      >
                        {tot}
                      </td>
                    );
                  })}
                  <td className="py-3.5 px-4 font-mono text-slate-900 text-base text-right tabular-nums">
                    {solution.total_shifts}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Production Table */}
      <div className="soft-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Product Batch Production (Tonnes)</h3>
            <p className="text-sm text-slate-600 mt-0.5">Quantities assigned to each line by week to fulfill demands</p>
          </div>
          <span className="text-xs font-bold text-slate-700 soft-well px-3.5 py-1.5 rounded-lg border border-slate-200">
            Showing {productionRows.length} active assignments
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-soft-xs">
          <table className="w-full text-right text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-700 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-left sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">Product</th>
                <th scope="col" className="py-3.5 px-3 text-left">Line</th>
                {weeks.map((w) => (
                  <th key={w} scope="col" className="py-3.5 px-2.5">W{w}</th>
                ))}
                <th scope="col" className="py-3.5 px-4 font-bold text-slate-900 text-right">Total (t)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {productionRows.map((row, idx) => (
                <tr key={`${row.product}-${row.line}-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-left font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">
                    {row.product}
                    <span className="ml-1.5 text-xs text-slate-600 font-medium">({row.type})</span>
                  </td>
                  <td className="py-3 px-3 text-left">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      row.line === 1 
                        ? 'bg-teal-50 text-teal-800 border border-teal-200' 
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}>
                      Line {row.line}
                    </span>
                  </td>
                  {row.weeklyTons.map((tons, i) => (
                    <td key={i} className={`py-2.5 px-2.5 font-mono tabular-nums ${tons > 0.1 ? 'text-teal-900 font-bold bg-teal-50/40' : 'text-slate-400'}`}>
                      {tons > 0.1 ? tons.toFixed(1) : '-'}
                    </td>
                  ))}
                  <td className="py-3 px-4 font-bold font-mono text-slate-900 text-right tabular-nums">
                    {row.totalTons.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
