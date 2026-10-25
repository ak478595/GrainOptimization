import React, { useState } from 'react';
import { SolveResponse, DatasetInfo } from '../types/api';
import { Calendar, Filter, Download } from './icons';

interface ScheduleViewProps {
  solution: SolveResponse | null;
  dataset: DatasetInfo | null;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ solution, dataset }) => {
  const [selectedLine, setSelectedLine] = useState<number | 'ALL'>('ALL');
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);

  if (!solution || !dataset) {
    return (
      <div className="p-8 text-center text-slate-400">
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

  return (
    <div className="space-y-6">
      {/* Schedule Header */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Optimized Production Schedule
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Weekly shift assignments and product-line batch quantities across the 19-week horizon
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs"
            >
              <option value="ALL">All Lines (Line 1 & 2)</option>
              <option value={1}>Line 1 Only</option>
              <option value={2}>Line 2 Only</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filterActiveOnly}
              onChange={(e) => setFilterActiveOnly(e.target.checked)}
              className="rounded text-emerald-500 focus:ring-emerald-400 bg-slate-800 border-slate-700"
            />
            <span>Active SKUs Only</span>
          </label>
        </div>
      </div>

      {/* Shift Allocation Table */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <h3 className="text-base font-semibold text-white mb-3">Weekly Line Shift Allocations</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 px-3 text-left">Line / Shift Type</th>
                {weeks.map((w) => (
                  <th key={w} className="py-2 px-2">W{w}</th>
                ))}
                <th className="py-2 px-3 font-bold text-white">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {/* Line 1 */}
              {(selectedLine === 'ALL' || selectedLine === 1) && (
                <tr className="hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-left font-medium text-emerald-400">Line 1 Total Shifts</td>
                  {weeks.map((w) => {
                    const shifts = shiftMatrix[`${w}-1`]?.tot || 0;
                    return (
                      <td key={w} className={`py-2 px-2 font-mono ${shifts > 0 ? 'text-white font-bold bg-emerald-950/30' : 'text-slate-600'}`}>
                        {shifts}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 font-bold font-mono text-emerald-400">
                    {weeks.reduce((sum, w) => sum + (shiftMatrix[`${w}-1`]?.tot || 0), 0)}
                  </td>
                </tr>
              )}

              {/* Line 2 */}
              {(selectedLine === 'ALL' || selectedLine === 2) && (
                <tr className="hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-left font-medium text-blue-400">Line 2 Total Shifts</td>
                  {weeks.map((w) => {
                    const shifts = shiftMatrix[`${w}-2`]?.tot || 0;
                    return (
                      <td key={w} className={`py-2 px-2 font-mono ${shifts > 0 ? 'text-white font-bold bg-blue-950/30' : 'text-slate-600'}`}>
                        {shifts}
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 font-bold font-mono text-blue-400">
                    {weeks.reduce((sum, w) => sum + (shiftMatrix[`${w}-2`]?.tot || 0), 0)}
                  </td>
                </tr>
              )}

              {/* Combined Total */}
              {selectedLine === 'ALL' && (
                <tr className="bg-slate-900/60 font-bold border-t border-slate-700">
                  <td className="py-2.5 px-3 text-left text-white">Facility Weekly Shifts (Max 3)</td>
                  {weeks.map((w) => {
                    const tot = (shiftMatrix[`${w}-1`]?.tot || 0) + (shiftMatrix[`${w}-2`]?.tot || 0);
                    return (
                      <td key={w} className={`py-2 px-2 font-mono ${tot > 3 ? 'text-rose-400 font-extrabold' : 'text-emerald-300'}`}>
                        {tot}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 font-mono text-white text-sm">
                    {solution.total_shifts}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Production Table */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">Product Batch Production (Tonnes)</h3>
            <p className="text-xs text-slate-400">Quantities assigned to each line by week to fulfill demands</p>
          </div>
          <span className="text-xs text-slate-400">Showing {productionRows.length} active assignments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 px-3 text-left">Product</th>
                <th className="py-2 px-2 text-left">Line</th>
                {weeks.map((w) => (
                  <th key={w} className="py-2 px-2">W{w}</th>
                ))}
                <th className="py-2 px-3 font-bold text-white">Total (t)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {productionRows.map((row, idx) => (
                <tr key={`${row.product}-${row.line}-${idx}`} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-left font-semibold text-white whitespace-nowrap">
                    {row.product}
                    <span className="ml-2 text-[10px] text-slate-400 font-normal">({row.type})</span>
                  </td>
                  <td className="py-2 px-2 text-left">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      row.line === 1 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                    }`}>
                      Line {row.line}
                    </span>
                  </td>
                  {row.weeklyTons.map((tons, i) => (
                    <td key={i} className={`py-2 px-2 font-mono ${tons > 0.1 ? 'text-emerald-300 font-semibold' : 'text-slate-600'}`}>
                      {tons > 0.1 ? tons.toFixed(1) : '-'}
                    </td>
                  ))}
                  <td className="py-2 px-3 font-bold font-mono text-white">
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
