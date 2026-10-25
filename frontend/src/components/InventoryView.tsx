import React, { useState } from 'react';
import { SolveResponse, DatasetInfo } from '../types/api';
import { Package, ShieldAlert, CheckCircle2, Clock, AlertTriangle, Info } from './icons';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface InventoryViewProps {
  solution: SolveResponse | null;
  dataset: DatasetInfo | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ solution, dataset }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('P1');

  if (!solution || !dataset) {
    return (
      <div className="p-8 text-center text-slate-400">
        Run the optimization from the Overview tab to view inventory ageing and expiry metrics.
      </div>
    );
  }

  const weeks = Array.from({ length: 19 }, (_, i) => i + 1);
  const inoculatedProducts = dataset.products.filter((p) => p.type === 'inoculated');

  // Chart data for selected inoculated product cohort evolution
  const cohortChartData = weeks.map((w) => {
    const age0 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['0'] || 0;
    const age1 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['1'] || 0;
    const age2 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['2'] || 0; // always 0 by conservation
    const waste = solution.waste_by_week?.[selectedProduct]?.[String(w)] || 0;

    return {
      week: `W${w}`,
      'Age 0 (Fresh)': Math.round(age0 * 10) / 10,
      'Age 1 (1 Wk Old)': Math.round(age1 * 10) / 10,
      'Age 2 (Terminal)': Math.round(age2 * 10) / 10,
      'Waste Expired': Math.round(waste * 10) / 10,
      total: Math.round((age0 + age1) * 10) / 10,
    };
  });

  // Calculate total end-of-horizon metrics
  const totalWaste = solution.expiry_waste_total;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Inventory Ageing & Expiry Waste Tracking
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking perishable grain cohorts across allowed 2-week shelf life (ages 0, 1, 2) with zero silent degradation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 rounded-xl text-xs">
            {totalWaste === null ? (
              <>
                <Info className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Total Horizon Waste:</span>
                <span className="font-semibold text-slate-400">Not modelled (Baseline JIT)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className={`w-4 h-4 ${totalWaste === 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span className="text-slate-300">Total Horizon Waste:</span>
                <span className={`font-bold font-mono ${totalWaste === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {totalWaste.toFixed(3)} t
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cohort Ageing Rules Infobox */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-4 h-4" />
            Age 0: Fresh Production
          </div>
          <p className="text-slate-400">
            Stock produced in week s. Can satisfy week s demand immediately. Unconsumed stock transitions to Age 1 at week s+1.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
            <Clock className="w-4 h-4" />
            Age 1: Intermediate Carryover
          </div>
          <p className="text-slate-400">
            Stock held for 1 week. Can satisfy week s demand. Any unconsumed carryover transitions to Age 2 for its final eligible week.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="font-semibold text-rose-400 flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-4 h-4" />
            Age 2: Terminal Eligibility & Waste
          </div>
          <p className="text-slate-400">
            Final eligible week s+2. Must satisfy demand or be explicitly discarded as waste W(v,s). End-of-week I(v,s,2) = 0.
          </p>
        </div>
      </div>

      {/* Cohort Visualizer */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Cohort Ageing Evolution: {selectedProduct}</h3>
            <p className="text-xs text-slate-400">Inventory volume held in storage categorized by age cohort</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Select Inoculated SKU:</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-semibold"
            >
              {inoculatedProducts.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cohortChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAge0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorAge1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                formatter={(val: any) => [`${val} tonnes`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Age 0 (Fresh)" stroke="#10b981" fillOpacity={1} fill="url(#colorAge0)" stackId="1" />
              <Area type="monotone" dataKey="Age 1 (1 Wk Old)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAge1)" stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Inventory Table */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <h3 className="text-base font-semibold text-white mb-1">Weekly Closing Inventory Matrix (All SKUs)</h3>
        <p className="text-xs text-slate-400 mb-3">Total physical stock carried into next week (Tonnes)</p>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2 px-3 text-left">Product</th>
                <th className="py-2 px-2 text-left">Type</th>
                {weeks.map((w) => (
                  <th key={w} className="py-2 px-2">W{w}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {dataset.products.map((prod) => (
                <tr key={prod.name} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3 text-left font-semibold text-white whitespace-nowrap">
                    {prod.name}
                  </td>
                  <td className="py-2 px-2 text-left">
                    <span className={`text-[10px] ${prod.type === 'inoculated' ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {prod.type}
                    </span>
                  </td>
                  {weeks.map((w) => {
                    const inv = solution.inventory[prod.name]?.[String(w)] || 0;
                    return (
                      <td key={w} className={`py-2 px-2 font-mono ${inv > 0.1 ? 'text-slate-200' : 'text-slate-600'}`}>
                        {inv > 0.1 ? inv.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
